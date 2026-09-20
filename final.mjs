import { readFileSync } from 'fs';
import { Compass } from './src/compass.js';
const graph = JSON.parse(readFileSync('./data/compass.json', 'utf8'));
const deg = (r) => ((r * 180 / Math.PI) + 360) % 360;
const err = (a, b) => { let d = Math.abs(deg(a) - deg(b)) % 360; return d > 180 ? 360 - d : d; };
const go = (c, ms) => { for (let t = 0; t < ms; t++) c.step(1); };

function score(cfg) {
  let tErr = 0, pS = 0, pD = 0, n = 0, rate = 0;
  for (const t of [0, 72, 144, 216, 288]) {
    const th = t * Math.PI / 180;
    const c = new Compass(graph, cfg);
    c.seed(th); c.setCue(th, 1); go(c, 700);
    tErr += err(c.heading().theta, th);
    rate += c.epgRate();
    c.setCue(0, 0);
    const a0 = c.heading().theta;
    go(c, 2000);
    pS += c.heading().strength;
    pD += err(a0, c.heading().theta);
    n++;
  }
  return { tErr: tErr / n, pS: pS / n, pD: pD / n, r: rate / n };
}

console.log('tonic  exc  inh | track  rate | persist bump  drift');
console.log('-'.repeat(56));
let best = null;
for (const tonic of [0.33, 0.36, 0.39])
  for (const excGain of [0.14, 0.17, 0.20, 0.24])
    for (const inhGain of [3.5, 5, 7]) {
      const cfg = { tonic, excGain, inhGain, cueGain: 1.0 };
      const o = score(cfg);
      const ok = o.pS > 0.3 && o.tErr < 35 && o.pD < 60 && o.r > 5 && o.r < 110;
      if (ok && (!best || o.pS - o.tErr / 200 > best.o.pS - best.o.tErr / 200)) best = { cfg, o };
      if (o.pS > 0.25)
        console.log(`${tonic.toFixed(2)} ${excGain.toFixed(2)} ${inhGain.toFixed(1)} | ${o.tErr.toFixed(0).padStart(4)}deg ${o.r.toFixed(0).padStart(4)} | ${o.pS.toFixed(2)}  ${o.pD.toFixed(0).padStart(4)}deg ${ok ? ' ***' : ''}`);
    }
console.log('\nbest:', best ? JSON.stringify(best.cfg) + ' -> ' + JSON.stringify({ track: +best.o.tErr.toFixed(0), persist: +best.o.pS.toFixed(2), drift: +best.o.pD.toFixed(0), hz: +best.o.r.toFixed(0) }) : 'NONE');
