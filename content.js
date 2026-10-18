/**
 * TypePilot content script.
 * Detects editable selections, renders the split Fix control, sends actions to
 * the service worker and replaces the selected text with the chosen result.
 */

let activeElement = null;
let activeMode = "native";
let savedSelection = { start: 0, end: 0 };
let savedRange = null;
let selectionCheckTimer = null;
let isReplacingText = false;
let selectionSnapshot = null;
let isCopyingText = false;

let floatingControl = null;
let primaryButton = null;
let menuButton = null;
let actionMenu = null;
let popup = null;
let activeRequestId = null;
let translationLanguageLabel = "English";

function getSecondaryActions() {
  return [
    { id: "rewrite", label: "Rewrite", hint: "Improve clarity and flow" },
    {
      id: "translate",
      label: `Translate to ${translationLanguageLabel}`,
      hint: `Natural ${translationLanguageLabel} translation`,
    },
    { id: "shorten", label: "Shorten", hint: "Make the text concise" },
    { id: "xpost", label: "Post for X", hint: "Fit 280 characters with hashtags" },
    { id: "formal", label: "Formal tone", hint: "Professional wording" },
    { id: "friendly", label: "Friendly tone", hint: "Warm, natural wording" },
  ];
}

const ACTION_LABELS = Object.freeze({
  fix: "Corrected",
  rewrite: "Rewritten",
  shorten: "Shortened",
  xpost: "Post for X",
  formal: "Formal Tone",
  friendly: "Friendly Tone",
});

function getActionLabel(actionId) {
  if (actionId === "translate") return `${translationLanguageLabel} Translation`;
  return ACTION_LABELS[actionId];
}

function updateTranslationActionUi() {
  const item = actionMenu?.querySelector('[data-typepilot-action="translate"]');
  if (!item) return;

  const label = item.querySelector(".typepilot-action-menu__label");
  const hint = item.querySelector(".typepilot-action-menu__hint");
  if (label) label.textContent = `Translate to ${translationLanguageLabel}`;
  if (hint) hint.textContent = `Natural ${translationLanguageLabel} translation`;
}

async function refreshTranslationLanguage() {
  if (!chrome.runtime?.id) return;

  try {
    const response = await chrome.runtime.sendMessage({ type: "TYPEPILOT_GET_UI_SETTINGS" });
    if (!response?.success || typeof response.translationLanguageLabel !== "string") return;

    const languageLabel = response.translationLanguageLabel.trim();
    if (!languageLabel || languageLabel.length > 40) return;
    translationLanguageLabel = languageLabel;
    updateTranslationActionUi();
  } catch {
    // The extension may have been reloaded while this page remained open.
  }
}

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
  if (!element || element.disabled || element.readOnly) return false;
  if (element.tagName === "TEXTAREA") return true;
  return element.tagName === "INPUT" && /^(text|search|url|tel)$/i.test(element.type ?? "text");
}

function getContentEditableRoot(element) {
  if (!element?.closest) return null;
  const declaredRoot = element.closest("[contenteditable]");
  if (declaredRoot) {
    return declaredRoot.getAttribute("contenteditable") === "false" ? null : declaredRoot;
  }
  if (!element.isContentEditable) return null;

  let root = element;
  while (root.parentElement?.isContentEditable) root = root.parentElement;
  return root;
}

