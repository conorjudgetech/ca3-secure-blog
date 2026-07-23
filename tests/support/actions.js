// HTTP helpers shared by the tests. They work with any Playwright request context, including
// page.request, so cookies stay tied to the caller's session. Each helper fetches the CSRF token
// from the form page first, because every state-changing POST needs it.

async function csrfToken(request, path) {
  const res = await request.get(path);
  const html = await res.text();
  const match = html.match(/name="_csrf" value="([a-f0-9]{64})"/);
  if (!match) {
    throw new Error('No CSRF token found on ' + path);
  }
  return match[1];
}

async function register(request, user) {
  const token = await csrfToken(request, '/register');
  return request.post('/register', {
    form: { username: user.username, email: user.email, password: user.password, _csrf: token },
    maxRedirects: 0
  });
}

async function login(request, user) {
  const token = await csrfToken(request, '/login');
  return request.post('/login', {
    form: { username: user.username, password: user.password, _csrf: token },
    maxRedirects: 0
  });
}

module.exports = { csrfToken, register, login };
