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
  }
};

module.exports = User;
