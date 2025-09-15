"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var electron_1 = require("electron");
var node_path_1 = require("node:path");
var node_fs_1 = require("node:fs");
var isDev = !electron_1.app.isPackaged;
function log() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    try {
        var line = "[".concat(new Date().toISOString(), "] ").concat(args.map(function (a) { return String(a); }).join(' '), "\n");
        var logPath = node_path_1.join(electron_1.app.getPath('userData'), 'icon-desktop.log');
        node_fs_1.appendFileSync(logPath, line);
    }
    catch (_a) { }
    // eslint-disable-next-line no-console
    console.log.apply(console, __spreadArray(['[main]'], args, false));
}
// Robust preload resolution (dev builds have preload.js; packaged build renames to preload.cjs)
function resolvePreload() {
    var dir = __dirname;
    var cjs = node_path_1.join(dir, 'preload.cjs');
    var js = node_path_1.join(dir, 'preload.js');
    return node_fs_1.existsSync(cjs) ? cjs : js;
}
var mainWin = null;
var view = null; // legacy single view (used at boot)
var viewLib = null;
var viewStore = null;
// lazy import to avoid circular import during transpile
var overlay = {
    create: function (id, url) { return Promise.resolve().then(function () { return require('./ipc/overlay'); }).then(function (m) { return m.createOverlay(id, url); }); },
    clearAll: function () { return Promise.resolve().then(function () { return require('./ipc/overlay'); }).then(function (m) { return m.removeAllOverlays(); }); },
    rain: function (n) { return Promise.resolve().then(function () { return require('./ipc/overlay'); }).then(function (m) { return m.rain(n); }); },
    toggleBounceAll: function () { return Promise.resolve().then(function () { return require('./ipc/overlay'); }).then(function (m) { return m.toggleBounceAll(); }); },
    party: function () { return Promise.resolve().then(function () { return require('./ipc/overlay'); }).then(function (m) { return m.party(); }); }
};
function buildMenu() {
    return electron_1.Menu.buildFromTemplate([
        {
            label: 'File',
            submenu: [
                // Removed free pin-from-clipboard to enforce paid-only stickers
                { label: 'Clear all stickers', accelerator: 'CommandOrControl+Alt+Shift+X', click: function () { return overlay.clearAll(); } },
                { type: 'separator' },
                { role: 'quit' },
            ]
        },
        { role: 'editMenu' },
        { role: 'viewMenu' },
        { role: 'windowMenu' },
        {
            role: 'help',
            submenu: [
                {
                    label: 'Open logs folder',
                    click: function () { return electron_1.shell.showItemInFolder(node_path_1.join(electron_1.app.getPath('userData'), 'icon-desktop.log')); }
                },
                { type: 'separator' },
                { label: 'Open Store (icon.coupons)', click: function () { return electron_1.shell.openExternal('https://icon.coupons'); } },
                { label: 'Open Shopify Store', click: function () { return electron_1.shell.openExternal('https://store.cbb.homes'); } },
                { type: 'separator' },
                { label: 'Keyboard Shortcuts', click: function () { return showHotkeys(); } }
            ]
        }
    ]);
}

