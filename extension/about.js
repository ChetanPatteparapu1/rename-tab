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

  for (const command of commands) {
    const element = targets[command.name];
    if (!element) continue;
    const label = formatShortcut(command.shortcut, isMac);
    element.textContent = label || 'Not set';
    element.classList.toggle('unset', !label);
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
