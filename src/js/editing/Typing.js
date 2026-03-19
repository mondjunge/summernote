import $ from 'jquery';
import dom from '../core/dom';
import range from '../core/range';
import Bullet from '../editing/Bullet';

/**
 * @class editing.Typing
 *
 * Typing
 *
 */
export default class Typing {
  constructor(context) {
    // a Bullet instance to toggle lists off
    this.bullet = new Bullet();
    this.options = context.options;
  }

  /**
   * insert tab
   *
   * @param {WrappedRange} rng
   * @param {Number} tabsize
   */
  insertTab(rng, tabsize) {
    const tab = dom.createText(new Array(tabsize + 1).join(dom.NBSP_CHAR));
    rng = rng.deleteContents();
    rng.insertNode(tab, true);

    rng = range.create(tab, tabsize);
    rng.select();
  }

  /**
   * insert line break (Shift+Enter)
   *
   * @param {Element} editable
   * @param {WrappedRange} rng
   */
  insertBreak(editable, rng) {
    rng = rng || range.create(editable);

    // Check if in a table cell — skip deleteContents/wrapBodyInlineWithPara to avoid splitting
    const cell = dom.ancestor(rng.sc, dom.isCell);

    if (!cell) {
      rng = rng.deleteContents();
      rng = rng.wrapBodyInlineWithPara();
    }

    // Find paragraph ancestor, but not when inside a table cell
    const splitRoot = cell ? null : dom.ancestor(rng.sc, dom.isPara);

    if (splitRoot) {
      // Empty list item: outdent nested, exit top-level
      if (dom.isLi(splitRoot) && (dom.isEmpty(splitRoot) || dom.deepestChildIsEmpty(splitRoot))) {
        const parentList = splitRoot.parentNode;
        const isNestedList = parentList && dom.ancestor(parentList.parentNode, dom.isLi);

        if (isNestedList) {
          this.bullet.outdent(editable);
          return;
        } else {
          const parentUl = splitRoot.parentNode;
          const newPara = $(dom.emptyPara)[0];
          dom.insertAfter(newPara, parentUl);
          splitRoot.parentNode.removeChild(splitRoot);
          if (parentUl.children.length === 0) {
            parentUl.parentNode.removeChild(parentUl);
          }
          range.create(newPara, 0).normalize().select().scrollIntoView(editable);
          return;
        }
      }

      // Heading: split at cursor
      if (dom.isHeading(splitRoot)) {
        const nextPara = dom.splitTree(splitRoot, rng.getStartPoint());
        const emptyAnchors = dom.listDescendant(splitRoot, dom.isEmptyAnchor)
          .concat(dom.listDescendant(nextPara, dom.isEmptyAnchor));
        $.each(emptyAnchors, (idx, anchor) => { dom.remove(anchor); });
        range.create(nextPara, 0).normalize().select().scrollIntoView(editable);
        return;
      }

      // List item: create new list item
      if (dom.isLi(splitRoot)) {
        const nextLi = dom.splitTree(splitRoot, rng.getStartPoint());
        range.create(nextLi, 0).normalize().select().scrollIntoView(editable);
        return;
      }
    }

    // Default: insert <br> with zero-width space for cursor placement
    if (rng.isCollapsed() && !rng.isOnAnchor()) {
      const br = dom.create('BR');

      if (cell) {
        // Table cell: direct DOM manipulation
        const startNode = rng.sc;
        const startOffset = rng.so;
        if (startNode.nodeType === 3) {
          const afterText = startNode.splitText(startOffset);
          startNode.parentNode.insertBefore(br, afterText);
        } else {
          if (startOffset < startNode.childNodes.length) {
            startNode.insertBefore(br, startNode.childNodes[startOffset]);
          } else {
            startNode.appendChild(br);
          }
        }
      } else {
        rng.insertNode(br);
      }

      const textNode = document.createTextNode('\u200B');
      dom.insertAfter(textNode, br);
      range.create(textNode, 1).select();
    }
  }

