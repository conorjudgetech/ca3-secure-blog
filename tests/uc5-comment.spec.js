const { test, expect } = require('@playwright/test');
const db = require('./support/db');
const { register, createPost, comment, postIdFrom, BASE_URL } = require('./support/actions');

const A = { username: 'writer', email: 'writer@example.com', password: 'CorrectHorse9' };
const B = { username: 'reader', email: 'reader@example.com', password: 'CorrectHorse9' };

test.beforeEach(() => db.resetDatabase());

test('TC-5.1 a comment by one user is visible to a second user', async ({ request, browser }) => {
  await register(request, A);
  const id = postIdFrom(await createPost(request, { title: 'Shared post', body: 'body' }));
  await comment(request, id, 'A helpful comment');

  const second = await browser.newContext();
  await register(second.request, B);
  const page = await second.newPage();
  await page.goto(`/posts/${id}`);
  await expect(page.locator('.comment-body')).toContainText('A helpful comment');
  await second.close();
});

test('TC-5.2 a post with no comments shows a message', async ({ request }) => {
  await register(request, A);
  const id = postIdFrom(await createPost(request, { title: 'Quiet post', body: 'body' }));
  const res = await request.get(`/posts/${id}`);
  expect(await res.text()).toContain('No comments yet.');
});

test('TC-5.3 an unauthenticated comment attempt is refused and creates nothing', async ({ request, playwright }) => {
  await register(request, A);
  const id = postIdFrom(await createPost(request, { title: 'A post', body: 'body' }));

  const client = await playwright.request.newContext({ baseURL: BASE_URL });
  const res = await client.post(`/posts/${id}/comments`, {
    form: { body: 'should not be created' },
    maxRedirects: 0
  });
  expect(res.status()).toBe(403);
  expect(db.count('comments')).toBe(0);
  await client.dispose();
});

test('TC-5.4 commenting on a post that does not exist returns a generic 404', async ({ request }) => {
  await register(request, A);
  const res = await comment(request, 9999, 'hello');
  expect(res.status()).toBe(404);
  expect(await res.text()).toContain('Something went wrong');
  expect(db.count('comments')).toBe(0);
});

test('TC-5.5 an empty comment is rejected and none is created', async ({ request }) => {
  await register(request, A);
  const id = postIdFrom(await createPost(request, { title: 'A post', body: 'body' }));
  const res = await comment(request, id, '   ');
  // The app redirects back to the post without creating a comment.
  expect(res.status()).toBe(302);
  expect(db.count('comments')).toBe(0);
});

test('TC-5.6 commenting without a valid CSRF token is refused with 403', async ({ request }) => {
  await register(request, A);
  const id = postIdFrom(await createPost(request, { title: 'A post', body: 'body' }));
  const res = await request.post(`/posts/${id}/comments`, {
    form: { body: 'no token' },
    maxRedirects: 0
  });
  expect(res.status()).toBe(403);
  expect(db.count('comments')).toBe(0);
});

test('TC-5.7 a script comment is logged and shown as text with no dialog for a later viewer', async ({ request, browser }) => {
  await register(request, A);
  const id = postIdFrom(await createPost(request, { title: 'Post with payload', body: 'body' }));
  await comment(request, id, "<script>alert('stored')</script>");

  // The attempt is recorded as a warning.
  const warnings = db.allLogs().filter((r) => r.level === 'WARN' && /XSS/i.test(r.event));
  expect(warnings.length).toBeGreaterThan(0);

  // A second user views the post. No dialog appears, and the payload is shown as text.
  const second = await browser.newContext();
  const page = await second.newPage();
  let dialogFired = false;
  page.on('dialog', async (d) => {
    dialogFired = true;
    await d.dismiss();
  });
  await page.goto(`/posts/${id}`);
  await page.waitForTimeout(300);
  expect(dialogFired).toBe(false);
  await expect(page.locator('.comment-body')).toContainText("<script>alert('stored')</script>");
  await second.close();
});
