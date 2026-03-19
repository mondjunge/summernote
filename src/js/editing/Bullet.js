import $ from 'jquery';
import lists from '../core/lists';
import func from '../core/func';
import dom from '../core/dom';
import range from '../core/range';

// Tracks <p> nodes created as non-selected prefix/suffix by splitParasAtBr.
// mergeParagraphsWithBr uses this to absorb ONLY those nodes, not unrelated paragraphs.
const brSplitFragments = new WeakSet();

export default class Bullet {
  /**
   * toggle ordered list
   */
  insertOrderedList(editable, splitOnBr) {
    this.toggleList('OL', editable, splitOnBr);
  }

  /**
   * toggle unordered list
   */
  insertUnorderedList(editable, splitOnBr) {
    this.toggleList('UL', editable, splitOnBr);
  }

  /**
   * indent
   */
  indent(editable) {
    const rng = range.create(editable).wrapBodyInlineWithPara();

    const paras = rng.nodes(dom.isPara, { includeAncestor: true });
    const clustereds = lists.clusterBy(paras, func.peq2('parentNode'));

    $.each(clustereds, (idx, paras) => {
      const head = lists.head(paras);
      if (dom.isLi(head)) {

        let prevLi = head.previousSibling;
        while (prevLi && !dom.isLi(prevLi)) {
          prevLi = prevLi.previousSibling;
        }
        if (prevLi) {
          const previousList = this.findList(prevLi);
          if (previousList) {
            paras.map((para) => previousList.appendChild(para));
          } else {
            this.wrapList(paras, head.parentNode.nodeName);
            paras.map((para) => para.parentNode).map((para) => prevLi.appendChild(para));
          }
        }
        // if no previous li exists, do nothing

      } else {
        $.each(paras, (idx, para) => {
          $(para).css('marginLeft', (idx, val) => {
            return (parseInt(val, 10) || 0) + 25;
          });
        });
      }
    });

    rng.select();
  }

  /**
   * outdent
   */
  outdent(editable) {
    const rng = range.create(editable).wrapBodyInlineWithPara();

    const paras = rng.nodes(dom.isPara, { includeAncestor: true });
    const clustereds = lists.clusterBy(paras, func.peq2('parentNode'));

    $.each(clustereds, (idx, paras) => {
      const head = lists.head(paras);
      if (dom.isLi(head)) {

        const parentList = head.parentNode;
        const isNestedList = parentList && dom.ancestor(parentList.parentNode, dom.isLi);
        if (isNestedList) {
          this.releaseList([paras], false);
        } else {
          this.releaseList([paras]);
        }

      } else {
        $.each(paras, (idx, para) => {
          $(para).css('marginLeft', (idx, val) => {
            val = parseInt(val, 10) || 0;
            return val > 25 ? val - 25 : '';
          });
        });
      }
    });

    rng.select();
  }

