import { readFileSync } from 'fs';
import { Compass } from './src/compass.js';
const graph = JSON.parse(readFileSync('./data/compass.json', 'utf8'));
const deg = (r) => ((r * 180 / Math.PI) + 360) % 360;

for (const cfg of [{ penTonic: 0.14, turnGain: 0.20 }, { penTonic: 0.10, turnGain: 0.10 }]) {
  console.log(`\ncfg ${JSON.stringify(cfg)}`);
  console.log('   t(ms) |  turn=+1 heading   |  turn=-1 heading   | turn=0 heading');
  const cs = [1, -1, 0].map((turn) => {
    const c = new Compass(graph, cfg);
    c.seed(0); c.setCue(0, 1);
    for (let t = 0; t < 700; t++) c.step(1);
    c.setCue(0, 0);
    for (let t = 0; t < 300; t++) c.step(1);
    c.setTurn(turn);
    return c;
  });
  for (let blk = 1; blk <= 8; blk++) {
    for (const c of cs) for (let t = 0; t < 500; t++) c.step(1);
    const [p, n, z] = cs.map((c) => `${deg(c.heading().theta).toFixed(0).padStart(4)}deg s=${c.heading().strength.toFixed(2)}`);
    console.log(`   ${String(blk * 500).padStart(5)} |  ${p}  |  ${n}  | ${z}`);
  }
}
