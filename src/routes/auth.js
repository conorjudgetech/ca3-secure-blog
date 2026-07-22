const express = require('express');
const bcrypt = require('bcrypt');

const config = require('../config');
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

  // [FIX-SQLI] OWASP A03:2021 + SQL Injection Prevention Cheat Sheet | CWE-89 | Report Secure-1 | closes #1
  // WHY: the query is parsed with a bound parameter, so the username is only ever data and
  //      can never change the statement's structure — unlike blacklisting, this is
  //      context-independent and cannot be bypassed by a crafted payload.
  // RESIDUAL: parameterisation stops injection, not authorization flaws (IDOR) or
  //           non-parameterisable positions (table/column names, ORDER BY) — those need
  //           access-control checks and allow-listing respectively.
  const user = User.findByUsername(username);
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
