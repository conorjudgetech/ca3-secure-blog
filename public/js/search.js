// [VULN-XSS-D] OWASP A03:2021 | CWE-79 | Report Insecure-4 | Issue #4
// WHY: the q parameter is taken from the URL and written into the page with innerHTML,
//      so a value like <img src=1 onerror=alert('XSS')> is parsed as live HTML (DOM sink).
(function () {
  var q = new URLSearchParams(location.search).get('q');
  var results = document.getElementById('results');
  if (q !== null && results) {
    results.innerHTML = 'You searched for: ' + q;
  }
})();
