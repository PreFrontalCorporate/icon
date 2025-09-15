"use strict";
// Electron overlay helpers (runtime JS)
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOverlay = createOverlay;
exports.removeAllOverlays = removeAllOverlays;
exports.rain = rain;
exports.toggleBounceAll = toggleBounceAll;
exports.party = party;

const { BrowserWindow, screen } = require('electron');
const https = require('node:https');

const ACTIVE = new Map();
let LAST_URL = '';
let BOUNCE_ALL = false;
let NEXT_IDX = 0; // placement index for url:/test: overlays

function createOverlay(id, imgUrl) {
  try { console.log('[overlay] createOverlay', id, imgUrl); } catch {}
  try { LAST_URL = imgUrl || LAST_URL || ''; } catch {}

  if (ACTIVE.has(id)) { try { ACTIVE.get(id).show(); } catch {}; return; }

  const cursor = screen.getCursorScreenPoint();
  const disp = screen.getDisplayNearestPoint(cursor);

  // Window size we create below (keep in sync)
  const WIN_W = 360;
  const WIN_H = 360;

  // Default position = center; for rain:* spawn at random positions
  let posX = disp.bounds.x + Math.round(disp.workArea.width / 2) - Math.round(WIN_W / 2);
  let posY = disp.bounds.y + Math.round(disp.workArea.height / 2) - Math.round(WIN_H / 2);
  try {
    const s = String(id);
    if (s.startsWith('rain:')) {
      const pad = 60;
      const rw = Math.max(320, Math.round(disp.workArea.width / 5));
      const rh = Math.max(280, Math.round(disp.workArea.height / 4));
      posX = disp.bounds.x + pad + Math.floor(Math.random() * Math.max(1, disp.workArea.width - rw - pad * 2));
      posY = disp.bounds.y + pad + Math.floor(Math.random() * Math.max(1, disp.workArea.height - rh - pad * 2));
    } else if (s.startsWith('url:') || s.startsWith('test:')) {
      // Smart placement: choose the emptiest location (farthest from any existing overlay)
      const best = suggestSmartPosition(disp, WIN_W, WIN_H);
      posX = best.x; posY = best.y;
    } else {
      // For all other cases, also try smart placement so items don't stack
      const best = suggestSmartPosition(disp, WIN_W, WIN_H);
      posX = best.x; posY = best.y;
    }
  } catch {}

  const win = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
    x: posX,
    y: posY,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    resizable: true,
    movable: true,
    show: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: { sandbox: false }
  });

  try {
    const level = process.platform === 'win32' ? 'pop-up-menu' : 'screen-saver';
    win.setAlwaysOnTop(true, level);
    if (process.platform === 'win32' && typeof win.moveTop === 'function') win.moveTop();
  } catch {}

  const html = [
    '<!doctype html><meta charset="utf-8">',
    "<meta http-equiv=\"Content-Security-Policy\" content=\"img-src * data: blob:;\">",
    '<style>',
    // A tiny alpha avoids Windows compositing showing black
    'html,body{margin:0;background:rgba(0,0,0,0.001);overflow:hidden}',
    '.drag{position:absolute;inset:0;-webkit-app-region:drag;z-index:1}',
    'img{position:absolute;inset:0;margin:auto;max-width:100%;max-height:100%;user-select:none;-webkit-user-drag:none;transform:rotate(0deg);-webkit-app-region:no-drag;z-index:0}',
    '#close{position:fixed;right:8px;top:8px;border:0;border-radius:999px;background:rgba(0,0,0,.55);color:#fff;width:26px;height:26px;line-height:24px;font:14px/24px system-ui;-webkit-app-region:no-drag;cursor:pointer;z-index:2}',
    '#hint{position:fixed;left:8px;bottom:8px;background:rgba(0,0,0,.45);color:#fff;padding:6px 8px;border-radius:8px;font:12px system-ui;-webkit-app-region:no-drag;z-index:2}',
    '@keyframes bounce{0%{transform:translateY(0) scale(1)}100%{transform:translateY(-6%) scale(1.06)}}',
    '.bouncing{animation:bounce 600ms ease-in-out alternate infinite}',
    '</style>',
    '<script>',
    'const img=new Image();img.id="img";img.setAttribute("referrerpolicy","no-referrer");img.src="' + String(imgUrl).replace(/"/g, '\\"') + '";',
    "document.addEventListener('DOMContentLoaded',()=>{document.body.appendChild(img);const drag=document.createElement('div');drag.className='drag';document.body.appendChild(drag);const close=Object.assign(document.createElement('button'),{id:'close',textContent:'×',title:'Close'});close.style.opacity='0';close.style.transition='opacity .15s';close.addEventListener('click',()=>window.close());document.body.appendChild(close);const hint=document.createElement('div');hint.id='hint';hint.textContent='Esc close · R rotate · B bounce · S chime';hint.style.opacity='0';hint.style.transition='opacity .15s';document.body.appendChild(hint);img.addEventListener('error',()=>{try{hint.textContent='Failed to load image';hint.style.background='#b91c1c';}catch{}});function setUI(v){close.style.opacity=v?'1':'0';hint.style.opacity=v?'1':'0';document.body.style.boxShadow=v?'inset 0 0 0 1px rgba(255,255,255,.8)':'none'}window.addEventListener('focus',()=>setUI(true));window.addEventListener('blur',()=>setUI(false));document.addEventListener('mousedown',()=>setUI(true));setUI(false);});",
    'let deg=0;function apply(){img.style.transform="rotate("+deg+"deg)"}window.addEventListener("keydown",e=>{if(e.key==="Escape")window.close();const k=e.key.toLowerCase();if(k==="r"){deg=(deg+90)%360;apply()}if(k==="b"){img.classList.toggle("bouncing")}if(k==="s"){try{const c=new (window.AudioContext||window.webkitAudioContext)();const o=c.createOscillator();const g=c.createGain();o.type="sine";o.frequency.value=880;o.connect(g);g.connect(c.destination);g.gain.setValueAtTime(0.0002,c.currentTime);g.gain.exponentialRampToValueAtTime(0.12,c.currentTime+0.02);o.start();setTimeout(()=>{g.gain.exponentialRampToValueAtTime(0.0002,c.currentTime+0.12);o.stop(c.currentTime+0.14);c.close()},140)}catch{}}});img.addEventListener("dblclick",()=>window.close());',
    '</script>',
    // No extra <img> here — we already appended it in JS
    ].join('');

  win.loadURL('data:text/html;charset=UTF-8,' + encodeURIComponent(html));

  try { win.once('ready-to-show', () => { try {
    win.setOpacity(1); win.show(); win.focus();
    const level = process.platform === 'win32' ? 'pop-up-menu' : 'screen-saver';
    win.setAlwaysOnTop(true, level);
  } catch {} }); } catch {}
  try { win.setVisibleOnAllWorkspaces(true); } catch {}
  try { win.focus(); } catch {}

  try {
    win.webContents.on('did-start-loading', () => { try { console.log('[overlay] did-start-loading', id); } catch {} });
    win.webContents.on('did-finish-load', () => {
      try {
        console.log('[overlay] did-finish-load', id);
        if (/^https?:/i.test(imgUrl)) {
          https.get(imgUrl, (res) => {
            try {
              const chunks = [];
              res.on('data', (d) => chunks.push(d));
              res.on('end', () => {
                try {
                  const buf = Buffer.concat(chunks);
                  const ct = res.headers['content-type'] || 'image/webp';
                  const dataUrl = 'data:' + ct + ';base64,' + buf.toString('base64');
                  win.webContents.executeJavaScript(`(function(){var el=document.getElementById('img'); if(el) el.src='${dataUrl.replace(/'/g, "\\'")}';})()`);
                } catch {}
              });
            } catch {}
          }).on('error', () => {});
        }
      } catch {}
    });
    win.webContents.on('did-fail-load', (_e, code, desc, url) => { try { console.error('[overlay] did-fail-load', id, code, desc, url); } catch {} });
  } catch {}

  win.on('closed', () => ACTIVE.delete(id));
  ACTIVE.set(id, win);
}

