// app/desktop/windows/webview-preload.js
// Runs INSIDE the <webview> (remote Library). It must be robust against the host
// library's own code and prevent duplicate sticker-add events.

// Ensure Electron APIs are available in preload context
let contextBridge, ipcRenderer;
try {
  ({ contextBridge, ipcRenderer } = require('electron'));
} catch (e) {
  // In case require is unexpectedly unavailable, leave undefined; code below guards uses.
}

// --- Verbose Debugging Start ---
// This block adds logging to help us see if this script is running and where it might be failing.
const logToHost = (message, ...args) => {
  try {
    const payload = { message: `[webview-preload] ${message}`, args: args.map(String) };
    // This channel is listened for in the main process to write to the main log file.
    if (typeof ipcRenderer !== 'undefined' && typeof ipcRenderer.sendToHost === 'function') {
      ipcRenderer.sendToHost('icon:dbg', payload);
    } else if (typeof ipcRenderer !== 'undefined' && typeof ipcRenderer.send === 'function') {
      ipcRenderer.send('icon:dbg', payload);
    }
  } catch (e) {
    // This catch is a last resort in case ipcRenderer itself is broken.
    console.error('[webview-preload-log-error]', e.message);
  }
};

logToHost('Script evaluation started.');

try {
  logToHost('Electron modules (contextBridge, ipcRenderer) are globally available in this context.');

// Rate-limiting state
let lastSentTime = 0;
const THROTTLE_MS = 300; // Block sends within this window

// --- GOAL:webview.single_ipc_message ---
// This is the single, throttled function responsible for sending the IPC message to the host.
// All event sources (bridge calls, click fallbacks) must go through this.
const sendToHost = (channel, payload) => {
  const now = Date.now();
  if (now - lastSentTime < THROTTLE_MS) {
    // GOAL:webview.dedupe_ipc - Throttled: received a request to send, but it was too soon.
    console.log('Icon: Throttled sticker send request.');
    return;
  }
  lastSentTime = now;

  try {
    if (typeof ipcRenderer.sendToHost === 'function') {
      ipcRenderer.sendToHost(channel, payload);
    } else {
      // When running inside a BrowserView instead of a <webview>
      ipcRenderer.send(channel, payload);
    }
  } catch (e) {
    // This can happen if the webview is navigating away.
    console.warn('icon: sendToHost failed, likely safe to ignore:', e.message);
  }
};

const forwardSticker = (payload) => {
  const src = payload?.url || payload?.src;
  if (!src) {
    console.warn('icon: forwardSticker called without a src/url');
    return;
  }
  const now = Date.now();
  if (now - lastSentTime < THROTTLE_MS) {
    // Drop duplicates triggered by multiple event listeners for the same user action.
    return;
  }
  lastSentTime = now;
  try { sendToHost('icon:dbg', { type: 'forward', src }); } catch {}
  // Send directly to main to create the overlay (most reliable path)
  try { ipcRenderer.invoke('overlay/pin', src); } catch {}
  // And also notify host (for debugging/compat paths)
  try { sendToHost('icon:webview-sticker', { src }); } catch {}
};

// 1) EXPOSE BRIDGE: The library should prefer calling this method directly.
const bridge = {
  pinSticker: (src, _opts) => forwardSticker({ src }),
  clearOverlays: () => {
    try {
      if (typeof ipcRenderer.sendToHost === 'function') ipcRenderer.sendToHost('icon:webview-clear');
      else ipcRenderer.send('icon:webview-clear');
    } catch {}
  }, // No throttle on this
  // Test-only function to reset the throttle state
  _reset: () => {
    lastSentTime = 0;
  },
};
try { contextBridge.exposeInMainWorld('icon', bridge); } catch {}

// Bridge for the main UI shell (library.html)
const apiBridge = {
  overlays: {
    clearAll: () => ipcRenderer.invoke('overlay/clearAll'),
  },
  browser: {
    show: (which) => ipcRenderer.invoke('view:show', which),
    hotkeys: () => ipcRenderer.invoke('app/hotkeys'),
  },
};
try { contextBridge.exposeInMainWorld('api', apiBridge); } catch {}

try { contextBridge.exposeInMainWorld('desktop', bridge); } catch {}
// Also assign directly for robustness when contextIsolation is disabled
try { window.icon = Object.assign({}, bridge); } catch {}
try { window.desktop = Object.assign({}, bridge); } catch {}

// 1b) Accept messages from in-page scripts (in case we inject a helper in page world)
try {
  window.addEventListener('message', (ev) => {
    try {
      const d = ev && ev.data;
      const url = (d && (d.__iconSticker || d.src || (d.payload && (d.payload.src || d.payload.url)))) || null;
      if (url) sendToHost('icon:webview-sticker', { src: url });
      if (d && d.__iconDbg) sendToHost('icon:dbg', d);
    } catch {}
  });
} catch {}

// 2) CLICK FALLBACK: Capture any click and walk the DOM to find an image URL.
// This is a fallback for libraries that don't explicitly use the bridge.
const extractUrlFromTarget = (startNode) => {
  let el = startNode;
  // Walk up a few parents to find a likely candidate
  for (let i = 0; el && i < 4; i++, el = el.parentElement) {
    if (el.tagName === 'IMG' && (el.currentSrc || el.src)) return el.currentSrc || el.src;
    const sourceEl = el.querySelector?.('source[srcset]');
    if (sourceEl?.srcset) {
      const firstSrc = sourceEl.srcset.split(',')[0]?.trim().split(' ')[0];
      if (firstSrc) return firstSrc;
    }
    if (el.tagName === 'A' && el.href && /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(el.href)) {
      return el.href;
    }
    const bgImg = (el instanceof Element) ? getComputedStyle(el).backgroundImage || '' : '';
    const match = bgImg.match(/url\(["']?(.*?)["']?\)/i);
    if (match?.[1]) return match[1];
    const dataset = (el instanceof Element && el.dataset) || {};
    if (dataset.stickerSrc || dataset.src || dataset.image || dataset.img) {
      return dataset.stickerSrc || dataset.src || dataset.image || dataset.img;
    }
  }
  return null;
};

const handleDocumentClick = (event) => {
  // Only act on primary (left) button clicks.
  if (event.button !== 0) {
    return;
  }

  // The throttle is the main gatekeeper. Check it early.
  if (Date.now() - lastSentTime < THROTTLE_MS) {
    return;
  }

  const url = extractUrlFromTarget(event.target);
  try { (typeof ipcRenderer.sendToHost === 'function' ? ipcRenderer.sendToHost : ipcRenderer.send)('icon:dbg', { type:'click', found: !!url }); } catch {}
  if (url) {
    // If we found a URL, send it and stop everything else.
    forwardSticker({ src: url });
    event.preventDefault();
    event.stopImmediatePropagation();
  }
};

// Listen on the capture phase to be first in line.
try { window.addEventListener('click', handleDocumentClick, { capture: true }); } catch {}
try { document.addEventListener('click', handleDocumentClick, { capture: true }); } catch {}

// Extra safety: attach explicit listeners to <img> and <a> elements and reattach on DOM mutations.
const ATTACHED = new WeakSet();
const shouldHandle = (el) => {
  if (!el || ATTACHED.has(el)) return false;
  if (el.tagName === 'IMG') return true;
  if (el.tagName === 'A' && /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(el.getAttribute('href')||'')) return true;
  return false;
};
const attachDirect = (root=document) => {
  try {
    root.querySelectorAll('img, a[href]').forEach((el) => {
      if (!shouldHandle(el)) return;
      const handler = (e) => {
        try {
          const url = el.tagName === 'IMG' ? (el.currentSrc || el.src) : el.getAttribute('href');
          if (url) { forwardSticker({ src: url }); e.preventDefault(); e.stopImmediatePropagation(); }
        } catch {}
      };
      el.addEventListener('click', handler, true);
      ATTACHED.add(el);
    });
  } catch {}
};
try { attachDirect(document); } catch {}
try {
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      try {
        if (m.addedNodes) m.addedNodes.forEach((n) => {
          if (n && n.querySelectorAll) attachDirect(n);
        });
      } catch {}
    }
  });
  mo.observe(document.documentElement || document, { childList: true, subtree: true });
} catch {}

// Announce that the preload script is ready.
try { (typeof ipcRenderer.sendToHost === 'function' ? ipcRenderer.sendToHost : ipcRenderer.send)('icon:webview-ready', null); } catch {}

// ---- Library header tweaks: rename title and add help note ----
function tweakLibraryHeader(root = document) {
  try {
    if (!/library/i.test(location.href)) return; // only on library page
    const headings = root.querySelectorAll('h1, h2, h3, [role="heading"]');
    let target = null;
    headings.forEach(h => {
      try {
        const t = (h.textContent || '').trim();
        if (!target && (/sticker\s+library/i.test(t) || /my\s+sticker/i.test(t) || /🎟️/u.test(t))) target = h;
      } catch {}
    });
    if (!target) return;

    if (!target.dataset || !target.dataset.iconTweaked) {
      try { target.textContent = '👁️ Library'; } catch {}
      target.dataset.iconTweaked = '1';
    }

    const parent = target.parentElement || root.body;
    if (!parent) return;
    if (!parent.dataset || !parent.dataset.iconHeaderFlex) {
      try {
        const cs = getComputedStyle(parent);
        if (cs.display !== 'flex') {
          parent.style.display = 'flex';
          parent.style.alignItems = 'center';
          parent.style.gap = '10px';
          parent.style.flexWrap = 'wrap';
          parent.style.justifyContent = 'space-between';
        }
        parent.dataset.iconHeaderFlex = '1';
      } catch {}
    }

    let note = parent.querySelector('.icon-help-note');
    if (!note) {
      note = document.createElement('div');
      note.className = 'icon-help-note';
      note.textContent = "If memes don’t appear after purchase, please close and relaunch the app. Contact support@cbb.homes if the issue persists.";
      Object.assign(note.style, {
        marginLeft: 'auto',
        font: '12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
        opacity: '0.78',
        color: 'currentColor',
        whiteSpace: 'nowrap'
      });
      try { parent.appendChild(note); } catch {}
    }
  } catch {}
}

try {
  if (/library/i.test(location.href)) {
    // Initial pass and on DOM mutations
    tweakLibraryHeader(document);
    const moHeader = new MutationObserver((muts) => {
      for (const m of muts) {
        try {
          if (m.addedNodes) m.addedNodes.forEach((n) => { if (n && n.querySelectorAll) tweakLibraryHeader(n); });
        } catch {}
      }
    });
    moHeader.observe(document.documentElement || document, { childList: true, subtree: true });
  }
} catch {}

  logToHost('Script evaluation finished successfully. Bridges exposed.');
} catch (e) {
  logToHost('FATAL SCRIPT ERROR in webview-preload.js', e.message, e.stack);
}
