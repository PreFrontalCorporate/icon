"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var electron_1 = require("electron");
// Bridge for renderer and webview to talk to main
// 0) Unified API (matches TS preload for consistency)
electron_1.contextBridge.exposeInMainWorld('api', {
    overlays: {
        count: function () { return electron_1.ipcRenderer.invoke('overlay/count'); },
        clearAll: function () { return electron_1.ipcRenderer.invoke('overlay/clearAll'); },
        pinFromUrl: function (url) { return electron_1.ipcRenderer.invoke('overlay/pin', url); },
    },
    openExternal: function (url) { return electron_1.ipcRenderer.invoke('app/openExternal', url); },
    showHotkeys: function () { return electron_1.ipcRenderer.invoke('app/hotkeys'); },
});

// 1) Minimal overlay control compatible with src/main.js channels
electron_1.contextBridge.exposeInMainWorld('iconOverlay', {
    pinSticker: function (id, url) { return electron_1.ipcRenderer.invoke('overlay:create', id, url); },
    clearAll: function () { return electron_1.ipcRenderer.invoke('overlay:clearAll'); },
});

// 2) Provide window.icon used by library.html
Object.defineProperty(window, 'icon', {
    value: {
        addSticker: function (payload) {
            var url = (payload === null || payload === void 0 ? void 0 : payload.url) || (payload === null || payload === void 0 ? void 0 : payload.src);
            if (!url)
                return;
            // Unique id each time so multiple overlays from same image are allowed
            var id = 'url:' + Date.now() + ':' + Math.floor(Math.random() * 1e6);
            electron_1.ipcRenderer.invoke('overlay:create', id, url);
        },
        clearOverlays: function () { return electron_1.ipcRenderer.invoke('overlay:clearAll'); },
        onOverlayCount: function (_fn) { return function () { }; },
    }
});

// 3) Provide window.desktop.version for the renderer splash
electron_1.contextBridge.exposeInMainWorld('desktop', {
    version: function () { return electron_1.ipcRenderer.invoke('app/version'); }
});

// 4) Message helper for UI buttons
window.addEventListener('message', function (ev) {
    try {
        if ((ev === null || ev === void 0 ? void 0 : ev.data) && ev.data.type === 'icon:show-hotkeys') {
            electron_1.ipcRenderer.invoke('app/hotkeys');
        }
    }
    catch (_) { }
});
