import { readFileSync } from 'fs';
const g = JSON.parse(readFileSync('./data/compass.json', 'utf8'));
const node = new Map(g.nodes.map((n) => [n.bodyId, n]));
const RE = /([LR])(\d+)/g;

function mk(mirrorL) {
  return (inst) => {
    if (!inst) return null;
    const body = String(inst).replace(/\([^)]*\)/g, '');
    let m, x = 0, y = 0, k = 0;
    RE.lastIndex = 0;
    while ((m = RE.exec(body)) !== null) {
      const side = m[1], gg = parseInt(m[2], 10);
      let wedge = (gg - 1) % 8;
      if (mirrorL && side === 'L') wedge = (8 - wedge) % 8;
      const a = (wedge / 8) * Math.PI * 2 + (side === 'R' ? Math.PI / 8 : 0);
      x += Math.cos(a); y += Math.sin(a); k++;
    }
    return k && Math.hypot(x, y) > 1e-9 ? Math.atan2(y, x) : null;
  };
}
const sgn = (a, b) => ((b - a) * 180 / Math.PI % 360 + 540) % 360 - 180;

for (const mirrorL of [false, true]) {
  const ra = mk(mirrorL);
  console.log(`\n--- mirrorL = ${mirrorL} ---`);
  for (const key of ['PEN_a(PEN1)', 'PEN_b(PEN2)']) {
    const res = {};
    for (const side of ['L', 'R']) {
      let w = 0, o = 0;
      for (const e of g.edges) {
        const a = node.get(e.source), b = node.get(e.target);
        if (!a || !b || a.type !== key || a.side !== side || b.type !== 'EPG') continue;
        const ta = ra(a.instance), tb = ra(b.instance);
        if (ta === null || tb === null) continue;
        o += sgn(ta, tb) * e.weight; w += e.weight;
      }
      res[side] = o / w;
    }
    const opposed = res.L * res.R < 0;
    console.log(`  ${key.padEnd(12)} L ${res.L.toFixed(1).padStart(7)}deg   R ${res.R.toFixed(1).padStart(7)}deg   ${opposed ? '<<< OPPOSED - steers' : 'same direction'}`);
  }
  // also check EPG->EPG stays locally peaked under this mapping
  let near = 0, far = 0;
  for (const e of g.edges) {
    const a = node.get(e.source), b = node.get(e.target);
    if (!a || !b || a.type !== 'EPG' || b.type !== 'EPG') continue;
    const ta = ra(a.instance), tb = ra(b.instance);
    if (ta === null || tb === null) continue;
    (Math.abs(sgn(ta, tb)) < 45 ? (near += e.weight) : (far += e.weight));
  }
  console.log(`  EPG->EPG within 45deg: ${(100 * near / (near + far)).toFixed(0)}% of weight`);
}
