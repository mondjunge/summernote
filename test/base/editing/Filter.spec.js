/**
 * Filter.spec.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Filter, { defaultAllowedContent } from '@/js/editing/Filter';

// Minimal context mock for Filter instantiation
function makeFilter(allowedContent) {
  return new Filter({
    options: { allowedContent: allowedContent !== undefined ? allowedContent : defaultAllowedContent },
  });
}

describe('base:editing.Filter', () => {
  let filter;

  beforeEach(() => {
    filter = makeFilter();
  });

  // ─── Empty / trivial inputs ───────────────────────────────────────────────

  describe('empty inputs', () => {
    it('returns empty string for empty input', () => {
      expect(filter.filterHtml('')).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(filter.filterHtml(undefined)).toBe('');
    });

    it('returns empty string for <p><br></p>', () => {
      expect(filter.filterHtml('<p><br></p>')).toBe('');
    });

    it('returns empty string for lone <br>', () => {
      expect(filter.filterHtml('<br>')).toBe('');
    });

    it('returns content unchanged when allowedContent is false', () => {
      const f = makeFilter(false);
      expect(f.filterHtml('<script>alert(1)</script><p>hello</p>')).toBe('<script>alert(1)</script><p>hello</p>');
    });
  });

  // ─── Element filtering ────────────────────────────────────────────────────

  describe('element filtering', () => {
    it('passes through allowed block elements', () => {
      const result = filter.filterHtml('<p>hello</p>');
      expect(result).toBe('<p>hello</p>');
    });

    it('passes through allowed heading elements', () => {
      const result = filter.filterHtml('<h2>Title</h2><p>Body</p>');
      expect(result).toContain('<h2>Title</h2>');
      expect(result).toContain('Body');
    });

    it('passes through allowed inline elements', () => {
      const result = filter.filterHtml('<p><strong>bold</strong> and <em>italic</em></p>');
      expect(result).toContain('<strong>bold</strong>');
      expect(result).toContain('<em>italic</em>');
    });

    it('replaces disallowed element with p, keeping children', () => {
      const ac = {
        ...defaultAllowedContent,
        elements: { ...defaultAllowedContent.elements, div: false },
      };
      const result = filter.filterHtml('<div><p>content</p></div>', ac);
      expect(result).not.toContain('<div>');
      expect(result).toContain('content');
    });

    it('removes <style> element entirely', () => {
      const result = filter.filterHtml('<p>text</p><style>body{color:red}</style>');
      expect(result).not.toContain('<style>');
      expect(result).toContain('text');
    });

    it('removes <script> element entirely', () => {
      const result = filter.filterHtml('<p>hello</p><script>alert(1)</script>');
      expect(result).not.toContain('<script>');
      expect(result).toContain('hello');
    });

    it('converts <font color> to <span style>', () => {
      const result = filter.filterHtml('<p><font color="red">colored text</font></p>');
      expect(result).not.toContain('<font');
      expect(result).toContain('<span');
      expect(result).toContain('colored text');
      expect(result).toContain('color:red');
    });

    it('converts <font> with existing style to <span>', () => {
      const result = filter.filterHtml('<p><font style="font-size:12px" color="blue">text</font></p>');
      expect(result).toContain('<span');
      expect(result).toContain('color:blue');
      expect(result).toContain('text');
    });

    it('replaces <h1> with <h2> when h1 is not allowed', () => {
      const ac = {
        ...defaultAllowedContent,
        elements: { ...defaultAllowedContent.elements, h1: false, h2: true },
      };
      const result = filter.filterHtml('<h1>Heading</h1>', ac);
      expect(result).not.toContain('<h1>');
      expect(result).toContain('<h2>');
      expect(result).toContain('Heading');
    });

    it('keeps <h1> when allowed (default)', () => {
      const result = filter.filterHtml('<h1>Heading</h1>');
      expect(result).toContain('<h1>');
      expect(result).toContain('Heading');
    });

    it('keeps list elements', () => {
      const result = filter.filterHtml('<ul><li>item 1</li><li>item 2</li></ul>');
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>item 1</li>');
    });

    it('keeps table elements', () => {
      const result = filter.filterHtml('<table><tr><td>cell</td></tr></table>');
      expect(result).toContain('<table>');
      expect(result).toContain('<td>cell</td>');
    });
  });

  // ─── Attribute filtering ──────────────────────────────────────────────────

  describe('attribute filtering', () => {
    it('keeps allowed attributes', () => {
      const result = filter.filterHtml('<p id="foo" class="bar">text</p>');
      expect(result).toContain('id="foo"');
      expect(result).toContain('class="bar"');
    });

    it('removes disallowed attributes', () => {
      const result = filter.filterHtml('<p onclick="alert(1)" data-custom="val">text</p>');
      expect(result).not.toContain('onclick');
      expect(result).not.toContain('data-custom');
    });

    it('keeps data-delayedsrc', () => {
      const result = filter.filterHtml('<img src="" data-delayedsrc="/image.jpg">');
      expect(result).toContain('data-delayedsrc');
    });

    it('removes other data-* attributes', () => {
      const result = filter.filterHtml('<p data-foo="bar" data-baz="qux">text</p>');
      expect(result).not.toContain('data-foo');
      expect(result).not.toContain('data-baz');
    });

    it('removes event handler attributes (on*)', () => {
      const result = filter.filterHtml('<a href="#" onmouseover="evil()">link</a>');
      expect(result).not.toContain('onmouseover');
      expect(result).toContain('href');
    });

    it('removes class attribute when classes are not allowed', () => {
      const ac = { ...defaultAllowedContent, classes: false };
      const result = filter.filterHtml('<p class="foo">text</p>', ac);
      expect(result).not.toContain('class=');
    });

    it('keeps class attribute when classes are allowed', () => {
      const result = filter.filterHtml('<p class="foo">text</p>');
      expect(result).toContain('class="foo"');
    });
  });

  // ─── Style filtering ──────────────────────────────────────────────────────

  describe('style attribute filtering', () => {
    it('keeps allowed CSS properties', () => {
      const result = filter.filterHtml('<p style="color: red; font-weight: bold">text</p>');
      expect(result).toContain('color:');
      expect(result).toContain('font-weight:');
    });

    it('removes disallowed CSS properties', () => {
      const result = filter.filterHtml('<p style="color: red; display: flex; position: absolute">text</p>');
      expect(result).not.toContain('display');
      expect(result).not.toContain('position');
      expect(result).toContain('color');
    });

    it('removes CSS with dangerous value characters', () => {
      const result = filter.filterHtml('<p style="color: red; background: url(http://evil.com)">text</p>');
      expect(result).not.toContain('url(');
    });

    it('removes CSS with expression keyword', () => {
      const result = filter.filterHtml('<p style="width: expression(alert(1))">text</p>');
      expect(result).not.toContain('expression');
    });

    it('converts rgb() to hex in style', () => {
      const result = filter.filterHtml('<p style="color: rgb(255, 0, 0)">text</p>');
      expect(result).toContain('#ff0000');
    });

    it('removes empty style attribute after filtering', () => {
      const result = filter.filterHtml('<p style="display: block">text</p>');
      expect(result).not.toContain('style=""');
    });
  });

  // ─── URL sanitization ─────────────────────────────────────────────────────

  describe('URL sanitization', () => {
    it('keeps http href', () => {
      const result = filter.filterHtml('<a href="http://example.com">link</a>');
      expect(result).toContain('href="http://example.com"');
    });

    it('keeps https href', () => {
      const result = filter.filterHtml('<a href="https://example.com">link</a>');
      expect(result).toContain('href="https://example.com"');
    });

    it('keeps mailto href', () => {
      const result = filter.filterHtml('<a href="mailto:foo@example.com">email</a>');
      expect(result).toContain('href="mailto:foo@example.com"');
    });

    it('removes javascript: href', () => {
      const result = filter.filterHtml('<a href="javascript:alert(1)">xss</a>');
      expect(result).not.toContain('javascript:');
    });

    it('removes vbscript: href', () => {
      const result = filter.filterHtml('<a href="vbscript:msgbox(1)">xss</a>');
      expect(result).not.toContain('vbscript:');
    });

    it('removes data: src on img', () => {
      const result = filter.filterHtml('<img src="data:image/png;base64,abc123">');
      expect(result).not.toContain('src=');
    });

    it('removes formaction attribute', () => {
      const result = filter.filterHtml('<button formaction="http://evil.com">click</button>');
      expect(result).not.toContain('formaction');
    });

    it('hardens _blank links with rel=noopener', () => {
      const result = filter.filterHtml('<a href="https://example.com" target="_blank">link</a>');
      expect(result).toContain('noopener');
      expect(result).toContain('noreferrer');
    });
  });

  // ─── HTML comment removal ─────────────────────────────────────────────────

  describe('HTML comment removal', () => {
    it('removes HTML comments', () => {
      const result = filter.filterHtml('<p>text<!-- this is a comment --></p>');
      expect(result).not.toContain('<!--');
      expect(result).toContain('text');
    });

    it('removes conditional comments', () => {
      const result = filter.filterHtml('<p><!--[if mso]>evil<![endif]-->text</p>');
      expect(result).not.toContain('<!--');
      expect(result).toContain('text');
    });
  });

  // ─── String-level sanitization ────────────────────────────────────────────

  describe('string-level sanitization', () => {
    it('removes zero-width spaces', () => {
      const result = filter.filterHtml('<p>\u200Bhello\u200B</p>');
      expect(result).not.toContain('\u200B');
      expect(result).toContain('hello');
    });

    it('removes trailing <br>', () => {
      const result = filter.filterHtml('<p>text</p><br>');
      expect(result).not.toMatch(/<br>\s*$/);
    });

    it('preserves single paragraph with inline content', () => {
      const result = filter.filterHtml('<p>just text</p>');
      expect(result).toBe('<p>just text</p>');
    });

    it('preserves multiple paragraphs', () => {
      const result = filter.filterHtml('<p>first</p><p>second</p>');
      expect(result).toContain('<p>first</p>');
      expect(result).toContain('<p>second</p>');
    });
  });

  // ─── Custom allowedContent ────────────────────────────────────────────────

  describe('custom allowedContent', () => {
    it('allows non-data-* attributes when attributes: true', () => {
      const ac = { ...defaultAllowedContent, attributes: true };
      const result = filter.filterHtml('<p aria-custom="yes" data-custom="yes">text</p>', ac);
      expect(result).toContain('aria-custom="yes"');
      // data-* (except data-delayedsrc) are always stripped regardless of attributes setting
      expect(result).not.toContain('data-custom');
    });

    it('allows all styles when styles: true', () => {
      const ac = { ...defaultAllowedContent, styles: true };
      const result = filter.filterHtml('<p style="display: flex; color: red">text</p>', ac);
      expect(result).toContain('display');
      expect(result).toContain('color');
    });

    it('respects custom element allowlist', () => {
      const ac = {
        elements: { p: true, span: true },
        attributes: [],
        styles: [],
        classes: false,
      };
      const result = filter.filterHtml('<div><p>hello</p></div>', ac);
      expect(result).not.toContain('<div>');
      expect(result).toContain('<p>hello</p>');
    });
  });

  // ─── initialize() ────────────────────────────────────────────────────────

  describe('initialize()', () => {
    it('filters initial editable content on mount', () => {
      let editableHtml = '<p>hello</p><!-- comment --><script>evil()</script>';
      const mockContext = {
        options: { allowedContent: defaultAllowedContent },
        layoutInfo: {
          editable: {
            html: (val) => {
              if (val === undefined) return editableHtml;
              editableHtml = val;
            },
          },
        },
      };
      const f = new Filter(mockContext);
      f.initialize();
      expect(editableHtml).not.toContain('<!--');
      expect(editableHtml).not.toContain('<script');
      expect(editableHtml).toContain('<p>hello</p>');
    });

    it('does not change content when allowedContent is false', () => {
      const original = '<p>hello</p><!-- comment -->';
      let editableHtml = original;
      const mockContext = {
        options: { allowedContent: false },
        layoutInfo: {
          editable: { html: (val) => { if (val === undefined) return editableHtml; editableHtml = val; } },
        },
      };
      const f = new Filter(mockContext);
      f.initialize();
      expect(editableHtml).toBe(original);
    });
  });

  // ─── defaultAllowedContent export ────────────────────────────────────────

  describe('defaultAllowedContent', () => {
    it('has expected element keys', () => {
      expect(defaultAllowedContent.elements).toHaveProperty('p', true);
      expect(defaultAllowedContent.elements).toHaveProperty('table', true);
      expect(defaultAllowedContent.elements).toHaveProperty('style', false);
      expect(defaultAllowedContent.elements).toHaveProperty('svg', false);
    });

    it('includes expected attributes', () => {
      expect(defaultAllowedContent.attributes).toContain('href');
      expect(defaultAllowedContent.attributes).toContain('src');
      expect(defaultAllowedContent.attributes).toContain('class');
      expect(defaultAllowedContent.attributes).toContain('data-delayedsrc');
    });

    it('includes expected style properties', () => {
      expect(defaultAllowedContent.styles).toContain('color');
      expect(defaultAllowedContent.styles).toContain('font-size');
      expect(defaultAllowedContent.styles).toContain('border');
    });

    it('has classes: true', () => {
      expect(defaultAllowedContent.classes).toBe(true);
    });
  });
});
