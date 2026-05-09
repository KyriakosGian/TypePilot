# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TypePilot is a Chrome Extension (Manifest V3) — a real-time AI writing assistant powered by the Google Gemini API using a Bring Your Own Key (BYOK) model. Users supply a free API key from Google AI Studio; the extension communicates directly with Google's servers with no intermediate backend.

## Development

**No build process.** Load the extension directory directly as an unpacked extension in Chrome (`chrome://extensions` → "Load unpacked"). Changes to any file take effect after clicking "Reload" on the extensions page.

There are no dependencies, npm packages, build steps, or test suite. All files are plain JavaScript (ES modules in `background.js`, classic scripts elsewhere).

## Architecture

### File Roles

| File | Role |
|---|---|
| `manifest.json` | Extension config — permissions (`storage`, `activeTab`, `scripting`, `tabs`), host permissions for `generativelanguage.googleapis.com` |
| `background.js` | Service Worker — owns all Gemini API calls, error mapping, response parsing |
| `content.js` | Content Script — selection detection, floating UI injection, text replacement |
| `style.css` | Scoped styles for content script UI (button + popups) |
| `options.html/js/css` | Settings page — API key input, live model picker, system prompt editor |

### Message Flow

```
User selects text → content.js detects via mouseup
    → floating "Fix" button appears
    → user clicks → chrome.runtime.sendMessage({ type: "TYPEPILOT_PROCESS", text })
    → background.js reads chrome.storage.local (key, model, prompt)
    → POST to generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
    → response parsed into string[3]
    → { success: true, alternatives: [...] } sent back
    → content.js renders popup; user clicks alternative → text replaced
```

### Two Selection Modes in content.js

- **Native mode** (`<textarea>`, `<input>`): uses `selectionStart`/`selectionEnd`/`.value`
- **Contenteditable mode** (Gmail, Notion, Google Docs): uses `window.getSelection()` + `Range`; range is cloned immediately to survive DOM mutations

### Gemini API Contract

The system prompt instructs the model to return **exactly** a JSON array of 3 strings:
```json
["Corrected text", "Alternative 1", "English Translation"]
```

Payload structure:
```json
{
  "system_instruction": { "parts": [{ "text": "<systemPrompt>" }] },
  "contents": [{ "role": "user", "parts": [{ "text": "<selectedText>" }] }],
  "generationConfig": { "temperature": 0.7, "maxOutputTokens": 1024 }
}
```

`parseAlternatives()` in `background.js` handles markdown fences and prose-wrapped arrays defensively.

### Error Codes

`background.js` maps all failures to stable codes: `NO_TEXT`, `NO_KEY`, `INVALID_KEY`, `RATE_LIMIT`, `QUOTA_EXCEEDED`, `MODEL_NOT_FOUND`, `SAFETY_BLOCK`, `EMPTY_RESPONSE`, `PARSE_ERROR`, `TIMEOUT`, `NETWORK_ERROR`, `SERVER_ERROR`, `HTTP_ERROR`, `UNKNOWN`. The `retriable` boolean on each error drives the "Try Again" button in content.js.

### chrome.storage.local Keys

- `geminiApiKey` — user's Google API key
- `geminiModel` — selected model ID (default: `gemini-2.5-flash-lite`)
- `systemPrompt` — full system instruction string

### UI Design System

- **Colors:** Dark-themed (`#0f0f1a` background, `#6c63ff` accent)
- **Z-Index:** `2147483647` for injected UI to float above all page content
- **CSS Scoping:** All custom properties prefixed `--lf-` to avoid conflicts with host pages
- **XSS prevention:** Error messages use `textContent` (never `innerHTML`)

## Instructions for AI Assistants

- Maintain the BYOK philosophy — no external backend proxies, direct browser → Google API only.
- Ensure all DOM manipulations in `content.js` remain non-intrusive to host pages.
- Keep `gemini-2.5-flash-lite` as the primary fallback model (higher RPM on free tier).
- Strictly adhere to Manifest V3 security guidelines (no `unsafe-eval`).
- Content script must guard every `chrome.runtime.*` call against extension context invalidation.
