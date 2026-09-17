const MAC = {
  Command: ['⌘', 'Command'],
  Ctrl: ['⌃', 'Control'],
  MacCtrl: ['⌃', 'Control'],
  Alt: ['⌥', 'Option'],
  Shift: ['⇧', 'Shift']
};

const OTHER = {
  Ctrl: ['Ctrl', 'Ctrl'],
  MacCtrl: ['Ctrl', 'Ctrl'],
  Alt: ['Alt', 'Alt'],
  Shift: ['Shift', 'Shift']
};

const FROM_SYMBOL = { '⌘': 'Command', '⌃': 'Ctrl', '⌥': 'Alt', '⇧': 'Shift' };

// Chrome reports shortcuts as "Alt+R" on Windows and "⌥R" on macOS.
function splitShortcut(shortcut) {
  if (shortcut.includes('+')) return shortcut.split('+');
  const parts = [];
  let rest = shortcut;
  while (rest.length && FROM_SYMBOL[rest[0]]) {
    parts.push(FROM_SYMBOL[rest[0]]);
    rest = rest.slice(1);
  }
  if (rest) parts.push(rest);
  return parts;
}

function paintRow(keysEl, spelledEl, shortcut, isMac) {
  keysEl.replaceChildren();
  spelledEl.textContent = '';

  if (!shortcut) {
    const cap = document.createElement('kbd');
    cap.className = 'unset';
    cap.textContent = 'Not set';
    keysEl.appendChild(cap);
    spelledEl.textContent = 'Set one in Chrome';
    return;
  }

  const table = isMac ? MAC : OTHER;
  const words = [];

  splitShortcut(shortcut).forEach((part, index) => {
    const [glyph, word] = table[part] || [part, part];
    if (index > 0) {
      const plus = document.createElement('span');
      plus.className = 'plus';
      plus.textContent = '+';
      keysEl.appendChild(plus);
    }
    const cap = document.createElement('kbd');
    cap.textContent = glyph;
    keysEl.appendChild(cap);
    words.push(word);
  });

  // On Windows the caps already spell it out, so only Macs need the translation.
  spelledEl.textContent = isMac ? words.join(' + ') : '';
}

async function paintShortcuts() {
  const [{ os }, commands] = await Promise.all([
    chrome.runtime.getPlatformInfo(),
    chrome.commands.getAll()
  ]);
  const isMac = os === 'mac';

  const rows = {
    'rename-tab': ['rename-keys', 'rename-spelled'],
    'restore-tab': ['restore-keys', 'restore-spelled']
  };

  for (const command of commands) {
    const row = rows[command.name];
    if (!row) continue;
    paintRow(
      document.getElementById(row[0]),
      document.getElementById(row[1]),
      command.shortcut,
      isMac
    );
  }
}

document.getElementById('customize').addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

document.getElementById('version').textContent = 'Version ' + chrome.runtime.getManifest().version;

// Repaint when the user comes back from Chrome's shortcut editor.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) paintShortcuts();
});

paintShortcuts();

/* Keeping a name across a reload needs permission for that one site, granted
   from the popup while the user is on it. This page lists what was granted. */

const sitesList = document.getElementById('persist-sites');
const clearButton = document.getElementById('persist-clear');

function hostOf(pattern) {
  try {
    return new URL(pattern.replace(/\*$/, '')).host;
  } catch (_) {
    return pattern;
  }
}

async function paintSites() {
  const granted = await chrome.permissions.getAll();
  const origins = (granted.origins || []).filter((o) => o !== '<all_urls>');

  sitesList.replaceChildren();

  if (!origins.length) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'No sites yet.';
    sitesList.appendChild(empty);
    clearButton.hidden = true;
    return;
  }

  for (const origin of origins) {
    const item = document.createElement('li');
    item.textContent = hostOf(origin);
    sitesList.appendChild(item);
  }
  clearButton.hidden = false;
  clearButton.onclick = () => {
    chrome.permissions.remove({ origins }).then(paintSites).catch(() => {});
  };
}

chrome.permissions.onAdded.addListener(paintSites);
chrome.permissions.onRemoved.addListener(paintSites);

paintSites();
