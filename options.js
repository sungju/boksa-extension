'use strict';
// Must match the defaults in copy.js, which are what an empty storage means.
const defaults = {target: 'generic', backgrounds: 'all', textBackgrounds: 'keep', softLighten: 92, softSaturation: 35,
  codeBlocks: 'standard', highlight: true, fonts: 'page'};
const t = key => chrome.i18n.getMessage(key);
const form = document.querySelector('main');
const status = document.getElementById('status');

for (const element of document.querySelectorAll('[data-i18n]')) {
  const text = t(element.dataset.i18n);
  if (text) element.textContent = text;
}
document.documentElement.lang = chrome.i18n.getUILanguage();

// Typical highlights: inline code, a <mark>, a white-on-red badge, dark code.
const samples = [
  {label: 'inline code', background: {r: 255, g: 216, b: 168, a: 1}, text: {r: 31, g: 35, b: 40, a: 1}, mono: true},
  {label: 'highlighted note', background: {r: 255, g: 255, b: 0, a: 1}, text: {r: 31, g: 35, b: 40, a: 1}},
  {label: 'warning', background: {r: 255, g: 77, b: 79, a: 1}, text: {r: 255, g: 255, b: 255, a: 1}},
  {label: 'dark code', background: {r: 52, g: 57, b: 66, a: 1}, text: {r: 230, g: 237, b: 243, a: 1}, mono: true}
];
const preview = document.getElementById('preview');
const tune = document.getElementById('tune');
const slider = name => form.querySelector(`input[name="${name}"]`);

function drawPreview() {
  const {soften, readableOn, css} = globalThis.boksaColor;
  const lighten = Number(slider('softLighten').value), saturation = Number(slider('softSaturation').value);
  for (const output of form.querySelectorAll('output')) output.value = `${slider(output.htmlFor.value).value}%`;
  preview.replaceChildren();
  samples.forEach((sample, index) => {
    const background = soften(sample.background, lighten, saturation);
    const chip = document.createElement('span');
    chip.textContent = sample.label;
    chip.className = sample.mono ? 'mono' : '';
    chip.style.backgroundColor = css(background);
    chip.style.color = css(readableOn(sample.text, background));
    // Hovering shows the exact colour a copy would write.
    chip.title = css(background);
    if (index) preview.append(' ');
    preview.append(chip);
  });
  tune.classList.toggle('off', !form.querySelector('input[name="textBackgrounds"][value="soft"]').checked);
}

function show(options) {
  for (const [key, value] of Object.entries(options)) {
    for (const input of form.querySelectorAll(`[name="${key}"]`)) {
      if (input.type === 'checkbox') input.checked = value;
      else if (input.type === 'range') input.value = value;
      else input.checked = input.value === value;
    }
  }
  drawPreview();
}

let hide;
function saved() {
  status.classList.add('shown');
  clearTimeout(hide);
  hide = setTimeout(() => status.classList.remove('shown'), 1500);
}

chrome.storage.sync.get(defaults).then(show);

// Sliders redraw while dragging but save only on release: sync storage limits
// how many writes an extension may make per minute.
form.addEventListener('input', event => { if (event.target.type === 'range') drawPreview(); });
form.addEventListener('change', async event => {
  const input = event.target;
  const value = input.type === 'checkbox' ? input.checked : input.type === 'range' ? Number(input.value) : input.value;
  await chrome.storage.sync.set({[input.name]: value});
  drawPreview();
  saved();
});

document.getElementById('reset').addEventListener('click', async () => {
  await chrome.storage.sync.clear();
  show(defaults);
  saved();
});

// chrome:// pages cannot be opened from a link, only through the tabs API.
document.getElementById('shortcuts').addEventListener('click', () => {
  chrome.tabs.create({url: 'chrome://extensions/shortcuts'});
});
