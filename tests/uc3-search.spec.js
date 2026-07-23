const { test, expect } = require('@playwright/test');
const db = require('./support/db');
const { register, createPost } = require('./support/actions');

const AUTHOR = { username: 'author', email: 'author@example.com', password: 'CorrectHorse9' };

test.beforeEach(() => db.resetDatabase());

test('TC-3.1 a keyword search returns matching posts', async ({ request }) => {
  await register(request, AUTHOR);
  await createPost(request, { title: 'Gardening tips', body: 'how to grow tomatoes' });
  await createPost(request, { title: 'Weekend cooking', body: 'a pasta recipe' });

  const res = await request.get('/search?q=tomatoes');
  const html = await res.text();
  expect(res.status()).toBe(200);
  expect(html).toContain('Gardening tips');
  expect(html).not.toContain('Weekend cooking');
});

test('TC-3.2 a search with no matches shows a no results message', async ({ request }) => {
  await register(request, AUTHOR);
  await createPost(request, { title: 'Gardening tips', body: 'how to grow tomatoes' });

  const res = await request.get('/search?q=nothingmatchesthis');
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain('No posts matched your search.');
});

test('TC-3.3 the search page with no query shows the form and runs no query', async ({ request }) => {
  const res = await request.get('/search');
  const html = await res.text();
  expect(res.status()).toBe(200);
  expect(html).toContain('name="q"');
  // With no query the results block is not rendered at all.
  expect(html).not.toContain('You searched for');
  expect(html).not.toContain('No posts matched your search.');
});

test('TC-3.4 a search with an attack signature is logged and the payload is inert', async ({ page }) => {
  let dialogFired = false;
  page.on('dialog', async (d) => {
    dialogFired = true;
    await d.dismiss();
  });

  await page.goto('/search?q=' + encodeURIComponent('<script>alert(1)</script>'));

  // The payload is shown as text, so no dialog appears.
  expect(dialogFired).toBe(false);
  expect(await page.content()).toContain('&lt;script&gt;');

  // The attempt is recorded as a warning.
  const warnings = db.allLogs().filter((r) => r.level === 'WARN' && /XSS/i.test(r.event));
  expect(warnings.length).toBeGreaterThan(0);
});
