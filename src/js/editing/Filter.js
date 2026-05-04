/**
 * Filter.js
 * HTML content filter for Summernote.
 *
 * Filters HTML based on an allowedContent configuration:
 * - Replaces disallowed tags with <p> (preserving children and text nodes)
 * - Removes disallowed attributes
 * - Removes data-* attributes (except data-delayedsrc)
 * - Strips disallowed CSS properties from style attributes
 * - Converts <font> elements to <span>
 * - Removes HTML comments
 * - Removes trailing <br> and empty paragraphs
 * - Sanitizes URL attributes (href, src, srcset)
 */

/**
 * Default allowedContent configuration.
 * Can be overridden via summernote options.
 */
export const defaultAllowedContent = {
  elements: {
    h1: true, h2: true, h3: true, h4: true, h5: true, h6: true,
    a: true, abbr: true, b: true, i: true, u: true, sub: true, sup: true,
    ul: true, ol: true, li: true, dl: true, dt: true, dd: true,
    p: true, span: true, em: true, s: true, strike: true, strong: true,
    table: true, tbody: true, thead: true, tfoot: true, tr: true, th: true, td: true,
    colgroup: true, col: true, caption: true,
    div: true, small: true, pre: true, code: true,
    br: true, hr: true, img: true,
    style: false, svg: false,
  },
  attributes: [
    'aria-label', 'aria-labelledby', 'aria-describedby',
    'title', 'alt', 'src', 'target', 'style', 'class',
    'align', 'valign', 'bgcolor', 'colspan', 'rowspan', 'height', 'nowrap',
    'width', 'cellpadding', 'cellspacing', 'border',
    'id', 'scope', 'summary', 'href', 'lang', 'data-delayedsrc',
  ],
  styles: [
    'width', 'height', 'direction', 'line-height', 'vertical-align',
    'list-style-type', 'list-style-position',
    'color', 'background-color', 'background-repeat',
    'font-style', 'font-variant', 'font-weight', 'font-size',
    'text-indent', 'text-align', 'text-decoration',
    'letter-spacing', 'word-spacing', 'text-transform', 'white-space',
    'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
    'border-width', 'border-style', 'border-color', 'border-collapse',
  ],
  classes: true,
};

// Inline tags whose leading/trailing spaces are extracted to prevent &nbsp; serialization
const INLINE_TAGS = new Set(['span', 'b', 'i', 'u', 'em', 'strong', 's', 'strike', 'sub', 'sup', 'a']);

/**
 * Convert an "rgb(r, g, b)" string to "#rrggbb" hex.
 * Returns the input unchanged if it is not an rgb() value.
 */
export function rgbStringToHex(rgb) {
  const m = (rgb || '').match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (!m) return rgb;
  return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
}

