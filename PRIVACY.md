# Privacy Policy for Rename Tab

Last updated: 17 September 2026

Rename Tab does not collect, store, transmit, or sell any data.

- No analytics, telemetry, crash reporting, or advertising.
- No network requests of any kind. There is no server.
- No accounts, cookies, or identifiers.
- Nothing is written to disk. Names stay in memory until Chrome closes.

The title you type stays in the memory of the page you typed it on. Reloading or
leaving that page discards it.

The extension requests two permissions, both used only when you press a shortcut
or click its toolbar icon:

**activeTab** gives temporary access to the tab you are viewing, so its title can
be changed. Chrome grants this only in response to your action and revokes it
when you navigate away.

**scripting** is required to run the rename code inside that tab.

One further permission is optional and off unless you turn it on:

**Access to a single site** is requested only when you press "Keep names on"
that site. Chrome revokes normal access the moment a page reloads, so this is the
only way to put your name back afterwards. The prompt names that one site, and
permission is never requested for all sites. It is used for nothing else: the
code reads and writes the tab title and never touches page content. Revoke it
from the popup or the about page, which also clears the names kept for it.

Contact: chetan.patteparapu@gmail.com
