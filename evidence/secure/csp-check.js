// Confirms the CSP blocks inline script execution (the XSS defence-in-depth backstop).
// Loads the page, then tries to inject and run an inline <script> — CSP should refuse it.
// Usage: node csp-check.js <url>
const { chromium } = require('playwright');

(async () => {
  const url = process.argv[2];
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let alertFired = false;
  const violations = [];
  page.on('dialog', async (d) => {
    alertFired = true;
    await d.dismiss();
  });
  page.on('console', (msg) => {
    if (/Content Security Policy|Refused to execute/i.test(msg.text())) violations.push(msg.text());
  });
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => {
    const s = document.createElement('script');
    s.textContent = "alert('csp-bypass')";
    document.body.appendChild(s);
  });
  await page.waitForTimeout(400);
  console.log('inline-script alert fired: ' + alertFired + '  (false = CSP blocked it)');
  console.log('CSP violation reported: ' + (violations.length ? 'yes' : 'no'));
  await browser.close();
})();
