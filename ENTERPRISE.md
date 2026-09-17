# Notes for IT and security teams

**Extension ID:** filled in once published
**Source:** https://github.com/ChetanPatteparapu1/rename-tab

## What it does

Renames the tab the user is currently viewing, and restores the original title.
It runs only when the user presses a keyboard shortcut or clicks its icon.

## Permissions

| Permission | What it grants | What it does not grant |
| --- | --- | --- |
| `activeTab` | Access to one tab, only after the user presses the shortcut, revoked on navigation | Access to any other tab, or any access while idle |
| `scripting` | Running the extension's own bundled script in that tab | Running downloaded or remote code |

There are no host permissions. No `<all_urls>`, `tabs`, `webRequest`, `cookies`,
`history`, or `nativeMessaging`. Chrome shows no host access warning at install
because there is no host access.

## Data

Nothing is collected, transmitted, or written to disk. There are no analytics,
no telemetry, no accounts, and no network requests of any kind. The title a user
types lives in that page's memory until the page reloads.

## Verify it yourself

```bash
git clone https://github.com/ChetanPatteparapu1/rename-tab && cd rename-tab

# Confirm the published build matches this source
./tools/verify_release.sh <extension-id>

# Confirm there is no network traffic and no dynamic code
grep -rE 'fetch\(|XMLHttpRequest|WebSocket|eval\(|new Function|https?://' extension/
```

The second command returns nothing. There is no HTTP URL anywhere in the shipped
code. The extension is about 400 lines of plain JavaScript with no build step, so
reading all of it takes a few minutes.

## Deploying to a fleet

```json
{
  "ExtensionInstallForcelist": [
    "<extension-id>;https://clients2.google.com/service/update2/crx"
  ]
}
```

Windows: `HKLM\Software\Policies\Google\Chrome`.
macOS: managed preferences for `com.google.Chrome`.
Linux: `/etc/opt/chrome/policies/managed/`.
Or use Devices, Chrome, Apps and extensions in the admin console.

Use `ExtensionInstallAllowlist` with the same ID to permit rather than force it.
Policies such as `runtime_blocked_hosts` need no exception, because the extension
requests no hosts.

## Ongoing

Pin a version in policy if you require change control, and re-run
`verify_release.sh` after updates. The extension is maintained by its original
author. Any transfer of ownership will be announced in the repository first.
