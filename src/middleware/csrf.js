const crypto = require('crypto');
const logger = require('../logger');

// [FIX-CSRF] Report Secure-6 | OWASP + CSRF Prevention Cheat Sheet | CWE-352
// WHY: a per-session synchroniser token sits in a hidden field on every state-changing form and
//      is checked in constant time on submit. A cross-site request cannot read it, so a forged POST fails.
// RESIDUAL: it only defends state-changing requests, not authorization. SameSite=Strict cookies
//      ([FIX-SESSION]) are the second layer, and GET requests must stay side-effect free.

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
