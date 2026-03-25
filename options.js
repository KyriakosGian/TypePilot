/**
 * options.js - TypePilot AI Settings Page Logic
 *
 * Handles:
 *  - Loading/saving settings (geminiApiKey, geminiModel, systemPrompt)
 *  - Auto-fetching available Gemini models when a valid API key is entered
 *  - Resetting the correction prompt to default
 *  - Toggling API key field visibility
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_SYSTEM_PROMPT =
  'Act as an expert writing assistant. Identify the language, correct spelling, grammar, and punctuation in the provided text, maintaining the original tone. Also, provide 1 alternative rewrite, and an English translation of the corrected text. Output strictly as a JSON array of 3 strings: ["Corrected text", "Alternative 1", "English Translation"]. No markdown or extra text.';

/** Minimum plausible API key length before we attempt a live fetch. */
const MIN_KEY_LENGTH = 20;

/** Debounce delay (ms) after the user stops typing in the key field. */
const KEY_DEBOUNCE_MS = 900;

/** Models shown as fallback when the API fetch fails or key not yet set. */
const FALLBACK_MODELS = [
  { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
];

// ---------------------------------------------------------------------------
// Element references
// ---------------------------------------------------------------------------

const form = document.getElementById("settingsForm");
const geminiApiKeyInput = document.getElementById("geminiApiKey");
const keyStatusHint = document.getElementById("keyStatusHint");
const modelSection = document.getElementById("model-section");
const geminiModelSelect = document.getElementById("geminiModel");
const fetchModelsHint = document.getElementById("fetchModelsHint");
const systemPromptInput = document.getElementById("systemPrompt");
const saveBtn = document.getElementById("saveBtn");
const statusMessage = document.getElementById("statusMessage");
const resetPromptBtn = document.getElementById("resetPrompt");
const toggleKeyBtn = document.getElementById("toggleKeyVisibility");
const eyeIconShow = document.getElementById("eye-icon-show");
const eyeIconHide = document.getElementById("eye-icon-hide");

// ---------------------------------------------------------------------------
// Initialisation — load stored settings
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {
  // Populate fallback model list immediately so the select is never empty
  populateModelSelect(FALLBACK_MODELS, "gemini-2.5-flash-lite");

  try {
    const settings = await chrome.storage.local.get([
      "geminiApiKey", "geminiModel", "systemPrompt",
    ]);

    // Restore API key
    geminiApiKeyInput.value = settings.geminiApiKey ?? "";

    // Restore system prompt
    systemPromptInput.value = settings.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;

    // Restore model dropdown — start with fallback list
    populateModelSelect(FALLBACK_MODELS, settings.geminiModel ?? "gemini-2.5-flash-lite");

    // If key is present → auto-fetch live models on load
    if (settings.geminiApiKey) {
      await fetchAndPopulateModels(settings.geminiApiKey, settings.geminiModel ?? "gemini-2.5-flash-lite");
    }

  } catch (err) {
    // Outside extension context or storage unavailable — use defaults
    systemPromptInput.value = DEFAULT_SYSTEM_PROMPT;
    console.warn("[TypePilot] Could not load settings:", err.message);
  }
});

// ---------------------------------------------------------------------------
// Model list helpers
// ---------------------------------------------------------------------------

/**
 * Populate the model <select> from an array of model objects.
 * @param {{ id: string, name: string }[]} models
 * @param {string} selectedId
 */
function populateModelSelect(models, selectedId) {
  geminiModelSelect.innerHTML = models
    .map((m) => `<option value="${m.id}"${m.id === selectedId ? " selected" : ""}>${m.name}</option>`)
    .join("");
}

/**
 * Fetch the live list of models from the Gemini ListModels API,
 * filter to generateContent-capable ones, then repopulate the dropdown.
 *
 * @param {string} apiKey
 * @param {string} selectedId - Currently selected model to preserve.
 */
