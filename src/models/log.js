const db = require('../db/database').get();

const Log = {
  create({ level, event, username, ip }) {
    return db
      .prepare('INSERT INTO logs (level, event, username, ip) VALUES (?, ?, ?, ?)')
      .run(level, event, username || null, ip || null);
  },

  recent(limit = 200) {
    return db.prepare('SELECT * FROM logs ORDER BY created_at DESC, id DESC LIMIT ?').all(limit);
  }
};

module.exports = Log;
