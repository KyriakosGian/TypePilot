# TypePilot Chrome Web Store submission

Version: 1.4.1. Prepared on October 18, 2026.

Publication update, October 22, 2026: version 1.4.1 was published with Public
visibility on the [Chrome Web Store](https://chromewebstore.google.com/detail/typepilot/ggbcehbgoodblpdpjgglbhfnkmjmhdcm).
Use this guide as a reference for future updates to that same Store item, not
as a reason to create a duplicate listing. Recheck the checklist for each new
submission. The account owner supplies private account details only inside
Google's dashboard. Never put credentials, addresses, or other private account
data in this public repository, screenshots, issues, or release assets.

## 1. Upload package and listing

- Package: `release/TypePilot-v1.4.1.zip`, not a ZIP of the repository.
- Expected SHA-256: `04816DBC9C03876D09FFF5101AAB34E0BC595059A5AE1866985FC2BD8CC6225C`.
- Copy the listing fields from [STORE-LISTING.md](STORE-LISTING.md).
- Run `node scripts/check-store.cjs` before using this package.
- The ZIP contains the manifest at its root and runtime files only, plus privacy and licensing documents. Store texts and screenshots are separate dashboard uploads.

## 2. Image uploads

Paths below are relative to `store-assets/`.

| Dashboard field | File | Dimensions |
|---|---|---|
| Store icon | `icon-128.png` | 128 x 128 |
| Small promotional tile | `small-promo-440x280.png` | 440 x 280 |
| Optional marquee | `marquee-1400x560.png` | 1400 x 560 |
| Screenshot 1 | `screenshots/01-fix-control-1280x800.png` | 1280 x 800 |
| Screenshot 2 | `screenshots/02-actions-menu-1280x800.png` | 1280 x 800 |
| Screenshot 3 | `screenshots/03-result-1280x800.png` | 1280 x 800 |
| Screenshot 4 | `screenshots/04-settings-1280x800.png` | 1280 x 800 |
| Screenshot 5 | `screenshots/05-personal-dictionary-1280x800.png` | 1280 x 800 |

Upload the screenshots in numeric order. They show the actual unpacked
interface with fictional text and mocked Gemini responses, not evidence of a
live-site or live-API test. Do not upload the master images or demo HTML.

## 3. Privacy practices: single purpose

Copy this into the single-purpose description field:

```text
Help adult users correct and improve work-related text they select in supported webpage editors through user-requested Google Gemini writing actions. Fix, rewrite, translation, shortening, tone changes, and X-post preparation serve that writing purpose. Copy result and temporary local Recovery support safe text replacement.
```

## 4. Permission justifications

The only named API permission is `storage`. The Gemini host and broad content
script matches must also be explained, even if the dashboard groups them under
a single host-permissions field. Do not claim that website access is limited to
the Gemini API. The content script runs on permitted matching webpages.

### storage

```text
Store the user's Gemini API key, chosen model, translation target, writing instructions, and Personal Dictionary locally. Session storage holds up to five original editor backups for Recovery before user-approved replacements. Recovery can be cleared in Settings and is not persisted across browser restarts. Local storage access is restricted to trusted extension contexts when supported by Chrome.
```

### https://generativelanguage.googleapis.com/*

```text
Send user-requested writing tasks directly to the Google Gemini API over HTTPS using the user's own API key. Requests include the selected text and applicable writing settings. Settings also uses this host to authenticate the supplied key and discover available text models. No TypePilot backend or proxy is involved.
```

### Broad webpage access from content_scripts.matches: <all_urls>

```text
Provide the writing control inside supported editors on the websites the user chooses, without maintaining a site allowlist. The packaged content script detects editable selections locally and inserts a suggestion only when the user chooses it. It also runs in permitted matching frames. It does not collect browsing history, visited-page URLs, or page-wide text. Only text explicitly submitted for a writing action and the applicable writing settings go to Gemini. Original editor text and X-post context stay locally in the extension for Recovery and validation. Chrome's restricted pages are not supported.
```

### Remote code

Select the dashboard option indicating that the extension does not execute
remotely hosted code. If an explanation field is available, use:

```text
All executable JavaScript is bundled in the extension, including the pinned twitter-text parser. There is no eval, new Function, remote script, or remotely loaded WebAssembly. Gemini returns schema-constrained JSON containing a text result. That text is displayed as text, never executed as code or rendered as user-controlled HTML.
```

Clipboard copying uses an explicit user gesture. The extension requests neither
clipboardRead nor clipboardWrite permission. The Fix shortcut uses the
manifest commands entry, not an additional permission.

## 5. Data-use disclosures

Do not select "no user data". Local processing also counts as handling data
under Google's User Data FAQ. Sending text directly to Google is still a data
transfer, even though the TypePilot developer never receives it.

The following conservative mapping covers unrestricted user-entered text,
custom instructions, dictionary entries, temporary editor backups, and local
selection handling. It does not imply that TypePilot extracts sensitive fields
from unrelated parts of a webpage. Check the dashboard's current definitions
before confirming the selections.

| Data category | Prepared selection | What TypePilot actually handles |
|---|---|---|
| Website content | Yes | Selected editor text, generated results, and temporary original editor text. |
| Authentication information | Yes | User-supplied Gemini API key, stored locally and sent to Google for authentication. No website passwords or cookies are read. |
| Personal communications | Yes | Message or email drafts when the user chooses a writing action, plus local original backups. No inbox or contact import. |
| Personally identifiable information | Yes | Names, email addresses, usernames, or other identifiers if present in user-provided text or settings. No profile extraction. |
| Health information | Yes, user-provided text only | Such text is not filtered out if the user includes it. No health-service integration. Users should not submit sensitive content to unpaid Gemini services. |
| Financial and payment information | Yes, user-provided text only | Such text is not filtered out if the user includes it. No payment processing or bank integration. |
| Location | Yes, user-provided text only | A place or address may be part of a draft. No geolocation API or location tracking. Google also receives connection metadata under its own terms. |
| User activity | Yes, local editor interaction only | Selection, pointer, and keyboard events needed to show the writing control. No analytics, behavioral profiles, or remote event stream. |
| Web history | No | No browsing-history API, visited-page log, or collection of page URLs as browsing history. URLs included in user-authored drafts are text content. |

Use the privacy policy URL in the dashboard's dedicated privacy-policy field:

```text
https://github.com/KyriakosGian/TypePilot/blob/main/PRIVACY.md
```

Confirm the limited-use certifications only while they remain true: TypePilot
does not sell user data, transfer it for unrelated purposes, use it for
advertising, or use it for credit or lending decisions. Necessary direct
transfer to Google for the writing action must remain disclosed. Do not claim
that data stays entirely on the device or that Google never retains or uses
prompts. Google's separate terms vary by plan and region.

## 6. Private test instructions for Google reviewers

The first submission's review completed with publication on October 22, 2026.
Revoke any temporary reviewer key privately if it is no longer needed. For a
future submission, decide whether to provide a separate review key and test it
before sharing it. The Store's private Additional instructions field currently
allows 500 characters. Use this short copy only when a working key is actually
provided in its private password field:

```text
No TypePilot login. The password field contains a Gemini API key for review. Paste it into TypePilot Settings, choose an available model and save. Open https://kyriakosgian.github.io/TypePilot/store-assets/demo-page.html, select text and click Fix. Apply the result or use Copy result. Test the other menu actions, change the translation language in Settings, and check Recovery after replacement. Chrome system pages are unsupported.
```

No TypePilot login is required. A working Gemini API key is required to obtain
real suggestions. If reviewer credentials are needed, the account owner must
provide a separate, limited review key only in the private Test instructions
tab. Never include a personal production key or a key in the public listing,
repository, screenshots, or support issues. Verify the review key's API
restrictions, model access, billing requirements, and quota before submission.
Revoke it after review if it is no longer needed. No review key is stored in
this repository.

The following longer procedure is a reference for the reviewer steps, not text
to paste into the 500-character field:

```text
TypePilot 1.4.1 uses a Bring Your Own Key connection to Google Gemini. There is no TypePilot account or login. Use a working Gemini API key supplied through the private reviewer credentials field, or a reviewer's own eligible key. No key is embedded in the extension.

1. Open TypePilot Settings from its toolbar icon. Enter the review key, wait for model discovery, choose an available text model, and save. Gemini 2.5 Flash-Lite is the compatibility fallback when available to the key.
2. Open https://kyriakosgian.github.io/TypePilot/store-assets/demo-page.html in a normal Chrome tab and refresh it after installation. This neutral demo has an editable message body and requires no sign-in. It does not send email or load a fake TypePilot implementation. The installed extension provides the writing controls.
3. Select the sentence containing "the timeline work for your team" in the message body and click Fix. A suggestion appears. Click the suggestion to apply it. Select the text again and test Rewrite, Translate, Shorten, Post for X, Formal tone, and Friendly tone from the arrow menu.
4. In Settings change the translation target to German, save, and confirm that the Translate menu label changes. Test a translation.
5. Choose Copy result to copy a suggestion without applying it. Open Settings > Recovery, choose a backup, and click Copy Original. Clear Backups removes all temporary originals.
6. Select text and press Ctrl+Shift+Y on Windows/Linux or Command+Shift+Y on Mac. If another extension has the shortcut, change it at chrome://extensions/shortcuts.
7. To test X-post preparation, replace the demo message body with a draft longer than 280 characters and select the whole draft. Post for X should return a validated post within the standard limit or an explicit validation error, without cutting URLs or mentions. It never publishes to X.
8. Start Fix and change the editor text before applying the returned suggestion. TypePilot should refuse to overwrite the changed draft and keep Copy result available.

The toolbar icon opens Settings, not a writing popup. A writing action requires selected text in a supported editable field. Chrome system pages and the Chrome Web Store are intentionally unsupported. Google quota, invalid-key, and unavailable-model errors are displayed to the user. A different available model or a key with valid quota may be needed.
```

The public demo is a fictional editor fixture, not an email service. Its Send
button has no sending behavior. Use fictional text only during testing.

## 7. Google API eligibility and distribution gate

Google's terms checked on October 18, 2026 specify adult, professional or
business use and supported-region restrictions. They require Paid Services
when API clients are made available in the EEA, Switzerland, or the UK.
"Free extension" does not mean free Google API access. Do not market unlimited
or universally free Gemini use, bypass region restrictions, or target minors.
For unpaid Gemini services, Google describes model-improvement processing and
possible human review, with regional differences. A BYOK key does not remove
these conditions. This guide does not certify legal compliance or approval.

Before selecting Public, choose the intended supported regions and confirm
that the service and intended audience comply with Google's applicable terms.
If distribution scope or the product's consumer/professional positioning needs
to change, resolve that choice before submission, not after publication.

## 8. Checklist for each future submission

The initial 1.4.1 submission is complete and public. Recheck these items for
future updates. Unchecked items are not a statement that publication is pending.

- [x] Source README, website, privacy policy, listing, Settings, and the GitHub About release configuration distinguish the free extension from Google API costs and eligibility. Verify the deployed copies again before submitting.
- [x] The privacy policy describes independent Settings model-discovery requests and actual cache retention. Version 1.4.1 uses a new package, leaving the public 1.4.0 asset unchanged. See [AUDIT.md](AUDIT.md).
- [ ] Real Gemini calls succeed with the intended API project and an available model. The automated tests mock Gemini and cannot certify quota or billing.
- [ ] Manual tests in the intended X, Gmail, and WordPress editors pass with fictional text, including replacement, changed-draft refusal, Copy result, and Recovery.
- [ ] Run `node --test tests/regression.test.cjs` and `node tests/browser.cjs` using an available Playwright Chromium.
- [ ] Run `node scripts/check-store.cjs`. Check that the ZIP hash matches both `release/SHA256SUMS.txt` and this guide. Do not overwrite an already public release asset.
- [ ] Confirm homepage, support, and privacy URLs work without signing in and show the intended published content.
- [ ] Complete the dashboard's actual listing, data-use fields, and permission justifications using the prepared texts. Review any new fields added by Google.
- [ ] Confirm any review key privately. Do not submit test placeholders as working credentials.
- [ ] The account owner confirms contact email, two-step verification, publisher/trader declarations, and any required private account details in Google's dashboard. Do not copy them into project files.
- [ ] Choose intended geographic distribution and visibility. Check account-specific warnings before submitting.
- [ ] Get the account owner's explicit approval before clicking Submit for review or changing publication timing. Preparing these files does not authorize submission.

## Official references

- [Store listing](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
- [Image requirements](https://developer.chrome.com/docs/webstore/images)
- [Privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [User Data FAQ, including local processing](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Private test instructions](https://developer.chrome.com/docs/webstore/cws-dashboard-test-instructions)
- [Distribution settings](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution)
- [Gemini API terms](https://ai.google.dev/gemini-api/terms)
- [Gemini available regions](https://ai.google.dev/gemini-api/docs/available-regions)
