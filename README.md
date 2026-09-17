# Rename Tab

A Chrome extension that renames the current tab from the keyboard.

| Shortcut | Action |
| --- | --- |
| `⌥⇧R` (`Alt+Shift+R`) | Rename the current tab |
| `⌥⇧D` (`Alt+Shift+D`) | Restore the original title |

Press the shortcut, type a name, press Enter. Both keys can be remapped at
`chrome://extensions/shortcuts`.

## Install from source

1. Open `chrome://extensions`
2. Turn on Developer mode
3. Click Load unpacked and select the `extension` folder

## Privacy

No data is collected, stored, or transmitted. The extension makes no network
requests and holds no host permissions, so it cannot read the pages you visit.
See [PRIVACY.md](PRIVACY.md), or [ENTERPRISE.md](ENTERPRISE.md) if you are
reviewing it for a company.

You do not have to take that on trust. This command downloads the package
published on the Chrome Web Store and compares it against this source:

```bash
./tools/verify_release.sh <extension-id>
```

## How it works

A keyboard shortcut wakes the service worker, which injects a short script into
the active tab. That script sets the page title and watches for the site
overwriting it, which sites do for unread counters and in app navigation.

The rename box is drawn in a closed shadow root and styled through JavaScript
rather than a stylesheet, so strict sites cannot block or restyle it.

## Limits

These come from Chrome and apply to every extension:

- The original title returns on reload. Keeping a name across reloads would
  require permission to read every site you visit, which is not worth it.
- Chrome pages, the new tab page and the Web Store cannot be renamed. The
  toolbar icon flashes red on those.
- Local files need "Allow access to file URLs" turned on.

## Repository layout

```
extension/      the extension, and the folder to load or zip
tools/          icon renderer, screenshot sizer, release verifier
build.sh        writes dist/rename-tab-<version>.zip for the Web Store
```

## Releasing

Bump `version` in `extension/manifest.json`, run `./build.sh`, upload the zip.
