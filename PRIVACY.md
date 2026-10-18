# TypePilot Privacy Policy

Effective date: October 18, 2026

TypePilot is a Chrome extension that corrects and transforms text selected by the user. It uses the Google Gemini API with an API key supplied by the user.

## Data TypePilot Handles

TypePilot handles the following data only to provide its writing features:

- Text that the user selects and explicitly submits through Fix, Rewrite, Translate, Shorten, Post for X, Formal tone, or Friendly tone.
- The original selected text and editor text saved temporarily before a replacement for Recovery.
- The user's Google Gemini API key.
- The selected Gemini model.
- The selected translation language.
- Custom writing instructions.
- Personal Dictionary terms supplied by the user.
- Gemini response text and request metadata, such as token counts, model name, response time, and cache status.

TypePilot does not collect browsing history, visited URLs, advertising identifiers, payment information, or analytics data.

## How Data Is Used

The selected text, writing instructions, Personal Dictionary terms, selected model, selected translation language, and API key are used only to perform the writing action requested by the user.

TypePilot does not use user data for advertising, profiling, creditworthiness, or any purpose unrelated to its writing features. TypePilot does not sell user data.

## Data Storage

The API key, selected model, translation language, writing instructions, and Personal Dictionary are stored locally in `chrome.storage.local` on the user's device.

Before replacing text, TypePilot stores the original selection and editor text in `chrome.storage.session`. Recovery keeps at most five backups and lets the user select and copy any original or clear all backups. Editors over 100,000 characters use manual copying instead of silently truncating the original. Backups clear when the browser restarts or the extension is disabled, reloaded, or updated. Recovery reads and deletion are restricted to TypePilot Settings. Recovery backups are not sent to Google unless the user later selects and explicitly submits that text as a new writing request.

For Post for X, surrounding editor text is used locally to validate the complete post's length and preserve its links and mentions. Gemini receives the selected text and a numeric character budget, not the unselected surrounding text. One additional request may be sent if the first generated post fails local validation.

TypePilot changes the system clipboard only when the user explicitly clicks Copy result or Copy Original. It does not read the clipboard.

Completed results may remain temporarily in the extension service worker's in-memory cache for up to five minutes to speed up identical repeated requests. The cache holds at most 50 results, is not written to persistent storage, and is cleared when the service worker terminates.

TypePilot does not operate a backend server and does not maintain a remote user database.

## Data Transmission

When the user explicitly starts a writing action, TypePilot sends the required request directly from the browser to the Google Gemini API at `generativelanguage.googleapis.com` over HTTPS. This request can contain:

- The selected text.
- The chosen writing action.
- Custom writing instructions.
- Personal Dictionary terms.
- The selected Gemini model.
- The selected translation language when the user requests a translation.
- The user's Gemini API key for authentication.

TypePilot does not send this data to the TypePilot developer or to an intermediate proxy. Google's handling of data is governed by the applicable [Google Privacy Policy](https://policies.google.com/privacy) and Gemini API terms.

## Permissions

TypePilot requests only the permissions required for its single purpose:

- `storage` stores the user's settings locally.
- Access to `https://generativelanguage.googleapis.com/*` allows direct communication with the Google Gemini API.
- The content script runs on matching webpages and permitted frames to detect editable selections locally. Text is sent to Gemini only when the user explicitly chooses an action or invokes the Fix shortcut.

## Data Sharing

TypePilot shares request data only with Google when necessary to provide the user-requested Gemini writing action. TypePilot does not share data with advertisers, data brokers, or unrelated third parties.

TypePilot's use and transfer of user data complies with the Chrome Web Store User Data Policy, including its Limited Use requirements.

## User Control and Deletion

Users can replace their API key, choose a translation language, edit or clear their Personal Dictionary, select and copy any Recovery backup, and clear all Recovery backups from TypePilot Settings. Users can delete locally stored TypePilot data by clearing the extension's data in Chrome or uninstalling the extension.

Closing the TypePilot interface cancels an active request when cancellation is still possible.

## Security

TypePilot communicates with the Google Gemini API over HTTPS. The API key is not embedded in the extension package and is supplied by each user. Access to local extension storage is restricted to trusted extension contexts when supported by Chromium.

## Changes to This Policy

This policy may be updated when TypePilot's functionality or data practices change. The effective date at the top of this page will be updated when changes are published.

## Contact

For privacy questions or support, use the public [TypePilot GitHub repository](https://github.com/KyriakosGian/TypePilot/issues).
