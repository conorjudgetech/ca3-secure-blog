const express = require('express');
const Post = require('../models/post');

const router = express.Router();

// Home page: list all posts, newest first.
router.get('/', (req, res) => {
  res.render('index', { posts: Post.all() });
});

module.exports = router;
