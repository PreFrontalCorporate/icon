const STORE_API = 'https://icon.coupons';

chrome.runtime.onInstalled.addListener(async () => {
  console.log('Icon extension installed');
  // Context menus
  chrome.contextMenus.create({ id: 'overlay-image', title: 'Overlay this image', contexts: ['image'] });
  chrome.contextMenus.create({ id: 'clear-overlays', title: 'Clear overlays', contexts: ['all'] });
  chrome.contextMenus.create({ id: 'party-mode', title: 'Party mode', contexts: ['all'] });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId === 'overlay-image' && info.srcUrl) {
    chrome.tabs.sendMessage(tab.id, { type: 'OVERLAY_URL', url: info.srcUrl });
  }
  if (info.menuItemId === 'clear-overlays') {
    chrome.tabs.sendMessage(tab.id, { type: 'CLEAR' });
  }
  if (info.menuItemId === 'party-mode') {
    chrome.tabs.sendMessage(tab.id, { type: 'PARTY' });
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  if (command === 'clear_overlays') chrome.tabs.sendMessage(tab.id, { type: 'CLEAR' });
  if (command === 'party_mode') chrome.tabs.sendMessage(tab.id, { type: 'PARTY' });
});

// Message bridge: popup/content → background → network/storage
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.type === 'VERIFY') {
      try {
        const r = await fetch(`${STORE_API}/api/verify`, {
          method: 'POST',
          body: JSON.stringify({ token: msg.token }),
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await r.json();
        if (data?.allowedIds) {
          await chrome.storage.sync.set({ multipass: msg.token, allowedIds: data.allowedIds });
        }
        sendResponse(data);
      } catch (e) {
        sendResponse(null);
      }
      return;
    }
    if (msg.type === 'GET_TOKEN') {
      const { multipass } = await chrome.storage.sync.get('multipass');
      sendResponse(multipass || null);
      return;
    }
    if (msg.type === 'OPEN_STORE') {
      await chrome.tabs.create({ url: `${STORE_API}` });
      sendResponse(true);
      return;
    }
    if (msg.type === 'SCRAPE_AND_PARTY') {
      if (sender.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, { type: 'SCRAPE_IMAGES' }, (resp) => {
          chrome.tabs.sendMessage(sender.tab!.id!, { type: 'PARTY', urls: resp?.urls || [] });
          sendResponse(true);
        });
        return;
      }
    }
  })();
  return true; // keep port open for async
});
