<div align="center">
  <img src="./images/logo.png" width="280" alt="TypePilot Logo"/>
  <h1>TypePilot - AI Writing Assistant</h1>
  <img src="https://img.shields.io/badge/version-1.2.0-6c63ff?style=flat-square" alt="Version 1.2.0"/>
  <img src="https://img.shields.io/badge/manifest-v3-blue?style=flat-square" alt="Manifest V3"/>
  <img src="https://img.shields.io/badge/powered%20by-Gemini-orange?style=flat-square" alt="Powered by Gemini"/>
</div>

TypePilot is a lightweight Manifest V3 Chrome extension that corrects and transforms selected text directly inside editable browser fields. Fix remains the one-click primary action, while the dropdown adds rewriting, English translation, shortening, and tone changes.

TypePilot uses your own Google Gemini API key and communicates directly from the browser to Google. There is no TypePilot backend or intermediate proxy.

## What's New in 1.2.0

- A split Fix control keeps correction one click away and places the additional writing actions in a compact dropdown.
- Each request returns one focused result for faster responses and lower token usage.
- Personal Dictionary protects names, brands, product codes, and specialist terms.
- Repeated requests can return instantly from a short-lived in-memory cache.
- Active requests are cancelled when the TypePilot UI is dismissed.
- Transient rate-limit, network, and server failures receive one automatic retry.
- Text replacement is more reliable in contenteditable editors, React-controlled fields, and Shadow DOM components.
- The result panel now reports the model, tokens, response time, and cache status.

## Writing Actions

| Action | Result |
|---|---|
| Fix | Corrects spelling, grammar, punctuation, and syntax while preserving meaning and language. |
| Rewrite | Improves clarity, flow, and natural phrasing. |
| Translate to English | Produces a natural English translation while preserving facts and formatting. |
| Shorten | Makes the text more concise without removing essential information. |
| Formal tone | Rewrites the text in a clear, professional tone. |
| Friendly tone | Rewrites the text in a warm, natural tone. |

## Features

- One-click correction with five additional actions in the dropdown.
- Structured JSON responses enforced through the Gemini API schema.
- Compatible Gemini model picker, including Gemini 3.1 Flash-Lite and Gemini 3.5 Flash when available.
- Custom writing instructions shared by all actions.
- Personal Dictionary with one protected term per line.
- Result caching, cancellation, and automatic transient-error retry.
- Model, token usage, response time, and cache details in the information panel.
- Support for standard inputs, textareas, contenteditable editors, and Shadow DOM fields.
- Local settings storage and direct browser-to-Google requests.

## Installation

1. Download or clone this repository.
2. Open `chrome://extensions/` in Chrome.
3. Enable Developer mode.
4. Select Load unpacked.
5. Choose the TypePilot project folder.
6. Pin TypePilot to the Chrome toolbar.

## Configuration

1. Open TypePilot Settings from the toolbar icon.
2. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/app/apikey).
3. Enter the key in TypePilot.
4. Choose an available Gemini text model.
5. Optionally customize the writing instructions and Personal Dictionary.
6. Save the settings.
7. Reload any website tabs that were open before the extension was installed or updated.

Gemini 2.5 Flash-Lite remains the compatibility fallback. Gemini 3.1 Flash-Lite is optimized for speed, while Gemini 3.5 Flash is intended for higher-quality output when those models are available to the API key.

## Usage

1. Select text inside a supported editable field.
2. Click Fix for immediate correction.
3. Open the arrow on the right to choose Rewrite, Translate to English, Shorten, Formal tone, or Friendly tone.
4. Click the returned result to replace the selected text.
5. Open the information icon to view the model, token usage, response time, and cache status.

## Privacy

The API key, selected model, writing instructions, and Personal Dictionary are stored in `chrome.storage.local`. Access is restricted to trusted extension contexts when supported by Chromium.

The selected text and relevant writing settings are sent directly to Google only when TypePilot makes a Gemini API request. No TypePilot backend or third-party proxy receives them.

## Credits

- Created by [KyriakosGian](https://github.com/KyriakosGian)
- Project page: [miniapps.gr/TypePilotAi](https://miniapps.gr/TypePilotAi)
- Supported by [ProCreta.gr](https://procreta.gr)

See [CHANGELOG.md](CHANGELOG.md) for the version history.
