/**
 * The ring attractor: the fly's heading sense, built from the real
 * central-complex wiring.
 *
 * Every neuron's `instance` ends in a protocerebral-bridge glomerulus
 * (EPG(PB08)_L3 -> left side, glomerulus 3). The PB tiles azimuth, so that
 * suffix IS the neuron's preferred heading. We are reading an anatomical
 * coordinate out of the dataset, not inventing a layout.
 */

import { Network, V_REST, V_THRESH } from './lif.js?v=5';

const GLOM_RE = /([LR])(\d+)/g;

/**
 * Every glomerulus a neuron touches. EPG(PB08)_L3 -> [L3]; a Delta7 spanning
 * Delta7(PB15)_L1L9R8_R -> [L1, L9, R8]. The bracketed PB region code is
 * stripped first so it cannot be mistaken for a glomerulus.
 */
export function parseGlomeruli(instance) {
  if (!instance) return [];
  const body = String(instance).replace(/\([^)]*\)/g, '');
  const out = [];
  let m;
  GLOM_RE.lastIndex = 0;
  while ((m = GLOM_RE.exec(body)) !== null) {
    out.push({ side: m[1], g: parseInt(m[2], 10) });
  }
  return out;
}

function gloAngle({ side, g }) {
  // The two protocerebral-bridge hemispheres are MIRROR IMAGES: the PB runs
  // L9..L1 | R1..R9, so increasing glomerulus number travels opposite ways
  // around the ellipsoid body. Mirroring the left side is what makes the two
  // PEN populations project to opposed offsets (L +56 deg, R -56 deg) - the
  // asymmetry the fly steers with. Without it both sides push the same way and
  // the bump cannot rotate. It also sharpens EPG->EPG recurrence from 51% to
  // 89% of weight within 45 deg. Measured, not assumed: see mirror.mjs.
  let wedge = (g - 1) % 8;
  if (side === 'L') wedge = (8 - wedge) % 8;
  return (wedge / 8) * Math.PI * 2 + (side === 'R' ? Math.PI / 8 : 0);
}

/**
 * Preferred heading = circular mean of the glomeruli the neuron innervates.
 * 8 glomeruli per side interleave into the ellipsoid body's 16 wedges, so the
 * two sides sit half a wedge apart. G9 wraps onto G1, as it does anatomically.
 */
export function ringAngle(instance) {
  const gs = parseGlomeruli(instance);
  if (!gs.length) return null;
  let x = 0, y = 0;
  for (const p of gs) {
    const a = gloAngle(p);
    x += Math.cos(a); y += Math.sin(a);
  }
  if (Math.hypot(x, y) < 1e-9) return null;
  return Math.atan2(y, x);
}

export class Compass {
  constructor(graph, opts = {}) {
    this.net = new Network(graph, {
      // Tuned by headless sweep (scan.mjs): these are the values at which the
      // real wiring produces a single bump at ~29 Hz that holds its heading to
      // within 2 deg over 800 ms. See VERIFY.md.
      excGain: opts.excGain ?? 0.14,
      inhGain: opts.inhGain ?? 7.0,
      bAdapt: opts.bAdapt,
      normalize: opts.normalize,
    });
    const net = this.net;

    this.angle = new Float32Array(net.n).fill(NaN);
    for (let i = 0; i < net.n; i++) {
      const a = ringAngle(net.nodes[i].instance);
      if (a !== null) this.angle[i] = a;
    }

    this.epg = net.indicesOfType((t) => t === 'EPG');
    this.delta7 = net.indicesOfType((t) => t === 'Delta7');
    this.peg = net.indicesOfType((t) => t === 'PEG');
    this.pen = net.indicesOfType((t) => t.startsWith('PEN'));
    this.penL = this.pen.filter((i) => net.nodes[i].side === 'L');
    this.penR = this.pen.filter((i) => net.nodes[i].side === 'R');

    // Drive is held just BELOW threshold: the recurrent wiring decides who
    // fires, not the background. That is what makes it an attractor.
    this.tonic = opts.tonic ?? 0.39; // onto EPG, mV/ms
        // PEN sit BELOW threshold at rest and are driven by angular velocity, as
    // they are in the fly. The bump is held by EPG recurrence alone when the
    // animal is flying straight.
    this.penTonic = opts.penTonic ?? 0.14;
    // Delta7 needs its own background drive. It is the only inhibitory
    // population here and its largest input is its OWN mutual inhibition
    // (26,539 synapses, the biggest pathway in the subgraph), so without a
    // baseline it silences itself and the ring never gets sculpted.
    this.d7Tonic = opts.d7Tonic ?? 0.42;
    this.turnGain = opts.turnGain ?? 0.20;
    this.cueGain = opts.cueGain ?? 1.0;
    this.turn = 0;
    this.net.bAdapt = opts.bAdapt ?? 0.05;

    this._cue = null; // {angle, strength} - a visual landmark pinning heading
  }

  /** Seed a bump at a heading so the ring starts somewhere definite. */
  seed(theta = 0, strength = 4.0) {
    const { net } = this;
    for (const i of this.epg) {
      const a = this.angle[i];
      if (Number.isNaN(a)) continue;
      const d = Math.cos(a - theta);
      if (d > 0.6) net.V[i] = V_THRESH - 0.2 + strength * (d - 0.6);
    }
  }

  /**
   * Angular velocity drive. Turning right excites one PEN population and
   * turning left the other; that asymmetry is what walks the bump around
   * the ring. This is the real mechanism, not a rotation applied to a sprite.
   */
  setTurn(omega) {
    this.turn = Math.max(-1, Math.min(1, omega));
  }

  /** A landmark in view: pins the bump, the way a real fly uses the sun. */
  setCue(theta, strength = 1.0) {
    this._cue = strength > 0 ? { angle: theta, strength } : null;
  }

