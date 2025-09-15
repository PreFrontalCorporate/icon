import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';

// Self-contained logger to avoid circular dependencies with main.ts
function log(...args: any[]) {
  try {
    const line = `[${new Date().toISOString()}] [overlay-ipc] ${args.map(a => String(a)).join(' ')}\n`;
    // Log to file only when app is ready and path is available
    if (app.isReady()) {
      const logPath = path.join(app.getPath('userData'), 'icon-desktop.log');
      fs.appendFileSync(logPath, line);
    }
    console.log('[overlay-ipc]', ...args);
  } catch {}
}

const overlays = new Set<BrowserWindow>();
let BOUNCE_ALL = false;
let LAST_URL = '';

export const getOverlayCount = () => overlays.size;

export function createOverlay(id: string, url: string, pos?: {x: number, y: number}): number {
  log(`Creating overlay: ${id} for ${url}`);
  try {
    try { LAST_URL = url || LAST_URL || ''; } catch {}
    const win = createOverlayWindow(url, pos);
    overlays.add(win);
    win.on('closed', () => overlays.delete(win));
    return overlays.size;
  } catch (err) {
    log('createOverlay error', String(err));
    return overlays.size;
  }
}

export function removeAllOverlays(): number {
  log(`Removing all ${overlays.size} overlays.`);
  for (const w of overlays) {
    try { w.close(); } catch {}
  }
  overlays.clear();
  return 0;
}

export function rain(n: number) {
  log(`rain(${n}) called.`);
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const testImageUrl = LAST_URL || 'https://cdn.shopify.com/s/files/1/0652/0605/9087/files/Rare_Pepe.webp?v=1753859512';
  for (let i = 0; i < n; i++) {
    try {
      const x = Math.floor(Math.random() * (width - 300));
      const y = Math.floor(Math.random() * (height - 300));
      createOverlay(`rain:${i}:${Date.now()}`, testImageUrl, { x, y });
    } catch (e) {
      log('rain overlay creation error', e);
    }
  }
}
/** Burst overlays from a provided list of URLs at smart/random positions. */
export function burst(urls: string[]) {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  urls.forEach((u, i) => {
    try {
      const x = Math.floor(Math.random() * (width - 300));
      const y = Math.floor(Math.random() * (height - 300));
      createOverlay(`burst:${i}:${Date.now()}`, u, { x, y });
    } catch (e) {
      log('burst overlay creation error', e);
    }
  });
}
export function toggleBounceAll() {
  BOUNCE_ALL = !BOUNCE_ALL;
  for (const w of overlays) {
    try {
      w.webContents.executeJavaScript(`(function(){
        var el = document.getElementById('img'); if(!el) return;
        if (${BOUNCE_ALL}) el.classList.add('bouncing'); else el.classList.remove('bouncing');
      })()`);
    } catch {}
  }
}

export function party() {
  const keys = ['r','s','b'];
  for (const w of overlays) {
    try {
      const k = keys[Math.floor(Math.random() * keys.length)];
      w.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'${'${k}'}'}))`);
    } catch {}
  }
}

export function registerOverlayIpc() {
  log('registerOverlayIpc: registering channels overlay/*');
  ipcMain.handle('overlay/count', () => overlays.size);

  ipcMain.handle('overlay/clearAll', () => {
    return removeAllOverlays();
  });

  ipcMain.handle('overlay/pin', async (_e, url: string) => {
    try {
      return createOverlay(`pin:${Date.now()}`, url);
    } catch (e) {
      log('overlay/pin error', e);
      return overlays.size;
    }
  });
}

function createOverlayWindow(url: string, pos?: {x: number, y: number}) {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width: Math.round(Math.min(480, width * 0.4)),
    height: Math.round(Math.min(480, height * 0.4)),
    x: pos?.x,
    y: pos?.y,
    frame: false,
    transparent: true,
    resizable: true,
    movable: true,
    show: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    alwaysOnTop: true, // reinforced below
    fullscreenable: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Make it truly topmost
  try { win.setAlwaysOnTop(true, 'screen-saver'); } catch {}
  try { win.setVisibleOnAllWorkspaces(true); } catch {}

  const html = buildOverlayHtml(url);
  win.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(html)}`);
  log('overlay window created for', url);

  // Auto-fit window size to image natural dimensions (within 50% of work area)
  try {
    win.webContents.on('did-finish-load', async () => {
      try {
        const dim = await win.webContents.executeJavaScript(`(function(){
          return new Promise(function(res){
            var img = document.getElementById('img'); if(!img){res(null);return}
            if (img.complete && img.naturalWidth) { res({w:img.naturalWidth,h:img.naturalHeight}); return }
            img.addEventListener('load', function(){ res({w:img.naturalWidth,h:img.naturalHeight}); }, { once:true });
            img.addEventListener('error', function(){ res(null); }, { once:true });
          });
        })()`);
        if (dim && dim.w && dim.h) {
          const maxW = Math.round(width * 0.5), maxH = Math.round(height * 0.5);
          const scale = Math.min(1, maxW / dim.w, maxH / dim.h);
          const targetW = Math.max(160, Math.round(dim.w * scale));
          const targetH = Math.max(160, Math.round(dim.h * scale));
          const b = win.getBounds();
          const cx = b.x + Math.round(b.width / 2); const cy = b.y + Math.round(b.height / 2);
          win.setBounds({ x: Math.round(cx - targetW / 2), y: Math.round(cy - targetH / 2), width: targetW, height: targetH });
        }
      } catch {}
    });
  } catch {}

  return win;
}

