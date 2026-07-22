// [VULN-SDE] OWASP A02:2021 Cryptographic Failures | CWE-798 | Report Insecure-5 | Issue #5
// WHY: application secrets are hard-coded and committed to source control instead of being
//      loaded from the environment, so anyone with repository access obtains them.
// NOTE: these are throwaway demo values, never real credentials.
module.exports = {
  sessionSecret: 'hardcoded-session-secret-please-change-in-prod',
  apiKey: 'DEMO_1234567890_hardcoded_api_key_not_real'
};
