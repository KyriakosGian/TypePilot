/**
 * content.js - TypePilot AI Content Script
 *
 * Responsibilities:
 *  - Detect text selections inside <textarea>, <input>, AND contenteditable elements.
 *  - Inject a floating "Fix with AI" button near the selection.
 *  - Send the selected text to the background service worker.
 *  - Display an alternatives popup and replace the original text on selection.
 *
 * Two selection modes are handled:
 *   "native"          → <textarea> and <input type="text|search|url|email">
 *                       Uses selectionStart / selectionEnd + .value
 *   "contenteditable" → [contenteditable] divs (Gmail, Notion, etc.)
 *                       Uses window.getSelection() + Range API
 */

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** The currently focused editable element (native or contenteditable root). */
let activeElement = null;

/**
 * Current editing mode.
 * @type {"native"|"contenteditable"}
 */
let activeMode = "native";

/** Saved offsets for native inputs. */
let savedSelection = { start: 0, end: 0 };

/** Saved Range object for contenteditable replacements. */
let savedRange = null;

/** The floating trigger button element (or null when absent). */
let floatingBtn = null;

/** The alternatives popup element (or null when absent). */
let popup = null;

// ---------------------------------------------------------------------------
// DOM cleanup helpers
// ---------------------------------------------------------------------------

function removeFloatingBtn() {
  if (floatingBtn) { floatingBtn.remove(); floatingBtn = null; }
}

function removePopup() {
  if (popup) { popup.remove(); popup = null; }
}

function removeAllUI() {
  removeFloatingBtn();
  removePopup();
}

// ---------------------------------------------------------------------------
// Field type helpers
// ---------------------------------------------------------------------------

/**
 * Check whether an element is a supported native editable field
 * (<textarea> or certain <input> types).
 * @param {Element} el
 * @returns {boolean}
 */
function isNativeField(el) {
  if (!el) return false;
  if (el.tagName === "TEXTAREA") return true;
  if (el.tagName === "INPUT" && /^(text|search|url|email)$/i.test(el.type ?? "text")) return true;
  return false;
}

/**
 * Check whether an element (or any of its ancestors) is a contenteditable root.
 * Returns the contenteditable root element, or null.
 * @param {Element} el
 * @returns {Element|null}
 */
function getContentEditableRoot(el) {
  if (!el) return null;
  return el.closest('[contenteditable="true"], [contenteditable=""]') ?? null;
}

/**
 * Return true if the element is any supported editable field.
 * @param {Element} el
 * @returns {boolean}
 */
function isEditableField(el) {
  return isNativeField(el) || !!getContentEditableRoot(el);
}

// ---------------------------------------------------------------------------
// Focus tracking
// ---------------------------------------------------------------------------

document.addEventListener("focusin", (event) => {
  // composedPath()[0] is the actual focused element even through shadow DOM boundaries.
  const el = (event.composedPath?.() ?? [])[0] ?? event.target;
  const ceRoot = getContentEditableRoot(el);

  if (ceRoot) {
    activeElement = ceRoot;
    activeMode = "contenteditable";
  } else if (isNativeField(el)) {
    activeElement = el;
    activeMode = "native";
  }
});

// ---------------------------------------------------------------------------
// Floating trigger button
// ---------------------------------------------------------------------------

/**
 * Inject the floating "Fix" button near the mouse cursor.
 * @param {number} x - Viewport X.
 * @param {number} y - Viewport Y.
 */
function showFloatingBtn(x, y) {
  removeFloatingBtn();

  floatingBtn = document.createElement("button");
  floatingBtn.id = "typepilot-btn";
  floatingBtn.className = "typepilot-btn";
  floatingBtn.setAttribute("aria-label", "Fix with TypePilot AI");
  floatingBtn.innerHTML = `
    <svg class="typepilot-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 2L12.09 7.26L17.5 8.27L13.75 11.97L14.62 17.5L10 14.77L5.38 17.5L6.25 11.97L2.5 8.27L7.91 7.26L10 2Z"
        stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="currentColor" fill-opacity="0.15"/>
    </svg>
    <span>Fix</span>
  `;

  floatingBtn.style.left = `${x + window.scrollX + 12}px`;
  floatingBtn.style.top  = `${y + window.scrollY + 12}px`;

  floatingBtn.addEventListener("click", handleFixButtonClick);
  document.body.appendChild(floatingBtn);
}

function setButtonLoading() {
  if (!floatingBtn) return;
  floatingBtn.classList.add("typepilot-btn--loading");
  floatingBtn.disabled = true;
  floatingBtn.innerHTML = `<span class="typepilot-spinner"></span><span>Fixing…</span>`;
}