  /**
   * toggle list
   *
   * @param {String} listName - OL or UL
   */
  toggleList(listName, editable, splitOnBr) {

    // When insertBreak mode is active, the cursor may be inside an inline element
    // that has no <p> ancestor (e.g. pasted rich HTML directly in the editable).
    // wrapBodyInlineWithPara() would then use isParaInline as its stop predicate,
    // which is always false for editable-direct children, collecting everything into
    // one giant <p>. We pre-wrap just the visual line here so wrapBodyInlineWithPara
    // finds an existing <p> ancestor and returns early.
    if (splitOnBr) {
      const rawRng = range.create(editable);
      if (rawRng.sc && !dom.ancestor(rawRng.sc, dom.isPara)) {
        this._preWrapInlineContent(rawRng, editable);
      }
    }

    const rng = range.create(editable).wrapBodyInlineWithPara();

    // wrapBodyInlineWithPara() only wraps inline content near rng.sc. When the
    // selection spans multiple paragraphs, standalone inline elements between
    // those paragraphs (e.g. <a>, <img>, bare text nodes that are direct children
    // of the editable) are never wrapped and therefore never picked up by
    // rng.nodes(dom.isPara, ...). Wrap them now so they become list items.
    this._wrapInlinesInRange(rng, editable);

    let paras = rng.nodes(dom.isPara, { includeAncestor: true });

    // When converting to a list, split pure paragraphs containing <br> tags so that
    // each visual line becomes a separate list item.
    // Only active when splitOnBr is true (i.e. ENTER is mapped to insertBreak).
    // rng is passed so only selected segments are returned (active selection respected).
    if (splitOnBr && lists.find(paras, dom.isPurePara)) {
      paras = this.splitParasAtBr(paras, rng);
    }

    const bookmark = rng.paraBookmark(paras);
    const clustereds = lists.clusterBy(paras, func.peq2('parentNode'));

    // paragraph to list
    if (lists.find(paras, dom.isPurePara)) {
      let wrappedParas = [];
      $.each(clustereds, (idx, paras) => {

        // A single wrapList call would move all paras into one <ul>/<ol>, leaving
        // any non-para elements (hr, dl/dt/dd, …) stranded outside the list.
        // Split the cluster at separator elements so each contiguous group of
        // paras gets its own list and the separators keep their DOM position.
        wrappedParas = wrappedParas.concat(this._wrapListGrouped(paras, listName));

      });
      paras = wrappedParas;
      // list to paragraph or change list style
    } else {
      const diffLists = rng
        .nodes(dom.isList, {
          includeAncestor: true,
        })
        .filter((listNode) => {
          return (listNode.nodeName !== listName);
        });

      if (diffLists.length) {
        $.each(diffLists, (idx, listNode) => {
          dom.replace(listNode, listName);
        });
      } else {
        paras = this.releaseList(clustereds, true);

        // When insertBreak is mapped to ENTER, merge the released <p> elements back
        // into a single block with <br> separators — inverse of splitParasAtBr.
        if (splitOnBr) {
          // Resolve the actual sc/ec DOM nodes from the released paras BEFORE merging.
          // After mergeParagraphsWithBr the nodes are *moved* (not recreated), so the
          // references remain valid and produce a correct range after the merge.
          // Exception: when sc/ec resolved to a para element itself (e.g. Select All),
          // the offset may exceed the node's child count after merging — clamp it.
          let sc = dom.fromOffsetPath(lists.head(paras), bookmark.s.path);
          const so = sc.nodeType === 3 ? Math.min(bookmark.s.offset, sc.length) : 0;
          let ec = dom.fromOffsetPath(lists.last(paras), bookmark.e.path);
          this.mergeParagraphsWithBr(paras);
          // After merge ec may be detached; fall back to first para in that case.
          if (!ec.isConnected) {
            ec = lists.head(paras);
          }
          const eo = ec.nodeType === 3
            ? Math.min(bookmark.e.offset, ec.length)
            : Math.min(bookmark.e.offset, ec.childNodes.length);
          try {
            range.create(sc, so, ec, eo).select();
          } catch (e) {
            range.create(lists.head(paras), 0, lists.head(paras), 0).select();
          }
          return;
        }

      }
    }

    try {
      range.createFromParaBookmark(bookmark, paras).select();
    } catch (e) {
      range.create(lists.head(paras), 0, lists.head(paras), 0).select();
    }
  }

