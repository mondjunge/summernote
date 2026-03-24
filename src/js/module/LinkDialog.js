import $ from 'jquery';
// import env from '../core/env'; // auto-focus disabled
import key from '../core/key';
import func from '../core/func';

const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const TEL_DIGITS_PATTERN = /^\d{6,15}$/;
const PROTOCOLS = ['https://', 'http://', '//'];

export default class LinkDialog {
  constructor(context) {
    this.context = context;

    this.ui = $.summernote.ui;
    this.$body = $(document.body);
    this.$editor = context.layoutInfo.editor;
    this.options = context.options;
    this.lang = this.options.langInfo;

    context.memo('help.linkDialog.show', this.options.langInfo.help['linkDialog.show']);
  }

  initialize() {
    const $container = this.options.dialogsInBody ? this.$body : this.options.container;
    const lang = this.lang.link;
    const t = (k, fallback) => lang[k] || fallback;
    const id = this.options.id;

    const newWindowHtml = !this.options.disableLinkTarget
      ? $('<div class="note-link-newwindow"></div>').append(
        this.ui.checkbox({
          className: 'sn-checkbox-open-in-new-window',
          text: lang.openInNewWindow,
          checked: true,
        }).render()
      ).prop('outerHTML')
      : '';

    const body = [
      // Text to display (always visible)
      '<div class="form-group note-form-group">',
        `<label for="note-dialog-link-txt-${id}" class="note-form-label">${lang.textToDisplay}</label>`,
        `<input id="note-dialog-link-txt-${id}" class="note-link-text form-control note-form-control note-input" type="text" autocomplete="off" data-form-type="other"/>`,
      '</div>',

      // Link type selector
      '<div class="form-group note-form-group">',
        `<label class="note-form-label">${t('type', 'Link type')}</label><br/>`,
        '<div class="note-link-type-group btn-group" role="group">',
          `<button type="button" class="note-link-type-tab btn btn-default active" data-type="url">${t('typeUrl', 'URL')}</button>`,
          `<button type="button" class="note-link-type-tab btn btn-default" data-type="email">${t('typeEmail', 'E-Mail')}</button>`,
          `<button type="button" class="note-link-type-tab btn btn-default" data-type="tel">${t('typeTel', 'Phone')}</button>`,
        '</div>',
      '</div>',

      // URL panel
      '<div class="note-link-panel" data-panel="url">',
        '<div class="note-form-group note-link-url-row" style="display:flex;gap:6px;align-items:flex-end;">',
          '<div style="flex:0 0 auto;min-width:100px;">',
            `<label for="note-dialog-link-proto-${id}" class="note-form-label">${t('protocol', 'Protocol')}</label>`,
            `<select id="note-dialog-link-proto-${id}" class="note-link-protocol form-control note-form-control note-input">`,
              '<option value="https://">https://</option>',
              '<option value="http://">http://</option>',
              '<option value="//">//</option>',
              `<option value="#">#</option>`,
              `<option value="">${t('protocolNone', '(none)')}</option>`,
            '</select>',
          '</div>',
          '<div style="flex:1 1 auto;">',
            `<label for="note-dialog-link-url-${id}" class="note-form-label">URL</label>`,
            `<input id="note-dialog-link-url-${id}" class="note-link-url form-control note-form-control note-input" type="text" autocomplete="off" data-form-type="other" placeholder="www.example.com"/>`,
          '</div>',
        '</div>',
        newWindowHtml,
      '</div>',

      // Email panel
      '<div class="note-link-panel" data-panel="email" style="display:none">',
        '<div class="form-group note-form-group">',
          `<label for="note-dialog-link-email-${id}" class="note-form-label">${t('emailAddress', 'Email address')}</label>`,
          `<input id="note-dialog-link-email-${id}" class="note-link-email-address form-control note-form-control note-input" type="text" autocomplete="off" data-form-type="other" placeholder="address@example.com"/>`,
        '</div>',
        '<div class="form-group note-form-group">',
          `<label for="note-dialog-link-email-subj-${id}" class="note-form-label">${t('emailSubject', 'Subject')}</label>`,
          `<input id="note-dialog-link-email-subj-${id}" class="note-link-email-subject form-control note-form-control note-input" type="text" autocomplete="off" data-form-type="other"/>`,
        '</div>',
        '<div class="form-group note-form-group">',
          `<label for="note-dialog-link-email-body-${id}" class="note-form-label">${t('emailBody', 'Message')}</label>`,
          `<textarea id="note-dialog-link-email-body-${id}" class="note-link-email-body form-control note-form-control note-input" rows="3" autocomplete="off" data-form-type="other"></textarea>`,
        '</div>',
      '</div>',

      // Phone panel
      '<div class="note-link-panel" data-panel="tel" style="display:none">',
        '<div class="form-group note-form-group">',
          `<label for="note-dialog-link-tel-${id}" class="note-form-label">${t('telNumber', 'Phone number')}</label>`,
          `<input id="note-dialog-link-tel-${id}" class="note-link-tel-number form-control note-form-control note-input" type="text" autocomplete="off" data-form-type="other" placeholder="+49 123 456 7890"/>`,
          `<small class="note-link-tel-error" style="display:none;color:#c0392b">${t('telInvalid', 'Please enter a valid phone number (6–15 digits)')}</small>`,
        '</div>',
      '</div>',
    ].join('');

    const buttonClass = 'btn btn-primary note-btn note-btn-primary note-link-btn';
    const footer = `<input type="button" href="#" class="${buttonClass}" value="${lang.insert}" disabled>`;

    this.$dialog = this.ui.dialog({
      className: 'link-dialog',
      title: lang.insert,
      fade: this.options.dialogsFade,
      body: body,
      footer: footer,
      lang: this.lang,
    }).render().appendTo($container);
  }

