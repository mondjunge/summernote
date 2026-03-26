import $ from 'jquery';
import dom from '../core/dom';
import range from '../core/range';
import lists from '../core/lists';

/**
 * @class Create a virtual table to create what actions to do in change.
 * @param {object} startPoint Cell selected to apply change.
 * @param {enum} where  Where change will be applied Row or Col. Use enum: TableResultAction.where
 * @param {enum} action Action to be applied. Use enum: TableResultAction.requestAction
 * @param {object} domTable Dom element of table to make changes.
 */
const TableResultAction = function(startPoint, where, action, domTable) {
  const _startPoint = { 'colPos': 0, 'rowPos': 0 };
  const _virtualTable = [];
  const _actionCellList = [];

  /// ///////////////////////////////////////////
  // Private functions
  /// ///////////////////////////////////////////

  /**
   * Set the startPoint of action.
   */
  function setStartPoint() {
    if (!startPoint || !startPoint.tagName || (startPoint.tagName.toLowerCase() !== 'td' && startPoint.tagName.toLowerCase() !== 'th')) {
      // Impossible to identify start Cell point
      return;
    }
    _startPoint.colPos = startPoint.cellIndex;
    if (!startPoint.parentElement || !startPoint.parentElement.tagName || startPoint.parentElement.tagName.toLowerCase() !== 'tr') {
      // Impossible to identify start Row point
      return;
    }
    _startPoint.rowPos = startPoint.parentElement.rowIndex;
  }

  /**
   * Define virtual table position info object.
   *
   * @param {int} rowIndex Index position in line of virtual table.
   * @param {int} cellIndex Index position in column of virtual table.
   * @param {object} baseRow Row affected by this position.
   * @param {object} baseCell Cell affected by this position.
   * @param {bool} isSpan Inform if it is an span cell/row.
   */
  function setVirtualTablePosition(rowIndex, cellIndex, baseRow, baseCell, isRowSpan, isColSpan, isVirtualCell) {
    const objPosition = {
      'baseRow': baseRow,
      'baseCell': baseCell,
      'isRowSpan': isRowSpan,
      'isColSpan': isColSpan,
      'isVirtual': isVirtualCell,
    };
    if (!_virtualTable[rowIndex]) {
      _virtualTable[rowIndex] = [];
    }
    _virtualTable[rowIndex][cellIndex] = objPosition;
  }

  /**
   * Create action cell object.
   *
   * @param {object} virtualTableCellObj Object of specific position on virtual table.
   * @param {enum} resultAction Action to be applied in that item.
   */
  function getActionCell(virtualTableCellObj, resultAction, virtualRowPosition, virtualColPosition) {
    return {
      'baseCell': virtualTableCellObj.baseCell,
      'action': resultAction,
      'virtualTable': {
        'rowIndex': virtualRowPosition,
        'cellIndex': virtualColPosition,
      },
    };
  }

  /**
   * Recover free index of row to append Cell.
   *
   * @param {int} rowIndex Index of row to find free space.
   * @param {int} cellIndex Index of cell to find free space in table.
   */
  function recoverCellIndex(rowIndex, cellIndex) {
    if (!_virtualTable[rowIndex]) {
      return cellIndex;
    }
    if (!_virtualTable[rowIndex][cellIndex]) {
      return cellIndex;
    }

    let newCellIndex = cellIndex;
    while (_virtualTable[rowIndex][newCellIndex]) {
      newCellIndex++;
      if (!_virtualTable[rowIndex][newCellIndex]) {
        return newCellIndex;
      }
    }
  }

  /**
   * Recover info about row and cell and add information to virtual table.
   *
   * @param {object} row Row to recover information.
   * @param {object} cell Cell to recover information.
   */
  function addCellInfoToVirtual(row, cell) {
    const cellIndex = recoverCellIndex(row.rowIndex, cell.cellIndex);
    const cellHasColspan = (cell.colSpan > 1);
    const cellHasRowspan = (cell.rowSpan > 1);
    const isThisSelectedCell = (row.rowIndex === _startPoint.rowPos && cell.cellIndex === _startPoint.colPos);
    setVirtualTablePosition(row.rowIndex, cellIndex, row, cell, cellHasRowspan, cellHasColspan, false);

    // Add span rows to virtual Table.
    const rowspanNumber = cell.attributes.rowSpan ? parseInt(cell.attributes.rowSpan.value, 10) : 0;
    if (rowspanNumber > 1) {
      for (let rp = 1; rp < rowspanNumber; rp++) {
        const rowspanIndex = row.rowIndex + rp;
        adjustStartPoint(rowspanIndex, cellIndex, cell, isThisSelectedCell);
        setVirtualTablePosition(rowspanIndex, cellIndex, row, cell, true, cellHasColspan, true);
      }
    }

    // Add span cols to virtual table.
    const colspanNumber = cell.attributes.colSpan ? parseInt(cell.attributes.colSpan.value, 10) : 0;
    if (colspanNumber > 1) {
      for (let cp = 1; cp < colspanNumber; cp++) {
        const cellspanIndex = recoverCellIndex(row.rowIndex, (cellIndex + cp));
        adjustStartPoint(row.rowIndex, cellspanIndex, cell, isThisSelectedCell);
        setVirtualTablePosition(row.rowIndex, cellspanIndex, row, cell, cellHasRowspan, true, true);
      }
    }
  }

  /**
   * Process validation and adjust of start point if needed
   *
   * @param {int} rowIndex
   * @param {int} cellIndex
   * @param {object} cell
   * @param {bool} isSelectedCell
   */
  function adjustStartPoint(rowIndex, cellIndex, cell, isSelectedCell) {
    if (rowIndex === _startPoint.rowPos && _startPoint.colPos >= cell.cellIndex && cell.cellIndex <= cellIndex && !isSelectedCell) {
      _startPoint.colPos++;
    }
  }

  /**
   * Create virtual table of cells with all cells, including span cells.
   */
  function createVirtualTable() {
    const rows = domTable.rows;
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const cells = rows[rowIndex].cells;
      for (let cellIndex = 0; cellIndex < cells.length; cellIndex++) {
        addCellInfoToVirtual(rows[rowIndex], cells[cellIndex]);
      }
    }
  }

  /**
   * Get action to be applied on the cell.
   *
   * @param {object} cell virtual table cell to apply action
   */
  function getDeleteResultActionToCell(cell) {
    switch (where) {
      case TableResultAction.where.Column:
        if (cell.isColSpan) {
          return TableResultAction.resultAction.SubtractSpanCount;
        }
        break;
      case TableResultAction.where.Row:
        if (!cell.isVirtual && cell.isRowSpan) {
          return TableResultAction.resultAction.AddCell;
        } else if (cell.isRowSpan) {
          return TableResultAction.resultAction.SubtractSpanCount;
        }
        break;
    }
    return TableResultAction.resultAction.RemoveCell;
  }

  /**
   * Get action to be applied on the cell.
   *
   * @param {object} cell virtual table cell to apply action
   */
  function getAddResultActionToCell(cell) {
    switch (where) {
      case TableResultAction.where.Column:
        if (cell.isColSpan) {
          return TableResultAction.resultAction.SumSpanCount;
        } else if (cell.isRowSpan && cell.isVirtual) {
          return TableResultAction.resultAction.Ignore;
        }
        break;
      case TableResultAction.where.Row:
        if (cell.isRowSpan) {
          return TableResultAction.resultAction.SumSpanCount;
        } else if (cell.isColSpan && cell.isVirtual) {
          return TableResultAction.resultAction.Ignore;
        }
        break;
    }
    return TableResultAction.resultAction.AddCell;
  }

  function init() {
    setStartPoint();
    createVirtualTable();
  }

  /// ///////////////////////////////////////////
  // Public functions
  /// ///////////////////////////////////////////

  /**
   * Recover array os what to do in table.
   */
  this.getActionList = function() {
    const fixedRow = (where === TableResultAction.where.Row) ? _startPoint.rowPos : -1;
    const fixedCol = (where === TableResultAction.where.Column) ? _startPoint.colPos : -1;

    let actualPosition = 0;
    let canContinue = true;
    while (canContinue) {
      const rowPosition = (fixedRow >= 0) ? fixedRow : actualPosition;
      const colPosition = (fixedCol >= 0) ? fixedCol : actualPosition;
      const row = _virtualTable[rowPosition];
      if (!row) {
        canContinue = false;
        return _actionCellList;
      }
      const cell = row[colPosition];
      if (!cell) {
        canContinue = false;
        return _actionCellList;
      }

      // Define action to be applied in this cell
      let resultAction = TableResultAction.resultAction.Ignore;
      switch (action) {
        case TableResultAction.requestAction.Add:
          resultAction = getAddResultActionToCell(cell);
          break;
        case TableResultAction.requestAction.Delete:
          resultAction = getDeleteResultActionToCell(cell);
          break;
      }
      _actionCellList.push(getActionCell(cell, resultAction, rowPosition, colPosition));
      actualPosition++;
    }

    return _actionCellList;
  };

  init();
};
/**
*
* Where action occours enum.
*/
TableResultAction.where = { 'Row': 0, 'Column': 1 };
/**
*
* Requested action to apply enum.
*/
TableResultAction.requestAction = { 'Add': 0, 'Delete': 1 };
/**
*
* Result action to be executed enum.
*/
TableResultAction.resultAction = { 'Ignore': 0, 'SubtractSpanCount': 1, 'RemoveCell': 2, 'AddCell': 3, 'SumSpanCount': 4 };

