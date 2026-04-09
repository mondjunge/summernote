import $ from 'jquery';
import dom from '../core/dom';

/**
 * Editor commands (editor.XXX) that can be applied across a multi-cell selection.
 * These all ultimately use document.execCommand and work with a browser Range.
 */
const MULTI_CELL_COMMANDS = new Set([
  'bold', 'italic', 'underline', 'strikethrough',
  'superscript', 'subscript',
  'removeFormat',
  'foreColor', 'backColor', 'color',
]);

/**
 * Minimum mouse-movement distance (px) before a mousedown+move is treated as a
 * drag-to-select rather than a regular click. Prevents click jitter from
 * accidentally creating a multi-cell selection.
 */
const DRAG_THRESHOLD_PX = 5;

/**
 * TableCellSelection — multi-cell drag-select with uniform formatting.
 *
 * Behaviour:
 *  - Click + drag across table cells highlights a rectangular region.
 *  - While ≥ 2 cells are selected, inline formatting commands (bold, color, …)
 *    are applied to every selected cell in one undo step.
 *  - Semantic strong/em buttons (plugin class .note-btn-strong / .note-btn-em)
 *    are also intercepted and applied to all selected cells.
 *  - The TablePopover is hidden while a multi-cell selection is active.
 *  - Selection clears on: single click, Escape, any printable / edit key,
 *    click outside a table, codeview toggle, editor disable.
 */
export default class TableCellSelection {
  constructor(context) {
    this.context = context;
    this.$editable = context.layoutInfo.editable;
    this.options = context.options;

    /** @type {Set<HTMLElement>} */
    this.selectedCells = new Set();
    /** @type {HTMLElement|null} */
    this.startCell = null;
    this.isDragging = false;
    /** @type {{x: number, y: number}|null} Mouse position at mousedown start */
    this._mouseDownPos = null;
    /** Whether the drag has crossed the movement threshold */
    this._dragActive = false;

    this._originalInvoke = null;
    this._onMouseMove = null;
    this._onDocumentMouseUp = null;
    this._onToolbarClick = null;

    this.events = {
      'summernote.mousedown': (we, event) => {
        this._onMouseDown(event);
      },
      'summernote.keydown': (we, event) => {
        this._onKeyDown(event);
      },
      'summernote.disable': () => {
        this.clearSelection();
      },
      'summernote.codeview.toggled': () => {
        // clearSelection() resets the internal Set, but the DOM may already
        // have been rebuilt by deactivate() from serialized HTML that still
        // contained the class — so also sweep the live DOM.
        this.$editable[0]
          .querySelectorAll('td.note-cell-selected, th.note-cell-selected')
          .forEach(el => el.classList.remove('note-cell-selected'));
        this.clearSelection();
      },
    };
  }

  initialize() {
    // ── mousemove: update the selection rectangle while dragging ──────────
    // Registered on document only for the duration of an active drag
    // (mousedown on a table cell → mouseup). Zero cost when not dragging.
    this._onMouseMove = (event) => {
      if (!this.isDragging || !this.startCell) return;

      // Only activate drag-select once the pointer has moved far enough.
      // This prevents click jitter from creating an accidental multi-cell selection.
      if (!this._dragActive) {
        const dx = event.clientX - this._mouseDownPos.x;
        const dy = event.clientY - this._mouseDownPos.y;
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD_PX) return;
        this._dragActive = true;
      }

      const target = document.elementFromPoint(event.clientX, event.clientY);
      const cell = this._findCell(target);
      if (cell && this._getTable(cell) === this._getTable(this.startCell)) {
        this._updateSelection(this.startCell, cell);
        // Clear native text selection so it doesn't clash with our highlight
        if (this.selectedCells.size > 1) {
          window.getSelection().removeAllRanges();
        }
      }
    };

    // ── global mouseup: end drag even when mouse leaves the editable ──────
    this._onDocumentMouseUp = () => {
      if (!this.isDragging) return;
      // Remove mousemove immediately — no further tracking needed.
      document.removeEventListener('mousemove', this._onMouseMove);
      this.isDragging = false;
      this._mouseDownPos = null;

      if (this.selectedCells.size <= 1 || !this._dragActive) {
        // Either a plain click or the drag threshold was never crossed → clear.
        this.clearSelection();
      } else {
        // Place a collapsed browser range at the first selected cell so that
        // other plugins calling selection.getRangeAt(0) don't get a DOMException.
        const firstCell = [...this.selectedCells][0];
        if (firstCell) {
          const rng = document.createRange();
          rng.setStart(firstCell, 0);
          rng.collapse(true);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(rng);
        }
      }
      this._dragActive = false;
    };

    // mousemove is NOT registered here — only added in _onMouseDown when the
    // user actually presses down on a table cell (see below).
    document.addEventListener('mouseup', this._onDocumentMouseUp);

