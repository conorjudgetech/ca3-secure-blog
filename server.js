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

// [FIX-HEADERS] Report Secure-8 | OWASP Secure Headers Project + helmet
// WHY: script-src and style-src have no 'unsafe-inline', so an injected inline script is refused.
// RESIDUAL: a CSP is only as strong as its weakest directive, so the policy stays tight. Headers
//      back up encoding and parameterisation, they do not replace them.
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

// [FIX-SESSION] Report Secure-7 | OWASP + Session Management Cheat Sheet | CWE-384
// WHY: regenerating the session id on login (routes/auth.js) is what stops fixation.
// RESIDUAL: shorter timeouts cost convenience. A cookie stolen mid-session works until it
//      expires. Asking for the password again on sensitive actions would add more protection.
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
// [FIX-LOGGING] log attack signatures before CSRF and route handling so probes are recorded
// even when the request is rejected later. See src/middleware/detect.js.
app.use(detectAttacks);
app.use(verifyToken);

app.use('/', authRoutes);
app.use('/', postsRoutes);
app.use('/', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', { message: 'Page not found.' });
});

// [FIX-SDE] Report Secure-5 | OWASP A02:2021 + Error Handling Cheat Sheet | CWE-209 | closes #5
// WHY: unexpected errors are logged on the server. The client only sees a generic message.
//      SQL text, stack traces and file paths never reach an attacker.
// RESIDUAL: a generic message hides detail from an attacker. It does not fix the fault.
//      The security log records the failure so it can still be seen ([FIX-LOGGING]).
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { message: 'Something went wrong. Please try again.' });
});

app.listen(config.port, () => {
  console.log(`Server running at http://localhost:${config.port}`);
});
