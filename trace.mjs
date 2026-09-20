import { readFileSync } from 'fs';
import { Compass } from './src/compass.js';
const graph = JSON.parse(readFileSync('./data/compass.json', 'utf8'));

const cfg = { excGain: +process.argv[2] || 0.6, inhGain: +process.argv[3] || 1.2,
              tonic: +process.argv[4] || 0.31, penTonic: +process.argv[5] || 0.31 };
console.log('config:', JSON.stringify(cfg));

const c = new Compass(graph, cfg);
// give PEN a real resting drive too - they are half the recurrent loop
for (const i of c.pen) c.net.ext[i] = cfg.penTonic;
for (const i of c.peg) c.net.ext[i] = cfg.penTonic;
c.seed(0);

const pop = (idx) => { let s=0; for (const i of idx) s += c.net.rate[i]; return s/idx.length; };
console.log('\n  t(ms)   EPG    D7    PEN   PEG  | bump  theta');
for (let t = 1; t <= 1500; t++) {
  for (const i of c.epg) {
    let d = cfg.tonic;
    c.net.ext[i] = d;
  }
  for (const i of c.pen) c.net.ext[i] = cfg.penTonic;
  for (const i of c.peg) c.net.ext[i] = cfg.penTonic;
  c.net.step(1.0);
  if (t % 150 === 0) {
    const h = c.heading();
    console.log(`  ${String(t).padStart(5)} ${pop(c.epg).toFixed(1).padStart(6)} ${pop(c.delta7).toFixed(1).padStart(5)} ${pop(c.pen).toFixed(1).padStart(6)} ${pop(c.peg).toFixed(1).padStart(5)}  | ${h.strength.toFixed(2)}  ${(h.theta*180/Math.PI).toFixed(0)}`);
  }
}
