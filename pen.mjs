import { readFileSync } from 'fs';
import { ringAngle } from './src/compass.js';
const g = JSON.parse(readFileSync('./data/compass.json', 'utf8'));
const node = new Map(g.nodes.map((n) => [n.bodyId, n]));
const sgn = (a, b) => { let d = ((b - a) * 180 / Math.PI % 360 + 540) % 360 - 180; return d; };

// For each PEN population, what angular offset do its EPG targets sit at?
for (const key of ['PEN_a(PEN1)', 'PEN_b(PEN2)', 'PEG']) {
  for (const side of ['L', 'R']) {
    let wsum = 0, osum = 0, n = 0;
    for (const e of g.edges) {
      const a = node.get(e.source), b = node.get(e.target);
      if (!a || !b || a.type !== key || a.side !== side || b.type !== 'EPG') continue;
      const ta = ringAngle(a.instance), tb = ringAngle(b.instance);
      if (ta === null || tb === null) continue;
      osum += sgn(ta, tb) * e.weight; wsum += e.weight; n++;
    }
    if (n) console.log(`${key.padEnd(12)} soma ${side} -> EPG: mean offset ${(osum / wsum).toFixed(1).padStart(7)} deg   (${n} edges, ${wsum} syn)`);
  }
}
