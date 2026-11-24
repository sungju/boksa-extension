// Colour helpers shared by copy.js (injected into the page just before it) and
// the options page preview, so the preview shows exactly what a copy produces.
// Colours are {r, g, b, a} with channels 0–255 and alpha 0–1.
globalThis.boksaColor = (() => {
  'use strict';
  function relativeLuminance(color) {
    const linear = channel => {
      const c = channel / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b);
  }
  // WCAG contrast ratio, 1 to 21.
  function contrast(a, b) {
    const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
  }
  const white = {r: 255, g: 255, b: 255, a: 1};
  const ink = {r: 31, g: 35, b: 40, a: 1};
  // Keeps `saturation` percent of the colour's saturation and draws light
  // colours `lighten` percent of the way to white, so a loud highlight becomes
  // a faint wash. Dark colours keep their lightness so the light text designed
  // for them stays readable.
  function soften(color, lighten, saturation) {
    const r = color.r / 255, g = color.g / 255, b = color.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let l = (max + min) / 2, s = 0, h = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    s *= saturation / 100;
    if (l >= 0.5) l += (1 - l) * lighten / 100;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const channel = t => {
      t = (t + 1) % 1;
      const v = t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
      return Math.round(v * 255);
    };
    return {r: channel(h + 1 / 3), g: channel(h), b: channel(h - 1 / 3), a: color.a};
  }
  // The text colour to use on a softened background: the original if it still
  // reads (4.5:1), otherwise whichever of ink or white contrasts more. White
  // text on a red badge would vanish once the red turns pastel.
  function readableOn(text, background) {
    if (background.a < 1 || contrast(text, background) >= 4.5) return text;
    return contrast(ink, background) >= contrast(white, background) ? ink : white;
  }
  // The lightest colour with the same hue and saturation that reaches `ratio`
  // contrast against white. Salesforce applies exactly this to every colour it
  // stores, so doing it first makes the editor show what the saved view shows.
  function darkenFor(color, ratio = 4.5) {
    if (contrast(color, white) >= ratio) return color;
    const r = color.r / 255, g = color.g / 255, b = color.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const lightness = (max + min) / 2;
    let s = 0, h = 0;
    if (max !== min) {
      const d = max - min;
      s = lightness > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = (max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4) / 6;
    }
    const fromHsl = l => {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
      const channel = t => {
        t = (t + 1) % 1;
        const v = t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
        return Math.round(v * 255);
      };
      return {r: channel(h + 1 / 3), g: channel(h), b: channel(h - 1 / 3), a: 1};
    };
    let low = 0, high = lightness;
    for (let step = 0; step < 20; step++) {
      const mid = (low + high) / 2;
      if (contrast(fromHsl(mid), white) >= ratio) low = mid; else high = mid;
    }
    return fromHsl(low);
  }
  const css = color => color.a < 1
    ? `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`
    : `rgb(${color.r}, ${color.g}, ${color.b})`;
  return {contrast, soften, readableOn, darkenFor, css, white};
})();
