// Makes the logged-in user available to every template as `currentUser`.
function currentUser(req, res, next) {
  res.locals.currentUser = req.session.user || null;
  next();
}

// Guards routes that require an authenticated user.
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

// Guards routes that require the admin role.
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).render('error', { message: 'Admins only.' });
  }
  next();
}

module.exports = { currentUser, requireAuth, requireAdmin };
