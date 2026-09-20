/** Does she actually learn? Run: node mbtest.mjs */
import { readFileSync } from 'fs';
import { MushroomBody } from './src/mushroom.js';

const mb = new MushroomBody(JSON.parse(readFileSync('./data/mushroom.json', 'utf8')));
console.log('circuit:', JSON.stringify(mb.stats()));

let pass = 0;
let fail = 0;
const check = (n, ok, d) => {
  console.log(`${ok ? ' PASS' : ' FAIL'}  ${n.padEnd(38)} ${d}`);
  ok ? pass++ : fail++;
};

// 1 - reward makes a word mean "approach", and more pairings mean more
mb.forget();
const curve = [mb.valence('home')];
for (let i = 0; i < 5; i++) {
  mb.teach('home', +1);
  curve.push(mb.valence('home'));
}
check(
  'reward builds approach valence',
  curve[5] > 0.15 && curve[5] > curve[1] && curve[1] > curve[0],
  curve.map((v) => v.toFixed(2)).join(' -> ')
);

// 2 - punishment goes the other way
mb.forget();
const before = mb.valence('traffic');
for (let i = 0; i < 5; i++) mb.teach('traffic', -1);
const after = mb.valence('traffic');
check('punishment builds avoidance', after < -0.15, `${before.toFixed(2)} -> ${after.toFixed(2)}`);

// 3 - teaching one word must not teach the others (sparse coding works)
mb.forget();
for (let i = 0; i < 5; i++) mb.teach('home', +1);
const others = ['traffic', 'lalbagh', 'cubbon', 'market'].map((w) => Math.abs(mb.valence(w)));
const worst = Math.max(...others);
check(
  'learning is specific to the word',
  mb.valence('home') > 0.15 && worst < 0.05,
  `home ${mb.valence('home').toFixed(2)}, worst other ${worst.toFixed(3)}`
);

// 4 - real synapses changed, and only a minority of them
mb.forget();
for (let i = 0; i < 5; i++) mb.teach('home', +1);
const ch = mb.changedSynapses();
check(
  'teaching changes real synapses',
  ch > 100 && ch < mb.nEdges * 0.5,
  `${ch} of ${mb.nEdges} KC->MBON synapses depressed`
);

// 5 - forgetting restores the naive state
mb.forget();
check('forget restores naive state', mb.changedSynapses() === 0 && Math.abs(mb.valence('home')) < 1e-6,
  `${mb.changedSynapses()} changed, valence ${mb.valence('home').toFixed(3)}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
