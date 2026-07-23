// Captures screenshots for the report. These are not assertions. They build real content first,
// so the pages show something meaningful. Setup runs through page.request, which shares cookies
// with the page, so the page is signed in where that matters. The most important screenshot is
// the administrator log, which is filled with real detected attack attempts before capture.
const { test } = require('@playwright/test');
const db = require('./support/db');
const { register, createPost, comment, csrfToken, postIdFrom, BASE_URL } = require('./support/actions');

const DIR = 'screenshots';
const ADMIN = { username: 'admin', email: 'admin@example.com', password: 'CorrectHorse9' };

test.beforeEach(() => db.resetDatabase());

test('screenshot the login page', async ({ page }) => {
  await page.goto('/login');
  await page.screenshot({ path: `${DIR}/01-login-page.png`, fullPage: true });
});

test('screenshot the home page with several posts', async ({ page }) => {
  await register(page.request, ADMIN);
  await createPost(page.request, { title: 'Welcome to the blog', body: 'The first post.' });
  await createPost(page.request, { title: 'Notes on gardening', body: 'How to grow tomatoes.' });
  await createPost(page.request, { title: 'Weekend cooking', body: 'A simple pasta recipe.' });
  await page.goto('/');
  await page.screenshot({ path: `${DIR}/02-home-with-posts.png`, fullPage: true });
});

test('screenshot a post with several comments', async ({ page, browser }) => {
  await register(page.request, ADMIN);
  const id = postIdFrom(await createPost(page.request, { title: 'A post people replied to', body: 'What do you think?' }));
  await comment(page.request, id, 'I found this useful, thank you.');

  const bob = await browser.newContext();
  await register(bob.request, { username: 'bob', email: 'bob@example.com', password: 'CorrectHorse9' });
  await comment(bob.request, id, 'Good point, I agree.');
  await bob.close();

  const carol = await browser.newContext();
  await register(carol.request, { username: 'carol', email: 'carol@example.com', password: 'CorrectHorse9' });
  await comment(carol.request, id, 'Thanks for writing this up.');
  await carol.close();

  await page.goto(`/posts/${id}`);
  await page.screenshot({ path: `${DIR}/03-post-with-comments.png`, fullPage: true });
});

test('screenshot the search page with results', async ({ page }) => {
  await register(page.request, ADMIN);
  await createPost(page.request, { title: 'Growing tomatoes', body: 'Tomatoes need sun and water.' });
  await createPost(page.request, { title: 'Tomato recipes', body: 'Roasted tomatoes are easy.' });
  await createPost(page.request, { title: 'Unrelated topic', body: 'Nothing to do with the search.' });
  await page.goto('/search?q=tomato');
  await page.screenshot({ path: `${DIR}/04-search-results.png`, fullPage: true });
});

test('screenshot the administrator log showing detected attack attempts', async ({ page, playwright }) => {
  await register(page.request, ADMIN);
  const id = postIdFrom(await createPost(page.request, { title: 'A normal post', body: 'body' }));

  // Generate real attack attempts so the log has content.
  await page.request.get('/search?q=' + encodeURIComponent("' OR 1=1")); // SQL injection signature
  await page.request.get('/search?q=' + encodeURIComponent('<script>alert(1)</script>')); // XSS signature
  await comment(page.request, id, "<img src=x onerror=alert('x')>"); // stored script attempt in a comment

  // A failed login from a separate session, to add a login warning.
  const anon = await playwright.request.newContext({ baseURL: BASE_URL });
  const token = await csrfToken(anon, '/login');
  await anon.post('/login', { form: { username: 'attacker', password: 'wrong', _csrf: token }, maxRedirects: 0 });
  await anon.dispose();

  await page.goto('/admin/logs');
  await page.screenshot({ path: `${DIR}/05-admin-log-attacks.png`, fullPage: true });
});