  /**
   * insert paragraph
   *
   * @param {jQuery} $editable
   * @param {WrappedRange} rng Can be used in unit tests to "mock" the range
   *
   * blockquoteBreakingLevel
   *   0 - No break, the new paragraph remains inside the quote
   *   1 - Break the first blockquote in the ancestors list
   *   2 - Break all blockquotes, so that the new paragraph is not quoted (this is the default)
   */
  insertParagraph(editable, rng) {
    rng = rng || range.create(editable);

    // Check if in a table cell — skip deleteContents/wrapBodyInlineWithPara to avoid splitting
    const cell = dom.ancestor(rng.sc, dom.isCell);

    if (!cell) {
      // deleteContents on range.
      rng = rng.deleteContents();

      // Wrap range if it needs to be wrapped by paragraph
      rng = rng.wrapBodyInlineWithPara();
    }

    // finding paragraph — but NOT inside a table cell
    const splitRoot = cell ? null : dom.ancestor(rng.sc, dom.isPara);

    let nextPara;
    // on paragraph: split paragraph
    if (splitRoot) {
      // if it is an empty line with li
      if (dom.isLi(splitRoot) && (dom.isEmpty(splitRoot) || dom.deepestChildIsEmpty(splitRoot))) {

        const parentList = splitRoot.parentNode;
        const isNestedList = parentList && dom.ancestor(parentList.parentNode, dom.isLi);

        if (isNestedList) {
          this.bullet.outdent(editable);
          return;
        } else {
          // Top-level empty LI: create new paragraph after the list
          const parentUl = splitRoot.parentNode;
          const newPara = $(dom.emptyPara)[0];
          dom.insertAfter(newPara, parentUl);
          splitRoot.parentNode.removeChild(splitRoot);
          if (parentUl.children.length === 0) {
            parentUl.parentNode.removeChild(parentUl);
          }
          range.create(newPara, 0).normalize().select().scrollIntoView(editable);
          return;
        }

      } else {
        let blockquote = null;
        if (this.options.blockquoteBreakingLevel === 1) {
          blockquote = dom.ancestor(splitRoot, dom.isBlockquote);
        } else if (this.options.blockquoteBreakingLevel === 2) {
          blockquote = dom.lastAncestor(splitRoot, dom.isBlockquote);
        }

        if (blockquote) {
          // We're inside a blockquote and options ask us to break it
          nextPara = $(dom.emptyPara)[0];
          // If the split is right before a <br>, remove it so that there's no "empty line"
          // after the split in the new blockquote created
          if (dom.isRightEdgePoint(rng.getStartPoint()) && dom.isBR(rng.sc.nextSibling)) {
            $(rng.sc.nextSibling).remove();
          }
          const split = dom.splitTree(blockquote, rng.getStartPoint(), { isDiscardEmptySplits: true });
          if (split) {
            split.parentNode.insertBefore(nextPara, split);
          } else {
            dom.insertAfter(nextPara, blockquote); // There's no split if we were at the end of the blockquote
          }
        } else {
          nextPara = dom.splitTree(splitRoot, rng.getStartPoint());

          // not a blockquote, just insert the paragraph
          let emptyAnchors = dom.listDescendant(splitRoot, dom.isEmptyAnchor);
          emptyAnchors = emptyAnchors.concat(dom.listDescendant(nextPara, dom.isEmptyAnchor));

          $.each(emptyAnchors, (idx, anchor) => {
            dom.remove(anchor);
          });

          // replace empty heading, pre or custom-made styleTag with P tag
          if ((dom.isHeading(nextPara) || dom.isPre(nextPara) || dom.isCustomStyleTag(nextPara)) && dom.isEmpty(nextPara)) {
            nextPara = dom.replace(nextPara, 'p');
          }
        }
      }
    // no paragraph: insert empty paragraph
    } else {

      if (cell) {
        const startNode = rng.sc;
        const startOffset = rng.so;
        nextPara = $(dom.emptyPara)[0];
        if (startNode.nodeType === 3) {
          const afterText = startNode.splitText(startOffset);
          startNode.parentNode.insertBefore(nextPara, afterText);
        } else {
          if (startOffset < startNode.childNodes.length) {
            startNode.insertBefore(nextPara, startNode.childNodes[startOffset]);
          } else {
            startNode.appendChild(nextPara);
          }
        }
      } else {
        const next = rng.sc.childNodes[rng.so];
        nextPara = $(dom.emptyPara)[0];
        if (next) {
          rng.sc.insertBefore(nextPara, next);
        } else {
          rng.sc.appendChild(nextPara);
        }
      }

    }

    range.create(nextPara, 0).normalize().select().scrollIntoView(editable);
  }
}