// ---------------------------------------------------------------------------
// Mouse-up: detect selection
// ---------------------------------------------------------------------------

document.addEventListener("mouseup", (event) => {
  // Capture composedPath synchronously — it may be emptied after event dispatch.
  // This also handles shadow DOM: event.target is retargeted to the shadow host,
  // but composedPath() contains the real inner element.
  const composedPath = event.composedPath?.() ?? [];

  // Ignore clicks on our own UI (check path, not just retargeted target).
  if (composedPath.some(n => n?.id === "typepilot-btn" || n?.id === "typepilot-popup")) return;

  // For native fields inside shadow DOM, window.getSelection() won't track
  // textarea selections. Check path membership here, before the timeout clears it.
  const wasInActiveNative =
    activeMode === "native" &&
    activeElement &&
    isNativeField(activeElement) &&
    composedPath.includes(activeElement);

  setTimeout(() => {
    let selectedText = "";

    if (wasInActiveNative) {
      // ── Native textarea / input (incl. inside shadow DOM) ────────────────
      const start = activeElement.selectionStart;
      const end   = activeElement.selectionEnd;
      selectedText = activeElement.value.slice(start, end).trim();

      if (selectedText.length >= 2) {
        savedSelection = { start, end };
        savedRange = null;
        showFloatingBtn(event.clientX, event.clientY);
      } else {
        removeAllUI();
      }
    } else {
      // ── Contenteditable (Gmail, Notion, Google Docs, etc.) ───────────────
      const sel = window.getSelection();
      let targetEl = sel?.anchorNode;
      if (targetEl && targetEl.nodeType !== Node.ELEMENT_NODE) {
        targetEl = targetEl.parentElement;
      }

      if (!targetEl || !isEditableField(targetEl)) {
        removeAllUI();
        return;
      }

      if (sel && sel.rangeCount > 0) {
        selectedText = sel.toString().trim();
      }

      if (selectedText.length >= 2) {
        // Clone the range NOW so it survives DOM mutations later.
        savedRange = window.getSelection().getRangeAt(0).cloneRange();
        savedSelection = { start: 0, end: 0 };
        showFloatingBtn(event.clientX, event.clientY);
      } else {
        removeAllUI();
      }
    }
  }, 10);
});

// Close all UI when clicking outside our elements.
document.addEventListener("mousedown", (event) => {
  if (!event.target.closest("#typepilot-btn, #typepilot-popup")) {
    removeAllUI();
  }
});

// Close popup on Escape.
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") removeAllUI();
});

// ---------------------------------------------------------------------------
// Fix button click handler
// ---------------------------------------------------------------------------

async function handleFixButtonClick(explicitAnchor) {
  // Resolve selected text from the correct mode.
  let selectedText = "";

  if (activeMode === "native" && activeElement) {
    selectedText = activeElement.value.slice(savedSelection.start, savedSelection.end);
  } else if (savedRange) {
    selectedText = savedRange.toString();
  }

  if (!selectedText.trim()) { removeAllUI(); return; }

  // Anchor for the result/error popup. Prefer explicit (used by retry) over
  // the floating button's current rect.
  let anchorX, anchorY;
  if (explicitAnchor) {
    anchorX = explicitAnchor.x;
    anchorY = explicitAnchor.y;
  } else if (floatingBtn) {
    const btnRect = floatingBtn.getBoundingClientRect();
    anchorX = btnRect.left;
    anchorY = btnRect.bottom;
  } else {
    // No anchor available — bail silently rather than throwing.
    return;
  }

  if (floatingBtn) setButtonLoading();

  // Guard: check that the extension context is still valid before messaging.
  // This catches the case where the extension was reloaded while the tab was open.
  if (!chrome.runtime?.id) {
    showErrorPopup({
      code:      "CONTEXT_INVALIDATED",
      message:   "TypePilot was updated. Reload this page (F5) to continue.",
      retriable: false,
    }, anchorX, anchorY, selectedText);
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: "TYPEPILOT_PROCESS",
      text: selectedText,
    });

    if (response?.success && Array.isArray(response.alternatives)) {
      showPopup(response.alternatives, anchorX, anchorY);
    } else {
      showErrorPopup({
        code:      response?.code      ?? "UNKNOWN",
        message:   response?.error     ?? "Unknown error.",
        retriable: response?.retriable ?? false,
      }, anchorX, anchorY, selectedText);
    }
  } catch (err) {
    console.error("[TypePilot] Message error:", err);

    // "Extension context invalidated" → stale content script after extension reload.
    const isContextErr = err.message?.includes("Extension context invalidated")
                      || err.message?.includes("context invalidated");

    showErrorPopup({
      code:      isContextErr ? "CONTEXT_INVALIDATED" : "MESSAGING_ERROR",
      message:   isContextErr
        ? "TypePilot was updated. Reload this page (F5) to continue."
        : (err.message || "Could not reach the background service worker."),
      retriable: !isContextErr,
    }, anchorX, anchorY, selectedText);
  }
}

