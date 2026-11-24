'use strict';
// Single source of truth for the extension artwork; rasterised by make-icons.cjs.
// Everything is drawn on a 128-unit grid and scaled, so the shapes stay aligned
// at every output size.
//
// Two variants exist because the three-bar card turns to mush below ~40px: small
// sizes get fewer, heavier bars and a thicker outline rather than a shrunk copy.

// A stacked pair of cards reads as "copy"; the coloured bars on the front card
// are the part that says the formatting comes along with it.
const detailed = `
  <rect x="28" y="20" width="54" height="70" rx="7" fill="none" stroke="#ffffff" stroke-opacity=".55" stroke-width="6"/>
  <rect x="46" y="38" width="54" height="70" rx="7" fill="#ffffff"/>
  <rect x="56" y="54" width="34" height="8" rx="4" fill="#4f46e5"/>
  <rect x="56" y="70" width="26" height="8" rx="4" fill="#ec4899"/>
  <rect x="56" y="86" width="30" height="8" rx="4" fill="#10b981"/>`;

const simple = `
  <rect x="24" y="16" width="58" height="74" rx="8" fill="none" stroke="#ffffff" stroke-opacity=".6" stroke-width="9"/>
  <rect x="46" y="38" width="58" height="74" rx="8" fill="#ffffff"/>
  <rect x="58" y="58" width="38" height="12" rx="6" fill="#4f46e5"/>
  <rect x="58" y="80" width="30" height="12" rx="6" fill="#ec4899"/>`;

function svg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128">
  <defs><linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#4f46e5"/><stop offset="1" stop-color="#7c3aed"/>
  </linearGradient></defs>
  <rect width="128" height="128" rx="28" fill="url(#tile)"/>
  ${size >= 48 ? detailed : simple}
</svg>`;
}

module.exports = {svg};
