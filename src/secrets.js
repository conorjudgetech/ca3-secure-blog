// [VULN-SDE] Report Insecure-5 | OWASP A02:2021 Cryptographic Failures | CWE-798 | Issue #5
// WHY: these secrets are hard-coded and committed to source control instead of being read
//      from the environment. Anyone with repository access gets them.
// NOTE: these are throwaway demo values, never real credentials.
module.exports = {
  sessionSecret: 'hardcoded-session-secret-please-change-in-prod',
  apiKey: 'DEMO_1234567890_hardcoded_api_key_not_real'
};
