# Changelog

All notable changes to TypePilot are documented here.

---

## [1.1.0] — 2026-05-12

### Added
- **Query info panel** — a new ⓘ icon in the suggestions popup reveals the model used, prompt tokens, response tokens, and total tokens for each request, sourced directly from the Gemini API response metadata.

### Fixed
- **Shadow DOM support** — the Fix button now appears correctly inside web components that render their textarea inside a shadow root (e.g. Reddit's composer, Lit-based inputs). Previously, event retargeting caused the selection check to fail silently.
- **Response truncation** — raised `maxOutputTokens` from 1024 to 4096. Long or multilingual texts were hitting the limit mid-JSON, producing a spurious "invalid JSON" error.
- **Clearer truncation error** — when the model still hits the token limit (e.g. an unusually long selection), the error now reads "The selected text is too long…" instead of the misleading "invalid JSON" message.

---

## [1.0.0] — Initial release

- Floating Fix button on text selection in any `<textarea>`, `<input>`, or `contenteditable` field.
- Three AI alternatives per request: corrected text, rewrite, and English translation.
- Bring Your Own Key (BYOK) — direct browser → Gemini API, no backend.
- Live model picker in Settings sourced from the user's Google AI Studio account.
- Customisable system prompt.
- Stable error codes with retriable/non-retriable distinction and a Try Again button.
