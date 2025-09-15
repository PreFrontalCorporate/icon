import { app, BrowserWindow, Menu, Tray, nativeImage, shell, ipcMain, globalShortcut, BrowserView } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
// Note: avoid import.meta.url so code compiles in CJS mode

// --- Start of logging setup ---
function log(...args: any[]) {
  try {
    const line = `[${new Date().toISOString()}] ${args.map(a => String(a)).join(' ')}\n`;
    // Log to file only when app is ready and path is available
    if (app.isReady()) {
      const logPath = path.join(app.getPath('userData'), 'icon-desktop.log');
      fs.appendFileSync(logPath, line);
    }
    console.log('[main]', ...args);
  } catch {}
}
// --- End of logging setup ---

log('--- Main starting (CJS-compatible) ---');

let mainWin: BrowserWindow | null = null;
let tray: Tray | null = null;
let view: BrowserView | null = null;
let viewLib: BrowserView | null = null;
let viewStore: BrowserView | null = null;
let hotkeyWin: BrowserWindow | null = null;

// Lazy-loaded overlay module to prevent startup crashes.
// This object provides the same functions as the overlay module,
// but only imports the module when a function is first called.
// IMPORTANT: load the packaged runtime overlay at dist/ipc/overlay.js
const overlay = {
    createOverlay: async (id: string, url: string, pos?: {x: number, y: number}) => (require('./ipc/overlay.js')).createOverlay(id, url, pos),
    removeAllOverlays: async () => (require('./ipc/overlay.js')).removeAllOverlays(),
    rain: async (n: number) => (require('./ipc/overlay.js')).rain(n),
    toggleBounceAll: async () => (require('./ipc/overlay.js')).toggleBounceAll(),
    party: async () => (require('./ipc/overlay.js')).party(),
};

function bringToFront() {
  log('Attempting to bring window to front...');
  if (!mainWin) {
    log('bringToFront failed: mainWin is null.');
    return;
  }
  try {
    if (mainWin.isMinimized()) mainWin.restore();
    mainWin.show();
    mainWin.focus();
  } catch (e) {
    log('ERROR in bringToFront:', e);
  }
}

function showHotkeys() {
    log('showHotkeys called.');
    if (hotkeyWin && !hotkeyWin.isDestroyed()) {
        hotkeyWin.close();
        hotkeyWin = null;
        return;
    }
    hotkeyWin = new BrowserWindow({
        width: 420,
        height: 260,
        resizable: false,
        alwaysOnTop: true,
        frame: false,
        transparent: true,
        skipTaskbar: true,
        webPreferences: { sandbox: false }
    });
    hotkeyWin.loadURL('data:text/html,' + encodeURIComponent(`
    <meta charset='utf-8'>
    <style>html,body{margin:0} .box{position:fixed;inset:0;margin:auto;width:420px;height:220px;background:rgba(20,20,20,.92);color:#fff;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.45);font:13px system-ui;padding:16px} h2{margin:0 0 8px 0;font:600 16px system-ui} code{background:#333;padding:2px 6px;border-radius:6px}</style>
    <div class=box>
      <h2>Keyboard shortcuts</h2>
      <div><code>Ctrl+Alt+Shift+X</code> Clear all overlays</div>
      <div><code>Ctrl+Alt+Shift+B</code> Toggle bounce all</div>
      <div><code>Ctrl+Alt+Shift+R</code> Burst 24 overlays (auto-spread)</div>
      <div><code>Ctrl+Alt+Shift+P</code> Party mode (random fx)</div>
      <div><code>Ctrl+Alt+Shift+H</code> Toggle this window</div>
      <div style="opacity:.75;margin-top:10px">Overlay window: R rotate • B bounce • S chime • Esc close • Double‑click close</div>
      <div style="margin-top:14px;opacity:.7">Press this hotkey again to close.</div>
    </div>
  `));
    try { hotkeyWin.setVisibleOnAllWorkspaces(true); } catch {}
}

function buildMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        { label: 'Clear all stickers', accelerator: 'CommandOrControl+Alt+Shift+X', click: () => overlay.removeAllOverlays() },
        { type: 'separator' },
        { role: 'quit' },
      ]
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    { role: 'help', submenu: [ { label: 'Open logs folder', click: () => shell.showItemInFolder(path.join(app.getPath('userData'), 'icon-desktop.log')) }, { type: 'separator' }, { label: 'Keyboard Shortcuts', click: () => showHotkeys() } ] }
  ]);
}

