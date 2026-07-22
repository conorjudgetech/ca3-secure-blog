// Loads a URL in headless Chromium and reports whether a JS dialog (alert) fired.
// Usage: node xss-check.js <url>
const { chromium } = require('playwright');

(async () => {
  const url = process.argv[2];
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let fired = null;
  page.on('dialog', async (d) => {
    fired = d.message();
    await d.dismiss();
  });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  if (fired !== null) {
    console.log('ALERT FIRED with message: ' + JSON.stringify(fired));
    process.exitCode = 0;
  } else {
    console.log('no alert fired');
    process.exitCode = 2;
  }
  await browser.close();
})();
