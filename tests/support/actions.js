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

// Publishes a post. The caller must already be signed in.
async function createPost(request, post) {
  const token = await csrfToken(request, '/posts/new');
  return request.post('/posts', {
    form: { title: post.title, body: post.body, _csrf: token },
    maxRedirects: 0
  });
}

// Adds a comment to a post. The caller must already be signed in.
async function comment(request, postId, body) {
  const token = await csrfToken(request, `/posts/${postId}`);
  return request.post(`/posts/${postId}/comments`, {
    form: { body, _csrf: token },
    maxRedirects: 0
  });
}

// The post id from a redirect after creating a post, for example /posts/3 gives 3.
function postIdFrom(res) {
  const match = (res.headers()['location'] || '').match(/\/posts\/(\d+)/);
  return match ? Number(match[1]) : null;
}

// Base URL of the test server. Matches the port in playwright.config.js. Used when a test needs
// a second, fresh request context that is not signed in.
const BASE_URL = 'http://localhost:3400';

// The value of the session cookie from a response, or null if the response did not set one.
function sessionId(res) {
  const setCookie = res.headers()['set-cookie'];
  if (!setCookie) {
    return null;
  }
  const match = setCookie.match(/sid=([^;]+)/);
  return match ? match[1] : null;
}

// The first validation message shown on a register or login page.
function firstError(html) {
  const match = html.match(/<ul class="errors">\s*<li>([^<]*)<\/li>/);
  return match ? match[1] : null;
}

module.exports = {
  csrfToken,
  register,
  login,
  createPost,
  comment,
  postIdFrom,
  sessionId,
  firstError,
  BASE_URL
};

