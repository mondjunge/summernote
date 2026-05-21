/**
 * TypingListExit.spec.js
 *
 * Tests for exiting a list by pressing Enter on an empty list item,
 * covering both insertParagraph and insertBreak behaviors.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import $ from 'jquery';
import range from '@/js/core/range';
import Typing from '@/js/editing/Typing';

// Default keyMap (ENTER=insertParagraph, SHIFT+ENTER=insertBreak)
const keyMapDefault = {
  pc:  { 'ENTER': 'insertParagraph', 'SHIFT+ENTER': 'insertBreak' },
  mac: { 'ENTER': 'insertParagraph', 'SHIFT+ENTER': 'insertBreak' },
};

// Custom keyMap where ENTER is mapped to insertBreak
const keyMapBreakOnEnter = {
  pc:  { 'ENTER': 'insertBreak', 'SHIFT+ENTER': 'insertBreak' },
  mac: { 'ENTER': 'insertBreak', 'SHIFT+ENTER': 'insertBreak' },
};

function makeTyping(keyMap) {
  return new Typing({
    options: {
      blockquoteBreakingLevel: 1,
      keyMap,
    },
  });
}

describe('base:editing.Typing — list exit', () => {
  let $editable;

  beforeEach(() => {
    // A list with one real item and one empty item (the exit candidate)
    $editable = $('<div class="note-editable"><ul><li>item</li><li></li></ul></div>');
    document.body.appendChild($editable[0]);
  });

  afterEach(() => {
    $editable.remove();
  });

  // ─── insertParagraph ──────────────────────────────────────────────────────

  describe('insertParagraph — ENTER=insertParagraph (default)', () => {
    it('exits a top-level empty LI and creates <p><br></p> after the list', () => {
      const emptyLi = $('li:last', $editable)[0];
      const rng = range.create(emptyLi, 0);

      makeTyping(keyMapDefault).insertParagraph($editable[0], rng);

      // The empty LI must be gone; only "item" remains
      expect($editable.find('ul li').length).toBe(1);
      expect($editable.find('ul li').text()).toBe('item');

      // A <p><br></p> must follow the list
      const afterList = $editable.find('ul').next()[0];
      expect(afterList).toBeTruthy();
      expect(afterList.tagName.toLowerCase()).toBe('p');
      expect(afterList.innerHTML.toLowerCase()).toBe('<br>');
    });

    it('removes the entire list when the only LI is empty', () => {
      // Replace editable content: a single empty LI
      $editable.html('<ul><li></li></ul>');
      const emptyLi = $('li', $editable)[0];
      const rng = range.create(emptyLi, 0);

      makeTyping(keyMapDefault).insertParagraph($editable[0], rng);

      expect($editable.find('ul').length).toBe(0);
      // A <p> should still be created
      expect($editable.find('p').length).toBeGreaterThan(0);
    });
  });

  // ─── insertBreak — ENTER mapped to insertParagraph (default) ─────────────

  describe('insertBreak — ENTER=insertParagraph (default, i.e. SHIFT+ENTER behavior)', () => {
    it('does NOT exit the list when ENTER is not mapped to insertBreak', () => {
      const emptyLi = $('li:last', $editable)[0];
      const rng = range.create(emptyLi, 0);

      makeTyping(keyMapDefault).insertBreak($editable[0], rng);

      // No <br> or <p> must follow the list — cursor stays inside the list
      expect($editable.find('ul').next('br').length).toBe(0);
      expect($editable.find('ul').next('p').length).toBe(0);
    });
  });

  // ─── insertBreak — ENTER mapped to insertBreak ────────────────────────────

  describe('insertBreak — ENTER=insertBreak (custom mapping)', () => {
    it('exits a top-level empty LI and inserts ZWS directly after list, without a <p> or <br>', () => {
      const emptyLi = $('li:last', $editable)[0];
      const rng = range.create(emptyLi, 0);

      makeTyping(keyMapBreakOnEnter).insertBreak($editable[0], rng);

      // The empty LI must be gone; only "item" remains
      expect($editable.find('ul li').length).toBe(1);
      expect($editable.find('ul li').text()).toBe('item');

      // No <p> wrapper must follow the list
      expect($editable.find('ul').next('p').length).toBe(0);

      // A ZWS text node must follow the list directly (no <br>)
      const zwsNode = $editable.find('ul')[0].nextSibling;
      expect(zwsNode).toBeTruthy();
      expect(zwsNode.nodeType).toBe(Node.TEXT_NODE);
      expect(zwsNode.nodeValue).toBe('\u200B');
    });

    it('removes the entire list when the only LI is empty', () => {
      $editable.html('<ul><li></li></ul>');
      const emptyLi = $('li', $editable)[0];
      const rng = range.create(emptyLi, 0);

      makeTyping(keyMapBreakOnEnter).insertBreak($editable[0], rng);

      expect($editable.find('ul').length).toBe(0);
      // ZWS should be the only child (no <br>)
      expect($editable.find('br').length).toBe(0);
      const zws = $editable[0].firstChild;
      expect(zws).toBeTruthy();
      expect(zws.nodeType).toBe(Node.TEXT_NODE);
      expect(zws.nodeValue).toBe('\u200B');
    });
  });

  // \u2500\u2500\u2500 Lists inside table cells \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  describe('insertParagraph \u2014 list inside a table cell', () => {
    let $editableCell;

    beforeEach(() => {
      $editableCell = $('<div class="note-editable"><table><tbody><tr><td><ul><li>item</li></ul></td></tr></tbody></table></div>');
      document.body.appendChild($editableCell[0]);
    });

    afterEach(() => {
      $editableCell.remove();
    });

    it('splits a non-empty LI in a <td> into two list items', () => {
      const li = $editableCell.find('li')[0];
      const textNode = li.firstChild;
      const rng = range.create(textNode, 2); // after "it" in "item"

      makeTyping(keyMapDefault).insertParagraph($editableCell[0], rng);

      expect($editableCell.find('ul li').length).toBe(2);
      expect($editableCell.find('ul li').eq(0).text()).toBe('it');
      expect($editableCell.find('ul li').eq(1).text()).toBe('em');
      // No <p> created at the cell or table level
      expect($editableCell.find('td > p').length).toBe(0);
      expect($editableCell.find('table ~ p').length).toBe(0);
    });

    it('exits the list and creates <p> inside the <td> when Enter is pressed on an empty LI', () => {
      $editableCell.find('td').html('<ul><li>item</li><li></li></ul>');
      const emptyLi = $editableCell.find('li').last()[0];
      const rng = range.create(emptyLi, 0);

      makeTyping(keyMapDefault).insertParagraph($editableCell[0], rng);

      // Empty LI is removed
      expect($editableCell.find('ul li').length).toBe(1);
      // <p> is created inside the <td>, not outside the table
      expect($editableCell.find('td > p').length).toBe(1);
      expect($editableCell.find('table ~ p').length).toBe(0);
    });
  });
});
