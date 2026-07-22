const express = require('express');
const Log = require('../models/log');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/admin/logs', requireAdmin, (req, res) => {
  res.render('logs', { logs: Log.recent() });
});

module.exports = router;
