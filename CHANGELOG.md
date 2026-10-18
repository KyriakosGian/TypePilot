# Changelog

All notable changes to TypePilot are documented here.

## [1.4.0] - 2026-10-18

### Added

- Post for X action that corrects and rewrites text for the standard 280-character limit.
- Locally bundled official twitter-text parser for NFC, emoji, bare-domain links, and weighted character validation.
- Temporary Recovery backups containing the original editor text before each replacement.
- Recovery selector to copy any of the five original texts or clear all temporary backups.
- Copy result button for editors that cannot accept an automatic replacement.
- Configurable Fix shortcut: Ctrl+Shift+Y on Windows/Linux and Command+Shift+Y on macOS.
- Keyboard and pointer selection detection, including selections created without a mouse drag.
- Content-script support for editable fields inside matching iframe and about:blank frames.
- Automated Node regression tests, real unpacked-extension Chromium tests, and GitHub Actions regression checks.

### Changed

- Contenteditable detection now supports `plaintext-only`, inherited editable state, and more custom editors.
- Immutable request snapshots prevent old AI results from overwriting newer editor content.
- Saved contenteditable selections can be reconstructed after a rerender when the original editor text is unchanged.
- Replacement checks the entire resulting editor, including unselected text and paragraph boundaries.
- Browser-native restoration attempts recover rejected insertions without undoing unrelated user edits. Failed results remain available for copying.
- Post for X validates the complete post, preserves original links and mentions, and retries one invalid generation instead of clipping protected text.
- Concurrent Recovery writes are serialized. Oversized originals are rejected with a manual-copy fallback instead of silent truncation.
- Timeout and cancellation cover the entire response body, and request IDs are isolated by tab and frame.
- Updated README, website, privacy disclosures, neutral screenshots, and release package.

### Privacy

- Recovery retains at most five local session backups and clears them when the browser session ends.
- Recovery text is never sent to Gemini unless the user separately selects and submits it as a writing request.
- Recovery reads and deletion are restricted to the extension's Settings page.
- Surrounding text for X length validation stays inside the extension and is not sent to Gemini.

## [1.3.0] - 2026-07-22

### Added

- Translation target setting with 25 supported languages and English as the default.
- Dynamic Translate menu and result labels based on the selected target language.
- A restricted UI-settings message so content scripts can display the language without reading protected local storage.

### Changed

- Translation instructions now use the configured target language.
- Result cache keys now include the translation language.
- Settings, documentation, privacy disclosures, website, screenshots, and release package updated for configurable translation.

## [1.2.0] - 2026-07-20

### Added

- Split Fix control with a dropdown for Rewrite, Translate to English, Shorten, Formal tone, and Friendly tone.
- Single-result actions for faster responses and lower output-token usage.
- Gemini structured-output schema with a typed `result` field.
- Gemini 3.1 Flash-Lite and Gemini 3.5 Flash model choices when available to the user's API key.
- Personal dictionary for protected terms.
- Five-minute in-memory cache for identical requests.
- Request cancellation and one automatic retry for transient failures.
- Response-time and cache information in the request details panel.

### Changed

- API keys are sent through the `x-goog-api-key` header instead of the request URL.
- Model discovery now shows compatible text-generation models only and prioritizes current Flash models.
- Correction actions use lower temperature for more consistent results.
- Native-field replacement now uses the platform value setter for better React compatibility.
- Contenteditable replacement now prefers browser-native insertion to preserve editor behavior.
- The API key storage area is restricted to trusted extension contexts.
- Removed unused `activeTab`, `scripting`, and `tabs` permissions.
- Removed the external font request from the Settings page.

### Fixed

- Corrected model filtering for image, audio, live, embedding, and other incompatible models.
- Removed the incorrect third-result label from the previous multi-result interface.
- Retry now repeats the exact failed action and selected text.

## [1.1.0] - 2026-05-12

### Added

- Query information panel showing model and token usage.

### Fixed

- Shadow DOM selection support.
- Increased `maxOutputTokens` from 1024 to 4096.
- Clearer error when a response reaches the output-token limit.

## [1.0.0] - Initial release

- Floating Fix button for native and contenteditable fields.
- Corrected text, rewrite, and English translation results.
- Direct browser-to-Gemini BYOK communication.
- Live model picker and customizable system prompt.
- Stable error codes and manual retry support.
