# Privacy Policy — Boksa

**Effective date:** 25 November 2026
**Publisher:** Sungju Kwon · https://github.com/sungju/boksa-extension
**Contact:** https://github.com/sungju/boksa-extension/blob/main/SUPPORT.md

*[한국어 버전은 아래에 있습니다.](#개인정보처리방침--boksa)*

## Summary

Boksa collects nothing and sends nothing to Sungju Kwon or anyone else. The only
thing it stores is your own copy settings, which Chrome may sync to your Google
account like any other browser setting. It has no server component, no
analytics, and no accounts. Copying happens locally in your browser, only at
the moment you ask for it.

## What Boksa does with page content

Boksa runs only when you explicitly invoke it — by pressing its keyboard
shortcut or clicking its toolbar button. It is not a background observer and
registers no automatically-injected content script.

When invoked, it reads what you have selected in the current tab (or the whole
page, if nothing is selected) along with the styles the browser has computed for
it, converts them into formatted HTML in memory, and writes the result to your
system clipboard. The data exists only for the duration of that single operation
and is discarded as soon as it completes.

## What Boksa does not do

- It does not collect, record, or profile anything you browse, select, or copy.
- It does not send any data anywhere. The extension makes no network requests.
- It stores no page content. The only thing it keeps is your copy settings
  (the choices on its options page), saved with `chrome.storage.sync`. If
  Chrome Sync is on, Chrome carries them to your other devices through your
  Google account, the same way it syncs your other browser settings; Sungju Kwon
  never receives them. No cookies, `localStorage`, or `IndexedDB` are used.
- It does not **read** your clipboard. The `clipboardWrite` permission grants
  write access only.
- It contains no analytics, telemetry, crash reporting, or advertising code.
- It loads no remote code. All logic ships inside the extension package.
- It has no login, account, or user identifier.

## Permissions and why each one exists

| Permission | Why it is needed |
|---|---|
| `activeTab` | Temporary access to the one tab you invoked Boksa on, granted by your click or shortcut and used only for that copy. Chrome ends it when the tab goes to another site or is closed. |
| `scripting` | Runs the copy routine in that tab to read the selection and its styles. |
| `clipboardWrite` | Places the formatted result on your clipboard. Grants no read access. |
| `storage` | Saves your copy settings (paste target, backgrounds, text backgrounds, code blocks, syntax colours, fonts). Nothing from any page is ever written to it. |
| `host_permissions: file:///*` | Lets Boksa work on local Markdown files opened as `file:///…`. Chrome only exposes the per-extension **Allow access to file URLs** toggle to extensions that declare this, and the toggle is **off** until you turn it on yourself. |

Boksa does not request persistent access to all websites.

## Two things worth knowing about copied output

These are properties of copying formatted content, and we would rather state
them plainly than leave you to discover them:

- **Local file paths are deliberately removed.** If your selection contains
  `file:` links or images, Boksa strips them rather than copying them. Such
  paths usually contain your account name and would leak it into any document
  you paste into. `file:` images are replaced by their alt text and `file:`
  links become plain text.
- **Remote image URLs are preserved.** If the page you copied from contains an
  `https://` image, that URL remains in the copied HTML. Whoever later opens
  the document you pasted into may therefore load that image from its original
  host. This is how pasting rich content works in general, but it is worth
  being aware of when copying from a private or authenticated page.

## Data disclosure for the Chrome Web Store

Sungju Kwon certifies that Boksa collects **none** of the user data categories
defined by the Chrome Web Store programme: no personally identifiable
information, health information, financial information, authentication
information, personal communications, location, web history, user activity, or
website content is collected or transmitted. No data is sold or transferred to
third parties. No data is used for purposes unrelated to the extension's single
function, nor for creditworthiness or lending.

## Changes

Any revision to this policy will be published at this URL with an updated
effective date. Material changes will also be noted in the extension's Web
Store listing.

## Contact

Questions about this policy: https://github.com/sungju/boksa-extension/blob/main/SUPPORT.md

---

# 개인정보처리방침 — Boksa

**시행일:** 2026년 11월 25일
**제공자:** Sungju Kwon · https://github.com/sungju/boksa-extension
**문의:** https://github.com/sungju/boksa-extension/blob/main/SUPPORT.md

## 요약

Boksa는 어떠한 정보도 수집하지 않으며 Sungju Kwon이나 다른 누구에게도 보내지 않습니다. 저장하는 것은 사용자의 복사 설정뿐이며, 다른 브라우저 설정처럼 Chrome이 Google 계정으로 동기화할 수 있습니다. 서버도, 분석 도구도, 계정도
없습니다. 모든 동작은 사용자가 요청한 그 순간에 브라우저 안에서만 일어납니다.

## 페이지 내용을 어떻게 다루는가

Boksa는 사용자가 단축키를 누르거나 툴바 버튼을 클릭해 **명시적으로 실행할 때만**
동작합니다. 배경에서 관찰하지 않으며, 자동으로 삽입되는 content script를
등록하지 않습니다.

실행되면 현재 탭에서 선택한 내용(선택한 것이 없으면 페이지 전체)과 브라우저가
계산한 스타일을 읽어, 메모리 안에서 서식이 포함된 HTML로 변환한 뒤 시스템 클립보드에 기록합니다.
이 데이터는 해당 동작이 진행되는 동안에만 존재하며 완료 즉시 사라집니다.

## Boksa가 하지 않는 일

- 열람·선택·복사한 내용을 수집하거나 기록하거나 프로파일링하지 않습니다.
- 데이터를 외부로 전송하지 않습니다. 확장 프로그램은 네트워크 요청을 하지 않습니다.
- 페이지 내용은 저장하지 않습니다. 저장하는 것은 설정 페이지의 복사 옵션
  선택값뿐이며 `chrome.storage.sync`에 보관합니다. Chrome 동기화가 켜져 있으면
  다른 브라우저 설정과 마찬가지로 Chrome이 Google 계정을 통해 다른 기기로
  동기화하며, Sungju Kwon은 이 설정을 받지 않습니다. 쿠키, `localStorage`,
  `IndexedDB`는 사용하지 않습니다.
- 클립보드를 **읽지** 않습니다. `clipboardWrite` 권한은 쓰기 전용입니다.
- 분석, 텔레메트리, 오류 수집, 광고 코드가 없습니다.
- 원격 코드를 불러오지 않습니다. 모든 로직은 확장 프로그램 패키지 안에 있습니다.
- 로그인, 계정, 사용자 식별자가 없습니다.

## 권한과 그 이유

| 권한 | 필요한 이유 |
|---|---|
| `activeTab` | 사용자가 실행한 바로 그 탭에 대한 일시적 접근. 클릭이나 단축키로 부여되며 그 복사에만 사용합니다. 탭이 다른 사이트로 이동하거나 닫히면 Chrome이 접근을 끝냅니다. |
| `scripting` | 해당 탭에서 복사 로직을 실행해 선택 영역과 스타일을 읽습니다. |
| `clipboardWrite` | 변환된 결과를 클립보드에 기록합니다. 읽기 권한은 없습니다. |
| `storage` | 복사 설정(붙여넣을 곳, 배경색, 글자 배경, 코드 블록, 구문 강조, 글꼴)을 저장합니다. 페이지의 내용은 기록하지 않습니다. |
| `host_permissions: file:///*` | `file:///…`로 열린 로컬 Markdown 파일에서 동작하기 위해 필요합니다. Chrome은 이 선언이 있는 확장 프로그램에만 **파일 URL에 대한 액세스 허용** 토글을 노출하며, 이 토글은 사용자가 직접 켜기 전까지 꺼져 있습니다. |

Boksa는 모든 웹사이트에 대한 상시 접근 권한을 요청하지 않습니다.

## 복사 결과에 관해 알아둘 두 가지

서식 있는 내용을 복사할 때 본질적으로 따라오는 특성이며, 사용자가 나중에
알게 되기보다 미리 밝히는 편이 낫다고 판단했습니다.

- **로컬 파일 경로는 의도적으로 제거합니다.** 선택 영역에 `file:` 링크나 이미지가
  있으면 복사하지 않고 제외합니다. 이러한 경로에는 보통 계정 이름이 포함되어
  있어, 붙여넣는 문서에 그대로 남으면 노출되기 때문입니다. `file:` 이미지는 대체
  텍스트로, `file:` 링크는 일반 텍스트로 바뀝니다.
- **원격 이미지 URL은 유지됩니다.** 복사한 페이지에 `https://` 이미지가 있으면 그
  URL이 복사된 HTML에 남습니다. 따라서 붙여넣은 문서를 나중에 여는 쪽에서 원래
  호스트로부터 그 이미지를 불러올 수 있습니다. 서식 있는 복사 전반에 해당하는
  동작이지만, 비공개 페이지나 로그인이 필요한 페이지에서 복사할 때는 유념할
  필요가 있습니다.

## Chrome 웹 스토어 데이터 공시

Sungju Kwon은 Boksa가 Chrome 웹 스토어가 정의한 사용자 데이터 항목을 **전혀**
수집하지 않음을 확인합니다. 개인 식별 정보, 건강 정보, 금융 정보, 인증 정보,
개인 통신, 위치, 웹 열람 기록, 사용자 활동, 웹사이트 콘텐츠 중 어느 것도
수집하거나 전송하지 않습니다. 제3자에게 데이터를 판매하거나 이전하지 않습니다.
확장 프로그램의 본래 기능과 무관한 목적이나 신용도 평가·대출 목적으로 데이터를
사용하지 않습니다.

## 변경

이 방침이 개정되면 시행일을 갱신하여 같은 URL에 게시합니다. 중요한 변경 사항은
웹 스토어 등록 정보에도 함께 안내합니다.

## 문의

이 방침에 관한 문의: https://github.com/sungju/boksa-extension/blob/main/SUPPORT.md
