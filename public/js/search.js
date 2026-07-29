// [FIX-XSS-D] Report Secure-4 | OWASP A03 + DOM-based XSS Prevention Cheat Sheet | CWE-79 | closes #4
// WHY: the q value from the URL is written with textContent, so the browser sets it as plain
//      text and never parses it as HTML. The old innerHTML sink is what made this exploitable.
// RESIDUAL: textContent is safe for this text sink. Writing user data into innerHTML, a URL or
//      an event-handler attribute would bring the risk back. CSP is the backstop.
(function () {
  var q = new URLSearchParams(location.search).get('q');
  var results = document.getElementById('results');
  if (q !== null && results) {
    results.textContent = 'You searched for: ' + q;
  }
})();
