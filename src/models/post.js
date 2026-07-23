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
    // [VULN-SQLI] OWASP A03:2021 Injection | CWE-89 | Report Insecure-1 | Issue #1
    // WHY: the search term is put into the query as text. A quote in the term ends the string
    //      and lets an attacker add UNION or OR clauses.
    const sql =
      "SELECT posts.*, users.username AS author " +
      "FROM posts JOIN users ON users.id = posts.user_id " +
      "WHERE posts.title LIKE '%" + term + "%' OR posts.body LIKE '%" + term + "%' " +
      "ORDER BY posts.created_at DESC";
    return db.prepare(sql).all();
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
