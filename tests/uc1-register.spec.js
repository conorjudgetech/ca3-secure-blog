const { test, expect } = require('@playwright/test');
const db = require('./support/db');
const { register } = require('./support/actions');

test.beforeEach(() => db.resetDatabase());

test('TC-1.1 a valid registration creates the account and logs the user in', async ({ request }) => {
  const res = await register(request, {
    username: 'alice',
    email: 'alice@example.com',
    password: 'CorrectHorse9'
  });
  expect(res.status()).toBe(302);
  expect(res.headers()['location']).toMatch(/\/$/);

  // The session is established, so the home page now greets the user.
  const home = await request.get('/');
  expect(await home.text()).toContain('Hi, alice');

  // The stored password is a bcrypt hash, not the plaintext value.
  const user = db.getUser('alice');
  expect(user).toBeTruthy();
  expect(user.password).not.toBe('CorrectHorse9');
  expect(user.password.startsWith('$2')).toBe(true);
});

test('TC-1.2 the first account is the administrator and the second is an ordinary user', async ({
  request
}) => {
  await register(request, { username: 'admin', email: 'admin@example.com', password: 'CorrectHorse9' });
  await register(request, { username: 'bob', email: 'bob@example.com', password: 'CorrectHorse9' });
  expect(db.getUser('admin').role).toBe('admin');
  expect(db.getUser('bob').role).toBe('user');
});

test('TC-1.3 invalid input is rejected and no account is created', async ({ request }) => {
  const shortName = await register(request, {
    username: 'ab',
    email: 'a@example.com',
    password: 'CorrectHorse9'
  });
  expect(shortName.status()).toBe(400);
  expect(await shortName.text()).toContain('Username must be 3-20');

  const badEmail = await register(request, {
    username: 'validname',
    email: 'notanemail',
    password: 'CorrectHorse9'
  });
  expect(badEmail.status()).toBe(400);
  expect(await badEmail.text()).toContain('valid email');

  const shortPassword = await register(request, {
    username: 'validname',
    email: 'a@example.com',
    password: 'short'
  });
  expect(shortPassword.status()).toBe(400);
  expect(await shortPassword.text()).toContain('at least 8 characters');

  expect(db.count('users')).toBe(0);
});

test('TC-1.4 a duplicate username is rejected and no account is created', async ({ request }) => {
  await register(request, { username: 'alice', email: 'alice@example.com', password: 'CorrectHorse9' });
  const res = await register(request, {
    username: 'alice',
    email: 'other@example.com',
    password: 'CorrectHorse9'
  });
  expect(res.status()).toBe(400);
  expect(await res.text()).toContain('username is taken');
  expect(db.count('users')).toBe(1);
});

test('TC-1.5 a duplicate email is rejected and no account is created', async ({ request }) => {
  await register(request, { username: 'alice', email: 'alice@example.com', password: 'CorrectHorse9' });
  const res = await register(request, {
    username: 'other',
    email: 'alice@example.com',
    password: 'CorrectHorse9'
  });
  expect(res.status()).toBe(400);
  expect(await res.text()).toContain('email is already registered');
  expect(db.count('users')).toBe(1);
});

test('TC-1.6 registration without a valid CSRF token is refused and no account is created', async ({
  request
}) => {
  const res = await request.post('/register', {
    form: { username: 'alice', email: 'alice@example.com', password: 'CorrectHorse9' },
    maxRedirects: 0
  });
  expect(res.status()).toBe(403);
  expect(db.count('users')).toBe(0);
});
