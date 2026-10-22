# AGENTS.md

This file provides general guidance to AI coding assistants working in this repository.

## Privacy Rule

Never reuse private user context in source files, placeholders, examples, tests, documentation, logs, screenshots, or commits. Use neutral fictional data and scan changed files for personal-data leakage before completion.

## Project Overview

TypePilot is a Chrome Extension using Manifest V3. It is a real-time AI writing assistant powered by the Google Gemini API and a Bring Your Own Key model. The extension communicates directly with Google without an intermediate backend.

Current version: 1.4.1

Public Chrome Web Store version: 1.4.1, published October 22, 2026.
Listing: https://chromewebstore.google.com/detail/typepilot/ggbcehbgoodblpdpjgglbhfnkmjmhdcm
Use the Store as the primary public installation route. Keep unpacked/ZIP
instructions for development. Documentation-only changes do not require a new
runtime package. Never overwrite already published release ZIPs.

## Development

There is no runtime build or dependency installation. Load this directory as an unpacked extension from `chrome://extensions/`. Reload the extension and any existing test tab after changes. Run `node --test tests/regression.test.cjs` for dependency-free regression checks. `tests/browser.cjs` uses an existing Playwright/Chromium installation with a temporary profile and mocked Gemini responses.

All source files are plain JavaScript and CSS. `background.js` is an ES module service worker. The other scripts are classic scripts.

## File Roles

| File | Role |
|---|---|
| `manifest.json` | Extension configuration with only `storage` permission and Gemini host access |
| `background.js` | Settings cache, actions, Gemini calls, X length enforcement, Recovery backups, retry, cancellation, result cache, and error mapping |
| `content.js` | Pointer and keyboard selection detection, split Fix UI, action menu, verified replacement, and rollback |
| `editor-state.js` | Immutable selection snapshots, paragraph-aware text offsets, and editor state validation |
| `x-post.js` | Whole-post validation using the locally bundled official twitter-text parser |
| `vendor/` | Pinned twitter-text distribution and third-party licenses, without dynamic eval |
| `style.css` | Scoped injected UI styles |
| `options.html/js/css` | API key, model picker, translation language, writing instructions, personal dictionary, and Recovery controls |
| `CHANGELOG.md` | Version history |
| `tests/` | Dependency-free regressions and real Chromium extension tests |
| `scripts/package.ps1` | Repeatable runtime ZIP and SHA-256 checksum generation |
| `scripts/check-store.cjs` | Read-only Store metadata, images, privacy-pattern, ZIP, and checksum checks |
| `store-assets/STORE-LISTING.md` | Copy-ready English Chrome Web Store description |
| `store-assets/SUBMISSION.md` | Permission and data disclosures, reviewer instructions, and manual submission gates |

## Message Flow

```text
User selects editable text
  -> content.js shows the split Fix control
  -> content.js requests the safe translation-language label through TYPEPILOT_GET_UI_SETTINGS
  -> Fix or a dropdown action sends TYPEPILOT_PROCESS with text, action, and requestId
  -> background.js reads cached settings
  -> identical recent requests return from the in-memory result cache
  -> POST to models/{model}:generateContent with x-goog-api-key
  -> Gemini returns schema-constrained JSON: { "result": "..." }
  -> background.js returns result, action, usage, model, durationMs, and cached
  -> content.js shows one result
  -> clicking the result stores a Recovery backup
  -> content.js replaces and verifies the saved selection
```

Closing the TypePilot UI sends `TYPEPILOT_CANCEL`. The service worker aborts the matching fetch when it is still active.

## Actions

The primary action is always `fix`. The dropdown contains:

- `rewrite`
- `translate`
- `shorten`
- `xpost`
- `formal`
- `friendly`

Action labels, instructions, and temperatures are defined in `ACTIONS` in `background.js`. Each request returns one result.

The `translate` action resolves its label and instruction from the validated `translationLanguage` setting. English is the fallback. Content scripts cannot read restricted local storage directly, so `TYPEPILOT_GET_UI_SETTINGS` returns only the safe language code and label.

The `xpost` action validates the entire 280-character post with the bundled official twitter-text parser, including bare-domain URLs, emoji, and NFC. It preserves original links and mentions and allows at most two hashtags in the generated selection. One invalid generation may receive a corrective request. Never truncate protected URLs or mentions. Unselected surrounding text stays in the extension and only its numeric character budget enters the Gemini instruction.

## Selection Modes

- Native input or textarea uses `selectionStart`, `selectionEnd`, and the native value setter.
- Native fields inside Shadow DOM use `event.composedPath()[0]`, captured synchronously.
- Pointer, keyboard, and debounced `selectionchange` events can reveal the action control.
- Contenteditable fields include declared, inherited, and `plaintext-only` editors. Saved offsets can reconstruct a Range after DOM rerenders only while the entire original text remains unchanged.
- Bind results to immutable request snapshots, never to mutable global focus/selection state. Verify again after saving a Recovery backup and after focusing the field.
- Replacement uses `document.execCommand("insertText")` and checks the whole expected editor text. Honor cancelled `beforeinput`. Do not force Range DOM mutations into unsupported editors or issue a generic `undo` that could affect user history.
- Failed insertions can attempt browser-native plain-text restoration. Keep the generated result available for copying and the original available in Recovery.
- `fix-selection` uses the commands API to message the focused frame. The configurable default is Ctrl+Shift+Y (Command+Shift+Y on Mac).
- Matching iframe and about:blank frames receive the content script through `all_frames` and `match_about_blank`.

## Gemini Contract

The request uses `generationConfig.responseMimeType = "application/json"` and a `responseSchema` containing one required string field named `result`.

`maxOutputTokens` must remain at 4096 or higher. Lower limits previously caused truncated multilingual responses.

`callGeminiDirect()` returns `{ result, usage, model }`. The message listener adds action metadata, duration, and cache status.

## Error Codes

Stable error codes are `NO_TEXT`, `NO_KEY`, `INVALID_ACTION`, `INVALID_KEY`, `RATE_LIMIT`, `QUOTA_EXCEEDED`, `MODEL_NOT_FOUND`, `SAFETY_BLOCK`, `EMPTY_RESPONSE`, `PARSE_ERROR`, `TIMEOUT`, `CANCELLED`, `NETWORK_ERROR`, `SERVER_ERROR`, `HTTP_ERROR`, `X_POST_INVALID`, and `UNKNOWN`.

Only `RATE_LIMIT`, `SERVER_ERROR`, and `NETWORK_ERROR` receive one automatic retry. Retriable errors can still show a manual Try Again button.

## Storage Keys

- `geminiApiKey`
- `geminiModel`, default `gemini-2.5-flash-lite`
- `systemPrompt`
- `personalDictionary`
- `translationLanguage`, default `en`
- `replacementBackups` in `chrome.storage.session`, maximum five temporary Recovery entries

Recovery writes and clearing are serialized. Preserve complete text or reject an original longer than 100,000 characters before mutation. Recovery reads and deletion require the trusted Settings sender. Any of the five backups can be selected and copied.

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
