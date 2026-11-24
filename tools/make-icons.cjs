// Rasterises tools/icon.js into the PNGs the manifest and the store listing need.
// Run: node tools/make-icons.cjs
//
// Chrome is already a test dependency, so it doubles as the renderer here rather
// than pulling in a native image library just to convert an SVG.
const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const {svg} = require('./icon.js');

// 16/32/48/128 ship in the package; 512 is a source for marketing art. The store
// listing icon is rendered separately below because it needs padding.
const shipped = [16, 32, 48, 128];
const listing = [512];

(async () => {
  const root = path.join(__dirname, '..');
  fs.mkdirSync(path.join(root, 'icons'), {recursive: true});
  fs.mkdirSync(path.join(root, 'store'), {recursive: true});

  const browser = await chromium.launch({channel: 'chrome', headless: true});
  for (const [size, dir] of [...shipped.map(s => [s, 'icons']), ...listing.map(s => [s, 'store'])]) {
    const page = await browser.newPage({viewport: {width: size, height: size}, deviceScaleFactor: 1});
    await page.setContent(`<style>html,body{margin:0;padding:0;background:transparent}</style>${svg(size)}`);
    const file = path.join(root, dir, `icon-${size}.png`);
    // omitBackground keeps the corners outside the rounded tile transparent.
    await page.screenshot({path: file, omitBackground: true});
    await page.close();
    console.log(`wrote ${path.relative(root, file)} (${fs.statSync(file).size} bytes)`);
  }

  // The Web Store icon is 128x128 but, per Google's image guidelines, the artwork
  // is 96x96 centred in 16px of transparent padding so it sits level with other
  // store icons instead of looking oversized.
  const page = await browser.newPage({viewport: {width: 128, height: 128}, deviceScaleFactor: 1});
  await page.setContent(`<style>html,body{margin:0;padding:0;background:transparent}svg{display:block;margin:16px}</style>${svg(96)}`);
  const storeIcon = path.join(root, 'store', 'icon-128.png');
  await page.screenshot({path: storeIcon, omitBackground: true});
  console.log(`wrote ${path.relative(root, storeIcon)} (${fs.statSync(storeIcon).size} bytes)`);
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
