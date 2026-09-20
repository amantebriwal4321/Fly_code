import { readFileSync } from 'fs';
import { Compass } from './src/compass.js';
const graph = JSON.parse(readFileSync('./data/compass.json', 'utf8'));

const cfg = { excGain: 0.15, inhGain: 1.0, tonic: 0.31, penTonic: 0.31, cueGain: 0.28, bAdapt: 0.05 };
const c = new Compass(graph, cfg);
const pop = (idx) => idx.reduce((s, i) => s + c.net.rate[i], 0) / idx.length;
c.seed(0); c.setCue(0, 1.0);
console.log('cfg', JSON.stringify(cfg));
console.log('  t(ms)  phase   EPG    D7    PEN   PEG  | bump');
for (let t = 1; t <= 1600; t++) {
  if (t === 801) c.setCue(0, 0);
  c.step(1.0);
  if (t % 100 === 0)
    console.log(`  ${String(t).padStart(5)}  ${t <= 800 ? 'CUE ' : 'free'}  ${pop(c.epg).toFixed(1).padStart(5)} ${pop(c.delta7).toFixed(1).padStart(5)} ${pop(c.pen).toFixed(1).padStart(6)} ${pop(c.peg).toFixed(1).padStart(5)}  | ${c.heading().strength.toFixed(2)}`);
}