function getDeepActiveElement() {
  let element = document.activeElement;
  while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
  return element;
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
  floatingControl.addEventListener("mousedown", (event) => event.preventDefault());
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

  for (const action of getSecondaryActions()) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "typepilot-action-menu__item";
    item.setAttribute("role", "menuitem");
    item.dataset.typepilotAction = action.id;

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
  void refreshTranslationLanguage();
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

function isTypePilotFocused() {
  const focused = document.activeElement;
  return Boolean(focused?.closest?.("#typepilot-btn, #typepilot-popup"));
}

function getSelectionAnchor(selection, fallbackElement = activeElement) {
  if (selection?.rangeCount) {
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (rect.width || rect.height) return { x: rect.right, y: rect.bottom };
  }
  const rect = fallbackElement?.getBoundingClientRect?.();
  if (rect) return { x: Math.min(rect.right, window.innerWidth - 24), y: rect.bottom };
  return { x: 20, y: 20 };
}

function inspectCurrentSelection(anchor = null, pathNativeField = null) {
  if (isReplacingText || isCopyingText || activeRequestId || isTypePilotFocused() || popup) return;
  if (actionMenu && !actionMenu.hidden) return;

  if (pathNativeField) {
    activeElement = pathNativeField;
    activeMode = "native";
  }

  if (activeMode === "native" && activeElement === getDeepActiveElement() && isNativeField(activeElement)) {
    const start = activeElement.selectionStart ?? 0;
    const end = activeElement.selectionEnd ?? 0;
    const selectedText = activeElement.value.slice(start, end).trim();
    if (selectedText.length < 2) {
      removeAllUI();
      return;
    }

    if (floatingControl && selectionSnapshot?.element === activeElement
      && selectionSnapshot.start === start && selectionSnapshot.end === end
      && TypePilotEditor.isCurrent(selectionSnapshot)) return;
    savedSelection = { start, end };
    savedRange = null;
    selectionSnapshot = TypePilotEditor.capture(activeElement, "native", savedSelection);
    const position = anchor ?? getSelectionAnchor(null, activeElement);
    showFloatingControl(position.x, position.y);
    return;
  }

  const selection = window.getSelection();
  let target = selection?.anchorNode;
  if (target && target.nodeType !== Node.ELEMENT_NODE) target = target.parentElement;
  const editableRoot = getContentEditableRoot(target);
  const selectedText = selection?.rangeCount ? selection.toString().trim() : "";
  if (!editableRoot || selectedText.length < 2) {
    removeAllUI();
    return;
  }

  const nextSnapshot = TypePilotEditor.capture(editableRoot, "contenteditable", selection.getRangeAt(0));
  if (floatingControl && nextSnapshot && selectionSnapshot?.element === editableRoot
    && selectionSnapshot.start === nextSnapshot.start && selectionSnapshot.end === nextSnapshot.end
    && TypePilotEditor.isCurrent(selectionSnapshot)) return;
  activeElement = editableRoot;
  activeMode = "contenteditable";
  savedRange = selection.getRangeAt(0).cloneRange();
  selectionSnapshot = nextSnapshot;
  if (!selectionSnapshot) return;
  savedSelection = { start: 0, end: 0 };
  const position = anchor ?? getSelectionAnchor(selection, editableRoot);
  showFloatingControl(position.x, position.y);
}

function scheduleSelectionInspection(anchor = null, pathNativeField = null) {
  clearTimeout(selectionCheckTimer);
  selectionCheckTimer = setTimeout(() => {
    selectionCheckTimer = null;
    inspectCurrentSelection(anchor, pathNativeField);
  }, 30);
}

document.addEventListener("pointerup", (event) => {
  const path = event.composedPath?.() ?? [];
  if (isTypePilotPath(path)) return;
  const pathNativeField = path.find((node) => isNativeField(node)) ?? null;
  scheduleSelectionInspection({ x: event.clientX, y: event.clientY }, pathNativeField);
}, true);

document.addEventListener("selectionchange", () => {
  scheduleSelectionInspection();
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

document.addEventListener("keyup", (event) => {
  if (event.key === "Escape" || isTypePilotPath(event.composedPath?.() ?? [])) return;
  const path = event.composedPath?.() ?? [];
  const pathNativeField = path.find((node) => isNativeField(node)) ?? null;
  scheduleSelectionInspection(null, pathNativeField);
}, true);

function getSelectedText() {
  return selectionSnapshot?.selectedText ?? "";
}

function createRequestId() {
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

try {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "TYPEPILOT_FIX_SELECTION" || !document.hasFocus()) return false;
    const focused = getDeepActiveElement();
    if (!isNativeField(focused) && !getContentEditableRoot(focused)) return false;
    removeAllUI();
    inspectCurrentSelection(null, isNativeField(focused) ? focused : null);
    if (!selectionSnapshot?.selectedText.trim() || !floatingControl) return false;
    void handleActionClick("fix");
    sendResponse({ success: true });
    return false;
  });
} catch {
  // A reloaded extension requires the existing page to be reloaded as well.
}

async function handleActionClick(actionId = "fix", explicitAnchor = null, explicitText = null, snapshot = selectionSnapshot) {
  const selectedText = explicitText ?? snapshot?.selectedText ?? "";
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
    }, anchorX, anchorY, { text: selectedText, actionId, snapshot });
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
      xContext: actionId === "xpost" && snapshot ? {
        prefix: snapshot.fullText.slice(0, snapshot.start),
        suffix: snapshot.fullText.slice(snapshot.end),
      } : undefined,
    });

    if (activeRequestId !== requestId) return;
    activeRequestId = null;

    if (response?.success && typeof response.result === "string") {
      showResultPopup(response.result, anchorX, anchorY, {
        action: response.action ?? actionId,
        actionLabel: response.actionLabel ?? getActionLabel(actionId),
        model: response.model,
        usage: response.usage,
        durationMs: response.durationMs,
        cached: response.cached,
        xWeightedLength: response.xWeightedLength,
        snapshot,
      });
      return;
    }

    if (response?.code === "CANCELLED") return;
    showErrorPopup({
      code: response?.code ?? "UNKNOWN",
      message: response?.error ?? "Unknown error.",
      retriable: response?.retriable ?? false,
    }, anchorX, anchorY, { text: selectedText, actionId, snapshot });
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
    }, anchorX, anchorY, { text: selectedText, actionId, snapshot });
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

