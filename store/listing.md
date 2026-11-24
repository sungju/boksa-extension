# Chrome Web Store listing — Boksa

Everything the Developer Dashboard asks for, in the order its tabs ask for it.
Upload `boksa-store-<version>.zip` from `npm run package:store`; images are regenerated with
`npm run store-assets`.

## Package

| Field | Value |
|---|---|
| Upload | `boksa-store-1.5.6.zip` from `npm run package:store` (manifest at the archive root — the plain `npm run package` ZIP nests it in a folder and is rejected) |
| Name / summary | Come from `_locales/*/messages.json` (`extName`, `extDescription`) — not editable in the dashboard |

## Store listing tab

| Field | Value |
|---|---|
| Category | Productivity → Tools |
| Language | English (add Korean as a second localized listing) |
| Store icon (128×128) | `store/icon-128.png` — 96×96 artwork with 16px transparent padding, per Google's icon guidelines. Not `icons/icon-128.png`, which is full-bleed for the browser toolbar |
| Screenshots (1280×800) | `store/screenshot-1-copy-en.jpg`, `store/screenshot-2-paste-en.jpg`, `store/screenshot-3-options-en.jpg` (Korean listing: the `-ko` files) |
| Small promo tile (440×280) | `store/promo-small-440x280.jpg` |
| Homepage URL | https://baramsoft.com |
| Support URL | https://baramsoft.com/support/ |

### Description — English

```
Boksa copies a selection of rendered Markdown as rich HTML, carrying the page's own computed styles with it. Paste into a web editor, email or document and it looks the way it did on screen — colours, fonts, code highlighting, tables and lists included.

HOW TO USE
1. Open a rendered Markdown page (a Markdown viewer, a docs site, a README preview).
2. Select the part you want, or select nothing to copy the whole page.
3. Press Control+Shift+9 (Control+Shift+8 as an alternate), or click the Boksa toolbar button.
4. Paste with ⌘V / Ctrl+V into your editor.

WHAT IS PRESERVED
• Headings, bold/italic, links (made absolute), inline code and code blocks with syntax highlighting
• Tables with borders and backgrounds, ordered/unordered lists with their numbering, block quotes, task-list checkboxes
• Colour, background, font, size, weight, spacing, borders and radius from the page's computed styles
• Partial selections keep only what you selected, with the surrounding structure they need

YOUR CHOICE OF OUTPUT (right-click the toolbar button → Options)
• Backgrounds: keep all, keep only code backgrounds, or none — light text meant for a dark page stays readable
• Paste target: any editor, shaped for Salesforce Lightning rich-text fields (case comments, email), or kept readable for comments also shown in the Red Hat Customer Portal
• Backgrounds behind text (inline code, highlights): keep, soften to a pale tint, or remove
• Code blocks: standard HTML, or editor-safe with line breaks and indentation fixed in place for Google Docs, Gmail and similar editors
• Syntax highlighting colours on or off
• Keep the page's fonts, or let the editor's font apply while code stays monospaced

SAFE BY DESIGN
• Scripts, event handlers, form controls, unsafe links and invisible text are stripped from the copied HTML
• Local file paths are removed so your account name never leaks into a pasted document
• Inline styles are written only where they differ, keeping the HTML small enough for editors that truncate large pastes

LOCAL FILES
To use Boksa on file:/// Markdown files, open the extension's Details page and turn on "Allow access to file URLs".

PRIVACY
Boksa runs only when you press the shortcut or click the button, only on that tab. It collects nothing and sends nothing to us or anyone else; the only thing it saves is your own settings, which Chrome may sync with your other browser settings. There is no analytics and no remote code.

Shortcuts can be changed at chrome://extensions/shortcuts.

Boksa is not affiliated with or endorsed by Red Hat or Salesforce. Product names are trademarks of their owners.

Made by Sungju Kwon — https://baramsoft.com
```

### Description — 한국어

