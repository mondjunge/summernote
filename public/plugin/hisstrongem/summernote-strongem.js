jQuery.extend(jQuery.summernote.plugins, {
  'his-strong': function(context) {
    const ui = jQuery.summernote.ui;
    const options = context.options;
    const $editor = context.$note;
    const lang = options.langInfo;

    context.memo('button.hisStrong', function() {
      const $button = ui.button({
        contents: options.icons.bold ? ui.icon(options.icons.bold) : '<strong>S</strong>',
        tooltip: lang.strongEm.strong ? lang.strongEm.strong : 'Fett (STRG+B)', //'Fett (CTRL+B)',
        container: options.container,
        className: 'note-btn-strong',
        click: function() {
          //console.log('strong button clicked');
          context.invoke('editor.focus');
          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0) return;

          const originalRange = selection.getRangeAt(0);

          if (originalRange.collapsed) {
            context.invoke('beforeCommand');

            const container = originalRange.startContainer;
            const parentStrong = jQuery(container).closest('strong')[0];
            const selection = window.getSelection();

            if (parentStrong) {
              const hasRealContent = Array.from(parentStrong.childNodes).some(n =>
                n.nodeType === 3 ? n.nodeValue.replace(/\u200B/g, '').trim() !== '' : n.nodeName !== 'BR'
              );

              if (!hasRealContent) {
                // Empty strong: unwrap (move children out, then remove strong)
                context.invoke('beforeCommand');
                const parent = parentStrong.parentNode;
                while (parentStrong.firstChild) parent.insertBefore(parentStrong.firstChild, parentStrong);
                parent.removeChild(parentStrong);
                context.invoke('afterCommand');
                const html = context.invoke('code');
                context.invoke('triggerEvent', 'change', html, context.layoutInfo.editable);
                updateButtonState();
                return;
              }

              // Non-empty strong: insert ZWSP after so browser breaks out of bold formatting
              const zwsp = document.createTextNode('\u200B');
              parentStrong.after(zwsp);
              const range = document.createRange();
              range.setStart(zwsp, 1);
              range.collapse(true);
              selection.removeAllRanges();
              selection.addRange(range);
              updateButtonState();
              return;
            } else {
              // No strong at cursor: insert empty strong with ZWSP at cursor position
              const strong = document.createElement('strong');
              const zwsp = document.createTextNode('\u200B');
              strong.appendChild(zwsp);
              originalRange.insertNode(strong);
              const range = document.createRange();
              range.setStart(zwsp, 1);
              range.collapse(true);
              selection.removeAllRanges();
              selection.addRange(range);
            }
            context.invoke('afterCommand');
            const html = context.invoke('code');
            context.invoke('triggerEvent', 'change', html, context.layoutInfo.editable);
            updateButtonState();
            return;
          }

          context.invoke('beforeCommand');

          // Sonderfall: nur ein TextNode selektiert
          if (originalRange.startContainer === originalRange.endContainer &&
						originalRange.startContainer.nodeType === 3 &&
						originalRange.startOffset !== originalRange.endOffset
          ) {
            const parentStrong = jQuery(originalRange.startContainer).closest('strong')[0];

            if (!parentStrong) {

              const selectedText = originalRange.extractContents();
              const strong = document.createElement('strong');
              strong.appendChild(selectedText);
              originalRange.insertNode(strong);

              // Selektion wiederherstellen innerhalb von <strong>
              const selection = window.getSelection();
              const newRange = document.createRange();
              const node = strong.firstChild;
              newRange.setStart(node, 0);
              newRange.setEnd(node, node.length);
              selection.removeAllRanges();
              selection.addRange(newRange);
            } else {
              // unwrap
              const parent = parentStrong.parentNode;
              const children = Array.from(parentStrong.childNodes); // inhalt merken
              parentStrong.replaceWith(...children);

              // neuen TextNode im DOM suchen, der dem alten entspricht
              const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT);
              let firstMatch = null;
              while (walker.nextNode()) {
                const node = walker.currentNode;
                if (children.includes(node)) {
                  firstMatch = node;
                  break;
                }
              }

              if (firstMatch) {
                const newRange = document.createRange();
                newRange.setStart(firstMatch, 0);
                newRange.setEnd(firstMatch, firstMatch.length);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(newRange);
              }
            }

            context.invoke('afterCommand');
            const html = context.invoke('code');
            context.invoke('triggerEvent', 'change', html, context.layoutInfo.editable);
            updateButtonState();
            return;
          }

          // Mehr als ein Element selektiert
          // Schritt 1: textNodes sammeln (vor Manipulation!)
          const textNodes = [];
          const walker = document.createTreeWalker(
            originalRange.commonAncestorContainer,
            NodeFilter.SHOW_TEXT,
            {
              acceptNode: function(node) {
                return originalRange.intersectsNode(node) && node.textContent.trim().length > 0
                  ? NodeFilter.FILTER_ACCEPT
                  : NodeFilter.FILTER_REJECT;
              },
            }
          );
          let node;
          while ((node = walker.nextNode())) {
            textNodes.push(node);
          }

          // Schritt 2: Prüfen, ob mindestens 1 strong in der Selektion
          const hasStrong = textNodes.some(n => jQuery(n).closest('strong').length > 0);

          if (hasStrong) {
            // Alle betroffenen strong entfernen
            const uniqueStrongs = new Set(textNodes.map(n => jQuery(n).closest('strong')[0]).filter(Boolean));
            uniqueStrongs.forEach(strong => {
              const frag = document.createDocumentFragment();
              while (strong.firstChild) frag.appendChild(strong.firstChild);
              strong.replaceWith(frag);
            });
          } else {
            // Alle textNodes wrappen
            const newWrappers = [];

            // Sicherstellen: keine live-Veränderung während der Iteration
            const nodesToWrap = [...textNodes];

            nodesToWrap.forEach(n => {
              const range = document.createRange();
              range.selectNodeContents(n);
              const wrapper = document.createElement('strong');
              wrapper.appendChild(range.extractContents());
              range.insertNode(wrapper);
              newWrappers.push(wrapper);
            });

            // Selektion wiederherstellen
            if (newWrappers.length > 0) {
              const range = document.createRange();
              range.setStartBefore(newWrappers[0]);
              range.setEndAfter(newWrappers[newWrappers.length - 1]);
              const selection = window.getSelection();
              selection.removeAllRanges();
              selection.addRange(range);
            }
          }


          // Changedetection anstoßen
          const html = $editor.summernote('code');
          $editor.summernote('triggerEvent', 'change', html, $editor);
          updateButtonState();
          context.invoke('afterCommand');
        },
      }).render();
      // Button aktiv state sync
      function updateButtonState() {
        //console.log("update button state");
        const rng = context.invoke('editor.createRange');
        const $button = context.layoutInfo.toolbar.find('.note-btn-strong');

        if (!rng || !rng.sc) {
          //console.log("no Range!");
          $button.removeClass('active');
          $button.removeAttr('aria-pressed');
          return;
        }

        let inStrong = false;

        try {
          const sel = window.getSelection();
          const range = (sel && sel.rangeCount > 0) ? sel.getRangeAt(0) : null;
          if (range && !range.collapsed) {
            const walker = document.createTreeWalker(
              range.commonAncestorContainer,
              NodeFilter.SHOW_TEXT,
              {
                acceptNode: function(node) {
                  return range.intersectsNode(node)
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_REJECT;
                },
              }
            );

            let node;
            while ((node = walker.nextNode())) {
              if (jQuery(node).closest('strong').length > 0) {
                inStrong = true;
                break;
              }
            }
          } else {
            inStrong = jQuery(range?.startContainer).closest('strong').length > 0;
          }
        } catch (e) {
          console.warn('Fehler bei updateButtonState:', e);
          inStrong = false;
        }
        $button.toggleClass('active', inStrong);
        if (inStrong) {
          $button.attr('aria-pressed', 'true');
        } else {
          $button.removeAttr('aria-pressed');
        }
      }

      context.layoutInfo.editable.on('keyup mouseup', function() {
        updateButtonState();
      });

      // After Enter: unwrap empty strong from the newly created paragraph
      context.layoutInfo.editable.on('keyup', function(e) {
        if (e.key !== 'Enter') return;
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const rng = sel.getRangeAt(0);
        const node = rng.startContainer;
        const para = jQuery(node).closest('p, li, td, th')[0];
        if (!para) return;
        const inline = para.firstChild;
        if (!inline || inline.nodeName !== 'STRONG') return;
        const hasRealContent = Array.from(inline.childNodes).some(n =>
          n.nodeType === 3 ? n.nodeValue.replace(/\u200B/g, '').trim() !== '' : n.nodeName !== 'BR'
        );
        if (!hasRealContent) {
          while (inline.firstChild) para.insertBefore(inline.firstChild, inline);
          para.removeChild(inline);
          updateButtonState();
        }
      });

      return $button;
    });
  },

  'his-em': function(context) {
    const ui = jQuery.summernote.ui;
    const options = context.options;
    const $editor = context.$note;
    const lang = options.langInfo;
		
    context.memo('button.hisEm', function() {
      const $button = ui.button({
        contents: options.icons.italic ? ui.icon(options.icons.italic) : '<em>K</em>',
        tooltip: lang.strongEm.em ? lang.strongEm.em : 'Kursiv (STRG+I)',
        container: options.container,
        className: 'note-btn-em',
        click: function() {
          //console.log('em button clicked');
          context.invoke('editor.focus');
          let selection = window.getSelection();
          if (!selection || selection.rangeCount === 0) return;

          const originalRange = selection.getRangeAt(0);

          if (originalRange.collapsed) {
            context.invoke('beforeCommand');

            const container = originalRange.startContainer;
            const parentem = jQuery(container).closest('em')[0];
            selection = window.getSelection();

            if (parentem) {
              const hasRealContent = Array.from(parentem.childNodes).some(n =>
                n.nodeType === 3 ? n.nodeValue.replace(/\u200B/g, '').trim() !== '' : n.nodeName !== 'BR'
              );

              if (!hasRealContent) {
                // Empty em: unwrap (move children out, then remove em)
                context.invoke('beforeCommand');
                const parent = parentem.parentNode;
                while (parentem.firstChild) parent.insertBefore(parentem.firstChild, parentem);
                parent.removeChild(parentem);
                context.invoke('afterCommand');
                const html = context.invoke('code');
                context.invoke('triggerEvent', 'change', html, context.layoutInfo.editable);
                updateButtonState();
                return;
              }

              // Non-empty em: insert ZWSP after so browser breaks out of italic formatting
              const zwsp = document.createTextNode('\u200B');
              parentem.after(zwsp);
              const range = document.createRange();
              range.setStart(zwsp, 1);
              range.collapse(true);
              selection.removeAllRanges();
              selection.addRange(range);
              updateButtonState();
              return;
            } else {
              // No em at cursor: insert empty em with ZWSP at cursor position
              const em = document.createElement('em');
              const zwsp = document.createTextNode('\u200B');
              em.appendChild(zwsp);
              originalRange.insertNode(em);
              const range = document.createRange();
              range.setStart(zwsp, 1);
              range.collapse(true);
              selection.removeAllRanges();
              selection.addRange(range);
            }
            context.invoke('afterCommand');
            const html = context.invoke('code');
            context.invoke('triggerEvent', 'change', html, context.layoutInfo.editable);
            updateButtonState();
            return;
          }

          context.invoke('beforeCommand');

          // Sonderfall: nur ein TextNode selektiert
          if (originalRange.startContainer === originalRange.endContainer &&
						originalRange.startContainer.nodeType === 3 &&
						originalRange.startOffset !== originalRange.endOffset
          ) {
            const parentem = jQuery(originalRange.startContainer).closest('em')[0];

            if (!parentem) {

              const selectedText = originalRange.extractContents();
              const em = document.createElement('em');
              em.appendChild(selectedText);
              originalRange.insertNode(em);

              // Selektion wiederherstellen innerhalb von <em>
              selection = window.getSelection();
              const newRange = document.createRange();
              const node = em.firstChild;
              newRange.setStart(node, 0);
              newRange.setEnd(node, node.length);
              selection.removeAllRanges();
              selection.addRange(newRange);
            } else {
              // unwrap
              const parent = parentem.parentNode;
              const children = Array.from(parentem.childNodes); // inhalt merken
              parentem.replaceWith(...children);

              // neuen TextNode im DOM suchen, der dem alten entspricht
              const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT);
              let firstMatch = null;
              while (walker.nextNode()) {
                const node = walker.currentNode;
                if (children.includes(node)) {
                  firstMatch = node;
                  break;
                }
              }

              if (firstMatch) {
                const newRange = document.createRange();
                newRange.setStart(firstMatch, 0);
                newRange.setEnd(firstMatch, firstMatch.length);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(newRange);
              }
            }

            context.invoke('afterCommand');
            const html = context.invoke('code');
            context.invoke('triggerEvent', 'change', html, context.layoutInfo.editable);
            updateButtonState();
            return;
          }

          // Mehr als ein Element selektiert
          // Schritt 1: textNodes sammeln (vor Manipulation!)
          const textNodes = [];
          const walker = document.createTreeWalker(
            originalRange.commonAncestorContainer,
            NodeFilter.SHOW_TEXT,
            {
              acceptNode: function(node) {
                return originalRange.intersectsNode(node) && node.textContent.trim().length > 0
                  ? NodeFilter.FILTER_ACCEPT
                  : NodeFilter.FILTER_REJECT;
              },
            }
          );
          let node;
          while ((node = walker.nextNode())) {
            textNodes.push(node);
          }

          // Schritt 2: Prüfen, ob mindestens 1 em in der Selektion
          const hasem = textNodes.some(n => jQuery(n).closest('em').length > 0);

          if (hasem) {
            // Alle betroffenen em entfernen
            const uniqueems = new Set(textNodes.map(n => jQuery(n).closest('em')[0]).filter(Boolean));
            uniqueems.forEach(em => {
              const frag = document.createDocumentFragment();
              while (em.firstChild) frag.appendChild(em.firstChild);
              em.replaceWith(frag);
            });
          } else {
            // Alle textNodes wrappen
            const newWrappers = [];

            // Sicherstellen: keine live-Veränderung während der Iteration
            const nodesToWrap = [...textNodes];

            nodesToWrap.forEach(n => {
              const range = document.createRange();
              range.selectNodeContents(n);
              const wrapper = document.createElement('em');
              wrapper.appendChild(range.extractContents());
              range.insertNode(wrapper);
              newWrappers.push(wrapper);
            });

            // Selektion wiederherstellen
            if (newWrappers.length > 0) {
              const range = document.createRange();
              range.setStartBefore(newWrappers[0]);
              range.setEndAfter(newWrappers[newWrappers.length - 1]);
              selection.removeAllRanges();
              selection.addRange(range);
            }
          }
          context.invoke('editor.saveRange');

          // Changedetection anstoßen
          const html = $editor.summernote('code');
          $editor.summernote('triggerEvent', 'change', html, $editor);
          updateButtonState();
          context.invoke('afterCommand');
        },
      }).render();

      // Button state
      function updateButtonState() {
        //console.log("update button state");
        const rng = context.invoke('editor.createRange');
        const $button = context.layoutInfo.toolbar.find('.note-btn-em');

        if (!rng || !rng.sc) {
          $button.removeClass('active');
          $button.removeAttr('aria-pressed');
          return;
        }

        let inEm = false;

        try {
          const sel = window.getSelection();
          const range = (sel && sel.rangeCount > 0) ? sel.getRangeAt(0) : null;
          if (range && !range.collapsed) {
            const walker = document.createTreeWalker(
              range.commonAncestorContainer,
              NodeFilter.SHOW_TEXT,
              {
                acceptNode: function(node) {
                  return range.intersectsNode(node)
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_REJECT;
                },
              }
            );

            let node;
            while ((node = walker.nextNode())) {
              if (jQuery(node).closest('em').length > 0) {
                inEm = true;
                break;
              }
            }
          } else {
            inEm = jQuery(range?.startContainer).closest('em').length > 0;
          }
        } catch (e) {
          console.warn('Fehler bei updateButtonState:', e);
          inEm = false;
        }
        $button.toggleClass('active', inEm);
        if (inEm) {
          $button.attr('aria-pressed', 'true');
        } else {
          $button.removeAttr('aria-pressed');
        }
      }

      context.layoutInfo.editable.on('keyup mouseup', function() {
        updateButtonState();
      });

      // After Enter: unwrap empty em from the newly created paragraph
      context.layoutInfo.editable.on('keyup', function(e) {
        if (e.key !== 'Enter') return;
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const rng = sel.getRangeAt(0);
        const node = rng.startContainer;
        const para = jQuery(node).closest('p, li, td, th')[0];
        if (!para) return;
        const inline = para.firstChild;
        if (!inline || inline.nodeName !== 'EM') return;
        const hasRealContent = Array.from(inline.childNodes).some(n =>
          n.nodeType === 3 ? n.nodeValue.replace(/\u200B/g, '').trim() !== '' : n.nodeName !== 'BR'
        );
        if (!hasRealContent) {
          while (inline.firstChild) para.insertBefore(inline.firstChild, inline);
          para.removeChild(inline);
          updateButtonState();
        }
      });

      return $button;
    });

  },
});
