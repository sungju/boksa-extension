// Renders the Chrome Web Store listing images: screenshots and the promo tiles.
// Run: node tools/make-store-assets.cjs
//
// The screenshots are not mock-ups of the copy. Each one runs the shipping copy.js
// against a rendered document, so the toast and the pasted result are the real
// output; only the clipboard is swapped for an in-page capture, exactly as the
// tests do. The windows around them are drawn here.
//
// The store rejects PNGs with an alpha channel, so everything is written as JPEG.
const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const {svg} = require('./icon.js');

const root = path.join(__dirname, '..');
const out = path.join(root, 'store');
const code = ['color.js', 'copy.js'].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
const messages = lang => JSON.parse(fs.readFileSync(path.join(root, '_locales', lang, 'messages.json'), 'utf8'));

const copy = {
  en: {
    copyCaption: 'Select rendered Markdown, press <b>Control+Shift+9</b>',
    copySub: 'or click the toolbar button — the page’s own styles come along',
    pasteCaption: 'Paste into your editor, formatting intact',
    pasteSub: 'Colours, code highlighting, tables and lists survive the trip',
    commentCaption: 'A mode for Salesforce comments',
    commentSub: 'Callouts, task lists, tables and underlines in a form the comment editor accepts',
    darkCaption: 'Copy from a dark page, paste on white',
    darkSub: 'Backgrounds set to “Code only” here — or keep them all, or none',
    optionsCaption: 'Shape the copy for where it is going',
    optionsSub: 'Choose the paste target, the backgrounds and the code blocks',
    source: 'Rendered Markdown',
    editor: 'Your editor',
    comment: 'Case comment',
    settings: 'Boksa settings',
    doc: `
<h1>Release notes</h1>
<p>Version <strong>2.4</strong> adds <em>offline sync</em> and a new <a href="https://example.com/cli">command-line tool</a>. Run <code>sync --watch</code> to try it.</p>
<pre><code><span class="k">const</span> client = <span class="k">await</span> connect(<span class="s">"https://api.example.com"</span>);
<span class="k">for await</span> (<span class="k">const</span> change <span class="k">of</span> client.watch()) {
  apply(change); <span class="c">// merged in order</span>
}</code></pre>
<table><thead><tr><th>Platform</th><th>Status</th><th>Notes</th></tr></thead>
<tbody><tr><td>macOS</td><td class="ok">Ready</td><td>Universal build</td></tr>
<tr><td>Windows</td><td class="ok">Ready</td><td>x64 and ARM</td></tr>
<tr><td>Linux</td><td class="wip">Beta</td><td>AppImage only</td></tr></tbody></table>
<ol><li>Back up your workspace</li><li>Install the update and restart</li></ol>
<blockquote>Upgrade before <strong>1 March</strong> to keep automatic backups.</blockquote>`,
    note: `
<h2>Disk usage check</h2>
<div class="markdown-alert markdown-alert-warning"><p class="markdown-alert-title">Warning</p><p>Run this on <u>every node</u> before the upgrade.</p></div>
<ul class="tasks"><li><input type="checkbox" checked disabled> Collect the logs</li><li><input type="checkbox" disabled> Clear the cache</li></ul>
<pre><code>df -h /var/log
du -sh /srv/data</code></pre>
<table><thead><tr><th>Volume</th><th class="r">Used</th></tr></thead>
<tbody><tr><td>/var/log</td><td class="r">82%</td></tr><tr><td>/srv/data</td><td class="r">41%</td></tr><tr><td>/home</td><td class="r">7%</td></tr></tbody></table>
<p>Growth is about 10<sup>3</sup> files a day.</p>`
  },
  ko: {
    copyCaption: '렌더링된 Markdown을 선택하고 <b>Control+Shift+9</b>',
    copySub: '툴바 버튼을 눌러도 됩니다 — 페이지의 스타일이 그대로 따라옵니다',
    pasteCaption: '편집기에 서식 그대로 붙여넣기',
    pasteSub: '색상, 코드 하이라이트, 표와 목록이 그대로 유지됩니다',
    commentCaption: 'Salesforce 댓글에 맞춘 모드',
    commentSub: '콜아웃, 작업 목록, 표, 밑줄을 댓글 편집기가 받아들이는 형태로',
    darkCaption: '어두운 페이지에서 복사해 흰 문서에 붙여넣기',
    darkSub: '배경색을 ‘코드만’으로 설정한 결과 — 모두 유지하거나 모두 제거할 수도 있습니다',
    optionsCaption: '붙여넣을 곳에 맞게 복사 결과를 조절',
    optionsSub: '붙여넣을 곳, 배경색, 코드 블록을 고릅니다',
    source: '렌더링된 Markdown',
    editor: '내 편집기',
    comment: '케이스 댓글',
    settings: 'Boksa 설정',
    doc: `
<h1>릴리스 노트</h1>
<p>버전 <strong>2.4</strong>에서 <em>오프라인 동기화</em>와 새 <a href="https://example.com/cli">명령줄 도구</a>가 추가되었습니다. <code>sync --watch</code>로 실행해 보세요.</p>
<pre><code><span class="k">const</span> client = <span class="k">await</span> connect(<span class="s">"https://api.example.com"</span>);
<span class="k">for await</span> (<span class="k">const</span> change <span class="k">of</span> client.watch()) {
  apply(change); <span class="c">// 순서대로 병합</span>
}</code></pre>
<table><thead><tr><th>플랫폼</th><th>상태</th><th>비고</th></tr></thead>
<tbody><tr><td>macOS</td><td class="ok">준비 완료</td><td>Universal 빌드</td></tr>
<tr><td>Windows</td><td class="ok">준비 완료</td><td>x64 및 ARM</td></tr>
<tr><td>Linux</td><td class="wip">베타</td><td>AppImage만 제공</td></tr></tbody></table>
<ol><li>작업 공간을 백업합니다</li><li>업데이트를 설치하고 다시 시작합니다</li></ol>
<blockquote><strong>3월 1일</strong> 전에 업그레이드해야 자동 백업이 유지됩니다.</blockquote>`,
    note: `
<h2>디스크 사용량 확인</h2>
<div class="markdown-alert markdown-alert-warning"><p class="markdown-alert-title">경고</p><p>업그레이드 전에 <u>모든 노드</u>에서 실행하세요.</p></div>
<ul class="tasks"><li><input type="checkbox" checked disabled> 로그 수집</li><li><input type="checkbox" disabled> 캐시 정리</li></ul>
<pre><code>df -h /var/log
du -sh /srv/data</code></pre>
<table><thead><tr><th>볼륨</th><th class="r">사용률</th></tr></thead>
<tbody><tr><td>/var/log</td><td class="r">82%</td></tr><tr><td>/srv/data</td><td class="r">41%</td></tr><tr><td>/home</td><td class="r">7%</td></tr></tbody></table>
<p>하루에 파일이 약 10<sup>3</sup>개씩 늘어납니다.</p>`
  }
};

