# tail-fweb

> `tail -f` — but in a browser.

Stream any log file to a live web UI. Use it as a standalone CLI or embed it directly into your Express app.

[![npm version](https://img.shields.io/npm/v/tail-fweb.svg)](https://www.npmjs.com/package/tail-fweb)
[![license](https://img.shields.io/npm/l/tail-fweb.svg)](LICENSE)
[![node](https://img.shields.io/node/v/tail-fweb.svg)](package.json)

---

## Features

- **Live stream** — new lines pushed over WebSockets the instant they're written
- **History replay** — opening a new tab shows all buffered lines immediately
- **Search & filter** — type to filter; matches are highlighted inline
- **Pause scroll** — freeze the viewport while new lines buffer silently (`Space` to resume)
- **Line wrap toggle** — switch long lines between horizontal scroll and wrapped, remembers your choice
- **Log-level colours** — `ERROR`/`FATAL` rows tinted red, `WARN` amber, out of the box
- **Copy & clear** — clipboard copy of visible lines; one-click clear
- **Embeddable** — mounts as an Express `Router` on any path in your existing app

---

## Install

```bash
# global CLI
npm install -g tail-fweb

# or add to your project
npm install tail-fweb
```

---

## Usage

### CLI

```bash
tail-fweb -f app.log
# → http://localhost:3000/tail-f

tail-fweb -f /var/log/nginx/access.log -p 8080
# → http://localhost:8080/tail-f
```

| Flag | Default | Description |
|------|---------|-------------|
| `-f, --filename` | *(required)* | Path to the file to watch |
| `-p, --port` | `3000` | Port to listen on |

---

### Embed in an Express app

```js
const express  = require('express');
const tailFweb = require('tail-fweb');

const app = express();

app.use('/logs', tailFweb('./app.log'));

app.listen(3000);
// viewer → http://localhost:3000/logs
```

Mount multiple files on different paths:

```js
app.use('/logs/access',  tailFweb('/var/log/nginx/access.log',  { title: 'Access' }));
app.use('/logs/error',   tailFweb('/var/log/nginx/error.log',   { title: 'Errors' }));
app.use('/logs/app',     tailFweb('./app.log',                  { title: 'App',  maxLines: 2000 }));
```

#### How embedding works

`tailFweb()` returns a standard Express `Router`. On the **first incoming request** it reads `req.socket.server` to attach socket.io to your existing HTTP server — no second port, no separate process. The file watcher starts at the same time.

---

## API

### `tailFweb(filename, [options])`

| Parameter | Type | Description |
|-----------|------|-------------|
| `filename` | `string` | Path to the file to watch *(required)* |
| `options.title` | `string` | Browser tab / page title (default: `'tail-fweb'`) |
| `options.maxLines` | `number` | Lines to keep in memory for late-joining connections (default: `5000`) |

Returns an Express `Router`. Mount it with `app.use(path, router)`.

---

## Requirements

- Node.js ≥ 18
- Express ≥ 4 (peer dependency when embedding)

---

## License

MIT © Abhijeet Apsunde
