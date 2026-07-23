const { test, expect } = require('@playwright/test');
const db = require('./support/db');
const { register, createPost, BASE_URL } = require('./support/actions');

const ADMIN = { username: 'admin', email: 'admin@example.com', password: 'CorrectHorse9' };
const USER = { username: 'bob', email: 'bob@example.com', password: 'CorrectHorse9' };

test.beforeEach(() => db.resetDatabase());

test('TC-7.1 an administrator can read the log and sees the event fields', async ({ request }) => {
  await register(request, ADMIN);
  await createPost(request, { title: 'A post', body: 'body' }); // logs an event with a username

  const res = await request.get('/admin/logs');
  const html = await res.text();
  expect(res.status()).toBe(200);
  // The table headers show the fields.
  for (const header of ['Time', 'Level', 'Event', 'User', 'IP']) {
    expect(html).toContain(`<th>${header}</th>`);
  }
  // A real row is present, with the event text and the username.
  expect(html).toContain('Post created');
  expect(html).toContain('admin');
});

test('TC-7.2 an empty log shows a message', async ({ request }) => {
  await register(request, ADMIN);
  // Clearing the log lets us see the empty state. Registration itself writes a log line.
  const conn = db.openDb();
  conn.exec('DELETE FROM logs');
  conn.close();

  const res = await request.get('/admin/logs');
  expect(await res.text()).toContain('No events logged yet.');
});

test('TC-7.3 an ordinary user requesting the log is refused and sees no log content', async ({ request, browser }) => {
  await register(request, ADMIN);
  await createPost(request, { title: 'A post', body: 'body' }); // creates a log line to look for

  const userCtx = await browser.newContext();
  await register(userCtx.request, USER);
  const res = await userCtx.request.get('/admin/logs', { maxRedirects: 0 });
  const body = await res.text();

  expect(res.status()).toBe(403);
  expect(body).not.toContain('Post created'); // no log content is disclosed
  expect(body).not.toContain('<th>Event</th>');
  await userCtx.close();
});
