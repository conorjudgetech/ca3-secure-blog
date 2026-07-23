const crypto = require('crypto');
const logger = require('../logger');

// [FIX-CSRF] OWASP + CSRF Prevention Cheat Sheet | CWE-352 | Report Secure-6
// WHY: a per-session synchroniser token is placed in a hidden field on every form that changes
//      state. On submit it is compared against the session copy with a constant-time check. A
//      cross-site request cannot read the token from the victim's session, so a forged POST is
//      rejected.
// RESIDUAL: the token only defends requests that change state. It is not a replacement for
//      authorization checks. SameSite=Strict cookies ([FIX-SESSION]) are the second layer.
//      GET requests must have no side effects for this to hold.

function issueToken(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

function verifyToken(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }
  const token = req.body && req.body._csrf;
  if (!token || !req.session.csrfToken || !safeEqual(token, req.session.csrfToken)) {
    logger.warn(`CSRF token validation failed for ${req.method} ${req.path}`, req);
    return res.status(403).render('error', { message: 'Invalid or missing form token.' });
  }
  next();
}

module.exports = { issueToken, verifyToken };
