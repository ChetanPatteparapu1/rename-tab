# Notes for IT and security teams

**Extension ID:** filled in once published
**Source:** https://github.com/ChetanPatteparapu1/rename-tab

## What it does

Renames the tab the user is currently viewing, and restores the original title.
It runs only when the user presses a keyboard shortcut or clicks its icon.

## Permissions

| Permission | What it grants | What the code does with it |
| --- | --- | --- |
| `<all_urls>` host access | Runs `content.js` on every page at `document_start` | Reads and writes `document.title`. Nothing else. It does not read page content, forms, or history |
| `scripting` | Running the extension's own bundled script | No remote or downloaded code exists in the package |
| `storage` | Session memory holding the names of currently renamed tabs | Cleared when Chrome closes. Nothing on disk |

There is no `tabs`, `webRequest`, `cookies`, `history`, or `nativeMessaging`
permission.

Chrome shows **"Read and change all your data on all websites"** at install. That
is an accurate statement of capability and it is unavoidable for this feature:
restoring a tab title after a reload means running on the page that loaded, and
Chrome provides no narrower mechanism. Every extension in this category carries
the same permission.

What should lower your risk assessment is not the wording but the code. It is
small, unminified, has no build step, and can be checked against the published
build in one command.

To restrict it to an allowlist of sites, use policy:

```json
{
  "ExtensionSettings": {
    "<extension-id>": {
      "runtime_blocked_hosts": ["*://*/*"],
      "runtime_allowed_hosts": ["*://*.your-company.com"]
    }
  }
}
```

The extension keeps working on allowed hosts and does nothing on the rest.

## Verify it yourself

```bash
git clone https://github.com/ChetanPatteparapu1/rename-tab && cd rename-tab

# Confirm the published build matches this source
./tools/verify_release.sh <extension-id>

# Confirm there is no network traffic and no dynamic code
grep -rE 'fetch\(|XMLHttpRequest|WebSocket|eval\(|new Function|https?://' extension/
```

The second command returns exactly one line: the link to this repository on the
about page. There is no `fetch`, `XMLHttpRequest` or `WebSocket` in the package,
so the extension has no way to send anything anywhere. It is about 540 lines of
plain JavaScript with no build step, and `content.js` is the only file that
touches web pages.

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
