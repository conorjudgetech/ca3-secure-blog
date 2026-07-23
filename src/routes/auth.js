const express = require('express');

const db = require('../db/database').get();
const User = require('../models/user');
const logger = require('../logger');

const router = express.Router();

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegistration({ username, email, password }) {
  const errors = [];
  if (!USERNAME_RE.test(username || '')) {
    errors.push('Username must be 3-20 letters, numbers or underscores.');
  }
  if (!EMAIL_RE.test(email || '')) {
    errors.push('Enter a valid email address.');
  }
  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters.');
  }
  return errors;
}

router.get('/register', (req, res) => {
  res.render('register', { errors: [], values: {} });
});

router.post('/register', (req, res) => {
  const { username, email, password } = req.body;
  const errors = validateRegistration({ username, email, password });

  if (User.findByUsername(username)) errors.push('That username is taken.');
  if (User.findByEmail(email)) errors.push('That email is already registered.');

  if (errors.length) {
    return res.status(400).render('register', { errors, values: { username, email } });
  }

  // The very first account becomes the admin; everyone after is a regular user.
  const role = User.count() === 0 ? 'admin' : 'user';
  // [VULN-SDE] OWASP A02:2021 Cryptographic Failures | CWE-256 | Report Insecure-5 | Issue #5
  // WHY: the password is stored as plaintext. Anyone who reads the users table, through the SQL
  //      injection above or the debug dump, gets every password.
  const user = User.create({ username, email, password, role });

  logger.info(`New account registered: ${username} (${role})`, req);
  req.session.user = { id: user.id, username: user.username, role: user.role };
  res.redirect('/');
});

router.get('/login', (req, res) => {
  res.render('login', { errors: [], values: {} });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  // [VULN-SQLI] OWASP A03:2021 Injection | CWE-89 | Report Insecure-1 | Issue #1
  // WHY: the username and password are put straight into the SQL string. A value like
  //      admin' OR '1'='1 turns the WHERE clause into a condition that is always true. Login
  //      then succeeds whenever the query returns any row.
  const sql =
    "SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password + "'";

  let user;
  try {
    user = db.prepare(sql).get();
  } catch (err) {
    user = null;
  }

  if (!user) {
    logger.warn(`Failed login for username: ${username}`, req);
    return res.status(401).render('login', {
      errors: ['Invalid username or password.'],
      values: { username }
    });
  }

  req.session.user = { id: user.id, username: user.username, role: user.role };
  logger.info(`Login: ${user.username}`, req);
  res.redirect('/');
});

router.post('/logout', (req, res) => {
  if (req.session.user) {
    logger.info(`Logout: ${req.session.user.username}`, req);
  }
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
