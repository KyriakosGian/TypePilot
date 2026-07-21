<div align="center">
  <img src="./images/logo.png" width="280" alt="TypePilot Logo"/>
  <h1>TypePilot - AI Writing Assistant</h1>
  <img src="https://img.shields.io/badge/version-1.2.0-6c63ff?style=flat-square" alt="Version 1.2.0"/>
  <img src="https://img.shields.io/badge/manifest-v3-blue?style=flat-square" alt="Manifest V3"/>
  <img src="https://img.shields.io/badge/powered%20by-Gemini-orange?style=flat-square" alt="Powered by Gemini"/>
</div>

TypePilot is a lightweight Chrome extension that corrects and transforms selected text with the Google Gemini API. It uses a Bring Your Own Key model and communicates directly with Google without an intermediate TypePilot server.

## Features

- Instant spelling, grammar, punctuation, and syntax correction.
- Split Fix control with Rewrite, Translate to English, Shorten, Formal tone, and Friendly tone actions.
- One focused result per request for lower latency and token usage.
- Structured JSON responses enforced through the Gemini API schema.
- Compatible Gemini model picker, including Gemini 3.1 Flash-Lite and Gemini 3.5 Flash when available.
- Personal dictionary for protected names, brands, product codes, and specialist terms.
- In-memory result cache for repeated requests.
- Automatic retry for one transient rate-limit, network, or server error.
- Request cancellation when the selection or TypePilot UI is dismissed.
- Model, token usage, response time, and cache status in the result information panel.
- Support for standard inputs, textareas, contenteditable editors, and Shadow DOM fields.

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
5. Optionally customize the writing instructions and personal dictionary.
6. Save the settings.
7. Reload any website tabs that were open before the extension was installed or updated.

Gemini 2.5 Flash-Lite remains the compatibility fallback. Gemini 3.1 Flash-Lite is optimized for speed, while Gemini 3.5 Flash is intended for higher-quality output when those models are available to the API key.

## Usage

1. Select text inside a supported editable field.
2. Click Fix for immediate correction.
3. Or open the arrow on the right and choose another writing action.
4. Click the returned result to replace the selected text.
5. Open the information icon to view the model, token usage, response time, and cache status.

## Privacy

The API key is stored in `chrome.storage.local` and restricted to trusted extension contexts. The key and selected text are sent directly to Google only when TypePilot makes a Gemini API request. No TypePilot backend or third-party proxy is used.

## Credits

- Created by [KyriakosGian](https://github.com/KyriakosGian)
- Project page: [miniapps.gr/TypePilotAi](https://miniapps.gr/TypePilotAi)
- Supported by [ProCreta.gr](https://procreta.gr)

See [CHANGELOG.md](CHANGELOG.md) for the version history.
