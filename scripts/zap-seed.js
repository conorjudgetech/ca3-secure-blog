// Seeds a running instance with content so the ZAP spider has pages to find. Works on both
// branches. The secure branch puts a CSRF token in each form, so this reads the token from the
// form page and includes it. The insecure branch has no token, so it is left out when absent.
//
// The seed is repeatable. If the accounts or posts already exist from an earlier run it reuses
// them instead of failing, so a second run leaves the same four posts rather than duplicates.
//
// Usage: SEED_PORT=3700 node scripts/zap-seed.js
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

// Register a new account, or log in if it already exists. A successful register on the secure
// branch redirects (302) and logs the session in. If the username or email is already taken the
// app answers 400, so fall back to logging in with the same details. Either way the session ends
// up authenticated so the rest of the seed can post.
async function registerOrLogin(session, creds, label) {
  const reg = await submit(session, '/register', '/register', creds);
  if (reg.status === 302) {
    console.log(`register ${label} -> 302 (new account)`);
    return true;
  }
  const login = await submit(session, '/login', '/login', {
    username: creds.username,
    password: creds.password
  });
  const ok = login.status === 302;
  console.log(`register ${label} -> ${reg.status} (already exists), login -> ${login.status}${ok ? '' : ' (FAILED)'}`);
  return ok;
}

// Map the post titles already shown on the home page to their ids, so a repeated run can reuse
// them. The listing renders each post as <a href="/posts/ID">TITLE</a>.
function existingPostsByTitle(html) {
  const map = {};
  const re = /<a href="\/posts\/(\d+)">([^<]+)<\/a>/g;
  let m;
  while ((m = re.exec(html)) !== null) map[m[2]] = m[1];
  return map;
}

const POSTS = [
  { title: 'Welcome to the blog', body: 'The first post. It talks about gardening and growing tomatoes at home.' },
  { title: 'A simple pasta recipe', body: 'Cook the pasta, add garlic and olive oil, and a little cheese. An easy recipe.' },
  { title: 'A trip to the mountains', body: 'Notes from a weekend of walking in the mountains, with cold air and long views.' },
  { title: 'A short book review', body: 'Thoughts on a novel about the sea and sailing. Worth reading on a quiet afternoon.' }
];

(async () => {
  const admin = newSession();
  await registerOrLogin(admin, {
    username: 'adminuser',
    email: 'admin@example.com',
    password: 'CorrectHorse9'
  }, 'admin');

  // Create only the posts that are not already there, so a repeated run stays at four posts.
  const present = existingPostsByTitle((await get(admin, '/')).body);
  const ids = [];
  const created = [];
  for (const p of POSTS) {
    if (present[p.title]) {
      ids.push(present[p.title]);
      continue;
    }
    const res = await submit(admin, '/posts/new', '/posts', { title: p.title, body: p.body });
    const id = postId(res);
    ids.push(id);
    created.push(id);
  }
  console.log('posts ->', ids.join(', '), created.length ? `(created ${created.length})` : '(all already present)');

  const user = newSession();
  await registerOrLogin(user, {
    username: 'bobuser',
    email: 'bob@example.com',
    password: 'CorrectHorse9'
  }, 'user');

  // Add the comments only when the posts were created this run, so repeated runs do not keep
  // appending the same comments to the same posts.
  const freshSeed = created.length === POSTS.length;
  if (freshSeed) {
    await submit(admin, `/posts/${ids[0]}`, `/posts/${ids[0]}/comments`, { body: 'Great first post, thanks for sharing.' });
    await submit(admin, `/posts/${ids[1]}`, `/posts/${ids[1]}/comments`, { body: 'I made this recipe and it worked well.' });
    await submit(user, `/posts/${ids[0]}`, `/posts/${ids[0]}/comments`, { body: 'I grow tomatoes too, they need a lot of sun.' });
    await submit(user, `/posts/${ids[2]}`, `/posts/${ids[2]}/comments`, { body: 'The mountains look beautiful in autumn.' });
    await submit(user, `/posts/${ids[3]}`, `/posts/${ids[3]}/comments`, { body: 'Adding this book to my reading list.' });
    console.log('comments added');
  } else {
    console.log('comments skipped (posts already existed)');
  }

  await get(admin, '/search?q=tomatoes');
  await get(admin, '/search?q=recipe');
  console.log('searches done');

  console.log('Seed complete.');
})().catch((e) => {
  console.error('Seed failed:', e.message);
  process.exit(1);
});
