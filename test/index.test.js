'use strict';

const { test }  = require('node:test');
const assert    = require('node:assert/strict');
const http      = require('http');
const express   = require('express');
const fs        = require('fs');
const os        = require('os');
const path       = require('path');
const { io: ioClient } = require('socket.io-client');

const tailFweb    = require('../lib');
const generateHtml = require('../lib/html');

// ── helpers ──────────────────────────────────────────────────────────────────

function tmpFile(content) {
    const dir  = fs.mkdtempSync(path.join(os.tmpdir(), 'tfw-'));
    const file = path.join(dir, 'test.log');
    fs.writeFileSync(file, content || '');
    return { file, cleanup: () => fs.rmSync(dir, { recursive: true }) };
}

function get(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => resolve({ status: res.statusCode, body }));
        }).on('error', reject);
    });
}

function listen(app) {
    return new Promise((resolve) => {
        const server = http.createServer(app);
        server.listen(0, () => resolve(server));
    });
}

// ── tailFweb() validation ─────────────────────────────────────────────────────

test('throws when filename is omitted', () => {
    assert.throws(() => tailFweb(), /filename is required/);
});

test('throws when file does not exist', () => {
    assert.throws(
        () => tailFweb('/tmp/__tail_fweb_no_such_file__.log'),
        /file not found/
    );
});

test('returns an Express-compatible router', () => {
    const { file, cleanup } = tmpFile();
    const router = tailFweb(file);
    assert.equal(typeof router, 'function');
    assert.equal(typeof router.use, 'function');
    assert.equal(typeof router.get, 'function');
    cleanup();
});

test('accepts maxLines option without throwing', () => {
    const { file, cleanup } = tmpFile();
    assert.doesNotThrow(() => tailFweb(file, { maxLines: 100 }));
    cleanup();
});

// ── generateHtml() ────────────────────────────────────────────────────────────

test('injects wsPath into socket.io script src', () => {
    const html = generateHtml({ wsPath: '/app/logs/ws' });
    assert.ok(html.includes('src="/app/logs/ws/socket.io.js"'));
});

test('injects wsPath into io() call', () => {
    const html = generateHtml({ wsPath: '/app/logs/ws' });
    assert.ok(html.includes("path: '/app/logs/ws'"));
});

test('includes custom title', () => {
    const html = generateHtml({ wsPath: '/x/ws', title: 'My Service Logs' });
    assert.ok(html.includes('My Service Logs'));
});

test('includes filename in header when provided', () => {
    const html = generateHtml({ wsPath: '/x/ws', filename: '/var/log/app.log' });
    assert.ok(html.includes('/var/log/app.log'));
});

test('omits filename span when filename not provided', () => {
    const html = generateHtml({ wsPath: '/x/ws' });
    assert.ok(!html.includes('class="file"'));
});

test('produces valid HTML5 doctype', () => {
    const html = generateHtml({ wsPath: '/x/ws' });
    assert.ok(html.trim().startsWith('<!DOCTYPE html>'));
});

// ── HTTP integration ──────────────────────────────────────────────────────────

test('GET /mount serves 200 with correct wsPath', async () => {
    const { file, cleanup } = tmpFile('hello world\n');
    const app = express();
    app.use('/logs', tailFweb(file));
    const server = await listen(app);
    const port = server.address().port;

    try {
        const res = await get(`http://localhost:${port}/logs/`);
        assert.equal(res.status, 200);
        assert.ok(res.body.includes('src="/logs/ws/socket.io.js"'), 'script src');
        assert.ok(res.body.includes("path: '/logs/ws'"), 'io() path');
    } finally {
        server.close();
        cleanup();
    }
});

test('same middleware instance can serve multiple sequential requests', async () => {
    const { file, cleanup } = tmpFile();
    const app = express();
    app.use('/tail', tailFweb(file));
    const server = await listen(app);
    const port = server.address().port;

    try {
        const r1 = await get(`http://localhost:${port}/tail/`);
        const r2 = await get(`http://localhost:${port}/tail/`);
        assert.equal(r1.status, 200);
        assert.equal(r2.status, 200);
    } finally {
        server.close();
        cleanup();
    }
});

test('two instances on different mount paths coexist', async () => {
    const a = tmpFile();
    const b = tmpFile();
    const app = express();
    app.use('/log-a', tailFweb(a.file, { title: 'A' }));
    app.use('/log-b', tailFweb(b.file, { title: 'B' }));
    const server = await listen(app);
    const port = server.address().port;

    try {
        const ra = await get(`http://localhost:${port}/log-a/`);
        const rb = await get(`http://localhost:${port}/log-b/`);
        assert.equal(ra.status, 200);
        assert.equal(rb.status, 200);
        assert.ok(ra.body.includes("path: '/log-a/ws'"), 'A has correct wsPath');
        assert.ok(rb.body.includes("path: '/log-b/ws'"), 'B has correct wsPath');
    } finally {
        server.close();
        a.cleanup();
        b.cleanup();
    }
});

