// [FIX-XSS-D] OWASP A03 + DOM-based XSS Prevention Cheat Sheet | CWE-79 | Report Secure-4 | closes #4
// WHY: the q value from the URL is written with textContent, which sets it as a plain string.
//      The browser never parses it as HTML. An <img onerror> payload is shown as text instead
//      of running. The old innerHTML sink is what made this exploitable.
// RESIDUAL: textContent is safe for this text sink. Writing user data into innerHTML, a URL or
//      an event-handler attribute would bring the risk back. CSP is the backstop.
(function () {
  var q = new URLSearchParams(location.search).get('q');
  var results = document.getElementById('results');
  if (q !== null && results) {
    results.textContent = 'You searched for: ' + q;
  }
})();
