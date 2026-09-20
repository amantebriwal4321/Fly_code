import { readFileSync } from 'fs';
import { Compass } from './src/compass.js';
const graph = JSON.parse(readFileSync('./data/compass.json', 'utf8'));
const deg = (r) => ((r * 180 / Math.PI) + 360) % 360;
const err = (a, b) => { let d = Math.abs(deg(a) - deg(b)) % 360; return d > 180 ? 360 - d : d; };

function score(cfg) {
  const c = new Compass(graph, cfg);
  c.seed(0);
  let sum = 0, n = 0, sS = 0, sR = 0;
  for (const t of [0, 60, 120, 180, 240, 300, 30, 210]) {
    const th = t * Math.PI / 180;
    c.setCue(th, 1);
    for (let i = 0; i < 600; i++) c.step(1);
    const h = c.heading();
    sum += err(h.theta, th); sS += h.strength; sR += c.epgRate(); n++;
  }
  // then: does it hold when the landmark goes away?
  const a0 = c.heading().theta;
  c.setCue(0, 0);
  for (let i = 0; i < 2000; i++) c.step(1);
  return { err: sum / n, s: sS / n, r: sR / n, hold: err(a0, c.heading().theta), holdS: c.heading().strength };
}

console.log('tonic  cue   exc  inh | track err  bump   Hz | hold drift  bump');
console.log('-'.repeat(68));
let best = null;
for (const tonic of [0.30, 0.33, 0.36])
  for (const cueGain of [0.3, 0.6, 1.0, 1.6])
    for (const excGain of [0.10, 0.16])
      for (const inhGain of [3.5, 6]) {
        const cfg = { tonic, cueGain, excGain, inhGain };
        const o = score(cfg);
        const ok = o.err < 30 && o.hold < 45 && o.holdS > 0.25 && o.r > 5 && o.r < 90;
        if (ok && (!best || o.err < best.o.err)) best = { cfg, o };
        if (o.err < 45)
          console.log(`${tonic.toFixed(2)} ${cueGain.toFixed(2)} ${excGain.toFixed(2)} ${inhGain.toFixed(1)} | ${o.err.toFixed(0).padStart(7)}deg ${o.s.toFixed(2)} ${o.r.toFixed(0).padStart(4)} | ${o.hold.toFixed(0).padStart(6)}deg ${o.holdS.toFixed(2)} ${ok ? ' ***' : ''}`);
      }
console.log('\nbest:', best ? JSON.stringify(best.cfg) + ' -> ' + JSON.stringify({ err: +best.o.err.toFixed(0), hold: +best.o.hold.toFixed(0), bump: +best.o.holdS.toFixed(2) }) : 'none');
