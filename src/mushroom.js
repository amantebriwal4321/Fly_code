/**
 * The mushroom body: where the fly actually learns.
 *
 * Real mechanism, and the honest core of this project:
 *   - a stimulus activates a SPARSE random subset of Kenyon cells (~5%)
 *   - those KCs synapse onto mushroom-body output neurons (MBONs)
 *   - dopaminergic neurons DEPRESS the KC->MBON synapses that were active
 *     when the dopamine arrived
 *   - the push-pull output of the MBONs is the learned valence
 *
 * Nothing here is a lookup table. Teaching modifies real synapses indexed by
 * real connectivity, and the valence is read out of what those synapses do.
 *
 * Compartment identity is DERIVED FROM THE DATA, not assigned: an MBON counts
 * as PAM-dominated (reward compartment, drives avoidance) or PPL1-dominated
 * (punishment compartment, drives approach) according to which dopaminergic
 * population actually innervates it in the connectome.
 */

const KC_SPARSITY = 0.05; // fraction of Kenyon cells a stimulus activates
const LEARN_RATE = 0.16; // synaptic depression per dopamine pairing

/** Deterministic string hash - the same word always lights the same KCs. */
function hash32(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const isKC = (t) => !!t && t.startsWith('KC');
const isMBON = (t) => !!t && t.startsWith('MBON');
const isPAM = (t) => !!t && t.startsWith('PAM');
const isPPL1 = (t) => !!t && t.startsWith('PPL1');

export class MushroomBody {
  constructor(graph) {
    this.kc = [];
    this.mbon = [];
    this.dan = [];
    this.idx = new Map();
    for (const n of graph.nodes) {
      this.idx.set(n.bodyId, n);
      if (isKC(n.type)) this.kc.push(n.bodyId);
      else if (isMBON(n.type)) this.mbon.push(n.bodyId);
      else if (isPAM(n.type) || isPPL1(n.type)) this.dan.push(n.bodyId);
    }
    this.mbonPos = new Map(this.mbon.map((b, i) => [b, i]));
    this.kcPos = new Map(this.kc.map((b, i) => [b, i]));

    // Which dopaminergic population owns each MBON's compartment?
    const pam = new Float32Array(this.mbon.length);
    const ppl1 = new Float32Array(this.mbon.length);
    const kcEdges = [];
    for (const e of graph.edges) {
      const src = this.idx.get(e.source);
      const m = this.mbonPos.get(e.target);
      if (!src || m === undefined) continue;
      if (isPAM(src.type)) pam[m] += e.weight;
      else if (isPPL1(src.type)) ppl1[m] += e.weight;
      else if (isKC(src.type)) {
        const k = this.kcPos.get(e.source);
        if (k !== undefined) kcEdges.push([k, m, e.weight]);
      }
    }
    // sign < 0 : reward compartment (drives avoidance)
    // sign > 0 : punishment compartment (drives approach)
    this.mbonSign = new Float32Array(this.mbon.length);
    for (let m = 0; m < this.mbon.length; m++) {
      const tot = pam[m] + ppl1[m];
      this.mbonSign[m] = tot === 0 ? 0 : (ppl1[m] - pam[m]) / tot;
    }

    // CSR over KC -> MBON, indexed by KC
    const nk = this.kc.length;
    const deg = new Int32Array(nk);
    for (const e of kcEdges) deg[e[0]]++;
    this.ptr = new Int32Array(nk + 1);
    for (let i = 0; i < nk; i++) this.ptr[i + 1] = this.ptr[i] + deg[i];
    this.eM = new Int32Array(kcEdges.length);
    this.eW = new Float32Array(kcEdges.length);
    this.plast = new Float32Array(kcEdges.length).fill(1); // weight multiplier
    const cur = this.ptr.slice(0, nk);
    for (const e of kcEdges) {
      const p = cur[e[0]]++;
      this.eM[p] = e[1];
      this.eW[p] = e[2];
    }
    this.nEdges = kcEdges.length;
    this.baselines = new Map();
    this.taught = new Map(); // word -> times reinforced
    this._codes = new Map();
  }

  /** The sparse Kenyon-cell code for a stimulus. Deterministic per word. */
  encode(word) {
    const key = String(word).toLowerCase().trim();
    const cached = this._codes.get(key);
    if (cached) return cached;
    const rnd = mulberry32(hash32(key));
    const n = Math.max(1, Math.round(this.kc.length * KC_SPARSITY));
    const set = new Set();
    while (set.size < n) set.add(Math.floor(rnd() * this.kc.length));
    const code = [...set];
    this._codes.set(key, code);
    return code;
  }

  /** MBON activations for a stimulus, through current synaptic weights. */
  mbonActivity(word) {
    const act = new Float32Array(this.mbon.length);
    for (const k of this.encode(word)) {
      for (let p = this.ptr[k]; p < this.ptr[k + 1]; p++) {
        act[this.eM[p]] += this.eW[p] * this.plast[p];
      }
    }
    return act;
  }

  _raw(word) {
    const act = this.mbonActivity(word);
    let v = 0;
    let tot = 0;
    for (let m = 0; m < act.length; m++) {
      v += act[m] * this.mbonSign[m];
      tot += act[m];
    }
    return tot > 0 ? v / tot : 0;
  }

  /**
   * Learned valence: positive = approach, negative = avoid.
   * Measured against this word's own untrained baseline, so an untaught word
   * reads 0 - "this means nothing to her yet".
   */
  valence(word) {
    const key = String(word).toLowerCase().trim();
    const raw = this._raw(key);
    if (!this.baselines.has(key)) this.baselines.set(key, raw);
    // Bounded: valence saturates, so repeated pairings consolidate rather
    // than running away. Matches how conditioning actually plateaus.
    return Math.tanh((raw - this.baselines.get(key)) * 5);
  }

  /**
   * Pair a stimulus with dopamine. sign > 0 = reward (PAM), < 0 = punishment
   * (PPL1). Depresses the KC->MBON synapses that were ACTIVE for this word, in
   * the compartment that dopamine belongs to. That is the real plasticity rule.
   */
  teach(word, sign) {
    const key = String(word).toLowerCase().trim();
    this.valence(key); // make sure a naive baseline exists first
    const target = sign > 0 ? -1 : 1; // reward acts on PAM (negative) compartments
    let changed = 0;
    for (const k of this.encode(key)) {
      for (let p = this.ptr[k]; p < this.ptr[k + 1]; p++) {
        const ms = this.mbonSign[this.eM[p]];
        if (ms * target <= 0) continue; // wrong compartment for this dopamine
        this.plast[p] *= 1 - LEARN_RATE * Math.abs(ms);
        changed++;
      }
    }
    this.taught.set(key, (this.taught.get(key) || 0) + 1);
    return changed;
  }

  /** Synapses measurably changed from naive - what the memory inspector shows. */
  changedSynapses() {
    let n = 0;
    for (let p = 0; p < this.nEdges; p++) if (this.plast[p] < 0.999) n++;
    return n;
  }

  forget() {
    this.plast.fill(1);
    this.taught.clear();
    this.baselines.clear();
  }

  stats() {
    let pamN = 0;
    let ppl1N = 0;
    for (const s of this.mbonSign) {
      if (s < -0.1) pamN++;
      else if (s > 0.1) ppl1N++;
    }
    return {
      kc: this.kc.length,
      mbon: this.mbon.length,
      dan: this.dan.length,
      synapses: this.nEdges,
      pamMBON: pamN,
      ppl1MBON: ppl1N,
    };
  }
}
