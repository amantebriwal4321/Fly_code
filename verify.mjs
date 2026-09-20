/**
 * What the connectome actually does, measured. Run: node verify.mjs
 * Every claim the UI makes has to pass here first.
 */
import { readFileSync } from 'fs';
import { Compass } from './src/compass.js';
const graph = JSON.parse(readFileSync('./data/compass.json', 'utf8'));
const deg = (r) => ((r * 180 / Math.PI) + 360) % 360;
const err = (a, b) => { let d = Math.abs(deg(a) - deg(b)) % 360; return d > 180 ? 360 - d : d; };
const go = (c, ms) => { for (let t = 0; t < ms; t++) c.step(1); };
let pass = 0, fail = 0;
const check = (n, ok, d) => { console.log(`${ok ? ' PASS' : ' FAIL'}  ${n.padEnd(34)} ${d}`); ok ? pass++ : fail++; };

// 1 - a single bump forms
let c = new Compass(graph);
c.seed(0); c.setCue(0, 1); go(c, 700);
let h = c.heading();
check('bump forms', h.strength > 0.30, `strength ${h.strength.toFixed(2)}, ${c.epgRate().toFixed(0)} Hz`);

// 2 - it tracks a landmark around the ring
let sum = 0, n = 0;
for (const t of [0, 60, 120, 180, 240, 300]) {
  const th = t * Math.PI / 180;
  c.setCue(th, 1); go(c, 600);
  sum += err(c.heading().theta, th); n++;
}
check('tracks landmark', sum / n < 30, `mean error ${(sum / n).toFixed(0)} deg`);

// 3 - it HOLDS heading with no input at all (working memory).
// Sampled from several starting headings: the ring has 16 discrete wedges with
// uneven neuron counts, so a single basin is not representative.
const drifts = [], holds = [];
for (const t of [0, 90, 180, 270]) {
  const ch = new Compass(graph);
  ch.seed(0); ch.setCue(t * Math.PI / 180, 1); go(ch, 700);
  ch.setCue(0, 0);
  const s0 = ch.heading().theta;
  go(ch, 3000);
  drifts.push(err(s0, ch.heading().theta));
  holds.push(ch.heading().strength);
}
const mDrift = drifts.reduce((a, b) => a + b, 0) / drifts.length;
const mHold = holds.reduce((a, b) => a + b, 0) / holds.length;
check('holds heading 3 s, no input', mDrift < 75 && mHold > 0.28,
  `mean drift ${mDrift.toFixed(0)} deg, strength ${mHold.toFixed(2)} (${drifts.map((d) => d.toFixed(0)).join('/')})`);

// 4 - lesioning Delta7 destroys it
c = new Compass(graph);
c.seed(0); c.setCue(0, 1); go(c, 700);
const healthy = c.heading().strength;
c.lesionDelta7(true); go(c, 1200);
check('lesion Delta7 breaks compass', c.heading().strength < healthy * 0.8 || c.epgRate() > 140,
  `bump ${healthy.toFixed(2)} -> ${c.heading().strength.toFixed(2)}, ${c.epgRate().toFixed(0)} Hz`);

// 5 - scrambled wiring cannot SUSTAIN a bump  (the control that matters).
// This must be measured with the landmark OFF. While the cue is on it drives
// EPG by angle from outside, so any network at all shows a bump and the
// control proves nothing.
function persistence(scrambled) {
  const out = [];
  for (let k = 0; k < 10; k++) {
    const c3 = new Compass(graph);
    if (scrambled) c3.scramble(true);
    c3.seed(0); c3.setCue(0, 1); go(c3, 700);
    c3.setCue(0, 0); go(c3, 1500);
    out.push(c3.heading().strength);
  }
  return out.reduce((a, b) => a + b, 0) / out.length;
}
const realP = persistence(false), scramP = persistence(true);
check('scrambled wiring cannot sustain', scramP < realP * 0.6,
  `real holds ${realP.toFixed(2)} vs scrambled ${scramP.toFixed(2)}`);

console.log(`\n${pass} passed, ${fail} failed`);
console.log('\nKNOWN LIMITATION: smooth angular integration from PEN drive does not work.');
console.log('The round-trip offset is real and correctly signed (L +5.9 deg, R -5.9 deg,');
console.log('see roundtrip.mjs) but under sustained turn the bump JUMPS between discrete');
console.log('states instead of integrating. Heading is therefore set by landmark, which is');
console.log('how a real fly pins its compass anyway. Do not claim velocity integration.');
process.exit(fail ? 1 : 0);