const fonts = 'system-ui,"Apple SD Gothic Neo",sans-serif';
// A GitHub-flavoured look, so the source reads as "rendered Markdown" at a glance.
const docStyle = `
.doc { color:#1f2328; font:15px/1.6 ${fonts}; }
.doc h1 { font-size:28px; line-height:1.25; margin:0 0 12px; padding-bottom:8px; border-bottom:1px solid #d1d9e0; }
.doc h2 { font-size:22px; line-height:1.25; margin:0 0 14px; }
.doc p { margin:0 0 14px; }
.doc a { color:#0969da; }
.doc code { font:13px Menlo,monospace; background:#eff1f3; padding:2px 6px; border-radius:6px; white-space:nowrap; }
.doc pre { background:#0d1117; color:#e6edf3; padding:14px 16px; border-radius:8px; margin:0 0 14px; white-space:pre; line-height:1.6; }
.doc pre code { background:transparent; padding:0; color:inherit; line-height:inherit; white-space:inherit; }
.doc .k { color:#ff7b72; } .doc .s { color:#a5d6ff; } .doc .c { color:#8b949e; font-style:italic; }
.doc table { border-collapse:collapse; margin:0 0 14px; }
.doc th, .doc td { border:1px solid #d1d9e0; padding:6px 14px; }
.doc th { background:#f6f8fa; font-weight:600; }
.doc .r { text-align:right; }
.doc .ok { color:#1a7f37; font-weight:600; } .doc .wip { color:#9a6700; font-weight:600; }
.doc ol, .doc ul { margin:0 0 14px; padding-left:28px; }
.doc .tasks { list-style:none; padding-left:4px; }
.doc blockquote { margin:0 0 14px; padding:4px 16px; color:#59636e; border-left:4px solid #d1d9e0; }
.doc blockquote p { margin:0; }
.doc .markdown-alert { margin:0 0 14px; padding:4px 16px; border-left:4px solid #9a6700; }
.doc .markdown-alert p { margin:0; }
.doc .markdown-alert-title { color:#9a6700; font-weight:600; }
.doc > :last-child { margin-bottom:0; }
.dark { color-scheme:dark; }
.dark .pane { background:#0d1117; }
.dark .bar { background:#161b22; border-color:#30363d; color:#9198a1; }
.dark .dot { background:#3d444d; }
.dark .doc { color:#f0f6fc; }
.dark .doc h1 { border-color:#3d444d; }
.dark .doc a { color:#4493f8; }
.dark .doc code { background:#2f353d; }
.dark .doc pre { background:#161b22; }
.dark .doc pre code { background:transparent; }
.dark .doc th, .dark .doc td { border-color:#3d444d; }
.dark .doc th { background:#161b22; }
.dark .doc .ok { color:#3fb950; } .dark .doc .wip { color:#d29922; }
.dark .doc blockquote { color:#9198a1; border-color:#3d444d; }
/* How Salesforce draws a saved comment: the quote's bar and box, paragraph and
   code spacing are its own styles; the rest is in the copied HTML. */
.saved { font:13px/1.5 ${fonts}; color:#181818; }
.saved p { margin:0 0 10px; }
.saved h2 { font-size:20px; font-weight:400; margin:0 0 12px; }
.saved blockquote { margin:0 0 14px; padding:10px 14px; border-left:3px solid #c9c9c9; background:#f3f3f3; }
.saved blockquote p { margin:0; }
.saved pre { font:12px/1.5 Menlo,monospace; background:#f3f3f3; margin:0 0 14px; padding:10px 14px; white-space:pre-wrap; }
.saved ul { margin:0 0 14px; padding-left:24px; }
.saved table { border-collapse:collapse; width:100%; margin:0 0 14px; }
.saved th, .saved td { padding:8px; }`;

