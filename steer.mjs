import { readFileSync } from 'fs';
import { Compass } from './src/compass.js';
const graph = JSON.parse(readFileSync('./data/compass.json', 'utf8'));
const signed = (a, b) => (((b - a) * 180 / Math.PI % 360) + 540) % 360 - 180;

function rot(cfg, turn, reps = 3) {
  const out = [];
  for (let k = 0; k < reps; k++) {
    const c = new Compass(graph, cfg);
    c.seed(k * 1.3); c.setCue(k * 1.3, 1);
    for (let t = 0; t < 700; t++) c.step(1);
    c.setCue(0, 0);
    for (let t = 0; t < 300; t++) c.step(1);
    const a0 = c.heading().theta;
    c.setTurn(turn);
    for (let t = 0; t < 1500; t++) c.step(1);
    out.push({ d: signed(a0, c.heading().theta), s: c.heading().strength, r: c.epgRate() });
  }
  const m = (f) => out.reduce((a, b) => a + f(b), 0) / out.length;
  return { d: m((o) => o.d), s: m((o) => o.s), r: m((o) => o.r) };
}

console.log('penT turnG |  turn-1   turn0   turn+1 | bump   Hz | verdict');
console.log('-'.repeat(62));
const hits = [];
for (const penTonic of [0.02, 0.06, 0.10, 0.14])
  for (const turnGain of [0.10, 0.15, 0.20, 0.26]) {
    if (penTonic + turnGain > 0.34) continue; // must stay subthreshold: x*20 < 7mV
    const cfg = { penTonic, turnGain };
    const n = rot(cfg, -1), z = rot(cfg, 0), p = rot(cfg, +1);
    const ok = p.d * n.d < 0 && Math.abs(p.d) > 20 && Math.abs(n.d) > 20 && Math.abs(z.d) < 15 && p.s > 0.3;
    if (ok) hits.push({ cfg, p, n, z });
    console.log(`${penTonic.toFixed(2)} ${turnGain.toFixed(2)} | ${n.d.toFixed(0).padStart(7)} ${z.d.toFixed(0).padStart(7)} ${p.d.toFixed(0).padStart(8)} | ${p.s.toFixed(2)} ${p.r.toFixed(0).padStart(4)} | ${ok ? '*** STEERS ***' : ''}`);
  }
console.log(`\n${hits.length} configs steer cleanly`);
for (const h of hits) console.log('  ', JSON.stringify(h.cfg), `-> ${h.n.d.toFixed(0)} / ${h.z.d.toFixed(0)} / +${h.p.d.toFixed(0)} deg`);
