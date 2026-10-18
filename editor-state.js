/* Immutable edit transactions and DOM text offsets shared by selection and replacement. */
(function (scope) {
  "use strict";
  const BLOCKS = new Set(["DIV", "P", "LI", "UL", "OL", "BLOCKQUOTE", "PRE", "H1", "H2", "H3", "H4", "H5", "H6"]);
  function model(root) {
    let text = "";
    const positions = new WeakMap();
    const segments = [];
    const siblingPoint = (node, after) => ({
      node: node.parentNode,
      offset: Array.prototype.indexOf.call(node.parentNode.childNodes, node) + Number(after),
    });
    function newline(startPoint, endPoint, explicit = false) {
      const start = text.length;
      text += "\n";
      segments.push({ start, end: text.length, startPoint, endPoint, explicit });
    }
    function visit(node, isRoot = false) {
      if (node.nodeType === 3) {
        const start = text.length;
        text += node.nodeValue ?? "";
        segments.push({ start, end: text.length, node });
        positions.set(node, start);
        return;
      }
      if (node.nodeType !== 1 && node.nodeType !== 11) return;
      if (node.tagName === "BR") {
        const before = siblingPoint(node, false);
        newline(before, siblingPoint(node, true), true);
        positions.set(node, [text.length - 1]);
        return;
      }
      const block = !isRoot && BLOCKS.has(node.tagName);
      if (block && text && !text.endsWith("\n")) {
        const point = siblingPoint(node, false);
        newline(point, { node, offset: 0 });
      }
      const boundaries = [text.length];
      for (const child of node.childNodes) {
        visit(child);
        boundaries.push(text.length);
      }
      positions.set(node, boundaries);
      if (block && !text.endsWith("\n")) {
        newline({ node, offset: node.childNodes.length }, siblingPoint(node, true));
      }
    }
    visit(root, true);
    // A closing block separator is layout, not an additional trailing paragraph.
    const last = segments[segments.length - 1];
    if (last && !last.node && !last.explicit && last.end === text.length) {
      // Preserve explicit <br> line endings, including empty paragraphs.
      const lastChild = root.lastChild;
      if (lastChild && BLOCKS.has(lastChild.tagName)) text = text.slice(0, -1);
    }
    function offset(node, index) {
      const position = positions.get(node);
      if (position == null) return null;
      if (typeof position === "number") return Math.min(text.length, position + index);
      return Math.min(text.length, position[index] ?? text.length);
    }
    function point(index) {
      const clamped = Math.max(0, Math.min(index, text.length));
      for (const segment of segments) {
        if (clamped < segment.start || clamped > segment.end) continue;
        if (segment.node) return { node: segment.node, offset: clamped - segment.start };
        return clamped === segment.start ? segment.startPoint : segment.endPoint;
      }
      return { node: root, offset: root.childNodes.length };
    }
    return { text, offset, point };
  }
  function writable(element, mode) {
    if (!element?.isConnected) return false;
    return mode === "native"
      ? !element.disabled && !element.readOnly && typeof element.selectionStart === "number"
      : Boolean(element.isContentEditable);
  }
  function read(element, mode) {
    return mode === "native" ? String(element.value ?? "") : model(element).text;
  }
  function capture(element, mode, selection) {
    if (!writable(element, mode)) return null;
    let start;
    let end;
    let fullText;
    if (mode === "native") {
      fullText = read(element, mode);
      start = selection?.start ?? element.selectionStart;
      end = selection?.end ?? element.selectionEnd;
    } else {
      const range = selection;
      if (!range || !element.contains(range.startContainer) || !element.contains(range.endContainer)) return null;
      const current = model(element);
      fullText = current.text;
      start = current.offset(range.startContainer, range.startOffset);
      end = current.offset(range.endContainer, range.endOffset);
    }
    if (start == null || end == null || start < 0 || end <= start || end > fullText.length) return null;
    return Object.freeze({ element, mode, fullText, start, end, selectedText: fullText.slice(start, end) });
  }
  function isCurrent(snapshot) {
    return Boolean(snapshot && writable(snapshot.element, snapshot.mode)
      && read(snapshot.element, snapshot.mode) === snapshot.fullText);
  }
  function range(snapshot) {
    if (!isCurrent(snapshot) || snapshot.mode !== "contenteditable") return null;
    const current = model(snapshot.element);
    const start = current.point(snapshot.start);
    const end = current.point(snapshot.end);
    const result = snapshot.element.ownerDocument.createRange();
    result.setStart(start.node, start.offset);
    result.setEnd(end.node, end.offset);
    return result;
  }
  const expected = (snapshot, replacement) => snapshot.fullText.slice(0, snapshot.start)
    + replacement + snapshot.fullText.slice(snapshot.end);
  scope.TypePilotEditor = Object.freeze({ model, capture, isCurrent, range, read, expected });
})(globalThis);