/**
 *
 * @class editing.Table
 *
 * Table
 *
 */
export default class Table {
  /**
   * handle tab key
   *
   * @param {WrappedRange} rng
   * @param {Boolean} isShift
   */
  tab(rng, isShift) {
    const cell = dom.ancestor(rng.commonAncestor(), dom.isCell);
    const table = dom.ancestor(cell, dom.isTable);
    const cells = dom.listDescendant(table, dom.isCell);

    const nextCell = lists[isShift ? 'prev' : 'next'](cells, cell);
    if (nextCell) {
      range.create(nextCell, 0).select();
      return true;
    }
    return false;
  }

  /**
   * Add a new row
   *
   * @param {WrappedRange} rng
   * @param {String} position (top/bottom)
   * @return {Node}
   */
  addRow(rng, position) {
    const cell = dom.ancestor(rng.commonAncestor(), dom.isCell);

    const currentTr = $(cell).closest('tr');
    const trAttributes = this.recoverAttributes(currentTr);
    const html = $('<tr' + trAttributes + '></tr>');

    const vTable = new TableResultAction(cell, TableResultAction.where.Row,
      TableResultAction.requestAction.Add, $(currentTr).closest('table')[0]);
    const actions = vTable.getActionList();

    for (let idCell = 0; idCell < actions.length; idCell++) {
      const currentCell = actions[idCell];
      const tdAttributes = this.recoverAttributes(currentCell.baseCell);
      switch (currentCell.action) {
        case TableResultAction.resultAction.AddCell:
          html.append('<td' + tdAttributes + '>' + dom.blank + '</td>');
          break;
        case TableResultAction.resultAction.SumSpanCount:
          {
            if (position === 'top') {
              const baseCellTr = currentCell.baseCell.parent;
              const isTopFromRowSpan = (!baseCellTr ? 0 : currentCell.baseCell.closest('tr').rowIndex) <= currentTr[0].rowIndex;
              if (isTopFromRowSpan) {
                const newTd = $('<div></div>').append($('<td' + tdAttributes + '>' + dom.blank + '</td>').removeAttr('rowspan')).html();
                html.append(newTd);
                break;
              }
            }
            let rowspanNumber = parseInt(currentCell.baseCell.rowSpan, 10);
            rowspanNumber++;
            currentCell.baseCell.setAttribute('rowSpan', rowspanNumber);
          }
          break;
      }
    }

    if (position === 'top') {
      currentTr.before(html);
    } else {
      const cellHasRowspan = (cell.rowSpan > 1);
      if (cellHasRowspan) {
        const lastTrIndex = currentTr[0].rowIndex + (cell.rowSpan - 2);
        $($(currentTr).parent().find('tr')[lastTrIndex]).after($(html));
        return;
      }
      currentTr.after(html);
    }
  }