```
Boksa는 렌더링된 Markdown에서 선택한 부분을 페이지의 계산된 스타일과 함께 Rich HTML로 복사합니다. 웹 에디터, 메일, 문서에 붙여넣으면 색상, 글꼴, 코드 하이라이트, 표와 목록까지 화면에서 보던 모습 그대로 나타납니다.

사용 방법
1. Markdown 뷰어, 문서 사이트, README 미리보기 등 렌더링된 Markdown 페이지를 엽니다.
2. 복사할 부분을 선택합니다. 아무것도 선택하지 않으면 페이지 전체를 복사합니다.
3. Control+Shift+9(대체 키 Control+Shift+8)를 누르거나 툴바의 Boksa 버튼을 클릭합니다.
4. 편집기에 ⌘V / Ctrl+V로 붙여넣습니다.

보존하는 항목
• 제목, 굵게/기울임, 링크(절대 주소로 변환), 인라인 코드, 구문 강조가 적용된 코드 블록
• 테두리와 배경이 있는 표, 번호가 유지되는 순서/비순서 목록, 인용문, 작업 목록 체크 상태
• 페이지의 계산된 스타일에서 가져온 글자색, 배경, 글꼴, 크기, 굵기, 간격, 테두리, 모서리
• 일부만 선택하면 선택한 부분만, 필요한 상위 구조와 함께 복사

원하는 결과물 선택 (툴바 버튼 우클릭 → 옵션)
• 배경색: 모두 유지, 코드 배경만 유지, 사용 안 함 — 어두운 페이지의 밝은 글자도 읽을 수 있게 처리
• 붙여넣을 곳: 모든 편집기, Salesforce Lightning 서식 입력란(케이스 코멘트, 이메일)에 맞춤, 또는 Red Hat 고객 포털에도 표시되는 댓글용
• 글자 배경(인라인 코드, 강조 표시): 유지, 연하게, 제거
• 코드 블록: 표준 HTML, 또는 Google Docs·Gmail 등을 위해 줄바꿈과 들여쓰기를 고정하는 편집기 호환 방식
• 구문 강조 색상 켜기/끄기
• 페이지 글꼴 유지, 또는 편집기 글꼴 사용(코드는 고정폭 유지)

안전한 설계
• 스크립트, 이벤트 핸들러, 폼 요소, 위험한 링크, 화면에 보이지 않는 텍스트는 복사 결과에서 제거
• 로컬 파일 경로를 제거해 사용자 계정 이름이 붙여넣은 문서에 남지 않음
• 인라인 스타일은 달라지는 곳에만 기록해, 큰 붙여넣기를 잘라내는 편집기에서도 문제가 적음

로컬 파일
file:/// Markdown 파일에서 사용하려면 확장 프로그램 세부정보에서 "파일 URL에 대한 액세스 허용"을 켜세요.

개인정보
Boksa는 단축키나 버튼을 누를 때 해당 탭에서만 실행됩니다. 어떤 정보도 수집하거나 외부로 보내지 않으며, 저장하는 것은 사용자의 설정뿐입니다(다른 브라우저 설정처럼 Chrome 동기화될 수 있음). 분석 도구나 원격 코드도 없습니다.

단축키는 chrome://extensions/shortcuts에서 바꿀 수 있습니다.

Boksa는 Red Hat 또는 Salesforce와 제휴하거나 이들의 보증을 받은 제품이 아닙니다. 제품 이름은 각 소유자의 상표입니다.

Sungju Kwon — https://baramsoft.com
```

## Privacy practices tab

**Single purpose**

```
Copies the user's current text selection on a rendered Markdown page to the clipboard as rich HTML that keeps the page's visual styles.
```

**Permission justifications**

| Permission | Justification |
|---|---|
| `activeTab` | Grants temporary access to the tab the user invokes Boksa on (toolbar click or keyboard shortcut) so the selected content can be read. No access is kept after the action. |
| `scripting` | Injects the copy routine into that active tab on demand to read the selection and its computed styles and build the HTML. Nothing is injected without a user action. |
| `storage` | Saves the user's copy settings from the options page (paste target, background, text background, code block, highlighting and font choices). No page content or browsing data is ever stored. |
| `clipboardWrite` | Writes the formatted HTML and plain text of the selection to the clipboard, which is the extension's single purpose. The clipboard is never read. |
| Host permission `file:///*` | Needed so users can copy from local Markdown files opened as file:/// URLs. Chrome only offers the "Allow access to file URLs" toggle to extensions that declare it; the toggle stays off until the user enables it. No http/https hosts are requested. |
| Remote code | No. All code ships in the package; nothing is fetched or evaluated at runtime. |

**Data usage** — tick none of the data categories, then tick all three certifications:

- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL** — host `store/privacy.html` at a public address first
(e.g. `https://baramsoft.com/boksa/privacy/`) and enter that URL.

## Distribution tab

| Field | Value |
|---|---|
| Payments | Free |
| Visibility | Public (or Unlisted for a soft launch) |
| Regions | All regions |
