import { readFileSync } from 'fs';
import { ringAngle } from './src/compass.js';
const g = JSON.parse(readFileSync('./data/compass.json', 'utf8'));
const node = new Map(g.nodes.map((n) => [n.bodyId, n]));
const cmean = (xs) => { let x=0,y=0; for (const [a,w] of xs){x+=Math.cos(a)*w;y+=Math.sin(a)*w;} return Math.atan2(y,x); };
const sgn = (a,b) => (((b-a)*180/Math.PI % 360)+540)%360-180;

for (const key of ['PEN_a(PEN1)','PEN_b(PEN2)','PEG']) {
  for (const side of ['L','R']) {
    const shifts = [];
    for (const p of g.nodes) {
      if (p.type !== key || p.side !== side) continue;
      const ins = [], outs = [];
      for (const e of g.edges) {
        if (e.target === p.bodyId) { const s = node.get(e.source); if (s && s.type==='EPG') { const a = ringAngle(s.instance); if (a!==null) ins.push([a, e.weight]); } }
        if (e.source === p.bodyId) { const t = node.get(e.target); if (t && t.type==='EPG') { const a = ringAngle(t.instance); if (a!==null) outs.push([a, e.weight]); } }
      }
      if (ins.length && outs.length) shifts.push(sgn(cmean(ins), cmean(outs)));
    }
    if (!shifts.length) { console.log(`${key} ${side}: no complete loops`); continue; }
    shifts.sort((a,b)=>a-b);
    const med = shifts[Math.floor(shifts.length/2)];
    const mean = shifts.reduce((a,b)=>a+b,0)/shifts.length;
    console.log(`${key.padEnd(12)} ${side}: round-trip EPG->${key.slice(0,5)}->EPG  mean ${mean.toFixed(1).padStart(7)}deg  median ${med.toFixed(1).padStart(7)}deg  (n=${shifts.length})`);
  }
}