  /**
   * Add a new col
   *
   * @param {WrappedRange} rng
   * @param {String} position (left/right)
   * @return {Node}
   */
  addCol(rng, position) {
    const cell = dom.ancestor(rng.commonAncestor(), dom.isCell);
    const row = $(cell).closest('tr');
    const rowsGroup = $(row).siblings();
    rowsGroup.push(row);

    const vTable = new TableResultAction(cell, TableResultAction.where.Column,
      TableResultAction.requestAction.Add, $(row).closest('table')[0]);
    const actions = vTable.getActionList();

    for (let actionIndex = 0; actionIndex < actions.length; actionIndex++) {
      const currentCell = actions[actionIndex];
      const tdAttributes = this.recoverAttributes(currentCell.baseCell);
      switch (currentCell.action) {
        case TableResultAction.resultAction.AddCell:
          if (position === 'right') {
            $(currentCell.baseCell).after('<td' + tdAttributes + '>' + dom.blank + '</td>');
          } else {
            $(currentCell.baseCell).before('<td' + tdAttributes + '>' + dom.blank + '</td>');
          }
          break;
        case TableResultAction.resultAction.SumSpanCount:
          if (position === 'right') {
            let colspanNumber = parseInt(currentCell.baseCell.colSpan, 10);
            colspanNumber++;
            currentCell.baseCell.setAttribute('colSpan', colspanNumber);
          } else {
            $(currentCell.baseCell).before('<td' + tdAttributes + '>' + dom.blank + '</td>');
          }
          break;
      }
    }
  }

