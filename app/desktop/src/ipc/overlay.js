"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOverlay = createOverlay;
exports.removeAllOverlays = removeAllOverlays;
exports.rain = rain;
exports.toggleBounceAll = toggleBounceAll;
exports.party = party;
// app/desktop/src/ipc/overlay.ts
var electron_1 = require("electron");
var node_path_1 = require("node:path");
var ACTIVE = new Map();
var LAST_URL = '';
var BOUNCE_ALL = false;
/** Create (or reveal) a frameless always‑on‑top overlay for one sticker */
function createOverlay(id, imgUrl) {
    try {
        LAST_URL = imgUrl || LAST_URL || '';
    }
    catch (_) { }
    if (ACTIVE.has(id)) {
        ACTIVE.get(id).show();
        return;
    }
    var cursor = electron_1.screen.getCursorScreenPoint();
    var disp = electron_1.screen.getDisplayNearestPoint(cursor);
    var win = new electron_1.BrowserWindow({
        width: 360,
        height: 360,
        x: disp.bounds.x + Math.round(disp.workArea.width / 2) - 180,
        y: disp.bounds.y + Math.round(disp.workArea.height / 2) - 180,
        transparent: true,
        backgroundColor: '#00000000',
        frame: false,
        resizable: true,
        movable: true,
        show: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        hasShadow: false,
        webPreferences: {
            // No preload necessary for simple overlay window; robust in dev/prod
            sandbox: false,
        }
    });
    if (process.platform === 'win32') {
        // Sit above most fullscreen windows on Windows
        win.setAlwaysOnTop(true, 'pop-up-menu');
    }
    win.loadURL("data:text/html,\n    <meta charset=\"utf-8\">\n    <meta http-equiv=\"Content-Security-Policy\" content=\"img-src * data: blob:;\">\n    <style>\n      html,body{margin:0;background:transparent;overflow:hidden}\n      .drag{position:absolute;inset:0;-webkit-app-region:drag}\n      img{position:absolute;inset:0;margin:auto;max-width:100%;max-height:100%;user-select:none;-webkit-user-drag:none;transform:rotate(0deg)}\n      #close{position:fixed;right:8px;top:8px;border:0;border-radius:999px;background:rgba(0,0,0,.55);color:#fff;width:26px;height:26px;line-height:24px;font:14px/24px system-ui;-webkit-app-region:no-drag;cursor:pointer}\n      #hint{position:fixed;left:8px;bottom:8px;background:rgba(0,0,0,.45);color:#fff;padding:6px 8px;border-radius:8px;font:12px system-ui;-webkit-app-region:no-drag}\n      @keyframes bounce{0%{transform:translateY(0) scale(1)}100%{transform:translateY(-10%) scale(1.04)}}\n      .bouncing{animation:bounce 600ms ease-in-out alternate infinite}\n    </style>\n    <script>\n      const img = new Image(); img.id='img'; img.src='".concat(encodeURI(imgUrl), "';\n      document.addEventListener('DOMContentLoaded',()=>{\n        document.body.appendChild(img);\n        const drag = document.createElement('div'); drag.className='drag'; document.body.appendChild(drag);\n        const close = Object.assign(document.createElement('button'),{id:'close',textContent:'×',title:'Close'});\n        close.addEventListener('click',()=>window.close()); document.body.appendChild(close);\n        const hint = document.createElement('div'); hint.id='hint'; hint.textContent='Esc: close · R: rotate · B: bounce · S: chime'; document.body.appendChild(hint);\n      });\n      let deg=0;\n      function apply(){ img.style.transform = 'rotate(' + deg + 'deg)'; }\n      window.addEventListener('keydown', e=>{\n        if(e.key==='Escape') window.close();\n        const k=e.key.toLowerCase();\n        if(k==='r'){ deg=(deg+90)%360; apply(); }\n        if(k==='b'){ img.classList.toggle('bouncing'); }\n        if(k==='s'){ try{ const ctx=new (window.AudioContext||window.webkitAudioContext)(); const o=ctx.createOscillator(); const g=ctx.createGain(); o.type='sine'; o.frequency.value=880; o.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime+0.02); o.start(); setTimeout(()=>{ g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.12); o.stop(ctx.currentTime+0.14); ctx.close(); }, 140); }catch{} }\n      });\n      img.addEventListener('dblclick', ()=> window.close());\n    </script>\n    <img id=\"img\" alt=\"\">\n  "));
    try { win.setVisibleOnAllWorkspaces(true); } catch (_c) {}
    try { win.focus(); } catch (_d) {}
    win.on('closed', function () { return ACTIVE.delete(id); });
    ACTIVE.set(id, win);
}
function removeAllOverlays() {
    ACTIVE.forEach(function (w) { return w.close(); });
    ACTIVE.clear();
}

function rain(n) {
    var url = LAST_URL || 'https://icon-web-two.vercel.app/test.png';
    for (var i = 0; i < n; i++) {
        try {
            var id = 'rain:' + Date.now() + ':' + i;
            createOverlay(id, url);
        }
        catch (_) { }
    }
}

function toggleBounceAll() {
    BOUNCE_ALL = !BOUNCE_ALL;
    ACTIVE.forEach(function (w) {
        try {
            w.webContents.executeJavaScript("(function(){var el=document.getElementById('img'); if(!el)return; el.classList.".concat(BOUNCE_ALL ? 'add' : 'remove', "('bouncing');})()"));
        }
        catch (_) { }
    });
}

function party() {
    var keys = ['r', 's', 'b'];
    ACTIVE.forEach(function (w) {
        try {
            var key = keys[Math.floor(Math.random() * keys.length)];
            w.webContents.executeJavaScript("window.dispatchEvent(new KeyboardEvent('keydown',{key:'".concat(key, "'}))"));
        }
        catch (_) { }
    });
}
