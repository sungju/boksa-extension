# Boksa

A Chrome Manifest V3 extension that copies a selection of rendered Markdown as **rich HTML carrying the page's computed styles**. It needs no build step, server or Tampermonkey.

## Installing on macOS

1. Unzip `boksa.zip` and move the `boksa` folder somewhere you will keep it.
2. Enter `chrome://extensions` in Chrome's address bar.
3. Turn on **Developer mode** in the top right.
4. Click **Load unpacked**.
5. Choose the `boksa` folder that directly contains `manifest.json`, not the ZIP or a parent folder.
6. On the extension's **Details** page, turn on **Allow access to file URLs**.
7. If your Markdown viewer also needs file URL access, turn on the same setting for it. Reload any Markdown files that are already open.
8. Pin Boksa from Chrome's puzzle-piece extensions menu to copy with a button as well.

## Usage

1. Render the Markdown in a Markdown viewer or similar. Select the **rendered text**, not the source editor. With nothing selected, the whole page is copied and the cursor stays where it was.
2. Press **⌃⇧9 (Control+Shift+9)**.
3. Look for the green "Copied with styles" message or `OK` on the extension button.
4. Paste into your web editor with **⌘V**. Do not use paste without formatting (⌘⇧V).

**Clicking the extension button** does the same as the shortcut. If the button shows `!`, hover over it to read the error. A failed copy never shows the success mark. Each copy replaces what was on the system clipboard.

The `OK` mark disappears after a few seconds, and each run clears the previous mark first, so that an earlier result is not mistaken for the current one. `…` is shown while a copy is in progress.

### Shortcut conflicts and changes

The default key is **⌃⇧9 (Control+Shift+9)** and the alternate is **⌃⇧8 (Control+Shift+8)**. On macOS press **Control (⌃), not Command (⌘)**. Use the number row at the top of the keyboard. The real Control key was chosen on macOS because it is less likely to conflict than the earlier ⌘⇧C. Freedom from conflicts cannot be guaranteed in every environment.

At `chrome://extensions/shortcuts`, find **Boksa → Copy the selection as rich HTML**, click its key field and press **Control+Shift+9** yourself. If a scope choice is shown, set it to **In Chrome**. The alternate shortcut can be set to Control+Shift+8. Both commands do the same thing. Windows and Linux also use Ctrl+Shift+9 and Ctrl+Shift+8.

### Updating an existing installation

To change only the shortcut, **edit it on the settings page above; no reinstall is needed** and it takes effect at once.

To use a new ZIP as well, unzip it, replace the files in the extension folder you loaded earlier, and press the extension's reload button at `chrome://extensions`. Saved shortcut settings may remain, so **set Control+Shift+9 yourself on the shortcuts page after reloading**. An extension cannot overwrite a shortcut you customised.

## Copy options

Right-click the Boksa toolbar button and choose **Options**, or open **Extension options** from the Details page at `chrome://extensions`. Changes are saved at once and apply from the next copy. The defaults give the same result as earlier versions.

