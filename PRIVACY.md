# Privacy Policy for Rename Tab

Last updated: 17 September 2026

Rename Tab does not collect, store, transmit, or sell any data.

- No analytics, telemetry, crash reporting, or advertising.
- No network requests of any kind. There is no server.
- No accounts, cookies, or identifiers.
- Nothing is written to disk. Names stay in memory until Chrome closes.

The names you set are held in memory and cleared when Chrome closes.

The extension requests these permissions:

**Access to the websites you visit.** Chrome words this as "read and change all
your data on all websites". It is needed because restoring a name after a reload
means running on the page that just loaded, and Chrome offers no narrower way to
do that. The code uses it to set the tab title and for nothing else. It does not
read page content, form fields, or your browsing history, and it makes no network
requests.

**scripting** is required to run that code.

**storage** holds the names of currently renamed tabs in memory. They are cleared
when Chrome closes.

The source is public, so the paragraph above is checkable rather than a promise:
https://github.com/ChetanPatteparapu1/rename-tab

Contact: chetan.patteparapu@gmail.com
