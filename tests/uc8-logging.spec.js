const { test, expect } = require('@playwright/test');
const db = require('./support/db');
const { register, createPost, login, csrfToken, BASE_URL } = require('./support/actions');

const ADMIN = { username: 'admin', email: 'admin@example.com', password: 'CorrectHorse9' };

test.beforeEach(() => db.resetDatabase());

test('TC-8.1 a security event is recorded with its fields populated', async ({ request }) => {
  await register(request, ADMIN);
  await createPost(request, { title: 'A post', body: 'body' });

  const row = db.allLogs().find((r) => /Post created/i.test(r.event));
  expect(row).toBeTruthy();
  expect(row.level).toBeTruthy();
  expect(row.event).toContain('Post created');
  expect(row.username).toBe('admin');
  expect(row.ip).toBeTruthy();
  expect(row.created_at).toBeTruthy();
});

test('TC-8.2 a failed login for an unknown username is recorded with no username attached', async ({ playwright }) => {
  const client = await playwright.request.newContext({ baseURL: BASE_URL });
  await login(client, { username: 'ghostuser', password: 'wrongpassword' });

  const row = db.allLogs().find((r) => /Failed login/i.test(r.event));
  expect(row).toBeTruthy();
  expect(row.level).toBe('WARN');
  expect(row.event).toContain('ghostuser'); // the attempted name is in the message
  expect(row.username).toBeNull(); // but no account is attached
  await client.dispose();
});

test('TC-8.3 no password value and no CSRF token value appears in any log record', async ({ request, playwright }) => {
  const distinctivePassword = 'Zebra-Umbrella-42-Distinctive';
  await register(request, { username: 'admin', email: 'admin@example.com', password: distinctivePassword });

  const client = await playwright.request.newContext({ baseURL: BASE_URL });
  const token = await csrfToken(client, '/login');
  await client.post('/login', {
    form: { username: 'admin', password: distinctivePassword, _csrf: token },
    maxRedirects: 0
  });

  const serialised = JSON.stringify(db.allLogs());
  expect(serialised).not.toContain(distinctivePassword);
  expect(serialised).not.toContain(token);
  await client.dispose();
});

test('TC-8.4 the log page escapes its output so it is not itself an attack surface', async ({ browser }) => {
  const ctx = await browser.newContext();
  await register(ctx.request, ADMIN);
  // Trigger a warning whose message contains a script payload.
  await ctx.request.get('/search?q=' + encodeURIComponent('<script>alert(1)</script>'));

  const page = await ctx.newPage();
  let dialogFired = false;
  page.on('dialog', async (d) => {
    dialogFired = true;
    await d.dismiss();
  });
  await page.goto('/admin/logs');
  await page.waitForTimeout(300);

  expect(dialogFired).toBe(false);
  expect(await page.content()).toContain('&lt;script&gt;');
  await ctx.close();
});
