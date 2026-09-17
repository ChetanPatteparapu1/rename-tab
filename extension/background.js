/**
 * Rename Tab - background service worker (MV3)
 *
 * Listens for the two keyboard commands and injects a small, self-contained
 * script into the active tab. Nothing is stored, sent, or tracked.
 */

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
      await flashBadge(tab.id, didRestore ? '↺' : '–', didRestore ? '#059669' : '#6B7280');
    }
  } catch (_) {
    // Injection is refused on restricted pages (Web Store, chrome://, the new
    // tab page, other extensions, and file:// unless file access is enabled).
    await flashBadge(tab.id, '✕', '#DC2626');
  }
}

chrome.commands.onCommand.addListener((command) => {
  if (command === 'rename-tab') run('rename');
  else if (command === 'restore-tab') run('restore');
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === 'rename') run('rename');
  else if (message && message.type === 'restore') run('restore');
  sendResponse({ ok: true });
  return false;
});

chrome.runtime.onInstalled.addListener((details) => {
  // Shortcuts are worthless if nobody knows they exist, so show them once.
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
});

/* ------------------------------------------------------------------ *
 * The two functions below are stringified and injected into the page. *
 * They must be fully self-contained - no outer references.            *
 * ------------------------------------------------------------------ */

function openRenameDialogInPage() {
  const HOST_ID = '__rename_tab_dialog_host__';
  const existing = document.getElementById(HOST_ID);
  if (existing) {
    if (typeof existing.__renameTabFocus === 'function') existing.__renameTabFocus();
    return true;
  }

  const state = (window.__renameTabState = window.__renameTabState || {
    originalTitle: null,
    desiredTitle: null,
    observer: null,
    applying: false
  });

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
  input.value = state.desiredTitle !== null ? state.desiredTitle : document.title;
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

  const close = () => {
    input.style.borderColor = palette.fieldBorder;
    host.remove();
  };

  const setTitleSafely = (value) => {
    const s = window.__renameTabState;
    s.applying = true;
    try {
      document.title = value;
    } catch (_) {
      /* non-HTML documents cannot be retitled */
    }
    s.applying = false;
  };

  const startEnforcing = () => {
    const s = window.__renameTabState;
    if (s.observer) return;
    const target = document.head || document.documentElement;
    if (!target || typeof MutationObserver !== 'function') return;
    s.observer = new MutationObserver(() => {
      const cur = window.__renameTabState;
      if (!cur || cur.applying || cur.desiredTitle === null) return;
      // Many sites rewrite document.title on their own (unread counts,
      // single-page-app route changes). Put our title back when they do.
      if (document.title !== cur.desiredTitle) setTitleSafely(cur.desiredTitle);
    });
    s.observer.observe(target, { childList: true, subtree: true, characterData: true });
  };

  const commit = () => {
    const value = input.value.trim();
    if (!value) {
      input.style.borderColor = '#DC2626';
      focusInput();
      return;
    }
    const s = window.__renameTabState;
    if (s.originalTitle === null) s.originalTitle = document.title;
    s.desiredTitle = value;
    setTitleSafely(value);
    startEnforcing();
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

  // Capture phase + stopPropagation so the page's own hotkeys never see these.
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
