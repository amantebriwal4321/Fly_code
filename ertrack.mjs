import { readFileSync } from 'fs';
import { Compass } from './src/compass.js';
const core = JSON.parse(readFileSync('./data/compass.json', 'utf8'));
const plus = JSON.parse(readFileSync('./data/compass_plus.json', 'utf8'));
const deg = (r) => ((r * 180 / Math.PI) + 360) % 360;
const err = (a, b) => { let d = Math.abs(deg(a) - deg(b)) % 360; return d > 180 ? 360 - d : d; };
const go = (c, ms) => { for (let t = 0; t < ms; t++) c.step(1); };

function trial(erGain) {
  const c = new Compass(core);
  const n = c.attachER(plus, { erGain });
  c.seed(0);
  let sum = 0, cnt = 0, sS = 0;
  for (const t of [0, 60, 120, 180, 240, 300]) {
    const th = t * Math.PI / 180;
    c.setLandmark(th, 1); go(c, 600);
    const h = c.heading();
    sum += err(h.theta, th); sS += h.strength; cnt++;
  }
  // hold after landmark off
  const a0 = c.heading().theta;
  c.setLandmark(0, 0); go(c, 2000);
  return { erN: n, err: sum / cnt, bump: sS / cnt, hold: err(a0, c.heading().theta), holdS: c.heading().strength };
}

console.log('erGain | ER | track err | bump | hold drift | hold bump');
for (const g of [0.4, 0.7, 1.0, 1.5, 2.2, 3.0]) {
  const o = trial(g);
  console.log(`${g.toFixed(1).padStart(6)} | ${o.erN} | ${o.err.toFixed(0).padStart(7)} deg | ${o.bump.toFixed(2)} | ${o.hold.toFixed(0).padStart(6)} deg | ${o.holdS.toFixed(2)}`);
}