// ── live tail / websocket ─────────────────────────────────────────────────────
// The actual point of this library - streaming appended lines to a
// connected client - was previously untested entirely (only HTML output
// and bare HTTP 200s were checked). This is exactly the code path most
// exposed to a socket.io or nodejs-tail dependency bump breaking
// something silently.

// Creates the client but doesn't wait for the handshake - callers can
// attach listeners on the returned socket before connecting finishes.
// That ordering matters: the server replays its buffered history
// synchronously as soon as a connection completes, so a listener
// attached only *after* awaiting connect can lose that race and never
// see it (this bit a first draft of these tests for real - passed
// against Express 4's timing, then hung against Express 5's, since it
// was always a race, just a latent one).
function makeClient(port, wsPath) {
    return ioClient(`http://localhost:${port}`, {
        path: wsPath,
        forceNew: true,
        // Skips the default long-polling handshake, which needs an XHR
        // shim that's unreliable in a plain Node test environment (no
        // browser XHR available).
        transports: ['websocket'],
    });
}

function waitForConnect(socket) {
    return new Promise((resolve, reject) => {
        socket.on('connect', () => resolve(socket));
        socket.on('connect_error', reject);
    });
}

// For the common case where ordering doesn't matter (nothing is
// buffered yet, or the test is appending a genuinely new line after
// connecting) - connects and resolves once ready.
function connectClient(port, wsPath) {
    const socket = makeClient(port, wsPath);
    return waitForConnect(socket);
}

function waitForLog(socket) {
    return new Promise((resolve) => socket.once('log', resolve));
}

// tailFweb() attaches its socket.io server lazily, on the first HTTP
// request through the router - real usage always GETs the viewer page
// before its own client-side JS opens a websocket, so tests need to do
// the same rather than connecting a socket.io client cold.
function loadViewer(port, mountPath) {
    return get(`http://localhost:${port}${mountPath}/`);
}

test('appending a line streams it to a connected client', async () => {
    const { file, cleanup } = tmpFile();
    const app = express();
    app.use('/logs', tailFweb(file));
    const server = await listen(app);
    const port = server.address().port;
    let socket;

    try {
        await loadViewer(port, '/logs');
        socket = await connectClient(port, '/logs/ws');
        const received = waitForLog(socket);
        fs.appendFileSync(file, 'a fresh line\n');
        const line = await received;
        assert.equal(line, 'a fresh line');
    } finally {
        if (socket) socket.close();
        server.close();
        cleanup();
    }
});

test('a newly connecting client replays buffered history, not just new lines', async () => {
    const { file, cleanup } = tmpFile();
    const app = express();
    app.use('/logs', tailFweb(file));
    const server = await listen(app);
    const port = server.address().port;
    let first, second;

    try {
        await loadViewer(port, '/logs');
        // First client establishes the tail watcher and receives the
        // line live, populating the in-memory buffer.
        first = await connectClient(port, '/logs/ws');
        const firstReceived = waitForLog(first);
        fs.appendFileSync(file, 'line before second client connects\n');
        await firstReceived;

        // Second client connects after that line was already written -
        // it never saw it live, only replay-on-connect can deliver it.
        // Attach the 'log' listener before the connection completes,
        // not after - see makeClient()'s comment for why.
        second = makeClient(port, '/logs/ws');
        const replayed = waitForLog(second);
        await waitForConnect(second);
        assert.equal(await replayed, 'line before second client connects');
    } finally {
        if (first) first.close();
        if (second) second.close();
        server.close();
        cleanup();
    }
});

test('maxLines actually caps what gets replayed, not just accepted as an option', async () => {
    const { file, cleanup } = tmpFile();
    const app = express();
    app.use('/logs', tailFweb(file, { maxLines: 2 }));
    const server = await listen(app);
    const port = server.address().port;
    let writer, reader;

    try {
        await loadViewer(port, '/logs');
        writer = await connectClient(port, '/logs/ws');
        for (const line of ['one', 'two', 'three']) {
            const received = waitForLog(writer);
            fs.appendFileSync(file, line + '\n');
            await received;
        }

        // Attach the 'log' listener before connecting, not after -
        // see makeClient()'s comment for why.
        const collected = [];
        reader = makeClient(port, '/logs/ws');
        reader.on('log', (line) => collected.push(line));
        await waitForConnect(reader);
        await new Promise((resolve) => setTimeout(resolve, 200));

        assert.deepEqual(collected, ['two', 'three'], 'only the last maxLines entries replay, oldest dropped');
    } finally {
        if (writer) writer.close();
        if (reader) reader.close();
        server.close();
        cleanup();
    }
});
