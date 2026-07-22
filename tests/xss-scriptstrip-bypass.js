// Demonstrates why stripping <script> tags (the naive comment fix) is NOT a real XSS
// defence. Applies the exact strip used by the naive commit to several payloads and shows
// that non-<script> markup survives and that nesting reconstructs a <script> tag.
//
// Run: node tests/xss-scriptstrip-bypass.js
const strip = (s) => s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

const cases = [
  { name: 'plain <script>', payload: "<script>alert('x')</script>" },
  { name: 'img onerror',    payload: "<img src=1 onerror=alert('x')>" },
  { name: 'svg onload',     payload: "<svg onload=alert('x')>" },
  { name: 'nested script',  payload: "<scr<script>ipt>alert('x')</scr</script>ipt>" }
];

let bypasses = 0;
for (const c of cases) {
  const out = strip(c.payload);
  const dangerous = /onerror=|onload=|<script/i.test(out);
  console.log(`${dangerous ? 'BYPASS ' : 'blocked'}  ${c.name.padEnd(16)} -> ${JSON.stringify(out)}`);
  if (dangerous) bypasses++;
}

console.log(`\n${bypasses} of ${cases.length} payloads survive the denylist.`);
console.log('Only output encoding (escape everything) is a real fix — see [FIX-XSS-S].');
// The denylist is expected to be bypassable; a non-zero count is the point being proven.
process.exit(bypasses > 0 ? 0 : 1);