// Pick the position with lowest local density by sampling a grid and
// maximizing distance to nearest overlay center. This adapts to manual moves.
function suggestSmartPosition(display, winW, winH) {
  const wa = display.workArea; // { x, y, width, height }
  const pad = 24; // keep off the very edges
  const minX = display.bounds.x + Math.max(0, wa.x - display.bounds.x) + pad + Math.round(winW / 2);
  const minY = display.bounds.y + Math.max(0, wa.y - display.bounds.y) + pad + Math.round(winH / 2);
  const maxX = display.bounds.x + Math.min(display.bounds.width, (wa.x - display.bounds.x) + wa.width) - pad - Math.round(winW / 2);
  const maxY = display.bounds.y + Math.min(display.bounds.height, (wa.y - display.bounds.y) + wa.height) - pad - Math.round(winH / 2);

  // If work area is too small, fall back to center
  if (maxX <= minX || maxY <= minY) {
    return {
      x: display.bounds.x + Math.round(display.workArea.width / 2) - Math.round(winW / 2),
      y: display.bounds.y + Math.round(display.workArea.height / 2) - Math.round(winH / 2),
    };
  }

  // Build a list of existing overlay centers
  const centers = [];
  try {
    ACTIVE.forEach((w) => {
      try {
        const b = w.getBounds();
        centers.push({ x: b.x + Math.round(b.width / 2), y: b.y + Math.round(b.height / 2) });
      } catch {}
    });
  } catch {}

  // No overlays yet: use center
  if (centers.length === 0) {
    return {
      x: display.bounds.x + Math.round(display.workArea.width / 2) - Math.round(winW / 2),
      y: display.bounds.y + Math.round(display.workArea.height / 2) - Math.round(winH / 2),
    };
  }

  // Sample a grid of candidate centers and pick the farthest from any overlay center.
  const cols = 6, rows = 4; // denser sampling for better spread
  let best = { x: 0, y: 0, score: -Infinity };
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const cx = Math.round(minX + (i + 0.5) * (maxX - minX) / cols);
      const cy = Math.round(minY + (j + 0.5) * (maxY - minY) / rows);
      // Compute min distance to any center
      let minD = Infinity;
      for (const c of centers) {
        const dx = c.x - cx; const dy = c.y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minD) minD = d;
      }
      // Slightly prefer closer to cursor screen point to feel responsive
      try {
        const p = screen.getCursorScreenPoint();
        const dx = p.x - cx, dy = p.y - cy; const curBias = Math.max(0, 160 - Math.sqrt(dx*dx + dy*dy));
        minD += curBias * 0.15;
      } catch {}
      if (minD > best.score) best = { x: cx - Math.round(winW / 2), y: cy - Math.round(winH / 2), score: minD };
    }
  }
  return { x: best.x, y: best.y };
}

function removeAllOverlays() {
  ACTIVE.forEach((w) => { try { w.close(); } catch {} });
  ACTIVE.clear();
}

function rain(n) {
  // Use last used image if available; fall back to a known-good CDN asset
  const url = LAST_URL || 'https://cdn.shopify.com/s/files/1/0652/0605/9087/files/Pepe_the_Frog_Rare_Version_Meme.webp?v=1753859458';
  // Use smart placement rather than random; still fast burst
  for (let i = 0; i < n; i++) {
    try { createOverlay('burst:' + Date.now() + ':' + i, url); } catch {}
  }
}

function toggleBounceAll() {
  BOUNCE_ALL = !BOUNCE_ALL;
  ACTIVE.forEach((w) => {
    try { w.webContents.executeJavaScript(`(function(){var el=document.getElementById('img'); if(!el)return; el.classList.${BOUNCE_ALL ? 'add' : 'remove'}('bouncing');})()`); } catch {}
  });
}

function party() {
  const keys = ['r', 's', 'b'];
  ACTIVE.forEach((w) => {
    try {
      const key = keys[Math.floor(Math.random() * keys.length)];
      w.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'${key}'}))`);
    } catch {}
  });
}
