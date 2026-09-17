/**
 * Rename Tab - background service worker (MV3)
 *
 * Keyboard commands inject a short, self-contained script into the active tab.
 * Nothing is sent anywhere. Tab names live in session memory and are cleared
 * when Chrome closes.
 *
 * Surviving a page reload needs permission to read the sites you visit, because
 * Chrome revokes activeTab on navigation. That permission is optional and off
 * until the user turns it on from the about page.
 */

const PERSIST_PERMISSION = { origins: ['<all_urls>'] };

const BLOCKED_SCHEMES = [
  'chrome://',
  'chrome-extension://',
  'chrome-search://',
  'chrome-untrusted://',
  'devtools://',
  'edge://',
  'about:',
  'view-source:'
];

const BLOCKED_HOSTS = ['chrome.google.com/webstore', 'chromewebstore.google.com'];

function isRestrictedUrl(url) {
  if (!url) return false; // unknown - let the injection attempt decide
  if (BLOCKED_SCHEMES.some((scheme) => url.startsWith(scheme))) return true;
  return BLOCKED_HOSTS.some((host) => url.includes(host));
}

async function canPersist() {
  try {
    return await chrome.permissions.contains(PERSIST_PERMISSION);
  } catch (_) {
    return false;
  }
}

const keyFor = (tabId) => 'tab:' + tabId;

async function remember(tabId, title, url) {
  let origin;
  try {
    origin = new URL(url).origin;
  } catch (_) {
    return;
  }
  await chrome.storage.session.set({ [keyFor(tabId)]: { title, origin } });
}

async function forget(tabId) {
  await chrome.storage.session.remove(keyFor(tabId));
}

async function recall(tabId) {
  const key = keyFor(tabId);
  const stored = await chrome.storage.session.get(key);
  return stored[key];
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
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

async function run(action) {
  const tab = await getActiveTab();
  if (!tab || typeof tab.id !== 'number') return;

  if (isRestrictedUrl(tab.url)) {
    await flashBadge(tab.id, '✕', '#DC2626');
    return;
  }

  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: action === 'restore' ? restoreTitleInPage : openRenameDialogInPage
    });

    if (action === 'restore') {
      const didRestore = injection && injection.result;
      if (didRestore) await forget(tab.id);
      await flashBadge(tab.id, didRestore ? '↺' : '–', didRestore ? '#059669' : '#6B7280');
    }
  } catch (_) {
    // Injection is refused on restricted pages (Web Store, chrome://, the new
    // tab page, other extensions, and file:// unless file access is enabled).
    await flashBadge(tab.id, '✕', '#DC2626');
  }
}

async function applyRename(tabId, title, url) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: applyTitleInPage,
    args: [title]
  });
  if (await canPersist()) await remember(tabId, title, url);
}

chrome.commands.onCommand.addListener((command) => {
  if (command === 'rename-tab') run('rename');
  else if (command === 'restore-tab') run('restore');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'rename') run('rename');
  else if (message && message.type === 'restore') run('restore');
  else if (message && message.type === 'renamed' && sender.tab) {
    applyRename(sender.tab.id, message.title, message.url).catch(() => {});
  }
  sendResponse({ ok: true });
  return false;
});

// Put the name back after a reload, when the user has allowed it.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'loading' && changeInfo.status !== 'complete') return;
  if (!(await canPersist())) return;

  const stored = await recall(tabId);
  if (!stored) return;

  // A name belongs to the site it was given on, not to the tab forever.
  let origin;
  try {
    origin = new URL(tab.url || '').origin;
  } catch (_) {
    return;
  }
  if (origin !== stored.origin) {
    await forget(tabId);
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: applyTitleInPage,
      args: [stored.title],
      injectImmediately: true
    });
  } catch (_) {
    /* the page may not be ready yet; the 'complete' pass will catch it */
  }
});

chrome.tabs.onRemoved.addListener((tabId) => forget(tabId).catch(() => {}));

chrome.permissions.onRemoved.addListener(() => {
  chrome.storage.session.clear().catch(() => {});
});

chrome.runtime.onInstalled.addListener((details) => {
  // Shortcuts are worthless if nobody knows they exist, so show them once.
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
});

/* -------------------------------------------------------------------- *
 * The functions below are stringified and injected into the page.       *
 * They must be fully self-contained, with no references to outer scope. *
 * -------------------------------------------------------------------- */

function applyTitleInPage(title) {
  const state = (window.__renameTabState = window.__renameTabState || {
    originalTitle: null,
    desiredTitle: null,
    observer: null,
    applying: false
  });

  const setTitle = (value) => {
    state.applying = true;
    try {
      document.title = value;
    } catch (_) {
      /* non-HTML documents cannot be retitled */
    }
    state.applying = false;
  };

  if (state.originalTitle === null) state.originalTitle = document.title;
  state.desiredTitle = title;
  setTitle(title);

  if (state.observer || typeof MutationObserver !== 'function') return true;

  const target = document.head || document.documentElement;
  if (!target) return true;

  state.observer = new MutationObserver(() => {
    const cur = window.__renameTabState;
    if (!cur || cur.applying || cur.desiredTitle === null) return;
    // Anything the page writes is its own title, so remember it as the one to
    // restore, then put the user's name back. Sites do this for unread counts
    // and while navigating within an app.
    if (document.title !== cur.desiredTitle) {
      cur.originalTitle = document.title;
      cur.applying = true;
      try {
        document.title = cur.desiredTitle;
      } catch (_) {
        /* ignore */
      }
      cur.applying = false;
    }
  });
  state.observer.observe(target, { childList: true, subtree: true, characterData: true });
  return true;
}

