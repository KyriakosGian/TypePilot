/**
 * background.js - TypePilot AI Service Worker
 *
 * Handles all API communication (Gemini direct),
 * reads user settings from chrome.storage.local on every request, and
 * relays structured results back to content scripts.
 */

// ---------------------------------------------------------------------------
// Action button click → open Settings in a full tab
// ---------------------------------------------------------------------------
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
});

// ---------------------------------------------------------------------------
// Constants / Defaults
// ---------------------------------------------------------------------------

/** Fallback model if none is stored in settings. */
const DEFAULT_MODEL = "gemini-2.5-flash-lite";

/** Base URL for the Gemini generateContent endpoint (model appended dynamically). */
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/** Default system prompt (used when the user has not customised it). */
const DEFAULT_SYSTEM_PROMPT =
  'Act as an expert writing assistant. Identify the language, correct spelling, grammar, and punctuation in the provided text, maintaining the original tone. Also, provide 1 alternative rewrite, and an English translation of the corrected text. Output strictly as a JSON array of 3 strings: ["Corrected text", "Alternative 1", "English Translation"]. No markdown or extra text.';

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

/**
 * Extract and validate the JSON array from the model's raw text response.
 * Strips markdown fences defensively and pads to exactly 3 elements.
 *
 * @param {string} rawText
 * @returns {string[]} Array of 3 strings.
 */
function parseAlternatives(rawText) {
  try {
    const cleaned = rawText.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    if (Array.isArray(parsed) && parsed.length >= 1) {
      const result = parsed.slice(0, 3).map(String);
      while (result.length < 3) result.push("");
      return result;
    }

    throw new Error("Response is not a valid array.");
  } catch (err) {
    console.error("[TypePilot] Parse error:", err, "| Raw:", rawText);
    return [`⚠ Parse error: ${err.message}`, "", ""];
  }
}

// ---------------------------------------------------------------------------
// API call — BYOK (direct Gemini)
// ---------------------------------------------------------------------------

/**
 * Call the Gemini generateContent API directly using the user's own API key.
 *
 * @param {string} text          - Highlighted text to process.
 * @param {string} systemPrompt  - Correction instructions.
 * @param {string} apiKey        - User's Gemini API key.
 * @param {string} model         - Model ID (e.g. "gemini-1.5-flash").
 * @returns {Promise<string[]>}
 */
async function callGeminiDirect(text, systemPrompt, apiKey, model) {
  const url = `${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const payload = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Free tier limit reached. Please change your model and try again, or upgrade your key in Google AI Studio.");
    }

    // For other errors, try to extract a short message if it's JSON
    let errorMsg = `HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      errorMsg = errJson?.error?.message ?? errorMsg;
    } catch (e) {
      errorMsg = await response.text();
    }

    throw new Error(`Gemini API error: ${errorMsg}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return parseAlternatives(rawText);
}

// ---------------------------------------------------------------------------
// Message listener (entry point from content script)
// ---------------------------------------------------------------------------

/**
 * Message shape:   { type: "TYPEPILOT_PROCESS", text: string }
 * Response shape:  { success: true, alternatives: string[] }
 *              or  { success: false, error: string }
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "TYPEPILOT_PROCESS") return false;

  (async () => {
    try {
      // Read all settings fresh on every request.
      const settings = await chrome.storage.local.get([
        "geminiApiKey", "geminiModel", "systemPrompt",
      ]);

      const geminiKey = settings.geminiApiKey ?? "";
      const model = settings.geminiModel ?? DEFAULT_MODEL;
      const systemPrompt = settings.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
      const selectedText = (message.text ?? "").trim();

      if (!selectedText) {
        sendResponse({ success: false, error: "No text provided." });
        return;
      }

      if (!geminiKey) {
        sendResponse({
          success: false,
          error: "⚙ No API key set. Open Settings → enter your Gemini API key → Save.",
        });
        return;
      }

      const alternatives = await callGeminiDirect(selectedText, systemPrompt, geminiKey, model);

      sendResponse({ success: true, alternatives });

    } catch (err) {
      console.error("[TypePilot] Processing error:", err);
      sendResponse({ success: false, error: err.message });
    }
  })();

  return true; // Keep message channel open for async response.
});