// ---------------------------------------------------------------------------
// Text replacement
// ---------------------------------------------------------------------------

/**
 * Replace the saved selection with the chosen alternative.
 * Dispatches input/change events so React/Vue/Angular apps detect the change.
 * @param {string} replacement
 */
function replaceSelectedText(replacement) {
  if (activeMode === "native" && activeElement) {
    // ── Native ──────────────────────────────────────────────────────────────
    const { start, end } = savedSelection;
    const original = activeElement.value;
    activeElement.value = original.slice(0, start) + replacement + original.slice(end);

    const newCursor = start + replacement.length;
    activeElement.setSelectionRange(newCursor, newCursor);
    activeElement.focus();

    activeElement.dispatchEvent(new Event("input",  { bubbles: true }));
    activeElement.dispatchEvent(new Event("change", { bubbles: true }));

  } else if (savedRange) {
    // ── Contenteditable ─────────────────────────────────────────────────────
    try {
      // Restore the saved range into the live selection first.
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange);

      // Delete selected content and insert replacement.
      savedRange.deleteContents();
      const textNode = document.createTextNode(replacement);
      savedRange.insertNode(textNode);

      // Move caret to end of inserted text.
      savedRange.setStartAfter(textNode);
      savedRange.setEndAfter(textNode);
      sel.removeAllRanges();
      sel.addRange(savedRange);

      // Notify the host framework about the change.
      if (activeElement) {
        activeElement.dispatchEvent(
          new InputEvent("input", {
            bubbles:   true,
            inputType: "insertText",
            data:      replacement,
          })
        );
      }
    } catch (err) {
      console.error("[TypePilot] contenteditable replacement error:", err);
    }
  }

  removeAllUI();
}

// ---------------------------------------------------------------------------
// Popup positioning helper
// ---------------------------------------------------------------------------

/**
 * Clamp a popup element fully inside the viewport.
 * Tries to flip above the anchor if overflowing the bottom.
 * Falls back to clamping all four edges so the popup is always visible.
 * @param {HTMLElement} el
 * @param {number} anchorY - Viewport Y of the anchor point (used for flipping).
 */
function clampPopupToViewport(el, anchorY) {
  const rect   = el.getBoundingClientRect();
  const margin = 8;

  // ── Horizontal ──────────────────────────────────────────────────────────
  let vLeft = parseFloat(el.style.left) - window.scrollX;
  if (vLeft + rect.width > window.innerWidth - margin) {
    vLeft = window.innerWidth - rect.width - margin;
  }
  if (vLeft < margin) vLeft = margin;
  el.style.left = `${vLeft + window.scrollX}px`;

  // ── Vertical ────────────────────────────────────────────────────────────
  let vTop = parseFloat(el.style.top) - window.scrollY;
  // Overflows bottom → try flipping above the anchor
  if (vTop + rect.height > window.innerHeight - margin) {
    vTop = anchorY - rect.height - margin;
  }
  // Clamp top edge (handles flip going above viewport or tiny viewports)
  if (vTop < margin) vTop = margin;
  // Final clamp bottom (last resort when popup taller than viewport)
  if (vTop + rect.height > window.innerHeight - margin) {
    vTop = Math.max(margin, window.innerHeight - rect.height - margin);
  }
  el.style.top = `${vTop + window.scrollY}px`;
}

// ---------------------------------------------------------------------------
// Alternatives popup
// ---------------------------------------------------------------------------