  /**
   * @param {Node[]} paras
   * @param {String} listName
   * @return {Node[]}
   */
  wrapList(paras, listName) {
    const head = lists.head(paras);
    const last = lists.last(paras);

    const prevList = dom.isList(head.previousSibling) && head.previousSibling;
    const nextList = dom.isList(last.nextSibling) && last.nextSibling;

    const listNode = prevList || dom.insertAfter(dom.create(listName || 'UL'), last);

    // P to LI
    paras = paras.map((para) => {
      const li = dom.isPurePara(para) ? dom.replace(para, 'LI') : para;
      // Remove pure-whitespace text nodes, then trim partial leading/trailing
      // whitespace from the first/last text node (indentation from pasted HTML).
      while (li.firstChild && li.firstChild.nodeType === 3 && !li.firstChild.nodeValue.trim()) {
        li.removeChild(li.firstChild);
      }
      while (li.lastChild && li.lastChild.nodeType === 3 && !li.lastChild.nodeValue.trim()) {
        li.removeChild(li.lastChild);
      }
      if (li.firstChild && li.firstChild.nodeType === 3) {
        li.firstChild.nodeValue = li.firstChild.nodeValue.replace(/^\s+/, '');
        if (!li.firstChild.nodeValue) li.removeChild(li.firstChild);
      }
      if (li.lastChild && li.lastChild.nodeType === 3) {
        li.lastChild.nodeValue = li.lastChild.nodeValue.replace(/\s+$/, '');
        if (!li.lastChild.nodeValue) li.removeChild(li.lastChild);
      }
      return li;
    });

    // append to list(<ul>, <ol>)
    dom.appendChildNodes(listNode, paras, true);

    if (nextList) {
      dom.appendChildNodes(listNode, lists.from(nextList.childNodes), true);
      dom.remove(nextList);
    }

    return paras;
  }

  /**
   * @method releaseList
   *
   * @param {Array[]} clustereds
   * @param {Boolean} isEscapseToBody
   * @return {Node[]}
   */
  releaseList(clustereds, isEscapseToBody) {
    let releasedParas = [];

    $.each(clustereds, (idx, paras) => {
      const head = lists.head(paras);
      const last = lists.last(paras);

      const headList = isEscapseToBody ? dom.lastAncestor(head, dom.isList) : head.parentNode;
      const parentItem = headList.parentNode;

      if (headList.parentNode.nodeName === 'LI') {
        paras.map((para) => {
          const newList = this.findNextSiblings(para);

          if (parentItem.nextSibling) {
            parentItem.parentNode.insertBefore(para, parentItem.nextSibling);
          } else {
            parentItem.parentNode.appendChild(para);
          }

          if (newList.length) {
            this.wrapList(newList, headList.nodeName);
            para.appendChild(newList[0].parentNode);
          }
        });

        if (headList.children.length === 0) {
          parentItem.removeChild(headList);
        }

        if (parentItem.childNodes.length === 0) {
          parentItem.parentNode.removeChild(parentItem);
        }
      } else {
        const lastList =
          headList.childNodes.length > 1
            ? dom.splitTree(
              headList,
              {
                node: last.parentNode,
                offset: dom.position(last) + 1,
              },
              {
                isSkipPaddingBlankHTML: true,
              },
            )
            : null;

        const middleList = dom.splitTree(
          headList,
          {
            node: head.parentNode,
            offset: dom.position(head),
          },
          {
            isSkipPaddingBlankHTML: true,
          },
        );

        paras = isEscapseToBody
          ? dom.listDescendant(middleList, dom.isLi)
          : lists.from(middleList.childNodes).filter(dom.isLi);

        // LI to P
        if (isEscapseToBody || !dom.isList(headList.parentNode)) {
          paras = paras.map((para) => {
            return dom.replace(para, 'P');
          });
        }

        $.each(lists.from(paras).reverse(), (idx, para) => {
          dom.insertAfter(para, headList);
        });

        // remove empty lists
        const rootLists = lists.compact([headList, middleList, lastList]);
        $.each(rootLists, (idx, rootList) => {
          const listNodes = [rootList].concat(dom.listDescendant(rootList, dom.isList));
          $.each(listNodes.reverse(), (idx, listNode) => {
            if (!dom.nodeLength(listNode)) {
              dom.remove(listNode, true);
            }
          });
        });
      }

      releasedParas = releasedParas.concat(paras);
    });

    return releasedParas;
  }

  /**
   * @method appendToPrevious
   *
   * Appends list to previous list item, if
   * none exist it wraps the list in a new list item.
   *
   * @param {HTMLNode} ListItem
   * @return {HTMLNode}
   */
  appendToPrevious(node) {

    return node.previousSibling && dom.isLi(node.previousSibling) ? dom.appendChildNodes(node.previousSibling, [node]) : this.wrapList([node], 'LI');

  }

