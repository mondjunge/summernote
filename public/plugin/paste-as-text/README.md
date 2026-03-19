# summernote-ext-paste-as-text

A [Summernote](https://summernote.org/) plugin that adds a toolbar button to open a dialog for pasting or typing plain text. The content is HTML-escaped and inserted at the current cursor position — without any formatting.

---

## Features

- Toolbar button with a clipboard icon (overridable)
- Modal dialog with a resizable textarea
- Insert button is disabled until text is entered
- HTML characters (`&`, `<`, `>`) are escaped automatically
- Line breaks are converted to `<br>`
- Inserts at the current cursor position / selection
- If no selection exists, appends at the end of the editor content
- Uses native Selection/Range API to avoid Summernote's `wrapBodyInlineWithPara` issues in table cells
- Built-in translations: `en-US`, `de-DE`, `fr-FR`

---

## Requirements

- jQuery
- Summernote ≥ 0.8 (lite, Bootstrap 3/4/5)

---

## Installation

Include the plugin script **after** jQuery and Summernote:

```html
<script src="jquery.min.js"></script>
<script src="summernote-lite.min.js"></script>
<script src="summernote-ext-paste-as-text.js"></script>
```

---

## Usage

Add `pasteAsText` to the toolbar:

```js
$('#editor').summernote({
  toolbar: [
    ['insert', ['link', 'picture', 'pasteAsText']],
  ],
});
```

---

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `pasteAsText.icon` | `string` (HTML) | built-in SVG | HTML string used as the toolbar button icon |

### Custom icon example

```js
$('#editor').summernote({
  pasteAsText: {
    icon: '<i class="fa fa-clipboard"/>',
  },
  toolbar: [['insert', ['pasteAsText']]],
});
```

---

## Localization

The plugin ships with `en-US`, `de-DE`, and `fr-FR`. Additional languages can be added before initializing Summernote:

```js
$.extend(true, $.summernote, {
  lang: {
    'nl-NL': {
      pasteAsText: {
        button: 'Plakken als platte tekst',
        title:  'Plakken als platte tekst',
        label:  'Tekst',
        insert: 'Invoegen',
        cancel: 'Annuleren',
      },
    },
  },
});
```

---

## License

MIT — see [LICENSE](LICENSE)
