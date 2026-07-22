const path = require('path');
const express = require('express');
const session = require('express-session');

const config = require('./src/config');
const secrets = require('./src/secrets');
const db = require('./src/db/database').get();
const { currentUser } = require('./src/middleware/auth');
const authRoutes = require('./src/routes/auth');
const postsRoutes = require('./src/routes/posts');
const adminRoutes = require('./src/routes/admin');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    name: 'sid',
    // [VULN-SDE] OWASP A02:2021 | CWE-798 | Report Insecure-5 | Issue #5
    // WHY: the session signing key comes from a hard-coded, committed secret; anyone with
    //      repo access can forge session cookies.
    secret: secrets.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 }
  })
);

app.use(currentUser);

// [VULN-SDE] OWASP A02:2021 | CWE-215 | Report Insecure-5 | Issue #5
// WHY: any request with ?debug=true dumps internal diagnostics — the hard-coded secrets,
//      the session, and the users table with plaintext passwords — to any caller.
app.use((req, res, next) => {
  if (req.query.debug === 'true') {
    return res.json({
      message: 'debug mode',
      secrets: { apiKey: secrets.apiKey, sessionSecret: secrets.sessionSecret },
      session: req.session,
      users: db.prepare('SELECT id, username, email, password, role FROM users').all()
    });
  }
  next();
});

app.use('/', authRoutes);
app.use('/', postsRoutes);
app.use('/', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', { message: 'Page not found.' });
});

// [VULN-SDE] OWASP A02:2021 | CWE-209 | Report Insecure-5 | Issue #5
// WHY: the raw error message and stack trace are returned to the client, leaking the SQL,
//      file paths and library internals that help an attacker map the system.
app.use((err, req, res, next) => {
  res.status(500).send('<pre>' + err.stack + '</pre>');
});

app.listen(config.port, () => {
  console.log(`Server running at http://localhost:${config.port}`);
});
