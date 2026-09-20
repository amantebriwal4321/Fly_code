import { readFileSync } from 'fs';
import { Compass } from './src/compass.js';
const graph = JSON.parse(readFileSync('./data/compass.json', 'utf8'));

const cfg = { excGain: 0.35, inhGain: 1.0, tonic: 0.33, penTonic: 0.33, cueGain: 0.25 };
for (const withCue of [true, false]) {
  const c = new Compass(graph, cfg);
  c.seed(0);
  if (withCue) c.setCue(0, 1.0);
  for (let t = 0; t < 1500; t++) c.step(1.0);

  // bin EPG firing rate by ring angle
  const bins = new Array(16).fill(0), cnt = new Array(16).fill(0);
  for (const i of c.epg) {
    const a = c.angle[i];
    if (Number.isNaN(a)) continue;
    const k = ((Math.round((a / (2 * Math.PI)) * 16) % 16) + 16) % 16;
    bins[k] += c.net.rate[i]; cnt[k]++;
  }
  const prof = bins.map((b, i) => (cnt[i] ? b / cnt[i] : 0));
  const mx = Math.max(...prof, 0.001);
  const h = c.heading();
  console.log(`\ncue=${withCue}   EPG ${c.epgRate().toFixed(1)} Hz   bump ${h.strength.toFixed(2)}`);
  console.log('wedge rate  (bar = rate, max ' + mx.toFixed(1) + ' Hz)');
  prof.forEach((v, i) =>
    console.log(String(i).padStart(4), v.toFixed(1).padStart(6), ' ', '#'.repeat(Math.round((v / mx) * 40)))
  );
  console.log('neurons per wedge:', cnt.join(','));
}
