export default class Clipboard {
  constructor(context) {
    this.context = context;
    this.options = context.options;
    this.$editable = context.layoutInfo.editable;
  }

  initialize() {
    this.$editable.on('paste', this.pasteByEvent.bind(this));
  }

  /**
   * paste by clipboard event
   *
   * @param {Event} event
   */
  pasteByEvent(event) {

    if (this.context.isDisabled()) {
      return;
    }
    const clipboardData = event.originalEvent.clipboardData;

    if (clipboardData && clipboardData.items && clipboardData.items.length) {
      const clipboardFiles = clipboardData.files;
      const clipboardText = clipboardData.getData('Text');

      // paste img file
      if (clipboardFiles.length > 0 && this.options.allowClipboardImagePasting) {
        this.context.invoke('editor.insertImagesOrCallback', clipboardFiles);
        event.preventDefault();
      } else if (clipboardText.length > 0 && this.context.invoke('editor.isLimited', clipboardText.length)) {
        // paste text with maxTextLength check
        event.preventDefault();
      } else {
        // Filter pasted HTML content if allowedContent is configured
        const allowedContentOnPaste = this.options.allowedContentOnPaste !== null
          ? this.options.allowedContentOnPaste
          : this.options.allowedContent;

        if (allowedContentOnPaste && !this.options.callbacks.onPaste) {
          const html = (event.originalEvent && event.originalEvent._filteredHtml)
            || clipboardData.getData('text/html');
          if (html) {
            event.preventDefault();
            this.context.invoke('editor.pasteHTML', html);
          }
        }
      }
    } else if (window.clipboardData) {
      // for IE
      let text = window.clipboardData.getData('text');
      if (this.context.invoke('editor.isLimited', text.length)) {
        event.preventDefault();
      }
    }

    // Call editor.afterCommand after proceeding default event handler
    setTimeout(() => {
      this.context.invoke('editor.afterCommand');
    }, 10);
  }
}