// === URL Sanitizer ===
const UrlSanitizer = (() => {
  const urlOkSchemes = ['http', 'https', 'mailto', 'tel'];
  const svgNS = 'http://www.w3.org/2000/svg';
  const xlinkNS = 'http://www.w3.org/1999/xlink';
  const urlAllowImageData = false;

  function urlStripProblemAttrs(el) {
    const ban = ['srcdoc', 'formaction', 'action', 'poster', 'background'];
    for (const name of ban) {
      if (el.hasAttribute(name)) el.removeAttribute(name);
    }
  }

  function urlStripCtrlChars(s) {
    if (!s) return '';
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if ((c >= 0x20 && c !== 0x7F) || c > 0x9F) out += s.charAt(i);
    }
    return out;
  }

  function urlClean(s) {
    if (!s) return '';
    s = urlStripCtrlChars(s).trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith('\'') && s.endsWith('\''))) {
      s = s.slice(1, -1).trim();
    }
    return s;
  }

  function urlHardenAnchor(el) {
    if (el.tagName.toLowerCase() !== 'a') return;
    const target = el.getAttribute('target');
    if (target && target.toLowerCase() === '_blank') {
      const rel = new Set((el.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
      rel.add('noopener'); rel.add('noreferrer'); rel.add('ugc');
      el.setAttribute('rel', Array.from(rel).join(' '));
    }
  }

  function urlGetScheme(s) {
    const m = /^\s*([a-z0-9+.-]+):/i.exec(s);
    return m ? m[1].toLowerCase() : null;
  }

  function urlIsHashOnly(s) {
    return /^#[\w\-:.~%]+$/.test(s);
  }

  function urlSanitizeHref(raw) {
    let v = urlClean(raw);
    if (!v) return null;
    if (urlIsHashOnly(v)) return v;
    const scheme = urlGetScheme(v);
    if (!scheme) return v;
    if (!urlOkSchemes.includes(scheme)) return null;
    return v;
  }

  function urlSanitizeSrc(raw, tagName) {
    let v = urlClean(raw);
    if (!v) return null;
    const tag = (tagName || '').toLowerCase();
    if (v.toLowerCase().startsWith('data:')) {
      if (tag !== 'img' || !urlAllowImageData) return null;
      if (!/^data:image\/[a-z0-9+.-]+;base64,[a-z0-9+/=\s]+$/i.test(v)) return null;
      if (/^data:image\/svg\+xml/i.test(v)) return null;
      return v;
    }
    const scheme = urlGetScheme(v);
    if (!scheme) return v;
    if (!urlOkSchemes.includes(scheme)) return null;
    return v;
  }

  function urlSanitizeSrcset(raw, tagName) {
    const parts = (raw || '').split(',').map(x => x.trim()).filter(Boolean);
    if (!parts.length) return null;
    const out = [];
    for (const p of parts) {
      const m = /^(\S+)(\s+\d+(w|x))?$/.exec(p);
      if (!m) continue;
      const url = urlSanitizeSrc(m[1], tagName);
      if (url) out.push(url + (m[2] || ''));
    }
    return out.length ? out.join(', ') : null;
  }

  function urlStripEventHandlers(el) {
    const names = el.getAttributeNames ? el.getAttributeNames() : Array.from(el.attributes).map(a => a.name);
    for (const name of names) {
      if (name.toLowerCase().startsWith('on')) el.removeAttribute(name);
    }
  }

  function urlRemoveXlinkHref(el) {
    if (el.hasAttributeNS(xlinkNS, 'href')) el.removeAttributeNS(xlinkNS, 'href');
    if (el.hasAttribute('xlink:href')) el.removeAttribute('xlink:href');
  }

  function urlSanitizeSingleElement(el) {
    const tag = el.tagName.toLowerCase();
    const isSvg = el.namespaceURI === svgNS;

    if (isSvg && el.hasAttribute('href')) {
      const hv = urlSanitizeHref(el.getAttribute('href') || '');
      if (hv) el.setAttribute('href', hv); else el.removeAttribute('href');
    }

    let xv = null;
    const hadNS = el.hasAttributeNS && el.hasAttributeNS(xlinkNS, 'href');
    if (hadNS) {
      xv = el.getAttributeNS(xlinkNS, 'href');
    } else if (el.hasAttribute('xlink:href')) {
      xv = el.getAttribute('xlink:href');
    }
    if (xv != null) {
      const clean = urlSanitizeHref(xv);
      if (clean) {
        if (hadNS) el.setAttributeNS(xlinkNS, 'href', clean);
        else el.setAttribute('xlink:href', clean);
      } else {
        urlRemoveXlinkHref(el);
      }
    }

    if (el.hasAttribute('href')) {
      urlHardenAnchor(el);
      const v = urlSanitizeHref(el.getAttribute('href') || '');
      if (v) el.setAttribute('href', v); else el.removeAttribute('href');
    }

    if (el.hasAttribute('src')) {
      const v = urlSanitizeSrc(el.getAttribute('src') || '', tag);
      if (v) el.setAttribute('src', v); else el.removeAttribute('src');
    }

    if (tag === 'img' && el.hasAttribute('srcset')) {
      const v = urlSanitizeSrcset(el.getAttribute('srcset') || '', tag);
      if (v) el.setAttribute('srcset', v); else el.removeAttribute('srcset');
    }

    urlStripEventHandlers(el);
    urlStripProblemAttrs(el);
  }

  function sanitizeUrlAttributes(el) {
    const isSvgRootOrNode = el.namespaceURI === svgNS;
    urlSanitizeSingleElement(el);
    if (!isSvgRootOrNode) return;

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      urlSanitizeSingleElement(n);
    }
  }

  return {
    urlSanitizeHref,
    urlSanitizeSrc,
    urlSanitizeSrcset,
    sanitizeUrlAttributes,
  };
})();
// === end URL Sanitizer ===