  /**
   * @method findList
   *
   * Finds an existing list in list item
   *
   * @param {HTMLNode} ListItem
   * @return {Array[]}
   */
  findList(node) {

    return node && node.children ? lists.find(node.children, (child) => ['OL', 'UL'].indexOf(child.nodeName) > -1) : null;

  }

  /**
   * @method findNextSiblings
   *
   * Finds all list item siblings that follow it
   *
   * @param {HTMLNode} ListItem
   * @return {HTMLNode}
   */
  findNextSiblings(node) {
    const siblings = [];
    while (node.nextSibling) {
      siblings.push(node.nextSibling);
      node = node.nextSibling;
    }
    return siblings;
  }

  /**
   * Split pure paragraphs at direct-child <br> boundaries.
   * Used by toggleList so that each BR-separated visual line becomes its own list item.
   *
   * @param {Node[]} paras
   * @return {Node[]}
   */
  splitParasAtBr(paras, rng) {
    const result = [];
    paras.forEach((para) => {
      if (!dom.isPurePara(para)) {
        result.push(para);
        return;
      }
      const hasBr = Array.from(para.childNodes).some((n) => n.nodeName === 'BR');
      if (!hasBr) {
        result.push(para);
        return;
      }
      const segments = [];
      let current = [];
      Array.from(para.childNodes).forEach((child) => {
        if (child.nodeName === 'BR') {
          segments.push(current);
          current = [];
        } else {
          current.push(child);
        }
      });
      segments.push(current);
      // Determine selection boundaries BEFORE any DOM manipulation.
      // We count BR separators in the original para.childNodes to map rng.sc/ec
      // to segment indices. This is robust even when rng.sc/ec point to the
      // para element itself (e.g. cursor at start/end of para), because those
      // nodes get removed from the DOM during the split and p.contains() would
      // fail if the check were done afterwards.
      let selStartIdx = 0;
      let selEndIdx = segments.length - 1;
      if (rng) {
        if (rng.isCollapsed()) {
          selStartIdx = selEndIdx = this._segmentIdx(para, rng.sc, rng.so, segments.length);
        } else {
          selStartIdx = this._segmentIdx(para, rng.sc, rng.so, segments.length);
          selEndIdx = this._segmentIdx(para, rng.ec, rng.eo, segments.length);
        }
      }
      const parent = para.parentNode;
      const newParas = [];
      segments.forEach((nodes) => {
        if (nodes.length === 0) return;
        const newPara = para.ownerDocument.createElement('P');
        nodes.forEach((n) => newPara.appendChild(n));
        parent.insertBefore(newPara, para);
        newParas.push(newPara);
      });
      parent.removeChild(para);
      if (newParas.length === 0) return;
      // Non-selected segments become brSplitFragments so that
      // mergeParagraphsWithBr can reassemble the original paragraph on reverse-toggle.
      newParas.forEach((p, idx) => {
        if (idx < selStartIdx || idx > selEndIdx) brSplitFragments.add(p);
      });
      result.push(...newParas.slice(selStartIdx, selEndIdx + 1));
    });
    return result;
  }

