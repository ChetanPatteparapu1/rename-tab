# Rename Tab

A Chrome extension that renames the current tab from the keyboard.

| Shortcut | Action |
| --- | --- |
| `⌥R` on Mac, `Alt+R` on Windows | Rename the current tab |
| `⌥U` on Mac, `Alt+U` on Windows | Restore the original title |

Press the shortcut, type a name, press Enter. Both keys can be remapped at
`chrome://extensions/shortcuts`.

## Install from source

1. Open `chrome://extensions`
2. Turn on Developer mode
3. Click Load unpacked and select the `extension` folder

## Privacy

No data is collected, stored, or transmitted. The extension makes no network
requests, and a fresh install holds no host permissions, so Chrome shows no site
access warning. See [PRIVACY.md](PRIVACY.md), or [ENTERPRISE.md](ENTERPRISE.md)
if you are reviewing it for a company.

You do not have to take that on trust. This command downloads the package
published on the Chrome Web Store and compares it against this source:

```bash
./tools/verify_release.sh <extension-id>
```

## Keeping names after a reload

Chrome revokes `activeTab` as soon as a page navigates, so by default a renamed
tab returns to its own title on reload. Restoring it afterwards needs host
permission, and the trick is to ask for one site rather than all of them.

The popup offers "Keep names on example.com" while you are on that site. Chrome
prompts for that origin alone, so the wording names the single site instead of
every website you visit. Grant it once per site you care about, which for most
people is three or four. The about page lists what has been granted and revokes
it.

With permission in hand, the worker keeps each name in `chrome.storage.session`
and reapplies it as the page loads. Names are dropped when the tab closes, when
it moves to a different site, and when Chrome quits.

## How it works

A keyboard shortcut wakes the service worker, which injects a short script into
the active tab. That script sets the page title and watches for the site
overwriting it, which sites do for unread counters and in app navigation.

The rename box is drawn in a closed shadow root and styled through JavaScript
rather than a stylesheet, so strict sites cannot block or restyle it.

## Limits

These come from Chrome and apply to every extension:

- Names disappear on reload until you allow the extension on that site. See
  below.
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
