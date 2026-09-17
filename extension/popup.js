const MAC_SYMBOLS = {
  Command: '⌘',
  Ctrl: '⌃',
  MacCtrl: '⌃',
  Alt: '⌥',
  Option: '⌥',
  Shift: '⇧'
};

function formatShortcut(shortcut, isMac) {
  if (!shortcut) return null;
  if (!isMac) return shortcut;
  return shortcut
    .split('+')
    .map((part) => MAC_SYMBOLS[part] || part)
    .join('');
}

async function paintShortcuts() {
  const [{ os }, commands] = await Promise.all([
    chrome.runtime.getPlatformInfo(),
    chrome.commands.getAll()
  ]);
  const isMac = os === 'mac';

  const targets = {
    'rename-tab': document.getElementById('rename-key'),
    'restore-tab': document.getElementById('restore-key')
  };

  let anyMissing = false;
  for (const command of commands) {
    const element = targets[command.name];
    if (!element) continue;
    const label = formatShortcut(command.shortcut, isMac);
    if (label) {
      element.textContent = label;
    } else {
      element.textContent = 'Not set';
      element.classList.add('unset');
      anyMissing = true;
    }
  }

  if (anyMissing) {
    document.getElementById('note').textContent =
      'A shortcut is unassigned — another extension may have claimed it.';
  }
}

// Keeping a name across a reload needs permission for that one site. Chrome
// only shows the prompt during a user gesture, so the click handler cannot wait
// on an await before asking.
async function paintPersist() {
  const row = document.getElementById('persist');
  const label = document.getElementById('persist-label');
  const button = document.getElementById('persist-button');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let origin = null;
  try {
    const url = new URL(tab.url);
    if (url.protocol === 'http:' || url.protocol === 'https:') origin = url;
  } catch (_) {
    /* restricted page, or no access to this tab */
  }
  if (!origin) return;

  const pattern = { origins: [origin.origin + '/*'] };
  const granted = await chrome.permissions.contains(pattern);

  label.textContent = granted
    ? 'Names stay here after a reload.'
    : 'Names reset when this page reloads.';
  button.textContent = granted ? 'Turn off for ' + origin.host : 'Keep names on ' + origin.host;
  button.className = granted ? 'wide off' : 'wide';
  button.onclick = () => {
    const change = granted
      ? chrome.permissions.remove(pattern)
      : chrome.permissions.request(pattern);
    change.then(() => window.close()).catch(() => {});
  };
  row.hidden = false;
}

function send(type) {
  chrome.runtime.sendMessage({ type }).finally(() => window.close());
}

document.getElementById('rename').addEventListener('click', () => send('rename'));
document.getElementById('restore').addEventListener('click', () => send('restore'));
document.getElementById('shortcuts').addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  window.close();
});

document.getElementById('settings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

paintShortcuts();
paintPersist();
