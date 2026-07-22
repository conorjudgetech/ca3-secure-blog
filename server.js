const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');

const config = require('./src/config');
const { currentUser } = require('./src/middleware/auth');
const { issueToken, verifyToken } = require('./src/middleware/csrf');
const detectAttacks = require('./src/middleware/detect');
const authRoutes = require('./src/routes/auth');
const postsRoutes = require('./src/routes/posts');
const adminRoutes = require('./src/routes/admin');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// [FIX-HEADERS] OWASP Secure Headers Project + helmet | Report Secure-8
// WHY: sets defensive response headers on every request. The Content-Security-Policy limits
//      scripts and styles to same-origin with no inline execution, so it is the defence-in-depth
//      backstop for XSS — an injected inline <script> or onerror handler is refused by the
//      browser even if an output-encoding slip ever let markup through. X-Content-Type-Options
//      stops MIME sniffing, frameAncestors 'none' blocks clickjacking, HSTS enforces HTTPS.
// RESIDUAL: a CSP is only as strong as its weakest directive — 'unsafe-inline' or a broad host
//      allow-list would reopen the gap, so the policy stays tight; headers complement, not replace,
//      the primary controls (encoding, parameterisation).
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"]
      }
    }
  })
);

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// [FIX-SESSION] OWASP + Session Management Cheat Sheet | CWE-384 | Report Secure-7
// WHY: cookies are HttpOnly (unreadable from JS, limiting XSS session theft), SameSite=Strict
//      (not sent on cross-site requests, backing the CSRF defence) and Secure in production
//      (HTTPS only). rolling:true renews the cookie on activity, giving an idle timeout; an
//      absolute timeout (below) and session regeneration on login (routes/auth.js) cap a
//      session's lifetime and defeat fixation.
// RESIDUAL: shorter timeouts trade convenience for exposure, and a token stolen mid-session is
//      usable until it expires — re-auth for sensitive actions would harden this further.
app.use(
  session({
    name: 'sid',
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: config.isProduction,
      maxAge: config.sessionIdleTimeoutMs
    }
  })
);

app.use(currentUser);

// [FIX-SESSION] enforce the absolute session lifetime (the rolling cookie handles idle timeout).
app.use((req, res, next) => {
  if (
    req.session.user &&
    req.session.createdAt &&
    Date.now() - req.session.createdAt > config.sessionAbsoluteTimeoutMs
  ) {
    return req.session.destroy(() => res.redirect('/login'));
  }
  next();
});

// [FIX-CSRF] issue the per-session token to every view, then reject any state-changing
// request whose token is missing or wrong. See src/middleware/csrf.js.
app.use(issueToken);
// [FIX-LOGGING] log attack signatures before CSRF/route handling so probes are recorded
// even when the request is subsequently rejected. See src/middleware/detect.js.
app.use(detectAttacks);
app.use(verifyToken);

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
