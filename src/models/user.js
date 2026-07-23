const db = require('../db/database').get();

const User = {
  findById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  findByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  },

  findByEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  },

  count() {
    return db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  },

  create({ username, email, password, role }) {
    const result = db
      .prepare('INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)')
      .run(username, email, password, role);
    return this.findById(result.lastInsertRowid);
  },

  // [FIX-LOCKOUT] brute-force lockout using the failed_attempts and locked_until columns | Report Secure-5
  isLocked(id) {
    const row = db
      .prepare("SELECT (locked_until IS NOT NULL AND locked_until > datetime('now')) AS locked FROM users WHERE id = ?")
      .get(id);
    return !!(row && row.locked);
  },

  recordFailedLogin(id, threshold, minutes) {
    db.prepare('UPDATE users SET failed_attempts = failed_attempts + 1 WHERE id = ?').run(id);
    db.prepare("UPDATE users SET locked_until = datetime('now', ?) WHERE id = ? AND failed_attempts >= ?")
      .run(`+${minutes} minutes`, id, threshold);
  },

  clearFailedLogins(id) {
    db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?').run(id);
  }
};

module.exports = User;
