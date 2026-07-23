const { test, expect } = require('@playwright/test');
const db = require('./support/db');
const { register, createPost, postIdFrom, BASE_URL } = require('./support/actions');

const AUTHOR = { username: 'author', email: 'author@example.com', password: 'CorrectHorse9' };

test.beforeEach(() => db.resetDatabase());

test('TC-4.1 a signed in user publishes a post attributed to them', async ({ request }) => {
  await register(request, AUTHOR);
  const res = await createPost(request, { title: 'My first post', body: 'Hello world' });
  expect(res.status()).toBe(302);
  const id = postIdFrom(res);

  const view = await request.get(`/posts/${id}`);
  const html = await view.text();
  expect(html).toContain('My first post');
  expect(html).toContain('by author');
});

test('TC-4.2 an unauthenticated user cannot reach the new post page or create a post', async ({ request, playwright }) => {
  const client = await playwright.request.newContext({ baseURL: BASE_URL });

  const newPage = await client.get('/posts/new', { maxRedirects: 0 });
  expect(newPage.status()).toBe(302);
  expect(newPage.headers()['location']).toContain('/login');

  const post = await client.post('/posts', {
    form: { title: 'Sneaky', body: 'should not be created' },
    maxRedirects: 0
  });
  expect(post.status()).toBe(403); // rejected before it reaches the handler
  expect(db.count('posts')).toBe(0);
  await client.dispose();
});

test('TC-4.3 an empty title or body is rejected and no post is created', async ({ request }) => {
  await register(request, AUTHOR);

  const noTitle = await createPost(request, { title: '', body: 'has a body' });
  expect(noTitle.status()).toBe(400);

  const noBody = await createPost(request, { title: 'Has a title', body: '' });
  expect(noBody.status()).toBe(400);

  expect(db.count('posts')).toBe(0);
});

test('TC-4.4 post creation without a valid CSRF token is refused with 403', async ({ request }) => {
  await register(request, AUTHOR);
  const res = await request.post('/posts', {
    form: { title: 'No token', body: 'should not be created' },
    maxRedirects: 0
  });
  expect(res.status()).toBe(403);
  expect(db.count('posts')).toBe(0);
});
