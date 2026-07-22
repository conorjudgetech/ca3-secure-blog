const path = require('path');
const express = require('express');
const session = require('express-session');

const config = require('./src/config');
const { currentUser } = require('./src/middleware/auth');
const authRoutes = require('./src/routes/auth');
const postsRoutes = require('./src/routes/posts');
const adminRoutes = require('./src/routes/admin');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    name: 'sid',
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 }
  })
);

app.use(currentUser);

app.use('/', authRoutes);
app.use('/', postsRoutes);
app.use('/', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', { message: 'Page not found.' });
});

app.listen(config.port, () => {
  console.log(`Server running at http://localhost:${config.port}`);
});
