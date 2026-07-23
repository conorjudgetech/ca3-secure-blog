// Seeds a running instance with content so the ZAP spider has pages to find. Works on both
// branches. The secure branch puts a CSRF token in each form, so this reads the token from the
// form page and includes it. The insecure branch has no token, so it is left out when absent.
//
// Usage: SEED_PORT=3700 node zap/seed.js
const http = require('http');

const PORT = Number(process.env.SEED_PORT || 3700);
const HOST = 'localhost';

function request(method, path, { cookie, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? new URLSearchParams(body).toString() : null;
    const headers = {};
    if (cookie) headers['Cookie'] = cookie;
    if (data) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    const req = http.request({ host: HOST, port: PORT, path, method, headers }, (res) => {
      let chunks = '';
      res.on('data', (c) => (chunks += c));
      res.on('end', () =>
        resolve({
          status: res.statusCode,
          body: chunks,
          setCookie: res.headers['set-cookie'],
          location: res.headers['location']
        })
      );
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function keepCookie(setCookie, current) {
  if (!setCookie) return current;
  const found = setCookie.find((c) => c.startsWith('sid='));
  return found ? found.split(';')[0] : current;
}

function tokenFrom(html) {
  const match = html.match(/name="_csrf" value="([a-f0-9]+)"/);
  return match ? match[1] : null;
}

function newSession() {
  return { cookie: null };
}

async function get(session, path) {
  const res = await request('GET', path, { cookie: session.cookie });
  session.cookie = keepCookie(res.setCookie, session.cookie);
  return res;
}

// GET the form page for its token if it has one, then POST the form.
async function submit(session, formPath, actionPath, fields) {
  const form = await get(session, formPath);
  const token = tokenFrom(form.body);
  const body = token ? { ...fields, _csrf: token } : { ...fields };
  const res = await request('POST', actionPath, { cookie: session.cookie, body });
  session.cookie = keepCookie(res.setCookie, session.cookie);
  return res;
}

function postId(res) {
  const match = (res.location || '').match(/\/posts\/(\d+)/);
  return match ? match[1] : null;
}

const POSTS = [
  { title: 'Welcome to the blog', body: 'The first post. It talks about gardening and growing tomatoes at home.' },
  { title: 'A simple pasta recipe', body: 'Cook the pasta, add garlic and olive oil, and a little cheese. An easy recipe.' },
  { title: 'A trip to the mountains', body: 'Notes from a weekend of walking in the mountains, with cold air and long views.' },
  { title: 'A short book review', body: 'Thoughts on a novel about the sea and sailing. Worth reading on a quiet afternoon.' }
];

(async () => {
  const admin = newSession();
  const r1 = await submit(admin, '/register', '/register', {
    username: 'adminuser',
    email: 'admin@example.com',
    password: 'CorrectHorse9'
  });
  console.log('register admin ->', r1.status);

  const ids = [];
  for (const p of POSTS) {
    const res = await submit(admin, '/posts/new', '/posts', { title: p.title, body: p.body });
    ids.push(postId(res));
  }
  console.log('created posts ->', ids.join(', '));

  await submit(admin, `/posts/${ids[0]}`, `/posts/${ids[0]}/comments`, { body: 'Great first post, thanks for sharing.' });
  await submit(admin, `/posts/${ids[1]}`, `/posts/${ids[1]}/comments`, { body: 'I made this recipe and it worked well.' });

  const user = newSession();
  const r2 = await submit(user, '/register', '/register', {
    username: 'bobuser',
    email: 'bob@example.com',
    password: 'CorrectHorse9'
  });
  console.log('register user ->', r2.status);

  await submit(user, `/posts/${ids[0]}`, `/posts/${ids[0]}/comments`, { body: 'I grow tomatoes too, they need a lot of sun.' });
  await submit(user, `/posts/${ids[2]}`, `/posts/${ids[2]}/comments`, { body: 'The mountains look beautiful in autumn.' });
  await submit(user, `/posts/${ids[3]}`, `/posts/${ids[3]}/comments`, { body: 'Adding this book to my reading list.' });

  await get(admin, '/search?q=tomatoes');
  await get(admin, '/search?q=recipe');
  console.log('searches done');

  console.log('Seed complete.');
})().catch((e) => {
  console.error('Seed failed:', e.message);
  process.exit(1);
});
