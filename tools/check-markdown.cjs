// Renders a Markdown file the way a GitHub-style viewer does, copies all of it
// through color.js + copy.js, and reports structures that web editors are
// known to mangle. The copied HTML is saved next to the report for inspection.
//
// Run: node tools/check-markdown.cjs <file.md> ['{"codeBlocks":"robust"}']
//
// markdown-it and github-markdown-css load from cdnjs, so this needs network.
const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const [file, optionsJson = '{}'] = process.argv.slice(2);
if (!file) { console.error('usage: node tools/check-markdown.cjs <file.md> [options-json]'); process.exit(2); }
const root = path.join(__dirname, '..');
const code = ['color.js', 'copy.js'].map(name => fs.readFileSync(path.join(root, name), 'utf8')).join('\n');
const markdown = fs.readFileSync(file, 'utf8');
const options = JSON.parse(optionsJson);

(async () => {
  const browser = await chromium.launch({channel: 'chrome', headless: true});
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><meta charset="utf-8">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.1/github-markdown-light.min.css">
    <article class="markdown-body" id="doc" style="max-width:900px;margin:auto;padding:32px"></article>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/markdown-it/13.0.2/markdown-it.min.js"></script>`);
  await page.waitForFunction(() => window.markdownit);
  await page.evaluate(source => { document.getElementById('doc').innerHTML = markdownit({html: true}).render(source); }, markdown);

  await page.evaluate(options => {
    window.boksaOptions = options;
    document.execCommand = () => {
      const data = new DataTransfer();
      window.dispatchEvent(new ClipboardEvent('copy', {clipboardData: data, cancelable: true}));
      window.payload = {html: data.getData('text/html'), text: data.getData('text/plain')};
      return true;
    };
    const range = document.createRange();
    range.selectNodeContents(document.getElementById('doc'));
    getSelection().removeAllRanges(); getSelection().addRange(range);
  }, options);
  const outcome = await page.evaluate(code);
  if (!outcome?.ok) throw new Error(`copy failed: ${outcome?.error}`);
  const {html, text} = await page.evaluate(() => window.payload);

  const findings = await page.evaluate(html => {
    const t = document.createElement('template'); t.innerHTML = html;
    const all = [...t.content.querySelectorAll('*')];
    const out = [];
    const where = el => `<${el.localName}> "${(el.textContent || '').trim().slice(0, 50)}"`;
    for (const el of all) {
      if (el.style.listStyleType && !['ol', 'ul', 'li'].includes(el.localName)) out.push(`list-style on non-list ${where(el)}`);
      if (el.localName === 'hr') out.push('<hr> in output (dropped by editors without a rule)');
    }
    for (const li of t.content.querySelectorAll('li')) {
      const blocks = [...li.children].filter(c => ['pre', 'table', 'p', 'div', 'blockquote'].includes(c.localName));
      if (blocks.some(b => ['pre', 'table'].includes(b.localName))) out.push(`block code inside ${where(li)} (flat-list editors hoist it)`);
    }
    // Salesforce strips the alpha channel on save: 10% blue becomes solid blue.
    const translucent = html.match(/(?:rgba|hsla|color|oklch|oklab|lab|lch|hwb)\([^)]*\)|\btransparent\b/g) || [];
    if (translucent.length) out.push(`${translucent.length} non-rgb() colour(s), e.g. ${translucent[0]} (Salesforce saves them as opaque rgb)`);
    const odd = /[​-‏⁠﻿­-]/;
    const walker = document.createTreeWalker(t.content, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) if (odd.test(walker.currentNode.data)) out.push(`invisible/private-use character in "${walker.currentNode.data.trim().slice(0, 40)}"`);
    const counts = {};
    for (const el of all) counts[el.localName] = (counts[el.localName] || 0) + 1;
    return {out, counts};
  }, html);

  const saved = path.join(require('node:os').tmpdir(), `boksa-${path.basename(file, '.md')}.html`);
  fs.writeFileSync(saved, html);
  console.log(`options: ${JSON.stringify(options)}`);
  console.log(`html: ${html.length.toLocaleString()} bytes, text: ${text.length.toLocaleString()} chars, saved to ${saved}`);
  console.log(`elements: ${Object.entries(findings.counts).map(([k, v]) => `${k}×${v}`).join(' ')}`);
  console.log(findings.out.length ? findings.out.map(f => `  ! ${f}`).join('\n') : '  no known problem patterns');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
