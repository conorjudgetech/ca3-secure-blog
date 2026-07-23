const { test, expect } = require('@playwright/test');
const db = require('./support/db');
const { register, createPost, comment, deletePost, postIdFrom } = require('./support/actions');

const ADMIN = { username: 'admin', email: 'admin@example.com', password: 'CorrectHorse9' };
const USER = { username: 'bob', email: 'bob@example.com', password: 'CorrectHorse9' };

test.beforeEach(() => db.resetDatabase());

test('TC-6.1 an administrator deletes a post and its comments, and the deletion is logged', async ({ request }) => {
  await register(request, ADMIN);
  const id = postIdFrom(await createPost(request, { title: 'To delete', body: 'body' }));
  await comment(request, id, 'a comment on the post');
  expect(db.count('comments')).toBe(1);

  const res = await deletePost(request, id);
  expect(res.status()).toBe(302);
  expect(res.headers()['location']).toMatch(/\/$/);

  expect(db.count('posts')).toBe(0);
  expect(db.count('comments')).toBe(0); // comments are removed with the post
  const deletions = db.allLogs().filter((r) => /Post deleted/i.test(r.event));
  expect(deletions.length).toBe(1);
});

test('TC-6.2 an ordinary user cannot delete a post even by posting directly', async ({ request, browser }) => {
  await register(request, ADMIN);
  const id = postIdFrom(await createPost(request, { title: 'Protected post', body: 'body' }));

  // Second user, ordinary role, posts the delete request directly rather than using a button.
  const userCtx = await browser.newContext();
  await register(userCtx.request, USER);
  const res = await deletePost(userCtx.request, id);

  expect(res.status()).toBe(403); // refused by authorization, not by a hidden control
  expect(db.count('posts')).toBe(1); // the post is still there
  await userCtx.close();
});

test('TC-6.3 deleting a post that does not exist is handled without leaking an error', async ({ request }) => {
  await register(request, ADMIN);
  const res = await deletePost(request, 9999);
  expect(res.status()).toBe(404);
  const body = await res.text();
  expect(body).toContain('Something went wrong');
  expect(body).not.toContain('SqliteError');
  expect(body).not.toContain('at Object.');
});

test('TC-6.4 deletion without a valid CSRF token is refused and the post remains', async ({ request }) => {
  await register(request, ADMIN);
  const id = postIdFrom(await createPost(request, { title: 'Keep me', body: 'body' }));
  const res = await request.post(`/posts/${id}/delete`, { form: {}, maxRedirects: 0 });
  expect(res.status()).toBe(403);
  expect(db.count('posts')).toBe(1);
});
