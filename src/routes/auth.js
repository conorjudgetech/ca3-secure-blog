const express = require('express');
const bcrypt = require('bcrypt');

const config = require('../config');
const User = require('../models/user');
const logger = require('../logger');

const router = express.Router();

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// [FIX-ENUM] login timing does not reveal whether an account exists | Report Secure-5
// When the username is unknown, the password is compared against a fixed dummy hash. The
// request then takes the same time as a real username with a wrong password.
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

// [FIX-SESSION] regenerate the session on login so a session id set before login cannot be
// reused. This stops session fixation. Also record the creation time used by the
// absolute-timeout check.
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
  // WHY: the password is stored only as a bcrypt hash. bcrypt adds a per-user salt and uses a
  //      work factor set by BCRYPT_ROUNDS. bcrypt.compare runs in constant time. A database leak
  //      does not expose the password and the check cannot be timed.
  // RESIDUAL: hashing protects the stored password. It does not protect a hijacked live session
  //      or a weak password the user chose. Pair it with session controls and a breached-password
  //      check.
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
  // WHY: the query uses a bound parameter, so the username is always data. It can never change
  //      the structure of the statement. Unlike a blacklist, this works in any context and
  //      cannot be bypassed by a crafted payload.
  // RESIDUAL: parameterisation stops injection. It does not stop authorization flaws (IDOR) or
  //           parts of a query that cannot be bound (table or column names, ORDER BY). Those need
  //           access-control checks and allow-listing.
  const user = User.findByUsername(username);

  // [FIX-LOCKOUT] brute-force lockout, reject while locked with the generic error | Report Secure-5 | #1
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