function showPopup(alternatives, x, y) {
  removePopup();
  removeFloatingBtn();

  popup = document.createElement("div");
  popup.id = "typepilot-popup";
  popup.className = "typepilot-popup";
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-label", "TypePilot AI Suggestions");

  const header = document.createElement("div");
  header.className = "typepilot-popup__header";
  header.innerHTML = `
    <span class="typepilot-popup__title">
      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 2L12.09 7.26L17.5 8.27L13.75 11.97L14.62 17.5L10 14.77L5.38 17.5L6.25 11.97L2.5 8.27L7.91 7.26L10 2Z"
          stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="currentColor" fill-opacity="0.15"/>
      </svg>
      TypePilot AI
    </span>
    <button class="typepilot-popup__close" aria-label="Close">✕</button>
  `;
  popup.appendChild(header);

  const slotLabels = ["✅ Corrected", "✨ Alternative 1", "🔀 Alternative 2"];
  const list = document.createElement("ul");
  list.className = "typepilot-popup__list";

  alternatives.forEach((alt, index) => {
    if (!alt) return;
    const item  = document.createElement("li");
    item.className = "typepilot-popup__item";

    const label = document.createElement("span");
    label.className = "typepilot-popup__item-label";
    label.textContent = slotLabels[index] ?? `Option ${index + 1}`;

    const btn = document.createElement("button");
    btn.className = "typepilot-popup__item-text";
    btn.textContent = alt;
    btn.addEventListener("click", () => replaceSelectedText(alt));

    item.appendChild(label);
    item.appendChild(btn);
    list.appendChild(item);
  });

  popup.appendChild(list);

  const margin = 8;
  popup.style.left = `${x + window.scrollX + margin}px`;
  popup.style.top  = `${y + window.scrollY + margin}px`;
  document.body.appendChild(popup);

  requestAnimationFrame(() => clampPopupToViewport(popup, y));

  header.querySelector(".typepilot-popup__close").addEventListener("click", removeAllUI);
}

// ---------------------------------------------------------------------------
// Error popup
// ---------------------------------------------------------------------------

/**
 * Render an error popup using safe DOM construction (no innerHTML interpolation).
 *
 * @param {{code: string, message: string, retriable: boolean}} error
 * @param {number} x        - Anchor X (viewport).
 * @param {number} y        - Anchor Y (viewport).
 * @param {string} [retryText] - If provided + error.retriable, shows a Try Again button.
 */
function showErrorPopup(error, x, y, retryText) {
  removePopup();
  removeFloatingBtn();

  const { code = "UNKNOWN", message = "Unknown error.", retriable = false } = error || {};

  popup = document.createElement("div");
  popup.id = "typepilot-popup";
  popup.className = "typepilot-popup typepilot-popup--error";
  popup.setAttribute("role", "alert");

  // ── Header ────────────────────────────────────────────────────────────────
  const header = document.createElement("div");
  header.className = "typepilot-popup__header";

  const title = document.createElement("span");
  title.className = "typepilot-popup__title";
  title.textContent = "⚠ TypePilot Error";
  header.appendChild(title);

  const codeBadge = document.createElement("span");
  codeBadge.className   = "typepilot-popup__code";
  codeBadge.textContent = code;
  codeBadge.title       = "Error code (for support / debugging)";
  header.appendChild(codeBadge);

  const closeBtn = document.createElement("button");
  closeBtn.className = "typepilot-popup__close";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", removeAllUI);
  header.appendChild(closeBtn);

  popup.appendChild(header);

  // ── Message body (textContent → safe from XSS) ────────────────────────────
  const msg = document.createElement("p");
  msg.className   = "typepilot-popup__error-msg";
  msg.textContent = message;
  popup.appendChild(msg);

  // ── Action row ────────────────────────────────────────────────────────────
  const actions = document.createElement("div");
  actions.className = "typepilot-popup__actions";

  if (retriable && retryText) {
    const retryBtn = document.createElement("button");
    retryBtn.className   = "typepilot-popup__btn typepilot-popup__btn--primary";
    retryBtn.textContent = "Try Again";
    retryBtn.addEventListener("click", () => {
      removePopup();
      // Re-run with the same anchor coords (no need to recreate the floating button).
      handleFixButtonClick({ x, y });
    });
    actions.appendChild(retryBtn);
  }

  // "Open Settings" shortcut for key/quota related errors.
  if (code === "NO_KEY" || code === "INVALID_KEY" || code === "MODEL_NOT_FOUND" || code === "QUOTA_EXCEEDED") {
    const settingsBtn = document.createElement("button");
    settingsBtn.className   = "typepilot-popup__btn";
    settingsBtn.textContent = "Open Settings";
    settingsBtn.addEventListener("click", () => {
      try {
        chrome.runtime.sendMessage({ type: "TYPEPILOT_OPEN_SETTINGS" });
      } catch { /* context invalidated — ignore */ }
      removeAllUI();
    });
    actions.appendChild(settingsBtn);
  }

  if (actions.children.length > 0) {
    popup.appendChild(actions);
  }

  // ── Position ──────────────────────────────────────────────────────────────
  popup.style.left = `${x + window.scrollX}px`;
  popup.style.top  = `${y + window.scrollY + 8}px`;
  document.body.appendChild(popup);

  requestAnimationFrame(() => clampPopupToViewport(popup, y));
}
