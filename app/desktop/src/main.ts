import { app, BrowserWindow, ipcMain, globalShortcut, Menu, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { registerOverlayIpc } from './ipc/overlay';

// Ensure __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;

function log(...args: any[]) {
  try {
    const line = `[${new Date().toISOString()}] ${args.map(a => String(a)).join(' ')}\n`;
    const logPath = path.join(app.getPath('userData'), 'icon-desktop.log');
    fs.appendFileSync(logPath, line);
  } catch {}
  // eslint-disable-next-line no-console
  console.log('[main]', ...args);
}

function resolvePreload() {
  const cjs = path.join(__dirname, 'preload.cjs');
  const js = path.join(__dirname, 'preload.js');
  return fs.existsSync(cjs) ? cjs : js;
}

let mainWin: BrowserWindow | null = null;

function buildMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        { label: 'Clear all stickers', accelerator: 'CommandOrControl+Shift+X', click: () => ipcMain.emit('overlay:clearAll-request') },
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
        { label: 'Open logs folder', click: () => shell.showItemInFolder(path.join(app.getPath('userData'), 'icon-desktop.log')) },
      ]
    }
  ]);
}

function createMainWindow() {
  const preloadPath = resolvePreload();
  mainWin = new BrowserWindow({
    width: 1024,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#151515',
    autoHideMenuBar: false,
    show: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
    }
  });

  mainWin.setMenu(buildMenu());
  log('Using preload:', preloadPath);

  const libraryHtml = path.join(__dirname, '../windows/library.html');
  const fileUrl = 'file://' + libraryHtml.replace(/\\/g, '/');
  log('Loading Library:', fileUrl);
  mainWin.loadURL(fileUrl).catch(err => log('loadURL threw:', (err as any)?.stack || String(err)));

  mainWin.webContents.on('did-fail-load', (_e, code, desc, url) => {
    log('did-fail-load', code, desc, url);
    const html = Buffer.from(`\n      <!doctype html><meta charset=\"utf-8\">\n      <title>Icon Desktop - Error</title>\n      <body style=\"font:14px system-ui;padding:24px;background:#111;color:#eee;\">\n        <h1>Icon Desktop</h1>\n        <p>Renderer failed to load.</p>\n        <pre style=\"white-space:pre-wrap;background:#222;padding:12px;border-radius:8px;\">${desc} (${code})\nTried: ${fileUrl}</pre>\n      </body>`);
    mainWin?.loadURL('data:text/html;base64,' + html.toString('base64'));
  });

  mainWin.on('ready-to-show', () => mainWin?.show());
  mainWin.on('closed', () => { mainWin = null; });

  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });

  if (isDev) {
    try { mainWin.webContents.openDevTools({ mode: 'detach' }); } catch {}
  }
}

app.whenReady().then(() => {
  // Register overlay IPC (count/clearAll/pin)
  registerOverlayIpc(log);

  createMainWindow();

  // Global hotkey to clear overlays
  try { globalShortcut.register('CommandOrControl+Shift+X', () => ipcMain.emit('overlay:clearAll-request')); } catch (e) { log('hotkey error', e); }
}).catch(e => log('app.whenReady error', e));

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); });

// IPC for renderer helpers
ipcMain.handle('app/version', () => app.getVersion());
ipcMain.handle('app/openExternal', (_e, url: string) => shell.openExternal(url));
