const logger = require('../logger');

// [FIX-LOGGING] OWASP A09:2021 Security Logging and Monitoring Failures | Report Secure-8
// WHY: scans incoming query/body values for signatures of the attacks this app studies —
//      SQL injection (' OR, --, UNION SELECT, ; DROP) and XSS (<script, onerror=, onload=,
//      javascript:) — and records a WARN with the user and IP. Together with the auth events
//      (login success/failure, registration) and admin actions already logged, these lines are
//      what turn "an attack happened" into evidence: an injection probe, a stored-script attempt,
//      a failed-login spike.
// RESIDUAL: signature matching catches known probes, not novel or encoded payloads, and it does
//      not block — detection complements the primary controls (parameterisation, encoding), it
//      does not replace them.
const SIGNATURES = [
  { name: 'SQL injection', re: /('\s*or\s|--|\bunion\b\s+\bselect\b|;\s*drop\b)/i },
  { name: 'XSS', re: /(<script\b|onerror\s*=|onload\s*=|javascript:)/i }
];

function detectAttacks(req, res, next) {
  const values = [...Object.values(req.query || {}), ...Object.values(req.body || {})].filter(
    (v) => typeof v === 'string'
  );

  for (const value of values) {
    const match = SIGNATURES.find((sig) => sig.re.test(value));
    if (match) {
      logger.warn(
        `Possible ${match.name} attempt: ${req.method} ${req.path} payload=${JSON.stringify(
          value
        ).slice(0, 120)}`,
        req
      );
      break;
    }
  }
  next();
}

module.exports = detectAttacks;
