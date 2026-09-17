/**
 * Rename Tab - content script
 *
 * Runs at document_start on every page, which is what lets a name survive a
 * reload: the script is back before the page writes its own title, asks the
 * worker whether this tab has a name, and applies it immediately.
 *
 * It reads and writes document.title. It does not read page content, and it
 * never sends anything to a server.
 */

const DIALOG_ID = '__rename_tab_dialog_host__';

const state = {
  originalTitle: null, // the last title the page asked for
  desiredTitle: null, // the name the user chose, or null
  observer: null,
  applying: false
};

function writeTitle(value) {
  state.applying = true;
  try {
    document.title = value;
  } catch (_) {
    /* non-HTML documents cannot be retitled */
  }
  state.applying = false;
}

function watchForTitleChanges() {
  if (state.observer || typeof MutationObserver !== 'function') return;
  const target = document.head || document.documentElement;
  if (!target) return;

  state.observer = new MutationObserver(() => {
    if (state.applying || state.desiredTitle === null) return;
    if (document.title === state.desiredTitle) return;
    // Anything the page writes is its own title, so keep it as the one to
    // restore, then put the user's name back. Sites rewrite it for unread
    // counters and while navigating inside an app.
    state.originalTitle = document.title;
    writeTitle(state.desiredTitle);
  });
  state.observer.observe(target, {
    childList: true,
    subtree: true,
    characterData: true
  });
}

function applyTitle(title) {
  if (state.originalTitle === null) state.originalTitle = document.title;
  state.desiredTitle = title;
  writeTitle(title);
  watchForTitleChanges();
}

function clearTitle() {
  if (state.desiredTitle === null) return false;
  state.desiredTitle = null;
  if (state.observer) {
    state.observer.disconnect();
    state.observer = null;
  }
  if (state.originalTitle !== null) writeTitle(state.originalTitle);
  state.originalTitle = null;
  closeDialog();
  return true;
}

/* ---------------------------------- dialog --------------------------------- */

function closeDialog() {
  const host = document.getElementById(DIALOG_ID);
  if (host) host.remove();
}

function openDialog() {
  const existing = document.getElementById(DIALOG_ID);
  if (existing) {
    // A second press of the shortcut closes it again.
    existing.remove();
    return true;
  }
  if (!document.body && !document.documentElement) return false;

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

  // Styles go through the CSSOM (element.style), never through style attributes
  // or <style> tags, so a strict page CSP cannot block the dialog.
  const make = (tag, css) => {
    const el = document.createElement(tag);
    if (css) el.style.cssText = css;
    return el;
  };

  const host = make(
    'div',
    'all:initial;position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;'
  );
  host.id = DIALOG_ID;

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

  const commit = () => {
    const value = input.value.trim();
    if (!value) {
      input.style.borderColor = '#DC2626';
      focusInput();
      return;
    }
    applyTitle(value);
    chrome.runtime.sendMessage({ type: 'renamed', title: value }).catch(() => {});
    closeDialog();
  };

  input.addEventListener('focus', () => {
    input.style.borderColor = palette.accent;
    input.style.boxShadow =
      '0 0 0 3px ' + (dark ? 'rgba(129,140,248,.22)' : 'rgba(79,70,229,.16)');
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
        closeDialog();
      } else {
        event.stopPropagation();
      }
    },
    true
  );

  backdrop.addEventListener('mousedown', (event) => {
    if (event.target === backdrop) closeDialog();
  });

  focusInput();
  return true;
}

/* --------------------------------- wiring ---------------------------------- */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message) return false;
  if (message.type === 'prompt') sendResponse({ ok: openDialog() });
  else if (message.type === 'clear') sendResponse({ ok: clearTitle() });
  else if (message.type === 'apply') sendResponse({ ok: applyTitle(message.title) !== false });
  else sendResponse({ ok: false });
  return false;
});

// Ask whether this tab already has a name. On a reload this runs before the
// page writes its own title, so the name is back without a visible flicker.
chrome.runtime
  .sendMessage({ type: 'hello' })
  .then((response) => {
    if (response && response.title) applyTitle(response.title);
  })
  .catch(() => {
    /* worker restarting; the next navigation will ask again */
  });
