const express = require('express');
const bcrypt = require('bcrypt');

const config = require('../config');
const db = require('../db/database').get();
const User = require('../models/user');
const naiveSanitise = require('../naiveSanitise');
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

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  const errors = validateRegistration({ username, email, password });

  if (User.findByUsername(username)) errors.push('That username is taken.');
  if (User.findByEmail(email)) errors.push('That email is already registered.');

  if (errors.length) {
    return res.status(400).render('register', { errors, values: { username, email } });
  }

  const hash = await bcrypt.hash(password, config.bcryptRounds);
  // The very first account becomes the admin; everyone after is a regular user.
  const role = User.count() === 0 ? 'admin' : 'user';
  const user = User.create({ username, email, password: hash, role });

  logger.info(`New account registered: ${username} (${role})`, req);
  req.session.user = { id: user.id, username: user.username, role: user.role };
  res.redirect('/');
});

router.get('/login', (req, res) => {
  res.render('login', { errors: [], values: {} });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // NAIVE FIX (rejected): a concatenated query defended with quote-blacklisting. It stops
  // the basic  admin' OR '1'='1  tautology but is not a real control — quote-stripping is a
  // denylist that fails in other contexts (see tests/sqli-blacklist-bypass.js). Replaced by
  // parameterised queries in the [FIX-SQLI] commit.
  const sql = "SELECT * FROM users WHERE username = '" + naiveSanitise(username) + "'";
  const user = db.prepare(sql).get();
  const ok = user && (await bcrypt.compare(password || '', user.password));

  if (!ok) {
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
