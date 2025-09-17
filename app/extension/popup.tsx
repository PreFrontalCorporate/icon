const $ = (id: string) => document.getElementById(id)! as HTMLElement;

// Prefill token from sync storage
chrome.runtime.sendMessage({ type: 'GET_TOKEN' }, (token) => {
  if (token) (document.getElementById('token') as HTMLInputElement).value = token;
});

$('save').addEventListener('click', async () => {
  const token = (document.getElementById('token') as HTMLInputElement).value.trim();
  if (!token) return;
  chrome.runtime.sendMessage({ type: 'VERIFY', token }, (resp) => {
    if (resp?.allowedIds) {
      $('status').textContent = `✔ ${resp.allowedIds.length} stickers unlocked`;
    } else {
      $('status').textContent = '❌ Verification failed';
    }
  });
});

$('open-store').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'OPEN_STORE' });
});

$('open-library').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://icon-web-two.vercel.app/library' });
});

$('overlay-btn').addEventListener('click', async () => {
  const url = (document.getElementById('overlay-url') as HTMLInputElement).value.trim();
  if (!url) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'OVERLAY_URL', url });
});

$('clear').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'CLEAR' });
});

$('party').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'PARTY' });
});

$('rain').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_IMAGES' }, (resp) => {
    chrome.tabs.sendMessage(tab.id!, { type: 'RAIN', urls: resp?.urls || [], count: 24 });
  });
});