  /**
   * Attach the real ER (ring-neuron) population as the landmark input.
   *
   * Without this, a landmark is injected onto EPG by a cosine I write. With it,
   * the landmark drives real ER neurons and the real ER->EPG synapses (282
   * neurons, ~124k synapses) carry it to the bump. Each ER neuron's preferred
   * azimuth is read straight out of its EPG projection - the connectome places
   * it, not me. What stays a model is only the sensory step: "a landmark at
   * bearing theta excites ER neurons tuned near theta."
   *
   * @param {{nodes:Array,edges:Array}} plus  data/compass_plus.json
   */
  attachER(plus, opts = {}) {
    const epgIndexByBody = new Map();
    this.epg.forEach((netIdx, k) => epgIndexByBody.set(this.net.nodes[netIdx].bodyId, k));

    const erByBody = new Map();
    for (const n of plus.nodes) {
      if (String(n.type).startsWith('ER')) erByBody.set(n.bodyId, { targets: [], x: 0, y: 0, wsum: 0 });
    }
    for (const e of plus.edges) {
      const er = erByBody.get(e.source);
      const k = epgIndexByBody.get(e.target);
      if (!er || k === undefined) continue;
      const a = this.angle[this.epg[k]];
      if (Number.isNaN(a)) continue;
      er.targets.push({ k, w: e.weight });
      er.x += Math.cos(a) * e.weight;
      er.y += Math.sin(a) * e.weight;
      er.wsum += e.weight;
    }
    this.er = [];
    for (const er of erByBody.values()) {
      if (!er.wsum) continue;
      er.pref = Math.atan2(er.y, er.x); // preferred azimuth, from the wiring
      for (const t of er.targets) t.w /= er.wsum; // normalise routed drive per ER
      this.er.push(er);
    }
    this.erGain = opts.erGain ?? 0.9;
    this.erSigma = opts.erSigma ?? 0.5; // rad, tuning width of an ER neuron
    this._erDrive = new Float32Array(this.epg.length);
    return this.er.length;
  }

  /**
   * Set the landmark by bearing, routed through ER if attached, else the cosine
   * fallback. main.js always calls this; verify.mjs still uses setCue directly.
   */
  setLandmark(theta, strength = 1.0) {
    if (!this.er) { this.setCue(theta, strength); return; }
    this._cue = null;
    this._erDrive.fill(0);
    if (strength <= 0) { this._landmarkOn = false; return; }
    this._landmarkOn = true;
    for (const er of this.er) {
      let d = ((er.pref - theta + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      const act = strength * Math.exp(-(d * d) / (2 * this.erSigma * this.erSigma));
      if (act < 0.01) continue;
      for (const t of er.targets) this._erDrive[t.k] += act * t.w;
    }
    // Center-surround: ER input is broad, so it is the PATTERN across EPG that
    // pins the bump, not the raw sum. Subtract the mean and keep the positive
    // relief; this sharpens a broad, unevenly-tiled ring input to a location.
    let mean = 0;
    for (let k = 0; k < this._erDrive.length; k++) mean += this._erDrive[k];
    mean /= this._erDrive.length;
    for (let k = 0; k < this._erDrive.length; k++) this._erDrive[k] = Math.max(0, this._erDrive[k] - mean);
  }

  step(dt) {
    const { net } = this;
    this.epg.forEach((i, k) => {
      let drive = this.tonic;
      if (this._erDrive && this._landmarkOn) {
        // landmark routed through the real ER -> EPG synapses
        drive += this.cueGain * this.erGain * this._erDrive[k];
      } else if (this._cue) {
        const d = Math.cos(this.angle[i] - this._cue.angle);
        if (d > 0) drive += this.cueGain * this._cue.strength * d * d;
      }
      net.ext[i] = drive;
    });
    // Turning excites one PEN population more than the other; that asymmetry
    // is what walks the bump around the ring.
    const a = this.turn;
    for (const i of this.penL) net.ext[i] = this.penTonic + this.turnGain * Math.max(0, a);
    for (const i of this.penR) net.ext[i] = this.penTonic + this.turnGain * Math.max(0, -a);
    for (const i of this.peg) net.ext[i] = this.penTonic;
    for (const i of this.delta7) net.ext[i] = this.d7Tonic;
    net.step(dt);
  }

  /**
   * Heading = population vector over EPG firing rates.
   * Returns { theta, strength } where strength is the resultant length:
   * ~1 means one tight bump, ~0 means no coherent heading.
   */
  heading() {
    // A population vector over near-silent neurons is meaningless: two stray
    // spikes look like a perfect bump. Below this floor there is no heading.
    const MIN_RATE = 2.0; // Hz, mean across EPG
    if (this.epgRate() < MIN_RATE) return { theta: 0, strength: 0, active: 0 };
    let x = 0, y = 0, tot = 0;
    for (const i of this.epg) {
      const a = this.angle[i];
      if (Number.isNaN(a)) continue;
      const r = this.net.rate[i];
      x += r * Math.cos(a);
      y += r * Math.sin(a);
      tot += r;
    }
    if (tot < 1e-6) return { theta: 0, strength: 0, active: 0 };
    return {
      theta: Math.atan2(y, x),
      strength: Math.hypot(x, y) / tot,
      active: tot / this.epg.length,
    };
  }

  /** Mean EPG firing rate - used to detect silence or seizure. */
  epgRate() {
    let s = 0;
    for (const i of this.epg) s += this.net.rate[i];
    return s / this.epg.length;
  }

  lesionDelta7(on) {
    this.net.setAlive(this.delta7, !on);
  }

  scramble(on) {
    this.net.scramble(on);
  }
}
