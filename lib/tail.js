'use strict';

const fs = require('fs');
const EventEmitter = require('events');

/**
 * Watches a file and emits a 'line' event for each line appended to it.
 *
 * Replaces the nodejs-tail dependency, which stores the in-flight read's
 * file descriptor on `this` - two 'change' events firing close together
 * (routine under Linux inotify) let the second overwrite that field before
 * the first read's callback runs, so the first callback closes the wrong
 * fd, the first read errors, and the error handler silently drops the
 * line. Reads here use only locals, and a queued in-flight flag stops two
 * reads from running at once, so no event can be lost that way.
 */
class Tail extends EventEmitter {
  constructor(filename) {
    super();
    this.filename = filename;
    this._watcher = null;
    this._lastSize = 0;
    this._reading = false;
    this._pending = false;
  }

  watch() {
    this._lastSize = fs.statSync(this.filename).size;
    this._watcher = fs.watch(this.filename, { persistent: true }, (eventType) => {
      if (eventType !== 'change') return;
      this._scheduleRead();
    });
  }

  _scheduleRead() {
    if (this._reading) {
      this._pending = true;
      return;
    }
    this._reading = true;
    this._readNewData(() => {
      this._reading = false;
      if (this._pending) {
        this._pending = false;
        this._scheduleRead();
      }
    });
  }

  _readNewData(done) {
    fs.stat(this.filename, (statErr, stats) => {
      if (statErr) return done();

      const diff = stats.size - this._lastSize;
      if (diff <= 0) {
        this._lastSize = stats.size;
        return done();
      }

      const start = this._lastSize;
      this._lastSize = stats.size;
      const buffer = Buffer.alloc(diff);

      fs.open(this.filename, 'r', (openErr, fd) => {
        if (openErr) return done();
        fs.read(fd, buffer, 0, diff, start, (readErr) => {
          fs.close(fd, () => {});
          if (readErr) return done();
          buffer.toString('utf8').split('\n').forEach((line) => {
            const trimmed = line.replace(/\r$/, '');
            if (trimmed) this.emit('line', trimmed);
          });
          done();
        });
      });
    });
  }

  close() {
    if (this._watcher) {
      this._watcher.close();
      this._watcher = null;
    }
    this.emit('close');
  }
}

module.exports = Tail;
