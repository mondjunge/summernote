(function(factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(['jquery'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node/CommonJS
    module.exports = factory(require('jquery'));
  } else {
    // Browser globals
    factory(window.jQuery);
  }
}(function($) {
  $.extend($.summernote.plugins, {
    'specialchars': function(context) {
      var self = this;
      var ui = $.summernote.ui;

      var $editor = context.layoutInfo.editor;
      var options = context.options;
      var lang = options.langInfo;

      var KEY = {
        UP: 38,
        DOWN: 40,
        LEFT: 37,
        RIGHT: 39,
        ENTER: 13,
      };
      var COLUMN_LENGTH = 12;
      var COLUMN_WIDTH = 35;

      var currentColumn = 0;
      var currentRow = 0;
      var totalColumn = 0;
      var totalRow = 0;

      // special characters data set
      var specialCharDataSet = [
        // --- Greek uppercase ---
        '&Alpha;', '&Beta;', '&Gamma;', '&Delta;', '&Epsilon;', '&Zeta;',
        '&Eta;', '&Theta;', '&Iota;', '&Kappa;', '&Lambda;', '&Mu;',
        '&Nu;', '&Xi;', '&Omicron;', '&Pi;', '&Rho;', '&Sigma;',
        '&Tau;', '&Upsilon;', '&Phi;', '&Chi;', '&Psi;', '&Omega;',
        // --- Greek lowercase ---
        '&alpha;', '&beta;', '&gamma;', '&delta;', '&epsilon;', '&zeta;',
        '&eta;', '&theta;', '&iota;', '&kappa;', '&lambda;', '&mu;',
        '&nu;', '&xi;', '&omicron;', '&pi;', '&rho;', '&sigma;',
        '&tau;', '&upsilon;', '&phi;', '&chi;', '&psi;', '&omega;',
        // Greek variants
        '&thetasym;', '&upsih;', '&piv;', '&#x03C2;', '&#x03F5;', '&#x03D5;', '&#x03F1;',
        // --- Mathematical operators ---
        '&plus;', '&minus;', '&plusmn;', '&#x2213;', '&times;', '&divide;', '&sdot;', '&lowast;',
        '&sum;', '&prod;', '&#x2210;', '&int;', '&#x222C;', '&#x222D;', '&#x222E;', '&#x222F;',
        '&radic;', '&#x221B;', '&#x221C;', '&infin;', '&part;', '&nabla;', '&fnof;',
        '&prop;', '&ang;', '&#x221F;', '&#x2220;', '&#x2221;', '&#x2222;',
        '&deg;', '&permil;', '&#x2031;', '&prime;', '&Prime;', '&#x2034;',
        // --- Relations ---
        '&ne;', '&equiv;', '&#x2262;', '&sim;', '&asymp;', '&#x2243;', '&cong;', '&#x2247;',
        '&le;', '&ge;', '&#x226A;', '&#x226B;', '&#x2264;', '&#x2265;',
        '&#x2272;', '&#x2273;', '&#x2266;', '&#x2267;', '&#x2268;', '&#x2269;',
        '&there4;', '&#x2235;', '&because;',
        // --- Set theory & logic ---
        '&forall;', '&exist;', '&#x2204;', '&empty;',
        '&isin;', '&notin;', '&ni;', '&#x220C;',
        '&cap;', '&cup;', '&#x2216;', '&#x22C2;', '&#x22C3;',
        '&sub;', '&sup;', '&nsub;', '&sube;', '&supe;',
        '&#x2284;', '&#x2285;', '&#x228A;', '&#x228B;',
        '&and;', '&or;', '&#x22BB;', '&#x00AC;',
        '&#x22A2;', '&#x22A3;', '&#x22A4;', '&perp;',
        // --- Number sets & special math letters ---
        '&#x2115;', '&#x2124;', '&#x211A;', '&#x211D;', '&#x2102;',
        '&alefsym;', '&#x2136;', '&#x2137;', '&#x2138;',
        '&weierp;', '&image;', '&real;',
        '&#x210E;', '&#x210F;', '&#x2113;',
        '&oplus;', '&otimes;', '&#x2299;', '&#x229A;', '&#x229B;', '&#x2295;', '&#x2296;',
        '&lceil;', '&rceil;', '&lfloor;', '&rfloor;',
        '&#x27E8;', '&#x27E9;', '&#x2308;', '&#x2309;',
        // --- Arrows ---
        '&larr;', '&rarr;', '&uarr;', '&darr;', '&harr;', '&crarr;',
        '&lArr;', '&rArr;', '&uArr;', '&dArr;', '&hArr;',
        '&#x2196;', '&#x2197;', '&#x2198;', '&#x2199;',
        '&#x21A6;', '&#x21A9;', '&#x21AA;',
        '&#x21C4;', '&#x21C6;', '&#x21CC;', '&#x21CB;',
        '&#x27F5;', '&#x27F6;', '&#x27F7;', '&#x27F8;', '&#x27F9;', '&#x27FA;',
        '&#x21D4;', '&#x27F9;',
        // --- Fractions ---
        '&frac14;', '&frac12;', '&frac34;',
        '&#x2153;', '&#x2154;',
        '&#x2155;', '&#x2156;', '&#x2157;', '&#x2158;',
        '&#x2159;', '&#x215A;',
        '&#x215B;', '&#x215C;', '&#x215D;', '&#x215E;',
        '&#x2189;',
        // --- Superscript digits ---
        '&sup1;', '&sup2;', '&sup3;',
        '&#x2070;', '&#x2074;', '&#x2075;', '&#x2076;', '&#x2077;', '&#x2078;', '&#x2079;',
        '&#x207A;', '&#x207B;', '&#x207C;', '&#x207D;', '&#x207E;', '&#x207F;',
        // --- Subscript digits ---
        '&#x2080;', '&#x2081;', '&#x2082;', '&#x2083;', '&#x2084;',
        '&#x2085;', '&#x2086;', '&#x2087;', '&#x2088;', '&#x2089;',
        '&#x208A;', '&#x208B;', '&#x208C;',
        // --- Scientific / technical units ---
        '&#x2126;', '&#x212B;', '&#x2103;', '&#x2109;',
        '&#x212A;', '&#x2127;', '&#x33A1;', '&#x33A5;',
        // --- Currency ---
        '&cent;', '&pound;', '&euro;', '&yen;', '&curren;',
        '&#x20BF;', '&#x20BD;', '&#x20A9;', '&#x20AA;',
        '&#x20B9;', '&#x20BA;', '&#x20B1;', '&#x20A3;', '&#x20A6;',
        // --- Typography & punctuation ---
        '&copy;', '&reg;', '&trade;', '&sect;', '&para;',
        '&deg;', '&micro;', '&middot;', '&bull;', '&hellip;', '&#x2025;',
        '&ndash;', '&mdash;', '&#x2015;',
        '&lsquo;', '&rsquo;', '&sbquo;', '&ldquo;', '&rdquo;', '&bdquo;',
        '&laquo;', '&raquo;', '&lsaquo;', '&rsaquo;',
        '&dagger;', '&Dagger;', '&#x2116;', '&#x203B;', '&#x2042;',
        '&oline;', '&frasl;', '&prime;', '&Prime;',
        '&quot;', '&amp;', '&lt;', '&gt;', '&iexcl;', '&iquest;',
        '&ordf;', '&ordm;', '&macr;', '&acute;', '&cedil;', '&uml;',
        '&circ;', '&tilde;', '&brvbar;', '&not;',
        // --- Check marks & crosses ---
        '&#x2713;', '&#x2714;', '&#x2717;', '&#x2718;', '&#x2715;', '&#x2716;',
        '&#x2610;', '&#x2611;', '&#x2612;',
        // --- Geometric shapes ---
        '&#x25A0;', '&#x25A1;', '&#x25AA;', '&#x25AB;',
        '&#x25B2;', '&#x25B3;', '&#x25BC;', '&#x25BD;',
        '&#x25C6;', '&#x25C7;', '&#x25CF;', '&#x25CB;',
        '&#x2605;', '&#x2606;', '&#x2736;',
        '&loz;',
        // --- Musical (decorative) ---
        '&#x2669;', '&#x266A;', '&#x266B;', '&#x266C;',
        '&#x266D;', '&#x266E;', '&#x266F;',
        // --- Card suits & misc decorative ---
        '&spades;', '&clubs;', '&hearts;', '&diams;',
        '&#x2620;', '&#x2622;', '&#x2623;', '&#x262E;', '&#x262F;',
        '&#x2639;', '&#x263A;', '&#x263B;',
      ];

      context.memo('button.specialchars', function() {
        return ui.button({
          contents: options.icons.specialchars
            ? ui.icon(options.icons.specialchars)
            : 'Ω',
          tooltip: lang.specialChar.specialChar,
          container: options.container,
          click: function() {
            self.show();
          },
        }).render();
      });

      /**
       * Make Special Characters Table
       *
       * @member plugin.specialChar
       * @private
       * @return {jQuery}
       */
      this.makeSpecialCharSetTable = function() {
        var $table = $('<table></table>');
        $.each(specialCharDataSet, function(idx, text) {
          var $td = $('<td></td>').addClass('note-specialchar-node');
          var $tr = (idx % COLUMN_LENGTH === 0) ? $('<tr></tr>') : $table.find('tr').last();

          var $button = ui.button({
            callback: function($node) {
              $node.html(text);
              $node.attr('title', text);
              $node.attr('data-value', encodeURIComponent(text));
              $node.css({
                width: COLUMN_WIDTH,
                'margin-right': '2px',
                'margin-bottom': '2px',
              });
            },
          }).render();

          $td.append($button);

          $tr.append($td);
          if (idx % COLUMN_LENGTH === 0) {
            $table.append($tr);
          }
        });

        totalRow = $table.find('tr').length;
        totalColumn = COLUMN_LENGTH;

        return $table;
      };

      this.initialize = function() {
        var $container = options.dialogsInBody ? $(document.body) : $editor;

        var body = '<div class="form-group row-fluid">' + this.makeSpecialCharSetTable()[0].outerHTML + '</div>';

        this.$dialog = ui.dialog({
          title: lang.specialChar.select,
          body: body,
          lang: lang,
        }).render().appendTo($container);
      };

      this.show = function() {
        var text = context.invoke('editor.getSelectedText');
        context.invoke('editor.saveRange');
        this.showSpecialCharDialog(text).then(function(selectChar) {
          context.invoke('editor.restoreRange');

          // build node
          var $node = $('<span></span>').html(selectChar)[0];

          if ($node) {
            // insert video node
            context.invoke('editor.insertNode', $node);
          }
        }).fail(function() {
          context.invoke('editor.restoreRange');
        });
      };

      /**
       * show image dialog
       *
       * @param {jQuery} $dialog
       * @return {Promise}
       */
      this.showSpecialCharDialog = function(text) {
        return $.Deferred(function(deferred) {
          var $specialCharDialog = self.$dialog;
          var $specialCharNode = $specialCharDialog.find('.note-specialchar-node');
          var $selectedNode = null;
          var ARROW_KEYS = [KEY.UP, KEY.DOWN, KEY.LEFT, KEY.RIGHT];
          var ENTER_KEY = KEY.ENTER;

          function addActiveClass($target) {
            if (!$target) {
              return;
            }
            $target.find('button').addClass('active');
            $selectedNode = $target;
          }

          function removeActiveClass($target) {
            $target.find('button').removeClass('active');
            $selectedNode = null;
          }

          // find next node
          function findNextNode(row, column) {
            var findNode = null;
            $.each($specialCharNode, function(idx, $node) {
              var findRow = Math.ceil((idx + 1) / COLUMN_LENGTH);
              var findColumn = ((idx + 1) % COLUMN_LENGTH === 0) ? COLUMN_LENGTH : (idx + 1) % COLUMN_LENGTH;
              if (findRow === row && findColumn === column) {
                findNode = $node;
                return false;
              }
            });
            return $(findNode);
          }

          function arrowKeyHandler(keyCode) {
            // left, right, up, down key
            var $nextNode;
            var lastRowColumnLength = $specialCharNode.length % totalColumn;

            if (KEY.LEFT === keyCode) {
              if (currentColumn > 1) {
                currentColumn = currentColumn - 1;
              } else if (currentRow === 1 && currentColumn === 1) {
                currentColumn = lastRowColumnLength;
                currentRow = totalRow;
              } else {
                currentColumn = totalColumn;
                currentRow = currentRow - 1;
              }
            } else if (KEY.RIGHT === keyCode) {
              if (currentRow === totalRow && lastRowColumnLength === currentColumn) {
                currentColumn = 1;
                currentRow = 1;
              } else if (currentColumn < totalColumn) {
                currentColumn = currentColumn + 1;
              } else {
                currentColumn = 1;
                currentRow = currentRow + 1;
              }
            } else if (KEY.UP === keyCode) {
              if (currentRow === 1 && lastRowColumnLength < currentColumn) {
                currentRow = totalRow - 1;
              } else {
                currentRow = currentRow - 1;
              }
            } else if (KEY.DOWN === keyCode) {
              currentRow = currentRow + 1;
            }

            if (currentRow === totalRow && currentColumn > lastRowColumnLength) {
              currentRow = 1;
            } else if (currentRow > totalRow) {
              currentRow = 1;
            } else if (currentRow < 1) {
              currentRow = totalRow;
            }

            $nextNode = findNextNode(currentRow, currentColumn);

            if ($nextNode) {
              removeActiveClass($selectedNode);
              addActiveClass($nextNode);
            }
          }

          function enterKeyHandler() {
            if (!$selectedNode) {
              return;
            }

            deferred.resolve(decodeURIComponent($selectedNode.find('button').attr('data-value')));
            $specialCharDialog.modal('hide');
          }

          function keyDownEventHandler(event) {
            event.preventDefault();
            var keyCode = event.keyCode;
            if (keyCode === undefined || keyCode === null) {
              return;
            }
            // check arrowKeys match
            if (ARROW_KEYS.indexOf(keyCode) > -1) {
              if ($selectedNode === null) {
                addActiveClass($specialCharNode.eq(0));
                currentColumn = 1;
                currentRow = 1;
                return;
              }
              arrowKeyHandler(keyCode);
            } else if (keyCode === ENTER_KEY) {
              enterKeyHandler();
            }
            return false;
          }

          // remove class
          removeActiveClass($specialCharNode);

          // find selected node
          if (text) {
            for (var i = 0; i < $specialCharNode.length; i++) {
              var $checkNode = $($specialCharNode[i]);
              if ($checkNode.text() === text) {
                addActiveClass($checkNode);
                currentRow = Math.ceil((i + 1) / COLUMN_LENGTH);
                currentColumn = (i + 1) % COLUMN_LENGTH;
              }
            }
          }

          ui.onDialogShown(self.$dialog, function() {
            $(document).on('keydown', keyDownEventHandler);

            if (typeof $.fn.tooltip === 'function') { self.$dialog.find('button').tooltip(); }

            $specialCharNode.on('click', function(event) {
              event.preventDefault();
              deferred.resolve(decodeURIComponent($(event.currentTarget).find('button').attr('data-value')));
              ui.hideDialog(self.$dialog);
            });
          });

          ui.onDialogHidden(self.$dialog, function() {
            $specialCharNode.off('click');

            if (typeof $.fn.tooltip === 'function') { self.$dialog.find('button').tooltip(); }

            $(document).off('keydown', keyDownEventHandler);

            if (deferred.state() === 'pending') {
              deferred.reject();
            }
          });

          ui.showDialog(self.$dialog);
        });
      };
    },
  });
}));
