# Privacy Policy — Purrductivity

_Last updated: June 29, 2026_

Purrductivity is a focus-timer and website-blocker Chrome extension. Your
privacy matters, and the short version is simple:

**Purrductivity does not collect, transmit, sell, or share any personal data.
Everything stays on your own device.**

## What data the extension stores

Purrductivity stores the following **locally** in your browser using the Chrome
`storage` API. This data never leaves your computer and is not sent to us or any
third party:

- **Your block list** — the websites you choose to block during focus sessions.
- **Focus session state** — whether a session is active, its end time, whether
  Strict mode is on, and when a session last completed.

This information is used only to make the extension work (blocking sites and
running the timer). You can clear it at any time by removing the extension.

## What the extension does *not* do

- It does **not** collect personal or sensitive information.
- It does **not** track your browsing history.
- It does **not** use analytics, advertising, or tracking of any kind.
- It does **not** send any data to external servers.
- It does **not** read or modify the content of the web pages you visit.

## Why the extension requests its permissions

- **`storage`** — to save your block list and timer state locally.
- **`declarativeNetRequest`** + **host access (`<all_urls>`)** — to redirect the
  sites on *your* block list to the in-extension "focus" page while a session is
  active. The browser enforces these rules locally; Purrductivity never sees or
  records which sites you visit.
- **`alarms`** — to end your focus session when the timer runs out.
- **`notifications`** — to show a "focus complete" notification.

The optional content script that runs only on `localhost` / `127.0.0.1` exists
solely to let a locally-hosted companion web app start or stop a focus session.
It activates on no other websites.

## Changes to this policy

If this policy ever changes, the updated version will be posted at this same
location with a new "Last updated" date.

## Contact

Questions? Open an issue at
<https://github.com/byhannaai/Purrductivity/issues>.
