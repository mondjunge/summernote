(function(factory) {
  if (typeof define === 'function' && define.amd) {
    define(['jquery'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('jquery'));
  } else {
    factory(window.jQuery);
  }
}(function($) {
  /**
   * Copyright (c) 2026 HIS eG - Tim Wahrendorff
   * Licensed under the MIT License (http://opensource.org/licenses/MIT)
   * 
   * paste-as-text plugin for Summernote
   *
   * Opens a dialog with a textarea. The text entered is inserted at the
   * current cursor position as plain text (HTML-escaped, newlines converted
   * to <br>). If no range exists inside the editor, the text is appended.
   *
   * Usage:
   *   Include this file after summernote, then add 'pasteAsText' to the toolbar:
   *   $('.editor').summernote({
   *     toolbar: [['insert', ['pasteAsText']]],
   *   });
   */
  var DEFAULT_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="currentColor">' +
    '<path d="M13 3h-2.18A2 2 0 0 0 9 2H7a2 2 0 0 0-1.82 1H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm-6 0a1 1 0 0 1 2 0v1H7V3zm6 11H3V4h1.5v1a.5.5 0 0 0 .5.5h5A.5.5 0 0 0 10.5 5V4H13v10z"/>' +
    '<rect x="4.5" y="8" width="7" height="1" rx="0.5"/>' +
    '<rect x="4.5" y="10" width="7" height="1" rx="0.5"/>' +
    '<rect x="4.5" y="12" width="4" height="1" rx="0.5"/>' +
    '</svg>';

  var PasteAsTextPlugin = function(context) {
    var self = this;
    // Resolve ui lazily — $.summernote.ui is not available until Summernote
    // has fully loaded, so we must not access it at module evaluation time.
    var ui = $.summernote.ui;
    var options = context.options;
    // Safe lang access — falls back to English if the locale doesn't include
    // pasteAsText entries (e.g. when using an older/external lang pack).
    var pluginLang = (options.langInfo && options.langInfo.pasteAsText) || {};
    var L = {
      button: pluginLang.button || 'Paste as plain text',
      title:  pluginLang.title  || 'Paste as plain text',
      label:  pluginLang.label  || 'Text',
      insert: pluginLang.insert || 'Insert',
      cancel: pluginLang.cancel || 'Cancel',
    };
    // Icon: user can pass options.pasteAsText.icon when calling .summernote({...}).
    // We deliberately do NOT register this in $.summernote.options to avoid
    // interference with old Summernote bundles that iterate over global options.
    var icon = (options.pasteAsText && options.pasteAsText.icon) || DEFAULT_ICON;

    // Toolbar button
    context.memo('button.pasteAsText', function() {
      return ui.button({
        contents: icon,
        tooltip: L.button,
        container: options.container,
        click: context.createInvokeHandler('pasteAsText.showDialog'),
      }).render();
    });

    self.initialize = function() {
      var $container = options.dialogsInBody ? $(document.body) : context.layoutInfo.editor;

      var body = '<div class="form-group">' +
        '<label for="ext-paste-as-text-input">' + L.label + '</label>' +
        '<textarea id="ext-paste-as-text-input" class="ext-paste-as-text-input form-control" rows="8" ' +
        'style="width:100%;resize:vertical;font-family:monospace;"></textarea>' +
        '</div>';

      var footer =
        '<button type="button" class="btn note-btn btn-primary ext-paste-as-text-insert" disabled>' +
          L.insert +
        '</button>';

      self.$dialog = ui.dialog({
        title: L.title,
        fade: options.dialogsFade,
        body: body,
        footer: footer,
        lang: options.langInfo,
      }).render().appendTo($container);
    };

    self.destroy = function() {
      ui.hideDialog(self.$dialog);
      self.$dialog.remove();
      self.$dialog = null;
    };

    self.showDialog = function() {
      // Remember whether there is a valid range inside the editor before the
      // dialog steals focus.
      var rng = context.invoke('editor.createRange');
      var hasRange = rng && !rng.isCollapsed();

      context.invoke('editor.saveRange');

      self
        .openDialog()
        .then(function(text) {
          ui.hideDialog(self.$dialog);
          self._insertText(text, hasRange);
        })
        .fail(function() {
          context.invoke('editor.restoreRange');
        });
    };

    self.openDialog = function() {
      return $.Deferred(function(deferred) {
        var $textarea = self.$dialog.find('.ext-paste-as-text-input');
        var $insertBtn = self.$dialog.find('.ext-paste-as-text-insert');
        var $cancelBtn = self.$dialog.find('.ext-paste-as-text-cancel');

        ui.onDialogShown(self.$dialog, function() {
          context.triggerEvent('dialog.shown');

          $textarea
            .val('')
            .off('input')
            .on('input', function() {
              ui.toggleBtn($insertBtn, $textarea.val().length > 0);
            })
            .trigger('focus');

          ui.toggleBtn($insertBtn, false);

          $insertBtn.off('click').on('click', function(e) {
            e.preventDefault();
            deferred.resolve($textarea.val());
          });

          $cancelBtn.off('click').on('click', function(e) {
            e.preventDefault();
            deferred.reject();
          });
        });

        ui.onDialogHidden(self.$dialog, function() {
          $textarea.off('input');
          $insertBtn.off('click');
          $cancelBtn.off('click');

          if (deferred.state() === 'pending') {
            deferred.reject();
          }
        });

        ui.showDialog(self.$dialog);
      });
    };

    /**
     * Insert plain text at saved range or append to editor if no range exists.
     * Newlines are converted to <br>, HTML characters are escaped.
     *
     * Uses native DOM insertion (selection API + DocumentFragment) to avoid
     * Summernote's wrapBodyInlineWithPara path which breaks when the parent
     * node is null (e.g. when inserting into a table cell with a selection).
     */
    self._insertText = function(text, hasRange) {
      var html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');

      if (hasRange) {
        context.invoke('editor.restoreRange');
      } else {
        // No saved selection — place cursor at the end of the editable area.
        var $editable = context.layoutInfo.editable;
        var endRange = document.createRange();
        endRange.selectNodeContents($editable[0]);
        endRange.collapse(false);
        var endSel = window.getSelection();
        endSel.removeAllRanges();
        endSel.addRange(endRange);
      }

      context.invoke('editor.focus');

      var selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        var nativeRange = selection.getRangeAt(0);
        nativeRange.deleteContents();

        var tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        var fragment = document.createDocumentFragment();
        var node;
        while ((node = tempDiv.firstChild)) {
          fragment.appendChild(node);
        }

        nativeRange.insertNode(fragment);
        selection.collapseToEnd();

        // Notify Summernote so history / change events are updated.
        context.triggerEvent('change', context.layoutInfo.editable.html());
      } else {
        // Fallback — should rarely be reached.
        context.invoke('editor.pasteHTML', html);
      }
    };
  };

  $.extend(true, $.summernote, {
    plugins: {
      pasteAsText: PasteAsTextPlugin,
    },

    lang: {
      'en-US': {
        pasteAsText: {
          button: 'Paste as plain text',
          title: 'Paste as plain text',
          label: 'Text',
          insert: 'Insert text',
          cancel: 'Cancel',
        },
      },
      'de-DE': {
        pasteAsText: {
          button: 'Als reinen Text einfügen',
          title: 'Als reinen Text einfügen',
          label: 'Text',
          insert: 'Text einfügen',
          cancel: 'Abbrechen',
        },
      },
      'fr-FR': {
        pasteAsText: {
          button: 'Coller en texte brut',
          title: 'Coller en texte brut',
          label: 'Texte',
          insert: 'Insérer',
          cancel: 'Annuler',
        },
      },
    },
  });
}));
