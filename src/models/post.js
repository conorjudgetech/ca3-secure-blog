const db = require('../db/database').get();

const Post = {
  // Posts joined with their author's username, newest first.
  all() {
    return db
      .prepare(
        `SELECT posts.*, users.username AS author
         FROM posts
         JOIN users ON users.id = posts.user_id
         ORDER BY posts.created_at DESC`
      )
      .all();
  },

  findById(id) {
    return db
      .prepare(
        `SELECT posts.*, users.username AS author
         FROM posts
         JOIN users ON users.id = posts.user_id
         WHERE posts.id = ?`
      )
      .get(id);
  },

  search(term) {
    // [FIX-SQLI] OWASP A03:2021 + SQL Injection Prevention Cheat Sheet | CWE-89 | Report Secure-1 | closes #1
    // WHY: the term is bound as a parameter, so quotes or SQL keywords in it are treated as
    //      literal characters of the LIKE pattern, never as query syntax.
    // RESIDUAL: the LIKE wildcards % and _ in user input still act as wildcards (search
    //           semantics, not injection); escape them if exact-substring matching matters.
    return db
      .prepare(
        `SELECT posts.*, users.username AS author
         FROM posts
         JOIN users ON users.id = posts.user_id
         WHERE posts.title LIKE ? OR posts.body LIKE ?
         ORDER BY posts.created_at DESC`
      )
      .all(`%${term}%`, `%${term}%`);
  },

  create({ userId, title, body }) {
    const result = db
      .prepare('INSERT INTO posts (user_id, title, body) VALUES (?, ?, ?)')
      .run(userId, title, body);
    return this.findById(result.lastInsertRowid);
  },

  delete(id) {
    return db.prepare('DELETE FROM posts WHERE id = ?').run(id);
  }
};

module.exports = Post;
