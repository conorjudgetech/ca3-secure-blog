const express = require('express');
const bcrypt = require('bcrypt');

const config = require('../config');
const User = require('../models/user');
const logger = require('../logger');

const router = express.Router();

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// [FIX-ENUM] fixed dummy hash compared against when a username is unknown, so login timing
// does not reveal whether an account exists. | Report Secure-5
const DUMMY_HASH = bcrypt.hashSync('timing-safe-dummy-password', config.bcryptRounds);

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

// [FIX-SESSION] regenerate the session on authentication so a pre-login (possibly attacker-
// fixed) session id cannot be reused — defeats session fixation — and stamp the creation time
// used by the absolute-timeout check.
function establishSession(req, user, onDone) {
  req.session.regenerate((err) => {
    if (err) logger.error(`Session regeneration failed: ${err.message}`, req);
    req.session.user = { id: user.id, username: user.username, role: user.role };
    req.session.createdAt = Date.now();
    req.session.save(() => onDone());
  });
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

  // [FIX-SDE] OWASP A02:2021 + Password Storage Cheat Sheet | CWE-256 | Report Secure-5 | closes #5
  // WHY: the password is stored only as a bcrypt hash (per-user salt built in, tuned work
  //      factor via BCRYPT_ROUNDS); bcrypt.compare is constant-time, so a database leak does
  //      not expose credentials and verification is not timing-attackable.
  // RESIDUAL: hashing protects passwords at rest, not a live hijacked session or a weak
  //      user-chosen password; pair with session controls and a breached-password check.
  const hash = await bcrypt.hash(password, config.bcryptRounds);
  // The very first account becomes the admin; everyone after is a regular user.
  const role = User.count() === 0 ? 'admin' : 'user';
  const user = User.create({ username, email, password: hash, role });

  logger.info(`New account registered: ${username} (${role})`, req);
  establishSession(req, user, () => res.redirect('/'));
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

  // [FIX-LOCKOUT] brute-force lockout — reject while locked with the generic error | Report Secure-5 | #1
  if (user && User.isLocked(user.id)) {
    logger.warn(`Login blocked (account locked): ${username}`, req);
    return res.status(401).render('login', {
      errors: ['Invalid username or password.'],
      values: { username }
    });
  }

  const ok = (await bcrypt.compare(password || '', user ? user.password : DUMMY_HASH)) && !!user;

  if (!ok) {
    if (user) User.recordFailedLogin(user.id, config.lockoutThreshold, config.lockoutMinutes);
    logger.warn(`Failed login for username: ${username}`, req);
    return res.status(401).render('login', {
      errors: ['Invalid username or password.'],
      values: { username }
    });
  }

  User.clearFailedLogins(user.id);
  logger.info(`Login: ${user.username}`, req);
  establishSession(req, user, () => res.redirect('/'));
});

router.post('/logout', (req, res) => {
  if (req.session.user) {
    logger.info(`Logout: ${req.session.user.username}`, req);
  }
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