// Small helper window to show hotkeys
var hotkeyWin = null;
function showHotkeys() {
    try {
        if (hotkeyWin && !hotkeyWin.isDestroyed()) {
            hotkeyWin.close();
            hotkeyWin = null;
            return;
        }
    }
    catch (_a) { }
    hotkeyWin = new electron_1.BrowserWindow({
        width: 420,
        height: 260,
        resizable: false,
        alwaysOnTop: true,
        frame: false,
        transparent: true,
        skipTaskbar: true,
        webPreferences: { sandbox: false }
    });
    hotkeyWin.loadURL('data:text/html,' + encodeURIComponent("\n    <meta charset=\\'utf-8\\'>\n    <style>html,body{margin:0} .box{position:fixed;inset:0;margin:auto;width:420px;height:220px;background:rgba(20,20,20,.92);color:#fff;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.45);font:13px system-ui;padding:16px} h2{margin:0 0 8px 0;font:600 16px system-ui} code{background:#333;padding:2px 6px;border-radius:6px}</style>\n    <div class=box>\n      <h2>Keyboard shortcuts</h2>\n      <div><code>Ctrl+Alt+Shift+X</code> Clear all overlays</div>\n      <div><code>Ctrl+Alt+Shift+B</code> Toggle bounce all</div>\n      <div><code>Ctrl+Alt+Shift+R</code> Burst 24 overlays (auto-spread)</div>\n      <div><code>Ctrl+Alt+Shift+P</code> Party mode (random fx)</div>\n      <div><code>Ctrl+Alt+Shift+H</code> Toggle this window</div>\n      <div style=\"opacity:.75;margin-top:10px\">Overlay window: R rotate • B bounce • S chime • Esc close • Double‑click close</div>\n      <div style=\"margin-top:14px;opacity:.7\">Press this hotkey again to close.</div>\n    </div>\n  "));
    try { hotkeyWin.setVisibleOnAllWorkspaces(true); }
    catch (_b) { }
}
function createMainWindow() {
    var preloadPath = resolvePreload();
    // Prefer .ico on Windows, fall back to .png for dev and other OSes
    var buildDir = node_path_1.join(__dirname, '../build');
    var icoPath = node_path_1.join(buildDir, 'icon.ico');
    var pngPath = node_path_1.join(buildDir, 'icon.png');
    var iconPath = (function(){ try { if (node_fs_1.existsSync(icoPath)) return icoPath; if (node_fs_1.existsSync(pngPath)) return pngPath; } catch(_) {} return undefined; })();
    mainWin = new electron_1.BrowserWindow({
        width: 1024,
        height: 720,
        minWidth: 800,
        minHeight: 600,
        backgroundColor: '#151515',
        autoHideMenuBar: false,
        show: true,
        icon: iconPath,
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            webviewTag: true
        }
    });
    mainWin.setMenu(buildMenu());
    log('Using preload:', preloadPath);
    // Load the in‑app Library window (it iframes the hosted Library UI and talks via postMessage).
    // File lives in app/desktop/windows/library.html
    var libraryHtml = node_path_1.join(__dirname, '../windows/library.html');
    var fileUrl = "file://".concat(libraryHtml.replace(/\\/g, '/'));
    log('Loading Library:', fileUrl);
    mainWin.loadURL(fileUrl).catch(function (err) { return log('loadURL threw:', (err === null || err === void 0 ? void 0 : err.stack) || String(err)); });
    mainWin.webContents.on('did-fail-load', function (_e, code, desc, url) {
        log('did-fail-load', code, desc, url);
        var html = Buffer.from("\n      <!doctype html><meta charset=\"utf-8\">\n      <title>Icon Desktop - Error</title>\n      <body style=\"font:14px system-ui;padding:24px;background:#111;color:#eee;\">\n        <h1>Icon Desktop</h1>\n        <p>Renderer failed to load.</p>\n        <pre style=\"white-space:pre-wrap;background:#222;padding:12px;border-radius:8px;\">".concat(desc, " (").concat(code, ")\nTried: ").concat(fileUrl, "</pre>\n      </body>"));
        mainWin === null || mainWin === void 0 ? void 0 : mainWin.loadURL('data:text/html;base64,' + html.toString('base64'));
    });
    mainWin.on('ready-to-show', function () { return mainWin === null || mainWin === void 0 ? void 0 : mainWin.show(); });
    mainWin.on('closed', function () { mainWin = null; });
    // Open external links in the OS browser
    mainWin.webContents.setWindowOpenHandler(function (_a) {
        var url = _a.url;
        electron_1.shell.openExternal(url).catch(function () { });
        return { action: 'deny' };
    });
    if (isDev) {
        try {
            mainWin.webContents.openDevTools({ mode: 'detach' });
        }
        catch (_a) { }
    }
    // Keep a BrowserView alternative to <webview> to avoid compositor issues
    try { createOrAttachBrowserView(); } catch (e) { log('createOrAttachBrowserView error', e); }
}
electron_1.app.whenReady().then(function () {
    createMainWindow();
    // Global hotkeys (avoid common OS collisions)
    try {
        electron_1.globalShortcut.register('CommandOrControl+Alt+Shift+X', function () { return overlay.clearAll(); });
        electron_1.globalShortcut.register('CommandOrControl+Alt+Shift+H', function () { return showHotkeys(); });
        // Removed free pin-from-clipboard
        electron_1.globalShortcut.register('CommandOrControl+Alt+Shift+P', function () { return electron_1.ipcMain.emit('overlay:party'); });
        electron_1.globalShortcut.register('CommandOrControl+Alt+Shift+B', function () { return electron_1.ipcMain.emit('overlay:toggleBounce'); });
        electron_1.globalShortcut.register('CommandOrControl+Alt+Shift+R', function () { return electron_1.ipcMain.emit('overlay:rain', 24); });
        electron_1.globalShortcut.register('CommandOrControl+Alt+Shift+T', function () { return overlay.create('test:' + Date.now(), 'https://icon-web-two.vercel.app/test.png'); });
    }
    catch (e) {
        log('register hotkeys error', e);
    }
}).catch(function (e) { return log('app.whenReady error', e); });
electron_1.app.on('window-all-closed', function () {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
electron_1.app.on('activate', function () { if (electron_1.BrowserWindow.getAllWindows().length === 0)
    createMainWindow(); });
/* ───────── IPC: overlay control ───────── */
electron_1.ipcMain.handle('overlay:create', function (_e, id, url) { log('ipc overlay:create', id, url); return overlay.create(id, url); });
electron_1.ipcMain.handle('overlay:clearAll', function () { return overlay.clearAll(); });
electron_1.ipcMain.handle('overlay/clearAll', function () { return overlay.clearAll(); });
// Provide app helpers expected by renderer
electron_1.ipcMain.handle('app/version', function () { return electron_1.app.getVersion(); });
electron_1.ipcMain.handle('app/openExternal', function (_e, url) { return electron_1.shell.openExternal(url); });
electron_1.ipcMain.handle('app/hotkeys', function () { showHotkeys(); });
electron_1.ipcMain.handle('view:load', function (_e, url) { try { log('view:load', url); createOrAttachBrowserView(); view.webContents.loadURL(url).catch(function (e) { return log('view.loadURL threw', e); }); } catch (e) { log('view:load error', e); } });
electron_1.ipcMain.handle('view:show', function (_e, which) {
    try {
        if (which === 'library')
            return showLibraryView();
        if (which === 'store')
            return showStoreView();
    }
    catch (e) {
        log('view:show error', e);
    }
});
electron_1.ipcMain.on('icon:webview-ready', function () { return log('icon:webview-ready from BrowserView'); });
electron_1.ipcMain.on('icon:dbg', function (_e, payload) { try { log('icon:dbg', JSON.stringify(payload)); } catch (_a) { } });
// When running content in a BrowserView, the preload uses ipcRenderer.send
// to talk to main. Handle that and forward to overlays.
electron_1.ipcMain.on('icon:webview-sticker', function (_e, payload) {
    try {
        var url = (payload && (payload.url || payload.src)) || '';
        log('ipc icon:webview-sticker', url);
        if (url)
            overlay.create('url:' + Date.now() + ':' + Math.floor(Math.random() * 1e6), url);
    }
    catch (e) { log('ipc icon:webview-sticker error', e); }
});
// Compatibility: support overlay/pin used by TS preload
electron_1.ipcMain.handle('overlay/pin', function (_e, url) { log('ipc overlay:pin', url); return overlay.create('url:' + Date.now() + ':' + Math.floor(Math.random()*1e6), url); });
// Extras
electron_1.ipcMain.on('overlay:pinClipboard', function () {
    try {
        var clip = require('electron').clipboard.readText().trim();
        if (/^https?:\/\//i.test(clip)) {
            overlay.create('clip:' + clip, clip);
        }
    }
    catch (e) {
        log('pinClipboard error', e);
    }
});
electron_1.ipcMain.on('overlay:rain', function (_e, n) { return overlay.rain(typeof n === 'number' ? n : 20); });
electron_1.ipcMain.on('overlay:toggleBounce', function () { return overlay.toggleBounceAll(); });
electron_1.ipcMain.on('overlay:party', function () { return overlay.party(); });

/* ───────── BrowserView support (instead of <webview>) ───────── */
function ensureViewBounds(v) {
    if (!mainWin || !v)
        return;
    try {
        var _a = mainWin.getContentSize(), w = _a[0], h = _a[1];
        v.setBounds({ x: 0, y: 42, width: Math.max(0, w), height: Math.max(0, h - 42) });
        v.setAutoResize({ width: true, height: true });
    }
    catch (_b) { }
}
function setupViewHandlers(v) {
    try {
        v.webContents.on('ipc-message', function (_event, channel, args) {
            if (channel === 'icon:webview-sticker') {
                try {
                    var payload = (args && args[0]) || args || {};
                    var url_1 = payload.url || payload.src;
                    if (url_1)
                        overlay.create('url:' + Date.now() + ':' + Math.floor(Math.random() * 1e6), url_1);
                }
                catch (e) { log('view sticker err', e); }
            }
            if (channel === 'icon:webview-ready') {
                try { log('BrowserView preload ready'); } catch (_a) { }
            }
        });
        function injectClickHelper() {
            try {
                v.webContents.executeJavaScript("typeof window.icon + '|' + typeof window.desktop + '|' + (window.desktop && typeof window.desktop.addSticker)", true)
                    .then(function (res) { return log('BV env check', res); })
                    .catch(function (e) { return log('BV env check error', e); });
                // Inject a light in-page helper that sends the clicked image URL to our bridge
                var inject = "(function(){try{if(window.__iconInject) return; window.__iconInject=true;" +
                    "function extr(n){var el=n; for(var i=0;el&&i<8;i++,el=el.parentElement){" +
                    " if(el.tagName==='IMG'&&el.src) return el.src;" +
                    " var s=el.querySelector&&el.querySelector('source[srcset]'); if(s&&s.srcset){var f=s.srcset.split(',')[0].trim().split(' ')[0]; if(f) return f;}" +
                    " var a=el.closest&&el.closest('a[href]'); if(a){var h=a.getAttribute('href')||''; if(/\\.(png|jpe?g|gif|webp|svg)(\\?|#|$)/i.test(h)) return h;}" +
                    " var bg=(el instanceof Element)? getComputedStyle(el).backgroundImage||'':''; var m=bg.match(/url\\([\"']?(.*?)[\"']?\\)/i); if(m&&m[1]) return m[1]; } return null;}" +
                    "function send(u){ try{ if(window.icon&&typeof window.icon.addSticker==='function'){ window.icon.addSticker({src:u}); return true;} }catch(_){} try{ if(window.desktop&&typeof window.desktop.addSticker==='function'){ window.desktop.addSticker({src:u}); return true;} }catch(_){} try{ window.postMessage({__iconSticker:u},'*'); return true;}catch(_){} return false;}" +
                    "function handler(e){ try{ var u=extr(e.target); if(u){ send(u); try{e.stopImmediatePropagation();}catch(_){} try{e.stopPropagation();}catch(_){} if(e.cancelable) try{e.preventDefault();}catch(_){} } }catch(_){} }" +
                    "['click','mousedown','mouseup','pointerdown','pointerup','touchstart','contextmenu'].forEach(function(t){ window.addEventListener(t, handler, {capture:true,passive:false}); document.addEventListener(t, handler, {capture:true,passive:false}); });" +
                    "}catch(e){console.warn('icon inject error',e);}})();";
                v.webContents.executeJavaScript(inject, true).catch(function (e) { return log('inject error', e); });
            }
            catch (e) { log('did-finish-load eval error', e); }
        }
        v.webContents.on('did-finish-load', injectClickHelper);
        v.webContents.on('did-navigate', function (_e, url) { try { if (/\/login/.test(url || '')) overlay.clearAll(); } catch (_a) { } });
        v.webContents.on('did-navigate-in-page', function (_e, url) { try { if (/\/login/.test(url || '')) overlay.clearAll(); } catch (_a) { } try { injectClickHelper(); } catch (_b) { } });
    }
    catch (_c) { }
}
function ensureLibView() {
    if (!mainWin)
        return;
    if (!viewLib) {
        viewLib = new electron_1.BrowserView({ webPreferences: {
                preload: node_path_1.join(__dirname, '../windows/webview-preload.js'),
                sandbox: false,
                contextIsolation: false,
                nodeIntegration: false,
                partition: 'persist:iconlib',
            } });
        mainWin.addBrowserView(viewLib);
        ensureViewBounds(viewLib);
        setupViewHandlers(viewLib);
        try { viewLib.webContents.loadURL('https://icon-web-two.vercel.app/library'); } catch (_a) { }
    }
}
function ensureStoreView() {
    if (!mainWin)
        return;
    if (!viewStore) {
        viewStore = new electron_1.BrowserView({ webPreferences: {
                preload: node_path_1.join(__dirname, '../windows/webview-preload.js'),
                sandbox: false,
                contextIsolation: false,
                nodeIntegration: false,
                partition: 'persist:iconlib',
            } });
        mainWin.addBrowserView(viewStore);
        ensureViewBounds(viewStore);
        setupViewHandlers(viewStore);
        try { viewStore.webContents.loadURL('https://icon.coupons'); } catch (_b) { }
    }
}
function showLibraryView() {
    ensureLibView();
    try {
        if (viewStore)
            mainWin.setTopBrowserView(viewLib);
    }
    catch (_a) { }
    ensureViewBounds(viewLib);
}
function showStoreView() {
    ensureStoreView();
    try {
        if (viewStore)
            mainWin.setTopBrowserView(viewStore);
    }
    catch (_a) { }
    ensureViewBounds(viewStore);
}
function createOrAttachBrowserView() {
    if (!mainWin)
        return;
    if (!view) {
        view = new electron_1.BrowserView({ webPreferences: {
                preload: node_path_1.join(__dirname, '../windows/webview-preload.js'),
                sandbox: false,
                contextIsolation: false,
                nodeIntegration: false,
                partition: 'persist:iconlib',
            } });
        mainWin.setBrowserView(view);
        const resize = function () { ensureViewBounds(view); ensureViewBounds(viewLib); ensureViewBounds(viewStore); };
        resize();
        try { mainWin.on('resize', resize); mainWin.on('ready-to-show', resize); } catch (_c) { }
        // Forward sticker messages directly from the BrowserView preload
        try { setupViewHandlers(view); } catch (_d) { }
        // Load the library by default
        try { log('BrowserView load library'); view.webContents.loadURL('https://icon-web-two.vercel.app/library'); } catch (_e) { }
        // Treat this initial view as the persistent Library view
        try { if (!viewLib) viewLib = view; } catch (_f) { }
    }
}