export default class Filter {
  constructor(context) {
    this.context = context;
    this.options = context.options;
  }

  /**
   * Filter the initial editable content when the editor is first mounted.
   * The layout sets the initial content directly into the editable element,
   * bypassing Context.code(), so we filter it here.
   */
  initialize() {
    if (!this.options.allowedContent) return;
    const $editable = this.context.layoutInfo.editable;
    const current = $editable.html();
    const filtered = this.filterHtml(current, this.options.allowedContent);
    if (filtered !== current) {
      $editable.html(filtered);
    }
  }

  /**
   * Filter HTML content based on allowedContent configuration.
   *
   * @param {string} content - HTML string to filter
   * @param {Object} [allowedContent] - Allowed content config; defaults to options.allowedContent
   * @returns {string} Filtered HTML string
   */
  filterHtml(content, allowedContent) {
    if (content === '' || typeof content === 'undefined') return '';

    if (allowedContent === undefined) {
      allowedContent = this.options.allowedContent;
    }
    if (!allowedContent) return content;

    content = this.sanitizeHtmlString(content);
    if (content === '') return '';

    const rootElement = this._parseHtmlToElement(content);
    if (!rootElement) return '';

    this._removeHtmlComments(rootElement);
    this._traverseAndClean(rootElement, allowedContent);
    this._extractSpaceFromInlineElements(rootElement);

    return this._removeRemovedElements(rootElement.innerHTML);
  }

  /**
   * Strip color and background-color from elements where the value matches
   * the given defaults map. After stripping, remove empty style attributes
   * and unwrap attribute-less spans.
   *
   * @param {string} html - HTML string to process (should already be filtered)
   * @param {Object} defaults - map of { 'color': '#rrggbb', 'background-color': '#rrggbb' }
   * @returns {string} normalized HTML string
   */
  normalizeDefaultStyles(html, defaults) {
    if (!html || !defaults || typeof defaults !== 'object') return html;

    const propsToCheck = ['color', 'background-color'].filter(p => defaults[p] != null);
    if (!propsToCheck.length) return html;

    const root = this._parseHtmlToElement(html);

    root.querySelectorAll('[style]').forEach(el => {
      const declarations = (el.getAttribute('style') || '').split(';').map(s => s.trim()).filter(Boolean);
      const kept = declarations.filter(decl => {
        const colonIdx = decl.indexOf(':');
        if (colonIdx === -1) return true;
        const key = decl.slice(0, colonIdx).trim().toLowerCase();
        const value = decl.slice(colonIdx + 1).trim().toLowerCase();
        if (!propsToCheck.includes(key)) return true;
        // Normalize both sides to hex before comparing so rgb() and #rrggbb match
        return rgbStringToHex(value) !== rgbStringToHex((defaults[key] || '').toLowerCase());
      });
      if (kept.length === 0) {
        el.removeAttribute('style');
      } else if (kept.length !== declarations.length) {
        el.setAttribute('style', kept.join('; '));
      }
    });

    // Unwrap attribute-less spans (deepest first)
    const spans = Array.from(root.querySelectorAll('span'));
    for (let i = spans.length - 1; i >= 0; i--) {
      const span = spans[i];
      if (!span.parentNode || span.attributes.length > 0) continue;
      while (span.firstChild) span.parentNode.insertBefore(span.firstChild, span);
      span.parentNode.removeChild(span);
    }

    return root.innerHTML;
  }

