import { readFileSync } from 'fs';
import { Compass } from './src/compass.js';

const graph = JSON.parse(readFileSync('./data/compass.json', 'utf8'));

// mean weight per pathway, to sanity-check what one spike is worth
const t = new Map(graph.nodes.map((n) => [n.bodyId, n.type]));
const agg = new Map();
for (const e of graph.edges) {
  const k = `${t.get(e.source)}->${t.get(e.target)}`;
  const a = agg.get(k) || { c: 0, w: 0 };
  a.c++; a.w += e.weight; agg.set(k, a);
}
console.log('pathway                       mean w   mV per spike @gain 1');
for (const [k, a] of [...agg].sort((x, y) => y[1].w - x[1].w).slice(0, 6)) {
  console.log(`${k.padEnd(28)} ${(a.w / a.c).toFixed(1).padStart(6)}   ${(a.w / a.c * 0.275).toFixed(2)}`);
}

function trial(opts, ms = 1200) {
  const c = new Compass(graph, opts);
  c.seed(0);
  c.setTurn(0);
  for (let i = 0; i < ms; i++) c.step(1.0);
  const h = c.heading();
  const rate = c.epgRate();
  return { rate, strength: rate < 0.5 ? 0 : h.strength, theta: h.theta };
}

console.log('\nexc    inh    tonic | EPG Hz   bump   verdict');
console.log('-'.repeat(52));
const rows = [];
for (const excGain of [0.05, 0.1, 0.2, 0.35, 0.6])
  for (const inhGain of [0.2, 0.5, 1.0, 2.0, 4.0])
    for (const tonic of [0.26, 0.30, 0.33, 0.36]) {
      const r = trial({ excGain, inhGain, tonic });
      let v = r.rate < 0.5 ? 'silent'
        : r.rate > 200 ? 'SEIZURE'
        : r.strength > 0.5 ? '*** BUMP ***' : 'diffuse';
      rows.push({ excGain, inhGain, tonic, ...r, v });
      if (r.rate >= 0.3)
        console.log(`${excGain.toFixed(2)}   ${inhGain.toFixed(2)}   ${tonic.toFixed(2)} | ${r.rate.toFixed(1).padStart(6)}  ${r.strength.toFixed(2).padStart(5)}   ${v}`);
    }

const good = rows.filter((r) => r.v.includes('BUMP')).sort((a, b) => b.strength - a.strength);
console.log(`\n${good.length} bump-forming configs of ${rows.length}`);
for (const g of good.slice(0, 5)) console.log('  ', JSON.stringify(g));
