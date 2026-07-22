// Demonstrates why the naive quote-blacklist (src/naiveSanitise.js) is NOT a real
// SQL-injection defence. Runs against a throwaway in-memory database so the bypass is
// actually executed, not merely asserted.
//
// Run: node tests/sqli-blacklist-bypass.js
const Database = require('better-sqlite3');
const naiveSanitise = require('../src/naiveSanitise');

const db = new Database(':memory:');
db.exec(`
  CREATE TABLE items (id INTEGER PRIMARY KEY, owner TEXT, secret TEXT);
  INSERT INTO items (owner, secret) VALUES ('alice', 'alice-secret');
  INSERT INTO items (owner, secret) VALUES ('bob', 'bob-secret');
  INSERT INTO items (owner, secret) VALUES ('carol', 'carol-secret');
`);

let failures = 0;

// 1) In a quoted string context the blacklist DOES stop the classic tautology, which is
//    exactly why a student thinks the problem is solved.
const strInput = naiveSanitise("alice' OR '1'='1");
console.log(`[string context] sanitised input: "${strInput}" -> quotes stripped, tautology neutralised here.`);

// 2) DECISIVE BYPASS — numeric context needs no quotes, so quote-stripping is irrelevant.
//    A lookup like  WHERE id = <input>  is injected by  1 OR 1=1.
const payload = '1 OR 1=1';
const sanitised = naiveSanitise(payload); // unchanged: there were no quotes to strip
const injected = db.prepare(`SELECT * FROM items WHERE id = ${sanitised}`).all();
console.log(`[numeric context] sanitised payload: "${sanitised}"`);
console.log(`[numeric context] rows returned: ${injected.length} (expected 1 for a real id lookup)`);
if (injected.length === 3) {
  console.log('  => BYPASS CONFIRMED: quote-blacklisting returned the ENTIRE table.');
} else {
  console.log('  => bypass did not reproduce');
  failures++;
}

// 3) The robust control: a parameterised query treats the payload as a single value,
//    so the same input matches nothing.
const safe = db.prepare('SELECT * FROM items WHERE id = ?').all(payload);
console.log(`[parameterised] rows returned for the same payload: ${safe.length} (expected 0)`);
if (safe.length !== 0) {
  console.log('  => parameterised query unexpectedly leaked rows');
  failures++;
}

console.log(
  failures === 0
    ? '\nRESULT: blacklisting bypassed; parameterisation holds. (This is the [FIX-SQLI] argument.)'
    : '\nRESULT: demonstration did not run as expected'
);
process.exit(failures === 0 ? 0 : 1);
