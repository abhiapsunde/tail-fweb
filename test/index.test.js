'use strict';

const { test }  = require('node:test');
const assert    = require('node:assert/strict');
const http      = require('http');
const express   = require('express');
const fs        = require('fs');
const os        = require('os');
const path      = require('path');

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
