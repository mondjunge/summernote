/**
 * LinkDialog.spec.js
 * (c) 2015~ Summernote Team
 * summernote may be freely distributed under the MIT license./
 */

import { describe, it, expect } from 'vitest';
import $ from 'jquery';
import range from '@/js/core/range';
import Context from '@/js/Context';
import LinkDialog from '@/js/module/LinkDialog';
import '@/styles/lite/summernote-lite';

describe('LinkDialog', () => {
  var context, dialog, $editable;

  beforeEach(() => {
    var options = $.extend({}, $.summernote.options);
    options.toolbar = [['insert', ['link']]];
    context = new Context(
      $(
        '<div>' +
          '<p><a href="https://summernote.org/" target="_blank">hello</a></p>' +
          '<p><a href="https://summernote.org/">world</a></p>' +
          '<p>http://summernote.org</p>' +
          '<p>summernote.org</p>' +
          '<p>summernote</p>' +
          '</div>',
      ),
      options,
    );
    context.initialize();

    dialog = new LinkDialog(context);
    dialog.initialize();

    $editable = context.layoutInfo.editable;
    $editable.appendTo('body');
  });

  describe('LinkDialog', () => {
    // open-in-new-window
    it('should check new window when target=_blank', () => {
      range.createFromNode($editable.find('a')[0]).normalize().select();
      context.invoke('editor.setLastRange');
      dialog.show();

      var checked = dialog.$dialog.find('.sn-checkbox-open-in-new-window input[type=checkbox]').is(':checked');
      expect(checked).to.be.true;
    });

    it('should uncheck new window without target=_blank', () => {
      range.createFromNode($editable.find('a')[1]).normalize().select();
      context.invoke('editor.setLastRange');
      dialog.show();

      var checked = dialog.$dialog.find('.sn-checkbox-open-in-new-window input[type=checkbox]').is(':checked');
      expect(checked).to.be.false;
    });

    // URL split into protocol-select + url-part
    it('should split https link into protocol select and url part', () => {
      range.createFromNode($editable.find('a')[0]).normalize().select();
      context.invoke('editor.setLastRange');
      dialog.show();

      expect(dialog.$dialog.find('.note-link-protocol').val()).to.equal('https://');
      expect(dialog.$dialog.find('.note-link-url').val()).to.equal('summernote.org/');
    });

    it('should split https link without target into protocol select and url part', () => {
      range.createFromNode($editable.find('a')[1]).normalize().select();
      context.invoke('editor.setLastRange');
      dialog.show();

      expect(dialog.$dialog.find('.note-link-protocol').val()).to.equal('https://');
      expect(dialog.$dialog.find('.note-link-url').val()).to.equal('summernote.org/');
    });

    it('should show empty url part when no link is selected', () => {
      range.createFromNode($editable.find('p')[4]).normalize().select();
      context.invoke('editor.setLastRange');
      dialog.show();

      expect(dialog.$dialog.find('.note-link-url').val()).to.equal('');
    });
  });
});
