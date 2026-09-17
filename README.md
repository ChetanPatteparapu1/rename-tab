# Rename Tab

A Chrome extension that renames the current tab from the keyboard.

| Shortcut | Action |
| --- | --- |
| `⌥R` on Mac, `Alt+R` on Windows | Rename the current tab |
| `⌥U` on Mac, `Alt+U` on Windows | Restore the original title |

Press the shortcut, type a name, press Enter. The name survives reloads and stays
until you clear it or close the tab. Remap either key at
`chrome://extensions/shortcuts`.

## Install from source

1. Open `chrome://extensions`
2. Turn on Developer mode
3. Click Load unpacked and select the `extension` folder

## Permissions

Chrome says this extension can read and change your data on all websites. That is
what running on every page costs, and running on every page is the only way to
put a name back after a reload. Every tab renamer needs it.

What the code does with that access is set `document.title`. It does not read
page content, forms, or browsing history. It makes no network requests: there is
no `fetch`, `XMLHttpRequest` or `WebSocket` in the package. Nothing is collected
or stored on disk. See [PRIVACY.md](PRIVACY.md).

`content.js` is the file that touches web pages. It is worth the two minutes.

To check that the published build is exactly this source:

```bash
./tools/verify_release.sh <extension-id>
```

## How it works

`content.js` runs on every page at `document_start`, asks the worker whether this
tab has a name, and sets the title before the page writes its own, so a reload
does not flicker. A `MutationObserver` puts the name back whenever the site
rewrites the title, which sites do for unread counters and in-app navigation.

Names live in `chrome.storage.session`, keyed by tab id, and are dropped when the
tab closes or Chrome quits.

## Limits

- Chrome pages, the new tab page and the Web Store cannot be renamed. The toolbar
  icon flashes red there.
- Names do not survive a Chrome restart, because tab ids do not either.
- Local files need "Allow access to file URLs" turned on.

## Build

```bash
./build.sh
```

Writes `dist/rename-tab-<version>.zip` for the Chrome Web Store. To release, bump
`version` in `extension/manifest.json` first.
