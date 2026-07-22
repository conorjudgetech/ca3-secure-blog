// Naive, INSUFFICIENT input sanitisation. This is the rejected first attempt at an
// SQL-injection defence, kept only so the bypass can be demonstrated against it
// (see tests/sqli-blacklist-bypass.js). The shipped queries use parameterised
// statements instead — see the [FIX-SQLI] commit.
function naiveSanitise(input) {
  // Strip single quotes so they cannot break out of a quoted string literal.
  return String(input == null ? '' : input).replace(/'/g, '');
}

module.exports = naiveSanitise;
