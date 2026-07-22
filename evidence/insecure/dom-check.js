// Verifies DOM-based XSS: loads the URL, reports whether an alert fired and what the
// client script wrote into #results (which the server delivers empty).
// Usage: node dom-check.js <url>
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
  const results = await page.$eval('#results', (el) => el.innerHTML).catch(() => '(no #results)');
  console.log('alert fired: ' + (fired !== null ? 'YES ' + JSON.stringify(fired) : 'no'));
  console.log('#results innerHTML written by client JS: ' + JSON.stringify(results));
  await browser.close();
  process.exitCode = fired !== null ? 0 : 2;
})();
