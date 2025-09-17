// Simple overlay manager injected into all pages
(() => {
  const rootId = '__icon_overlays_root__';
  const styleId = '__icon_overlays_style__';

  function ensureRoot(): HTMLElement {
    let root = document.getElementById(rootId);
    if (!root) {
      root = document.createElement('div');
      root.id = rootId;
      root.style.position = 'fixed';
      root.style.left = '0';
      root.style.top = '0';
      root.style.width = '100vw';
      root.style.height = '100vh';
      root.style.pointerEvents = 'none'; // children can opt-in
      root.style.zIndex = '2147483647';
      document.documentElement.appendChild(root);
    }
    if (!document.getElementById(styleId)) {
      const st = document.createElement('style');
      st.id = styleId;
      st.textContent = `
        .icon-sticker{position:fixed;max-width:36vw;max-height:36vh;cursor:move;box-shadow:0 6px 24px rgba(0,0,0,.25);border-radius:8px;}
        .icon-bounce{animation:icon-bounce 0.6s ease-in-out infinite alternate}
        @keyframes icon-bounce{from{transform:translateY(0)}to{transform:translateY(16px)}}
      `;
      document.head.appendChild(st);
    }
    return root;
  }

  function createOverlay(url: string) {
    const root = ensureRoot();
    const el = document.createElement('img');
    el.src = url;
    el.className = 'icon-sticker';
    el.style.pointerEvents = 'auto';
    el.style.left = Math.round(Math.random() * (window.innerWidth - 200)) + 'px';
    el.style.top = Math.round(Math.random() * (window.innerHeight - 200)) + 'px';
    el.style.width = '200px';

    // drag
    let dragging = false, ox = 0, oy = 0, startX = 0, startY = 0;
    el.addEventListener('mousedown', (e) => {
      dragging = true; (e as any).preventDefault();
      startX = e.clientX; startY = e.clientY;
      ox = parseInt(el.style.left || '0');
      oy = parseInt(el.style.top || '0');
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp, { once: true });
    });
    function onMove(e: MouseEvent){ if(!dragging) return; el.style.left = (ox + e.clientX - startX) + 'px'; el.style.top = (oy + e.clientY - startY) + 'px'; }
    function onUp(){ dragging = false; window.removeEventListener('mousemove', onMove); }

    // double-click to remove
    el.addEventListener('dblclick', () => el.remove());

    root.appendChild(el);
  }

  function removeAll(){
    const root = document.getElementById(rootId);
    if (root) root.innerHTML = '';
  }

  let bouncing = false;
  function toggleBounce(){
    bouncing = !bouncing;
    document.querySelectorAll('#'+rootId+' .icon-sticker').forEach((n) => {
      (n as HTMLElement).classList.toggle('icon-bounce', bouncing);
    })
  }

  async function scrapeImages(): Promise<string[]>{
    try{
      const imgs = Array.from(document.images).map(i => (i as HTMLImageElement).currentSrc || (i as HTMLImageElement).src).filter(Boolean) as string[];
      return Array.from(new Set(imgs.filter(u => /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(u))));
    }catch{ return []; }
  }

  function rain(urls: string[], count: number){
    if (!urls.length) return;
    for(let i=0;i<count;i++){
      createOverlay(urls[Math.floor(Math.random()*urls.length)]);
    }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
      if (msg.type === 'OVERLAY_URL' && msg.url) createOverlay(msg.url);
      if (msg.type === 'CLEAR') removeAll();
      if (msg.type === 'BOUNCE') toggleBounce();
      if (msg.type === 'RAIN') rain(msg.urls||[], msg.count||24);
      if (msg.type === 'PARTY') { toggleBounce(); rain(msg.urls||await scrapeImages(), 24); }
      if (msg.type === 'SCRAPE_IMAGES') { const urls = await scrapeImages(); sendResponse({ urls }); return; }
    })();
    return true;
  });
})();
