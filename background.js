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

/** Hard timeout for a single Gemini call (ms). */
const REQUEST_TIMEOUT_MS = 20_000;

/** Default system prompt (used when the user has not customised it). */
const DEFAULT_SYSTEM_PROMPT =
  'Act as an expert writing assistant. Identify the language, correct spelling, grammar, and punctuation in the provided text, maintaining the original tone. Also, provide 1 alternative rewrite, and an English translation of the corrected text. Output strictly as a JSON array of 3 strings: ["Corrected text", "Alternative 1", "English Translation"]. No markdown or extra text.';

// ---------------------------------------------------------------------------
// Error model
// ---------------------------------------------------------------------------

/**
 * Stable error codes shared between background and content scripts.
 * Use these — not message text — for any conditional UI logic.
 */
const ERR = Object.freeze({
  NO_TEXT:         "NO_TEXT",
  NO_KEY:          "NO_KEY",
  INVALID_KEY:     "INVALID_KEY",
  RATE_LIMIT:      "RATE_LIMIT",
  QUOTA_EXCEEDED:  "QUOTA_EXCEEDED",
  MODEL_NOT_FOUND: "MODEL_NOT_FOUND",
  SAFETY_BLOCK:    "SAFETY_BLOCK",
  EMPTY_RESPONSE:  "EMPTY_RESPONSE",
  PARSE_ERROR:     "PARSE_ERROR",
  TIMEOUT:         "TIMEOUT",
  NETWORK_ERROR:   "NETWORK_ERROR",
  SERVER_ERROR:    "SERVER_ERROR",
  HTTP_ERROR:      "HTTP_ERROR",
  UNKNOWN:         "UNKNOWN",
});

class TypePilotError extends Error {
  /**
   * @param {string}  code      One of ERR.*
   * @param {string}  message   User-facing message (will be shown verbatim).
   * @param {boolean} retriable True if the same call could plausibly succeed on retry.
   */
  constructor(code, message, retriable = false) {
    super(message);
    this.name = "TypePilotError";
    this.code = code;
    this.retriable = retriable;
  }
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

/**
 * Extract a JSON array of strings from the model's raw text output.
 * Handles: bare JSON, ```json fenced blocks, prose-wrapped arrays.
 *
 * @param {string} rawText
 * @returns {string[]} Array of up to 3 non-empty strings.
 * @throws  {TypePilotError} ERR.PARSE_ERROR | ERR.EMPTY_RESPONSE
 */
function parseAlternatives(rawText) {
  if (!rawText || !rawText.trim()) {
    throw new TypePilotError(
      ERR.EMPTY_RESPONSE,
      "The model returned an empty response. Try again or switch model.",
      true,
    );
  }

  // Strip markdown fences and try to locate the first JSON array.
  const cleaned = rawText
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```/g, "")
    .trim();

  // Greedy match of the first [...] block — survives prose like `Sure! ["..."]`.
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  const candidate  = arrayMatch ? arrayMatch[0] : cleaned;

  let parsed;
  try {
    parsed = JSON.parse(candidate);
  } catch (err) {
    console.error("[TypePilot] Parse error:", err, "| Raw:", rawText);
    throw new TypePilotError(
      ERR.PARSE_ERROR,
      "The model did not return valid JSON. Try again — this is usually transient.",
      true,
    );
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    console.error("[TypePilot] Non-array response:", parsed);
    throw new TypePilotError(
      ERR.PARSE_ERROR,
      "The model response was not a list of alternatives. Try again.",
      true,
    );
  }

  // Normalise: keep only non-empty strings, cap to 3, pad to 3 with empties.
  const result = parsed.slice(0, 3).map((v) => String(v ?? "").trim());
  while (result.length < 3) result.push("");

  if (!result.some(Boolean)) {
    throw new TypePilotError(
      ERR.EMPTY_RESPONSE,
      "The model returned an empty list. Try again or switch model.",
      true,
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// HTTP error mapping
// ---------------------------------------------------------------------------

/**
 * Map a non-OK Gemini response to a TypePilotError with a stable code.
 * Reads the body once, defensively.
 *
 * @param {Response} response
 * @returns {Promise<TypePilotError>}
 */
async function mapHttpError(response) {
  let apiMessage = `HTTP ${response.status}`;
  let apiStatus  = "";
  try {
    const errJson = await response.json();
    apiMessage = errJson?.error?.message ?? apiMessage;
    apiStatus  = errJson?.error?.status  ?? "";
  } catch {
    try { apiMessage = (await response.text()) || apiMessage; } catch { /* ignore */ }
  }

  const status = response.status;

  if (status === 429) {
    // Gemini distinguishes per-minute rate limits from daily quota via message text.
    const isQuota = /quota/i.test(apiMessage) || /RESOURCE_EXHAUSTED/i.test(apiStatus);
    return new TypePilotError(
      isQuota ? ERR.QUOTA_EXCEEDED : ERR.RATE_LIMIT,
      isQuota
        ? "Daily free-tier quota reached for this model. Switch model or wait until reset."
        : "Rate limit hit. Wait a few seconds and try again, or switch to a lighter model.",
      !isQuota, // per-minute is retriable, daily quota is not (within reason)
    );
  }

  if (status === 400 && /API key not valid|API_KEY_INVALID/i.test(apiMessage)) {
    return new TypePilotError(
      ERR.INVALID_KEY,
      "Your Gemini API key was rejected. Open Settings and paste a valid key from Google AI Studio.",
      false,
    );
  }

  if (status === 401 || status === 403) {
    return new TypePilotError(
      ERR.INVALID_KEY,
      "Authentication failed. Check that your API key is valid and has access to this model.",
      false,
    );
  }

  if (status === 404) {
    return new TypePilotError(
      ERR.MODEL_NOT_FOUND,
      "The selected model is not available for your key. Pick another in Settings.",
      false,
    );
  }

  if (status >= 500 && status <= 599) {
    return new TypePilotError(
      ERR.SERVER_ERROR,
      "Gemini servers are having trouble. Try again in a moment.",
      true,
    );
  }

  return new TypePilotError(ERR.HTTP_ERROR, `Gemini API error: ${apiMessage}`, false);
}

// ---------------------------------------------------------------------------
// Response inspection (safety, finish reasons)
// ---------------------------------------------------------------------------

/**
 * Inspect a successful Gemini response body before extracting text.
 * Throws TypePilotError when the response is empty for non-textual reasons
 * (safety blocks, recitation, missing candidates, etc).
 *
 * @param {object} data
 * @returns {string} The model's raw text.
 */
function extractTextOrThrow(data) {
  // Top-level prompt block (rare but possible — e.g. user input filtered).
  const promptBlock = data?.promptFeedback?.blockReason;
  if (promptBlock) {
    throw new TypePilotError(
      ERR.SAFETY_BLOCK,
      `Your selected text was blocked by Gemini's safety filter (${promptBlock}). Try rephrasing or selecting different text.`,
      false,
    );
  }

  const candidate = data?.candidates?.[0];
  if (!candidate) {
    throw new TypePilotError(
      ERR.EMPTY_RESPONSE,
      "Gemini returned no candidates. Try again or switch model.",
      true,
    );
  }

  const finishReason = candidate.finishReason;
  if (finishReason === "SAFETY" || finishReason === "RECITATION" || finishReason === "PROHIBITED_CONTENT") {
    throw new TypePilotError(
      ERR.SAFETY_BLOCK,
      `Gemini blocked the response (${finishReason}). Try rephrasing or selecting different text.`,
      false,
    );
  }

  const rawText = candidate?.content?.parts?.[0]?.text ?? "";

  if (finishReason === "MAX_TOKENS") {
    if (!rawText) {
      throw new TypePilotError(
        ERR.EMPTY_RESPONSE,
        "Response was cut off before any text was produced. Try a shorter selection.",
        false,
      );
    }
    // Partial text exists but the JSON will be truncated — surface a clear error.
    throw new TypePilotError(
      ERR.PARSE_ERROR,
      "The selected text is too long for the model to process in one go. Try selecting a shorter passage.",
      false,
    );
  }

  return rawText;
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
 * @param {string} model         - Model ID (e.g. "gemini-2.5-flash-lite").
 * @returns {Promise<{alternatives: string[], usage: object, model: string}>}
 * @throws  {TypePilotError}
 */