  /*
  * Copy attributes from element.
  *
  * @param {object} Element to recover attributes.
  * @return {string} Copied string elements.
  */
  recoverAttributes(el) {
    let resultStr = '';

    if (!el) {
      return resultStr;
    }

    const attrList = el.attributes || [];

    for (let i = 0; i < attrList.length; i++) {
      if (attrList[i].name.toLowerCase() === 'id') {
        continue;
      }

      if (attrList[i].specified) {
        resultStr += ' ' + attrList[i].name + '=\'' + attrList[i].value + '\'';
      }
    }

    return resultStr;
  }

  /**
   * Delete current row, correctly handling rowspan and colspan.
   *
   * Builds a visual (rowspan/colspan-aware) virtual table, then for each
   * unique cell visible in the deleted row:
   *  - Base cell with rowspan in deleted row → move to next row, decrement rowspan
   *  - Virtual cell (rowspan continuation from a previous row) → decrement rowspan on base cell
   *  - Regular cell → removed with the row
   *
   * @param {WrappedRange} rng
   */
  deleteRow(rng) {
    const cell = dom.ancestor(rng.commonAncestor(), dom.isCell);
    if (!cell) { return; }
    const table = $(cell).closest('table')[0];
    const rowToDelete = $(cell).closest('tr')[0];
    const deleteRowIdx = rowToDelete.rowIndex;
    const numRows = table.rows.length;

    // Build virtual table: virtualTable[r][c] = { baseCell, isVirtual }
    const virtualTable = Array.from({ length: numRows }, () => []);
    for (let r = 0; r < numRows; r++) {
      const rowEl = table.rows[r];
      let colIdx = 0;
      for (let ci = 0; ci < rowEl.cells.length; ci++) {
        const cellEl = rowEl.cells[ci];
        while (virtualTable[r][colIdx]) { colIdx++; }
        const colspan = parseInt(cellEl.getAttribute('colspan') || '1', 10);
        const rowspan = parseInt(cellEl.getAttribute('rowspan') || '1', 10);
        for (let rr = 0; rr < rowspan; rr++) {
          for (let cc = 0; cc < colspan; cc++) {
            if (r + rr < numRows) {
              virtualTable[r + rr][colIdx + cc] = { baseCell: cellEl, isVirtual: rr > 0 || cc > 0 };
            }
          }
        }
        colIdx += colspan;
      }
    }

    // Find the first DOM cell in targetRow that starts at or after targetColIdx
    function insertRefCell(targetRowIdx, targetColIdx) {
      const vRow = virtualTable[targetRowIdx];
      for (let vc = targetColIdx; vc < vRow.length; vc++) {
        const p = vRow[vc];
        if (p && !p.isVirtual) { return p.baseCell; }
      }
      return null; // append at end
    }

    const deletedVRow = virtualTable[deleteRowIdx];
    const nextRowIdx = deleteRowIdx + 1;
    const processed = new Set();

    for (let colIdx = 0; colIdx < deletedVRow.length; colIdx++) {
      const pos = deletedVRow[colIdx];
      if (!pos || processed.has(pos.baseCell)) { continue; }
      processed.add(pos.baseCell);

      const rowspan = parseInt(pos.baseCell.getAttribute('rowspan') || '1', 10);
      if (!pos.isVirtual && rowspan > 1) {
        // Base cell is in the deleted row and spans further — move to next row
        if (nextRowIdx >= numRows) { continue; }
        const nextRow = table.rows[nextRowIdx];
        if (rowspan === 2) {
          pos.baseCell.removeAttribute('rowspan');
        } else {
          pos.baseCell.setAttribute('rowspan', rowspan - 1);
        }
        const refCell = insertRefCell(nextRowIdx, colIdx);
        nextRow.insertBefore(pos.baseCell, refCell);
      } else if (pos.isVirtual && rowspan > 1) {
        // Continuation of a rowspan from a previous row — just decrement
        if (rowspan === 2) {
          pos.baseCell.removeAttribute('rowspan');
        } else {
          pos.baseCell.setAttribute('rowspan', rowspan - 1);
        }
      }
      // else: regular cell, will be removed with the row
    }

    $(rowToDelete).remove();
  }

