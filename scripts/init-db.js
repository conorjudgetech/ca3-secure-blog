// Creates the database file and applies the schema. Safe to run repeatedly;
// the schema uses "IF NOT EXISTS" so existing data is left untouched.
const fs = require('fs');
const path = require('path');
const db = require('../src/db/database').get();

const schema = fs.readFileSync(path.join(__dirname, '..', 'src', 'db', 'schema.sql'), 'utf8');
db.exec(schema);

console.log('Database initialised.');
