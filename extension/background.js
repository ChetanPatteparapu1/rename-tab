/**
 * Rename Tab - background service worker (MV3)
 *
 * Holds the name for each renamed tab and tells the content script what to do.
 * Names live in session memory and are gone when Chrome closes. Nothing is
 * written to disk and nothing is sent anywhere.
 */

const keyFor = (tabId) => 'tab:' + tabId;

async function rememberName(tabId, title) {
  await chrome.storage.session.set({ [keyFor(tabId)]: title });
}

async function forgetName(tabId) {
  await chrome.storage.session.remove(keyFor(tabId));
}

async function recallName(tabId) {
  const key = keyFor(tabId);
  const stored = await chrome.storage.session.get(key);
  return stored[key] || null;
}

async function activeTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab && typeof tab.id === 'number' ? tab.id : null;
}

// Returns null when the tab has no content script, which is how Chrome's
// restricted pages present themselves.
async function tell(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (_) {
    return null;
  }
}

async function flashBadge(tabId, text, color) {
  try {
    await chrome.action.setBadgeBackgroundColor({ tabId, color });
    await chrome.action.setBadgeText({ tabId, text });
    setTimeout(() => chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {}), 1600);
  } catch (_) {
    /* tab closed - nothing to do */
  }
}

async function rename(tabId) {
  const response = await tell(tabId, { type: 'prompt' });
  if (!response || !response.ok) await flashBadge(tabId, '✕', '#DC2626');
}

async function restore(tabId) {
  const response = await tell(tabId, { type: 'clear' });
  await forgetName(tabId);
  if (!response) await flashBadge(tabId, '✕', '#DC2626');
  else if (response.ok) await flashBadge(tabId, '↺', '#059669');
  else await flashBadge(tabId, '–', '#6B7280');
}

async function run(action) {
  const tabId = await activeTabId();
  if (tabId === null) return;
  if (action === 'restore') await restore(tabId);
  else await rename(tabId);
}

chrome.commands.onCommand.addListener((command) => {
  if (command === 'rename-tab') run('rename');
  else if (command === 'restore-tab') run('restore');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return false;
  const tabId = sender.tab && typeof sender.tab.id === 'number' ? sender.tab.id : null;

  // A page has just loaded and wants to know whether this tab has a name.
  if (message.type === 'hello' && tabId !== null) {
    recallName(tabId).then((title) => sendResponse({ title }));
    return true;
  }

  if (message.type === 'renamed' && tabId !== null) {
    rememberName(tabId, message.title).then(() => sendResponse({ ok: true }));
    return true;
  }

  // From the popup, which has no tab of its own.
  if (message.type === 'rename' || message.type === 'restore') {
    run(message.type);
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  forgetName(tabId).catch(() => {});
});

chrome.runtime.onInstalled.addListener((details) => {
  // Shortcuts are worthless if nobody knows they exist, so show them once.
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
});
