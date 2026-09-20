/** Is the connectivity structured in ring space? If not, the mapping is wrong. */
import { readFileSync } from 'fs';
import { ringAngle } from './src/compass.js';

const g = JSON.parse(readFileSync('./data/compass.json', 'utf8'));
const node = new Map(g.nodes.map((n) => [n.bodyId, n]));

function profile(srcType, dstType) {
  const bins = new Array(9).fill(0);
  const cnt = new Array(9).fill(0);
  let used = 0;
  for (const e of g.edges) {
    const a = node.get(e.source), b = node.get(e.target);
    if (!a || !b) continue;
    if (!a.type.startsWith(srcType) || !b.type.startsWith(dstType)) continue;
    const ta = ringAngle(a.instance), tb = ringAngle(b.instance);
    if (ta === null || tb === null) continue;
    let d = Math.abs(tb - ta) % (2 * Math.PI);
    if (d > Math.PI) d = 2 * Math.PI - d;
    const k = Math.min(8, Math.round((d / Math.PI) * 8));
    bins[k] += e.weight; cnt[k]++; used++;
  }
  if (!used) return null;
  const tot = bins.reduce((x, y) => x + y, 0);
  return { bins: bins.map((b, i) => (cnt[i] ? b / tot : 0)), used };
}

console.log('Fraction of synaptic weight by |angular difference|, 0 deg -> 180 deg');
console.log('bin:        0    22   45   68   90  112  135  158  180');
for (const [s, d] of [['EPG','EPG'],['EPG','Delta7'],['Delta7','EPG'],['PEN','EPG'],['EPG','PEN'],['PEG','EPG']]) {
  const p = profile(s, d);
  if (!p) { console.log(`${(s+'->'+d).padEnd(12)} (none)`); continue; }
  const row = p.bins.map((v) => (v * 100).toFixed(0).padStart(4)).join(' ');
  const peak = p.bins.indexOf(Math.max(...p.bins));
  console.log(`${(s+'->'+d).padEnd(12)}${row}   peak@${(peak*22.5).toFixed(0)}deg`);
}
