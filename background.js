'use strict';
const running = new Set();
const t = (key, subs) => chrome.i18n.getMessage(key, subs);
// A frozen or discarded tab can leave executeScript pending forever, which would
// otherwise keep the tab id in `running` and silently ignore every later press.
const TIMEOUT = 15000;
async function badge(tabId, text, color, title) {
  await Promise.all([
    chrome.action.setBadgeBackgroundColor({tabId, color}).catch(() => {}),
    chrome.action.setBadgeText({tabId, text}).catch(() => {}),
    chrome.action.setTitle({tabId, title}).catch(() => {})
  ]);
}
async function copy(tab) {
  if (!tab?.id) return;
  const tabId = tab.id;
  if (running.has(tabId)) {
    await badge(tabId, '…', '#6b7280', t('badgeBusyTitle'));
    return;
  }
  running.add(tabId);
  // Clear first so a stale badge is never mistaken for this run's result.
  await badge(tabId, '', '#6b7280', t('actionTitle'));
  try {
    // Once the timeout has been reported, a late step must not go on to write
    // the clipboard behind the error badge.
    let timedOut = false;
    const results = await Promise.race([
      (async () => {
        // Handed over in the isolated world copy.js runs in, which the page
        // cannot see or tamper with. A storage failure just means defaults.
        const options = await chrome.storage.sync.get(null).catch(() => ({}));
        if (timedOut) return [];
        await chrome.scripting.executeScript({target: {tabId}, func: saved => { globalThis.boksaOptions = saved; }, args: [options]});
        if (timedOut) return [];
        // color.js defines the shared colour helpers copy.js reads.
        return chrome.scripting.executeScript({target: {tabId}, files: ['color.js', 'copy.js']});
      })(),
      new Promise((_, reject) => setTimeout(() => { timedOut = true; reject(new Error(t('errTimeout'))); }, TIMEOUT))
    ]);
    const result = results[0]?.result;
    if (!result?.ok) throw new Error(result?.error || t('errUnknown'));
    // Every call is guarded: the clipboard already holds the copy, so a closed
    // tab rejecting a badge update must not be reported as a failed copy.
    await badge(tabId, 'OK', '#18794e', t('badgeDoneTitle'));
    // Best effort: an evicted service worker may leave the badge in place.
    setTimeout(() => chrome.action.setBadgeText({tabId, text: ''}).catch(() => {}), 4000);
  } catch (error) {
    await badge(tabId, '!', '#b42318', t('badgeFailTitle', [error.message]));
  } finally { running.delete(tabId); }
}
chrome.action.onClicked.addListener(copy);
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (!['copy-rich', 'copy-rich-alternative'].includes(command)) return;
  tab ||= (await chrome.tabs.query({active: true, currentWindow: true}))[0];
  await copy(tab);
});