async function saveReplacementBackup(snapshot, action) {
  if (!chrome.runtime?.id) throw new Error("TypePilot was updated. Reload this page to continue.");
  const response = await chrome.runtime.sendMessage({
    type: "TYPEPILOT_SAVE_BACKUP",
    selectedText: snapshot.selectedText,
    fullText: snapshot.fullText,
    action,
  });
  if (!response?.success) throw new Error(response?.error || "Could not create a Recovery copy. Use Copy result instead.");
}

function dispatchNativeInput(element, text) {
  element.dispatchEvent(new InputEvent("input", {
    bubbles: true, composed: true, inputType: "insertReplacementText", data: text,
  }));
}

function restoreOriginal(snapshot) {
  const { element, mode, fullText } = snapshot;
  if (!element.isConnected) return false;
  try {
    if (mode === "native") {
      setNativeFieldValue(element, fullText);
      dispatchNativeInput(element, fullText);
    } else {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(element);
      element.focus({ preventScroll: true });
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand("insertText", false, fullText);
    }
    return TypePilotEditor.read(element, mode) === fullText;
  } catch {
    return false;
  }
}

async function replaceSelectedText(replacement, meta = {}) {
  if (isReplacingText) return;
  const snapshot = meta.snapshot;
  const rect = popup?.getBoundingClientRect();
  const x = rect?.left ?? 20;
  const y = rect?.top ?? 20;
  isReplacingText = true;
  let userEdited = false;
  let performingInsertion = false;
  const recordUserInput = (event) => {
    if (event.isTrusted && !performingInsertion) userEdited = true;
  };
  try {
    if (!snapshot) throw new Error("Select the original text again. You can still copy this result.");
    // Preserve the request's original text even if a reactive editor removed its node.
    await saveReplacementBackup(snapshot, meta.action ?? "fix");
    if (!TypePilotEditor.isCurrent(snapshot)) {
      throw new Error("The editor changed after this request. No text was replaced. Copy the result or select the new text again.");
    }
    const { element, mode } = snapshot;
    const nextText = TypePilotEditor.expected(snapshot, replacement);
    if (meta.action === "xpost") {
      const check = TypePilotX.validate(snapshot.selectedText, replacement, {
        prefix: snapshot.fullText.slice(0, snapshot.start),
        suffix: snapshot.fullText.slice(snapshot.end),
      });
      if (!check.valid) throw new Error(check.reason);
    }
    element.addEventListener("beforeinput", recordUserInput);
    element.focus({ preventScroll: true });
    if (!TypePilotEditor.isCurrent(snapshot)) throw new Error("The editor changed on focus. Use Copy result instead.");
    performingInsertion = true;
    if (mode === "native") {
      const allowed = element.dispatchEvent(new InputEvent("beforeinput", {
        bubbles: true, composed: true, cancelable: true, inputType: "insertReplacementText", data: replacement,
      }));
      if (!allowed || !TypePilotEditor.isCurrent(snapshot)) {
        throw new Error("This editor blocked or changed the replacement. Use Copy result instead.");
      }
      setNativeFieldValue(element, nextText);
      const cursor = snapshot.start + replacement.length;
      element.setSelectionRange(cursor, cursor);
      dispatchNativeInput(element, replacement);
    } else {
      const range = TypePilotEditor.range(snapshot);
      if (!range) throw new Error("The selection is no longer valid. Use Copy result instead.");
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      const allowed = element.dispatchEvent(new InputEvent("beforeinput", {
        bubbles: true, composed: true, cancelable: true, inputType: "insertText", data: replacement,
      }));
      if (!allowed || !TypePilotEditor.isCurrent(snapshot)) {
        throw new Error("This editor blocked or changed the replacement. Use Copy result instead.");
      }
      // Browser-native insertion integrates with editor state. Do not force DOM mutations
      // into a framework editor or undo an unrelated entry from its history.
      const inserted = document.execCommand("insertText", false, replacement);
      if (!inserted && TypePilotEditor.isCurrent(snapshot)) {
        throw new Error("This editor does not support safe replacement. Use Copy result instead.");
      }
    }
    performingInsertion = false;
    const immediate = TypePilotEditor.read(element, mode);
    if (immediate !== nextText) {
      if (immediate !== snapshot.fullText) restoreOriginal(snapshot);
      throw new Error("The editor rejected the complete replacement. The original is available in Recovery.");
    }
    await new Promise((resolve) => setTimeout(resolve, 60));
    if (!element.isConnected) throw new Error("The editor was replaced by the page. The original is available in Recovery.");
    const settled = TypePilotEditor.read(element, mode);
    if (!userEdited && settled !== nextText) {
      if (!settled || settled === replacement) restoreOriginal(snapshot);
      throw new Error("The page rejected the replacement. The original is available in Recovery.");
    }
    removeAllUI({ cancelRequest: false });
  } catch (error) {
    showResultPopup(replacement, x, y, {
      ...meta,
      replacementError: error?.message || "Could not replace safely. Use Copy result instead.",
    });
  } finally {
    snapshot?.element?.removeEventListener("beforeinput", recordUserInput);
    isReplacingText = false;
  }
}

