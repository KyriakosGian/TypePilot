# AGENTS.md

This file provides general guidance to AI coding assistants working in this repository.

## Privacy Rule

Never reuse private user context in source files, placeholders, examples, tests, documentation, logs, screenshots, or commits. Use neutral fictional data and scan changed files for personal-data leakage before completion.

## Project Overview

TypePilot is a Chrome Extension using Manifest V3. It is a real-time AI writing assistant powered by the Google Gemini API and a Bring Your Own Key model. The extension communicates directly with Google without an intermediate backend.

Current version: 1.2.0

## Development

There is no build process or dependency installation. Load this directory as an unpacked extension from `chrome://extensions/`. Reload the extension and any existing test tab after changes.

All source files are plain JavaScript and CSS. `background.js` is an ES module service worker. The other scripts are classic scripts.

## File Roles

| File | Role |
|---|---|
| `manifest.json` | Extension configuration with only `storage` permission and Gemini host access |
| `background.js` | Settings cache, actions, Gemini calls, structured parsing, retry, cancellation, result cache, and error mapping |
| `content.js` | Selection detection, split Fix UI, action menu, result UI, and field replacement |
| `style.css` | Scoped injected UI styles |
| `options.html/js/css` | API key, model picker, writing instructions, and personal dictionary settings |
| `CHANGELOG.md` | Version history |

## Message Flow

```text
User selects editable text
  -> content.js shows the split Fix control
  -> Fix or a dropdown action sends TYPEPILOT_PROCESS with text, action, and requestId
  -> background.js reads cached settings
  -> identical recent requests return from the in-memory result cache
  -> POST to models/{model}:generateContent with x-goog-api-key
  -> Gemini returns schema-constrained JSON: { "result": "..." }
  -> background.js returns result, action, usage, model, durationMs, and cached
  -> content.js shows one result
  -> clicking the result replaces the saved selection
```

Closing the TypePilot UI sends `TYPEPILOT_CANCEL`. The service worker aborts the matching fetch when it is still active.

## Actions

The primary action is always `fix`. The dropdown contains:

- `rewrite`
- `translate`
- `shorten`
- `formal`
- `friendly`

Action labels, instructions, and temperatures are defined in `ACTIONS` in `background.js`. Each request returns one result.

## Selection Modes

- Native input or textarea uses `selectionStart`, `selectionEnd`, and the native value setter.
- Native fields inside Shadow DOM use `event.composedPath()[0]`, captured synchronously.
- Contenteditable fields use `window.getSelection()` and a cloned `Range`. Replacement prefers `document.execCommand("insertText")` with a Range fallback.

## Gemini Contract

The request uses `generationConfig.responseMimeType = "application/json"` and a `responseSchema` containing one required string field named `result`.

`maxOutputTokens` must remain at 4096 or higher. Lower limits previously caused truncated multilingual responses.

`callGeminiDirect()` returns `{ result, usage, model }`. The message listener adds action metadata, duration, and cache status.

## Error Codes

Stable error codes are `NO_TEXT`, `NO_KEY`, `INVALID_ACTION`, `INVALID_KEY`, `RATE_LIMIT`, `QUOTA_EXCEEDED`, `MODEL_NOT_FOUND`, `SAFETY_BLOCK`, `EMPTY_RESPONSE`, `PARSE_ERROR`, `TIMEOUT`, `CANCELLED`, `NETWORK_ERROR`, `SERVER_ERROR`, `HTTP_ERROR`, and `UNKNOWN`.

Only `RATE_LIMIT`, `SERVER_ERROR`, and `NETWORK_ERROR` receive one automatic retry. Retriable errors can still show a manual Try Again button.

## Storage Keys

- `geminiApiKey`
- `geminiModel`, default `gemini-2.5-flash-lite`
- `systemPrompt`
- `personalDictionary`

The local storage area is restricted to trusted extension contexts when supported by Chromium.

## Constraints

- Preserve direct browser-to-Google BYOK communication.
- Keep `gemini-2.5-flash-lite` as the primary compatibility fallback.
- Do not add a backend proxy.
- Do not use `unsafe-eval` or remotely hosted executable code.
- Guard content-script `chrome.runtime` calls against extension-context invalidation.
- Capture `event.composedPath()` synchronously for Shadow DOM event handling.
- Use `textContent` for all user-derived content. Static SVG markup may use `innerHTML`.
- Keep all injected CSS selectors and custom properties scoped with TypePilot or `--lf-` prefixes.