| Option | Choices | Description |
|---|---|---|
| Paste target | Any editor / Salesforce / Salesforce + Customer Portal | Shapes the copy for where it is going. See [Salesforce](#paste-target-salesforce) and [Salesforce + Customer Portal](#paste-target-salesforce--customer-portal) below. |
| Backgrounds | Keep all / Code only / None | "Code only" keeps the backgrounds of code blocks, inline code and `<mark>`. When a background is removed, light text with a contrast below 2:1 on white also loses its colour and takes the editor's. |
| Behind text | Keep / Soften / Remove | Applies to backgrounds painted behind text, such as inline code, `<mark>` and inline elements with a background colour. "Soften" moves bright colours toward white and lowers their saturation. Two sliders on the settings page set how far (lighten toward white, 92% by default; keep saturation, 35% by default), and the sample changes as you move them. The colour maths is in `color.js`, shared by the settings preview and the actual copy. Dark backgrounds keep their lightness so that light text on them stays readable. "Remove" drops the background, along with light text colours that would be hard to read on white. Code block backgrounds follow the Backgrounds setting. |
| Code blocks | Standard / Editor-safe | "Editor-safe" turns `<pre>` into a one-cell table, with line breaks fixed as `<br>` and indentation, repeated spaces and tabs fixed as non-breaking spaces. This stops code from running together on one line in editors that ignore `white-space: pre`, such as Google Docs and Gmail. Code inside a list item becomes shaded monospaced inline text, line by line, instead of a table, and the item's paragraphs are unwrapped. Editors that cannot hold a block inside a list item would otherwise move the code out of the list, after the next paragraph. |
| Keep syntax highlighting | On / Off | Off removes the colour, weight and italics of tokens in a code block, which is then copied in the block's single text colour. |
| Fonts | Page fonts / Editor font | "Editor font" leaves out the `font-family` of body text and sets a monospaced font on code elements. |

The plain-text clipboard format is always the original text of the selection, whatever the options.

### Paste target: Salesforce

Copies in a shape made for Salesforce Lightning rich-text fields (based on Quill 1.x), following the results of pasting into the real field. The Backgrounds and Behind text settings do not apply in this mode.

**Code**

- Code blocks are written in the Salesforce editor's Code Block format, `<pre class="ql-syntax">`. Their content is plain text, so syntax highlighting is not kept.
- Containers a viewer puts around a code block (language label, copy button) are unwrapped, and the spacing above and below them moves to the code block. Code is recognised wherever it sits, in a list item or in body text.
- Inline code carries `courier`, the only monospaced face in the Salesforce font menu, at the editor's default 13px, so it stays monospaced even if the `<code>` tag is dropped. Inline code in the same colour as the body text becomes blue, `rgb(79, 110, 206)`.

**Lists**

- A simple list with no nesting and no code stays a real list.
- A list that holds a code block (even a single line), has nested lists, or does not start at 1 (for example one resumed after an unindented code block) becomes paragraphs with the numbers and bullets typed out, with code blocks beneath their item. In Salesforce a line break inside an item becomes a new numbered item, a list interrupted by a code block restarts at 1, and the saved view does not indent nested lists properly.
- An unindented code block directly after a list is treated as part of the last item.
- Sub-steps, continuation paragraphs and code blocks are indented with Quill's `ql-indent-N` classes (39px per level in the Salesforce saved view, 3em in the Customer Portal), so the indentation holds when lines wrap.
- Quill restarts numbering at 1 when a different kind of sub-list sits between numbered items. This limit remains.

**Colours and borders**

- On saving, Salesforce darkens every colour (background, text and border colour properties) to at least 4.5:1 against white, keeping hue and saturation. Colours inside shorthand properties such as `border-top: …` are the exception. Faint backgrounds would turn into strong blues and greys, so all backgrounds are left out.
- Text colours are darkened in advance in the same way (4.7:1), and borders are written as shorthand properties, which are not converted.
- Salesforce strips `border-radius` from cells, `<code>` and tables, so rounded corners are not possible.

**Tables and paragraphs**

- A data table takes over the outer border drawn on the container around it. Without one, it gets a border in the colour of its inner lines, in place of Salesforce's black default.
- On-screen column widths are written as percentages on the first row so that columns are not made equal. Each column keeps enough room for its longest word on one line in a 720px table, taken from the wider columns. Tables are full width, as on screen, and words are not broken inside cells. Header and stripe backgrounds are left out because Salesforce darkens them.
- Horizontal rules become tables, which Salesforce stores verbatim. When two tables follow each other (for example a table and then a rule), an empty line goes between them, because Salesforce would move the second to the end of the comment. The same goes for two quotes or two code blocks, which Salesforce would join into one.
- A paragraph with line breaks (`<br>`), such as a signature, goes into a borderless one-cell table. Salesforce would otherwise make each line a new paragraph and spread the lines apart.
- Quotes stay quotes, which Salesforce draws with a grey bar and box. See [Richer elements](#richer-elements-in-both-salesforce-targets) below.
- The header row of a data table has a heavier line under it, in place of its shading.
- Text outside any paragraph gets a paragraph of its own, because Salesforce would merge it into the next block, such as a heading.

### Richer elements in both Salesforce targets

These use only tags that the Salesforce editor keeps and the Customer Portal allows.

| In the page | In the paste |
|---|---|
| Quote (`>`) | A quote box (`p.ql-quote-block` paragraphs inside a `<blockquote>`). Lists in it are typed out, headings become bold lines, and line breaks become lines of their own. A code block, a table, or a list holding one stands between two parts of the quote, because neither side can hold it inside. A quote inside a quote joins the outer one. In a list item or table cell a quote becomes ordinary lines. |
| Callout: GitHub alerts, Obsidian, MkDocs, Docusaurus, VitePress, MarkdownLens, or a plain quote starting with `[!NOTE]` and the like | A quote box whose title, if it has one, is bold and led by ℹ️ (note, info), ⭐ (tip), ✅ (success), ❗ (important), ❓ (question), ⚠️ (warning) or ⛔ (caution, danger). The title is coloured in Salesforce; the portal removes colours. |
| Task list | ✅ and ⬜ in place of the boxes, in a real list unless the list is nested or holds code (see Lists above) |
| Definition list | Bold terms with the definitions indented below |
| `<sup>`, `<sub>` | Unicode raised and lowered characters (x², H₂O) when every character has one; otherwise plain text |
| `<ins>`, underline set by a style | `<u>` |
| `<mark>` | Bold, because no background survives |
| `<kbd>`, `<samp>` | `<code>` |
| `<summary>`, `<figcaption>` | Bold; an italic line |

### Paste target: Salesforce + Customer Portal

For Salesforce comments that are also shown in the Red Hat Customer Portal. The portal shows any tag outside its allowlist as raw HTML text and removes every style attribute (confirmed in the portal's code, November 2026). The allowlist is p, br, strong, em, u, s, lists, a, img, headings, span, pre, code, blockquote, sub, sup, div, b, i, hr and table elements. Everything not listed here works as in the Salesforce target.

- **Data tables** stay real `<table>` elements. The Salesforce editor keeps them as they are (`ql-table-blob`) with the borders Boksa wrote; the portal draws its own borders and a grey header. An empty line goes between two tables in a row. Column alignment is also written as Quill's `ql-align-right` and `ql-align-center` classes and an `align` attribute, because the portal removes the style.
- **One-cell tables made by Boksa** become paragraphs, because the portal draws a border on every cell. A horizontal rule becomes a line of `─` characters.
- **Inline code** stays `<code>`. The Salesforce editor now keeps it, and the portal shows it in Consolas on grey.
- **Code blocks** use Salesforce's Code Block format (`<pre class="ql-syntax">`). URLs inside them become links on both sides.
- **Strikethrough** is drawn by adding U+0336 (combining long stroke overlay) to each character instead of using a tag. The Salesforce editor turns every strikethrough into `<strike>`, which the portal shows as text.
- **Paragraphs with line breaks** become ordinary paragraphs.
- **Blank lines:** the portal shows paragraphs with no space between them, so an empty paragraph goes between blocks. The exceptions are typed-out list lines, either side of headings (which have their own margins), and after lists, tables and quotes that have a bottom margin.
- **Headings** move up one level (h4 and below become h3) and are bold. The portal shows body text at 17.92px, h3 at 18px and h4 at 16px, so `####` headings would be smaller than the body text.

## Local .md file support

Boksa is set up to run, once file URL access is allowed, on pages whose address is **`file:///…/document.md`** and which a Markdown viewer renders as ordinary DOM. How it works with a particular Markdown viewer product or version has to be checked in your own installation.

Viewers that change the address to **`chrome-extension://another-extension-id/…`** are not supported, because Chrome blocks other extensions from running scripts there. Turning on file access does not lift this limit. In that case, use the viewer's HTML export and open the saved file in an ordinary `file:///…html` tab, or use a preview that renders Markdown as a normal web page.

Protected pages, such as `chrome://` pages and the Chrome Web Store, cannot be used either. The current version works on selections in the top-level document; selections inside iframes or Shadow DOM are not supported.

## What is preserved, and how

- The HTML structure of headings, bold and italic, links, ordered and unordered lists, tables, quotes, inline code, and pre/code with syntax highlighting
- Text colour, background, font, size, weight, line height, letter and word spacing, alignment, margin, padding, border, radius, list style and table borders and spacing, taken from each source element's `getComputedStyle()`
- `white-space` and tab-size of code, and the selected tabs and line breaks
- A partial selection copies only the selected text, with the heading, list, table, pre and quote ancestors it needs
- Start number, reversed order and explicit item numbers when part of an ordered list is selected
- Empty table cells and list items are kept, so columns and numbers do not shift
- The state of GFM task lists (`- [x]`), as `☑` and `☐` characters
- Horizontal rules (`---`, `<hr>`) are copied as an empty one-cell table with a top border, so that editors without `<hr>` support, such as Salesforce Lightning, do not drop the line. Thickness, colour and spacing follow the source page
- Solid backgrounds of ancestors, on wrapping elements. The default canvas is decided from the page's `color-scheme` and body text colour: white for a light page, a dark colour for a dark page
- Translucent colours and newer CSS colour formats (`rgba()`, the `color(srgb …)` that `color-mix()` produces, `oklch()` and so on) are written as the opaque `rgb()` colour that is actually seen. Salesforce drops transparency on saving, which would turn a 10% blue background into strong blue and make the text unreadable
- Line breaks in the source text are collapsed to spaces as a browser shows them, except in code. Salesforce treats them as real line breaks and merges the paragraph into the next heading
- Weight and slant styles on `<strong>` and `<em>` themselves (600, for example) are removed, because an editor may read them as "not bold" and ignore the tag
- Bold and italic set only by a style (such as `font-weight: 600`) become `<strong>` and `<em>`, because editors such as Salesforce's do not treat weights below 700 as bold
- Allowed links are made absolute
- `data:image/...` images are included as they are, with their displayed size kept in width and height attributes

Positioning (`position`, top, left and so on), width, height, min and max sizes, display, flex and grid, overflow, transform and z-index are not copied, so this is not a tool for reproducing a page's column layout or fixed widths. Tables are expressed as HTML table structure.

Source class, id and style attributes are not cloned; only allowlisted CSS is written. Scripts, event handlers, unsafe links and form controls are left out of the HTML. The selection itself is not changed.

Inline styles are written only where an inherited property differs from its parent, or a non-inherited property differs from the browser default. The resulting HTML is about 5 times smaller for a highlighted code block and about 8 times smaller for a large table, which helps with paste targets that truncate large HTML. What you see is the same.

Text that cannot be seen on screen (a `font-size` near 0, fully transparent text, or `opacity: 0`) is not copied. Unlike an ordinary copy, this extension carries styles along, so hidden text would otherwise travel with the paste and stay hidden there. The content of a closed `<details>` (only its summary is copied) and of `content-visibility: hidden` elements is left out as well, in every paste target.

One copy writes `text/html` and `text/plain` to the clipboard together. The plain text is the browser's `Selection.toString()` result, not HTML source or the original Markdown. To work on both file and HTTP pages, Boksa first uses a temporary copy event with `execCommand('copy')`, and tries `navigator.clipboard.write()` with `ClipboardItem` if that fails. The former is a deprecated API and may need changes as Chrome changes.

## Limitations

- If a web editor sanitises or removes pasted inline styles, or replaces them with its own, colours, backgrounds and spacing can differ. The extension cannot force its way around this.
- Line breaks and sizes depend on the editor's handling of tables and lists, the fonts available and the page width. Pixel-for-pixel identity is not guaranteed.
- CSS pseudo-elements `::before` and `::after`, custom counters, background images and gradients, canvas and video are not reproduced. List numbers and bullets are expressed as ordinary HTML lists.
- Inline SVG and MathML are left out. There is no safe HTML structure for them, and leaving them in would mix the raw text of `<script>` and `<style>` inside an SVG into the result. Inline SVG diagrams, such as those drawn by Mermaid, are therefore not in the paste. They copy normally if the viewer renders them as `<img>`.
- Images keep only `http`/`https` and `data:image/...` URLs. Image files are not embedded separately in the clipboard, so images that need authentication or cannot be reached from outside may not appear where you paste.
- Local `file:` paths are left out of both links and images. They would not open in a remote editor anyway, and would leave a local path containing your user name in the document. A `file:` image pastes as its alt text and a `file:` link as plain text.
- Copying part of a table removes the cells that were not selected. For complex tables with merged cells, select the whole table.
- Very large documents may pause briefly while computed styles are read. A page's own copy event handler may also intercept the copy.

## Permissions and privacy

- `activeTab`: temporary access to the current tab when the user runs the shortcut or button
- `scripting`: runs the copy code in that tab
- `clipboardWrite`: writes to the clipboard (no read permission)
- `storage`: saves the copy options from the settings page (page content is not stored)
- `host_permissions: file:///*`: support for local file URLs. Actual access needs the user to allow access to file URLs.

`file:///*` in `host_permissions` cannot be removed. Chrome offers the **Allow access to file URLs** toggle only to extensions that declare file access in the manifest, and without that declaration `activeTab` alone cannot reach `file:///` pages, so the local Markdown workflow would not work. The toggle itself is off by default and the user has to turn it on.

Boksa does not ask for standing access to HTTP or HTTPS sites. It does not send data to a server, run analytics, load outside code, read the clipboard or store what you select. Local file paths are not included in the resulting HTML. Remote image URLs from the source page do remain, so whoever opens the pasted document may download those images later.

## Privacy policy

`PRIVACY.md` is the original and holds both the English and Korean text. `store/privacy.html` is a page with the same content, ready to host.

A Web Store listing needs a **public URL**. Put `store/privacy.html` at an address such as `https://baramsoft.com/boksa/privacy/` and enter that address in the privacy policy field of the Developer Dashboard. Change both files together when revising the policy; an automated check confirms that the two copies carry the same effective date.

## Languages

Every string a user sees is in `_locales/`, in **English and Korean**. That covers the extension's name and description, toolbar tooltip, shortcut descriptions, on-screen messages and errors. Chrome picks the file for the browser's language and falls back to English, the `default_locale`.

When adding a string, put the same key in both files. With a key in only one of them, Chrome shows an empty string without any error, so an automated check confirms that both files have the same keys and that every key used in the code exists. Unused keys also fail the check.

`copy.js` passes an English default with each call, because the tests run the same file in the page's main world, where there is no extension API. The isolated world used by the real extension has `chrome.i18n`, so translated strings appear there.

## Icons

`tools/icon.js` is the source, and `npm run icons` regenerates the PNGs. It renders with the Chrome already installed as a test dependency, so no image library is needed.

The artwork is drawn on a 128-unit grid and scaled down. Below 48px three bars blur together, so a separate drawing with two bars and thicker lines is used. The 16, 32, 48 and 128 sizes are generated into `icons/` and included in the package. The Web Store icon, `store/icon-128.png`, is made separately to Google's guidelines, with 96×96 artwork and 16px of transparent padding on each side of a 128×128 image. The 512 size is the source for promotional use. Neither goes into the package.

## Trying it out

Open `tests/fixture.html` in Chrome to see a heading, list, table, quote, highlighted code and a paste area. With file URL access allowed:

1. Select part of the heading or the code block and copy it with the shortcut.
2. Paste it with ⌘V into the paste area at the bottom of the page.
3. Copy only the second list item and check that its number starts at 5.
4. Check in the web editor you will actually use, too.
5. Paste into a plain-text editor and check that you get text rather than HTML tags.

Automated checks for developers (Node.js and Chrome required):

```sh
npm install --no-save playwright
node tests/run.cjs
```

The automated checks run in the real Chrome engine. They include: complete translation files and icon assets, matching effective dates in both copies of the privacy policy, strings resolved through `chrome.i18n`, partial heading selection, inline structure and links, list numbering, quotes, code colours and whitespace, tables, removal of unsafe HTML, omission of layout properties, task list state, empty cells, blocking of scripts and styles inside SVG, blocking of hidden text, blocking of `<title>` leaks, empty list items, selection boundaries, the `start` attribute, `data:` images, image alt text and size, light and dark canvases, whole-document selection, deeply nested list performance, the amount of inline style, the Async Clipboard fallback and empty selections, as well as the copy options and paste targets.

The checks assert that the visible characters of both clipboard formats (`text/html` and `text/plain`) match. A difference between the two is the sign that content the user cannot see is travelling in the HTML alone.

Clipboard transport is mocked in the tests. Running the shortcut in an installed extension, writing to the system clipboard and pasting into particular web editors are outside what is checked automatically. The tests also run `copy.js` in the page's main world, so conditions are not exactly those of the isolated world the real extension uses.

## Files

- `manifest.json`: Manifest V3, permissions, shortcuts, icons
- `background.js`: handles the shortcut and button, shows success and errors
- `copy.js`: extracts the selection, inlines styles, writes the clipboard
- `_locales/en`, `_locales/ko`: every string a user sees
- `icons/`: extension icons at 16, 32, 48 and 128 (included in the package)
- `PRIVACY.md`: privacy policy (English and Korean)
- `tools/icon.js`, `tools/make-icons.cjs`: icon source and generator
- `store/`: material for the Web Store listing (not included in the package)
- `tests/fixture.html`: page for checking by hand
- `tests/run.cjs`: automated checks based on Chrome

## Chrome documentation

- [Commands API and shortcut limits](https://developer.chrome.com/docs/extensions/reference/api/commands)
- [The activeTab permission](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)
- [Declaring permissions and file URL access](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)
- [URL match patterns](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns)
- [Loading an extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked)

## Licence

[MIT](LICENSE) © 2026 Sungju Kwon

## Trademarks

Boksa is not affiliated with or endorsed by Red Hat or Salesforce. Product names are trademarks of their owners.
