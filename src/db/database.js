const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config');

// Single shared SQLite connection for the whole application.
// Every model imports this module, so all database access goes through one
// connection configured in one place.
class DB {
  constructor() {
    if (DB.instance) {
      return DB.instance;
    }

    fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

    this.connection = new Database(config.dbPath);
    this.connection.pragma('journal_mode = WAL');
    this.connection.pragma('foreign_keys = ON');

    DB.instance = this;
  }

  get() {
    return this.connection;
  }
}

module.exports = new DB();
