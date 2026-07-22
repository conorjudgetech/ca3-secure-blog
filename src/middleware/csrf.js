const crypto = require('crypto');
const logger = require('../logger');

// [FIX-CSRF] OWASP + CSRF Prevention Cheat Sheet | CWE-352 | Report Secure-6
// WHY: a per-session synchroniser token is placed in a hidden field on every state-changing
//      form and compared (constant-time) against the session copy on submit. A cross-site
//      request cannot read the token from the victim's session, so forged POSTs are rejected.
// RESIDUAL: the token defends state-changing requests only; it is not a substitute for
//      authorization checks, and SameSite=Strict cookies ([FIX-SESSION]) are the complementary
//      layer. Safe (GET) requests must stay side-effect free for this model to hold.

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
