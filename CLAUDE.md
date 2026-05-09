# TypePilot - Technical Specifications & Guidelines

## 1. Project Overview
TypePilot is a Chrome Extension (Manifest V3) acting as an AI Writing Assistant using the Google Gemini API. It follows a **BYOK (Bring Your Own Key)** model, communicating directly with Google's endpoints from the client-side.

## 2. Core Architecture
- **Manifest V3**: Uses a Service Worker (`background.js`) and Content Scripts (`content.js`).
- **Permissions**: `storage`, `activeTab`, `scripting`, `tabs`, and host permissions for `https://generativelanguage.googleapis.com/*`.
- **Storage**: All settings (API Key, Model, System Prompt) are stored in `chrome.storage.local`.

## 3. Key Component Responsibilities
### Content Script (`content.js`)
- **Selection Detection**: Monitors `mouseup` and `focusin` events.
- **Field Support**: Handles Native inputs (`textarea`, `input`) and `contenteditable` elements (Gmail, Notion, etc.).
- **UI Injection**: Injects a floating "Fix" button and an alternatives popup directly into the DOM.
- **Context Guard**: Includes checks for `chrome.runtime.id` to handle extension invalidation after updates.

### Service Worker (`background.js`)
- **API Proxy**: Orchestrates direct calls to the Gemini `generateContent` endpoint.
- **Response Parsing**: Implements a defensive parser for the AI's raw text, stripping markdown fences to extract a clean JSON array.
- **Default Model**: `gemini-2.5-flash-lite` (Recommended for higher RPM in free tier).

### Settings (`options.js` / `options.html`)
- **Dynamic Model Fetching**: Uses the `ListModels` API to fetch available models based on the provided API Key.
- **Debouncing**: Implements a 900ms debounce on API Key input before fetching models.
- **Fallback Logic**: Provides local fallback models if API fetching fails.

## 4. Technical Constraints & Data Schemas
### System Prompt Requirement
The AI must strictly output a JSON array of 3 strings:
`["Corrected text", "Alternative 1", "English Translation"]`

### API Implementation
- **Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}`
- **Payload Structure**:
  ```json
  {
    "system_instruction": { "parts": [{ "text": systemPrompt }] },
    "contents": [{ "role": "user", "parts": [{ "text": userInput }] }],
    "generationConfig": { "temperature": 0.7, "maxOutputTokens": 1024 }
  }

## 5. UI Design System
Colors: Dark-themed (#0f0f1a background, #6c63ff accent).

Styling: Scoped CSS using custom properties (tokens) starting with --lf- for content scripts and standard variables for options.

Z-Index: Uses 2147483647 for injected UI to ensure top-level visibility.

## 6. Current Development Status
Version: 1.0.0

Stability: Production-ready code with error handling for API 429 (Rate Limits) and context invalidation.

Next Steps: Dogfooding phase followed by Chrome Web Store submission.

## 7. Instructions for AI Assistant (Claude/Others)
Maintain the BYOK philosophy (no external backend proxies).

Ensure all DOM manipulations in content.js remain non-intrusive.

Keep the gemini-2.5-flash-lite as the primary fallback model.

Strictly adhere to the Manifest V3 security guidelines (no unsafe-eval).