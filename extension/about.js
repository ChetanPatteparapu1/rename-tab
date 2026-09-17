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

/* Optional permission: putting a name back after a reload requires access to
   the sites the user visits, so it stays off until they ask for it. */

const PERSIST_PERMISSION = { origins: ['<all_urls>'] };
const persistCopy = document.getElementById('persist-copy');
const persistToggle = document.getElementById('persist-toggle');
let persistOn = false;

async function paintPersist() {
  persistOn = await chrome.permissions.contains(PERSIST_PERMISSION);
  persistCopy.textContent = persistOn
    ? 'Names survive a reload. They are cleared when you close the tab, visit a different site, or quit Chrome.'
    : 'A renamed tab goes back to its original title when the page reloads. Keeping your name needs Chrome\'s permission to read the sites you visit.';
  persistToggle.textContent = persistOn ? 'Turn off' : 'Turn on';
  persistToggle.className = persistOn ? 'secondary' : 'primary';
}

// Chrome only shows the permission prompt during a user gesture, so this cannot
// wait on an await before asking.
persistToggle.addEventListener('click', () => {
  const change = persistOn
    ? chrome.permissions.remove(PERSIST_PERMISSION)
    : chrome.permissions.request(PERSIST_PERMISSION);
  change.then(paintPersist).catch(() => {});
});

chrome.permissions.onAdded.addListener(paintPersist);
chrome.permissions.onRemoved.addListener(paintPersist);

paintPersist();