const frameStyle = `
html,body { margin:0; }
body { width:1280px; height:800px; overflow:hidden; box-sizing:border-box; padding:40px 64px;
  background:linear-gradient(135deg,#4f46e5,#7c3aed); font-family:${fonts}; }
.cap { color:#fff; text-align:center; margin-bottom:28px; }
.cap h2 { font-size:36px; line-height:1.25; font-weight:700; margin:0 0 6px; letter-spacing:-.01em; }
.cap h2 b { background:#ffffff26; padding:2px 10px; border-radius:8px; }
.cap p { font-size:19px; margin:0; opacity:.9; }
.row { display:flex; gap:28px; align-items:stretch; height:600px; }
.row > .win { flex:1; min-width:0; display:flex; flex-direction:column; }
.row > .win > .pane { flex:1; }
.win { background:#fff; border-radius:12px; box-shadow:0 20px 60px #0004; overflow:hidden; }
.bar { height:34px; background:#f1f3f5; border-bottom:1px solid #e1e4e8; display:flex; align-items:center; gap:8px; padding:0 14px;
  font:13px ${fonts}; color:#57606a; flex:none; }
.dot { width:12px; height:12px; border-radius:50%; background:#d0d4d9; }
.bar span { margin-left:12px; }
.pane { padding:24px 30px; }
::selection { background:#b6d4fe; }
.doc pre ::selection { background:#264f78; }`;

function frame(lang, caption, sub, body) {
  return `<!doctype html><html lang="${lang}"><meta charset="utf-8"><style>${frameStyle}${docStyle}</style>
<div class="cap"><h2>${caption}</h2><p>${sub}</p></div>${body}</html>`;
}

function win(title, inner, {style = '', cls = ''} = {}) {
  return `<div class="win ${cls}" style="${style}"><div class="bar"><i class="dot"></i><i class="dot"></i><i class="dot"></i><span>${title}</span></div>
<div class="pane">${inner}</div></div>`;
}

// Same capture the test suite installs: copy.js believes it wrote the clipboard.
const mock = () => {
  document.execCommand = () => {
    const data = new DataTransfer();
    window.dispatchEvent(new ClipboardEvent('copy', {clipboardData: data, cancelable: true}));
    window.payload = data.getData('text/html');
    return true;
  };
};