function openRenameDialogInPage() {
  const HOST_ID = '__rename_tab_dialog_host__';
  const existing = document.getElementById(HOST_ID);
  if (existing) {
    if (typeof existing.__renameTabFocus === 'function') existing.__renameTabFocus();
    return true;
  }

  const state = window.__renameTabState;
  const dark =
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

  const palette = dark
    ? {
        card: '#1F2430',
        border: '#343B4A',
        text: '#F3F5F9',
        muted: '#9AA3B2',
        field: '#141821',
        fieldBorder: '#3A4254',
        accent: '#818CF8'
      }
    : {
        card: '#FFFFFF',
        border: '#E3E6EC',
        text: '#111827',
        muted: '#6B7280',
        field: '#FFFFFF',
        fieldBorder: '#D5D9E1',
        accent: '#4F46E5'
      };

  // Styles are applied through the CSSOM (element.style), never through style
  // attributes or <style> tags, so strict page CSPs cannot block the dialog.
  const make = (tag, css) => {
    const el = document.createElement(tag);
    if (css) el.style.cssText = css;
    return el;
  };

  const host = make(
    'div',
    'all:initial;position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;'
  );
  host.id = HOST_ID;

  const root = host.attachShadow({ mode: 'closed' });

  const backdrop = make(
    'div',
    'position:fixed;top:0;left:0;right:0;bottom:0;display:flex;align-items:flex-start;' +
      'justify-content:center;padding-top:14vh;background:rgba(15,18,25,.45);' +
      '-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);'
  );

  const card = make(
    'div',
    'box-sizing:border-box;width:min(420px,calc(100vw - 40px));background:' +
      palette.card +
      ';border:1px solid ' +
      palette.border +
      ';border-radius:14px;padding:18px 18px 14px;' +
      'box-shadow:0 18px 44px rgba(0,0,0,.28);' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;'
  );

  const label = make(
    'div',
    'font-size:13px;font-weight:600;letter-spacing:.01em;color:' +
      palette.text +
      ';margin:0 0 10px;'
  );
  label.textContent = 'Rename this tab';

  const input = make(
    'input',
    'box-sizing:border-box;width:100%;height:38px;padding:0 11px;font-size:14px;' +
      'line-height:38px;color:' +
      palette.text +
      ';background:' +
      palette.field +
      ';border:1px solid ' +
      palette.fieldBorder +
      ';border-radius:9px;outline:none;font-family:inherit;'
  );
  input.type = 'text';
  input.spellcheck = false;
  input.setAttribute('autocomplete', 'off');
  input.value = state && state.desiredTitle !== null ? state.desiredTitle : document.title;
  input.placeholder = 'Tab title';

  const hint = make(
    'div',
    'display:flex;gap:14px;margin:11px 2px 0;font-size:11.5px;color:' + palette.muted + ';'
  );
  const hintSave = make('span', '');
  hintSave.textContent = 'Enter to save';
  const hintCancel = make('span', '');
  hintCancel.textContent = 'Esc to cancel';
  hint.appendChild(hintSave);
  hint.appendChild(hintCancel);

  card.appendChild(label);
  card.appendChild(input);
  card.appendChild(hint);
  backdrop.appendChild(card);
  root.appendChild(backdrop);
  (document.body || document.documentElement).appendChild(host);

  const focusInput = () => {
    input.focus();
    input.select();
  };
  host.__renameTabFocus = focusInput;

  const close = () => host.remove();

  const commit = () => {
    const value = input.value.trim();
    if (!value) {
      input.style.borderColor = '#DC2626';
      focusInput();
      return;
    }
    // The worker applies the title, so one piece of code owns that job.
    try {
      chrome.runtime.sendMessage({ type: 'renamed', title: value, url: location.href });
    } catch (_) {
      /* worker asleep; the shortcut can be pressed again */
    }
    close();
  };

  input.addEventListener('focus', () => {
    input.style.borderColor = palette.accent;
    input.style.boxShadow = '0 0 0 3px ' + (dark ? 'rgba(129,140,248,.22)' : 'rgba(79,70,229,.16)');
  });
  input.addEventListener('blur', () => {
    input.style.borderColor = palette.fieldBorder;
    input.style.boxShadow = 'none';
  });

  // Capture phase plus stopPropagation, so the page's own hotkeys never see these.
  input.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        commit();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
      } else {
        event.stopPropagation();
      }
    },
    true
  );

  backdrop.addEventListener('mousedown', (event) => {
    if (event.target === backdrop) close();
  });

  focusInput();
  return true;
}

function restoreTitleInPage() {
  const state = window.__renameTabState;
  if (!state || state.originalTitle === null) return false;

  if (state.observer) {
    state.observer.disconnect();
    state.observer = null;
  }

  state.desiredTitle = null;
  state.applying = true;
  try {
    document.title = state.originalTitle;
  } catch (_) {
    /* ignore */
  }
  state.applying = false;
  state.originalTitle = null;

  const host = document.getElementById('__rename_tab_dialog_host__');
  if (host) host.remove();

  return true;
}
