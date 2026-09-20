import { readFileSync } from 'fs';
import { Compass } from './src/compass.js';
const graph = JSON.parse(readFileSync('./data/compass.json', 'utf8'));
const deg = (r) => r * 180 / Math.PI;
const signed = (a, b) => ((deg(b - a) % 360) + 540) % 360 - 180;
const angd = (a, b) => Math.abs(signed(a, b));
const go = (c, ms) => { for (let t = 0; t < ms; t++) c.step(1.0); };

function assess(cfg) {
  const mk = () => { const c = new Compass(graph, cfg); c.seed(0); c.setCue(0, 1); go(c, 700); c.setCue(0, 0); go(c, 300); return c; };
  const c = mk();
  const s = c.heading().strength, r = c.epgRate();
  const a0 = c.heading().theta; go(c, 2000); const a1 = c.heading().theta;
  const hold = angd(a0, a1);
  const rot = [];
  for (const dir of [1, -1]) {
    const c2 = mk();
    const b0 = c2.heading().theta;
    c2.setTurn(dir); go(c2, 1200);
    rot.push(signed(b0, c2.heading().theta));
  }
  return { s, r, hold, rotP: rot[0], rotN: rot[1] };
}

console.log('d7tn tonic  exc  inh penT turn | bump   Hz  hold |  turn+   turn- | verdict');
console.log('-'.repeat(74));
const hits = [];
for (const d7Tonic of [0.38, 0.42])
 for (const tonic of [0.33, 0.35])
  for (const excGain of [0.13, 0.16])
   for (const inhGain of [2.5, 3.5])
    for (const penTonic of [0.05, 0.15, 0.25])
     for (const turnGain of [0.25, 0.4, 0.6]) {
      const cfg = { excGain, inhGain, tonic, penTonic, d7Tonic, cueGain: 0.28, bAdapt: 0.05, turnGain };
      const o = assess(cfg);
      const stable = o.s > 0.3 && o.r > 3 && o.r < 80 && o.hold < 40;
      const steers = o.rotP * o.rotN < 0 && Math.abs(o.rotP) > 15 && Math.abs(o.rotN) > 15;
      const ok = stable && steers;
      if (ok) hits.push({ cfg, o });
      if (stable)
        console.log(`${d7Tonic.toFixed(2)} ${tonic.toFixed(2)} ${excGain.toFixed(2)} ${inhGain.toFixed(1)} ${penTonic.toFixed(2)} ${turnGain.toFixed(2)} | ` +
          `${o.s.toFixed(2)} ${o.r.toFixed(1).padStart(5)} ${o.hold.toFixed(0).padStart(4)} | ${o.rotP.toFixed(0).padStart(6)} ${o.rotN.toFixed(0).padStart(6)} | ${ok ? '*** STEERS ***' : (steers ? '' : 'no steering')}`);
    }
console.log(`\n${hits.length} configs that hold AND steer`);
hits.sort((a, b) => b.o.s - b.o.hold / 100 - (a.o.s - a.o.hold / 100));
for (const h of hits.slice(0, 5))
  console.log('  ', JSON.stringify(h.cfg), `-> bump ${h.o.s.toFixed(2)} ${h.o.r.toFixed(1)}Hz hold ${h.o.hold.toFixed(0)} rot ${h.o.rotP.toFixed(0)}/${h.o.rotN.toFixed(0)}`);