(async () => {
  const browser = await chromium.launch({channel: 'chrome', headless: true});
  const page = await browser.newPage({viewport: {width: 1280, height: 800}, deviceScaleFactor: 1, colorScheme: 'light'});

  async function shoot(target, file) {
    const spill = await target.evaluate(() => [...document.querySelectorAll('.pane')].some(pane => pane.scrollHeight > pane.clientHeight + 1 || pane.scrollWidth > pane.clientWidth + 1) ||
      [...document.querySelectorAll('.win')].some(box => box.getBoundingClientRect().bottom > innerHeight || box.scrollHeight > box.clientHeight + 1));
    if (spill) throw new Error(`${file}: the content does not fit its window`);
    await target.screenshot({path: path.join(out, file), type: 'jpeg', quality: 94});
    console.log(`wrote store/${file}`);
  }
  // Selects #doc and runs the shipping copy on it, with the page's own strings.
  async function copyDoc(lang, options) {
    await page.evaluate(() => {
      const doc = document.getElementById('doc'), range = document.createRange();
      range.setStartBefore(doc.firstElementChild); range.setEndAfter(doc.lastElementChild);
      getSelection().removeAllRanges(); getSelection().addRange(range);
    });
    await page.evaluate(mock);
    await page.evaluate(([strings, options]) => {
      globalThis.chrome = {i18n: {getMessage: key => strings[key]?.message || ''}};
      globalThis.boksaOptions = options;
    }, [messages(lang), {target: 'generic', ...options}]);
    const result = await page.evaluate(code);
    if (!result?.ok) throw new Error(`copy.js failed while rendering the ${lang} screenshots: ${result?.error}`);
    return page.evaluate(() => window.payload);
  }
  // The source beside an editor holding the real copied HTML.
  async function sideBySide(lang, caption, sub, source, editor, options, file) {
    await page.setContent(frame(lang, caption, sub, `<div class="row">${source}${editor}</div>`));
    const html = await copyDoc(lang, options);
    await page.evaluate(html => {
      getSelection().removeAllRanges();
      document.getElementById('editor').innerHTML = html;
      // The confirmation belongs to the first screenshot.
      for (const child of [...document.body.children]) if (!child.matches('.cap, .row')) child.remove();
      for (const child of [...document.documentElement.children]) if (!['HEAD', 'BODY'].includes(child.tagName)) child.remove();
    }, html);
    await shoot(page, file);
  }

  for (const [lang, c] of Object.entries(copy)) {
    // 1. Selection and the real confirmation.
    await page.setContent(frame(lang, c.copyCaption, c.copySub,
      win('release-notes.md', `<div class="doc" id="doc">${c.doc}</div>`)));
    await copyDoc(lang, {});
    await shoot(page, `screenshot-1-copy-${lang}.jpg`);

    // 2. Pasted with every style.
    await sideBySide(lang, c.pasteCaption, c.pasteSub,
      win(c.source, `<div class="doc" id="doc">${c.doc}</div>`),
      win(c.editor, '<div id="editor"></div>'), {}, `screenshot-2-paste-${lang}.jpg`);

    // 3. The Salesforce target, drawn as a saved comment.
    await sideBySide(lang, c.commentCaption, c.commentSub,
      win(c.source, `<div class="doc" id="doc">${c.note}</div>`),
      win(c.comment, '<div class="saved" id="editor"></div>'), {target: 'salesforce'}, `screenshot-3-comment-${lang}.jpg`);

    // 4. A dark page with only code backgrounds kept.
    await sideBySide(lang, c.darkCaption, c.darkSub,
      win(c.source, `<div class="doc" id="doc">${c.doc}</div>`, {cls: 'dark'}),
      win(c.editor, `<div id="editor" style="color:#1f2328;font:15px/1.6 ${fonts.replaceAll('"', "'")}"></div>`), {backgrounds: 'code'}, `screenshot-4-dark-${lang}.jpg`);

    // 5. The real options page, with its own strings: the first four groups, in two
    // columns of one scale.
    const options = await browser.newPage({viewport: {width: 600, height: 900}, deviceScaleFactor: 2, colorScheme: 'light'});
    await options.addInitScript(([strings, lang]) => {
      const store = {target: 'generic', backgrounds: 'code', textBackgrounds: 'soft', codeBlocks: 'robust'};
      globalThis.chrome = {
        i18n: {getMessage: key => strings[key]?.message || '', getUILanguage: () => lang},
        storage: {sync: {get: async defaults => ({...defaults, ...store}), set: async () => {}, clear: async () => {}}},
        tabs: {create() {}}
      };
    }, [messages(lang), lang]);
    await options.goto('file://' + path.join(root, 'options.html'));
    await options.waitForTimeout(200);
    const edges = await options.evaluate(() => [...document.querySelectorAll('fieldset')].map(set => { const box = set.getBoundingClientRect(); return [box.top, box.bottom]; }));
    const part = async (top, bottom) => (await options.screenshot({fullPage: true, clip: {x: 8, y: top, width: 584, height: bottom - top}})).toString('base64');
    const columns = [await part(0, edges[1][1] + 8), await part(edges[2][0] - 4, edges[3][1] + 8)];
    const scale = 586 / Math.max(edges[1][1] + 8, edges[3][1] + 8 - (edges[2][0] - 4));
    await options.close();
    await page.setContent(frame(lang, c.optionsCaption, c.optionsSub,
      win(c.settings, `<div style="display:flex;gap:24px;justify-content:center;align-items:center">${columns.map(shot =>
        `<img src="data:image/png;base64,${shot}" style="display:block;width:${Math.floor(584 * scale)}px">`).join('')}</div>`,
      {style: 'height:640px'}).replace('class="pane"', 'class="pane" style="padding:10px 24px"')));
    await page.evaluate(() => Promise.all([...document.images].map(image => image.decode())));
    await shoot(page, `screenshot-5-options-${lang}.jpg`);
  }

  // Promo tiles. The store shows one of each for every language, so they carry the
  // name and no sentence; a fresh page each, as resizing one clips the picture.
  const tileStyle = `html,body{margin:0;height:100%} body{display:flex;align-items:center;justify-content:center;box-sizing:border-box;overflow:hidden;
    background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-family:${fonts}} h1{margin:0;letter-spacing:-.02em;line-height:1} svg{flex:none}`;
  const tile = async (width, height, html, file) => {
    const promo = await browser.newPage({viewport: {width, height}, deviceScaleFactor: 1});
    await promo.setContent(`<!doctype html><meta charset="utf-8"><style>${tileStyle}</style>${html}`);
    await shoot(promo, file);
    await promo.close();
  };
  // A card of formatted lines, and the same card again: what goes in comes out.
  const card = width => `<svg width="${width}" height="${width * 1.2}" viewBox="0 0 200 240"><rect width="200" height="240" rx="14" fill="#fff"/>
    <rect x="22" y="24" width="112" height="16" rx="8" fill="#1f2328"/><rect x="22" y="56" width="156" height="9" rx="4.5" fill="#c9d1d9"/><rect x="22" y="73" width="64" height="9" rx="4.5" fill="#c9d1d9"/><rect x="92" y="73" width="50" height="9" rx="4.5" fill="#4f46e5"/>
    <rect x="22" y="96" width="156" height="58" rx="8" fill="#0d1117"/><rect x="34" y="108" width="34" height="8" rx="4" fill="#ff7b72"/><rect x="74" y="108" width="74" height="8" rx="4" fill="#e6edf3"/><rect x="46" y="122" width="60" height="8" rx="4" fill="#a5d6ff"/><rect x="34" y="136" width="46" height="8" rx="4" fill="#8b949e"/>
    <g fill="none" stroke="#d1d9e0" stroke-width="2"><rect x="22" y="170" width="156" height="48" rx="4"/><path d="M22 194H178M100 170V218"/></g>
    <rect x="34" y="178" width="46" height="8" rx="4" fill="#59636e"/><rect x="112" y="178" width="40" height="8" rx="4" fill="#59636e"/><rect x="34" y="202" width="40" height="8" rx="4" fill="#c9d1d9"/><rect x="112" y="202" width="34" height="8" rx="4" fill="#10b981"/></svg>`;
  const arrow = size => `<svg width="${size}" height="${size}" viewBox="0 0 64 64"><path d="M8 32H52M36 14L54 32L36 50" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const badge = size => `<div style="display:flex;filter:drop-shadow(0 0 1px #ffffff90) drop-shadow(0 8px 18px #0004)">${svg(size)}</div>`;
  await tile(440, 280, `<div style="display:flex;align-items:center;gap:26px">${badge(128)}<h1 style="font-size:64px">Boksa</h1></div>`, 'promo-small-440x280.jpg');
  await tile(1400, 560, `<div style="display:flex;align-items:center;gap:90px"><div style="display:flex;flex-direction:column;align-items:center;gap:30px">${badge(190)}<h1 style="font-size:104px">Boksa</h1></div>
    <div style="display:flex;align-items:center;gap:36px;filter:drop-shadow(0 18px 40px #0004)">${card(290)}${arrow(84)}${card(290)}</div></div>`, 'promo-marquee-1400x560.jpg');

  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
