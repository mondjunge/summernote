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
              // Immer entfernen, unabhängig vom Inhalt
              let offsetInText = 0;
              let anchorText = null;

              if (container.nodeType === 3) {
                anchorText = container;
                offsetInText = originalRange.startOffset;
              } else {
                // Cursor steht evtl. auf dem strong selbst
                anchorText = parentStrong.querySelector('text()') || parentStrong.firstChild;
                offsetInText = 0;
              }

              // Inhalt retten und strong ersetzen
              const frag = document.createDocumentFragment();
              while (parentStrong.firstChild) frag.appendChild(parentStrong.firstChild);
              const parent = parentStrong.parentNode;
              parentStrong.replaceWith(frag);

              // Neue TextNode suchen, an gleicher Stelle
              const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT);
              let foundText = null;
              while (walker.nextNode()) {
                if (walker.currentNode.nodeValue.includes(anchorText?.nodeValue?.trim())) {
                  foundText = walker.currentNode;
                  break;
                }
              }

              // Selektion wiederherstellen
              const range = document.createRange();
              if (foundText) {
                const safeOffset = Math.min(offsetInText, foundText.length);
                range.setStart(foundText, safeOffset);
                range.setEnd(foundText, safeOffset);
              } else {
                range.setStart(parent, 0);
                range.collapse(true);
              }

              selection.removeAllRanges();
              selection.addRange(range);

              context.invoke('afterCommand');
              const html = context.invoke('code');
              context.invoke('triggerEvent', 'change', html, context.layoutInfo.editable);
              updateButtonState();
              return;
            } else {
              // Kein strong vorhanden
              let node = container;
              let offset = originalRange.startOffset;

              if (node.nodeType !== 3) {
                node = node.childNodes[offset] || node.firstChild;
                offset = 0;
              }

              if (node && node.nodeType === 3) {
                const text = node.textContent;

                // Wortgrenzen bestimmen
                const left = text.slice(0, offset);
                const right = text.slice(offset);
                const leftBoundary = left.lastIndexOf(' ') + 1;
                const rightBoundary = offset + right.search(/\\s|$|\\n/);

                const word = text.slice(leftBoundary, rightBoundary);
                const before = text.slice(0, leftBoundary);
                const after = text.slice(rightBoundary);

                const parent = node.parentNode;

                // Neue Textknoten erzeugen
                const tnBefore = before ? document.createTextNode(before) : null;
                const tnAfter = after ? document.createTextNode(after) : null;
                const tnWord = document.createTextNode(word);

                // <strong> um das Wort
                const strong = document.createElement('strong');
                strong.appendChild(tnWord);

                // alten Textknoten ersetzen
                parent.replaceChild(strong, node);
                if (tnBefore) parent.insertBefore(tnBefore, strong);
                if (tnAfter) parent.insertBefore(tnAfter, strong.nextSibling);

                // Cursor im Wort setzen, genau da wo er war (relativ zu word-start)
                const newOffset = offset - leftBoundary;
                const range = document.createRange();
                range.setStart(tnWord, newOffset);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
              } else {
                // Fallback: leeres strong mit ZWSP
                const strong = document.createElement('strong');
                const zwsp = document.createTextNode('\u200B');
                strong.appendChild(zwsp);
                originalRange.insertNode(strong);
                const range = document.createRange();
                range.setStart(zwsp, 1);
                range.setEnd(zwsp, 1);
                selection.removeAllRanges();
                selection.addRange(range);
              }

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
              // Immer entfernen, unabhängig vom Inhalt
              let offsetInText = 0;
              let anchorText = null;

              if (container.nodeType === 3) {
                anchorText = container;
                offsetInText = originalRange.startOffset;
              } else {
                // Cursor steht evtl. auf dem em selbst
                anchorText = parentem.querySelector('text()') || parentem.firstChild;
                offsetInText = 0;
              }

              // Inhalt retten und em ersetzen
              const frag = document.createDocumentFragment();
              while (parentem.firstChild) frag.appendChild(parentem.firstChild);
              const parent = parentem.parentNode;
              parentem.replaceWith(frag);

              // Neue TextNode suchen, an gleicher Stelle
              const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT);
              let foundText = null;
              while (walker.nextNode()) {
                if (walker.currentNode.nodeValue.includes(anchorText?.nodeValue?.trim())) {
                  foundText = walker.currentNode;
                  break;
                }
              }

              // Selektion wiederherstellen
              const range = document.createRange();
              if (foundText) {
                const safeOffset = Math.min(offsetInText, foundText.length);
                range.setStart(foundText, safeOffset);
                range.setEnd(foundText, safeOffset);
              } else {
                range.setStart(parent, 0);
                range.collapse(true);
              }

              selection.removeAllRanges();
              selection.addRange(range);

              context.invoke('afterCommand');
              const html = context.invoke('code');
              context.invoke('triggerEvent', 'change', html, context.layoutInfo.editable);
              updateButtonState();
              return;
            } else {
              // Kein em vorhanden
              let node = container;
              let offset = originalRange.startOffset;

              if (node.nodeType !== 3) {
                node = node.childNodes[offset] || node.firstChild;
                offset = 0;
              }

              if (node && node.nodeType === 3) {
                const text = node.textContent;

                // Wortgrenzen bestimmen
                const left = text.slice(0, offset);
                const right = text.slice(offset);
                const leftBoundary = left.lastIndexOf(' ') + 1;
                const rightBoundary = offset + right.search(/\\s|$|\\n/);

                const word = text.slice(leftBoundary, rightBoundary);
                const before = text.slice(0, leftBoundary);
                const after = text.slice(rightBoundary);

                const parent = node.parentNode;

                // Neue Textknoten erzeugen
                const tnBefore = before ? document.createTextNode(before) : null;
                const tnAfter = after ? document.createTextNode(after) : null;
                const tnWord = document.createTextNode(word);

                // <em> um das Wort
                const em = document.createElement('em');
                em.appendChild(tnWord);

                // alten Textknoten ersetzen
                parent.replaceChild(em, node);
                if (tnBefore) parent.insertBefore(tnBefore, em);
                if (tnAfter) parent.insertBefore(tnAfter, em.nextSibling);

                // Cursor im Wort setzen, genau da wo er war (relativ zu word-start)
                const newOffset = offset - leftBoundary;
                const range = document.createRange();
                range.setStart(tnWord, newOffset);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
              } else {
                // Fallback: leeres em mit ZWSP
                const em = document.createElement('em');
                const zwsp = document.createTextNode('\u200B');
                em.appendChild(zwsp);
                originalRange.insertNode(em);
                const range = document.createRange();
                range.setStart(zwsp, 1);
                range.setEnd(zwsp, 1);
                selection.removeAllRanges();
                selection.addRange(range);
              }

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

      return $button;
    });

  },
});
