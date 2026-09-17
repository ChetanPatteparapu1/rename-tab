# Rename Tab

A Chrome extension that renames the current tab from the keyboard.

| Shortcut | Action |
| --- | --- |
| `⌥R` on Mac, `Alt+R` on Windows | Rename the current tab |
| `⌥U` on Mac, `Alt+U` on Windows | Restore the original title |

Press the shortcut, type a name, press Enter. The name stays through reloads and
through navigation within that tab, until you clear it or close the tab. Both
keys can be remapped at `chrome://extensions/shortcuts`.

## Install from source

1. Open `chrome://extensions`
2. Turn on Developer mode
3. Click Load unpacked and select the `extension` folder

## Privacy

No data is collected, stored, or transmitted. The extension makes no network
requests, and there is no HTTP URL anywhere in the package.

Chrome will tell you at install that it can **read and change all your data on
all websites**. That is the price of running on every page, and running on every
page is the only way any extension can put a name back after a reload. What the
code does with that access is set `document.title`. Nothing else. `content.js` is
the file to read, and it is short.

See [PRIVACY.md](PRIVACY.md), or [ENTERPRISE.md](ENTERPRISE.md) if you are
reviewing it for a company.

You do not have to take that on trust. This command downloads the package
published on the Chrome Web Store and compares it against this source:

```bash
./tools/verify_release.sh <extension-id>
```

## How it works

`content.js` runs on every page at `document_start`. It asks the worker whether
this tab has a name and, if so, sets the title before the page has written its
own, which is why a reload does not flicker. A `MutationObserver` then puts the
name back whenever the site rewrites the title, as sites do for unread counters
and during in-app navigation.

The worker keeps names in `chrome.storage.session`, keyed by tab id. They are
dropped when the tab closes and when Chrome quits.

The rename box is drawn in a closed shadow root and styled through JavaScript
rather than a stylesheet, so strict sites cannot block or restyle it.

## Limits

These come from Chrome and apply to every extension:

- Names are gone when Chrome restarts, because tab ids do not survive a restart.
- Chrome pages, the new tab page and the Web Store cannot be renamed. The
  toolbar icon flashes red on those.
- Local files need "Allow access to file URLs" turned on.

## Repository layout

```
extension/      the extension, and the folder to load or zip
  content.js    runs on each page: the dialog, and holding the title
tools/          icon renderer, screenshot sizer, release verifier
build.sh        writes dist/rename-tab-<version>.zip for the Web Store
```

## Releasing

Bump `version` in `extension/manifest.json`, run `./build.sh`, upload the zip.
