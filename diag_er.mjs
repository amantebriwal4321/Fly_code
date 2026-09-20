import { readFileSync } from 'fs';
import { ringAngle } from './src/compass.js';
const g = JSON.parse(readFileSync('./data/compass_plus.json', 'utf8'));
const node = new Map(g.nodes.map((n) => [n.bodyId, n]));
const deg = (r) => ((r * 180 / Math.PI) + 360) % 360;

// circular mean of EPG partners' ring angles, weighted
function meanEpgAngle(bodyId, dir) {
  let x = 0, y = 0;
  for (const e of g.edges) {
    const self = dir === 'in' ? e.target : e.source;
    const other = dir === 'in' ? e.source : e.target;
    if (self !== bodyId) continue;
    const o = node.get(other);
    if (!o || o.type !== 'EPG') continue;
    const a = ringAngle(o.instance);
    if (a === null) continue;
    x += Math.cos(a) * e.weight; y += Math.sin(a) * e.weight;
  }
  return Math.hypot(x, y) < 1e-6 ? null : { angle: Math.atan2(y, x), strength: Math.hypot(x, y) };
}

// 1. ER -> EPG : does each ER neuron land at a definite ring azimuth?
const erAngles = [];
for (const n of g.nodes) {
  if (!n.type.startsWith('ER')) continue;
  const m = meanEpgAngle(n.bodyId, 'out');
  if (m) erAngles.push(deg(m.angle));
}
const bins = new Array(12).fill(0);
for (const a of erAngles) bins[Math.floor(a / 30) % 12]++;
console.log(`ER neurons projecting to EPG: ${erAngles.length} of 282`);
console.log('ER preferred azimuth, 30 deg bins (0..330):');
console.log('  ' + bins.map((b, i) => `${i*30}:${b}`).join('  '));
console.log('  -> spread across the ring?', bins.filter(b => b > 0).length, 'of 12 bins occupied');

// 2. EPG -> PFL3 : left vs right, the steering basis
console.log('\nPFL3 by soma side, mean EPG-input azimuth:');
for (const side of ['L', 'R']) {
  const angs = [];
  for (const n of g.nodes) {
    if (n.type !== 'PFL3' || n.side !== side) continue;
    const m = meanEpgAngle(n.bodyId, 'in');
    if (m) angs.push(deg(m.angle));
  }
  let x = 0, y = 0;
  for (const a of angs) { x += Math.cos(a*Math.PI/180); y += Math.sin(a*Math.PI/180); }
  console.log(`  ${side}: ${angs.length} neurons, mean input azimuth ${angs.length? deg(Math.atan2(y,x)).toFixed(0):'-'} deg`);
}
