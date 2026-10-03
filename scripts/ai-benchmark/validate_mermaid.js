// G9 benchmark, phase 2: validate the Mermaid results with the app's own mermaid build,
// then print the summary table. Usage: node scripts/ai-benchmark/validate_mermaid.js <results.json>  (needs Playwright and the dev stack on :5173)
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const file = process.argv[2];
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const mermaidCases = data.results.filter((r) => r.type === 'mermaid' && r.ok_call);
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('http://localhost:5173/login'); await p.waitForTimeout(1500);
  const verdicts = await p.evaluate(async (codes) => {
    const mermaid = (await import('/node_modules/.vite/deps/mermaid.js')).default;
    mermaid.initialize({ startOnLoad: false });
    const out = [];
    for (const code of codes) {
      try { await mermaid.parse(code); out.push(''); } catch (e) { out.push(String(e.message || e).split('\n').slice(0, 2).join(' ').slice(0, 200) || 'invalid'); }
    }
    return out;
  }, mermaidCases.map((r) => r.code));
  mermaidCases.forEach((r, i) => { r.valid = verdicts[i] === ''; r.validation_error = verdicts[i]; });
  await b.close();
  fs.writeFileSync(file, JSON.stringify(data, null, 1));

  // Summary
  const byModel = {};
  for (const r of data.results) {
    const m = (byModel[r.model] ??= { total: 0, valid: 0, failedCall: 0, preamble: 0, perType: {} });
    m.total++;
    if (!r.ok_call) m.failedCall++;
    if (r.valid) m.valid++;
    const firstLine = (r.code || '').trim().split('\n')[0] || '';
    if (r.ok_call && /^(aqu[ií]|here|claro|sure|este diagrama|```)/i.test(firstLine)) m.preamble++;
    const t = (m.perType[r.type] ??= { total: 0, valid: 0 });
    t.total++; if (r.valid) t.valid++;
  }
  console.log(`\n${data.label}`);
  console.log('model'.padEnd(28), 'valid', '  mermaid plantuml d2   dbml   call-errors preamble');
  let all = 0, allValid = 0;
  for (const [model, m] of Object.entries(byModel)) {
    all += m.total; allValid += m.valid;
    const pt = (k) => `${m.perType[k]?.valid ?? 0}/${m.perType[k]?.total ?? 0}`.padEnd(7);
    console.log(model.padEnd(28), `${Math.round((100 * m.valid) / m.total)}%`.padEnd(6), ' ', pt('mermaid'), pt('plantuml'), pt('d2'), pt('dbml'), String(m.failedCall).padEnd(11), m.preamble);
  }
  console.log('TOTAL'.padEnd(28), `${Math.round((100 * allValid) / all)}% (${allValid}/${all})`);
})().catch((e) => { console.error('ERR', e.message.split('\n')[0]); process.exit(1); });
