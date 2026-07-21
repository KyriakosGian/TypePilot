/**
 * TypePilot content script.
 * Detects editable selections, renders the split Fix control, sends actions to
 * the service worker and replaces the selected text with the chosen result.
 */

let activeElement = null;
let activeMode = "native";
let savedSelection = { start: 0, end: 0 };
let savedRange = null;

let floatingControl = null;
let primaryButton = null;
let menuButton = null;
let actionMenu = null;
let popup = null;
let activeRequestId = null;

const SECONDARY_ACTIONS = Object.freeze([
  { id: "rewrite", label: "Rewrite", hint: "Improve clarity and flow" },
  { id: "translate", label: "Translate to English", hint: "Natural English translation" },
  { id: "shorten", label: "Shorten", hint: "Make the text concise" },
  { id: "formal", label: "Formal tone", hint: "Professional wording" },
  { id: "friendly", label: "Friendly tone", hint: "Warm, natural wording" },
]);

const ACTION_LABELS = Object.freeze({
  fix: "Corrected",
  rewrite: "Rewritten",
  translate: "English Translation",
  shorten: "Shortened",
  formal: "Formal Tone",
  friendly: "Friendly Tone",
});

function isTypePilotPath(path) {
  return path.some((node) => node?.id === "typepilot-btn" || node?.id === "typepilot-popup");
}

function cancelActiveRequest() {
  if (!activeRequestId) return;

  const requestId = activeRequestId;
  activeRequestId = null;
  if (!chrome.runtime?.id) return;

  try {
    chrome.runtime.sendMessage({ type: "TYPEPILOT_CANCEL", requestId }).catch(() => {});
  } catch {
    // The extension may have been reloaded while this page remained open.
  }
}

function removeFloatingControl() {
  floatingControl?.remove();
  floatingControl = null;
  primaryButton = null;
  menuButton = null;
  actionMenu = null;
}

function removePopup() {
  popup?.remove();
  popup = null;
}

function removeAllUI({ cancelRequest = true } = {}) {
  if (cancelRequest) cancelActiveRequest();
  removeFloatingControl();
  removePopup();
}

function isNativeField(element) {
  if (!element) return false;
  if (element.tagName === "TEXTAREA") return true;
  return element.tagName === "INPUT" && /^(text|search|url|email)$/i.test(element.type ?? "text");
}

function getContentEditableRoot(element) {
  if (!element?.closest) return null;
  return element.closest('[contenteditable="true"], [contenteditable=""]') ?? null;
}

function isEditableField(element) {
  return isNativeField(element) || Boolean(getContentEditableRoot(element));
}

document.addEventListener("focusin", (event) => {
  const path = event.composedPath?.() ?? [];
  const element = path[0] ?? event.target;
  const editableRoot = getContentEditableRoot(element);

  if (editableRoot) {
    activeElement = editableRoot;
    activeMode = "contenteditable";
  } else if (isNativeField(element)) {
    activeElement = element;
    activeMode = "native";
  }
});

function createSparkleIcon() {
  const icon = document.createElement("span");
  icon.className = "typepilot-icon-wrap";
  icon.innerHTML = `
    <svg class="typepilot-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M10 2L12.09 7.26L17.5 8.27L13.75 11.97L14.62 17.5L10 14.77L5.38 17.5L6.25 11.97L2.5 8.27L7.91 7.26L10 2Z"
        stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="currentColor" fill-opacity="0.15"/>
    </svg>`;
  return icon;
}

