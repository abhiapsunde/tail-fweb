'use strict';

module.exports = function generateHtml({ wsPath, title, filename }) {
    const displayTitle = title || 'tail-fweb';
    const displayFile  = filename || '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${displayTitle}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg:           #080d12;
            --surface:      #0d1520;
            --surface-2:    #111d2b;
            --border:       #1a2840;
            --border-hi:    #243652;
            --text:         #8ba8c8;
            --text-bright:  #c8dff0;
            --text-muted:   #3d5a7a;
            --accent:       #00e5ff;
            --accent-dim:   #007a8a;
            --error:        #ff3d5c;
            --error-bg:     rgba(255,61,92,0.07);
            --warn:         #ffaa00;
            --warn-bg:      rgba(255,170,0,0.06);
            --success:      #00d26a;
            --debug:        #4a6a8f;
            --line-num:     #253c57;
            --header-h:     52px;
            --toolbar-h:    40px;
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        html, body {
            height: 100%;
            background: var(--bg);
            color: var(--text);
            font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
            font-size: 13px;
            overflow: hidden;
        }

        #header {
            position: fixed;
            inset: 0 0 auto 0;
            height: var(--header-h);
            background: var(--surface);
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            padding: 0 14px;
            gap: 14px;
            z-index: 100;
        }

        #logo {
            font-size: 13px;
            font-weight: 500;
            color: var(--text-bright);
            letter-spacing: -0.01em;
            display: flex;
            align-items: center;
            gap: 6px;
            flex-shrink: 0;
        }
        #logo .cmd { color: var(--accent); }
        #logo .sep { color: var(--text-muted); font-weight: 300; }
        #logo .file { color: var(--text-muted); font-size: 11px; font-weight: 300; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        #conn-wrap { display: flex; align-items: center; gap: 6px; }

        #status-dot {
            width: 7px; height: 7px;
            border-radius: 50%;
            background: var(--text-muted);
            flex-shrink: 0;
            transition: background 0.3s, box-shadow 0.3s;
        }
        #status-dot.connected    { background: var(--success); box-shadow: 0 0 7px var(--success); animation: pulse 2.5s infinite; }
        #status-dot.disconnected { background: var(--error); }
        #status-dot.reconnecting { background: var(--warn); animation: blink 0.7s infinite; }

        #status-text {
            font-size: 10px;
            color: var(--text-muted);
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }
        #status-text.connected    { color: var(--success); }
        #status-text.disconnected { color: var(--error); }
        #status-text.reconnecting { color: var(--warn); }

        .spacer { flex: 1; }

        #line-count {
            font-size: 11px;
            color: var(--text-muted);
            white-space: nowrap;
        }
        #line-count #lc-num { color: var(--text); font-weight: 500; }

        #toolbar {
            position: fixed;
            top: var(--header-h);
            inset-inline: 0;
            height: var(--toolbar-h);
            background: var(--surface);
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            padding: 0 10px;
            gap: 6px;
            z-index: 99;
        }

        #search-wrap { position: relative; flex: 1; max-width: 340px; }
        #search-icon {
            position: absolute;
            left: 8px; top: 50%;
            transform: translateY(-50%);
            color: var(--text-muted);
            pointer-events: none;
            width: 13px; height: 13px;
        }
        #search {
            width: 100%;
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: 3px;
            color: var(--text-bright);
            font-family: inherit;
            font-size: 12px;
            padding: 5px 8px 5px 27px;
            outline: none;
            transition: border-color 0.15s, box-shadow 0.15s;
            caret-color: var(--accent);
        }
        #search::placeholder { color: var(--text-muted); }
        #search:focus { border-color: var(--accent-dim); box-shadow: 0 0 0 2px rgba(0,229,255,0.07); }

        #match-count { font-size: 10px; color: var(--text-muted); min-width: 64px; white-space: nowrap; }
        #match-count.active { color: var(--accent); }

        .tbtn {
            background: var(--surface-2);
            border: 1px solid var(--border);
            border-radius: 3px;
            color: var(--text);
            font-family: inherit;
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            padding: 4px 10px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 5px;
            white-space: nowrap;
            transition: background 0.12s, border-color 0.12s, color 0.12s;
            user-select: none;
            flex-shrink: 0;
        }
        .tbtn svg { width: 12px; height: 12px; flex-shrink: 0; }
        .tbtn:hover { background: var(--border); border-color: var(--border-hi); color: var(--text-bright); }
        .tbtn:active { transform: translateY(1px); }
        #btn-pause.paused { background: rgba(255,170,0,0.1); border-color: rgba(255,170,0,0.4); color: var(--warn); }

        #log-wrap {
            position: fixed;
            inset: calc(var(--header-h) + var(--toolbar-h)) 0 0 0;
            overflow-y: scroll;
            overflow-x: auto;
        }
        #log-wrap::-webkit-scrollbar { width: 5px; height: 5px; }
        #log-wrap::-webkit-scrollbar-track { background: transparent; }
        #log-wrap::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
        #log-wrap::-webkit-scrollbar-thumb:hover { background: var(--border-hi); }

        #messages { list-style: none; padding: 4px 0 20px; min-width: max-content; }

        #messages li {
            display: flex;
            align-items: baseline;
            padding: 0 16px 0 0;
            line-height: 1.65;
            border-left: 2px solid transparent;
            animation: lineIn 0.2s ease-out;
        }
        #messages li:hover { background: rgba(255,255,255,0.025); }
        #messages li.level-error { background: var(--error-bg); border-left-color: var(--error); }
        #messages li.level-warn  { background: var(--warn-bg);  border-left-color: var(--warn); }
        #messages li.level-error:hover { background: rgba(255,61,92,0.12); }
        #messages li.level-warn:hover  { background: rgba(255,170,0,0.10); }
        #messages li.hidden { display: none; }

        .ln {
            flex-shrink: 0;
            width: 52px;
            padding: 0 10px;
            text-align: right;
            color: var(--line-num);
            font-size: 10.5px;
            user-select: none;
            border-right: 1px solid var(--border);
            margin-right: 10px;
        }

        .lvl {
            flex-shrink: 0;
            width: 38px;
            font-size: 9.5px;
            font-weight: 600;
            letter-spacing: 0.1em;
            text-align: center;
            margin-right: 10px;
            opacity: 0.85;
        }
        .lvl-error { color: var(--error); }
        .lvl-warn  { color: var(--warn); }
        .lvl-info  { color: var(--accent); opacity: 0.6; }
        .lvl-debug { color: var(--debug); }

        .log-text { color: var(--text); white-space: pre; font-size: 12.5px; }
        .level-error .log-text { color: #e87a88; }
        .level-warn  .log-text { color: #c89840; }
        .log-text mark { background: rgba(0,229,255,0.22); color: var(--accent); border-radius: 1px; font-style: normal; }

        #log-wrap.wrap-on { overflow-x: hidden; }
        #log-wrap.wrap-on .log-text { white-space: pre-wrap; word-break: break-word; }
        #log-wrap.wrap-on #messages { min-width: 0; }
        #log-wrap.wrap-on #messages li { align-items: flex-start; }
        #btn-wrap.active { background: rgba(0,229,255,0.1); border-color: rgba(0,229,255,0.4); color: var(--accent); }

        #empty {
            position: absolute;
            top: 40%; left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: var(--text-muted);
            font-size: 11px;
            pointer-events: none;
            letter-spacing: 0.04em;
        }
        #empty-icon { font-size: 28px; margin-bottom: 10px; opacity: 0.2; }

        #pause-banner {
            position: fixed;
            bottom: 0; left: 0; right: 0;
            height: 26px;
            background: rgba(10,12,16,0.92);
            border-top: 1px solid rgba(255,170,0,0.25);
            display: none;
            align-items: center;
            justify-content: center;
            gap: 10px;
            font-size: 10px;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: var(--warn);
            z-index: 98;
            backdrop-filter: blur(4px);
        }
        #pause-banner.visible { display: flex; }
        .pb-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--warn); animation: blink 0.9s infinite; }

        #toast {
            position: fixed;
            bottom: 36px; left: 50%;
            transform: translateX(-50%) translateY(10px);
            background: var(--surface-2);
            border: 1px solid var(--border-hi);
            color: var(--text-bright);
            font-size: 11px;
            letter-spacing: 0.03em;
            padding: 6px 14px;
            border-radius: 3px;
            opacity: 0;
            transition: opacity 0.18s, transform 0.18s;
            pointer-events: none;
            z-index: 200;
            white-space: nowrap;
        }
        #toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

        @keyframes lineIn {
            from { opacity: 0; transform: translateX(-3px); }
            to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.5; }
        }
        @keyframes blink {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0; }
        }
    </style>