  /**
   * Build a Set of visual column indices that are occupied in the given row by
   * rowspan cells originating from earlier rows.
   *
   * @param {Element} table
   * @param {number} rowIdx
   * @return {Set<number>}
   */
  _buildOccupied(table, rowIdx) {
    const occupied = new Set();
    for (let r = 0; r < rowIdx; r++) {
      let col = 0;
      for (const c of table.rows[r].cells) {
        const cs = parseInt(c.getAttribute('colspan') || '1', 10);
        const rs = parseInt(c.getAttribute('rowspan') || '1', 10);
        if (r + rs > rowIdx) {
          for (let cc = 0; cc < cs; cc++) { occupied.add(col + cc); }
        }
        col += cs;
      }
    }
    return occupied;
  }

  /**
   * Compute the visual (colspan- and rowspan-aware) column index of a cell.
   *
   * @param {Element} cell
   * @return {number}
   */
  _getVisualColIndex(cell) {
    const row = cell.parentElement;
    const table = row.closest('table');
    const occupied = this._buildOccupied(table, row.rowIndex);
    let col = 0;
    for (const c of row.cells) {
      while (occupied.has(col)) { col++; }
      if (c === cell) { return col; }
      col += parseInt(c.getAttribute('colspan') || '1', 10);
    }
    return col;
  }

  /**
   * Find the physical cell in the given row that starts exactly at targetVisualCol,
   * accounting for rowspan cells from rows above.
   * Returns null if that position is occupied by a rowspan from above or no cell exists.
   *
   * @param {Element} table
   * @param {number} rowIdx
   * @param {number} targetVisualCol
   * @return {Element|null}
   */
  _findCellAtVisualCol(table, rowIdx, targetVisualCol) {
    const occupied = this._buildOccupied(table, rowIdx);
    let col = 0;
    for (const c of table.rows[rowIdx].cells) {
      while (occupied.has(col)) { col++; }
      if (col === targetVisualCol) { return c; }
      if (col > targetVisualCol) { break; }
      col += parseInt(c.getAttribute('colspan') || '1', 10);
    }
    return null;
  }

