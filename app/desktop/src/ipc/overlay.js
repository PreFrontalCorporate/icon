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

  // Default position = center; for rain:* spawn at random positions
  let posX = disp.bounds.x + Math.round(disp.workArea.width / 2) - 180;
  let posY = disp.bounds.y + Math.round(disp.workArea.height / 2) - 180;
  try {
    const s = String(id);
    if (s.startsWith('rain:')) {
      const pad = 60;
      const rw = Math.max(320, Math.round(disp.workArea.width / 5));
      const rh = Math.max(280, Math.round(disp.workArea.height / 4));
      posX = disp.bounds.x + pad + Math.floor(Math.random() * Math.max(1, disp.workArea.width - rw - pad * 2));
      posY = disp.bounds.y + pad + Math.floor(Math.random() * Math.max(1, disp.workArea.height - rh - pad * 2));
    } else if (s.startsWith('url:') || s.startsWith('test:')) {
      const cols = 4, rows = 3;
      const idx = NEXT_IDX++ % (cols * rows);
      const cx = idx % cols; const cy = Math.floor(idx / cols);
      const pad = 40;
      const cellW = Math.floor((disp.workArea.width - pad * 2) / cols);
      const cellH = Math.floor((disp.workArea.height - pad * 2) / rows);
      posX = disp.bounds.x + pad + cx * cellW + Math.floor(cellW / 2) - 180;
      posY = disp.bounds.y + pad + cy * cellH + Math.floor(cellH / 2) - 180;
    }
  } catch {}

  const win = new BrowserWindow({
    width: 360,
    height: 360,
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
    '.drag{position:absolute;inset:0;-webkit-app-region:drag}',
    'img{position:absolute;inset:0;margin:auto;max-width:100%;max-height:100%;user-select:none;-webkit-user-drag:none;transform:rotate(0deg)}',
    '#close{position:fixed;right:8px;top:8px;border:0;border-radius:999px;background:rgba(0,0,0,.55);color:#fff;width:26px;height:26px;line-height:24px;font:14px/24px system-ui;-webkit-app-region:no-drag;cursor:pointer}',
    '#hint{position:fixed;left:8px;bottom:8px;background:rgba(0,0,0,.45);color:#fff;padding:6px 8px;border-radius:8px;font:12px system-ui;-webkit-app-region:no-drag}',
    '@keyframes bounce{0%{transform:translateY(0) scale(1)}100%{transform:translateY(-6%) scale(1.06)}}',
    '.bouncing{animation:bounce 600ms ease-in-out alternate infinite}',
    '</style>',
    '<script>',
    'const img=new Image();img.id="img";img.src="' + String(imgUrl).replace(/"/g, '\\"') + '";',
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

function removeAllOverlays() {
  ACTIVE.forEach((w) => { try { w.close(); } catch {} });
  ACTIVE.clear();
}

function rain(n) {
  const url = LAST_URL || 'https://icon-web-two.vercel.app/test.png';
  for (let i = 0; i < n; i++) {
    try { createOverlay('rain:' + Date.now() + ':' + i, url); } catch {}
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
