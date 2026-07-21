const db = require('../db/database').get();

const Comment = {
  forPost(postId) {
    return db
      .prepare(
        `SELECT comments.*, users.username AS author
         FROM comments
         JOIN users ON users.id = comments.user_id
         WHERE comments.post_id = ?
         ORDER BY comments.created_at ASC`
      )
      .all(postId);
  },

  create({ postId, userId, body }) {
    const result = db
      .prepare('INSERT INTO comments (post_id, user_id, body) VALUES (?, ?, ?)')
      .run(postId, userId, body);
    return db.prepare('SELECT * FROM comments WHERE id = ?').get(result.lastInsertRowid);
  }
};

module.exports = Comment;