  unwrapSingleParagraph(string) {
    const trimmed = string.trim();
    if (!trimmed.startsWith('<p>') || !trimmed.endsWith('</p>')) return string;
    const content = trimmed.slice(3, -4);
    if (content.includes('<p>') || content.includes('</p>')) return string;
    return content;
  }

  // ─── Private string-level helpers ────────────────────────────────────────

  sanitizeHtmlString(htmlString) {
    htmlString = this._trimAndRemoveEmptyPTag(htmlString);
    if (htmlString === '') return '';
    htmlString = this._removeZeroWidthSpace(htmlString);
    return htmlString;//.replace(/\n\s*/g, '');
  }

  _trimAndRemoveEmptyPTag(string) {
    let value = (string?.trim() === '<p><br></p>') ? '' : this._removeTrailingBr(string?.trim());
    value = (value === '<br>') ? '' : value;
    return value;
  }

  _removeZeroWidthSpace(string) {
    return string?.trim().replace(/\u200B/g, '');
  }

  _removeTrailingBr(string) {
    return string?.replace(/(<br\s*\/?>)+$/, '').replace(/<p>\s*<br>\s*<\/p>\s*$/g, '');
  }

  // ─── DOM parsing ─────────────────────────────────────────────────────────

  _parseHtmlToElement(htmlString) {
    if (!htmlString || typeof htmlString !== 'string') return document.createElement('div');
    const parsed = new DOMParser().parseFromString(htmlString, 'text/html');
    const styles = Array.from(parsed.head.querySelectorAll('style'));
    const container = parsed.createElement('div');
    styles.forEach(style => container.appendChild(style.cloneNode(true)));
    Array.from(parsed.body.childNodes).forEach(node => container.appendChild(node.cloneNode(true)));
    return container;
  }

  // ─── DOM-level helpers ───────────────────────────────────────────────────

  _removeRemovedElements(string) {
    return string.replace(/<p>REMOVE<\/p>/g, '').replace(/style=""/g, '');
  }

  _isHTMLElement(node) {
    return node.nodeType === Node.ELEMENT_NODE && node instanceof HTMLElement;
  }

  _isSVGElement(node) {
    return node.nodeType === Node.ELEMENT_NODE && node instanceof SVGElement;
  }

  _isTextNode(node) {
    return node.nodeType === Node.TEXT_NODE;
  }

  _hasDataAttributes(element) {
    return Object.keys(element.dataset).length > 0;
  }