  destroy() {
    this.ui.hideDialog(this.$dialog);
    this.$dialog.remove();
  }

  bindEnterKey($input, $btn) {
    $input.on('keypress', (event) => {
      if (event.keyCode === key.code.ENTER) {
        event.preventDefault();
        $btn.trigger('click');
      }
    });
  }

  /**
   * Parse an existing href into typed parts.
   */
  parseLinkUrl(url) {
    if (!url) return { type: 'url', protocol: 'https://', urlPart: '' };

    if (url.startsWith('mailto:')) {
      const raw = url.slice('mailto:'.length);
      const qIdx = raw.indexOf('?');
      const addr = qIdx >= 0 ? raw.slice(0, qIdx) : raw;
      const params = new URLSearchParams(qIdx >= 0 ? raw.slice(qIdx + 1) : '');
      return {
        type: 'email',
        emailAddress: decodeURIComponent(addr),
        emailSubject: params.get('subject') || '',
        emailBody: params.get('body') || '',
      };
    }

    if (url.startsWith('tel:')) {
      return { type: 'tel', telNumber: url.slice('tel:'.length) };
    }

    for (const proto of PROTOCOLS) {
      if (url.startsWith(proto)) {
        return { type: 'url', protocol: proto, urlPart: url.slice(proto.length) };
      }
    }
    if (url.startsWith('#')) {
      return { type: 'url', protocol: '#', urlPart: url.slice(1) };
    }
    return { type: 'url', protocol: 'https://', urlPart: url };
  }

  /**
   * Build href from current panel state.
   */
  buildHref(activeType, $linkUrl, $linkProtocol, $emailAddr, $emailSubject, $emailBody, $telNumber) {
    if (activeType === 'email') {
      const addr = $emailAddr.val().trim();
      const subj = $emailSubject.val().trim();
      const body = $emailBody.val().trim();
      const parts = [];
      if (subj) parts.push('subject=' + encodeURIComponent(subj));
      if (body) parts.push('body=' + encodeURIComponent(body));
      return 'mailto:' + addr + (parts.length ? '?' + parts.join('&') : '');
    }

    if (activeType === 'tel') {
      const num = $telNumber.val().trim().replace(/[\s\-().]/g, '');
      return 'tel:' + num;
    }

    // URL
    const protocol = $linkProtocol.val();
    const urlPart = $linkUrl.val().trim();
    if (protocol === '#') return '#' + urlPart;
    return protocol + urlPart;
  }

  /**
   * Validate current state and en-/disable insert button.
   */
  updateLinkBtn($linkBtn, activeType, $linkUrl, $emailAddr, $telNumber, $telError) {
    let valid = false;
    if (activeType === 'url') {
      valid = !!$linkUrl.val().trim();
    } else if (activeType === 'email') {
      valid = EMAIL_PATTERN.test($emailAddr.val().trim());
    } else if (activeType === 'tel') {
      const stripped = $telNumber.val().trim().replace(/[\s\-().+]/g, '');
      valid = TEL_DIGITS_PATTERN.test(stripped);
      $telError.toggle(!valid && $telNumber.val().trim().length > 0);
    }
    this.ui.toggleBtn($linkBtn, valid);
  }

