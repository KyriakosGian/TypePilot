# TypePilot Privacy Policy

Effective date: October 18, 2026

TypePilot is a Chrome extension that corrects and transforms work-related text selected by the user. It uses the Google Gemini API with an API key supplied by the user. Google's API terms require adult, professional or business use and eligible regional access. The extension is free, but Google API access is separate. Google's terms require Paid Services for API clients made available in the EEA, Switzerland, or the UK. See the [Gemini API terms](https://ai.google.dev/gemini-api/terms) and [pricing](https://ai.google.dev/gemini-api/docs/pricing).

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

TypePilot does not collect browsing history, visited-page URL logs, advertising identifiers, or analytics. It does not request payment details, geolocation, medical records, website passwords, or cookies. User-provided drafts, settings, and original editor backups can nevertheless contain names, communications, addresses, health or financial details, or other personal information. TypePilot does not filter these categories out. Editable-field selection, pointer, and keyboard events are processed locally to show the writing controls, not to build activity logs or profiles.

## How Data Is Used

The selected text, writing instructions, Personal Dictionary terms, selected model, selected translation language, and API key are used to perform the writing action requested by the user. Settings also uses the API key to authenticate a model-discovery request to Google. Original editor text and selection events support local replacement checks and Recovery.

TypePilot does not use user data for advertising, profiling, creditworthiness, or any purpose unrelated to its writing features. TypePilot does not sell user data.

## Data Storage

The API key, selected model, translation language, writing instructions, and Personal Dictionary are stored locally in `chrome.storage.local` on the user's device.

Before replacing text, TypePilot stores the original selection and editor text in `chrome.storage.session`. Recovery keeps at most five backups and lets the user select and copy any original or clear all backups. Editors over 100,000 characters use manual copying instead of silently truncating the original. Backups clear when the browser restarts or the extension is disabled, reloaded, or updated. Recovery reads and deletion are restricted to TypePilot Settings. Recovery backups are not sent to Google unless the user later selects and explicitly submits that text as a new writing request.

For Post for X, surrounding editor text is used locally to validate the complete post's length and preserve its links and mentions. Gemini receives the selected text and a numeric character budget, not the unselected surrounding text. One additional request may be sent if the first generated post fails local validation.

TypePilot changes the system clipboard only when the user explicitly clicks Copy result or Copy Original. It does not read the clipboard.

The service worker's in-memory cache can hold submitted text, writing settings, local X-post context, generated results, and request metadata for at most 50 entries. Results are eligible for reuse for five minutes. Age is checked when an entry is looked up, not by a timed deletion job, so an expired entry may remain in memory until that lookup, eviction, a relevant settings change, or service-worker termination. The cache is not written to persistent storage. X-post context held in a cache key remains local and is not included in the Gemini request.

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

When Settings loads or validates a supplied API key, it can also send an HTTPS request to Google's models-list endpoint with the API key in an authentication header. This request does not include selected text, writing instructions, or Personal Dictionary terms. It can occur independently of a writing action.

TypePilot does not send this data to the TypePilot developer or to an intermediate proxy. Google receives connection metadata, such as the requesting IP address, as part of providing its API. Google's handling of API inputs, outputs, and metadata is governed by the applicable [Google Privacy Policy](https://policies.google.com/privacy) and [Gemini API terms](https://ai.google.dev/gemini-api/terms). For unpaid services, those terms describe product-improvement processing and possible human review, with regional differences. Paid-service processing differs. Do not submit sensitive, confidential, or personal information to unpaid Gemini services.

## Permissions

TypePilot requests only the permissions required for its single purpose:

- `storage` stores the user's settings locally.
- Access to `https://generativelanguage.googleapis.com/*` allows direct communication with the Google Gemini API.
- The content script runs on matching webpages and permitted frames to detect editable selections locally. Text is sent to Gemini only when the user explicitly chooses an action or invokes the Fix shortcut.

## Data Sharing

TypePilot shares request data only with Google for writing actions and API-key/model discovery. TypePilot does not share data with advertisers, data brokers, or unrelated third parties. Google processes requests under the user's applicable API service terms, not under a promise that all data remains on the device.

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
