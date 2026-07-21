require('dotenv').config();

const path = require('path');

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-insecure-secret',
  dbPath: path.resolve(__dirname, '..', process.env.DB_PATH || 'data/blog.db'),
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12
};

module.exports = config;
