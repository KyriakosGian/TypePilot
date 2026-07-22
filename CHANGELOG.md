# Changelog

All notable changes to TypePilot are documented here.

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
