const path = require('path');
const express = require('express');
const session = require('express-session');

const config = require('./src/config');
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
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 }
  })
);

app.use(currentUser);

app.use('/', authRoutes);
app.use('/', postsRoutes);
app.use('/', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', { message: 'Page not found.' });
});

// [FIX-SDE] OWASP A02:2021 + Error Handling Cheat Sheet | CWE-209 | Report Secure-5 | closes #5
// WHY: unexpected errors are logged server-side but the client only ever receives a generic
//      message, so SQL text, stack traces and file paths never reach an attacker.
// RESIDUAL: generic messages hide detail from attackers, not the fault itself — pair with
//      the security log so failures are still detected ([FIX-LOGGING]).
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { message: 'Something went wrong. Please try again.' });
});

app.listen(config.port, () => {
  console.log(`Server running at http://localhost:${config.port}`);
});
