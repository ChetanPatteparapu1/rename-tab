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
