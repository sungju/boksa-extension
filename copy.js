(async () => {
  'use strict';
  // Executed only on an explicit shortcut/action; no persistent page listener.
  const HTML_NS = 'http://www.w3.org/1999/xhtml';
  // chrome.i18n exists in the isolated world this file is injected into, but the
  // test harness evaluates the very same source in the page's main world, where
  // there is no extension API at all. Every lookup therefore carries the
  // default_locale string as its own fallback.
  function t(key, fallback) {
    try { return globalThis.chrome?.i18n?.getMessage(key) || fallback; } catch { return fallback; }
  }
  // background.js hands the saved options over in this same isolated world just
  // before injecting; the tests set them on the page. Anything missing or
  // unrecognised falls back to the default, which is the original behaviour.
  const defaults = {target: 'generic', backgrounds: 'all', textBackgrounds: 'keep', softLighten: 92, softSaturation: 35,
    codeBlocks: 'standard', highlight: true, fonts: 'page'};
  const choices = {target: ['generic', 'salesforce', 'portal'], backgrounds: ['all', 'code', 'none'], textBackgrounds: ['keep', 'soft', 'none'],
    codeBlocks: ['standard', 'robust'], fonts: ['page', 'editor']};
  const options = {...defaults};
  for (const [key, value] of Object.entries(globalThis.boksaOptions || {})) {
    const valid = key === 'highlight' ? typeof value === 'boolean'
      : ['softLighten', 'softSaturation'].includes(key) ? Number.isInteger(value) && value >= 0 && value <= 100
      : Object.hasOwn(choices, key) && choices[key].includes(value);
    if (valid) options[key] = value;
  }
  const codeTags = new Set(['pre', 'code', 'kbd', 'samp']);
  // Salesforce Lightning's rich-text field is Quill 1.x. Its paste converter
  // keeps inline styles, headings, alignment, tables (stored as raw HTML) and,
  // since late 2026, <code> and <blockquote>; it drops <pre>, <mark>, <hr>,
  // sub/sup, margins and any block inside a list item, and flattens lists to
  // one line per item with indent classes. The salesforce target writes everything in the forms it keeps.
  // The portal target is for comments also read in the Red Hat Customer
  // Portal, which shows the same stored comment through its own allowlist
  // (other tags are printed as text) and drops every style attribute. Data
  // tables, inline code and quotes are real elements both sides draw; code
  // boxes, rules and strikethrough take forms that survive the portal.
  const portal = options.target === 'portal';
  const salesforce = options.target === 'salesforce' || portal;
  const robust = salesforce || options.codeBlocks === 'robust';
  const properties = [
    'color', 'background-color', 'font-family', 'font-size', 'font-weight',
    'font-style', 'font-variant', 'font-stretch', 'line-height', 'letter-spacing',
    'word-spacing', 'text-align', 'text-indent', 'text-transform',
    'text-decoration-line', 'text-decoration-color', 'text-decoration-style',
    'text-decoration-thickness', 'text-underline-offset', 'white-space', 'tab-size',
    'overflow-wrap', 'word-break', 'vertical-align', 'direction',
    'list-style-type', 'list-style-position', 'border-collapse', 'border-spacing',
    ...['top', 'right', 'bottom', 'left'].flatMap(side => [
      `margin-${side}`, `padding-${side}`, `border-${side}-width`,
      `border-${side}-style`, `border-${side}-color`
    ]),
    ...['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(c => `border-${c}-radius`)
  ];
  // Inherited properties are reproduced by the ancestor chain, so they only need
  // writing where they change. Everything else is compared against the UA default.
  const inherited = new Set([
    'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant',
    'font-stretch', 'line-height', 'letter-spacing', 'word-spacing', 'text-align',
    'text-indent', 'text-transform', 'text-underline-offset', 'white-space', 'tab-size',
    'overflow-wrap', 'word-break', 'direction', 'list-style-type', 'list-style-position',
    'border-collapse', 'border-spacing'
  ]);
  const allowed = new Set(('a abbr b bdi bdo blockquote br caption code dd del div dl dt em figcaption figure h1 h2 h3 h4 h5 h6 hr i img ins kbd li mark ol p pre q s samp small span strong sub sup table tbody td tfoot th thead tr u ul var').split(' '));
  // Matched against localName, so it also covers foreign-namespace elements whose
  // tagName is not uppercased (an SVG <script> reports tagName 'script').
  const discard = new Set(['script', 'style', 'noscript', 'iframe', 'object', 'embed',
    'textarea', 'button', 'select', 'option', 'datalist', 'template', 'form', 'slot',
    'dialog', 'canvas', 'video', 'audio', 'head', 'title', 'meta', 'link', 'base']);
  // Structural elements whose absence shifts sibling positions; kept when the
  // source itself is empty, dropped when the range merely grazed their boundary.
  const keepEmpty = new Set(['td', 'th', 'tr', 'thead', 'tbody', 'tfoot', 'li', 'dd', 'dt']);
  const voids = new Set(['br', 'hr', 'img']);
  // Table parts only get their UA styling inside the right ancestor chain.
  const probeParents = {
    td: ['table', 'tbody', 'tr'], th: ['table', 'tbody', 'tr'], tr: ['table', 'tbody'],
    tbody: ['table'], thead: ['table'], tfoot: ['table'], caption: ['table'],
    li: ['ul'], dd: ['dl'], dt: ['dl']
  };
  function toast(message, failed = false) {
    const host = document.createElement('div');
    host.style.cssText = 'all:initial!important;position:fixed!important;bottom:24px!important;right:24px!important;z-index:2147483647!important;pointer-events:none!important';
    const shadow = host.attachShadow({mode: 'closed'});
    const box = document.createElement('div');
    box.textContent = message;
    box.setAttribute('role', 'status');
    box.style.cssText = `font:14px/1.5 system-ui;padding:12px 18px;border-radius:8px;color:white;background:${failed ? '#b42318' : '#18794e'};max-width:420px;box-shadow:0 4px 20px #0003`;
    shadow.append(box); document.documentElement.append(host);
    setTimeout(() => host.remove(), 3500);
  }
  function integer(value, fallback) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  // Computed colours are not always rgb()/rgba(): color-mix() computes to
  // color(srgb … / a), and oklch()/lab() stay as written. Those are resolved
  // by letting the browser paint the colour over black and over white and
  // reading the pixels back, which yields its sRGB value and its alpha.
  const resolved = new Map();
  let painter = null;
  function paint(value) {
    if (!painter) {
      const canvas = document.createElement('canvas');
      canvas.width = 2; canvas.height = 1;
      painter = canvas.getContext('2d', {willReadFrequently: true});
    }
    const context = painter;
    // Opaque fills fully replace whatever was painted before.
    context.fillStyle = '#000'; context.fillRect(0, 0, 1, 1);
    context.fillStyle = '#fff'; context.fillRect(1, 0, 1, 1);
    // An unparsable value leaves fillStyle unchanged; the sentinel exposes it.
    context.fillStyle = '#010203';
    context.fillStyle = value;
    if (context.fillStyle === '#010203' && !/^#010203$/i.test(value)) return null;
    context.fillRect(0, 0, 2, 1);
    const [r0, g0, b0, , r1, g1, b1] = context.getImageData(0, 0, 2, 1).data;
    // Over black a pixel is a*c; over white it is a*c + (1 - a)*255.
    const a = Math.min(1, Math.max(0, 1 - ((r1 - r0) + (g1 - g0) + (b1 - b0)) / (3 * 255)));
    if (a === 0) return {r: 0, g: 0, b: 0, a: 0};
    const channel = value => Math.min(255, Math.round(value / a));
    return {r: channel(r0), g: channel(g0), b: channel(b0), a: Math.round(a * 1000) / 1000};
  }
  function rgba(value) {
    if (!value) return null;
    const match = /^rgba?\(([^)]+)\)$/.exec(value);
    if (match) {
      const parts = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      if (parts.length >= 3 && !parts.some(Number.isNaN)) return {r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1};
    }
    if (/^(transparent|currentcolor|inherit|initial|unset|none)$/i.test(value)) return value.toLowerCase() === 'transparent' ? {r: 0, g: 0, b: 0, a: 0} : null;
    if (!resolved.has(value)) resolved.set(value, paint(value));
    return resolved.get(value);
  }
  function transparent(value) {
    const color = rgba(value);
    return !!color && color.a === 0;
  }
  function safeURL(value, image = false) {
    if (!value) return null;
    // Inert inside an <img>, and self-contained payloads survive pasting anywhere.
    if (image && /^data:image\//i.test(value.trim())) {
      const url = value.trim();
      return /[<>"]/.test(url) ? null : url;
    }
    try {
      const url = new URL(value, document.baseURI);
      // file: is excluded deliberately: it never loads in a remote editor and
      // would disclose local filesystem paths in the pasted markup.
      const schemes = image ? ['http:', 'https:'] : ['http:', 'https:', 'mailto:', 'tel:'];
      return schemes.includes(url.protocol) ? url.href : null;
    } catch { return null; }
  }
  // UA defaults, read from a blank same-origin document so page CSS cannot skew them.
  let baseline;
  let baselineFrame = null;
  const baselines = new Map();
  function baselineFor(tag) {
    if (baselines.has(tag)) return baselines.get(tag);
    if (baseline === undefined) {
      try {
        baselineFrame = document.createElement('iframe');
        baselineFrame.setAttribute('aria-hidden', 'true');
        baselineFrame.style.cssText = 'position:fixed!important;top:-9999px!important;left:-9999px!important;width:1px!important;height:1px!important;border:0!important;opacity:0!important;pointer-events:none!important';
        document.documentElement.append(baselineFrame);
        baseline = baselineFrame.contentWindow?.document?.body ? baselineFrame.contentWindow : null;
      } catch { baseline = null; }
    }
    let computed = null;
    if (baseline) {
      try {
        const document_ = baseline.document;
        let mount = document_.body;
        for (const name of probeParents[tag] || []) mount = mount.appendChild(document_.createElement(name));
        // The probe stays mounted: getComputedStyle is live and empties on removal.
        computed = baseline.getComputedStyle(mount.appendChild(document_.createElement(tag)));
      } catch { computed = null; }
    }
    baselines.set(tag, computed);
    return computed;
  }
  // Bullet styles only mean something on lists. Written anywhere else (the
  // copy's outer wrapper inherits the page's 'disc') some editors, Salesforce
  // Lightning among them, turn them into literal Word bullet glyphs, 'l' for a
  // disc and 'o' for a circle, at the start of ordinary paragraphs.
  const listTags = new Set(['ol', 'ul', 'li']);
  function style(tag, target, computed, parentComputed) {
    const uaDefaults = baselineFor(tag);
    for (const property of properties) {
      if (property.startsWith('list-style') && !listTags.has(tag)) continue;
      const value = computed.getPropertyValue(property);
      if (!value || /url\s*\(/i.test(value)) continue;
      const reference = inherited.has(property) ? parentComputed : uaDefaults;
      if (reference && reference.getPropertyValue(property) === value) continue;
      target.style.setProperty(property, value);
    }
  }
  function cloneSelected(node, range, parentComputed) {
    if (!range.intersectsNode(node)) return null;
    if (node.nodeType === Node.TEXT_NODE) {
      const start = node === range.startContainer ? range.startOffset : 0;
      const end = node === range.endContainer ? range.endOffset : node.length;
      return end > start ? document.createTextNode(node.data.slice(start, end)) : null;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    // tagName is uppercased only for HTML-namespace elements, so an SVG <script>
    // or <style> reports a lowercase name and must be matched on localName.
    if (node.namespaceURI !== HTML_NS) return null;
    const tag = node.localName.toLowerCase();
    if (discard.has(tag)) return null;
    // Task-list state would otherwise disappear along with the control.
    if (tag === 'input') {
      return node.type === 'checkbox' ? document.createTextNode(node.checked ? '☑ ' : '☐ ') : null;
    }
    const computed = getComputedStyle(node);
    if (computed.display === 'none' || computed.visibility === 'hidden' || computed.visibility === 'collapse') return null;
    if (Number(computed.opacity) === 0) return null;
    if (tag === 'hr') return ruleTable(node, computed);
    const copy = document.createElement(allowed.has(tag) ? tag : 'div');
    style(tag, copy, computed, parentComputed);
    if (salesforce) explicitInline(node, tag, copy);
    adjust(node, tag, copy, computed);
    solidColors(node, copy);
    for (const name of ['title', 'lang', 'dir']) if (node.hasAttribute(name)) copy.setAttribute(name, node.getAttribute(name));
    if (tag === 'a') {
      const href = node.hasAttribute('href') && safeURL(node.getAttribute('href'));
      if (href) copy.setAttribute('href', href);
    }
    if (tag === 'img') {
      const alt = node.getAttribute('alt') || '';
      const src = safeURL(node.currentSrc || node.getAttribute('src'), true);
      // A src-less <img> pastes as a broken-image icon; the alt text is more useful.
      if (!src) return alt ? document.createTextNode(alt) : null;
      copy.setAttribute('src', src);
      copy.setAttribute('alt', alt);
      // Without these a 2400px screenshot pastes at its intrinsic size. An image
      // that failed or is still loading reports the broken-icon box from .width,
      // so only trust the layout once it has decoded.
      const loaded = node.complete && node.naturalWidth > 0;
      const width = loaded ? node.width : integer(node.getAttribute('width'), 0);
      const height = loaded ? node.height : integer(node.getAttribute('height'), 0);
      if (width > 0) copy.setAttribute('width', String(width));
      if (height > 0) copy.setAttribute('height', String(height));
    }
    // The column's on-screen share of the table, for editors that lay tables
    // out with even columns unless told otherwise (Salesforce).
    if (salesforce && ['td', 'th'].includes(tag)) {
      const table = node.closest('table');
      const total = table?.getBoundingClientRect().width;
      if (total > 0) copy.dataset.boksaWidth = String(Math.round(node.getBoundingClientRect().width / total * 1000) / 10);
      // The widest word in the cell, which must fit on one line, plus padding.
      if (!ruler) ruler = document.createElement('canvas').getContext('2d');
      ruler.font = `${computed.fontWeight} ${computed.fontSize} ${computed.fontFamily}`;
      const words = node.textContent.split(/\s+/).filter(Boolean);
      const widest = Math.max(0, ...words.map(word => ruler.measureText(word).width));
      const padding = parseFloat(computed.paddingLeft) + parseFloat(computed.paddingRight);
      copy.dataset.boksaMin = String(Math.ceil(widest + padding + 4));
    }
    if (['td', 'th'].includes(tag)) for (const name of ['colspan', 'rowspan', 'scope']) {
      if (node.hasAttribute(name)) copy.setAttribute(name, node.getAttribute(name));
    }
    if (tag === 'li' && node.hasAttribute('value')) copy.setAttribute('value', node.getAttribute('value'));
    // Text the page renders invisibly must not ride along unseen in the HTML
    // flavour; descendants that restore a visible size or colour still copy.
    const invisible = parseFloat(computed.fontSize) < 4 || transparent(computed.color);
    let firstItem = null;
    for (const child of node.childNodes) {
      if (invisible && child.nodeType === Node.TEXT_NODE) continue;
      const selected = cloneSelected(child, range, computed);
      if (!selected) continue;
      if (!firstItem && child.nodeType === Node.ELEMENT_NODE && child.localName === 'li') firstItem = child;
      copy.append(selected);
    }
    if (!copy.childNodes.length && !voids.has(tag) && !(keepEmpty.has(tag) && !node.textContent.trim())) return null;
    if (tag === 'ol' && firstItem) {
      if (node.reversed) copy.setAttribute('reversed', '');
      const items = [...node.children].filter(n => n.localName === 'li');
      let number = node.hasAttribute('start')
        ? integer(node.getAttribute('start'), 1)
        : node.reversed ? items.length : 1;
      for (const item of items) {
        if (item.hasAttribute('value')) number = integer(item.getAttribute('value'), number);
        // Reuses the child loop's answer rather than re-cloning, which was
        // exponential on lists nested under their own first item.
        if (item === firstItem) break;
        number += node.reversed ? -1 : 1;
      }
      copy.setAttribute('start', String(number));
    }
    return copy;
  }
  // Many web editors (Salesforce Lightning and other Quill-style ones) have no
  // horizontal rule and silently drop <hr>. An empty full-width table cell
  // whose top border draws the line survives them, and still reads as a plain
  // line everywhere else. Thickness and colour come from however the page
  // draws its rule: GitHub-style themes use a filled box (a height, a
  // background, no border), the browser default a grey inset border.
  function ruleTable(node, computed) {
    const fill = rgba(computed.backgroundColor);
    const height = parseFloat(computed.height);
    const edge = side => computed.getPropertyValue(`border-${side}-style`) !== 'none'
      ? parseFloat(computed.getPropertyValue(`border-${side}-width`)) || 0 : 0;
    let thickness, color;
    if (!edge('top') && !edge('bottom') && fill && fill.a > 0 && height > 0) {
      thickness = height; color = computed.backgroundColor;
    } else {
      thickness = Math.max(1, edge('top') || edge('bottom'));
      color = edge('top') ? computed.borderTopColor : computed.borderBottomColor;
    }
    const parsed = rgba(color);
    if (parsed && parsed.a < 1) color = css(blend(parsed, surfaceOf(node.parentElement)));
    const table = document.createElement('table');
    table.style.borderCollapse = 'collapse';
    table.style.width = '100%';
    table.style.marginTop = computed.marginTop;
    table.style.marginBottom = computed.marginBottom;
    const cell = table.appendChild(document.createElement('tbody')).appendChild(document.createElement('tr'))
      .appendChild(document.createElement('td'));
    cell.style.cssText = `border-top: ${Math.round(thickness * 100) / 100}px solid ${color}; padding: 0; height: 1px; font-size: 1px; line-height: 1px;`;
    // An empty cell collapses to nothing in some editors.
    cell.textContent = '\u00a0';
    return table;
  }
  function luminance(color) {
    return (0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b) / 255;
  }
  // WCAG contrast of a colour against white, used to decide whether text that
  // loses its dark background would still be readable in a typical editor.
  const {contrast, soften, readableOn, darkenFor, css, white} = globalThis.boksaColor;
  const contrastOnWhite = color => contrast(color, white);
  // Border and underline colours default to the text colour, so they carry the
  // same value and have to go with it.
  function dropColor(copy, computed) {
    for (const property of ['color', 'text-decoration-color', ...['top', 'right', 'bottom', 'left'].map(side => `border-${side}-color`)]) {
      if (copy.style.getPropertyValue(property) === computed.color) copy.style.removeProperty(property);
    }
  }
  const insideCode = element => codeTags.has(element.localName) || !!element.parentElement?.closest('pre, code, kbd, samp');
  // A background painted behind a run of text (inline code, <mark>, a
  // highlighted span) rather than behind a block. Tokens inside a code block
  // belong to the block and follow the block setting.
  function behindText(element) {
    return element.localName !== 'pre' && !element.parentElement?.closest('pre') &&
      getComputedStyle(element).display.startsWith('inline');
  }
  function keepsBackground(element) {
    if (options.textBackgrounds === 'none' && behindText(element)) return false;
    return options.backgrounds === 'all' ||
      (options.backgrounds === 'code' && (insideCode(element) || element.localName === 'mark'));
  }
  // Whether the text of this element will still sit on a solid background after
  // the options are applied. Translucent layers are looked through, because
  // what shows through them is the next solid layer, which may be dropped.
  const backdrops = new Map();
  function onKeptBackdrop(element) {
    if (backdrops.has(element)) return backdrops.get(element);
    // With no solid layer at all, the text lands on the canvas the copy adds,
    // which only exists when every background is kept.
    let kept = options.backgrounds === 'all';
    for (let layer = element; layer; layer = layer.parentElement) {
      if (backdrops.has(layer)) { kept = backdrops.get(layer); break; }
      const color = rgba(getComputedStyle(layer).backgroundColor);
      if (color && color.a >= 1) { kept = keepsBackground(layer); break; }
    }
    backdrops.set(element, kept);
    return kept;
  }
  // Quill drops the <code>, <kbd> and <samp> tags themselves but keeps styles
  // written on them, so their monospace font is always written out.
  function explicitInline(node, tag, copy) {
    if (!['code', 'kbd', 'samp'].includes(tag) || node.parentElement?.closest('pre')) return;
    copy.style.setProperty('font-family', getComputedStyle(node).fontFamily);
  }
  // Semi-transparent colours (GitHub-style themes use rgba() for inline code,
  // code blocks and borders) render correctly in an editor, but Salesforce
  // strips the alpha channel when it saves, so a 10% lavender tint is stored
  // as solid blue behind blue text. Every colour is therefore written as the
  // solid colour it actually appears as: blended onto whatever lies beneath.
  const surfaces = new Map();
  function blend(color, under) {
    const mix = channel => Math.round(color[channel] * color.a + under[channel] * (1 - color.a));
    return {r: mix('r'), g: mix('g'), b: mix('b'), a: 1};
  }
  function canvasFor(element) {
    // Salesforce drops block backgrounds, so its pastes sit on its white page.
    if (salesforce || options.backgrounds !== 'all') return white;
    return canvasColor(element) === 'white' ? white : {r: 30, g: 30, b: 30, a: 1};
  }
  // The solid colour showing through at this element: every kept background
  // from the page down to and including it, blended in order.
  function surfaceOf(element) {
    if (!element) return white;
    if (surfaces.has(element)) return surfaces.get(element);
    const under = element.parentElement ? surfaceOf(element.parentElement) : canvasFor(element);
    const own = rgba(getComputedStyle(element).backgroundColor);
    const result = own && own.a > 0 && keepsBackground(element) ? blend(own, under) : under;
    surfaces.set(element, result);
    return result;
  }
  const colorProperties = ['color', 'background-color', 'text-decoration-color',
    ...['top', 'right', 'bottom', 'left'].map(side => `border-${side}-color`)];
  function solidColors(node, copy) {
    for (const property of colorProperties) {
      const value = copy.style.getPropertyValue(property);
      if (!value) continue;
      if (value === 'transparent') {
        // Salesforce drops the <mark> tag, so there is no yellow to cancel,
        // and a transparent colour with its alpha stripped is black.
        if (salesforce) copy.style.removeProperty(property);
        continue;
      }
      const color = rgba(value);
      if (!color) continue;
      // Opaque colours in newer formats are rewritten too: Salesforce keeps
      // only rgb() reliably.
      if (color.a >= 1) {
        if (!/^rgb\(/.test(value)) copy.style.setProperty(property, css(color));
        continue;
      }
      const under = property === 'background-color' ? surfaceOf(node.parentElement) : surfaceOf(node);
      copy.style.setProperty(property, css(blend(color, under)));
    }
  }
  // Applies the user's options on top of the faithful computed-style copy.
  function adjust(node, tag, copy, computed) {
    const inCode = insideCode(node);
    const keepBackground = keepsBackground(node);
    let background = rgba(computed.backgroundColor);
    // Softening and contrast checks work on the colour as it actually appears.
    if (background && background.a > 0 && background.a < 1) background = blend(background, surfaceOf(node.parentElement));
    if (!keepBackground) {
      copy.style.removeProperty('background-color');
      // <mark> is yellow by default in every editor unless told otherwise.
      if (tag === 'mark') copy.style.setProperty('background-color', 'transparent');
    } else if (options.textBackgrounds === 'soft' && background?.a > 0 && behindText(node)) {
      // Written even when it equals the UA default (a <mark>'s yellow), since
      // the paste target would otherwise apply its own full-strength default.
      const softened = soften(background, options.softLighten, options.softSaturation);
      copy.style.setProperty('background-color', css(softened));
      const text = rgba(computed.color);
      const readable = text && readableOn(text, softened);
      if (readable && readable !== text) copy.style.setProperty('color', css(readable));
    }
    // Token colours live on the descendants of <pre>. An element that paints
    // its own background (highlight.js puts the theme on <code class="hljs">)
    // also carries the base text colour for it, which must stay.
    if (!options.highlight && tag !== 'pre' && node.parentElement?.closest('pre')) {
      for (const property of ['font-weight', 'font-style']) copy.style.removeProperty(property);
      if (keepBackground && background && background.a > 0) copy.style.setProperty('color', computed.color);
      else dropColor(copy, computed);
    }
    if (options.backgrounds !== 'all' || options.textBackgrounds === 'none') {
      if (onKeptBackdrop(node)) {
        // An ancestor's colour may have been dropped, so the text colour this
        // background was designed for can no longer be left to inheritance.
        if (background?.a >= 1) copy.style.setProperty('color', computed.color);
      } else {
        // The text will land on the editor's background, typically white. Light
        // colours meant for a dark box would vanish, so let the editor decide.
        const color = rgba(computed.color);
        if (color && contrastOnWhite(color) < 2) dropColor(copy, computed);
      }
    }
    if (options.fonts === 'editor' && !inCode) copy.style.removeProperty('font-family');
    // Editors that turn <pre> into paragraphs keep whatever font is written on
    // the element, so code must not rely on the UA's monospace default.
    if (codeTags.has(tag) && (options.fonts === 'editor' || robust)) {
      copy.style.setProperty('font-family', computed.fontFamily);
    }
    // tab-size is inherited, so it is often absent from the inline style; the
    // robust conversion needs the real value and removes this marker again.
    if (tag === 'pre' && robust) copy.dataset.boksaTabSize = computed.tabSize;
  }
  // Many web editors (Google Docs, Gmail, most WYSIWYG widgets) ignore
  // white-space: pre and <pre> itself, collapsing indentation and line breaks.
  // The robust form hard-codes both. This returns the block's content with
  // <br> for every line break and non-breaking spaces for indentation.
  function hardenCode(pre) {
    // A length such as "20px" is not a character count; use the CSS default.
    const tabSize = /^\d+$/.test(pre.dataset.boksaTabSize || '') ? Number(pre.dataset.boksaTabSize) || 8 : 8;
    delete pre.dataset.boksaTabSize;
    const content = document.createElement('div');
    let lineStart = true;
    let column = 0;
    // A CR may end one text node with its LF starting the next (token spans).
    let afterCR = false;
    const newline = target => { target.append(document.createElement('br')); lineStart = true; column = 0; };
    const walk = (source, target) => {
      for (const child of [...source.childNodes]) {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.data;
          for (let index = 0; index < text.length; index++) {
            const ch = text[index];
            // CRLF is one break; a lone CR (classic Mac) is a break of its own.
            if (ch === '\n') { if (!afterCR) newline(target); afterCR = false; continue; }
            if (ch === '\r') { newline(target); afterCR = true; continue; }
            afterCR = false;
            let out = ch;
            // Tabs advance to the next stop, so aligned columns stay aligned.
            if (ch === '\t') out = '\u00a0'.repeat(tabSize - column % tabSize);
            // A lone space between words stays breakable; indentation and runs
            // of spaces become non-breaking so editors cannot collapse them.
            else if (ch === ' ' && (lineStart || text[index - 1] === ' ' || text[index + 1] === ' ' || index === text.length - 1)) out = '\u00a0';
            lineStart = false;
            column += out.length;
            const last = target.lastChild;
            if (last?.nodeType === Node.TEXT_NODE) last.data += out; else target.append(out);
          }
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const clone = child.cloneNode(false);
          if (clone.localName === 'br') { newline(target); afterCR = false; continue; }
          walk(child, clone); target.append(clone);
        }
      }
    };
    // A trailing newline would paste as an empty last line inside the box. It is
    // usually nested in <code>, so trim the block's final text node itself.
    const texts = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
    let last = null;
    while (texts.nextNode()) last = texts.currentNode;
    if (last) last.data = last.data.replace(/[\r\n]+$/, '');
    walk(pre, content);
    return content;
  }
  // Outside lists, a one-cell table is the one container those editors
  // reliably keep together with its background.
  // Salesforce's rich-text field now has a Code Block format: Quill's
  // <pre class="ql-syntax">, which it stores and which the Customer Portal
  // displays. Its content is plain text with real line breaks; Quill draws
  // it in its own monospace box, so formatting inside it is not kept anyway.
  function quillCode(pre) {
    const code = document.createElement('pre');
    code.className = 'ql-syntax';
    code.setAttribute('spellcheck', 'false');
    code.textContent = pre.textContent.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
    return code;
  }
  const sides = ['top', 'right', 'bottom', 'left'];
  function codeTable(pre, content) {
    const cell = document.createElement('td');
    cell.style.cssText = pre.style.cssText;
    for (const property of ['margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'white-space', 'tab-size']) {
      cell.style.removeProperty(property);
    }
    cell.append(...content.childNodes);
    cell.dataset.boksaCode = '';
    // Some themes pad the <code> inside <pre>. As an inline box its left
    // padding indents only the first line, so the padding belongs to the cell.
    for (const inner of cell.querySelectorAll(':scope > code')) {
      const padding = sides.map(side => inner.style.getPropertyValue(`padding-${side}`));
      for (const side of sides) inner.style.removeProperty(`padding-${side}`);
      sides.forEach((side, index) => {
        if (padding[index] && !cell.style.getPropertyValue(`padding-${side}`)) cell.style.setProperty(`padding-${side}`, padding[index]);
      });
    }
    const table = document.createElement('table');
    table.style.borderCollapse = 'collapse';
    table.style.width = '100%';
    for (const property of ['margin-top', 'margin-bottom']) {
      if (pre.style.getPropertyValue(property)) table.style.setProperty(property, pre.style.getPropertyValue(property));
    }
    const body = table.appendChild(document.createElement('tbody'));
    body.appendChild(document.createElement('tr')).append(cell);
    return table;
  }
  // Inside a list item, flat-list editors (Salesforce Lightning and other
  // Quill-style editors) cannot hold any block: a table or <pre> there is
  // hoisted out of the list, often below the next paragraph. So the code
  // becomes inline runs, one shaded monospace span per line, joined by <br>.
  function codeLineSpans(pre, content) {
    const shade = document.createElement('span');
    for (const property of ['color', 'background-color', 'font-family', 'font-size', 'font-weight', 'font-style',
      'line-height', 'border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius']) {
      const value = pre.style.getPropertyValue(property);
      if (value) shade.style.setProperty(property, value);
    }
    if (shade.style.backgroundColor) shade.style.padding = '1px 6px';
    const range = document.createRange();
    range.setStart(content, 0);
    const lines = [];
    // cloneContents copies the partially selected ancestors (<code>, token
    // spans), so each line keeps its highlighting without the line breaks.
    for (const br of content.querySelectorAll('br')) {
      range.setEndBefore(br); lines.push(range.cloneContents()); range.setStartAfter(br);
    }
    range.setEnd(content, content.childNodes.length); lines.push(range.cloneContents());
    return lines.map(line => {
      const span = shade.cloneNode(false);
      // An empty line still needs a character, or the editor drops it.
      if (!line.textContent) line.append('\u00a0');
      span.append(line);
      return span;
    });
  }
  function codeLines(pre, content) {
    const fragment = document.createDocumentFragment();
    codeLineSpans(pre, content).forEach((span, index) => {
      if (index) fragment.append(document.createElement('br'));
      fragment.append(span);
    });
    return fragment;
  }
  // Rewrites a list item that holds code into the shape flat-list editors keep:
  // the item's own paragraphs unwrapped, blocks separated by <br>, and the code
  // as inline lines. A nested list stays a list, since those editors indent it.
  const blockTags = new Set(['p', 'div', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'dl', 'dd', 'dt', 'figure', 'figcaption']);
  function flattenItem(item) {
    const out = document.createDocumentFragment();
    let started = false, pendingBreak = false;
    const breakIfPending = target => {
      if (pendingBreak) target.append(document.createElement('br'));
      pendingBreak = false;
    };
    const emit = (node, target) => { breakIfPending(target); started = true; target.append(node); };
    const visit = (parent, target) => {
      for (const child of [...parent.childNodes]) {
        if (child.nodeType === Node.TEXT_NODE) {
          // Whitespace between blocks is formatting, not content.
          if (child.data.trim() || (started && !pendingBreak)) emit(child, target);
        } else if (child.localName === 'pre') {
          if (started) pendingBreak = true;
          emit(codeLines(child, hardenCode(child)), target);
          pendingBreak = true;
        } else if (['ol', 'ul', 'table'].includes(child.localName)) {
          // Already on its own line; a <br> before it would add a blank one.
          pendingBreak = false; started = true; target.append(child);
        } else if (blockTags.has(child.localName)) {
          if (started) pendingBreak = true;
          // Keep the paragraph's text styling on an inline wrapper; its box
          // (margins, padding, borders) is what pushed text below the marker.
          const box = /^(margin|padding|border)-|^text-indent$/;
          const kept = [...child.style].filter(property => !box.test(property));
          if (kept.length) {
            const span = document.createElement('span');
            for (const property of kept) span.style.setProperty(property, child.style.getPropertyValue(property));
            breakIfPending(target);
            target.append(span);
            visit(child, span);
          } else visit(child, target);
          if (started) pendingBreak = true;
        } else emit(child, target);
      }
    };
    visit(item, out);
    item.replaceChildren(out);
  }
  // Quill's own indentation: a class it reads straight from pasted markup.
  function indent(element, levels = 1) {
    const current = integer(/\bql-indent-(\d)\b/.exec(element.className)?.[1], 0);
    element.classList.remove(`ql-indent-${current}`);
    const next = Math.min(8, current + levels);
    if (next) element.classList.add(`ql-indent-${next}`);
  }
  // Inline content of a block child, keeping its text styling but not its box.
  function inlineOf(block) {
    const box = /^(margin|padding|border)-|^text-indent$/;
    const kept = [...block.style].filter(property => !box.test(property));
    if (!kept.length) return [...block.childNodes];
    const span = document.createElement('span');
    for (const property of kept) span.style.setProperty(property, block.style.getPropertyValue(property));
    span.append(...block.childNodes);
    return [span];
  }
  // A blockquote becomes its paragraphs, indented one level, keeping their colour.
  function unquote(quote) {
    const out = document.createDocumentFragment();
    let loose = null;
    for (const child of [...quote.childNodes]) {
      if (child.nodeType === Node.ELEMENT_NODE && (blockTags.has(child.localName) || child.localName === 'table')) {
        loose = null;
        if (child.localName !== 'table') indent(child);
        out.append(child);
      } else if (child.nodeType === Node.ELEMENT_NODE && ['ol', 'ul'].includes(child.localName)) {
        loose = null; out.append(child);
      } else {
        if (child.nodeType === Node.TEXT_NODE && !child.data.trim() && !loose) continue;
        if (!loose) { loose = document.createElement('p'); indent(loose); out.append(loose); }
        loose.append(child);
      }
    }
    for (const property of ['color', 'font-style', 'font-family', 'font-size']) {
      const value = quote.style.getPropertyValue(property);
      if (value) for (const block of out.children) if (!block.style.getPropertyValue(property)) block.style.setProperty(property, value);
    }
    quote.replaceWith(out);
  }
  // Nested lists become one flat run of items, each with Quill's indent class;
  // Quill reads a nested <ul> one level short. Blocks in an item are joined
  // onto its single line: a one-line code block follows the text, and a longer
  // one continues as indented items, because a line break inside an item
  // starts a new numbered item in Quill.
  function flatList(list) {
    const out = document.createDocumentFragment();
    let current = null;
    const push = (type, item) => {
      if (current?.localName !== type) { current = document.createElement(type); out.append(current); }
      current.append(item);
    };
    const visit = (source, depth) => {
      for (const item of [...source.children]) {
        if (item.localName !== 'li') continue;
        const line = item.cloneNode(false);
        line.removeAttribute('value');
        if (depth) indent(line, depth);
        const nested = [], extra = [];
        const add = nodes => {
          if (line.textContent.trim() && nodes.length) line.append(' ');
          line.append(...nodes);
        };
        for (const child of [...item.childNodes]) {
          if (['ul', 'ol'].includes(child.localName)) nested.push(child);
          else if (child.localName === 'pre') {
            const spans = codeLineSpans(child, hardenCode(child));
            if (spans.length === 1) add(spans);
            else extra.push(...spans);
          } else if (child.nodeType === Node.ELEMENT_NODE && blockTags.has(child.localName)) add(inlineOf(child));
          else if (child.nodeType === Node.TEXT_NODE && !child.data.trim()) { if (line.textContent.trim()) line.append(child); }
          else line.append(child);
        }
        push(source.localName, line);
        for (const span of extra) {
          const sub = document.createElement('li');
          indent(sub, depth + 1);
          sub.append(span);
          push(source.localName, sub);
        }
        for (const child of nested) visit(child, depth + 1);
      }
    };
    visit(list, 0);
    return out;
  }
  // Source markup usually has a newline after <br> ("line<br>\nnext"). A
  // browser hides whitespace at the start of a line, but editors that split
  // lines at <br> (Salesforce/Quill) keep it as a visible leading space, so the
  // second and later lines of a signature look indented. Code keeps its own.
  const collapsible = /^[ \t\n\r\f]+/;
  // Line breaks from the Markdown source survive inside text nodes. Browsers
  // render them as spaces, but Salesforce's editor treats one as a real line
  // break, cutting the paragraph and joining its tail onto the next block (a
  // following heading made the paragraph heading-sized). Whitespace is
  // collapsed the way the browser displays it; code keeps its own.
  const preserving = 'pre, [style*="white-space: pre"], [style*="white-space: break-spaces"]';
  function collapseWhitespace(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    for (const text of texts) {
      if (text.parentElement?.closest(preserving)) continue;
      text.data = text.data.replace(/[ \t\n\r\f]+/g, ' ');
    }
  }
  function trimAfterBreaks(root) {
    for (const br of root.querySelectorAll('br')) {
      if (br.closest('pre')) continue;
      let node = br.nextSibling;
      while (node) {
        // Look into an inline element that starts the line (<strong>Name</strong>).
        const text = node.nodeType === Node.TEXT_NODE ? node
          : node.nodeType === Node.ELEMENT_NODE && !blockTags.has(node.localName) && node.localName !== 'br'
            ? document.createTreeWalker(node, NodeFilter.SHOW_TEXT).nextNode() : null;
        if (!text) break;
        text.data = text.data.replace(collapsible, '');
        if (text.data) break;
        const next = text === node ? node.nextSibling : node;
        if (text === node) node.remove();
        else text.remove();
        node = next;
      }
    }
  }
  // A list holding a code block cannot stay a list in Salesforce: code in
  // an item is hoisted out, a line break in an item starts a new numbered
  // item, and a list interrupted by a code block restarts at 1 because the
  // start number is dropped. So the list is written as paragraphs with its
  // numbers and bullets typed in, indented by level, and each code block as a
  // boxed table beneath its item.
  // Shared canvas for measuring text widths (table column minimums).
  let ruler = null;
  function literalList(list) {
    const out = document.createDocumentFragment();
    const bullets = ['•', '◦', '▪'];
    // Indentation is Quill's own ql-indent-N class: Quill keeps it on
    // paragraphs and code blocks, and both Salesforce's saved view (39px per
    // level) and the Customer Portal (3em) style it. Unlike leading spaces it
    // indents every wrapped line, not just the first.
    const indent = (element, level) => { if (level > 0) element.classList.add(`ql-indent-${Math.min(8, level)}`); };
    const visit = (source, depth) => {
      const ordered = source.localName === 'ol';
      const count = source.querySelectorAll(':scope > li').length;
      let number = source.hasAttribute('start') ? integer(source.getAttribute('start'), 1)
        : source.hasAttribute('reversed') ? count : 1;
      for (const item of [...source.children]) {
        if (item.localName !== 'li') continue;
        if (item.hasAttribute('value')) number = integer(item.getAttribute('value'), number);
        const marker = ordered ? `${number}.` : bullets[Math.min(depth, bullets.length - 1)];
        number += source.hasAttribute('reversed') ? -1 : 1;
        let line = null, empty = true, markerLine = false;
        const open = first => {
          markerLine = first;
          line = document.createElement('p');
          // Lines of a typed-out list stay together, like list items.
          line.dataset.boksaTight = '';
          for (const property of item.style) {
            if (!/^(margin|padding|border)-|^list-style|^text-indent$/.test(property)) line.style.setProperty(property, item.style.getPropertyValue(property));
          }
          // Continuation lines and code sit one level in, under the item.
          indent(line, first ? depth : depth + 1);
          if (first) line.append(`${marker}\u00a0`);
          empty = true;
        };
        // The marker line is kept even when the item is only a code block.
        const flush = () => { if (line && (markerLine || !empty)) out.append(line); line = null; };
        const add = nodes => {
          if (!line) open(false);
          if (!empty && nodes.length) line.append(' ');
          line.append(...nodes);
          if (nodes.some(node => node.textContent.trim())) empty = false;
        };
        open(true);
        let leading = true;
        for (const child of [...item.childNodes]) {
          if (['ul', 'ol'].includes(child.localName)) {
            flush(); visit(child, depth + 1);
          } else if (child.localName === 'pre') {
            flush();
            const code = quillCode(child);
            indent(code, depth + 1);
            out.append(code);
          } else if (child.nodeType === Node.ELEMENT_NODE && blockTags.has(child.localName)) {
            // Each paragraph of the item starts its own line under the text.
            if (line && !empty) flush();
            add(inlineOf(child));
          } else if (child.nodeType === Node.TEXT_NODE && !child.data.trim()) {
            if (line && !leading && !empty) line.append(child);
          } else {
            if (!line) open(false);
            if (empty && child.nodeType === Node.TEXT_NODE) child.data = child.data.replace(/^[ \t\n\r\f]+/, '');
            line.append(child); empty = false;
          }
          leading = false;
        }
        flush();
      }
    };
    visit(list, 0);
    return out;
  }
  // Salesforce darkens every colour it stores (background, text, border
  // longhands alike) until it has 4.5:1 contrast against white, keeping hue
  // and saturation: a pale code box is saved as mid blue, light text on a dark
  // box as dark-on-dark. Only colours inside border shorthands escape. So no
  // background can survive: code blocks become light bordered boxes, other
  // backgrounds are dropped, text colours are darkened here exactly as
  // Salesforce would, and borders are written as per-side shorthands.
  // Salesforce turns every <br> into a new paragraph, so a signature written
  // as "line<br>line<br>line" gains full paragraph spacing between its lines.
  // A table cell is stored verbatim and keeps its <br>s, so such a paragraph
  // goes into a borderless one-cell table that looks like the paragraph.
  function lineTable(paragraph) {
    // A trailing break ("…Pacific</br>") would add an empty last line.
    while (paragraph.lastChild && (paragraph.lastChild.localName === 'br' ||
      (paragraph.lastChild.nodeType === Node.TEXT_NODE && !paragraph.lastChild.data.trim()))) paragraph.lastChild.remove();
    const table = document.createElement('table');
    table.style.borderCollapse = 'collapse';
    for (const property of ['margin-top', 'margin-bottom']) {
      const value = paragraph.style.getPropertyValue(property);
      if (value) table.style.setProperty(property, value);
    }
    const cell = table.appendChild(document.createElement('tbody')).appendChild(document.createElement('tr'))
      .appendChild(document.createElement('td'));
    for (const property of paragraph.style) {
      if (!/^(margin|padding|border)-|^text-indent$/.test(property)) cell.style.setProperty(property, paragraph.style.getPropertyValue(property));
    }
    cell.style.padding = '0';
    cell.append(...paragraph.childNodes);
    return table;
  }
  // Data tables (not Boksa's own code boxes and rules). Viewers often draw
  // the outer frame on a container around the table, which Salesforce drops,
  // so the frame moves onto the table. The table keeps the full width it had
  // on screen, and words are not broken inside cells (a narrow column split
  // "123456" across two lines).
  function dataTables(root) {
    for (const table of [...root.querySelectorAll('table')]) {
      if (table.querySelector('[data-boksa-code]') || table.querySelectorAll('td, th').length < 2) continue;
      const box = table.parentElement;
      if (box && box !== root && box.localName === 'div' && box.children.length === 1) {
        for (const side of sides) for (const part of ['width', 'style', 'color']) {
          const property = `border-${side}-${part}`;
          const value = box.style.getPropertyValue(property);
          if (value && !table.style.getPropertyValue(property)) table.style.setProperty(property, value);
        }
        for (const property of ['margin-top', 'margin-bottom']) {
          const value = box.style.getPropertyValue(property);
          if (value && !(parseFloat(table.style.getPropertyValue(property)) > 0)) table.style.setProperty(property, value);
        }
        box.replaceWith(table);
      }
      table.style.width = '100%';
      for (const element of table.querySelectorAll('*')) {
        for (const property of ['word-break', 'overflow-wrap']) element.style.removeProperty(property);
      }
      // Column widths from the first row, as percentages of the table. The
      // on-screen shares come from a wider page than Salesforce's comment
      // area, so each column is raised to fit its widest word in a table of
      // a conservative width, and the room comes from the wider columns.
      const firstRow = table.querySelector('tr');
      const head = firstRow ? [...firstRow.children] : [];
      if (head.length && head.every(cell => (cell.getAttribute('colspan') ?? '1') === '1' && parseFloat(cell.dataset.boksaWidth) > 0)) {
        const assumedWidth = 720;
        const needed = head.map(() => 0);
        for (const row of table.querySelectorAll('tr')) {
          const cells = [...row.children];
          if (cells.length !== head.length) continue;
          cells.forEach((cell, index) => { needed[index] = Math.max(needed[index], parseFloat(cell.dataset.boksaMin) || 0); });
        }
        const floor = needed.map(px => Math.min(60, px / assumedWidth * 100));
        let shares = head.map((cell, index) => Math.max(parseFloat(cell.dataset.boksaWidth), floor[index]));
        // Take the excess back from columns above their floor, in proportion.
        const excess = shares.reduce((sum, share) => sum + share, 0) - 100;
        if (excess > 0) {
          const slack = shares.map((share, index) => share - floor[index]);
          const totalSlack = slack.reduce((sum, value) => sum + value, 0);
          if (totalSlack > 0) shares = shares.map((share, index) => share - excess * slack[index] / totalSlack);
        }
        head.forEach((cell, index) => { cell.style.width = `${Math.round(shares[index] * 10) / 10}%`; });
      }
      // Without a frame of its own the table gets Salesforce's black default;
      // it takes the colour of its inner lines instead.
      if (!sides.some(side => parseFloat(table.style.getPropertyValue(`border-${side}-width`)) > 0)) {
        const sample = table.querySelector('td, th');
        const color = sample && sides.map(side => sample.style.getPropertyValue(`border-${side}-color`)).find(Boolean) || 'rgb(208, 215, 222)';
        for (const side of sides) {
          table.style.setProperty(`border-${side}-width`, '1px');
          table.style.setProperty(`border-${side}-style`, 'solid');
          table.style.setProperty(`border-${side}-color`, color);
        }
      }
    }
  }
  // Text sitting directly beside blocks, outside any paragraph, is merged by
  // Salesforce into the next block: before a heading it became heading-sized.
  // Each run of such inline content gets a paragraph of its own.
  const blockLevel = new Set([...blockTags, 'table', 'ol', 'ul', 'li', 'pre', 'hr']);
  function wrapLooseText(root) {
    const containers = [root, ...root.querySelectorAll('div, blockquote, li')].filter(container => !container.closest('td, th, p'));
    for (const container of containers) {
      const children = [...container.childNodes];
      if (!children.some(child => child.nodeType === Node.ELEMENT_NODE && blockLevel.has(child.localName))) continue;
      let run = [];
      const flush = () => {
        if (run.some(node => node.textContent.trim() || node.localName === 'img')) {
          const paragraph = document.createElement('p');
          run[0].before(paragraph);
          paragraph.append(...run);
          const first = paragraph.firstChild;
          if (first?.nodeType === Node.TEXT_NODE) first.data = first.data.replace(/^[ \t\n\r\f]+/, '');
        }
        run = [];
      };
      for (const child of children) {
        if (child.nodeType === Node.ELEMENT_NODE && blockLevel.has(child.localName)) flush();
        else run.push(child);
      }
      flush();
    }
  }
  // Tables Boksa made itself become paragraphs for the portal target, which
  // draws a 1px frame around every cell: a rule becomes a row of
  // box-drawing characters and a code box one Courier paragraph per line
  // (indented as its box was). Data tables stay real tables; the portal
  // draws them with its own frame and header shading, Salesforce with the
  // borders written on them. Inner tables go first, so a code box inside a
  // data table cell is unboxed too.
  function untable(root) {
    for (const table of [...root.querySelectorAll('table')].reverse()) {
      const cells = [...table.querySelectorAll('td, th')];
      const out = document.createDocumentFragment();
      const code = table.querySelector('[data-boksa-code]');
      const rule = cells.length === 1 && !cells[0].textContent.trim() && parseFloat(cells[0].style.borderTopWidth) > 0;
      if (rule) {
        const line = document.createElement('p');
        line.style.color = cells[0].style.borderTopColor || 'rgb(208, 215, 222)';
        line.textContent = '\u2500'.repeat(32);
        out.append(line);
      } else if (code) {
        const spacer = code.previousElementSibling;
        const indentEm = spacer ? parseFloat(spacer.style.width) || 0 : 0;
        // A non-breaking space is about 0.28em in the body font.
        const indent = '\u00a0'.repeat(Math.round(indentEm / 0.28));
        const range = document.createRange();
        range.setStart(code, 0);
        const lines = [];
        for (const br of code.querySelectorAll('br')) { range.setEndBefore(br); lines.push(range.cloneContents()); range.setStartAfter(br); }
        range.setEnd(code, code.childNodes.length); lines.push(range.cloneContents());
        for (const content of lines) {
          const line = document.createElement('p');
          if (indent) line.append(indent);
          const span = document.createElement('span');
          for (const property of ['font-family', 'font-size', 'color']) {
            const value = code.style.getPropertyValue(property);
            if (value) span.style.setProperty(property, value);
          }
          if (!content.textContent) content.append('\u00a0');
          span.append(content);
          line.append(span);
          out.append(line);
        }
      } else {
        continue;
      }
      table.replaceWith(out);
    }
  }
  // Two tables back to back (a table, then a rule written as a table) make
  // Salesforce move the second one to the end of the comment. An empty line
  // between them keeps both in place.
  function separateTables(root) {
    for (const table of [...root.querySelectorAll('table')]) {
      if (table.parentElement?.closest('table')) continue;
      let before = table.previousSibling;
      while (before?.nodeType === Node.TEXT_NODE && !before.data.trim()) before = before.previousSibling;
      if (before?.nodeType !== Node.ELEMENT_NODE || before.localName !== 'table') continue;
      const spacer = document.createElement('p');
      spacer.append(document.createElement('br'));
      table.before(spacer);
      // The empty line already provides the gap above.
      table.style.removeProperty('margin-top');
    }
  }
  // Salesforce's editor keeps a pasted quote as a <blockquote> of paragraphs
  // with class ql-quote-block, and both sides draw it: Salesforce with a grey
  // bar and box, the portal indented. Only paragraphs survive inside it (a
  // list falls out of the quote), so a quote holding lists, code, tables or
  // headings becomes indented paragraphs instead, as does one inside a list
  // item or table cell, and a quote inside a quote joins its parent.
  function portalQuote(quote) {
    if (quote.parentElement?.closest('blockquote')) { quote.replaceWith(...quote.childNodes); return; }
    if (quote.closest('li, td, th') || quote.querySelector('ol, ul, pre, table, hr, h1, h2, h3, h4, h5, h6')) { unquote(quote); return; }
    const out = document.createElement('blockquote');
    const line = () => { const p = document.createElement('p'); p.className = 'ql-quote-block'; out.append(p); return p; };
    let loose = null;
    for (const child of [...quote.childNodes]) {
      if (child.nodeType === Node.ELEMENT_NODE && blockTags.has(child.localName)) {
        loose = null;
        if (child.textContent.trim() || child.querySelector('img')) line().append(...inlineOf(child));
      } else {
        if (child.nodeType === Node.TEXT_NODE && !child.data.trim() && !loose) continue;
        (loose ??= line()).append(child);
      }
    }
    if (out.children.length) quote.replaceWith(out);
    else quote.remove();
  }
  // The portal draws paragraphs with no space between them, so blocks run
  // together. Quill writes a blank line as an empty paragraph, so one goes
  // between neighbouring blocks, except between lines that belong together
  // (the lines of a typed-out list, the fields of a converted table).
  const spacedBlocks = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'ol', 'ul', 'table', 'blockquote']);
  function spaceBlocks(root) {
    const blank = () => { const p = document.createElement('p'); p.append(document.createElement('br')); return p; };
    for (const block of [...root.querySelectorAll([...spacedBlocks].join(', '))]) {
      if (block.parentElement?.closest('li, ol, ul, blockquote, table')) continue;
      const before = block.previousElementSibling;
      if (!before || !spacedBlocks.has(before.localName)) continue;
      if (before.hasAttribute('data-boksa-tight') && block.hasAttribute('data-boksa-tight') && !block.hasAttribute('data-boksa-break')) continue;
      // Headings bring their own space above and below in the portal, and
      // lists, tables and quotes their own space below (measured on the
      // portal: h2/h3 10px below, ol/ul 16px, table 16px, blockquote 20px,
      // paragraphs none).
      if (/^h[1-6]$/.test(block.localName) || /^h[1-6]$/.test(before.localName)) continue;
      if (['ol', 'ul', 'table', 'blockquote'].includes(before.localName)) continue;
      if (!before.textContent.trim() && before.querySelector('br')) continue;
      block.before(blank());
    }
  }
  // The Customer Portal sets body text at 17.92px but h3 at 18px and h4 at
  // 16px (h1 24px, h2 21px), so a #### heading is smaller than the text under
  // it. Headings move up one level (h4 and deeper all become h3) and are
  // bold, so every heading stays larger and heavier than body text.
  function portalHeadings(root) {
    for (const heading of [...root.querySelectorAll('h1, h2, h3, h4, h5, h6')]) {
      const level = Number(heading.localName[1]);
      const promoted = document.createElement(`h${Math.max(1, Math.min(3, level - 1))}`);
      for (const name of heading.getAttributeNames()) promoted.setAttribute(name, heading.getAttribute(name));
      const bold = document.createElement('strong');
      bold.append(...heading.childNodes);
      promoted.append(bold);
      heading.replaceWith(promoted);
    }
  }
  // The portal prints any tag outside its allowlist as text (read from its
  // comment view, 2026-11): p br strong em u s ul ol li a img h1-h6 span pre
  // code blockquote sub sup div b i hr and the table elements. Everything
  // else becomes a <span> with the same style; kbd and samp become <code>,
  // which the portal sets in Consolas on grey.
  const portalSafe = new Set(['p', 'br', 'span', 'strong', 'b', 'em', 'i', 'u', 'a', 'ol', 'ul', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'div', 'pre', 'code', 'blockquote',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col']);
  function portalTags(root) {
    strikeText(root);
    for (const element of [...root.querySelectorAll('*')].reverse()) {
      if (portalSafe.has(element.localName)) continue;
      const span = document.createElement(['kbd', 'samp'].includes(element.localName) ? 'code' : 'span');
      if (element.hasAttribute('style')) span.setAttribute('style', element.getAttribute('style'));
      span.append(...element.childNodes);
      element.replaceWith(span);
    }
  }
  // Salesforce's editor turns every strikethrough (<s>, <del>, a
  // line-through style) into <strike>, which the portal prints as text. The
  // stroke goes into the text instead, as U+0336 after each character, and
  // the element keeps no strikethrough of its own.
  function strikeText(root) {
    const texts = new Set();
    for (const element of [...root.querySelectorAll('*')]) {
      const tag = ['s', 'strike', 'del'].includes(element.localName);
      const styled = /line-through/.test(element.style.textDecorationLine);
      if (!tag && !styled) continue;
      if (styled) {
        const rest = element.style.textDecorationLine.replace('line-through', '').trim();
        if (rest && rest !== 'none') element.style.textDecorationLine = rest;
        else for (const property of ['text-decoration-line', 'text-decoration-color', 'text-decoration-style', 'text-decoration-thickness']) element.style.removeProperty(property);
      }
      if (tag) {
        const span = document.createElement('span');
        if (element.hasAttribute('style')) span.setAttribute('style', element.getAttribute('style'));
        span.append(...element.childNodes);
        element.replaceWith(span);
        if (span.closest('pre')) continue;
        const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) texts.add(node);
      } else if (!element.closest('pre')) {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) texts.add(node);
      }
    }
    for (const node of texts) node.data = node.data.replace(/[^\n\u0336]/gu, '$&\u0336');
  }
  // Salesforce's font menu has one fixed-width face, Courier, and its editor
  // keeps font-family: courier as its own format. Inline code matches the
  // editor's standard 13px text; code blocks sit one step smaller.
  // With syntax highlighting off, code blocks are green; at about 5:1
  // against white Salesforce keeps it.
  const salesforceCode = {family: 'courier', size: '13px', blockSize: '12px', blockColor: 'rgb(26, 127, 55)',
    inlineColor: 'rgb(79, 110, 206)'};
  function salesforceFonts(root) {
    for (const cell of root.querySelectorAll('[data-boksa-code]')) {
      cell.style.fontFamily = salesforceCode.family;
      cell.style.fontSize = salesforceCode.blockSize;
      const plain = !options.highlight;
      if (plain) cell.style.color = salesforceCode.blockColor;
      for (const inner of cell.querySelectorAll('*')) {
        for (const property of plain ? ['font-family', 'font-size', 'color', 'text-decoration-color'] : ['font-family', 'font-size']) {
          inner.style.removeProperty(property);
        }
      }
    }
    for (const code of root.querySelectorAll('code, kbd, samp')) {
      if (code.closest('[data-boksa-code]')) continue;
      code.style.fontFamily = salesforceCode.family;
      code.style.fontSize = salesforceCode.size;
      // Its background cannot survive, so inline code drawn in the body text
      // colour would be marked by Courier alone; it gets the code blue.
      if (!code.style.color) code.style.color = salesforceCode.inlineColor;
    }
  }
  function salesforceColors(root) {
    for (const element of [root, ...root.querySelectorAll('*')]) {
      const style = element.style;
      const code = element.hasAttribute('data-boksa-code');
      element.removeAttribute('data-boksa-code');
      const borders = sides.map(side => {
        const width = parseFloat(style.getPropertyValue(`border-${side}-width`)) || 0;
        const kind = style.getPropertyValue(`border-${side}-style`);
        const color = style.getPropertyValue(`border-${side}-color`);
        return width > 0 && kind && kind !== 'none' && kind !== 'hidden' ? `${width}px ${kind} ${color || 'rgb(208, 215, 222)'}` : null;
      });
      for (const side of sides) for (const part of ['width', 'style', 'color']) style.removeProperty(`border-${side}-${part}`);
      if (code) style.setProperty('padding', '8px 12px');
      // Rounded corners are not attempted: saved comments showed Salesforce
      // strips border-radius from cells, <code> and tables alike.
      style.removeProperty('background-color');
      for (const property of ['color', 'text-decoration-color']) {
        const color = rgba(style.getPropertyValue(property));
        // 4.7 rather than 4.5: Salesforce stopped between 4.56 and 4.70 in
        // saved comments, so a colour at exactly 4.5 could still be changed.
        if (color) style.setProperty(property, css(darkenFor(color, 4.7)));
      }
      // Written into the attribute text last: through CSSOM, four set sides
      // serialise as border-width/-style/-color, the form Salesforce darkens.
      const edges = code ? sides.map(side => `border-${side}: 1px solid rgb(208, 215, 222);`)
        : sides.map((side, index) => borders[index] && `border-${side}: ${borders[index]};`).filter(Boolean);
      if (edges.length) element.setAttribute('style', `${style.cssText} ${edges.join(' ')}`.trim());
    }
  }
  // Some viewers make text bold or italic with a style (font-weight: 600 on a
  // span) instead of <strong>/<em>. Editors such as Salesforce's only treat
  // weight 700 or the tags as bold, so styled emphasis becomes real tags.
  const emphasisTags = new Set(['strong', 'b', 'em', 'i', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th']);
  function semanticEmphasis(root) {
    // On the tags themselves a weight like 600 can read as "not bold" to an
    // editor that checks the style, so the tag alone carries the emphasis.
    for (const tag of root.querySelectorAll('strong, b')) tag.style.removeProperty('font-weight');
    for (const tag of root.querySelectorAll('em, i')) tag.style.removeProperty('font-style');
    for (const element of [...root.querySelectorAll('*')]) {
      if (emphasisTags.has(element.localName) || element.closest('pre, [data-boksa-code]')) continue;
      const weight = element.style.fontWeight;
      const bold = weight === 'bold' || weight === 'bolder' || Number(weight) >= 600;
      const italic = /italic|oblique/.test(element.style.fontStyle);
      if (!bold && !italic || !element.firstChild) continue;
      let inner = element;
      for (const [on, tag, property] of [[bold, 'strong', 'font-weight'], [italic, 'em', 'font-style']]) {
        if (!on) continue;
        const wrap = document.createElement(tag);
        wrap.append(...inner.childNodes);
        inner.append(wrap);
        inner = wrap;
        element.style.removeProperty(property);
      }
    }
  }
  function rootFor(range) {
    let root = range.commonAncestorContainer;
    // A shadow root or the document node has no parentElement.
    if (root.nodeType !== Node.ELEMENT_NODE) root = root.parentElement || root.host || document.body;
    if (!root) throw new Error(t('errNothingCopyable', 'The selection contains nothing that can be copied.'));
    while (root.parentElement && ['inline', 'contents'].includes(getComputedStyle(root).display)) root = root.parentElement;
    // Keep required list/table/code ancestors even when selection is inside one text node.
    for (let parent = root.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      if (['OL', 'UL', 'DL', 'TABLE', 'PRE', 'BLOCKQUOTE'].includes(parent.tagName)) root = parent;
    }
    return root;
  }
  function canvasColor(root) {
    const scheme = getComputedStyle(document.documentElement).colorScheme || '';
    if (/\bdark\b/.test(scheme) && !/\blight\b/.test(scheme)) return '#1e1e1e';
    // Light text with no opaque ancestor background means a dark page; a white
    // canvas would paste the text invisibly.
    const text = rgba(getComputedStyle(root).color);
    if (text && text.a > 0 && luminance(text) > 0.6) return '#1e1e1e';
    return 'white';
  }
  function surface(root, wrapper) {
    // Preserve ancestor background layers without carrying ancestor layout.
    const ancestors = [];
    for (let el = root.parentElement; el; el = el.parentElement) ancestors.unshift(el);
    let container = wrapper;
    // With backgrounds reduced the paste should sit on the editor's own canvas.
    if (options.backgrounds !== 'all') return wrapper;
    wrapper.style.backgroundColor = css(canvasFor(root));
    for (const ancestor of ancestors) {
      const color = rgba(getComputedStyle(ancestor).backgroundColor);
      if (!color || color.a === 0) continue;
      const layer = document.createElement('div'); layer.style.backgroundColor = css(surfaceOf(ancestor));
      container.append(layer); container = layer;
    }
    return container;
  }
  async function writeClipboard(html, text) {
    // ClipboardEvent works on file/http pages where Async Clipboard may be unavailable.
    let handled = false;
    const listener = event => {
      if (!event.clipboardData) return;
      event.clipboardData.setData('text/html', html);
      event.clipboardData.setData('text/plain', text);
      event.preventDefault(); event.stopImmediatePropagation(); handled = true;
    };
    window.addEventListener('copy', listener, true);
    try {
      if (document.execCommand('copy') && handled) return;
    } catch { /* Try the modern API below. */ }
    finally { window.removeEventListener('copy', listener, true); }
    if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], {type: 'text/html'}),
        'text/plain': new Blob([text], {type: 'text/plain'})
      })]);
      return;
    }
    throw new Error(t('errClipboard', 'Could not write to the clipboard. Focus the page and try the shortcut again.'));
  }
  // With nothing selected the whole page is copied. The page selection is
  // borrowed for that (Selection.toString gives the rendered plain text) and
  // the caret is put back afterwards.
  let restoreSelection = null;
  try {
    const selection = window.getSelection();
    if (!selection) throw new Error(t('errNothingCopyable', 'The selection contains nothing that can be copied.'));
    if (selection.isCollapsed || !selection.rangeCount) {
      const caret = selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
      restoreSelection = () => { selection.removeAllRanges(); if (caret) selection.addRange(caret); };
      selection.selectAllChildren(document.body);
    }
    const text = selection.toString();
    const wrapper = document.createElement('div');
    for (let index = 0; index < selection.rangeCount; index++) {
      const range = selection.getRangeAt(index).cloneRange();
      const root = rootFor(range);
      const fragment = cloneSelected(root, range, null);
      if (fragment) surface(root, wrapper).append(fragment);
    }
    if (!wrapper.childNodes.length) throw new Error(t('errNothingCopyable', 'The selection contains nothing that can be copied.'));
    collapseWhitespace(wrapper);
    trimAfterBreaks(wrapper);
    semanticEmphasis(wrapper);
    const stripMarkers = () => {
      for (const marked of wrapper.querySelectorAll('[data-boksa-code], [data-boksa-width], [data-boksa-min], [data-boksa-tight], [data-boksa-break]')) {
        for (const name of ['data-boksa-code', 'data-boksa-width', 'data-boksa-min', 'data-boksa-tight', 'data-boksa-break']) marked.removeAttribute(name);
      }
    };
    if (salesforce) {
      // Viewers wrap code blocks in containers (a language label and a copy
      // button around the <pre>). Unwrapped, the <pre> is a direct child of
      // its list item or of the page and is laid out like any other block.
      for (const pre of [...wrapper.querySelectorAll('pre')]) {
        for (let box = pre.parentElement; box && box !== wrapper && box.localName === 'div' && !box.closest('td, th'); box = pre.parentElement) {
          // The container often holds the block's spacing; it moves to the code.
          for (const property of ['margin-top', 'margin-bottom']) {
            const value = box.style.getPropertyValue(property);
            if (value && !(parseFloat(pre.style.getPropertyValue(property)) > 0)) pre.style.setProperty(property, value);
          }
          box.replaceWith(...box.childNodes);
        }
      }
      for (const quote of [...wrapper.querySelectorAll('blockquote')].reverse()) (portal ? portalQuote : unquote)(quote);
      // A code block left unindented in Markdown ends up after the list
      // rather than inside its item. Moved into the last item, it is laid out
      // beneath that item's text like an indented one.
      for (const pre of [...wrapper.querySelectorAll('pre')]) {
        if (pre.closest('li')) continue;
        const list = pre.previousElementSibling;
        if (!list || !['ol', 'ul'].includes(list.localName)) continue;
        const item = [...list.children].filter(child => child.localName === 'li').pop();
        if (item) item.append(pre);
      }
      for (const list of [...wrapper.querySelectorAll('ol, ul')].filter(list => !list.parentElement?.closest('li'))) {
        // Any code block, even one line: Salesforce strips the monospace
        // font on save, so code joined onto an item's line reads as prose.
        // Nested lists too: the saved view does not reliably indent them, so
        // a numbered list under a bullet lines up with the bullets.
        // And a numbered list that does not start at 1 (a list resumed after
        // an unindented code block, or a partial copy): Salesforce drops
        // start numbers, so it would restart at 1.
        const resumes = [list, ...list.querySelectorAll('ol')].some(ol => ol.localName === 'ol' &&
          ((ol.hasAttribute('start') && integer(ol.getAttribute('start'), 1) !== 1) || ol.hasAttribute('reversed')));
        const literal = resumes || !!list.querySelector('pre, li ul, li ol');
        list.replaceWith(literal ? literalList(list) : flatList(list));
      }
      for (const pre of [...wrapper.querySelectorAll('pre:not(.ql-syntax)')]) pre.replaceWith(quillCode(pre));
      for (const paragraph of portal ? [] : [...wrapper.querySelectorAll('p')]) {
        if (paragraph.closest('li, td, th') || ![...paragraph.children].some(child => child.localName === 'br')) continue;
        const table = lineTable(paragraph);
        // Only one line left once the trailing break is gone: a plain paragraph.
        if (table.querySelector('br')) paragraph.replaceWith(table);
        else paragraph.append(...table.querySelector('td').childNodes);
      }
      if (!portal) separateTables(wrapper);
      dataTables(wrapper);
      wrapLooseText(wrapper);
      salesforceFonts(wrapper);
      if (portal) { untable(wrapper); separateTables(wrapper); portalTags(wrapper); portalHeadings(wrapper); spaceBlocks(wrapper); }
      salesforceColors(wrapper);
    } else if (options.codeBlocks === 'robust') {
      const pres = [...wrapper.querySelectorAll('pre')];
      // flattenItem never descends into a nested list, so each item only
      // rewrites its own code and the order of items does not matter.
      for (const item of new Set(pres.map(pre => pre.closest('li')).filter(Boolean))) flattenItem(item);
      // Code the flattening consumed is no longer in the wrapper.
      for (const pre of pres) if (wrapper.contains(pre)) pre.replaceWith(codeTable(pre, hardenCode(pre)));
    }
    stripMarkers();
    await writeClipboard(wrapper.outerHTML, text);
    toast(t('toastDone', 'Copied with styles — paste into your editor'));
    return {ok: true};
  } catch (error) {
    toast(error.message, true);
    return {ok: false, error: error.message};
  } finally {
    restoreSelection?.();
    baselineFrame?.remove();
  }
})();