  /**
   * Return the 0-based index of the BR-separated segment in para that contains
   * the given range endpoint (node + offset). Must be called BEFORE the
   * children of para are moved (i.e. before DOM manipulation).
   *
   * @param {Element} para
   * @param {Node}    node   - rng.sc or rng.ec
   * @param {number}  offset - rng.so or rng.eo
   * @param {number}  numSegments
   * @return {number}
   */
  _segmentIdx(para, node, offset, numSegments) {
    const children = Array.from(para.childNodes);
    let segIdx = 0;
    if (node === para) {
      // Range endpoint is the para element itself; offset is a child index.
      // Count BRs among children before that position.
      for (let i = 0; i < Math.min(offset, children.length); i++) {
        if (children[i].nodeName === 'BR') segIdx++;
      }
      return Math.min(segIdx, numSegments - 1);
    }
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.nodeName === 'BR') {
        segIdx++;
      } else if (child === node || child.contains(node)) {
        return segIdx;
      }
    }
    return 0; // fallback: first segment
  }

  /**
   * Merge multiple consecutive paragraphs into one, joining their content
   * with <br> elements. Inverse of splitParasAtBr.
   * Used by toggleList when insertBreak is mapped to ENTER.
   *
   * @param {Node[]} paras
   * @return {Node[]}
   */
  mergeParagraphsWithBr(paras) {
    if (paras.length === 0) return paras;
    let head = lists.head(paras);
    const doc = head.ownerDocument;
    // Merge all input paras into head with <br> separators
    paras.slice(1).forEach((para) => {
      head.appendChild(doc.createElement('BR'));
      while (para.firstChild) {
        head.appendChild(para.firstChild);
      }
      if (para.parentNode) para.parentNode.removeChild(para);
    });
    // Absorb prefix/suffix <p> nodes that were created by splitParasAtBr for this
    // exact split operation. Only nodes registered in brSplitFragments are absorbed,
    // so unrelated adjacent paragraphs are never affected.
    while (head.previousSibling && brSplitFragments.has(head.previousSibling)) {
      const prev = head.previousSibling;
      brSplitFragments.delete(prev);
      prev.appendChild(doc.createElement('BR'));
      while (head.firstChild) prev.appendChild(head.firstChild);
      if (head.parentNode) head.parentNode.removeChild(head);
      head = prev;
    }
    while (head.nextSibling && brSplitFragments.has(head.nextSibling)) {
      const next = head.nextSibling;
      brSplitFragments.delete(next);
      head.appendChild(doc.createElement('BR'));
      while (next.firstChild) head.appendChild(next.firstChild);
      if (next.parentNode) next.parentNode.removeChild(next);
    }
    return [head];
  }

  /**
   * Wrap a cluster of paragraphs into list(s), splitting at any separator
   * elements (hr, dl, dt, dd, …) that appear between consecutive paras in the
   * DOM. Each contiguous group of paras gets its own wrapList call so that
   * separator elements keep their original DOM position (between two lists)
   * instead of being displaced above or below a single merged list.
   *
   * @param {Node[]} paras    - paras within one parentNode cluster
   * @param {String} listName - 'UL' or 'OL'
   * @return {Node[]}         - flat array of all created LI nodes
   */
  _wrapListGrouped(paras, listName) {

    const subGroups = [[paras[0]]];
    for (let i = 1; i < paras.length; i++) {
      // Walk from the end of the previous para to the start of this para.
      // If any element node is encountered, start a new sub-group.
      let hasSeparator = false;
      let node = paras[i - 1].nextSibling;
      while (node && node !== paras[i]) {
        if (node.nodeType === 1) { hasSeparator = true; break; }
        node = node.nextSibling;
      }
      if (hasSeparator) {
        subGroups.push([paras[i]]);
      } else {
        subGroups[subGroups.length - 1].push(paras[i]);
      }
    }
    let result = [];
    subGroups.forEach((group) => {
      result = result.concat(this.wrapList(group, listName));
    });
    return result;

  }

  /**
   * Wrap consecutive sequences of inline direct children of the editable that
   * lie between the selection's bounding block elements into <p> elements.
   * This ensures standalone <a>, <img>, and bare text nodes within the selection
   * are treated as separate list items when toggling to a list.
   *
   * @param {WrappedRange} rng
   * @param {Element}      editable
   */
  _wrapInlinesInRange(rng, editable) {

    const children = Array.from(editable.childNodes);
    // Find the direct-child-of-editable ancestors of sc and ec.
    let scTop = rng.sc;
    while (scTop && scTop.parentNode !== editable) scTop = scTop.parentNode;
    let ecTop = rng.ec;
    while (ecTop && ecTop.parentNode !== editable) ecTop = ecTop.parentNode;
    if (!scTop || !ecTop) return;
    const scIdx = children.indexOf(scTop);
    const ecIdx = children.indexOf(ecTop);
    if (scIdx < 0 || ecIdx < 0 || scIdx > ecIdx) return;
    // Iterate from scIdx to ecIdx, collecting consecutive inline nodes and
    // wrapping each group in a new <p>.
    let inlineGroup = [];
    const flushGroup = () => {
      if (!inlineGroup.length) return;
      const p = editable.ownerDocument.createElement('P');
      inlineGroup[0].parentNode.insertBefore(p, inlineGroup[0]);
      inlineGroup.forEach((n) => p.appendChild(n));
      inlineGroup = [];
    };
    for (let i = scIdx; i <= ecIdx; i++) {
      const child = children[i];
      if (!child) continue;
      // Skip pure-whitespace text nodes between block elements — they must not
      // become empty list items.
      if (child.nodeType === 3 && child.nodeValue.trim() === '') continue;
      // _isLineBoundary covers semantic block elements (DL/DT/DD etc.) that
      // dom.isInline() incorrectly classifies as inline — exclude them.
      if ((dom.isInline(child) || child.nodeType === 3) && !this._isLineBoundary(child)) {
        inlineGroup.push(child);
      } else {
        flushGroup();
      }
    }
    flushGroup();

  }

  /**
   * Pre-wrap the visual line(s) containing the range endpoints in <p> elements.
   * Prevents wrapBodyInlineWithPara() from over-collecting block-level siblings
   * when the cursor is directly inside the editable (no <p> ancestor).
   *
   * @param {WrappedRange} rawRng
   * @param {Element}      editable
   */
  _preWrapInlineContent(rawRng, editable) {
    const scTop = this._topAncestor(rawRng.sc, editable);
    if (!scTop) return;
    this._wrapVisualLine(scTop, editable);
    if (!rawRng.isCollapsed()) {
      const ecTop = this._topAncestor(rawRng.ec, editable);
      if (ecTop && ecTop !== scTop && !this._isLineBoundary(ecTop)) {
        this._wrapVisualLine(ecTop, editable);
      }
    }
  }

  /**
   * Wrap the consecutive inline siblings around topAncestor (stopping at visual
   * line boundaries) into a new <p> element.
   *
   * @param {Node}    topAncestor - direct child of editable
   * @param {Element} editable
   */
  _wrapVisualLine(topAncestor, editable) {
    if (this._isLineBoundary(topAncestor)) return;
    const inlineSiblings = [];
    let node = topAncestor;
    while (node) {
      if (this._isLineBoundary(node)) break;
      inlineSiblings.unshift(node);
      node = node.previousSibling;
    }
    node = topAncestor.nextSibling;
    while (node) {
      if (this._isLineBoundary(node)) break;
      inlineSiblings.push(node);
      node = node.nextSibling;
    }
    if (inlineSiblings.length > 0) {
      const para = editable.ownerDocument.createElement('P');
      inlineSiblings[0].parentNode.insertBefore(para, inlineSiblings[0]);
      inlineSiblings.forEach((n) => para.appendChild(n));
    }
  }

  /**
   * Returns true if node should act as a visual line boundary — i.e. should NOT
   * be included in the inline cluster being wrapped into a <p>.
   *
   * @param {Node} node
   * @return {boolean}
   */
  _isLineBoundary(node) {
    if (!node || node.nodeType !== 1) return false;
    if (!dom.isInline(node)) return true;
    if (node.nodeName === 'BR') return true;
    return /^(ADDRESS|ARTICLE|ASIDE|DD|DL|DT|FIELDSET|FIGCAPTION|FIGURE|FOOTER|FORM|HEADER|MAIN|NAV|PRE|SECTION)$/.test(node.nodeName);
  }

  /**
   * Return the direct-child-of-editable ancestor of node, or null.
   *
   * @param {Node}    node
   * @param {Element} editable
   * @return {Node|null}
   */
  _topAncestor(node, editable) {
    while (node && node.parentNode !== editable) {
      node = node.parentNode;
    }
    return (node && node.parentNode === editable) ? node : null;
  }

}