function createMainWindow() {
    log('createMainWindow function called.');
    const preloadPath = path.join(__dirname, '../../windows/webview-preload.js');
    log(`Preload path set to: ${preloadPath}`);
    const buildDir = path.join(__dirname, '../../build');
    const icoPath = path.join(buildDir, 'icon.ico');
    const pngPath = path.join(buildDir, 'icon.png');
    const iconPath = ((): string | undefined => {
        if (process.platform === 'win32' && fs.existsSync(icoPath)) return icoPath;
        if (fs.existsSync(pngPath)) return pngPath;
        return undefined;
    })();
    log(`Window icon path: ${iconPath}`);

    mainWin = new BrowserWindow({
        width: 1024,
        height: 720,
        minWidth: 800,
        minHeight: 600,
        backgroundColor: '#151515',
        autoHideMenuBar: false,
        show: false, // Use ready-to-show
        icon: iconPath,
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false, // Must be false for webviewTag to work
            webviewTag: true,
        }
    });
    log('BrowserWindow created.');

    mainWin.on('ready-to-show', () => {
        log('mainWin: ready-to-show event fired.');
        bringToFront();
    });

    mainWin.on('resize', () => { ensureViewBounds(view); ensureViewBounds(viewLib); ensureViewBounds(viewStore); });

    mainWin.on('closed', () => {
        log('mainWin: closed.');
        mainWin = null;
    });

    mainWin.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url).catch(() => {});
        return { action: 'deny' };
    });

    const libraryHtml = path.join(__dirname, '../../windows/library.html');
    log(`Loading content from: ${libraryHtml}`);
    mainWin.loadFile(libraryHtml).catch(e => log('FATAL: loadFile failed', e));

    // --- Attach BrowserView ---
    log('Attaching BrowserView...');
    try { createOrAttachBrowserView(); } catch (e) { log('createOrAttachBrowserView error', e); }
}

function createTray() {
    log('Attempting to create tray icon...');
    if (tray) {
        log('Tray already exists.');
        return;
    }
    const buildDir = path.join(__dirname, '../../build');
    const icoPath = path.join(buildDir, 'icon.ico');
    const pngPath = path.join(buildDir, 'icon.png');
    let iconPath: string | undefined;
    if (process.platform === 'win32' && fs.existsSync(icoPath)) iconPath = icoPath;
    else if (fs.existsSync(pngPath)) iconPath = pngPath;

    if (!iconPath) {
        log('Tray icon file not found, creating empty tray icon.');
        tray = new Tray(nativeImage.createEmpty());
    } else {
        log(`Using tray icon from: ${iconPath}`);
        tray = new Tray(iconPath);
    }

    const contextMenu = Menu.buildFromTemplate([
        { label: 'Show', click: () => bringToFront() },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() },
    ]);
    tray.setToolTip('Icon Desktop');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => bringToFront());
    log('Tray icon created successfully.');
}

// Enforce single instance
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    log('Could not get single instance lock, quitting.');
    app.quit();
}
app.on('second-instance', () => {
    log('second-instance event fired.');
    bringToFront();
});

app.whenReady().then(async () => {
    log('app: ready event fired.');
    try {
        // Initialize log file now that app is ready
        try {
            const logPath = path.join(app.getPath('userData'), 'icon-desktop.log');
            fs.writeFileSync(logPath, '');
            log('Log file cleared.');
        } catch (e) { console.error('Failed to clear log file', e); }

        createMainWindow();
        createTray();
        Menu.setApplicationMenu(buildMenu());

        (require('./ipc/overlay.js')).registerOverlayIpc();
        log('Registering remaining IPC handlers...');
        ipcMain.handle('app/version', () => app.getVersion());
        ipcMain.handle('app/openExternal', (_e, url) => shell.openExternal(url));
        ipcMain.handle('app/hotkeys', () => showHotkeys());
        ipcMain.handle('view:load', (_e, url) => { try { log('view:load', url); createOrAttachBrowserView(); view?.webContents.loadURL(url).catch(e => log('view.loadURL threw', e)); } catch (e) { log('view:load error', e); } });
        ipcMain.handle('view:show', (_e, which) => { try { if (which === 'library') showLibraryView(); else showStoreView(); } catch (e) { log('view:show error', e); } });
        ipcMain.on('icon:dbg', (_e, payload) => {
            try {
                log('icon:dbg', JSON.stringify(payload));
            } catch (e) {
                log('icon:dbg raw', payload);
            }
        });

        // --- Register Global Hotkeys ---
        log('Registering global hotkeys...');
    const shortcuts = {
      'CommandOrControl+Alt+Shift+X': () => overlay.removeAllOverlays(),
      'CommandOrControl+Alt+Shift+H': () => showHotkeys(),
      'CommandOrControl+Alt+Shift+P': () => overlay.party(),
      'CommandOrControl+Alt+Shift+B': () => overlay.toggleBounceAll(),
      'CommandOrControl+Alt+Shift+R': () => overlay.rain(24),
      'CommandOrControl+Alt+Shift+L': () => rainRandomFromLibrary(24),
    };
        for (const [accelerator, callback] of Object.entries(shortcuts)) {
            if (!globalShortcut.register(accelerator, callback)) {
                log(`WARNING: Failed to register global shortcut: ${accelerator}`);
            }
        }
    } catch (e) {
        log('FATAL: Error in app.whenReady block.', e);
    }
});