  /**
   * Find the cell in the given row before which a new cell at targetVisualCol
   * should be inserted, accounting for rowspan cells from above.
   * Returns null if the new cell should be appended at the end.
   *
   * @param {Element} table
   * @param {number} rowIdx
   * @param {number} targetVisualCol
   * @return {Element|null}
   */
  _findInsertRefInRow(table, rowIdx, targetVisualCol) {
    const occupied = this._buildOccupied(table, rowIdx);
    let col = 0;
    for (const c of table.rows[rowIdx].cells) {
      while (occupied.has(col)) { col++; }
      if (col >= targetVisualCol) { return c; }
      col += parseInt(c.getAttribute('colspan') || '1', 10);
    }
    return null;
  }

  /**
   * Delete the visual column containing the current cell.
   *
   * Walks every row of the table and determines how the target visual column
   * intersects each row's cells (accounting for colspan):
   *  - Cell starts exactly at the target column → remove it (or reduce colspan).
   *  - Cell spans across the target column → reduce its colspan.
   *  - Row has no cell reaching the target column → skip that row.
   *
   * @param {WrappedRange} rng
   */
  deleteCol(rng) {
    const cell = dom.ancestor(rng.commonAncestor(), dom.isCell);
    if (!cell) { return; }
    const table = $(cell).closest('table')[0];
    const visualColIdx = this._getVisualColIndex(cell);

    for (const row of table.rows) {
      let currentCol = 0;
      for (let i = 0; i < row.cells.length; i++) {
        const c = row.cells[i];
        const colspan = parseInt(c.getAttribute('colspan') || '1', 10);
        if (currentCol === visualColIdx) {
          // Cell starts at the target column
          if (colspan <= 1) {
            c.remove();
          } else if (colspan === 2) {
            c.removeAttribute('colspan');
          } else {
            c.setAttribute('colspan', colspan - 1);
          }
          break;
        } else if (currentCol < visualColIdx && currentCol + colspan > visualColIdx) {
          // Cell spans over the target column — shrink it
          if (colspan === 2) {
            c.removeAttribute('colspan');
          } else {
            c.setAttribute('colspan', colspan - 1);
          }
          break;
        }
        currentCol += colspan;
      }
    }
  }

  /**
   * create empty table element
   *
   * @param {Number} rowCount
   * @param {Number} colCount
   * @return {Node}
   */
  createTable(colCount, rowCount, options) {
    const tds = [];
    let tdHTML;
    for (let idxCol = 0; idxCol < colCount; idxCol++) {
      tds.push('<td>' + dom.blank + '</td>');
    }
    tdHTML = tds.join('');

    const trs = [];
    let trHTML;
    for (let idxRow = 0; idxRow < rowCount; idxRow++) {
      trs.push('<tr>' + tdHTML + '</tr>');
    }
    trHTML = trs.join('');
    const $table = $('<table>' + trHTML + '</table>');
    if (options && options.tableClassName) {
      $table.addClass(options.tableClassName);
    }

    return $table[0];
  }

  /**
   * Delete current table
   *
   * @param {WrappedRange} rng
   * @return {Node}
   */
  deleteTable(rng) {
    const cell = dom.ancestor(rng.commonAncestor(), dom.isCell);
    $(cell).closest('table').remove();
  }

