(function(factory) {
  if (typeof define === 'function' && define.amd) {
    define(['jquery'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('jquery'));
  } else {
    factory(window.jQuery);
  }
}(function(jQuery) {
  jQuery.extend(jQuery.summernote.plugins, {
    'charcounter': function(context) {
      //console.log('context', context);
      const $editor = context.layoutInfo.editor;
      const $statusbar = $editor.find('.note-statusbar');
      const $editable = context.layoutInfo.editable;
      const maxChars = context.options.maxlength ? context.options.maxlength : 1000000;
      const lang = context.options.langInfo;

      // Anzeigeelement erzeugen
      const $counter = jQuery('<div class="note-char-counter" style="padding: 4px; font-size: 12px;"></div>');
      $statusbar.prepend($counter);

      function updateCounter() {
        const text = $editable.html() || $editable.text();
        const length = context.modules.filter.sanitizeHtmlString(text).replace('&nbsp;',' ').length; // Firefox injects &nbsp; for technical reasons and replaces them later with whitespace. Normalise them for counting.
        $counter.text(length.toLocaleString() + (lang.countchars.divider ? lang.countchars.divider : '/') + maxChars.toLocaleString() + ' ' + (lang.countchars.chars ? lang.countchars.chars : 'Zeichen'));

        if (length > maxChars) {
          $counter.css('color', 'red');
        } else {
          $counter.css('color', '');
        }
      }

      $editable.on('input keyup paste focus', function() {
        setTimeout(updateCounter, 0);
      });

      context.events = context.events || {};
      context.events['summernote.init'] = function() {
        updateCounter();
      };
      context.events['summernote.change'] = function() {
        updateCounter();
      };

      // einmal onInit aktulaisieren
      setTimeout(updateCounter, 0);
    },
  });
}));
