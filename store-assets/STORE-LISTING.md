# TypePilot Chrome Web Store listing

Prepared for version 1.4.1. Copy only the text inside the relevant blocks into
the dashboard. This English listing matches the extension's English interface.
The 25 translation targets are writing features, not 25 localized interfaces.

## Published listing

Version 1.4.1 was published with Public visibility on October 22, 2026:
[TypePilot on the Chrome Web Store](https://chromewebstore.google.com/detail/typepilot/ggbcehbgoodblpdpjgglbhfnkmjmhdcm).
The description below is the reference copy for future maintenance. This
publication update does not change the Store package or its description.

## Name

The package supplies this field through `manifest.json`.

```text
TypePilot
```

## Short description

The package supplies this exact text through `manifest.json`. Do not replace it
only in this document. Chrome limits this field to 132 characters.

```text
Chrome extension to fix, rewrite, translate, shorten, adjust tone, and prepare X posts with your own Google Gemini API key.
```

## Detailed description

```text
TypePilot is a Chrome extension for correcting and improving work-related writing directly in supported website editors. Select text, click Fix, and review the suggestion before applying it. TypePilot uses Google Gemini with your own Gemini API key.

WRITING ACTIONS
Fix spelling, grammar, punctuation, and syntax. Rewrite for clarity, shorten a draft, switch to a formal or friendly tone, or translate into your preferred target language. Choose from 25 translation targets in Settings, including English, Greek, German, French, and Spanish. Fix stays on the main button. The other six actions are in the dropdown beside it.

POST FOR X
Prepare a standard X post within the 280-character limit. TypePilot checks the complete editor text, including text outside your selection, using the bundled twitter-text parser. It accounts for links and emoji, preserves original URLs and mentions, and can add up to two relevant hashtags. This feature prepares text only. It does not publish to X or operate a link-shortening service.

REVIEW, COPY, AND RECOVER
Click a suggestion to replace the selected text, or choose Copy result and paste it yourself. TypePilot checks that the original editor has not changed before applying a suggestion. Before replacement, Recovery temporarily saves the original editor text. Open Settings, choose one of the five latest backups, and select Copy Original. Backups stay on your device and clear when Chrome restarts or the extension is disabled, reloaded, or updated. Editors over 100,000 characters use manual copying instead of automatic replacement. Some editors may reject insertion, so review the result and use Copy result when needed.

PERSONAL SETTINGS
Choose an available Gemini text model, set your translation target, add custom writing instructions, and protect preferred spellings with Personal Dictionary. Invoke Fix with Ctrl+Shift+Y on Windows/Linux or Command+Shift+Y on Mac. You can customize the shortcut in Chrome's extension shortcut settings.

SETUP AND GOOGLE API COSTS
Install TypePilot, open its Settings, enter your own Gemini API key from Google AI Studio, choose an available text model, and save. Refresh website tabs that were open before installation. No TypePilot account or subscription is required. Google API access is separate and subject to Google's pricing, quotas, age requirements, supported regions, and terms. Free quota is not guaranteed. Google's current terms restrict API use to professional or business purposes, require users to be at least 18, and require Paid Services for API clients made available in the EEA, Switzerland, and the UK.

DATA AND PRIVACY
Your API key and preferences are stored locally. When you request a writing action, selected text, writing instructions, and Personal Dictionary terms go directly to Google over HTTPS. Google also receives the key to authenticate API requests, including model discovery in Settings. No TypePilot server receives your text or key. For Post for X, unselected surrounding text stays inside the extension for local validation. Recovery backups are local session data. TypePilot does not read your clipboard and writes to it only when you click a copy button. TypePilot has no advertising, browsing-history collection, or analytics. Google's processing of API requests depends on its applicable terms and service plan. Do not submit confidential or sensitive information to unpaid Gemini services. Read the linked Privacy Policy before use.

COMPATIBILITY
TypePilot supports standard text fields, textareas, and many contenteditable editors, including permitted frames. It does not work on Chrome system pages, the Chrome Web Store, closed Shadow DOM editors, or editors that do not expose usable browser selections. Site-specific compatibility may vary. AI suggestions can be incorrect. Review them before applying or publishing.

TypePilot is an independent open-source extension. It is not an official Google or X product and is not affiliated with or endorsed by either company.
```

## Dashboard listing fields

- Language: English.
- Category: the available writing/productivity category that best fits the dashboard's current choices.
- Homepage URL: https://kyriakosgian.github.io/TypePilot/
- Support URL: https://github.com/KyriakosGian/TypePilot/issues
- Privacy Policy URL: https://github.com/KyriakosGian/TypePilot/blob/main/PRIVACY.md
- Price of the extension: free. Google API usage is separate, not included.
- Mature content: no adult content is provided by TypePilot. This does not waive Google's separate 18+ API requirement.
- Promotional video: leave empty. No video has been prepared.
- Official URL verification: optional. Do not claim verified publisher status unless it is shown by the dashboard.

## Sources

Checked on October 18, 2026. Recheck these pages if submission is delayed.

- [Listing fields](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
- [Manifest description limit](https://developer.chrome.com/docs/extensions/reference/manifest/description)
- [Gemini API terms](https://ai.google.dev/gemini-api/terms)
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)

Use [SUBMISSION.md](SUBMISSION.md) for permissions, data disclosures, reviewer
instructions, image paths, and the final release gate. This file is not part of
the runtime ZIP.
