// Renders the Chrome Web Store listing images: screenshots and the promo tile.
// Run: node tools/make-store-assets.cjs
//
// The screenshots are not mock-ups. Each one runs the shipping copy.js against a
// rendered document, so the toast and the pasted result are the real output; only
// the clipboard is swapped for an in-page capture, exactly as the tests do.
//
// The store rejects PNGs with an alpha channel, so everything is written as JPEG.
const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const {svg} = require('./icon.js');

const root = path.join(__dirname, '..');
const out = path.join(root, 'store');
const code = ['color.js', 'copy.js'].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');

const copy = {
  en: {
    toast: 'Copied with styles — paste into your editor',
    copyCaption: 'Select rendered Markdown and press <b>Control+Shift+9</b>',
    copySub: 'or click the toolbar button — the page’s own styles come along',
    pasteCaption: 'Paste into any rich-text editor, formatting intact',
    pasteSub: 'Colours, code highlighting, tables and lists survive the trip',
    source: 'Rendered Markdown',
    optionsCaption: 'Shape the copy for where it is going',
    optionsSub: 'A Salesforce mode, softer backgrounds, editor-safe code blocks',
    editor: 'Your editor',
    tagline: 'Copy Markdown with its styles',
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
<blockquote>Upgrade before <strong>1 March</strong> to keep automatic backups.</blockquote>`
  },
  ko: {
    toast: '스타일 포함 복사 완료 — 편집기에 붙여넣으세요',
    copyCaption: '렌더링된 Markdown을 선택하고 <b>Control+Shift+9</b>',
    copySub: '툴바 버튼을 눌러도 됩니다 — 페이지의 스타일이 그대로 따라옵니다',
    pasteCaption: '어떤 리치 텍스트 편집기에도 서식 그대로 붙여넣기',
    pasteSub: '색상, 코드 하이라이트, 표와 목록이 그대로 유지됩니다',
    source: '렌더링된 Markdown',
    optionsCaption: '붙여넣을 곳에 맞게 복사 결과를 조절',
    optionsSub: 'Salesforce 모드, 연한 배경, 편집기 호환 코드 블록',
    editor: '내 편집기',
    tagline: 'Markdown을 스타일 그대로 복사',
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
<blockquote><strong>3월 1일</strong> 전에 업그레이드해야 자동 백업이 유지됩니다.</blockquote>`
  }
};

// A GitHub-flavoured look, so the source reads as "rendered Markdown" at a glance.
const docStyle = `
.doc { color:#1f2328; font:15px/1.6 -apple-system,"Apple SD Gothic Neo",system-ui,sans-serif; }
.doc h1 { font-size:28px; margin:0 0 12px; padding-bottom:8px; border-bottom:1px solid #d1d9e0; }
.doc p { margin:0 0 14px; }
.doc a { color:#0969da; }
.doc code { font:13px Menlo,monospace; background:#eff1f3; padding:2px 6px; border-radius:6px; }
.doc pre { background:#0d1117; color:#e6edf3; padding:14px 16px; border-radius:8px; margin:0 0 14px; white-space:pre; }
.doc pre code { background:transparent; padding:0; color:inherit; }
.doc .k { color:#ff7b72; } .doc .s { color:#a5d6ff; } .doc .c { color:#8b949e; font-style:italic; }
.doc table { border-collapse:collapse; margin:0 0 14px; }
.doc th, .doc td { border:1px solid #d1d9e0; padding:6px 14px; }
.doc th { background:#f6f8fa; font-weight:600; }
.doc .ok { color:#1a7f37; font-weight:600; } .doc .wip { color:#9a6700; font-weight:600; }
.doc blockquote { margin:0; padding:4px 16px; color:#59636e; border-left:4px solid #d1d9e0; }`;

const frameStyle = `
html,body { margin:0; }
body { width:1280px; height:800px; overflow:hidden; box-sizing:border-box; padding:44px 64px;
  background:linear-gradient(135deg,#4f46e5,#7c3aed); font-family:-apple-system,"Apple SD Gothic Neo",system-ui,sans-serif; }
.cap { color:#fff; text-align:center; margin-bottom:28px; }
.cap h2 { font-size:34px; font-weight:700; margin:0 0 6px; letter-spacing:-.01em; }
.cap h2 b { background:#ffffff26; padding:2px 10px; border-radius:8px; }
.cap p { font-size:18px; margin:0; opacity:.85; }
.win { background:#fff; border-radius:12px; box-shadow:0 20px 60px #0004; overflow:hidden; }
.bar { height:34px; background:#f1f3f5; border-bottom:1px solid #e1e4e8; display:flex; align-items:center; gap:8px; padding:0 14px;
  font:13px system-ui; color:#57606a; }
.dot { width:12px; height:12px; border-radius:50%; background:#d0d4d9; }
.bar span { margin-left:12px; }
.pane { padding:22px 30px; }
::selection { background:#b6d4fe; }
.doc pre ::selection { background:#264f78; }`;

