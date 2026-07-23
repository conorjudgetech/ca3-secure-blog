const { test, expect } = require('@playwright/test');
const db = require('./support/db');
const { register, login, csrfToken, sessionId, firstError, BASE_URL } = require('./support/actions');

const ACCOUNT = { username: 'alice', email: 'alice@example.com', password: 'CorrectHorse9' };

test.beforeEach(() => db.resetDatabase());

// A fresh request context that is not signed in, for login attempts.
async function anon(playwright) {
  return playwright.request.newContext({ baseURL: BASE_URL });
}

test('TC-2.1 a valid login succeeds and the session identifier changes', async ({ request, playwright }) => {
  await register(request, ACCOUNT);

  const client = await anon(playwright);
  const page = await client.get('/login');
  const before = sessionId(page);
  const token = (await page.text()).match(/name="_csrf" value="([a-f0-9]{64})"/)[1];

  const res = await client.post('/login', {
    form: { username: ACCOUNT.username, password: ACCOUNT.password, _csrf: token },
    maxRedirects: 0
  });
  expect(res.status()).toBe(302);
  const after = sessionId(res);

  expect(before).toBeTruthy();
  expect(after).toBeTruthy();
  expect(after).not.toBe(before);
  await client.dispose();
});

test('TC-2.3 a wrong password is refused with 401 and the standard message', async ({ request, playwright }) => {
  await register(request, ACCOUNT);
  const client = await anon(playwright);
  const res = await login(client, { username: ACCOUNT.username, password: 'wrongpassword' });
  expect(res.status()).toBe(401);
  expect(firstError(await res.text())).toBe('Invalid username or password.');
  await client.dispose();
});

test('TC-2.4 a locked account refuses the correct password with an unchanged message', async ({ request, playwright }) => {
  await register(request, ACCOUNT);
  const client = await anon(playwright);

  // First a normal wrong-password failure, and keep its message.
  const wrong = await login(client, { username: ACCOUNT.username, password: 'wrongpassword' });
  const messageWhenWrong = firstError(await wrong.text());

  // Four more failures reach the lockout threshold of 5.
  for (let i = 0; i < 4; i++) {
    await login(client, { username: ACCOUNT.username, password: 'wrongpassword' });
  }

  // The correct password is now refused because the account is locked.
  const locked = await login(client, { username: ACCOUNT.username, password: ACCOUNT.password });
  expect(locked.status()).toBe(401);
  const messageWhenLocked = firstError(await locked.text());

  // The two messages must be identical, so the lock state is not revealed.
  expect(messageWhenLocked).toBe(messageWhenWrong);
  expect(messageWhenLocked).toBe('Invalid username or password.');
  await client.dispose();
});

test('TC-2.5 the account locks after five consecutive failures', async ({ request, playwright }) => {
  await register(request, ACCOUNT);
  const client = await anon(playwright);
  for (let i = 0; i < 5; i++) {
    await login(client, { username: ACCOUNT.username, password: 'wrongpassword' });
  }
  const user = db.getUser(ACCOUNT.username);
  expect(user.failed_attempts).toBe(5);
  expect(user.locked_until).not.toBeNull();
  const lockedUntil = new Date(user.locked_until.replace(' ', 'T') + 'Z').getTime();
  expect(lockedUntil).toBeGreaterThan(Date.now());
  await client.dispose();
});

test('TC-2.6 login without a valid CSRF token is refused with 403', async ({ request, playwright }) => {
  await register(request, ACCOUNT);
  const client = await anon(playwright);
  const res = await client.post('/login', {
    form: { username: ACCOUNT.username, password: ACCOUNT.password },
    maxRedirects: 0
  });
  expect(res.status()).toBe(403);
  await client.dispose();
});
