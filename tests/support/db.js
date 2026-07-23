// Direct access to the test database, for resetting it between tests and for checking stored
// state that the pages do not show, such as password hashes, roles and log rows. This opens the
// same SQLite file the application uses, set through DB_PATH in playwright.config.js.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = path.resolve(__dirname, '../..');
const TEST_DB = path.join(ROOT, 'data', 'test.db');
const SCHEMA = path.join(ROOT, 'src', 'db', 'schema.sql');

function openDb() {
  return new Database(TEST_DB);
}

// Empty every table so each test starts from a known state. The schema is applied first with
// CREATE TABLE IF NOT EXISTS, so this works even on a fresh file.
function resetDatabase() {
  const db = openDb();
  db.exec(fs.readFileSync(SCHEMA, 'utf8'));
  db.pragma('foreign_keys = OFF');
  for (const table of ['comments', 'posts', 'logs', 'users']) {
    db.exec(`DELETE FROM ${table}`);
  }
  const hasSeq = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'")
    .get();
  if (hasSeq) {
    db.exec('DELETE FROM sqlite_sequence');
  }
  db.close();
}

function getUser(username) {
  const db = openDb();
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  db.close();
  return row;
}

function count(table) {
  const db = openDb();
  const n = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
  db.close();
  return n;
}

function allLogs() {
  const db = openDb();
  const rows = db.prepare('SELECT * FROM logs ORDER BY id ASC').all();
  db.close();
  return rows;
}

module.exports = { TEST_DB, openDb, resetDatabase, getUser, count, allLogs };