</head>
<body>

<div id="header">
    <div id="logo">
        <span class="cmd">tail -f</span>
        <span class="sep">/</span>
        <span>web</span>
        ${displayFile ? `<span class="sep">&mdash;</span><span class="file">${displayFile}</span>` : ''}
    </div>
    <div id="conn-wrap">
        <div id="status-dot"></div>
        <span id="status-text">connecting</span>
    </div>
    <div class="spacer"></div>
    <div id="line-count"><span id="lc-num">0</span> lines</div>
</div>

<div id="toolbar">
    <div id="search-wrap">
        <svg id="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input id="search" type="text" placeholder="filter logs…" autocomplete="off" spellcheck="false" aria-label="Filter log lines">
    </div>
    <span id="match-count" aria-live="polite"></span>
    <div class="spacer"></div>
    <button class="tbtn" id="btn-pause" title="Toggle auto-scroll (Space)">
        <svg id="pause-icon" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
        </svg>
        <span id="pause-label">Pause</span>
    </button>
    <button class="tbtn" id="btn-wrap" title="Toggle line wrapping">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M3 12h15a3 3 0 0 1 0 6h-4"/>
            <polyline points="17 15 14 18 17 21"/>
            <line x1="3" y1="18" x2="9" y2="18"/>
        </svg>
        <span id="wrap-label">Wrap</span>
    </button>
    <button class="tbtn" id="btn-copy" title="Copy visible lines to clipboard">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        Copy
    </button>
    <button class="tbtn" id="btn-clear" title="Clear all displayed lines">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M9 6V4h6v2"/>
        </svg>
        Clear
    </button>
