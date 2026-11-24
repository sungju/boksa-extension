// Run: npm install --no-save playwright && node tests/run.cjs
const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
// Mirrors the extension, which injects color.js ahead of copy.js.
const code = ['color.js', 'copy.js'].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
let passed = 0;

// A missing translation or a mistyped icon path is invisible until the Web Store
// rejects the upload, so both are checked structurally before anything renders.
function checkPackaging() {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const locales = Object.fromEntries(fs.readdirSync(path.join(root, '_locales')).map(tag =>
    [tag, JSON.parse(fs.readFileSync(path.join(root, '_locales', tag, 'messages.json'), 'utf8'))]));

  assert(locales[manifest.default_locale], `default_locale "${manifest.default_locale}" has no catalogue`);
  for (const tag of ['en', 'ko']) assert(locales[tag], `missing the ${tag} catalogue`);

  // Every key must exist in every locale, or Chrome silently renders an empty
  // string for whichever language is short.
  const [reference, ...others] = Object.keys(locales);
  for (const tag of others) {
    assert.deepEqual(Object.keys(locales[tag]).sort(), Object.keys(locales[reference]).sort(),
      `${tag} and ${reference} do not define the same keys`);
  }

  const used = new Set();
  for (const match of JSON.stringify(manifest).matchAll(/__MSG_([A-Za-z0-9_]+)__/g)) used.add(match[1]);
  for (const file of ['copy.js', 'background.js', 'options.js']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    // Matches t('key') and t('key', fallback) without catching setTimeout( etc.
    for (const match of source.matchAll(/(?:^|[^\w.])t\(\s*'([A-Za-z0-9_]+)'/g)) used.add(match[1]);
  }
  // The options page names its strings in markup and options.js fills them in.
  const optionsPage = fs.readFileSync(path.join(root, 'options.html'), 'utf8');
  for (const match of optionsPage.matchAll(/data-i18n="([A-Za-z0-9_]+)"/g)) used.add(match[1]);
  assert(used.size > 0, 'found no message keys at all — the scan is broken');
  for (const key of used) for (const [tag, catalogue] of Object.entries(locales)) {
    assert(catalogue[key], `message "${key}" is used but missing from _locales/${tag}`);
  }
  for (const [tag, catalogue] of Object.entries(locales)) for (const key of Object.keys(catalogue)) {
    assert(used.has(key), `message "${key}" in _locales/${tag} is never used`);
  }

  const icons = [...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon)];
  for (const file of new Set(icons)) {
    assert(fs.existsSync(path.join(root, file)), `manifest declares ${file} but it does not exist`);
  }
  assert.deepEqual(Object.keys(manifest.icons).sort(), ['128', '16', '32', '48'],
    'the Web Store expects 16/32/48/128 icons');
  // An icon whose real dimensions differ from its declared key is rejected on
  // upload, and regenerating the artwork is exactly when that could slip in.
  for (const [size, file] of Object.entries(manifest.icons)) {
    const bytes = fs.readFileSync(path.join(root, file));
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG', `${file} is not a PNG`);
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
    assert(width === Number(size) && height === Number(size),
      `${file} is ${width}x${height} but the manifest declares it as ${size}`);
  }

  console.log('PASS locale catalogues and icon assets are complete'); passed++;

  // An empty storage means "defaults" on both sides, so the two copies of the
  // defaults must agree or the options page would show a choice not in effect.
  const defaultsIn = file => JSON.parse(/const defaults = (\{[^}]+\})/.exec(
    fs.readFileSync(path.join(root, file), 'utf8'))[1].replace(/(\w+):/g, '"$1":').replace(/'/g, '"'));
  assert.deepEqual(defaultsIn('options.js'), defaultsIn('copy.js'), 'options.js and copy.js disagree on defaults');
  assert(manifest.permissions.includes('storage') && manifest.options_ui?.page === 'options.html',
    'the options page needs storage and an options_ui entry');
  console.log('PASS option defaults agree and the options page is declared'); passed++;

  // The policy exists twice: as repo documentation and as the page hosted at the
  // URL the Web Store listing points at. Revising one and forgetting the other
  // would publish a stale policy, so the effective dates are pinned together.
  const policy = fs.readFileSync(path.join(root, 'PRIVACY.md'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'store', 'privacy.html'), 'utf8');
  for (const [label, pattern] of [['English', /\*\*Effective date:\*\* (.+)/], ['Korean', /\*\*시행일:\*\* (.+)/]]) {
    const stamp = pattern.exec(policy)?.[1].trim();
    assert(stamp, `PRIVACY.md is missing its ${label} effective date`);
    assert(page.includes(stamp), `store/privacy.html does not carry the ${label} effective date "${stamp}" from PRIVACY.md`);
  }
  console.log('PASS privacy policy copies agree on their effective date'); passed++;
}

// Install the clipboard mock, then run copy.js and collect both flavours.
const mock = () => {
  document.execCommand = () => {
    const data = new DataTransfer();
    window.dispatchEvent(new ClipboardEvent('copy', {clipboardData: data, cancelable: true}));
    window.payload = {html: data.getData('text/html'), text: data.getData('text/plain')};
    return true;
  };
};
// Selection.toString() is rendering-aware and inserts separators between table
// cells that textContent omits, so compare the visible characters alone.
const collapse = value => value.replace(/\s+/gu, '').replace(/[\u2611\u2610]/g, '');

(async () => {
  checkPackaging();
  const browser = await chromium.launch({channel: 'chrome', headless: true});
  const page = await browser.newPage();

  async function run() {
    await page.evaluate(mock);
    const started = Date.now();
    const outcome = await page.evaluate(code);
    const elapsed = Date.now() - started;
    const payload = await page.evaluate(() => window.payload || {});
    return {...outcome, ...payload, elapsed};
  }
  // Select #target (or the given selector) and copy it.
  async function copySelection(selector = '#target', offsets) {
    await page.evaluate(({selector, offsets}) => {
      const el = document.querySelector(selector), r = document.createRange();
      if (offsets) { r.setStart(el.firstChild, offsets[0]); r.setEnd(el.firstChild, offsets[1]); }
      else r.selectNodeContents(el);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      window.expectedText = s.toString();
    }, {selector, offsets});
    return run();
  }
  async function scenario(name, html, verify, selector) {
    await page.setContent(`<!doctype html><html lang="en"><meta charset="utf-8">${html}`);
    const result = await copySelection(selector);
    await verify(result);
    console.log('PASS', name); passed++;
  }
  // Parse copied HTML in a template so assertions can query it as a tree.
  const inspect = (html, fn) => page.evaluate(([html, source]) => {
    const t = document.createElement('template'); t.innerHTML = html;
    return new Function('root', source)(t.content);
  }, [html, fn]);

  // ---------------------------------------------------------------- fixture suite
  await page.goto('file://' + path.join(root, 'tests', 'fixture.html'));
  async function check(name, selector, verify, offsets) {
    const result = await copySelection(selector, offsets);
    assert.equal(result.ok, true);
    const expected = await page.evaluate(() => window.expectedText);
    assert.equal(result.text, expected);
    assert.equal(await page.evaluate(() => getSelection().toString()), expected);
    assert(!/(?:[;"\s])(?:position|width|height|display|overflow)\s*:/.test(result.html));
    // Divergence between the HTML and plain-text flavours is the signature of
    // content smuggled past the user's view; they must carry the same words.
    const htmlText = await inspect(result.html, 'return root.textContent');
    assert.equal(collapse(htmlText), collapse(expected), `flavour mismatch in "${name}"`);
    result.styles = await inspect(result.html, `return {
      quoteBorder: root.querySelector('blockquote')?.style.borderLeftWidth,
      cellBorder: root.querySelector('td')?.style.borderTopWidth
    }`);
    await verify(result); console.log('PASS', name); passed++;
  }

  await check('partial text keeps heading and computed style', '#heading', r => {
    assert(r.html.includes('<h2')); assert(r.html.includes('font-size: 26px')); assert.equal(r.text, 'Markdown');
  }, [0, 8]);
  await check('inline semantics, absolute link, monospace', '#paragraph', r => {
    for (const token of ['<strong', '<em', 'https://example.com/docs', '<code', 'Menlo']) assert(r.html.includes(token));
  });
  await check('partial list preserves numbering', '#second', r => { assert(r.html.includes('start="5"')); assert(!r.html.includes('First item')); });
  await check('blockquote context', '#quote', r => { assert(r.html.includes('<blockquote')); assert.equal(r.styles.quoteBorder, '4px'); });
  await check('code whitespace and highlighting', '#pre', r => { assert(r.html.includes('rgb(255, 121, 198)')); assert(r.html.includes('white-space: pre')); assert(r.text.includes('\n\t')); });
  await check('table context and cell border', '#cell', r => { assert(r.html.includes('<table')); assert(r.html.includes('<tbody')); assert.equal(r.styles.cellBorder, '1px'); assert(!r.html.includes('Neighbouring cell')); });
  await check('unsafe markup stripped', '#unsafe', r => { assert(!r.html.includes('javascript:')); assert(!r.html.includes('onclick')); assert(!r.html.includes('<script')); });
  await check('layout properties omitted', '#layout', r => { assert(!r.html.includes('333px')); });
  await check('task list keeps checked state', '#tasks', async r => {
    assert(r.html.includes('☑')); assert(r.html.includes('☐'));
    assert.equal(await inspect(r.html, "return root.querySelectorAll('li').length"), 2);
  });
  await check('empty table cell keeps its column', '#gaps', async r => {
    assert.equal(await inspect(r.html, "return root.querySelectorAll('tr td').length"), 3);
  });

  // ------------------------------------------------------- sanitizer regressions
  await scenario('SVG script and style bodies never copied',
    `<p id="target">before <svg width="10" height="10"><style>/*SVG_STYLE_SECRET*/</style><script>/*SVG_SCRIPT_SECRET*/</script><text>svgtext</text></svg> after</p>`,
    r => {
      assert.equal(r.ok, true);
      assert(!r.html.includes('SVG_STYLE_SECRET'), 'SVG <style> body leaked into text/html');
      assert(!r.html.includes('SVG_SCRIPT_SECRET'), 'SVG <script> body leaked into text/html');
    });

  await scenario('invisible text is not smuggled into the HTML flavour',
    `<p id="target">visible <span style="font-size:0">ZEROPX_SECRET</span><span style="color:transparent">CLEAR_SECRET</span> tail</p>`,
    r => {
      assert.equal(r.ok, true);
      assert(!r.html.includes('ZEROPX_SECRET')); assert(!r.html.includes('CLEAR_SECRET'));
      assert(r.html.includes('visible'));
    });

  await scenario('descendant that restores a visible size still copies',
    `<p id="target"><span style="font-size:0">HIDDEN<span style="font-size:16px">SHOWN</span></span></p>`,
    r => { assert(!r.html.includes('HIDDEN')); assert(r.html.includes('SHOWN')); });

  await scenario('opacity:0 subtree dropped entirely',
    `<p id="target">keep <span style="opacity:0">GONE</span></p>`,
    r => { assert(!r.html.includes('GONE')); assert(r.html.includes('keep')); });

  await scenario('head elements cannot be cloned as divs',
    `<title>PAGE_TITLE_SECRET</title><p id="target">body text</p>`,
    r => { assert(!r.html.includes('PAGE_TITLE_SECRET')); });

  // ----------------------------------------------------------- structure fidelity
  await scenario('empty list item keeps subsequent numbering',
    `<ol id="target"><li>a</li><li></li><li>c</li></ol>`,
    async r => { assert.equal(await inspect(r.html, "return root.querySelectorAll('li').length"), 3); });

  await scenario('boundary-grazed cell with text is not kept as an empty cell',
    `<table><tbody><tr><td id="target">A</td><td>B</td></tr></tbody></table>`,
    async r => { assert.equal(await inspect(r.html, "return root.querySelectorAll('td').length"), 1); });

  await scenario('ol start is omitted when no item was selected',
    `<ol start="3" id="target">\n  <li>only</li>\n</ol>`,
    async r => {
      // Selecting just the inter-item whitespace must not emit start="4".
      await page.evaluate(() => {
        const ol = document.querySelector('#target'), r = document.createRange();
        r.setStart(ol.firstChild, 0); r.setEnd(ol.firstChild, 1);
        const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      });
      const out = await run();
      assert(!/start="\d+"/.test(out.html || ''), 'emitted a start attribute with no selected item');
    });

  await scenario('non-numeric ol start does not become NaN',
    `<ol start="abc" id="target"><li>a</li><li>b</li></ol>`,
    r => { assert(!r.html.includes('NaN')); });

  await scenario('data: image survives as an inline source',
    `<p id="target"><img alt="d" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></p>`,
    r => { assert(r.html.includes('data:image/gif')); });

  await scenario('unusable image falls back to alt text',
    `<p id="target"><img alt="DIAGRAM_ALT" src="blob:https://example.com/nope"></p>`,
    r => { assert(r.html.includes('DIAGRAM_ALT')); assert(!r.html.includes('<img')); });

  await scenario('image carries its rendered size',
    `<p id="target"><img alt="i" width="40" height="20" src="https://example.com/a.png"></p>`,
    r => { assert(r.html.includes('width="40"')); assert(r.html.includes('height="20"')); });

  // ------------------------------------------------------------------ readability
  await scenario('dark page does not paste onto a white canvas',
    `<style>:root{color-scheme:dark}body{color:#eee}</style><p id="target">dark mode text</p>`,
    r => { assert(!r.html.slice(0, 200).includes('background-color: rgb(255, 255, 255)'), 'dark page got a white canvas'); });

  await scenario('light page still uses a white canvas',
    `<style>body{color:#222}</style><p id="target">light mode text</p>`,
    r => { assert(r.html.slice(0, 200).includes('background-color: rgb(255, 255, 255)')); });

  // --------------------------------------------------------- robustness and cost
  await scenario('document-level selection does not throw', '<p id="target">x</p>', async () => {
    await page.evaluate(() => { const r = document.createRange(); r.selectNode(document.documentElement); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
    const out = await run();
    assert.equal(out.ok, true, `document selection failed: ${out.error}`);
  });

  await scenario('deeply nested ol stays linear', `<div id="target">${
    (() => { let h = 'leaf'; for (let i = 0; i < 20; i++) h = `<ol><li>${h}</li></ol>`; return h; })()
  }</div>`, r => {
    assert.equal(r.ok, true);
    // Re-cloning each item made this take ~50s at depth 20.
    assert(r.elapsed < 1500, `depth-20 nesting took ${r.elapsed}ms`);
  });

  await scenario('inlined style stays proportionate to content',
    `<style>pre{font-family:Menlo;background:#182230;color:#e7edf5}.k{color:#ff79c6}</style>
     <pre id="target"><code>${Array.from({length: 40}, (_, i) => `<span class="k">tok${i}</span> plain`).join('\n')}</code></pre>`,
    r => {
      const perToken = r.html.length / 40;
      // Every property on every span previously cost ~1.5KB per token.
      assert(perToken < 400, `${Math.round(perToken)} bytes per highlighted token`);
      assert(r.html.includes('rgb(255, 121, 198)'), 'token colour must survive the diffing');
    });

  // --------------------------------------------------------------------- options
  async function optioned(name, options, html, verify) {
    await page.setContent(`<!doctype html><html lang="en"><meta charset="utf-8">${html}`);
    await page.evaluate(o => { window.boksaOptions = o; }, options);
    const result = await copySelection();
    assert.equal(result.ok, true, `${name}: ${result.error}`);
    await verify(result);
    console.log('PASS', name); passed++;
  }
  const doc = `<style>body{background:#f0f0f0;color:#222}blockquote{background:#eef3fa}
    pre{background:#182230;color:#e7edf5;font-family:Menlo,monospace}.k{color:#ff79c6;font-weight:bold}
    code{background:#e9edf2}mark{background:#fde68a}p{font-family:Georgia,serif}</style>
    <div id="target"><p>Body <code>inline</code> <mark>marked</mark></p><blockquote>quoted</blockquote>
    <pre><code><span class="k">if</span> (x) {\n\treturn  1;\n}\n</code></pre></div>`;
  const backgrounds = html => inspect(html, `return [...root.querySelectorAll('*')].filter(e => e.style.backgroundColor).map(e => e.localName)`);

  await optioned('default options change nothing', {}, doc, async r => {
    const tags = await backgrounds(r.html);
    for (const tag of ['blockquote', 'pre', 'code', 'mark']) assert(tags.includes(tag), `lost ${tag} background`);
    assert(r.html.includes('white-space: pre'));
  });

  await optioned('backgrounds: code only', {backgrounds: 'code'}, doc, async r => {
    const tags = await backgrounds(r.html);
    assert(!tags.includes('blockquote') && !tags.includes('div'), `kept non-code backgrounds: ${tags}`);
    for (const tag of ['pre', 'code', 'mark']) assert(tags.includes(tag), `lost ${tag} background`);
    // The block's text colour must be explicit now that nothing above it is.
    assert.equal(await inspect(r.html, "return root.querySelector('pre').style.color"), 'rgb(231, 237, 245)');
  });

  await optioned('backgrounds: none', {backgrounds: 'none'}, doc, async r => {
    assert.deepEqual(await backgrounds(r.html), ['mark']);
    assert.equal(await inspect(r.html, "return root.querySelector('mark').style.backgroundColor"), 'transparent');
    // Light code text would be invisible without its dark box.
    assert.equal(await inspect(r.html, "return root.querySelector('pre').style.color"), '');
    assert(r.html.includes('rgb(255, 121, 198)'), 'mid-tone token colours are still legible and kept');
  });

  await optioned('backgrounds: none on a dark page drops light text colour', {backgrounds: 'none'},
    `<style>:root{color-scheme:dark}body{background:#111;color:#eee}</style><p id="target">dark text</p>`,
    async r => {
      assert(!r.html.includes('rgb(238, 238, 238)'), 'light text would paste white on white');
      assert(!r.html.includes('#1e1e1e') && !r.html.includes('rgb(30, 30, 30)'), 'dark canvas kept');
    });

  await optioned('syntax highlighting off', {highlight: false}, doc, async r => {
    assert(!r.html.includes('rgb(255, 121, 198)'), 'token colour kept');
    assert.equal(await inspect(r.html, "return root.querySelector('pre span')?.style.fontWeight ?? ''"), '');
    assert(r.html.includes('rgb(231, 237, 245)'), 'block colour must remain');
  });

  await optioned('fonts: editor keeps code monospaced', {fonts: 'editor'}, doc, async r => {
    assert(!r.html.includes('Georgia'), 'page font kept');
    assert.match(await inspect(r.html, "return root.querySelector('pre').style.fontFamily"), /Menlo/);
    assert.match(await inspect(r.html, "return root.querySelector('p code').style.fontFamily"), /monospace/);
  });

  await optioned('editor-safe code blocks', {codeBlocks: 'robust'}, doc, async r => {
    assert(!r.html.includes('<pre'), 'pre left in place');
    const shape = await inspect(r.html, `const cell = root.querySelector('table td');
      return {breaks: cell.querySelectorAll('br').length, text: cell.textContent,
        bg: cell.style.backgroundColor, font: cell.style.fontFamily, token: cell.querySelector('span')?.style.color}`);
    assert.equal(shape.breaks, 2, 'one <br> per line break, trailing newline dropped');
    // No tab-size on the page means the CSS default of 8.
    assert(shape.text.startsWith('if (x) {' + '\u00a0'.repeat(8) + 'return\u00a0\u00a01;'), `indentation lost: ${JSON.stringify(shape.text)}`);
    assert.equal(shape.bg, 'rgb(24, 34, 48)');
    assert.match(shape.font, /Menlo/);
    assert.equal(shape.token, 'rgb(255, 121, 198)');
    // The plain-text flavour is unaffected and keeps its real tab.
    assert(r.text.includes('\treturn  1;'));
  });

  await optioned('code only: translucent inline code on a dark page stays readable', {backgrounds: 'code'},
    `<style>body{background:#0d1117;color:#e6edf3}code{background:rgba(110,118,129,.4)}</style>
     <p id="target">text <code>light code</code></p>`,
    async r => {
      const colors = await inspect(r.html, "return [...root.querySelectorAll('*')].map(e => e.style.color).filter(Boolean)");
      assert(!colors.includes('rgb(230, 237, 243)'), `near-white text kept over a white editor: ${colors}`);
    });

  await optioned('code only: dark box on a wrapper div does not strand light tokens', {backgrounds: 'code'},
    `<style>.highlight{background:#272822}pre{color:#f8f8f2;margin:0}.s{color:#e6db74}.k{color:#f92672}</style>
     <div class="highlight"><pre id="target"><code><span class="k">def</span> f(): <span class="s">"hi"</span></code></pre></div>`,
    async r => {
      const colors = await inspect(r.html, "return [...root.querySelectorAll('*')].map(e => e.style.color).filter(Boolean)");
      for (const light of ['rgb(248, 248, 242)', 'rgb(230, 219, 116)']) assert(!colors.includes(light), `${light} kept without its box`);
      assert(colors.includes('rgb(249, 38, 114)'), 'a token readable on white keeps its colour');
    });

  await optioned('highlighting off keeps the base colour of a themed <code>', {highlight: false},
    `<style>body{color:#24292f}pre{margin:0}code.hljs{background:#282c34;color:#abb2bf}.k{color:#c678dd}</style>
     <pre id="target"><code class="hljs"><span class="k">let</span> x</code></pre>`,
    async r => {
      assert.equal(await inspect(r.html, "return root.querySelector('code').style.color"), 'rgb(171, 178, 191)');
      assert(!r.html.includes('rgb(198, 120, 221)'), 'token colour kept');
    });

  await optioned('editor-safe tabs advance to the next tab stop', {codeBlocks: 'robust'},
    `<style>pre{tab-size:4}</style><pre id="target">ab\tc\n\tz\r\nlast\rmac</pre>`,
    async r => {
      const shape = await inspect(r.html, `const cell = root.querySelector('td');
        return {text: cell.textContent, breaks: cell.querySelectorAll('br').length, marker: root.querySelector('[data-boksa-tab-size]') !== null}`);
      assert(shape.text.startsWith('ab\u00a0\u00a0c'), `tab did not stop at column 4: ${JSON.stringify(shape.text)}`);
      assert(shape.text.includes('\u00a0'.repeat(4) + 'z'));
      assert.equal(shape.breaks, 3, 'LF, CRLF and a lone CR are each one line break');
      assert(!shape.marker, 'internal tab-size marker leaked into the output');
    });

  await optioned('editor-safe CRLF split across tokens is one break', {codeBlocks: 'robust'},
    // The HTML parser normalises CR to LF, so the split pair can only come from
    // script-built content, which is what this reproduces.
    `<style>pre{tab-size:20px}</style><pre id="target"><span></span><span></span></pre>
     <script>const [x, y] = document.querySelectorAll('span'); x.textContent = 'a\\r'; y.textContent = '\\nb\\tc';</script>`,
    async r => {
      const shape = await inspect(r.html, "const c = root.querySelector('td'); return {breaks: c.querySelectorAll('br').length, text: c.textContent}");
      assert.equal(shape.breaks, 1);
      assert(shape.text.includes('b' + '\u00a0'.repeat(7) + 'c'), `length tab-size must fall back to 8: ${JSON.stringify(shape.text)}`);
    });

  // Salesforce Lightning and other flat-list editors hoist any block out of a
  // list item, so code inside an item must arrive as inline lines.
  const listDoc = `<style>pre{background:#f6f8fa;padding:12px;font-family:Menlo,monospace}.k{color:#cf222e}p{margin:0 0 8px}</style>
    <div id="target"><ol>
      <li><p>Limit the levels:</p><pre><code><span class="k">sysctl</span> -w a=1\n  indented\n\nafter blank\n</code></pre></li>
      <li><p>Persist <code>/etc/x.conf</code> with:</p><pre><code>kernel.printk = 3</code></pre>
        <ul><li>nested note</li></ul></li>
    </ol><p>This restricts.</p><pre><code>outside the list</code></pre></div>`;

  await optioned('editor-safe code inside a list item becomes inline lines', {codeBlocks: 'robust'}, listDoc, async r => {
    const shape = await inspect(r.html, `const [one, two] = root.querySelectorAll('ol > li');
      const kids = node => [...node.childNodes].map(n => n.nodeType === 3 ? '#text' : n.localName);
      return {
        blocksInItems: root.querySelectorAll('li pre, li table, li p, li div').length,
        one: kids(one), two: kids(two),
        lines: [...one.querySelectorAll(':scope > span')].slice(0).map(s => s.textContent),
        token: one.querySelector(':scope > span span')?.style.color,
        shade: one.querySelectorAll(':scope > span')[0].style.backgroundColor,
        nested: two.querySelector('ul > li')?.textContent,
        after: [...root.querySelector('ol').parentElement.children].map(e => e.localName)
      }`);
    assert.equal(shape.blocksInItems, 0, 'a block survived inside a list item');
    // Item text, a break, then one shaded span per code line.
    assert.deepEqual(shape.one, ['#text', 'br', 'span', 'br', 'span', 'br', 'span', 'br', 'span']);
    assert.deepEqual(shape.lines, ['sysctl -w a=1', '\u00a0\u00a0indented', '\u00a0', 'after blank']);
    assert.equal(shape.token, 'rgb(207, 34, 46)', 'highlighting lost when the line was split');
    assert.equal(shape.shade, 'rgb(246, 248, 250)');
    assert.equal(shape.two.at(-1), 'ul', 'nested list must stay a list at the end of the item');
    assert.equal(shape.nested, 'nested note');
    // Order is preserved and code outside a list still becomes the boxed table.
    assert.deepEqual(shape.after, ['ol', 'p', 'table']);
  });

  await optioned('standard code blocks inside list items are untouched', {}, listDoc, async r => {
    assert.equal(await inspect(r.html, "return root.querySelectorAll('li > pre').length"), 2);
  });

  const inlineDoc = `<style>body{color:#222}code{background:#e9edf2}mark{}.hl{background:#ff0000;color:#fff}
    pre{background:#182230;color:#e7edf5}blockquote{background:#eef3fa}</style>
    <div id="target"><p>Run <code>ls</code>, <mark>marked</mark> and <span class="hl">alert</span>.</p>
    <blockquote>quote</blockquote><pre><code>block</code></pre></div>`;
  const bg = (html, selector) => inspect(html, `return root.querySelector('${selector}')?.style.backgroundColor ?? null`);
  const saturation = value => {
    const [r, g, b] = value.match(/\d+/g).map(Number).map(v => v / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    return max === min ? 0 : (max - min) / (l > 0.5 ? 2 - max - min : max + min);
  };

  await optioned('text backgrounds: soften pales highlights but not blocks', {textBackgrounds: 'soft'}, inlineDoc, async r => {
    // <mark> uses the UA yellow, which must now be written out, paler.
    const mark = await bg(r.html, 'mark');
    assert(mark && mark !== 'rgb(255, 255, 0)', `mark not softened: ${mark}`);
    assert(saturation(mark) < 0.75, `mark still saturated: ${mark}`);
    const red = await bg(r.html, 'span');
    assert(saturation(red) <= 0.5 + 1e-6 && red !== 'rgb(255, 0, 0)', `span not softened: ${red}`);
    // White text on the now-pale red must have switched to a readable colour.
    assert.notEqual(await inspect(r.html, "return root.querySelector('span').style.color"), 'rgb(255, 255, 255)');
    assert.equal(await bg(r.html, 'blockquote'), 'rgb(238, 243, 250)', 'block background must be untouched');
    assert.equal(await bg(r.html, 'pre'), 'rgb(24, 34, 48)');
  });

  await optioned('text backgrounds: soften keeps dark backgrounds dark', {textBackgrounds: 'soft'},
    `<style>code{background:#343942;color:#e6edf3}</style><p id="target">x <code>dark</code></p>`,
    async r => {
      const [R, G, B] = (await bg(r.html, 'code')).match(/\d+/g).map(Number);
      assert(Math.max(R, G, B) < 80, 'dark inline code became light under light text');
    });

  await optioned('soften strength follows the sliders', {textBackgrounds: 'soft', softLighten: 0, softSaturation: 100}, inlineDoc, async r => {
    // 0% toward white and 100% saturation kept is the original colour.
    assert.equal(await bg(r.html, 'span'), 'rgb(255, 0, 0)');
  });

  await optioned('soften sliders at full strength give white', {textBackgrounds: 'soft', softLighten: 100, softSaturation: 0}, inlineDoc, async r => {
    assert.equal(await bg(r.html, 'mark'), 'rgb(255, 255, 255)');
  });

  await optioned('out-of-range soften values fall back to defaults', {textBackgrounds: 'soft', softLighten: 150, softSaturation: '50'}, inlineDoc, async r => {
    // Same result as the defaults (92 / 35).
    const expected = await page.evaluate(() => {
      const c = boksaColor.soften({r: 255, g: 0, b: 0, a: 1}, 92, 35);
      return `rgb(${c.r}, ${c.g}, ${c.b})`;
    });
    assert.equal(await bg(r.html, 'span'), expected);
  });

  await optioned('text backgrounds: remove drops only the inline ones', {textBackgrounds: 'none'}, inlineDoc, async r => {
    assert.equal(await bg(r.html, 'p code'), '');
    assert.equal(await bg(r.html, 'mark'), 'transparent', 'mark must not fall back to the editor yellow');
    assert.equal(await bg(r.html, 'span'), '');
    assert.equal(await inspect(r.html, "return root.querySelector('span').style.color"), '', 'white text left on no background');
    assert.equal(await bg(r.html, 'blockquote'), 'rgb(238, 243, 250)');
    assert.equal(await bg(r.html, 'pre'), 'rgb(24, 34, 48)');
  });

  await optioned('text backgrounds: remove keeps light text on a kept dark canvas', {textBackgrounds: 'none'},
    `<style>:root{color-scheme:dark}body{color:#eee}</style><p id="target">dark page text</p>`,
    async r => { assert(r.html.includes('rgb(238, 238, 238)'), 'light text dropped although its dark canvas is kept'); });

  // Salesforce Lightning (Quill 1.x). Expectations follow a probe paste into
  // the real field: tags like <code>/<mark>/<pre>/<blockquote> are dropped,
  // styles on them kept, nested <ul> read one level short, <br> in an item
  // starts a new item, tables kept verbatim.
  const sfDoc = `<style>code{background:#eff1f3;font-family:Menlo,monospace}pre{background:#f6f8fa;font-family:Menlo,monospace}
      blockquote{color:#59636e;border-left:4px solid #d0d7de}mark{}</style>
    <div id="target">
      <p>Use <code>ls</code> and <mark>note</mark>.</p>
      <blockquote><p>quoted</p></blockquote>
      <ul><li>one<ul><li>two<ul><li>three</li></ul></li></ul></li><li>four</li></ul>
      <ol start="3"><li><p>Check:</p><pre><code># show</code></pre></li><li>Next</li></ol>
      <pre><code>outside</code></pre><hr><p>end</p>
    </div>`;
  await optioned('salesforce: shaped for Quill', {target: 'salesforce'}, sfDoc, async r => {
    const shape = await inspect(r.html, `
      const items = list => [...list.children].map(li => [li.className, li.textContent.replace(/^[ \\n]+|[ \\n]+$/g, '')]);

      return {
        pre: root.querySelectorAll('pre:not(.ql-syntax), blockquote, hr').length,
        code: [...root.querySelectorAll('pre.ql-syntax')].map(p => p.textContent),
        nestedLists: root.querySelectorAll('li ul, li ol').length,
        lists: root.querySelectorAll('ol, ul').length,
        bullets: [...root.querySelectorAll('p')].map(p => (/ql-indent-(\\d)/.exec(p.className)?.[1] ?? '0') + ':' + p.textContent.replace(/\\u00a0/g, '_')).filter(t => /^\\d:[•◦▪]/.test(t)),
        steps: [...root.querySelectorAll('p')].map(p => p.textContent.replace(/\\u00a0/g, '_')).filter(t => /^\\d\\./.test(t)),
        codeFont: root.querySelector('p code').style.fontFamily,
        backgrounds: [...root.querySelectorAll('*')].filter(e => e.style.backgroundColor).map(e => e.localName),
        quote: [root.querySelector('p.ql-indent-1')?.textContent.trim(), root.querySelector('p.ql-indent-1')?.style.color],
        blocksInItems: root.querySelectorAll('li p, li div, li table, li br').length,
        tables: root.querySelectorAll('table').length
      }`);
    assert.equal(shape.pre, 0, 'only Quill code blocks; no blockquote/hr');
    assert.deepEqual(shape.code, ['# show', 'outside'], 'code blocks use Salesforce\'s Code Block format');
    assert.equal(shape.nestedLists, 0, 'lists must be flat');
    // Nested levels are typed out, indented four spaces per level.
    assert.deepEqual(shape.bullets, ['0:•_one', '1:◦_two', '2:▪_three', '0:•_four']);
    // A list with any code block, even one line, becomes numbered paragraphs.
    assert.equal(shape.lists, 0, 'nested or code-bearing lists are typed out');
    assert.deepEqual(shape.steps, ['3._Check:', '4._Next']);
    assert.equal(shape.blocksInItems, 0, 'a block or line break inside an item');
    assert.equal(shape.codeFont, 'courier', 'inline code uses Salesforce\'s own fixed-width font');
    assert.deepEqual(shape.backgrounds, [], 'Salesforce darkens any background it stores');
    assert.deepEqual(shape.quote, ['quoted', 'rgb(89, 99, 110)']);
    assert.equal(shape.tables, 1, 'only the rule is a table');
  });

  // Markdown ends a list at an unindented code block and resumes it with
  // start="2"; Salesforce would number the second part from 1.
  await optioned('salesforce: a list resumed after a code block keeps its number', {target: 'salesforce'},
    `<div id="target"><ol><li>Create the file:</li></ol><pre><code>[Unit]\nDescription=x</code></pre>
      <ol start="2"><li>Enable the service:</li></ol><pre><code>systemctl daemon-reload</code></pre><p>after</p></div>`,
    async r => {
      const blocks = await inspect(r.html, `return [...root.querySelectorAll('p, pre')].map(e => e.localName === 'pre'
        ? 'code:' + e.textContent : e.textContent.replace(/\\u00a0/g, '_').trim())`);
      // The unindented code blocks follow their steps; numbering is kept.
      assert.deepEqual(blocks, ['1._Create the file:', 'code:[Unit]\nDescription=x', '2._Enable the service:', 'code:systemctl daemon-reload', 'after']);
    });

  // MarkdownLens-style markup: emphasis as styled spans, inline code in the
  // body colour on a grey background.
  const lensDoc = `<style>body{color:#24292f}.b{font-weight:600}.i{font-style:italic}code{background:#eff1f3;color:inherit}</style>
    <p id="target"><span class="i">Thanks.</span> <span class="b">The job stopped at <code>08:00:18</code></span> and <code>status</code>.</p>`;
  for (const target of ['generic', 'salesforce']) {
    await optioned(`${target}: styled bold and italic become real tags`, {target}, lensDoc, async r => {
      const shape = await inspect(r.html, `return {strong: root.querySelector('strong')?.textContent, em: root.querySelector('em')?.textContent,
        weights: [...root.querySelectorAll('[style*="font-weight"]')].map(e => e.style.fontWeight)}`);
      assert.equal(shape.strong, 'The job stopped at 08:00:18');
      assert.equal(shape.em, 'Thanks.');
    });
  }
  await optioned('salesforce: inline code in the body colour gets the code blue', {target: 'salesforce'}, lensDoc, async r => {
    assert.deepEqual(await inspect(r.html, "return [...root.querySelectorAll('code')].map(c => c.style.color)"), ['rgb(79, 110, 206)', 'rgb(79, 110, 206)']);
  });

  // A source line break inside a paragraph: Salesforce splits on it and
  // merges the tail into the next block.
  for (const target of ['generic', 'salesforce']) {
    await optioned(`${target}: no raw line breaks in copied text`, {target},
      `<div id="target"><ul><li>Run:<pre><code>sudo yum install x</code></pre>\nThis package is\nthe suite.</li></ul><h2>Reference</h2></div>`,
      async r => {
        const raw = await inspect(r.html, `const out = []; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          while (w.nextNode()) if (/[\\n\\r]/.test(w.currentNode.data) && !w.currentNode.parentElement.closest('pre')) out.push(w.currentNode.data);
          return out`);
        assert.deepEqual(raw, [], 'raw line breaks left in text');
      });
  }

  // A viewer that wraps code in a container and leaves the following text loose.
  await optioned('salesforce: wrapped code and loose text keep their place', {target: 'salesforce'},
    `<div id="target"><ul><li>Recommended: run:<div class="code"><div class="label">bash</div><pre><code>sudo yum install x</code></pre></div>
      This package is the suite.</li></ul><div class="code"><pre><code>top level</code></pre></div>Loose text<h2>Reference</h2></div>`,
    async r => {
      const shape = await inspect(r.html, `return [...root.querySelectorAll('p, h2, pre')]
        .map(e => e.localName + (/ql-indent-(\\d)/.exec(e.className)?.[1] ?? '') + ':' + e.textContent.replace(/\\u00a0/g, '_').trim())`);
      assert.deepEqual(shape, [
        'p:•_Recommended: run:', 'p1:bash', 'pre1:sudo yum install x', 'p1:This package is the suite.',
        // Code right after a list belongs to its last item.
        'pre1:top level', 'p:Loose text', 'h2:Reference'
      ]);
    });

  await optioned('salesforce: code in a container becomes a code block; bold tags stand alone', {target: 'salesforce'},
    `<style>.code{margin:0 0 24px}pre{margin:0}strong{font-weight:600}</style>
     <div id="target"><div class="code"><pre><code>log line</code></pre></div><h2>Recommended</h2><p><strong>Reserve</strong> memory</p></div>`,
    async r => {
      const shape = await inspect(r.html, `return {code: root.querySelector('pre.ql-syntax')?.textContent, weight: root.querySelector('strong').style.fontWeight}`);
      assert.equal(shape.code, 'log line');
      assert.equal(shape.weight, '', 'a weight on <strong> can override the tag in Salesforce');
    });

  await optioned('salesforce: a data table keeps its frame and width', {target: 'salesforce'},
    `<style>.wrap{border:1px solid #d0d7de;border-radius:6px;margin:0 0 16px}table{border-collapse:collapse}
      td,th{border-right:1px solid #d0d7de;word-break:break-all}</style>
     <div id="target"><div class="wrap"><table><thead><tr><th>#</th><th>Item ID</th></tr></thead>
       <tbody><tr><td>2</td><td>123456</td></tr></tbody></table></div><p>after</p></div>`,
    async r => {
      const shape = await inspect(r.html, `const t = root.querySelector('table');
        return {width: t.style.width, frame: t.style.borderTop, breaks: [...t.querySelectorAll('*')].filter(e => e.style.wordBreak || e.style.overflowWrap).length,
          wrapped: t.parentElement.localName}`);
      assert.equal(shape.width, '100%');
      assert.equal(shape.frame, '1px solid rgb(208, 215, 222)');
      assert.equal(shape.breaks, 0);
    });

  for (const options of [{codeBlocks: 'robust'}, {target: 'salesforce'}]) {
    await optioned(`no internal markers leak (${JSON.stringify(options)})`, options,
      `<div id="target"><pre><code>a\nb</code></pre></div>`,
      r => { assert(!/data-boksa/.test(r.html), 'internal data-boksa attribute in output'); });
  }

  await optioned('salesforce: table columns keep their on-screen widths and a light frame', {target: 'salesforce'},
    `<style>table{width:600px;border-collapse:collapse}td,th{border:1px solid #d0d7de}</style>
     <div id="target"><table><thead><tr><th style="width:30px">#</th><th style="width:420px">Title</th><th>Relevance</th></tr></thead>
       <tbody><tr><td>1</td><td>How do I configure a timeout</td><td>Explains</td></tr></tbody></table></div>`,
    async r => {
      const shape = await inspect(r.html, `const t = root.querySelector('table');
        return {widths: [...t.querySelectorAll('th')].map(th => parseFloat(th.style.width)), frame: t.style.borderTop,
          leaked: /data-boksa/.test(root.firstElementChild.outerHTML)}`);
      const [narrow, wide, rest] = shape.widths;
      assert(narrow < 10 && wide > 60 && rest > 10, `column widths ${shape.widths}`);
      assert.equal(shape.frame, '1px solid rgb(208, 215, 222)');
      assert(!shape.leaked);
    });

  await optioned('salesforce: a narrow column still fits its widest word', {target: 'salesforce'},
    `<style>table{width:1100px;border-collapse:collapse}td,th{border:1px solid #d0d7de;padding:8px 16px;font:15px sans-serif}</style>
     <div id="target"><table><thead><tr><th style="width:20px">#</th><th style="width:60px">Item ID</th><th>Title</th><th>Relevance</th></tr></thead>
       <tbody><tr><td>1</td><td>1234567</td><td>A longer title that needs plenty of room in its own column</td><td>Describes exactly how well this sample entry matches</td></tr></tbody></table></div>`,
    async r => {
      const widths = await inspect(r.html, "return [...root.querySelectorAll('th')].map(th => parseFloat(th.style.width))");
      // "1234567" at 15px plus 32px padding needs about 95px: over 13% of 720px.
      assert(widths[1] >= 13, `Item ID column ${widths[1]}% cannot hold 1234567 on one line`);
      const sum = widths.reduce((a, b) => a + b, 0);
      assert(sum <= 100.5, `widths add up to ${sum}%`);
      assert(widths[2] > widths[1] && widths[3] > widths[1], 'the text columns stay wider');
    });

  // The Customer Portal keeps only its allowlist of tags and no styles.
  const portalTagList = ['div', 'p', 'br', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'ol', 'ul', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'img', 'pre', 'code', 'blockquote', 'sub', 'sup', 'hr', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col'];
  await optioned('portal: data tables and inline code stay real; code boxes and rules do not', {target: 'portal', highlight: false},
    `<style>td,th{border:1px solid #d0d7de}pre{background:#f6f8fa}</style><div id="target">
      <p>Intro with <code>EXAMPLEDB01</code> and <kbd>Ctrl</kbd> and <mark>m</mark></p><hr><ol><li>Run:<pre><code>line one\n  line two</code></pre></li></ol>
      <table><thead><tr><th>#</th><th>Item ID</th></tr></thead><tbody><tr><td>1</td><td><a href="https://example.com/items/1">7654321</a> <code>x86_64</code></td></tr></tbody></table>
      <p>Best regards,<br>Sample</p></div>`,
    async r => {
      const shape = await inspect(r.html, `return {
        tables: root.querySelectorAll('table').length,
        cells: [...root.querySelectorAll('th, td')].map(c => c.textContent.trim()),
        link: root.querySelector('td a')?.getAttribute('href'),
        lines: [...root.querySelectorAll('p')].map(p => p.textContent.replace(/\\u00a0/g, '_').replace(/\\u2500+/, 'RULE')),
        code: root.querySelector('pre.ql-syntax')?.textContent,
        inline: [...root.querySelectorAll('code')].map(c => c.textContent),
        tags: [...new Set([...root.querySelectorAll('*')].map(e => e.localName))],
        }`);
      assert.equal(shape.tables, 1, 'only the data table stays a table');
      assert.deepEqual(shape.cells, ['#', 'Item ID', '1', '7654321 x86_64']);
      assert.equal(shape.link, 'https://example.com/items/1');
      assert.deepEqual(shape.inline, ['EXAMPLEDB01', 'Ctrl', 'x86_64'], 'inline code and kbd are <code>');
      assert.deepEqual(shape.tags.filter(t => !portalTagList.includes(t)), [], 'tags the Customer Portal prints as text');
      assert(shape.lines.includes('RULE'), `rule missing: ${shape.lines}`);
      assert.equal(shape.code, 'line one\n  line two', 'code kept as a Quill code block');
      assert(!/data-boksa/.test(r.html));
    });

  await optioned('portal: a wide table stays one table with its links and formatting', {target: 'portal'},
    `<div id="target"><p>Intro:</p><table><thead><tr><th>Hostname</th><th>Role</th><th>Status</th><th>CPU</th><th>Notes</th><th>Kernel</th><th>vCPUs</th></tr></thead>
      <tbody><tr><td><strong>host1</strong></td><td>App</td><td><strong>Affected</strong> (Hung)</td><td>Xeon</td><td>noted in the kernel log</td><td><a href="https://example.com/k">4.18</a></td><td>6</td></tr></tbody></table><p>After.</p></div>`,
    async r => {
      const shape = await inspect(r.html, `return {
        blocks: [...root.querySelector('table, blockquote, p').parentElement.children].map(e => e.localName + ':' + (e.localName === 'table' ? e.querySelectorAll('th').length : e.textContent.trim() || 'BLANK')),
        bold: [...root.querySelectorAll('td strong')].map(s => s.textContent), href: root.querySelector('td a')?.getAttribute('href') }`);
      // A blank line above the table; the portal gives a table 16px below.
      assert.deepEqual(shape.blocks, ['p:Intro:', 'p:BLANK', 'table:7', 'p:After.']);
      assert.deepEqual(shape.bold, ['host1', 'Affected']);
      assert.equal(shape.href, 'https://example.com/k');
    });

  await optioned('portal: two tables in a row get an empty line between them', {target: 'portal'},
    `<div id="target"><table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>
      <table><tr><th>C</th><th>D</th></tr><tr><td>3</td><td>4</td></tr></table></div>`,
    async r => {
      const blocks = await inspect(r.html, "return [...root.querySelector('table, blockquote, p').parentElement.children].map(e => e.localName + ':' + (e.textContent.trim() || 'BLANK'))");
      assert.deepEqual(blocks, ['table:AB12', 'p:BLANK', 'table:CD34']);
    });

  await optioned('portal: a quote stays a blockquote of Quill quote paragraphs', {target: 'portal'},
    `<style>blockquote{color:#59636e;border-left:4px solid #d0d7de;padding:0 1em;margin:0 0 16px}</style>
     <div id="target"><p>He wrote:</p><blockquote><p>First <strong>line</strong> with <code>code</code>.</p><p>Second line.</p>
       <blockquote><p>Nested reply.</p></blockquote></blockquote><p>After.</p></div>`,
    async r => {
      const shape = await inspect(r.html, `const q = root.querySelector('blockquote'); return {
        blocks: [...root.querySelector('table, blockquote, p').parentElement.children].map(e => e.localName + ':' + (e.textContent.trim() || 'BLANK')),
        lines: q && [...q.children].map(p => p.localName + '.' + p.className + ':' + p.textContent.trim()),
        quotes: root.querySelectorAll('blockquote').length, style: q?.getAttribute('style') ?? null }`);
      assert.deepEqual(shape.blocks, ['p:He wrote:', 'p:BLANK', 'blockquote:First line with code.Second line.Nested reply.', 'p:After.']);
      assert.deepEqual(shape.lines, ['p.ql-quote-block:First line with code.', 'p.ql-quote-block:Second line.', 'p.ql-quote-block:Nested reply.']);
      assert.equal(shape.quotes, 1, 'nested quote joins its parent');
      assert.equal(shape.style, null, 'Salesforce draws its own quote bar');
    });

  await optioned('portal: a quote holding a list becomes indented paragraphs', {target: 'portal'},
    `<div id="target"><blockquote><p>Steps:</p><ul><li>one</li></ul></blockquote></div>`,
    async r => {
      const shape = await inspect(r.html, "return [root.querySelectorAll('blockquote').length, root.querySelector('p.ql-indent-1')?.textContent]");
      assert.deepEqual(shape, [0, 'Steps:']);
    });

  await optioned('portal: strikethrough is drawn in the text, not with a tag', {target: 'portal'},
    `<div id="target"><p>Use <del>old value</del> <s>x</s> <span style="text-decoration: line-through">gone</span> now.</p><pre><code>a <del>b</del></code></pre></div>`,
    async r => {
      const shape = await inspect(r.html, `return {
        text: root.querySelector('p').textContent,
        tags: root.querySelectorAll('s, del, strike').length,
        styled: [...root.querySelectorAll('[style]')].filter(e => /line-through/.test(e.getAttribute('style'))).length,
        code: root.querySelector('pre').textContent }`);
      assert.equal(shape.text, 'Use o\u0336l\u0336d\u0336 \u0336v\u0336a\u0336l\u0336u\u0336e\u0336 x\u0336 g\u0336o\u0336n\u0336e\u0336 now.');
      assert.equal(shape.tags, 0);
      assert.equal(shape.styled, 0);
      assert.equal(shape.code, 'a b', 'code blocks stay plain text');
    });

  await optioned('portal: blank lines between paragraphs, none inside lists', {target: 'portal'},
    `<div id="target"><h3>Question 1</h3><p>Answer one.</p><p>Answer two:</p>
      <ol><li>First<pre><code>x</code></pre></li><li>Second</li></ol><p>We recommend.</p></div>`,
    async r => {
      const blocks = await inspect(r.html, `return [...root.querySelectorAll('h1, h2, h3, h4, p, pre')].map(e => e.localName === 'pre' ? 'code'
        : (e.textContent.trim() ? e.textContent.replace(/\\u00a0/g, ' ').trim() : 'BLANK'))`);
      // No blank line next to a heading: the portal spaces headings itself.
      assert.deepEqual(blocks, ['Question 1', 'Answer one.', 'BLANK', 'Answer two:', 'BLANK', '1. First', 'BLANK', 'code', 'BLANK', '2. Second', 'BLANK', 'We recommend.']);
      assert(!/data-boksa/.test(r.html));
    });

  await optioned('portal: no blank line after a real list', {target: 'portal'},
    `<div id="target"><p>Intro:</p><ul><li>one</li><li>two</li></ul><p>After.</p></div>`,
    async r => {
      const blocks = await inspect(r.html, `return [...root.querySelectorAll('p, ul')].filter(e => !e.closest('li'))
        .map(e => e.localName === 'ul' ? 'list' : (e.textContent.trim() || 'BLANK'))`);
      assert.deepEqual(blocks, ['Intro:', 'BLANK', 'list', 'After.']);
    });

  await optioned('portal: headings move up a level so they stay above body text', {target: 'portal'},
    `<div id="target"><h2>Two</h2><h3>Three</h3><h4>Four</h4><h5>Five</h5><p><strong>Source:</strong> x</p></div>`,
    async r => {
      const heads = await inspect(r.html, "return [...root.querySelectorAll('h1, h2, h3, h4, h5, h6')].map(h => h.localName + ':' + (h.querySelector('strong')?.textContent ?? ''))");
      assert.deepEqual(heads, ['h1:Two', 'h2:Three', 'h3:Four', 'h3:Five']);
    });

  await optioned('salesforce: a plain flat list stays a real list', {target: 'salesforce'},
    `<div id="target"><ol><li>one</li><li>two</li></ol></div>`,
    async r => { assert.equal(await inspect(r.html, "return root.querySelectorAll('ol > li').length"), 2); });

  await optioned('salesforce: list with multi-line code becomes numbered paragraphs', {target: 'salesforce'},
    `<style>pre{background:#f6f8fa;font-family:Menlo,monospace}</style><div id="target">
      <ol start="2"><li><p>Check the log:</p><p>Evidence: <code>/var/log</code></p><pre><code style="padding: 10px 16px">line one\n  line two\n</code></pre></li>
        <li>Next step<ul><li>detail</li></ul></li></ol><p>after</p></div>`,
    async r => {
      const shape = await inspect(r.html, `return {
        lists: root.querySelectorAll('ol, ul, li').length,
        blocks: [...root.querySelectorAll('p, pre')].map(e => (/ql-indent-(\\d)/.exec(e.className)?.[1] ?? '0') + ':' + (e.localName === 'pre' ? 'code:' + e.textContent : e.textContent).replace(/\\u00a0/g, '_'))
      }`);
      assert.equal(shape.lists, 0, 'no list may remain');
      assert.deepEqual(shape.blocks, [
        '0:2._Check the log:',
        // A second paragraph and the code start their own lines, one level in.
        '1:Evidence: /var/log',
        '1:code:line one\n  line two',
        '0:3._Next step',
        '1:◦_detail',
        '0:after'
      ]);
    });

  // Salesforce strips the alpha channel on save, so rgba() must never reach it.
  const alphaDoc = `<style>body{color:#1f2328}code{background:rgba(96,96,255,.1);color:rgb(80,111,206)}
      pre{background:rgba(85,119,170,.08)}th{border:1px solid rgba(97,118,139,.3)}</style>
    <div id="target"><p>Run <code>iTCO_wdt</code></p><pre><code>line one\nline two</code></pre>
      <table><tbody><tr><th>head</th></tr></tbody></table></div>`;
  // Modern themes use color-mix()/oklch(), which compute to color(srgb … / a)
  // or stay as oklch(); Salesforce turns those into opaque rgb() on save.
  await optioned('colours in modern CSS formats are written as solid rgb()', {},
    `<style>code{background:color-mix(in srgb, rgb(96,96,255) 10%, transparent);color:oklch(0.55 0.15 265)}
      pre{background:oklch(0.6 0.1 250 / 0.08);border:1px solid color-mix(in srgb, #2b2b2f 20%, transparent)}</style>
     <div id="target"><p>Run <code>iTCO_wdt</code></p><pre><code>line one\nline two</code></pre></div>`,
    async r => {
      const leftover = r.html.match(/(?:rgba|hsla|color|oklch|oklab|lab|lch|hwb)\([^)]*\)/);
      assert(!leftover, `non-rgb colour left in output: ${leftover?.[0]}`);
      assert.equal(await inspect(r.html, "return root.querySelector('code').style.backgroundColor"), 'rgb(239, 239, 255)');
    });

  for (const target of ['generic', 'salesforce']) {
    await optioned(`${target}: semi-transparent colours are written as solid colours`, {target}, alphaDoc, async r => {
      assert(!/rgba\(|hsla\(|transparent/.test(r.html), `translucent colour left in output: ${r.html.match(/(rgba|hsla)\([^)]*\)|transparent/)?.[0]}`);
      // 10% of rgb(96,96,255) over white is a pale lavender, not solid blue;
      // Salesforce gets no background at all.
      assert.equal(await inspect(r.html, "return root.querySelector('code').style.backgroundColor"), target === 'salesforce' ? '' : 'rgb(239, 239, 255)');
    });
  }

  await optioned('salesforce: soften still applies to explicit inline shading', {target: 'salesforce', textBackgrounds: 'none'}, sfDoc, async r => {
    assert.equal(await inspect(r.html, "return root.querySelector('p code').style.backgroundColor"), '');
  });

  for (const target of ['generic', 'salesforce']) {
    await optioned(`${target}: no leading whitespace after a line break`, {target},
      `<p id="target">Best regards,<br>\n<strong>Sample Name</strong><br>\n  Job, Team</p>`,
      async r => {
        const starts = await inspect(r.html, `return [...root.querySelectorAll('br')].map(br => {
          const next = br.nextSibling; return (next?.nodeType === 3 ? next.data : next?.textContent ?? '').slice(0, 3); })`);
        assert.deepEqual(starts, ['Sam', 'Job'], `lines after <br> start with whitespace: ${JSON.stringify(starts)}`);
        assert.equal(r.text.replace(/\s+/g, ' ').trim(), 'Best regards, Sample Name Job, Team', 'plain text unchanged');
      });
  }

  // Salesforce darkens every stored colour to 4.5:1 against white, keeping hue
  // and saturation. These pairs are what Boksa sent and what a saved comment
  // contained; reproducing them confirms the model the Salesforce target uses.
  const model = await page.evaluate(() => {
    const hue = ({r, g, b}) => Math.round(Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b) * 180 / Math.PI);
    return [[[245, 247, 250], [85, 119, 170]], [[208, 215, 222], [97, 118, 139]], [[96, 124, 210], [80, 111, 206]], [[47, 50, 55], [47, 50, 55]]]
      .map(([[r, g, b], [R, G, B]]) => {
        const ours = boksaColor.darkenFor({r, g, b, a: 1}, 4.7), theirs = {r: R, g: G, b: B, a: 1};
        return {hueGap: Math.abs(hue(ours) - hue(theirs)), ours: boksaColor.contrast(ours, boksaColor.white),
          theirs: boksaColor.contrast(theirs, boksaColor.white), gap: Math.max(Math.abs(ours.r - R), Math.abs(ours.g - G), Math.abs(ours.b - B))};
      });
  });
  for (const {hueGap, ours, theirs, gap} of model) {
    assert(hueGap <= 2, `hue drifted by ${hueGap}°`);
    assert(theirs >= 4.5 && ours >= Math.min(theirs, 4.7) - 0.01, `contrast ${ours} vs Salesforce ${theirs}`);
    assert(gap <= 8, `channel differs from Salesforce's by ${gap}`);
  }
  console.log('PASS darkening reproduces the colours Salesforce saved'); passed++;

  await optioned('salesforce: no backgrounds, readable text, shorthand borders', {target: 'salesforce'},
    `<style>body{color:#1f2328}code{background:#eef;color:rgb(96,124,210)}pre{background:#f5f7fa}
      th,td{border:1px solid #d0d7de;background:#f6f8fa}mark{background:yellow}</style>
     <div id="target"><p><code>x</code> <mark>m</mark> <span style="color:#fff;background:#333">dark</span></p>
       <pre><code>a\nb</code></pre><table><tbody><tr><th>h</th><td>c</td></tr></tbody></table></div>`,
    async r => {
      const shape = await inspect(r.html, `
        const all = [...root.querySelectorAll('*')];
        const lum = c => { const [r, g, b] = c.match(/\\d+/g).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
        return {
          backgrounds: all.filter(e => e.style.backgroundColor).length,
          weakText: all.map(e => e.style.color).filter(Boolean).filter(c => 1.05 / (lum(c) + 0.05) < 4.49),
          longhandBorderColours: all.filter(e => /border-(top|right|bottom|left)-color|border-color/.test(e.getAttribute('style') || '')).map(e => e.getAttribute('style')),
          code: root.querySelector('pre.ql-syntax')?.textContent,
          cellBorder: root.querySelector('table th').style.borderTop
        }`);
      assert.equal(shape.backgrounds, 0);
      assert.deepEqual(shape.weakText, [], 'text Salesforce would darken');
      assert.deepEqual(shape.longhandBorderColours, [], 'border colours outside a shorthand are darkened by Salesforce');
      assert.equal(shape.code, 'a\nb');
      assert.equal(shape.cellBorder, '1px solid rgb(208, 215, 222)');
    });

  // Salesforce splits a paragraph at every <br>, spacing the lines apart.
  await optioned('salesforce: lines joined by <br> stay in one borderless cell', {target: 'salesforce'},
    `<div id="target"><p>Please let us know.</p><p>Best regards,<br>\n<strong>Sample Name</strong><br>\nJob, Team<br>\n</p><p>one line<br></p></div>`,
    async r => {
      const shape = await inspect(r.html, `const cells = root.querySelectorAll('td');
        return {cells: cells.length, breaks: cells[0]?.querySelectorAll('br').length, text: cells[0]?.textContent,
          border: cells[0]?.getAttribute('style') || '', last: [...root.querySelectorAll('p')].map(p => p.innerHTML)}`);
      assert.equal(shape.cells, 1);
      assert.equal(shape.breaks, 2, 'no trailing break');
      assert.equal(shape.text, 'Best regards,Sample NameJob, Team');
      assert(!/border/.test(shape.border), 'the cell must be borderless');
      assert.deepEqual(shape.last, ['Please let us know.', 'one line'], 'a single-line paragraph stays a paragraph');
    });

  // Salesforce moves the second of two adjacent tables to the end.
  await optioned('salesforce: adjacent tables are separated by an empty line', {target: 'salesforce'},
    `<div id="target"><table><tbody><tr><td>ref</td></tr></tbody></table><hr><p>Please let us know.</p></div>`,
    async r => {
      const order = await inspect(r.html, `return [...root.querySelectorAll('table, p')].filter(e => !e.parentElement.closest('table'))
        .map(e => e.localName === 'p' ? (e.textContent.trim() || 'empty') : 'table')`);
      assert.deepEqual(order, ['table', 'empty', 'table', 'Please let us know.']);
    });

  await optioned('prototype keys in stored options are ignored', {constructor: 'x', toString: 'all'}, doc, r => {
    assert(r.html.includes('white-space: pre'));
  });

  await optioned('unknown option values fall back to defaults', {backgrounds: 'bogus', highlight: 'yes', extra: 1}, doc, async r => {
    assert((await backgrounds(r.html)).includes('blockquote'));
    assert(r.html.includes('rgb(255, 121, 198)'));
  });

  await scenario('bullet styles appear only on lists',
    `<style>body{list-style-type:disc}ul ul{list-style-type:circle}</style>
     <div id="target"><h3>Title</h3><ul><li>one<ul><li>two</li></ul></li></ul><p>after</p></div>`,
    async r => {
      const stray = await inspect(r.html, `return [...root.querySelectorAll('*')]
        .filter(e => e.style.listStyleType && !['ul', 'ol', 'li'].includes(e.localName)).map(e => e.localName)`);
      assert.deepEqual(stray, [], `list-style written on non-list elements: ${stray}`);
      assert.equal(await inspect(r.html, "return root.querySelector('ul ul').style.listStyleType"), 'circle');
    });

  // Editors without a rule of their own drop <hr>; a bordered cell survives.
  const ruleOf = html => inspect(html, `const cell = root.querySelector('table td');
    return {hr: root.querySelectorAll('hr').length, top: cell?.style.borderTop, order: [...root.querySelectorAll('p, table')].map(e => e.localName)}`);

  await scenario('a filled rule becomes a bordered table cell',
    `<style>hr{height:4px;background:#d0d7de;border:0}</style><div id="target"><p>a</p><hr><p>b</p></div>`,
    async r => {
      const rule = await ruleOf(r.html);
      assert.equal(rule.hr, 0, '<hr> left in the output');
      assert.equal(rule.top, '4px solid rgb(208, 215, 222)');
      assert.deepEqual(rule.order, ['p', 'table', 'p']);
    });

  await scenario('a default browser rule becomes a bordered table cell',
    `<div id="target"><p>a</p><hr><p>b</p></div>`,
    async r => {
      const rule = await ruleOf(r.html);
      assert.equal(rule.hr, 0);
      assert.match(rule.top, /^1px solid rgb\(/);
    });

  // ------------------------------------------------------------- clipboard paths
  await page.setContent('<!doctype html><meta charset="utf-8"><p id="target">fallback</p>');
  await copySelection();
  await page.evaluate(() => {
    document.execCommand = () => false;
    Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {write: async items => {
      window.modernPayload = {};
      for (const type of items[0].types) modernPayload[type] = await (await items[0].getType(type)).text();
    }}});
  });
  assert.equal((await page.evaluate(code)).ok, true);
  assert.deepEqual(Object.keys(await page.evaluate(() => modernPayload)).sort(), ['text/html', 'text/plain']);
  console.log('PASS async clipboard fallback'); passed++;

  // Nothing selected: the whole page is copied and the caret is left as it was.
  await page.setContent('<!doctype html><meta charset="utf-8"><h2>Title</h2><p id="target">body <strong>text</strong></p>');
  await page.evaluate(() => {
    const r = document.createRange(); r.setStart(document.querySelector('#target').firstChild, 2); r.collapse(true);
    getSelection().removeAllRanges(); getSelection().addRange(r);
  });
  const whole = await run();
  assert.equal(whole.ok, true, whole.error);
  assert(whole.html.includes('<h2') && whole.html.includes('<strong'), 'whole page not copied');
  assert.equal(whole.text.replace(/\s+/g, ' ').trim(), 'Title body text');
  assert.deepEqual(await page.evaluate(() => [getSelection().isCollapsed, getSelection().anchorOffset]), [true, 2], 'caret not restored');
  await page.evaluate(() => getSelection().removeAllRanges());
  assert.equal((await run()).ok, true, 'no selection at all also copies the page');
  console.log('PASS empty selection copies the whole page'); passed++;

  // A page with nothing copyable still reports an error.
  await page.setContent('<!doctype html><meta charset="utf-8"><body></body>');

  // Everything above runs in the main world with no extension API, proving the
  // fallbacks work. This proves the other half: that the strings really are
  // routed through chrome.i18n when it is present.
  await page.evaluate(() => Object.defineProperty(window, 'chrome', {
    configurable: true, value: {i18n: {getMessage: key => 'I18N_' + key}}
  }));
  const localized = await page.evaluate(code);
  assert.equal(localized.ok, false);
  assert.equal(localized.error, 'I18N_errNothingCopyable', 'copy.js did not route its strings through chrome.i18n');
  console.log('PASS user-facing strings resolve through chrome.i18n'); passed++;

  console.log(`\n${passed} checks passed (Chrome DOM; clipboard transport mocked).`);
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