function frame(caption, sub, body) {
  return `<!doctype html><html><meta charset="utf-8"><style>${frameStyle}${docStyle}</style>
<div class="cap"><h2>${caption}</h2><p>${sub}</p></div>${body}</html>`;
}

function win(title, inner, extra = '') {
  return `<div class="win" ${extra}><div class="bar"><i class="dot"></i><i class="dot"></i><i class="dot"></i><span>${title}</span></div>
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

async function shoot(page, file) {
  await page.screenshot({path: path.join(out, file), type: 'jpeg', quality: 92});
  console.log(`wrote store/${file}`);
}

(async () => {
  const browser = await chromium.launch({channel: 'chrome', headless: true});
  const page = await browser.newPage({viewport: {width: 1280, height: 800}, deviceScaleFactor: 1});

  for (const [lang, c] of Object.entries(copy)) {
    // 1. Selection + the real confirmation toast.
    await page.setContent(frame(c.copyCaption, c.copySub,
      win('release-notes.md', `<div class="doc" id="doc">${c.doc}</div>`)));
    await page.evaluate(() => {
      const doc = document.getElementById('doc'), r = document.createRange();
      r.setStartBefore(doc.querySelector('h1')); r.setEndAfter(doc.querySelector('blockquote'));
      getSelection().removeAllRanges(); getSelection().addRange(r);
    });
    await page.evaluate(mock);
    // Show the localised toast exactly as chrome.i18n would resolve it.
    const result = await page.evaluate(`globalThis.chrome = {i18n: {getMessage: k => k === 'toastDone' ? ${JSON.stringify(c.toast)} : ''}}; ${code}`);
    if (!result?.ok) throw new Error(`copy.js failed while rendering the ${lang} screenshot: ${result?.error}`);
    const html = await page.evaluate(() => window.payload);
    await shoot(page, `screenshot-1-copy-${lang}.jpg`);

    // 2. Source beside an editor holding the real copied HTML.
    await page.setContent(frame(c.pasteCaption, c.pasteSub, `<div style="display:flex;gap:28px;align-items:flex-start">
      ${win(c.source, `<div class="doc" style="zoom:.78">${c.doc}</div>`, 'style="flex:1"')}
      ${win(c.editor, `<div contenteditable="true" style="outline:none;zoom:.78" id="editor"></div>`, 'style="flex:1"')}
    </div>`));
    await page.evaluate(h => { document.getElementById('editor').innerHTML = h; }, html);
    await shoot(page, `screenshot-2-paste-${lang}.jpg`);
  }

  // 3. The real options page, rendered with its own locale strings.
  for (const [lang, c] of Object.entries(copy)) {
    const messages = JSON.parse(fs.readFileSync(path.join(root, '_locales', lang, 'messages.json'), 'utf8'));
    const options = await browser.newPage({viewport: {width: 600, height: 900}, deviceScaleFactor: 1});
    await options.addInitScript(([messages, lang]) => {
      const store = {target: 'salesforce', textBackgrounds: 'soft'};
      globalThis.chrome = {
        i18n: {getMessage: key => messages[key]?.message || '', getUILanguage: () => lang},
        storage: {sync: {get: async defaults => ({...defaults, ...store}), set: async () => {}, clear: async () => {}}},
        tabs: {create() {}}
      };
    }, [messages, lang]);
    await options.goto('file://' + path.join(root, 'options.html'));
    await options.waitForTimeout(200);
    const shot = (await options.screenshot({fullPage: true})).toString('base64');
    await options.close();
    await page.setContent(frame(c.optionsCaption, c.optionsSub,
      win(lang === 'ko' ? 'Boksa 설정' : 'Boksa settings',
        `<img src="data:image/png;base64,${shot}" style="display:block;width:100%">`,
        'style="width:560px;margin:0 auto;max-height:640px;overflow:hidden"')));
    await shoot(page, `screenshot-3-options-${lang}.jpg`);
  }

  // Small promo tile, 440x280.
  await page.setViewportSize({width: 440, height: 280});
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0} body{width:440px;height:280px;display:flex;align-items:center;gap:26px;padding:0 36px;box-sizing:border-box;
    background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-family:-apple-system,system-ui,sans-serif}
    h1{font-size:44px;margin:0;letter-spacing:-.02em} p{font-size:18px;margin:6px 0 0;opacity:.9;line-height:1.35}
    svg{flex:none;filter:drop-shadow(0 8px 18px #0003)}</style>
    ${svg(128)}<div><h1>Boksa</h1><p>${copy.en.tagline}</p></div>`);
  await shoot(page, 'promo-small-440x280.jpg');

  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
