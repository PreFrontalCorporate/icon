declare global {
  interface Window {
    desktop: { version: () => Promise<string> };
  }
}

const appEl = document.getElementById('app')!;
appEl.style.cssText = 'min-height:100vh;display:grid;place-items:center;background:#151515;color:#eee;';
appEl.innerHTML = `
  <div style="text-align:center">
    <div style="font-size:44px; line-height:1; font-weight:700; text-transform:none; letter-spacing:.5px">icon</div>
    <div style="opacity:.95; margin-top:8px; font-size:14px">renderer loaded ✅</div>
    <div id="ver" style="opacity:.75; margin-top:6px; font-size:12px">Version: …</div>
  </div>
`;

window.desktop.version()
  .then(v => {
    const ver = document.getElementById('ver');
    if (ver) ver.textContent = `Version: ${v}`;
  })
  .catch(err => {
    const pre = document.createElement('pre');
    pre.textContent = String(err);
    appEl.appendChild(pre);
  });