async function fetchAndPopulateModels(apiKey, selectedId) {
  try {
    setModelsState("loading");

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=50`;
    const resp = await fetch(url);

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `HTTP ${resp.status}`);
    }

    const data = await resp.json();
    const rawModels = data?.models ?? [];

    const supported = rawModels
      .filter((m) => {
        const name = m.name.toLowerCase();
        return (
          m.supportedGenerationMethods?.includes("generateContent") &&
          name.includes("gemini") &&
          !name.includes("embedding") &&
          !name.includes("tts") &&
          !name.includes("audio") &&
          !name.includes("vision") &&
          !name.includes("aqa") &&
          !name.includes("Nano Banana")
        );
      })
      .map((m) => ({
        id: m.name.replace("models/", ""),
        name: m.displayName ?? m.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (supported.length === 0) throw new Error("No compatible text models found.");

    populateModelSelect(supported, selectedId);
    setModelsState("success", `✓ ${supported.length} models loaded`);

  } catch (err) {
    // Keep fallback list visible, just show error
    setModelsState("error", `⚠ ${err.message}`);
  }
}

/**
 * Update both the key status hint and the model hint to reflect current state.
 * @param {"idle"|"loading"|"success"|"error"} state
 * @param {string} [message]
 */
function setModelsState(state, message) {
  switch (state) {
    case "loading":
      keyStatusHint.textContent = "⟳ Validating key and fetching models…";
      keyStatusHint.style.color = "";
      fetchModelsHint.textContent = "Fetching model list from Google…";
      fetchModelsHint.style.color = "";
      break;
    case "success":
      keyStatusHint.textContent = "✓ API key valid. " + message;
      keyStatusHint.style.color = "var(--green)";
      fetchModelsHint.textContent = message;
      fetchModelsHint.style.color = "var(--green)";
      break;
    case "error":
      keyStatusHint.textContent = message ?? "Could not load models.";
      keyStatusHint.style.color = "var(--red, #f87171)";
      fetchModelsHint.textContent = message ?? "";
      fetchModelsHint.style.color = "var(--red, #f87171)";
      break;
    default: // idle
      keyStatusHint.textContent = "Stored locally on this device and never shared. Models load automatically when a valid key is detected.";
      keyStatusHint.style.color = "";
      fetchModelsHint.textContent = "Enter your API key above — available models will load automatically.";
      fetchModelsHint.style.color = "";
  }
}

// ---------------------------------------------------------------------------
// Auto-fetch models when user types a key (debounced)
// ---------------------------------------------------------------------------

let keyDebounceTimer = null;

geminiApiKeyInput.addEventListener("input", () => {
  clearTimeout(keyDebounceTimer);
  const key = geminiApiKeyInput.value.trim();

  if (key.length < MIN_KEY_LENGTH) {
    setModelsState("idle");
    populateModelSelect(FALLBACK_MODELS, geminiModelSelect.value || "gemini-2.5-flash-lite");
    return;
  }

  keyDebounceTimer = setTimeout(() => {
    fetchAndPopulateModels(key, geminiModelSelect.value || "gemini-2.5-flash-lite");
  }, KEY_DEBOUNCE_MS);
});

// ---------------------------------------------------------------------------
// API key show / hide toggle
// ---------------------------------------------------------------------------

toggleKeyBtn.addEventListener("click", () => {
  const isPassword = geminiApiKeyInput.type === "password";
  geminiApiKeyInput.type = isPassword ? "text" : "password";
  eyeIconShow.style.display = isPassword ? "none" : "block";
  eyeIconHide.style.display = isPassword ? "block" : "none";
});

// ---------------------------------------------------------------------------
// Reset prompt
// ---------------------------------------------------------------------------

resetPromptBtn.addEventListener("click", () => {
  systemPromptInput.value = DEFAULT_SYSTEM_PROMPT;
  showStatus("Prompt reset to default.", "info");
});

// ---------------------------------------------------------------------------
// Form submission
// ---------------------------------------------------------------------------

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearStatus();
  setSavingState(true);

  const apiKey = geminiApiKeyInput.value.trim();
  const geminiModel = geminiModelSelect.value;
  const systemPrompt = systemPromptInput.value.trim();

  // Validation
  if (!apiKey) {
    showStatus("Please enter your Google Gemini API key.", "error");
    geminiApiKeyInput.focus();
    setSavingState(false);
    return;
  }

  if (!geminiModel) {
    showStatus("Please select an AI model.", "error");
    setSavingState(false);
    return;
  }

  if (!systemPrompt) {
    showStatus("The correction prompt must not be empty.", "error");
    systemPromptInput.focus();
    setSavingState(false);
    return;
  }

  try {
    await chrome.storage.local.set({
      geminiApiKey: apiKey,
      geminiModel: geminiModel || "gemini-2.5-flash-lite",
      systemPrompt,
    });
    showStatus("✓ Settings saved successfully!", "success");
  } catch (err) {
    showStatus(`Failed to save: ${err.message}`, "error");
  } finally {
    setSavingState(false);
  }
});

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

function showStatus(message, type = "info") {
  statusMessage.textContent = message;
  statusMessage.className = `status-message status-message--${type}`;
}

function clearStatus() {
  statusMessage.textContent = "";
  statusMessage.className = "status-message";
}

function setSavingState(saving) {
  saveBtn.disabled = saving;
  if (!saving) {
    saveBtn.innerHTML = `
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path d="M5 4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8.41l-4-4H5zm6 0v4h4M8 15v-4h4v4"/>
      </svg>
      Save Settings
    `;
  } else {
    saveBtn.textContent = "Saving…";
  }
}

// Sidebar smooth-scroll & active link
document.querySelectorAll(".sidebar__nav-link").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const target = document.getElementById(link.getAttribute("href").slice(1));
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    document.querySelectorAll(".sidebar__nav-link").forEach((l) => l.classList.remove("sidebar__nav-link--active"));
    link.classList.add("sidebar__nav-link--active");
  });
});