function showFloatingControl(x, y) {
  removeFloatingControl();
  removePopup();

  floatingControl = document.createElement("div");
  floatingControl.id = "typepilot-btn";
  floatingControl.className = "typepilot-split";
  floatingControl.setAttribute("role", "group");
  floatingControl.setAttribute("aria-label", "TypePilot writing actions");

  primaryButton = document.createElement("button");
  primaryButton.type = "button";
  primaryButton.className = "typepilot-split__primary";
  primaryButton.setAttribute("aria-label", "Fix selected text");
  primaryButton.appendChild(createSparkleIcon());

  const spinner = document.createElement("span");
  spinner.className = "typepilot-spinner";
  spinner.hidden = true;
  primaryButton.appendChild(spinner);

  const label = document.createElement("span");
  label.className = "typepilot-split__label";
  label.textContent = "Fix";
  primaryButton.appendChild(label);
  primaryButton.addEventListener("click", () => handleActionClick("fix"));

  menuButton = document.createElement("button");
  menuButton.type = "button";
  menuButton.className = "typepilot-split__toggle";
  menuButton.setAttribute("aria-label", "Open other TypePilot actions");
  menuButton.setAttribute("aria-haspopup", "menu");
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.innerHTML = `
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

  actionMenu = document.createElement("div");
  actionMenu.className = "typepilot-action-menu";
  actionMenu.setAttribute("role", "menu");
  actionMenu.hidden = true;

  for (const action of SECONDARY_ACTIONS) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "typepilot-action-menu__item";
    item.setAttribute("role", "menuitem");

    const itemLabel = document.createElement("span");
    itemLabel.className = "typepilot-action-menu__label";
    itemLabel.textContent = action.label;

    const itemHint = document.createElement("span");
    itemHint.className = "typepilot-action-menu__hint";
    itemHint.textContent = action.hint;

    item.append(itemLabel, itemHint);
    item.addEventListener("click", () => {
      closeActionMenu();
      handleActionClick(action.id);
    });
    actionMenu.appendChild(item);
  }

  menuButton.addEventListener("click", () => {
    const willOpen = actionMenu.hidden;
    actionMenu.hidden = !willOpen;
    menuButton.setAttribute("aria-expanded", String(willOpen));
    floatingControl.classList.toggle("typepilot-split--open", willOpen);

    if (willOpen) {
      requestAnimationFrame(() => {
        positionActionMenu();
        actionMenu.querySelector("button")?.focus({ preventScroll: true });
      });
    }
  });

  floatingControl.append(primaryButton, menuButton, actionMenu);
  floatingControl.style.left = `${x + window.scrollX + 12}px`;
  floatingControl.style.top = `${y + window.scrollY + 12}px`;
  document.body.appendChild(floatingControl);

  requestAnimationFrame(clampFloatingControl);
}

function closeActionMenu() {
  if (!actionMenu || !menuButton || !floatingControl) return;
  actionMenu.hidden = true;
  menuButton.setAttribute("aria-expanded", "false");
  floatingControl.classList.remove("typepilot-split--open", "typepilot-split--menu-up");
}

function clampFloatingControl() {
  if (!floatingControl) return;

  const rect = floatingControl.getBoundingClientRect();
  const margin = 8;
  let left = Number.parseFloat(floatingControl.style.left) || 0;
  let top = Number.parseFloat(floatingControl.style.top) || 0;

  if (rect.right > window.innerWidth - margin) left -= rect.right - window.innerWidth + margin;
  if (rect.left < margin) left += margin - rect.left;
  if (rect.bottom > window.innerHeight - margin) top -= rect.bottom - window.innerHeight + margin;
  if (rect.top < margin) top += margin - rect.top;

  floatingControl.style.left = `${left}px`;
  floatingControl.style.top = `${top}px`;
}

function positionActionMenu() {
  if (!actionMenu || !floatingControl) return;

  floatingControl.classList.remove("typepilot-split--menu-up");
  const menuRect = actionMenu.getBoundingClientRect();
  if (menuRect.bottom > window.innerHeight - 8) {
    floatingControl.classList.add("typepilot-split--menu-up");
  }
}

function setControlLoading(isLoading) {
  if (!floatingControl || !primaryButton || !menuButton) return;

  floatingControl.classList.toggle("typepilot-split--loading", isLoading);
  primaryButton.disabled = isLoading;
  menuButton.disabled = isLoading;
  primaryButton.setAttribute("aria-busy", String(isLoading));

  const icon = primaryButton.querySelector(".typepilot-icon-wrap");
  const spinner = primaryButton.querySelector(".typepilot-spinner");
  if (icon) icon.hidden = isLoading;
  if (spinner) spinner.hidden = !isLoading;
  closeActionMenu();
}

document.addEventListener("mouseup", (event) => {
  const path = event.composedPath?.() ?? [];
  if (isTypePilotPath(path)) return;

  const pathNativeField = path.find((node) => isNativeField(node));
  if (pathNativeField) {
    activeElement = pathNativeField;
    activeMode = "native";
  }

  const wasInActiveNative =
    activeMode === "native" &&
    activeElement &&
    isNativeField(activeElement) &&
    path.includes(activeElement);

  setTimeout(() => {
    if (wasInActiveNative) {
      const start = activeElement.selectionStart ?? 0;
      const end = activeElement.selectionEnd ?? 0;
      const selectedText = activeElement.value.slice(start, end).trim();

      if (selectedText.length >= 2) {
        savedSelection = { start, end };
        savedRange = null;
        showFloatingControl(event.clientX, event.clientY);
      } else {
        removeAllUI();
      }
      return;
    }

    const selection = window.getSelection();
    let target = selection?.anchorNode;
    if (target && target.nodeType !== Node.ELEMENT_NODE) target = target.parentElement;

    const editableRoot = getContentEditableRoot(target);
    if (!target || !isEditableField(target) || !editableRoot) {
      removeAllUI();
      return;
    }

    const selectedText = selection?.rangeCount ? selection.toString().trim() : "";
    if (selectedText.length >= 2) {
      activeElement = editableRoot;
      activeMode = "contenteditable";
      savedRange = selection.getRangeAt(0).cloneRange();
      savedSelection = { start: 0, end: 0 };
      showFloatingControl(event.clientX, event.clientY);
    } else {
      removeAllUI();
    }
  }, 10);
});

document.addEventListener("mousedown", (event) => {
  const path = event.composedPath?.() ?? [];
  if (!isTypePilotPath(path)) removeAllUI();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (actionMenu && !actionMenu.hidden) {
    closeActionMenu();
    menuButton?.focus({ preventScroll: true });
    return;
  }
  removeAllUI();
});

function getSelectedText() {
  if (activeMode === "native" && activeElement) {
    return activeElement.value.slice(savedSelection.start, savedSelection.end);
  }
  return savedRange?.toString() ?? "";
}

function createRequestId() {
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function handleActionClick(actionId = "fix", explicitAnchor = null, explicitText = null) {
  const selectedText = explicitText ?? getSelectedText();
  if (!selectedText.trim()) {
    removeAllUI();
    return;
  }

  let anchorX;
  let anchorY;
  if (explicitAnchor) {
    anchorX = explicitAnchor.x;
    anchorY = explicitAnchor.y;
  } else if (floatingControl) {
    const rect = floatingControl.getBoundingClientRect();
    anchorX = rect.left;
    anchorY = rect.bottom;
  } else {
    return;
  }

  cancelActiveRequest();
  setControlLoading(true);

  if (!chrome.runtime?.id) {
    showErrorPopup({
      code: "CONTEXT_INVALIDATED",
      message: "TypePilot was updated. Reload this page to continue.",
      retriable: false,
    }, anchorX, anchorY, { text: selectedText, actionId });
    return;
  }

  const requestId = createRequestId();
  activeRequestId = requestId;

  try {
    const response = await chrome.runtime.sendMessage({
      type: "TYPEPILOT_PROCESS",
      requestId,
      action: actionId,
      text: selectedText,
    });

    if (activeRequestId !== requestId) return;
    activeRequestId = null;

    if (response?.success && typeof response.result === "string") {
      showResultPopup(response.result, anchorX, anchorY, {
        action: response.action ?? actionId,
        actionLabel: response.actionLabel ?? ACTION_LABELS[actionId],
        model: response.model,
        usage: response.usage,
        durationMs: response.durationMs,
        cached: response.cached,
      });
      return;
    }

    if (response?.code === "CANCELLED") return;
    showErrorPopup({
      code: response?.code ?? "UNKNOWN",
      message: response?.error ?? "Unknown error.",
      retriable: response?.retriable ?? false,
    }, anchorX, anchorY, { text: selectedText, actionId });
  } catch (error) {
    if (activeRequestId !== requestId) return;
    activeRequestId = null;

    const isContextError = error?.message?.toLowerCase().includes("context invalidated");
    showErrorPopup({
      code: isContextError ? "CONTEXT_INVALIDATED" : "MESSAGING_ERROR",
      message: isContextError
        ? "TypePilot was updated. Reload this page to continue."
        : (error?.message || "Could not reach the TypePilot service worker."),
      retriable: !isContextError,
    }, anchorX, anchorY, { text: selectedText, actionId });
  }
}

function setNativeFieldValue(element, value) {
  const prototype = element.tagName === "TEXTAREA"
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

  if (nativeSetter) nativeSetter.call(element, value);
  else element.value = value;
}

function replaceSelectedText(replacement) {
  if (activeMode === "native" && activeElement) {
    const { start, end } = savedSelection;
    const original = activeElement.value;
    const nextValue = original.slice(0, start) + replacement + original.slice(end);

    const beforeInput = new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "insertReplacementText",
      data: replacement,
    });
    if (!activeElement.dispatchEvent(beforeInput)) return;

    setNativeFieldValue(activeElement, nextValue);
    const newCursor = start + replacement.length;
    activeElement.setSelectionRange(newCursor, newCursor);
    activeElement.focus();
    activeElement.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      inputType: "insertReplacementText",
      data: replacement,
    }));
    activeElement.dispatchEvent(new Event("change", { bubbles: true }));
  } else if (savedRange) {
    try {
      activeElement?.focus();
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(savedRange);

      const beforeInput = new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        inputType: "insertText",
        data: replacement,
      });
      if (activeElement && !activeElement.dispatchEvent(beforeInput)) return;

      let inserted = false;
      try {
        inserted = document.execCommand("insertText", false, replacement);
      } catch {
        inserted = false;
      }

      if (!inserted) {
        savedRange.deleteContents();
        const textNode = document.createTextNode(replacement);
        savedRange.insertNode(textNode);
        savedRange.setStartAfter(textNode);
        savedRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(savedRange);

        activeElement?.dispatchEvent(new InputEvent("input", {
          bubbles: true,
          inputType: "insertText",
          data: replacement,
        }));
      }
    } catch (error) {
      console.error("[TypePilot] Contenteditable replacement error:", error);
    }
  }

  removeAllUI({ cancelRequest: false });
}

function clampPopupToViewport(element, anchorY) {
  const rect = element.getBoundingClientRect();
  const margin = 8;
  let left = Number.parseFloat(element.style.left) || 0;
  let top = Number.parseFloat(element.style.top) || 0;

  if (rect.right > window.innerWidth - margin) left -= rect.right - window.innerWidth + margin;
  if (rect.left < margin) left += margin - rect.left;
  if (rect.bottom > window.innerHeight - margin) {
    top = anchorY + window.scrollY - rect.height - margin;
  }
  if (top - window.scrollY < margin) top = window.scrollY + margin;

  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
}

function createPopupHeader(titleText, meta = null) {
  const header = document.createElement("div");
  header.className = "typepilot-popup__header";

  const title = document.createElement("span");
  title.className = "typepilot-popup__title";
  title.appendChild(createSparkleIcon());
  const titleLabel = document.createElement("span");
  titleLabel.textContent = titleText;
  title.appendChild(titleLabel);
  header.appendChild(title);

  let infoPanel = null;
  if (meta) {
    const infoButton = document.createElement("button");
    infoButton.type = "button";
    infoButton.className = "typepilot-popup__info-btn";
    infoButton.setAttribute("aria-label", "Request information");
    infoButton.setAttribute("aria-expanded", "false");
    infoButton.innerHTML = `
      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="10" cy="10" r="7.5" stroke="currentColor" stroke-width="1.5"/>
        <path d="M10 9v5M10 6.2v.1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
      </svg>`;

    infoPanel = document.createElement("div");
    infoPanel.className = "typepilot-popup__info-panel";
    infoPanel.hidden = true;

    const rows = [];
    if (meta.model) rows.push(["Model", meta.model]);
    if (meta.actionLabel) rows.push(["Action", meta.actionLabel]);
    if (meta.usage?.promptTokens != null) rows.push(["Prompt tokens", meta.usage.promptTokens]);
    if (meta.usage?.responseTokens != null) rows.push(["Response tokens", meta.usage.responseTokens]);
    if (meta.usage?.totalTokens != null) rows.push(["Total tokens", meta.usage.totalTokens]);
    if (meta.durationMs != null) rows.push(["Response time", meta.cached ? "Instant cache" : `${(meta.durationMs / 1000).toFixed(2)} s`]);

    for (const [label, value] of rows) {
      const row = document.createElement("div");
      row.className = "typepilot-popup__info-row";
      const labelElement = document.createElement("span");
      labelElement.className = "typepilot-popup__info-label";
      labelElement.textContent = label;
      const valueElement = document.createElement("span");
      valueElement.className = "typepilot-popup__info-value";
      valueElement.textContent = value;
      row.append(labelElement, valueElement);
      infoPanel.appendChild(row);
    }

    infoButton.addEventListener("click", () => {
      const willOpen = infoPanel.hidden;
      infoPanel.hidden = !willOpen;
      infoButton.setAttribute("aria-expanded", String(willOpen));
      infoButton.classList.toggle("typepilot-popup__info-btn--active", willOpen);
    });
    header.appendChild(infoButton);
  }

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "typepilot-popup__close";
  closeButton.setAttribute("aria-label", "Close");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", () => removeAllUI({ cancelRequest: false }));
  header.appendChild(closeButton);

  return { header, infoPanel };
}

function showResultPopup(result, x, y, meta = {}) {
  removeFloatingControl();
  removePopup();

  popup = document.createElement("div");
  popup.id = "typepilot-popup";
  popup.className = "typepilot-popup";
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-label", "TypePilot result");

  const actionLabel = meta.actionLabel ?? ACTION_LABELS[meta.action] ?? "Result";
  const { header, infoPanel } = createPopupHeader("TypePilot", { ...meta, actionLabel });
  popup.appendChild(header);
  if (infoPanel) popup.appendChild(infoPanel);

  const list = document.createElement("div");
  list.className = "typepilot-popup__list";

  const item = document.createElement("div");
  item.className = "typepilot-popup__item";
  const label = document.createElement("span");
  label.className = "typepilot-popup__item-label";
  label.textContent = actionLabel;

  const resultButton = document.createElement("button");
  resultButton.type = "button";
  resultButton.className = "typepilot-popup__item-text";
  resultButton.textContent = result;
  resultButton.title = "Replace the selected text";
  resultButton.addEventListener("click", () => replaceSelectedText(result));

  item.append(label, resultButton);
  list.appendChild(item);
  popup.appendChild(list);

  const hint = document.createElement("p");
  hint.className = "typepilot-popup__hint";
  hint.textContent = "Click the result to replace the selected text.";
  popup.appendChild(hint);

  popup.style.left = `${x + window.scrollX + 8}px`;
  popup.style.top = `${y + window.scrollY + 8}px`;
  document.body.appendChild(popup);
  requestAnimationFrame(() => clampPopupToViewport(popup, y));
}

function showErrorPopup(error, x, y, retryContext = null) {
  removeFloatingControl();
  removePopup();

  const { code = "UNKNOWN", message = "Unknown error.", retriable = false } = error ?? {};
  popup = document.createElement("div");
  popup.id = "typepilot-popup";
  popup.className = "typepilot-popup typepilot-popup--error";
  popup.setAttribute("role", "alert");

  const { header } = createPopupHeader("TypePilot Error");
  const codeBadge = document.createElement("span");
  codeBadge.className = "typepilot-popup__code";
  codeBadge.textContent = code;
  codeBadge.title = "Error code";
  header.insertBefore(codeBadge, header.lastElementChild);
  popup.appendChild(header);

  const messageElement = document.createElement("p");
  messageElement.className = "typepilot-popup__error-msg";
  messageElement.textContent = message;
  popup.appendChild(messageElement);

  const actions = document.createElement("div");
  actions.className = "typepilot-popup__actions";

  if (retriable && retryContext?.text) {
    const retryButton = document.createElement("button");
    retryButton.type = "button";
    retryButton.className = "typepilot-popup__btn typepilot-popup__btn--primary";
    retryButton.textContent = "Try Again";
    retryButton.addEventListener("click", () => {
      removePopup();
      showFloatingControl(x, y);
      handleActionClick(retryContext.actionId, { x, y }, retryContext.text);
    });
    actions.appendChild(retryButton);
  }

  if (["NO_KEY", "INVALID_KEY", "MODEL_NOT_FOUND", "QUOTA_EXCEEDED"].includes(code)) {
    const settingsButton = document.createElement("button");
    settingsButton.type = "button";
    settingsButton.className = "typepilot-popup__btn";
    settingsButton.textContent = "Open Settings";
    settingsButton.addEventListener("click", () => {
      if (chrome.runtime?.id) {
        try {
          chrome.runtime.sendMessage({ type: "TYPEPILOT_OPEN_SETTINGS" }).catch(() => {});
        } catch {
          // The page must be reloaded if the extension context is stale.
        }
      }
      removeAllUI({ cancelRequest: false });
    });
    actions.appendChild(settingsButton);
  }

  if (actions.children.length) popup.appendChild(actions);

  popup.style.left = `${x + window.scrollX}px`;
  popup.style.top = `${y + window.scrollY + 8}px`;
  document.body.appendChild(popup);
  requestAnimationFrame(() => clampPopupToViewport(popup, y));
}