    // ── toolbar: intercept semantic strong/em buttons for multi-cell ──────
    // Uses capture phase so this handler runs before the button's own handler.
    // stopImmediatePropagation() prevents the plugin's handler from also firing.
    this._onToolbarClick = (event) => {
      if (this.selectedCells.size <= 1) return;
      const btn = event.target.closest('.note-btn-strong, .note-btn-em');
      if (!btn) return;
      event.stopImmediatePropagation();
      if (btn.classList.contains('note-btn-strong')) {
        this._applyToSelection('editor.bold', null);
      } else if (btn.classList.contains('note-btn-em')) {
        this._applyToSelection('editor.italic', null);
      }
    };
    this.context.layoutInfo.toolbar[0].addEventListener(
      'click', this._onToolbarClick, true // capture
    );

    // ── monkey-patch context.invoke to intercept formatting commands ───────
    // Restored in destroy() so the editor is left in a clean state.
    this._originalInvoke = this.context.invoke.bind(this.context);
    this.context.invoke = (namespace, ...args) => {
      if (this.selectedCells.size > 1 && this._isMultiCellCommand(namespace)) {
        this._applyToSelection(namespace, args[0]);
        return;
      }
      // Clear selection BEFORE codeview reads the editable HTML, so that
      // .note-cell-selected classes are never serialized into the textarea.
      if (namespace === 'codeview.toggle' && this.selectedCells.size > 0) {
        this.clearSelection();
      }
      return this._originalInvoke(namespace, ...args);
    };
  }

  destroy() {
    if (this._onMouseMove) {
      // Safety net: remove mousemove in case the editor is destroyed mid-drag.
      document.removeEventListener('mousemove', this._onMouseMove);
    }
    if (this._onDocumentMouseUp) {
      document.removeEventListener('mouseup', this._onDocumentMouseUp);
    }
    if (this._onToolbarClick) {
      this.context.layoutInfo.toolbar[0].removeEventListener(
        'click', this._onToolbarClick, true
      );
    }
    this.clearSelection();
    if (this._originalInvoke) {
      this.context.invoke = this._originalInvoke;
      this._originalInvoke = null;
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────

  hasSelection() {
    return this.selectedCells.size > 1;
  }

  getSelectedCells() {
    return [...this.selectedCells];
  }

  clearSelection() {
    for (const cell of this.selectedCells) {
      cell.classList.remove('note-cell-selected');
    }
    this.selectedCells = new Set();
    this.startCell = null;
    this.isDragging = false;
    this._dragActive = false;
    this._mouseDownPos = null;
  }

  // ── Cell helpers ────────────────────────────────────────────────────────

  _findCell(element) {
    if (!element) return null;
    if (element.nodeName === 'TD' || element.nodeName === 'TH') return element;
    return dom.ancestor(element, (n) => n.nodeName === 'TD' || n.nodeName === 'TH');
  }

  _getTable(cell) {
    return cell ? dom.ancestor(cell, dom.isTable) : null;
  }

  /** Visual start column index (0-based), accounting for colspan of preceding siblings. */
  _visualColStart(cell) {
    let col = 0;
    for (const c of cell.parentElement.cells) {
      if (c === cell) break;
      col += parseInt(c.getAttribute('colspan') || '1', 10);
    }
    return col;
  }

  /** Visual end column index (inclusive). */
  _visualColEnd(cell) {
    return this._visualColStart(cell) +
      parseInt(cell.getAttribute('colspan') || '1', 10) - 1;
  }

  // ── Selection management ────────────────────────────────────────────────

  _onMouseDown(event) {
    const cell = this._findCell(event.target);
    if (!cell) {
      this.clearSelection();
      return;
    }
    this.startCell = cell;
    this.isDragging = true;
    this._dragActive = false;
    this._mouseDownPos = { x: event.clientX, y: event.clientY };
    // Register mousemove only for the duration of this drag. Using document
    // (not $editable) so the selection updates even when the pointer leaves the
    // editor. Works for dynamically inserted tables too — no MutationObserver
    // needed, since we reach here via event delegation on mousedown.
    document.addEventListener('mousemove', this._onMouseMove);
  }

  _onKeyDown(event) {
    if (this.selectedCells.size <= 1) return;
    if (event.key === 'Escape') {
      this.clearSelection();
      return;
    }
    // Clear on printable / edit keys, but NOT on Ctrl/Meta combos (those are
    // formatting shortcuts that should be intercepted by _applyToSelection).
    if (!event.ctrlKey && !event.metaKey && !event.altKey) {
      const k = event.keyCode;
      if (k === 8 || k === 13 || k === 46 || k >= 32) {
        this.clearSelection();
      }
    }
  }

  /**
   * Compute the rectangular set of cells between startCell and currentCell
   * (inclusive), update CSS classes, and hide the TablePopover when > 1 cell.
   */
  _updateSelection(startCell, currentCell) {
    const table = this._getTable(startCell);
    if (!table) return;

    const minRow = Math.min(
      startCell.parentElement.rowIndex,
      currentCell.parentElement.rowIndex
    );
    const maxRow = Math.max(
      startCell.parentElement.rowIndex,
      currentCell.parentElement.rowIndex
    );
    const minCol = Math.min(
      this._visualColStart(startCell),
      this._visualColStart(currentCell)
    );
    const maxCol = Math.max(
      this._visualColEnd(startCell),
      this._visualColEnd(currentCell)
    );

    const newSelection = new Set();
    for (const row of table.rows) {
      if (row.rowIndex < minRow || row.rowIndex > maxRow) continue;
      for (const cell of row.cells) {
        const cs = this._visualColStart(cell);
        const ce = this._visualColEnd(cell);
        if (cs <= maxCol && ce >= minCol) {
          newSelection.add(cell);
        }
      }
    }

    // Sync CSS classes efficiently
    for (const cell of this.selectedCells) {
      if (!newSelection.has(cell)) cell.classList.remove('note-cell-selected');
    }
    for (const cell of newSelection) {
      cell.classList.add('note-cell-selected');
    }
    this.selectedCells = newSelection;

    // Hide the single-cell TablePopover while multiple cells are highlighted
    if (newSelection.size > 1) {
      this._originalInvoke('tablePopover.hide');
    }
  }

  // ── Formatting interception ─────────────────────────────────────────────

  _isMultiCellCommand(namespace) {
    if (!namespace || !namespace.startsWith('editor.')) return false;
    return MULTI_CELL_COMMANDS.has(namespace.slice(7));
  }

  /**
   * Apply a formatting command to every selected cell in a single undo step.
   *
   * Bold and italic are treated specially: instead of execCommand (which
   * produces <b>/<i>), they wrap/unwrap <strong>/<em> directly — matching the
   * semantic intent of the his-strong / his-em plugin buttons.
   */
  _applyToSelection(namespace, value) {
    const cmd = namespace.slice(7); // strip 'editor.'
    const cells = [...this.selectedCells];

    if (cmd === 'bold') {
      this._applySemanticTag(cells, 'strong');
    } else if (cmd === 'italic') {
      this._applySemanticTag(cells, 'em');
    } else {
      this._applyExecCommand(cells, cmd, value);
    }

    // Record a single undo point for the whole multi-cell operation
    this._originalInvoke('editor.afterCommand', false);
  }

  /**
   * Toggle a semantic inline element (<strong> or <em>) across all selected cells.
   *
   * Toggle rule (same as the his-strong / his-em plugin):
   *   • If ANY non-empty text node across all cells is already inside the tag → unwrap all.
   *   • Otherwise → wrap every text node in the tag.
   */
  _applySemanticTag(cells, tagName) {
    // Collect all non-empty text nodes across every cell to determine toggle state.
    const allTextNodes = [];
    for (const cell of cells) {
      const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent.trim().length > 0) allTextNodes.push(node);
      }
    }

    const hasTag = allTextNodes.some(n => n.parentElement.closest(tagName));

    for (const cell of cells) {
      if (hasTag) {
        // Unwrap: replace every <tagName> with its children.
        for (const el of [...cell.querySelectorAll(tagName)]) {
          el.replaceWith(...el.childNodes);
        }
        cell.normalize();
      } else {
        // Wrap: enclose each text node that isn't already inside the tag.
        const cellTextNodes = [];
        const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) cellTextNodes.push(node);

        for (const textNode of cellTextNodes) {
          if (textNode.parentElement.closest(tagName)) continue;
          const wrapper = document.createElement(tagName);
          textNode.parentNode.insertBefore(wrapper, textNode);
          wrapper.appendChild(textNode);
        }
      }
    }
  }

  /** Apply execCommand-based formatting to all cells via browser Range API. */
  _applyExecCommand(cells, cmd, value) {
    document.execCommand('styleWithCSS', false, this.options.styleWithCSS);

    const sel = window.getSelection();
    for (const cell of cells) {
      const rng = document.createRange();
      rng.selectNodeContents(cell);
      sel.removeAllRanges();
      sel.addRange(rng);
      this._runExecCommand(cmd, value);
    }

    // Leave cursor at start of the first selected cell
    if (cells.length > 0) {
      const rng = document.createRange();
      rng.selectNodeContents(cells[0]);
      rng.collapse(true);
      sel.removeAllRanges();
      sel.addRange(rng);
    }
  }

  _runExecCommand(cmd, value) {
    switch (cmd) {
      case 'underline':
      case 'strikethrough':
      case 'superscript':
      case 'subscript':
      case 'removeFormat':
        document.execCommand(cmd, false, null);
        break;
      case 'foreColor':
        document.execCommand('foreColor', false, value);
        break;
      case 'backColor':
        document.execCommand('backColor', false, value);
        break;
      case 'color':
        if (value && value.foreColor) document.execCommand('foreColor', false, value.foreColor);
        if (value && value.backColor) document.execCommand('backColor', false, value.backColor);
        break;
    }
  }
}
