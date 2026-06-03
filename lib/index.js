'use strict';

const express     = require('express');
const { Server }  = require('socket.io');
const Tail        = require('nodejs-tail');
const fs          = require('fs');
const generateHtml = require('./html');

/**
 * Returns an Express Router that serves a live log tail viewer.
 *
 * Mount it anywhere in your app:
 *   app.use('/logs', tailFweb('/var/log/app.log'))
 *   app.use('/logs', tailFweb('/var/log/app.log', { title: 'App Logs', maxLines: 2000 }))
 *
 * The viewer is available at the mount path; socket.io attaches at <mountPath>/ws.
 */
function tailFweb(filename, options) {
    options = options || {};
    const maxLines = options.maxLines || 5000;

    if (!filename) throw new Error('tail-fweb: filename is required');
    if (!fs.existsSync(filename)) throw new Error('tail-fweb: file not found: ' + filename);

    const router = express.Router();
    const buffer = [];
    let io = null;
    let initialized = false;

    function init(httpServer, mountPath) {
        if (initialized) return;
        initialized = true;

        const wsPath = mountPath + '/ws';
        io = new Server(httpServer, { path: wsPath });

        const tail = new Tail(filename);
        tail.on('line', (line) => {
            buffer.push(line);
            if (buffer.length > maxLines) buffer.shift();
            io.emit('log', line);
        });
        tail.on('error', (err) => console.error('tail-fweb tail error:', err));
        tail.watch();

        io.on('connection', (socket) => {
            // replay buffered lines so a new browser tab sees history
            buffer.forEach(line => socket.emit('log', line));
        });
    }

    // lazy init: grab the http.Server from the first incoming request
    router.use((req, res, next) => {
        if (!initialized) init(req.socket.server, req.baseUrl);
        next();
    });

    router.get('/', (req, res) => {
        res.send(generateHtml({
            wsPath:   req.baseUrl + '/ws',
            title:    options.title,
            filename: filename,
        }));
    });

    return router;
}

module.exports = tailFweb;