  /**
   * Toggle table header row: converts the first <tr> to a <thead> with <th>
   * cells, or removes an existing <thead> and converts <th> back to <td>.
   *
   * @param {WrappedRange} rng
   */
  toggleTableHeader(rng) {
    const cell = dom.ancestor(rng.commonAncestor(), dom.isCell);
    if (!cell) { return null; }
    const cellIdx = $(cell).index();
    const $table = $(cell).closest('table');
    const $thead = $table.find('thead');

    let $targetCell;

    if ($thead.length) {
      if (this._theadObserver) {
        this._theadObserver.disconnect();
        this._theadObserver = null;
      }
      const $topRow = $thead.find('tr').first();
      this._replaceTags($topRow.find('th'), 'td');
      let $tbody = $table.find('tbody').first();
      if (!$tbody.length) {
        $tbody = $('<tbody>').appendTo($table);
      }
      $tbody.prepend($topRow);
      $thead.remove();
      $targetCell = $topRow.find('td, th').eq(cellIdx);
    } else {
      const $topRow = $table.find('tr').first();
      const $newThead = $('<thead>').prependTo($table);
      $newThead.append($topRow);
      this._replaceTags($newThead.find('td'), 'th');
      $targetCell = $topRow.find('td, th').eq(cellIdx);

      this._theadObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          this._replaceTags($(mutation.target).find('td'), 'th');
        });
      });
      this._theadObserver.observe($newThead[0], { childList: true, subtree: true });
    }

    return $targetCell.length ? $targetCell[0] : null;
  }

  /**
   * Increment colspan of the current cell by 1.
   * The next cell to the right is removed (if colspan=1, with content appended)
   * or shrunk by 1 (if colspan>1). If no next cell exists, does nothing.
   * @param {WrappedRange} rng
   */
  mergeCellCol(rng) {
    const cell = dom.ancestor(rng.commonAncestor(), dom.isCell);
    if (!cell) { return; }
    const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);
    const targetCol = this._getVisualColIndex(cell) + colspan;

    // Find the next physical cell starting at targetCol in the same row
    let colIdx = 0;
    let nextCell = null;
    for (const c of cell.parentElement.cells) {
      if (colIdx === targetCol) { nextCell = c; break; }
      colIdx += parseInt(c.getAttribute('colspan') || '1', 10);
    }
    if (!nextCell) { return; }

    const nextColspan = parseInt(nextCell.getAttribute('colspan') || '1', 10);
    if (nextColspan <= 1) {
      const content = nextCell.innerHTML;
      if (content && content !== dom.blank) { cell.innerHTML += content; }
      nextCell.remove();
    } else {
      if (nextColspan === 2) { nextCell.removeAttribute('colspan'); }
      else { nextCell.setAttribute('colspan', nextColspan - 1); }
    }
    cell.setAttribute('colspan', colspan + 1);
  }

  /**
   * Decrement colspan of the current cell by 1.
   * A new empty cell is inserted at the freed position (immediately after).
   * @param {WrappedRange} rng
   */
  splitCellCol(rng) {
    const cell = dom.ancestor(rng.commonAncestor(), dom.isCell);
    if (!cell) { return; }
    const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);
    if (colspan <= 1) { return; }
    if (colspan === 2) {
      cell.removeAttribute('colspan');
    } else {
      cell.setAttribute('colspan', colspan - 1);
    }
    const newTd = document.createElement(cell.tagName.toLowerCase());
    newTd.innerHTML = dom.blank;
    cell.after(newTd);
  }

  /**
   * Increment rowspan of the current cell by 1.
   * The cell directly below (at the same visual column, in the next spanned row)
   * is removed (if rowspan=1, with content appended) or shrunk by 1 (if rowspan>1).
   * If no such row or cell exists, does nothing.
   * @param {WrappedRange} rng
   */
  mergeCellRow(rng) {
    const cell = dom.ancestor(rng.commonAncestor(), dom.isCell);
    if (!cell) { return; }
    const rowspan = parseInt(cell.getAttribute('rowspan') || '1', 10);
    const table = cell.closest('table');
    const targetRowIdx = cell.closest('tr').rowIndex + rowspan;
    if (targetRowIdx >= table.rows.length) { return; }

    const visualColIdx = this._getVisualColIndex(cell);
    const belowCell = this._findCellAtVisualCol(table, targetRowIdx, visualColIdx);

    if (belowCell) {
      const belowRowspan = parseInt(belowCell.getAttribute('rowspan') || '1', 10);
      if (belowRowspan <= 1) {
        const content = belowCell.innerHTML;
        if (content && content !== dom.blank) { cell.innerHTML += content; }
        belowCell.remove();
      } else {
        if (belowRowspan === 2) { belowCell.removeAttribute('rowspan'); }
        else { belowCell.setAttribute('rowspan', belowRowspan - 1); }
      }
    }
    cell.setAttribute('rowspan', rowspan + 1);
  }

  /**
   * Decrement rowspan of the current cell by 1.
   * A new empty cell is inserted in the freed row at the correct visual column.
   * @param {WrappedRange} rng
   */
  splitCellRow(rng) {
    const cell = dom.ancestor(rng.commonAncestor(), dom.isCell);
    if (!cell) { return; }
    const rowspan = parseInt(cell.getAttribute('rowspan') || '1', 10);
    if (rowspan <= 1) { return; }

    const table = cell.closest('table');
    const newRowspan = rowspan - 1;
    const targetRowIdx = cell.closest('tr').rowIndex + newRowspan;

    if (rowspan === 2) { cell.removeAttribute('rowspan'); }
    else { cell.setAttribute('rowspan', newRowspan); }

    if (targetRowIdx < table.rows.length) {
      const visualColIdx = this._getVisualColIndex(cell);
      const targetRow = table.rows[targetRowIdx];
      const refCell = this._findInsertRefInRow(table, targetRowIdx, visualColIdx);
      const newTd = document.createElement(cell.tagName.toLowerCase());
      newTd.innerHTML = dom.blank;
      if (refCell) { targetRow.insertBefore(newTd, refCell); }
      else { targetRow.appendChild(newTd); }
    }
  }

  _replaceTags($nodes, newTag) {
    $nodes.replaceWith(function() {
      return $('<' + newTag + '/>', { html: $(this).html() });
    });
  }

  /**
   * Apply background color to the current table cell.
   * @param {WrappedRange} rng
   * @param {String} color
   */
  cellBackColor(rng, color) {
    const cell = dom.ancestor(rng.commonAncestor(), dom.isCell);
    if (cell) {
      $(cell).css('background-color', color === 'transparent' ? '' : color);
    }
  }

  /**
   * Apply text color to the current table cell.
   * @param {WrappedRange} rng
   * @param {String} color
   */
  cellForeColor(rng, color) {
    const cell = dom.ancestor(rng.commonAncestor(), dom.isCell);
    if (cell) {
      $(cell).css('color', color || '');
    }
  }

  /**
   * Apply background color to all cells in the current row.
   * @param {WrappedRange} rng
   * @param {String} color
   */
  rowBackColor(rng, color) {
    const cell = dom.ancestor(rng.commonAncestor(), dom.isCell);
    if (cell) {
      $(cell).closest('tr').find('td, th').css('background-color', color === 'transparent' ? '' : color);
    }
  }

  /**
   * Apply text color to all cells in the current row.
   * @param {WrappedRange} rng
   * @param {String} color
   */
  rowForeColor(rng, color) {
    const cell = dom.ancestor(rng.commonAncestor(), dom.isCell);
    if (cell) {
      $(cell).closest('tr').find('td, th').css('color', color || '');
    }
  }

  /**
   * Apply background color to all cells in the current column.
   * @param {WrappedRange} rng
   * @param {String} color
   */
  colBackColor(rng, color) {
    const cell = dom.ancestor(rng.commonAncestor(), dom.isCell);
    if (cell) {
      const colIdx = $(cell).index();
      $(cell).closest('table').find('tr').each((i, tr) => {
        $(tr).children().eq(colIdx).css('background-color', color === 'transparent' ? '' : color);
      });
    }
  }

  /**
   * Apply text color to all cells in the current column.
   * @param {WrappedRange} rng
   * @param {String} color
   */
  colForeColor(rng, color) {
    const cell = dom.ancestor(rng.commonAncestor(), dom.isCell);
    if (cell) {
      const colIdx = $(cell).index();
      $(cell).closest('table').find('tr').each((i, tr) => {
        $(tr).children().eq(colIdx).css('color', color || '');
      });
    }
  }
}
