require('dotenv').config();

const path = require('path');

// [FIX-SDE] OWASP A02:2021 | CWE-798 | Report Secure-5 | closes #5
// WHY: all secrets (session signing key, DB path, work factor) are read from the
//      environment via a gitignored .env, never hard-coded or committed. .env.example
//      documents the keys without values.
// RESIDUAL: the dev fallback secret below is only for a fresh local checkout; a real
//      deployment must set SESSION_SECRET (the README says so) or sessions are forgeable.
const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-insecure-secret',
  dbPath: path.resolve(__dirname, '..', process.env.DB_PATH || 'data/blog.db'),
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
  isProduction: process.env.NODE_ENV === 'production',
  sessionIdleTimeoutMs: parseInt(process.env.SESSION_IDLE_MS, 10) || 30 * 60 * 1000, // 30 minutes
  sessionAbsoluteTimeoutMs: parseInt(process.env.SESSION_ABSOLUTE_MS, 10) || 8 * 60 * 60 * 1000, // 8 hours
  lockoutThreshold: parseInt(process.env.LOCKOUT_THRESHOLD, 10) || 5,
  lockoutMinutes: parseInt(process.env.LOCKOUT_MINUTES, 10) || 15
};

module.exports = config;