function buildOverlayHtml(url: string) {
  const safe = url.replace(/[&<>"']/g, (m) =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' } as any)[m]
  );
  return `<!doctype html><html><head>
<meta charset="utf-8"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'self' data: https:; img-src * data: https:; style-src 'unsafe-inline' 'self'; script-src 'unsafe-inline' 'self'">
<title>overlay</title>
<style>
  html,body{margin:0;height:100%;background:transparent;overflow:hidden}
  /* stage centers content and lets image scale both smaller and larger */
  #stage{position:absolute; inset:0; display:flex; align-items:center; justify-content:center; -webkit-app-region: no-drag; z-index:0}
  #img{width:100%; height:100%; object-fit:contain; user-select:none; -webkit-user-drag:none; -webkit-app-region: no-drag; transform: rotate(var(--deg, 0deg)) scale(var(--scale, 1));}
  /* drag anywhere; controls are no-drag */
  .drag{position:absolute; inset:0; -webkit-app-region: drag; z-index:1}
  #close{
    position:fixed; right:12px; top:12px; z-index:2; -webkit-app-region: no-drag;
    background:rgba(0,0,0,.6); color:#fff; border:0; border-radius:999px; cursor:pointer;
    width:28px; height:28px; line-height:26px; text-align:center; font:16px/26px ui-sans-serif,system-ui,'Segoe UI';
  }
  #hint{
    position:fixed; left:12px; bottom:12px; opacity:.75; color:#fff; font:12px ui-sans-serif,system-ui,'Segoe UI'; z-index:2;
    background:rgba(0,0,0,.45); padding:6px 8px; border-radius:8px; -webkit-app-region: no-drag;
  }
  @keyframes bounce{0%{--scale:1}100%{--scale:1.06}}
  .bouncing{animation:bounce 600ms ease-in-out alternate infinite}
</style>
</head><body>
  <div id="stage"><img id="img" src="${safe}" alt="" draggable="false"/></div>
  <div class="drag"></div>
  <button id="close" aria-label="Close">×</button>
  <div id="hint">Esc: close · R: rotate</div>
  <script>
    const img = document.getElementById('img');
    const closeBtn = document.getElementById('close');
    const hint = document.getElementById('hint');
    let deg = 0;
    function apply(){ try { img.style.setProperty('--deg', deg + 'deg'); } catch {} }
    window.addEventListener('keydown', e=>{
      if (e.key === 'Escape') window.close();
      const k = e.key.toLowerCase();
      if (k === 'r') { deg = (deg + 90) % 360; apply(); }
      if (k === 'b') { try { img.classList.toggle('bouncing'); } catch {} }
      if (k === 's') { try {
        const C = window.AudioContext || window.webkitAudioContext;
        if (C) { const ctx = new C(); const o = ctx.createOscillator(); const g = ctx.createGain();
          o.type = 'sine'; o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
          g.gain.value = 0.0002; g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
          o.start(); setTimeout(()=>{ try { g.gain.exponentialRampToValueAtTime(0.0002, ctx.currentTime + 0.12); o.stop(); ctx.close(); } catch {} }, 140);
        }
      } catch {}
      }
    });
    img.addEventListener('dblclick', ()=> window.close());
    closeBtn.addEventListener('click', ()=> window.close());

    function setUI(v){
      try {
        closeBtn.style.opacity = v ? '1' : '0';
        hint.style.opacity = v ? '1' : '0';
        document.body.style.boxShadow = v ? 'inset 0 0 0 1px rgba(255,255,255,.8)' : 'none';
      } catch {}
    }
    window.addEventListener('focus', ()=> setUI(true));
    window.addEventListener('blur', ()=> setUI(false));
    document.addEventListener('mousedown', ()=> setUI(true));
    setUI(false);
  </script>
</body></html>`;
}