async function copyResult(text) {
  isCopyingText = true;
  try {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const field = document.createElement("textarea");
      field.value = text;
      field.style.cssText = "position:fixed;left:-10000px;top:0";
      document.body.appendChild(field);
      field.select();
      const success = document.execCommand("copy");
      field.remove();
      return success;
    }
  } finally {
    isCopyingText = false;
  }
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
    if (meta.xWeightedLength != null) rows.push(["X length", `${meta.xWeightedLength}/280`]);

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

  const actionLabel = meta.actionLabel ?? getActionLabel(meta.action) ?? "Result";
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
  resultButton.addEventListener("click", () => {
    void replaceSelectedText(result, meta);
  });

  item.append(label, resultButton);
  list.appendChild(item);
  popup.appendChild(list);

  const hint = document.createElement("p");
  hint.className = "typepilot-popup__hint";
  hint.textContent = "Click the result to replace the selected text.";
  hint.setAttribute("role", "status");
  if (meta.replacementError) hint.textContent = meta.replacementError;
  popup.appendChild(hint);

  const actions = document.createElement("div");
  actions.className = "typepilot-popup__actions";
  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "typepilot-popup__btn";
  copyButton.textContent = "Copy result";
  copyButton.addEventListener("click", async () => {
    const copied = await copyResult(result);
    hint.textContent = copied ? "Result copied. Paste it into your editor." : "Could not copy. Select the result text and copy it manually.";
  });
  actions.appendChild(copyButton);
  if (meta.replacementError) {
    const recoveryButton = document.createElement("button");
    recoveryButton.type = "button";
    recoveryButton.className = "typepilot-popup__btn";
    recoveryButton.textContent = "Open Recovery";
    recoveryButton.addEventListener("click", () => {
      try {
        if (chrome.runtime?.id) chrome.runtime.sendMessage({ type: "TYPEPILOT_OPEN_SETTINGS", section: "recovery" }).catch(() => {});
      } catch { /* The page may need reloading after an extension update. */ }
    });
    actions.appendChild(recoveryButton);
  }
  popup.appendChild(actions);

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
      handleActionClick(retryContext.actionId, { x, y }, retryContext.text, retryContext.snapshot);
    });
    actions.appendChild(retryButton);
  }

  if (["NO_KEY", "INVALID_KEY", "MODEL_NOT_FOUND", "QUOTA_EXCEEDED", "REPLACEMENT_FAILED"].includes(code)) {
    const settingsButton = document.createElement("button");
    settingsButton.type = "button";
    settingsButton.className = "typepilot-popup__btn";
    settingsButton.textContent = code === "REPLACEMENT_FAILED" ? "Open Recovery" : "Open Settings";
    settingsButton.addEventListener("click", () => {
      if (chrome.runtime?.id) {
        try {
          chrome.runtime.sendMessage({
            type: "TYPEPILOT_OPEN_SETTINGS",
            section: code === "REPLACEMENT_FAILED" ? "recovery" : "settings",
          }).catch(() => {});
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
