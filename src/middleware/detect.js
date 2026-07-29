const logger = require('../logger');

// [FIX-LOGGING] Report Secure-9 | OWASP A09:2021 Security Logging and Monitoring Failures
// WHY: scans query and body values for SQL injection and XSS signatures. On a match it logs a
//      WARN with the user and IP, so an injection or stored-script probe becomes reviewable evidence.
// RESIDUAL: signature matching catches known probes, not new or encoded payloads, and it does not
//      block. Detection adds to parameterisation and encoding, it does not replace them.
const SIGNATURES = [
  { name: 'SQL injection', re: /('\s*or\s|--|\bunion\b\s+\bselect\b|;\s*drop\b)/i },
  { name: 'XSS', re: /(<script\b|onerror\s*=|onload\s*=|javascript:)/i }
];

// [FIX-LOGGING] never scan or log secret fields, and log only a short snippet, so credentials
// or long post bodies are not written verbatim to the log.
const SKIP_FIELDS = new Set(['password', '_csrf']);

function scannableValues(obj) {
  return Object.entries(obj || {})
    .filter(([key, value]) => typeof value === 'string' && !SKIP_FIELDS.has(key))
    .map(([, value]) => value);
}

function detectAttacks(req, res, next) {
  const values = [...scannableValues(req.query), ...scannableValues(req.body)];

  for (const value of values) {
    const match = SIGNATURES.find((sig) => sig.re.test(value));
    if (match) {
      const snippet = value.slice(0, 40).replace(/\s+/g, ' ');
      logger.warn(`Possible ${match.name} attempt: ${req.method} ${req.path} match="${snippet}"`, req);
      break;
    }
  }
  next();
}

module.exports = detectAttacks;
