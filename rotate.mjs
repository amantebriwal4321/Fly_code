import { readFileSync } from 'fs';
import { Compass } from './src/compass.js';
const graph = JSON.parse(readFileSync('./data/compass.json', 'utf8'));
const signed = (a, b) => ((( b - a) * 180 / Math.PI % 360) + 540) % 360 - 180;
console.log('turn input -> bump rotation over 1.5 s');
for (const turn of [-1, -0.6, -0.3, 0, 0.3, 0.6, 1]) {
  const rs = [];
  for (let k = 0; k < 3; k++) {
    const c = new Compass(graph);
    c.seed(0); c.setCue(0, 1);
    for (let t = 0; t < 700; t++) c.step(1);
    c.setCue(0, 0);
    for (let t = 0; t < 300; t++) c.step(1);
    const a0 = c.heading().theta;
    c.setTurn(turn);
    for (let t = 0; t < 1500; t++) c.step(1);
    rs.push(signed(a0, c.heading().theta));
  }
  const mean = rs.reduce((a, b) => a + b, 0) / rs.length;
  const bar = mean >= 0 ? ' '.repeat(20) + '#'.repeat(Math.min(20, Math.round(mean / 9)))
                        : ' '.repeat(20 - Math.min(20, Math.round(-mean / 9))) + '#'.repeat(Math.min(20, Math.round(-mean / 9)));
  console.log(`  ${turn.toFixed(1).padStart(5)}  ${mean.toFixed(0).padStart(6)} deg  |${bar}`);
}