  /**
   * Show link dialog and set event handlers on dialog controls.
   *
   * @param {Object} linkInfo
   * @return {Promise}
   */
  showLinkDialog(linkInfo) {
    return $.Deferred((deferred) => {
      const $linkText = this.$dialog.find('.note-link-text');
      const $linkUrl = this.$dialog.find('.note-link-url');
      const $linkProtocol = this.$dialog.find('.note-link-protocol');
      const $emailAddr = this.$dialog.find('.note-link-email-address');
      const $emailSubject = this.$dialog.find('.note-link-email-subject');
      const $emailBody = this.$dialog.find('.note-link-email-body');
      const $telNumber = this.$dialog.find('.note-link-tel-number');
      const $telError = this.$dialog.find('.note-link-tel-error');
      const $linkBtn = this.$dialog.find('.note-link-btn');
      const $openInNewWindow = this.$dialog.find('.sn-checkbox-open-in-new-window input[type=checkbox]');
      const $typeTabs = this.$dialog.find('.note-link-type-tab');
      const $panels = this.$dialog.find('.note-link-panel');

      let activeType = 'url';

      const switchType = (type) => {
        activeType = type;
        $typeTabs.removeClass('active');
        $typeTabs.filter(`[data-type="${type}"]`).addClass('active');
        $panels.hide();
        $panels.filter(`[data-panel="${type}"]`).show();
        this.updateLinkBtn($linkBtn, activeType, $linkUrl, $emailAddr, $telNumber, $telError);
      };

      this.ui.onDialogShown(this.$dialog, () => {
        this.context.triggerEvent('dialog.shown');

        // Reset all fields
        $linkText.val('');
        $linkUrl.val('');
        $linkProtocol.val('https://');
        $emailAddr.val('');
        $emailSubject.val('');
        $emailBody.val('');
        $telNumber.val('');
        $telError.hide();

        // If no url given but text looks like a URL, copy it over
        if (!linkInfo.url && func.isValidUrl(linkInfo.text)) {
          linkInfo.url = linkInfo.text;
        }

        const parsed = this.parseLinkUrl(linkInfo.url || '');

        $linkText.val(linkInfo.text || '');

        if (parsed.type === 'email') {
          $emailAddr.val(parsed.emailAddress);
          $emailSubject.val(parsed.emailSubject);
          $emailBody.val(parsed.emailBody);
        } else if (parsed.type === 'tel') {
          $telNumber.val(parsed.telNumber);
        } else {
          $linkProtocol.val(parsed.protocol);
          $linkUrl.val(parsed.urlPart);
        }

        // Switch to detected type (also sets up initial button state)
        switchType(parsed.type);

        // Type tab switching
        $typeTabs.on('click', (e) => {
          switchType($(e.currentTarget).data('type'));
        });

        // Text field
        $linkText.on('input paste propertychange', () => {
          linkInfo.text = $linkText.val();
        });

        // URL fields
        $linkUrl.on('input paste propertychange', () => {
          if (!linkInfo.text) $linkText.val($linkUrl.val());
          this.updateLinkBtn($linkBtn, activeType, $linkUrl, $emailAddr, $telNumber, $telError);
        });
        $linkProtocol.on('change', () => {
          this.updateLinkBtn($linkBtn, activeType, $linkUrl, $emailAddr, $telNumber, $telError);
        });

        // Email fields
        $emailAddr.on('input paste propertychange', () => {
          if (!linkInfo.text) $linkText.val($emailAddr.val());
          this.updateLinkBtn($linkBtn, activeType, $linkUrl, $emailAddr, $telNumber, $telError);
        });
        $emailSubject.on('input paste propertychange', () => {
          this.updateLinkBtn($linkBtn, activeType, $linkUrl, $emailAddr, $telNumber, $telError);
        });
        $emailBody.on('input paste propertychange', () => {
          this.updateLinkBtn($linkBtn, activeType, $linkUrl, $emailAddr, $telNumber, $telError);
        });

        // Tel field
        $telNumber.on('input paste propertychange', () => {
          if (!linkInfo.text) $linkText.val($telNumber.val());
          this.updateLinkBtn($linkBtn, activeType, $linkUrl, $emailAddr, $telNumber, $telError);
        });

        // Enter key bindings
        this.bindEnterKey($linkUrl, $linkBtn);
        this.bindEnterKey($linkText, $linkBtn);
        this.bindEnterKey($emailAddr, $linkBtn);
        this.bindEnterKey($emailSubject, $linkBtn);
        this.bindEnterKey($telNumber, $linkBtn);

        const isNewWindowChecked = linkInfo.isNewWindow !== undefined
          ? linkInfo.isNewWindow : this.context.options.linkTargetBlank;
        $openInNewWindow.prop('checked', isNewWindowChecked);

        $linkBtn.one('click', (event) => {
          event.preventDefault();

          const url = this.buildHref(
            activeType, $linkUrl, $linkProtocol,
            $emailAddr, $emailSubject, $emailBody, $telNumber
          );

          let text = $linkText.val();
          if (!text) {
            if (activeType === 'email') text = $emailAddr.val().trim();
            else if (activeType === 'tel') text = $telNumber.val().trim();
            else text = url;
          }

          deferred.resolve({
            range: linkInfo.range,
            url: url,
            text: text,
            isNewWindow: activeType === 'url' ? $openInNewWindow.is(':checked') : false,
          });
          this.ui.hideDialog(this.$dialog);
        });
      });

      this.ui.onDialogHidden(this.$dialog, () => {
        $linkText.off();
        $linkUrl.off();
        $linkProtocol.off();
        $emailAddr.off();
        $emailSubject.off();
        $emailBody.off();
        $telNumber.off();
        $linkBtn.off();
        $typeTabs.off();

        if (deferred.state() === 'pending') {
          deferred.reject();
        }
      });

      this.ui.showDialog(this.$dialog);
    }).promise();
  }

  /**
   * @param {Object} layoutInfo
   */
  show() {
    const linkInfo = this.context.invoke('editor.getLinkInfo');

    this.context.invoke('editor.saveRange');
    this.showLinkDialog(linkInfo).then((linkInfo) => {
      this.context.invoke('editor.restoreRange');
      this.context.invoke('editor.createLink', linkInfo);
    }).fail(() => {
      this.context.invoke('editor.restoreRange');
    });
  }
}
