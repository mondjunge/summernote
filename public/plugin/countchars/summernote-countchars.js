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
      console.log('context', context);
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
        const length = removeZeroWidthSpace(unwrapSingleParagraph(text)).length;
        $counter.text(length.toLocaleString() + (lang.countchars.divider ? lang.countchars.divider : '/') + maxChars.toLocaleString() + ' ' + (lang.countchars.chars ? lang.countchars.chars : 'Zeichen'));

        if (length > maxChars) {
          $counter.css('color', 'red');
        } else {
          $counter.css('color', '');
        }
      }

      function unwrapSingleParagraph(string) {
        const trimmed = string.trim().replace(/\n\s*/g, ''); // remove formatter newlines and spaces;
        if(trimmed === '') return '';

        // check if string starts with <p> and ends with </p>
        if (!trimmed.startsWith('<p>') || !trimmed.endsWith('</p>')) {
          return string.replace(/\n\s*/g, '');
        }

        // strips the outer <p> and </p> tags
        const content = trimmed.slice(3, -4);

        // check if the content still contains <p> or </p> tags
        // should never happen since it is semantically incorrect HTML and editor/browser should fix it beforehand
        // but you never know...
        if (content.includes('<p>') || content.includes('</p>')) {
          // return full string
          return string.replace(/\n\s*/g, '');
        }

        // return unwrapped content
        
        return content;
      }
      function removeZeroWidthSpace(string) {
        return string.trim().replace(/\u200B/g, '');
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