app.on('window-all-closed', () => {
    log('app: window-all-closed event fired.');
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    log('app: activate event fired.');
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

// ---------- BrowserView helpers ----------
function ensureViewBounds(v?: BrowserView | null) {
  if (!mainWin || !v) return;
  try {
    const [w, h] = mainWin.getContentSize();
    v.setBounds({ x: 0, y: 42, width: Math.max(0, w), height: Math.max(0, h - 42) });
    v.setAutoResize({ width: true, height: true });
  } catch (e) {
    log('ensureViewBounds error', e);
  }
}

function setupViewHandlers(v: BrowserView) {
  try {
    v.webContents.on('did-finish-load', () => {
        log(`BrowserView finished loading: ${v.webContents.getURL()}`);
    });

    v.webContents.on('did-navigate', (_e, url) => {
        if (/\/login/.test(url || '')) overlay.removeAllOverlays();
    });
  } catch (e) {
    log('setupViewHandlers error', e);
  }
}

function ensureLibView() {
  if (!mainWin) return;
  if (!viewLib) {
    log('Creating Library BrowserView...');
    viewLib = new BrowserView({ webPreferences: {
        preload: path.join(__dirname, '../../windows/webview-preload.js'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
        partition: 'persist:iconlib',
    }});
    mainWin.addBrowserView(viewLib);
    ensureViewBounds(viewLib);
    setupViewHandlers(viewLib);
    try { viewLib.webContents.loadURL('https://icon-web-two.vercel.app/library'); } catch (e) { log('ensureLibView loadURL error', e); }
  }
}

function ensureStoreView() {
  if (!mainWin) return;
  if (!viewStore) {
    log('Creating Store BrowserView...');
    viewStore = new BrowserView({ webPreferences: {
        preload: path.join(__dirname, '../../windows/webview-preload.js'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
        partition: 'persist:iconlib',
    }});
    mainWin.addBrowserView(viewStore);
    ensureViewBounds(viewStore);
    setupViewHandlers(viewStore);
    try { viewStore.webContents.loadURL('https://icon.coupons'); } catch (e) { log('ensureStoreView loadURL error', e); }
  }
}

function showLibraryView() {
  log('Showing Library view');
  ensureLibView();
  try { if (viewLib) mainWin?.setTopBrowserView(viewLib); } catch (e) { log('showLibraryView error', e); }
  ensureViewBounds(viewLib);
}

function showStoreView() {
  log('Showing Store view');
  ensureStoreView();
  try { if (viewStore) mainWin?.setTopBrowserView(viewStore); } catch (e) { log('showStoreView error', e); }
  ensureViewBounds(viewStore);
}

function createOrAttachBrowserView() {
  if (!mainWin) return;
  if (!view) {
    log('Creating initial BrowserView...');
    view = new BrowserView({ webPreferences: {
        preload: path.join(__dirname, '../../windows/webview-preload.js'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
        partition: 'persist:iconlib',
    }});
    mainWin.setBrowserView(view);
    ensureViewBounds(view);
    setupViewHandlers(view);
    try { log('BrowserView loading initial library URL'); view.webContents.loadURL('https://icon-web-two.vercel.app/library'); } catch (e) { log('initial view loadURL error', e); }
    // Treat this initial view as the persistent Library view
    if (!viewLib) viewLib = view;
  }
}

// Burst 24 random images currently visible in the Library view
async function rainRandomFromLibrary(count = 24) {
  try {
    ensureLibView();
    if (!viewLib) { log('rainRandomFromLibrary: no Library view'); return; }
    // Scrape IMG URLs from the Library page
    const js = `(() => {
      try {
        const imgs = Array.from(document.querySelectorAll('img'))
          .map(i => i.currentSrc || i.src)
          .filter(Boolean)
          .filter(u => /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(u));
        const uniq = Array.from(new Set(imgs));
        return JSON.stringify(uniq);
      } catch (e) { return '[]'; }
    })()`;
    const json = await viewLib.webContents.executeJavaScript(js, true).catch(() => '[]');
    let urls: string[] = [];
    try { urls = JSON.parse(json); } catch { urls = []; }
    if (!urls.length) { log('rainRandomFromLibrary: no images found in Library'); return; }
    // Sample without replacement up to count
    const out: string[] = [];
    for (let i = 0; i < count && urls.length; i++) {
      const idx = Math.floor(Math.random() * urls.length);
      out.push(urls.splice(idx, 1)[0]);
    }
    // Call overlay burst
    try { (require('./ipc/overlay.js')).burst(out); } catch (e) { log('burst call failed', e); }
  } catch (e) {
    log('rainRandomFromLibrary error', e);
  }
}