</div>

<div id="log-wrap" role="log" aria-label="Log output">
    <ul id="messages"></ul>
    <div id="empty">
        <div id="empty-icon">&#9889;</div>
        waiting for log lines…
    </div>
</div>

<div id="pause-banner" role="status">
    <span class="pb-dot"></span>
    scroll paused &mdash; <span id="queued-count">0</span> new lines buffered &mdash; press Space to resume
    <span class="pb-dot"></span>
</div>

<div id="toast" role="alert" aria-live="assertive"></div>

<script src="${wsPath}/socket.io.js"></script>
<script>
(function () {
    'use strict';

    const socket      = io({ path: '${wsPath}' });
    const msgList     = document.getElementById('messages');
    const searchEl    = document.getElementById('search');
    const lcNum       = document.getElementById('lc-num');
    const matchEl     = document.getElementById('match-count');
    const emptyEl     = document.getElementById('empty');
    const logWrap     = document.getElementById('log-wrap');
    const btnPause    = document.getElementById('btn-pause');
    const pauseLabel  = document.getElementById('pause-label');
    const pauseIcon   = document.getElementById('pause-icon');
    const btnWrap     = document.getElementById('btn-wrap');
    const wrapLabel   = document.getElementById('wrap-label');
    const btnCopy     = document.getElementById('btn-copy');
    const btnClear    = document.getElementById('btn-clear');
    const statusDot   = document.getElementById('status-dot');
    const statusTxt   = document.getElementById('status-text');
    const pauseBanner = document.getElementById('pause-banner');
    const queuedEl    = document.getElementById('queued-count');
    const toastEl     = document.getElementById('toast');

    let lineCount = 0;
    let paused    = false;
    let wrapped   = false;
    let filterText = '';
    let pending   = [];
    let toastTimer = null;

    function setStatus(state, label) {
        statusDot.className = state;
        statusTxt.className = state;
        statusTxt.textContent = label;
    }

    function showToast(msg) {
        clearTimeout(toastTimer);
        toastEl.textContent = msg;
        toastEl.classList.add('show');
        toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
    }

    function escapeHtml(s) {
        return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function buildHtml(text, query) {
        if (!query) return escapeHtml(text);
        const re = new RegExp(query.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'), 'gi');
        const parts = [];
        let last = 0, m;
        while ((m = re.exec(text)) !== null) {
            parts.push(escapeHtml(text.slice(last, m.index)));
            parts.push('<mark>' + escapeHtml(m[0]) + '</mark>');
            last = m.index + m[0].length;
        }
        parts.push(escapeHtml(text.slice(last)));
        return parts.join('');
    }

    function detectLevel(text) {
        const t = text.toUpperCase();
        if (/\\b(ERROR|ERR|FATAL|CRITICAL|EXCEPTION)\\b/.test(t)) return 'error';
        if (/\\b(WARN|WARNING)\\b/.test(t)) return 'warn';
        if (/\\b(INFO)\\b/.test(t)) return 'info';
        if (/\\b(DEBUG|TRACE|VERBOSE)\\b/.test(t)) return 'debug';
        return null;
    }

    function createRow(text) {
        lineCount++;
        const level = detectLevel(text);
        const li = document.createElement('li');
        li.dataset.text = text;
        if (level) li.classList.add('level-' + level);

        const ln = document.createElement('span');
        ln.className = 'ln';
        ln.setAttribute('aria-hidden', 'true');
        ln.textContent = String(lineCount).padStart(5, ' ');

        const lvl = document.createElement('span');
        lvl.className = 'lvl';
        if (level) {
            lvl.classList.add('lvl-' + level);
            lvl.textContent = level === 'error' ? 'ERR' : level === 'warn' ? 'WRN' : level === 'info' ? 'INF' : 'DBG';
        }

        const content = document.createElement('span');
        content.className = 'log-text';
        content.innerHTML = buildHtml(text, filterText);

        if (filterText && !text.toLowerCase().includes(filterText.toLowerCase())) {
            li.classList.add('hidden');
        }

        li.appendChild(ln);
        li.appendChild(lvl);
        li.appendChild(content);
        return li;
    }

    function appendLine(text) {
        const li = createRow(text);
        msgList.appendChild(li);
        lcNum.textContent = lineCount.toLocaleString();
        if (lineCount === 1) emptyEl.style.display = 'none';
        if (!paused) logWrap.scrollTop = logWrap.scrollHeight;
    }

    socket.on('connect',          () => setStatus('connected',    'connected'));
    socket.on('disconnect',       () => setStatus('disconnected', 'disconnected'));
    socket.on('connect_error',    () => setStatus('reconnecting', 'reconnecting…'));
    socket.on('reconnect_attempt',() => setStatus('reconnecting', 'reconnecting…'));
    socket.on('reconnect',        () => setStatus('connected',    'connected'));

    socket.on('log', function (msg) {
        if (paused) {
            pending.push(msg);
            queuedEl.textContent = pending.length.toLocaleString();
        } else {
            appendLine(msg);
        }
    });

    searchEl.addEventListener('input', function () {
        filterText = this.value.trim();
        let visible = 0;
        msgList.querySelectorAll('li').forEach(li => {
            const text = li.dataset.text || '';
            const span = li.querySelector('.log-text');
            const match = !filterText || text.toLowerCase().includes(filterText.toLowerCase());
            li.classList.toggle('hidden', !match);
            if (match) {
                visible++;
                if (span) span.innerHTML = buildHtml(text, filterText);
            }
        });
        if (filterText) {
            matchEl.textContent = visible.toLocaleString() + (visible === 1 ? ' match' : ' matches');
            matchEl.classList.add('active');
        } else {
            matchEl.textContent = '';
            matchEl.classList.remove('active');
        }
    });

    const PAUSE_SVG  = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    const RESUME_SVG = '<polygon points="5 3 19 12 5 21 5 3"/>';

    function setPaused(val) {
        paused = val;
        btnPause.classList.toggle('paused', paused);
        pauseIcon.innerHTML = paused ? RESUME_SVG : PAUSE_SVG;
        pauseLabel.textContent = paused ? 'Resume' : 'Pause';
        if (paused) {
            pauseBanner.classList.add('visible');
            queuedEl.textContent = '0';
        } else {
            pauseBanner.classList.remove('visible');
            pending.forEach(t => appendLine(t));
            pending = [];
            logWrap.scrollTop = logWrap.scrollHeight;
        }
    }

    btnPause.addEventListener('click', () => setPaused(!paused));
    document.addEventListener('keydown', e => {
        if (e.code === 'Space' && document.activeElement !== searchEl) {
            e.preventDefault();
            setPaused(!paused);
        }
    });

    function setWrapped(val) {
        wrapped = val;
        logWrap.classList.toggle('wrap-on', wrapped);
        btnWrap.classList.toggle('active', wrapped);
        wrapLabel.textContent = wrapped ? 'Wrapped' : 'Wrap';
        try { localStorage.setItem('tail-fweb-wrap', wrapped ? '1' : '0'); } catch (e) {}
    }

    btnWrap.addEventListener('click', () => setWrapped(!wrapped));

    try { wrapped = localStorage.getItem('tail-fweb-wrap') === '1'; } catch (e) {}
    setWrapped(wrapped);

    btnCopy.addEventListener('click', () => {
        const items = Array.from(msgList.querySelectorAll('li:not(.hidden)'));
        const text = items.map(li => li.dataset.text || '').join('\\n');
        navigator.clipboard.writeText(text)
            .then(() => showToast('Copied ' + items.length.toLocaleString() + ' lines to clipboard'))
            .catch(() => showToast('Copy failed — clipboard permission denied'));
    });

    btnClear.addEventListener('click', () => {
        const prev = lineCount.toLocaleString();
        msgList.innerHTML = '';
        lineCount = 0;
        lcNum.textContent = '0';
        emptyEl.style.display = '';
        matchEl.textContent = '';
        matchEl.classList.remove('active');
        showToast('Cleared ' + prev + ' lines');
    });

})();
</script>
</body>
</html>`;
};