async function callGeminiDirect(text, systemPrompt, apiKey, model) {
  const url = `${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const payload = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
  };

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
      signal:  controller.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new TypePilotError(
        ERR.TIMEOUT,
        `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s. Try again or switch to a faster model.`,
        true,
      );
    }
    throw new TypePilotError(
      ERR.NETWORK_ERROR,
      "Could not reach Gemini. Check your internet connection and try again.",
      true,
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw await mapHttpError(response);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new TypePilotError(
      ERR.PARSE_ERROR,
      "Gemini returned a malformed JSON envelope. Try again.",
      true,
    );
  }

  const rawText = extractTextOrThrow(data);
  const alternatives = parseAlternatives(rawText);

  const usage = {
    promptTokens:    data?.usageMetadata?.promptTokenCount    ?? null,
    responseTokens:  data?.usageMetadata?.candidatesTokenCount ?? null,
    totalTokens:     data?.usageMetadata?.totalTokenCount      ?? null,
  };

  return { alternatives, usage, model };
}

// ---------------------------------------------------------------------------
// Message listener (entry point from content script)
// ---------------------------------------------------------------------------

/**
 * Message shape:   { type: "TYPEPILOT_PROCESS", text: string }
 * Response shape:  { success: true,  alternatives: string[], usage: object, model: string }
 *              or  { success: false, error: string, code: string, retriable: boolean }
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Open Settings tab on demand (used by error popup shortcuts).
  if (message?.type === "TYPEPILOT_OPEN_SETTINGS") {
    chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
    sendResponse({ success: true });
    return false;
  }

  if (message?.type !== "TYPEPILOT_PROCESS") return false;

  (async () => {
    try {
      // Read all settings fresh on every request.
      const settings = await chrome.storage.local.get([
        "geminiApiKey", "geminiModel", "systemPrompt",
      ]);

      const geminiKey    = settings.geminiApiKey ?? "";
      const model        = settings.geminiModel  ?? DEFAULT_MODEL;
      const systemPrompt = settings.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
      const selectedText = (message.text ?? "").trim();

      if (!selectedText) {
        throw new TypePilotError(ERR.NO_TEXT, "No text selected.", false);
      }

      if (!geminiKey) {
        throw new TypePilotError(
          ERR.NO_KEY,
          "No API key set. Open Settings → paste your Gemini API key → Save.",
          false,
        );
      }

      const result = await callGeminiDirect(selectedText, systemPrompt, geminiKey, model);
      sendResponse({ success: true, alternatives: result.alternatives, usage: result.usage, model: result.model });

    } catch (err) {
      const tpe = err instanceof TypePilotError
        ? err
        : new TypePilotError(ERR.UNKNOWN, err?.message || "Unknown error.", false);

      console.error(`[TypePilot] ${tpe.code}:`, tpe.message);
      sendResponse({
        success:   false,
        error:     tpe.message,
        code:      tpe.code,
        retriable: tpe.retriable,
      });
    }
  })();

  return true; // Keep message channel open for async response.
});
