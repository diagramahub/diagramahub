// Mermaid diagram types benchmark, phase 2: render every result with the app's own mermaid
// build, then print the summary. Usage: node scripts/ai-benchmark/validate_mermaid_types.js <results.json>
// (needs Playwright and the dev stack on :5173)
const { chromium } = require('playwright');
const fs = require('fs');

const header = (code) => {
  const body = (code || '').replace(/^\s*---[ \t]*\n[\s\S]*?\n---[ \t]*\n/, '');
  const line = body.split('\n').map((l) => l.replace(/%%.*$/, '').trim()).find(Boolean) || '';
  return line.split(/\s/)[0];
};
const rightType = (r) => [r.case, String(r.case).replace(/-beta$/, ''), `${r.case}-beta`].includes(r.header);

(async () => {
  const file = process.argv[2];
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const todo = data.results.filter((r) => r.ok_call && r.code);
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('http://localhost:5173/login');
  await p.waitForTimeout(1500);
  const verdicts = await p.evaluate(async (codes) => {
    const mermaid = (await import('/node_modules/.vite/deps/mermaid.js')).default;
    mermaid.initialize({ startOnLoad: false });
    const out = [];
    for (const [i, code] of codes.entries()) {
      try { await mermaid.render(`bench${i}`, code); out.push(''); } catch (e) { out.push(String(e.message || e).split('\n')[0].slice(0, 160) || 'invalid'); }
    }
    return out;
  }, todo.map((r) => r.code));
  await b.close();
  todo.forEach((r, i) => { r.valid = verdicts[i] === ''; r.validation_error = verdicts[i]; });
  for (const r of data.results) { r.valid = !!r.valid; r.header = header(r.code); }
  fs.writeFileSync(file, JSON.stringify(data, null, 1));

  const rows = {};
  for (const r of data.results) {
    const key = `${r.model.padEnd(24)} ${r.task.padEnd(9)} ${r.kind.padEnd(8)}`;
    const row = (rows[key] ??= { total: 0, valid: 0, typed: 0, callErrors: 0 });
    row.total++;
    if (r.valid) row.valid++;
    if (r.valid && (r.kind !== 'modern' || r.task === 'fix' || rightType(r))) row.typed++;
    if (!r.ok_call) row.callErrors++;
  }
  console.log(`\n${data.label}`);
  console.log('model'.padEnd(24), 'task'.padEnd(9), 'kind'.padEnd(8), 'renders  requested-type+renders  call-errors');
  for (const [key, row] of Object.entries(rows).sort()) {
    const pct = (n) => `${String(n).padStart(2)}/${row.total} (${Math.round((100 * n) / row.total)}%)`.padEnd(13);
    console.log(key, pct(row.valid), '   ', pct(row.typed), '        ', row.callErrors);
  }
  console.log('\nFailures:');
  for (const r of data.results.filter((x) => !(x.valid && (x.kind !== 'modern' || x.task === 'fix' || rightType(x))))) {
    console.log(`  ${r.model} ${r.task} ${r.case} header=${r.header || '-'}: ${(r.validation_error || r.error || (r.valid ? 'another type' : '')).slice(0, 110)}`);
  }
})();
