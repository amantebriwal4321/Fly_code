import { readFileSync } from 'fs';
import { Compass } from './src/compass.js';
const graph = JSON.parse(readFileSync('./data/compass.json', 'utf8'));
const deg = (r) => ((r * 180 / Math.PI) + 360) % 360;
const err = (a, b) => { let d = Math.abs(deg(a) - deg(b)) % 360; return d > 180 ? 360 - d : d; };

const c = new Compass(graph);
c.seed(0);
console.log('landmark -> bump tracking (cue held 700 ms at each heading)');
console.log('  target   bump    error');
let worst = 0, n = 0, sum = 0;
for (const t of [0, 90, 180, 270, 45, 135, 225, 315]) {
  const th = t * Math.PI / 180;
  c.setCue(th, 1);
  for (let i = 0; i < 700; i++) c.step(1);
  const h = c.heading();
  const e = err(h.theta, th);
  worst = Math.max(worst, e); sum += e; n++;
  console.log(`   ${String(t).padStart(4)}deg  ${deg(h.theta).toFixed(0).padStart(4)}deg  ${e.toFixed(0).padStart(4)}deg   s=${h.strength.toFixed(2)} ${c.epgRate().toFixed(0)}Hz`);
}
console.log(`\nmean error ${(sum / n).toFixed(1)} deg, worst ${worst.toFixed(0)} deg`);

// and does it HOLD after the landmark disappears?
c.setCue(0, 0);
const held0 = c.heading().theta;
for (let i = 0; i < 3000; i++) c.step(1);
console.log(`hold 3 s with no landmark: drift ${err(held0, c.heading().theta).toFixed(0)} deg, strength ${c.heading().strength.toFixed(2)}`);
