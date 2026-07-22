const express = require('express');
const Post = require('../models/post');
const Comment = require('../models/comment');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const logger = require('../logger');

const router = express.Router();

// Home page: list all posts, newest first.
router.get('/', (req, res) => {
  res.render('index', { posts: Post.all() });
});

router.get('/search', (req, res) => {
  const q = (req.query.q || '').trim();
  const results = q ? Post.search(q) : [];
  res.render('search', { q, results });
});

router.get('/posts/new', requireAuth, (req, res) => {
  res.render('new-post', { errors: [], values: {} });
});

router.post('/posts', requireAuth, (req, res) => {
  const title = (req.body.title || '').trim();
  const body = (req.body.body || '').trim();

  const errors = [];
  if (!title || title.length > 200) errors.push('Title is required (max 200 characters).');
  if (!body) errors.push('Body is required.');

  if (errors.length) {
    return res.status(400).render('new-post', { errors, values: { title, body } });
  }

  const post = Post.create({ userId: req.session.user.id, title, body });
  logger.info(`Post created: #${post.id} by ${req.session.user.username}`, req);
  res.redirect(`/posts/${post.id}`);
});

router.get('/posts/:id', (req, res) => {
  const post = Post.findById(req.params.id);
  if (!post) {
    return res.status(404).render('error', { message: 'Post not found.' });
  }
  res.render('post', { post, comments: Comment.forPost(post.id) });
});

router.post('/posts/:id/comments', requireAuth, (req, res) => {
  const post = Post.findById(req.params.id);
  if (!post) {
    return res.status(404).render('error', { message: 'Post not found.' });
  }

  // NAIVE FIX (rejected): strip <script> tags then render the comment as raw HTML. This
  // stops the obvious <script> payload but is a denylist — any other markup (e.g. an event
  // handler) sails through. Replaced by output encoding in the [FIX-XSS-S] commit.
  const raw = (req.body.body || '').trim();
  const body = raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  if (!body) {
    return res.redirect(`/posts/${post.id}`);
  }

  Comment.create({ postId: post.id, userId: req.session.user.id, body });
  logger.info(`Comment added on post #${post.id} by ${req.session.user.username}`, req);
  res.redirect(`/posts/${post.id}`);
});

router.post('/posts/:id/delete', requireAdmin, (req, res) => {
  const post = Post.findById(req.params.id);
  if (!post) {
    return res.status(404).render('error', { message: 'Post not found.' });
  }

  Post.delete(post.id);
  logger.warn(`Post deleted: #${post.id} by admin ${req.session.user.username}`, req);
  res.redirect('/');
});

module.exports = router;