  _isEmptyElement(element) {
    const tagName = element.tagName.toLowerCase();
    if (element.hasAttribute('class') || this._hasDataAttributes(element)) return false;
    if (['img', 'input', 'br', 'hr', 'area', 'base', 'col', 'embed', 'link', 'meta', 'param', 'source', 'track', 'wbr'].includes(tagName)
      || ['tr', 'td', 'th'].includes(tagName)) {
      return false;
    }
    for (let node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent.trim() !== '') return false;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (!this._isEmptyElement(node)) return false;
      }
    }
    return true;
  }

  _removeHtmlComments(rootElement) {
    const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_COMMENT, null, false);
    let commentNode;
    while ((commentNode = walker.nextNode())) {
      commentNode.parentNode.removeChild(commentNode);
      walker.currentNode = rootElement;
    }
  }

  /**
   * Replace element with an allowed substitute, keeping children.
   * - Empty/non-HTML elements → marker <p>REMOVE</p>
   * - <font> → <span> (transferring style/color)
   * - <h1> (when not allowed) → <h2>
   * - Everything else → <p>
   */
  _replaceElement(element) {
    if (element.textContent.trim().length === 0
      || this._isEmptyElement(element)
      || element.tagName.toUpperCase() === 'STYLE'
      || element.tagName.toUpperCase() === 'SCRIPT'
      || !this._isHTMLElement(element)) {
      const marker = document.createElement('p');
      marker.textContent = 'REMOVE';
      if (!element.parentNode) {
        element.remove();
      } else {
        element.parentNode.replaceChild(marker, element);
      }
      return marker;
    }

    if (element.tagName === 'FONT') {
      const fontStyle = element.getAttribute('style') || '';
      const fontColor = element.getAttribute('color') ? `color:${element.getAttribute('color')};` : '';
      const combinedStyle = fontStyle + (fontStyle && fontColor ? ' ' : '') + fontColor;
      const span = document.createElement('span');
      if (combinedStyle.trim()) span.setAttribute('style', combinedStyle);
      Array.from(element.attributes).forEach(attr => {
        if (attr.name !== 'color' && attr.name !== 'style') span.setAttribute(attr.name, attr.value);
      });
      while (element.firstChild) span.appendChild(element.firstChild);
      element.replaceWith(span);
      return span;
    }

    if (element.tagName === 'H1') {
      const h2 = document.createElement('h2');
      while (element.firstChild) h2.appendChild(element.firstChild);
      if (element.parentNode) element.parentNode.replaceChild(h2, element);
      return h2;
    }

    const p = document.createElement('p');
    while (element.firstChild) p.appendChild(element.firstChild);
    if (element.parentNode) element.parentNode.replaceChild(p, element);
    return p;
  }

  /**
   * Filter inline style attribute value against allowedContent.styles.
   * Converts rgb() to hex. Removes dangerous or disallowed declarations.
   *
   * @param {string} style - raw style attribute value
   * @param {Object} allowedContent
   * @returns {string[]} Array of allowed "key: value" declarations
   */
  _cleanStyle(style, allowedContent) {
    const rgbReplaceRegex = /rgb\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*\)/gi;
    const rgbTestRegex = /^rgb\(\s*[0-9]+\s*,\s*[0-9]+\s*,\s*[0-9]+\s*\)$/i;

    const hexStyle = style.replace(rgbReplaceRegex, (match, r, g, b) => {
      const red = parseInt(r), green = parseInt(g), blue = parseInt(b);
      if (red <= 255 && green <= 255 && blue <= 255) {
        return `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`;
      }
      return match;
    });

    const allowedStyles = allowedContent.styles;
    const unallowedValueChars = /[@`'"\\\/()&*[\]]/;
    const unallowedProzent = /%[^\s;]/;
    const unallowedWords = /\b(behavior|behaviour|binding|expression|script|url)\b/i;

    return hexStyle.split(';').map(s => s.trim()).filter(Boolean).filter(declaration => {
      const colonIdx = declaration.indexOf(':');
      if (colonIdx === -1) return false;
      const key = declaration.slice(0, colonIdx).trim();
      const value = declaration.slice(colonIdx + 1).trim();

      const keyAllowed = allowedStyles === true
        ? true
        : (Array.isArray(allowedStyles) ? allowedStyles.includes(key) : false);

      if (!keyAllowed) return false;

      if (unallowedValueChars.test(value) || unallowedProzent.test(value) || unallowedWords.test(value)) {
        return rgbTestRegex.test(value);
      }
      return true;
    });
  }

  /**
   * Recursively traverse the DOM tree and clean each node.
   *
   * @param {Node} element
   * @param {Object} allowedContent
   */
  _traverseAndClean(element, allowedContent) {
    if (this._isTextNode(element)) return;

    if ((!this._isHTMLElement(element) && !this._isSVGElement(element)) || this._isEmptyElement(element)) {
      // Whitespace-only elements (e.g. <span> </span> used as word separators):
      // unwrap instead of removing so the space text node is preserved in the
      // parent. Keeping the span would cause the browser serializer to convert
      // the lone space to &nbsp;.
      if (element.parentNode && element.textContent.length > 0 && element.textContent.trim() === '') {
        Array.from(element.childNodes).forEach(child => element.parentNode.insertBefore(child, element));
        element.parentNode.removeChild(element);
      } else {
        this._replaceElement(element);
      }
      return;
    }

    if (element.nodeType === Node.ELEMENT_NODE) {
      const tagName = element.tagName.toLowerCase();

      // Only replace elements that have a parent node.
      // The root wrapper element has no parent and must not be replaced;
      // its children are extracted via innerHTML after traversal.
      if (element.parentNode && (!(tagName in allowedContent.elements) || allowedContent.elements[tagName] === false)) {
        element = this._replaceElement(element);
      }

      Array.from(element.attributes).forEach(attr => {
        const attrAllowed = allowedContent.attributes === true
          ? true
          : (Array.isArray(allowedContent.attributes) ? allowedContent.attributes.includes(attr.name) : false);

        const isDisallowedDataAttr = attr.name.startsWith('data-') && attr.name !== 'data-delayedsrc';

        if (!attrAllowed || isDisallowedDataAttr) {
          element.removeAttribute(attr.name);
        } else if (attr.name === 'style' && element.hasAttribute('style')) {
          const cleaned = this._cleanStyle(element.getAttribute('style'), allowedContent);
          element.setAttribute('style', cleaned.length ? cleaned.join('; ') : '');
        }
      });

      UrlSanitizer.sanitizeUrlAttributes(element);

      if (element.hasAttribute('class') && (!allowedContent.classes || element.getAttribute('class').trim() === '')) {
        element.removeAttribute('class');
      }
    }

    Array.from(element.childNodes).forEach(child => this._traverseAndClean(child, allowedContent));
  }

  // ─── Space extraction (prevents browser &nbsp; serialization) ────────────

  /**
   * Move leading/trailing ASCII spaces out of inline elements so the browser
   * serializer does not convert them to &nbsp; in innerHTML output.
   * Processes deepest elements first (post-order) so nested inline elements
   * are handled before their parents.
   */
  _extractSpaceFromInlineElements(rootElement) {
    this._postOrderWalkInline(rootElement, el => this._extractLeadingTrailingSpaces(el, rootElement));
  }

  _postOrderWalkInline(node, callback) {
    Array.from(node.childNodes).forEach(child => this._postOrderWalkInline(child, callback));
    if (node.nodeType === Node.ELEMENT_NODE && INLINE_TAGS.has(node.tagName.toLowerCase())) {
      callback(node);
    }
  }

  /**
   * Move leading/trailing regular spaces (ASCII 32) from an inline element
   * to adjacent text nodes in the parent. Non-breaking spaces (\u00a0) are
   * left untouched. Removes the element if it became empty.
   *
   * Spaces are NOT extracted when the parent is the filter root element —
   * those spaces would be trimmed away by range.pasteHTML and lost.
   */
  _extractLeadingTrailingSpaces(el, rootElement) {
    if (!el.parentNode) return;
    // Skip extraction at the top level: the space would end up as a sibling
    // of the inline element directly under the root wrapper, and consumers like
    // range.pasteHTML trim the resulting markup string, silently dropping it.
    if (el.parentNode === rootElement) return;

    // Trailing spaces
    const last = el.lastChild;
    if (last && last.nodeType === Node.TEXT_NODE) {
      const m = last.nodeValue.match(/( +)$/);
      if (m) {
        last.nodeValue = last.nodeValue.slice(0, -m[1].length);
        el.parentNode.insertBefore(document.createTextNode(m[1]), el.nextSibling);
      }
    }

    // Leading spaces (re-read firstChild after possible trailing-space mutation)
    const first = el.firstChild;
    if (first && first.nodeType === Node.TEXT_NODE) {
      const m = first.nodeValue.match(/^( +)/);
      if (m) {
        first.nodeValue = first.nodeValue.slice(m[1].length);
        el.parentNode.insertBefore(document.createTextNode(m[1]), el);
      }
    }

    // Remove element if it became empty
    if (!el.firstChild && el.parentNode) el.parentNode.removeChild(el);
  }
}
