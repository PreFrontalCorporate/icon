"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var electron_1 = require("electron");
// Bridge for renderer and webview to talk to main
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
            if (url)
                electron_1.ipcRenderer.invoke('overlay:create', 'url:' + url, url);
        },
        clearOverlays: function () { return electron_1.ipcRenderer.invoke('overlay:clearAll'); },
        onOverlayCount: function (_fn) { return function () { }; },
    }
});

// 3) Provide window.desktop.version for the renderer splash
electron_1.contextBridge.exposeInMainWorld('desktop', {
    version: function () { return electron_1.ipcRenderer.invoke('app/version'); }
});
