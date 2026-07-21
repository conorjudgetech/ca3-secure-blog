const Log = require('./models/log');

// Records notable application events to the logs table so they can be
// reviewed by an admin. Takes the request so it can capture the client IP.
function record(level, event, req) {
  const username = req && req.session && req.session.user ? req.session.user.username : null;
  const ip = req ? req.ip : null;
  try {
    Log.create({ level, event, username, ip });
  } catch (err) {
    // Logging must never break the request it is describing.
    console.error('Failed to write log entry:', err.message);
  }
}

module.exports = {
  info: (event, req) => record('INFO', event, req),
  warn: (event, req) => record('WARN', event, req),
  error: (event, req) => record('ERROR', event, req)
};
