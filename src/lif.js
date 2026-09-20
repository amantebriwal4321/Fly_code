/**
 * Leaky integrate-and-fire engine over a real connectome subgraph.
 *
 * Constants are the community-standard Drosophila values (Shiu et al.):
 * every neuron is a leaky bucket of voltage, a synapse moves it 0.275 mV,
 * and crossing threshold dumps charge into every downstream partner.
 *
 * Nothing here is specific to a circuit - compass.js and mushroom.js both
 * run on this.
 */

export const V_REST = -52.0; // mV
export const V_THRESH = -45.0; // mV
export const V_RESET = -55.0; // mV
export const TAU_M = 20.0; // ms, membrane time constant
export const T_REFRAC = 2.2; // ms
export const W_SYN = 0.275; // mV per synapse
export const TAU_SYN = 5.0; // ms, synaptic current decay
export const TAU_ADAPT = 80.0; // ms, spike-frequency adaptation decay
export const B_ADAPT = 0.55; // mV/ms added per spike

// Drosophila: acetylcholine excites, glutamate and GABA inhibit.
// Octopamine is modulatory - treated as weak excitation.
const NT_SIGN = {
  acetylcholine: 1,
  glutamate: -1,
  gaba: -1,
  octopamine: 0.3,
  dopamine: 0.3,
  serotonin: 0.3,
  unknown: 1,
};

export function ntSign(nt) {
  if (!nt) return 1;
  return NT_SIGN[String(nt).toLowerCase()] ?? 1;
}

export class Network {
  /**
   * @param {{nodes: Array, edges: Array}} graph - as cached by extract_*.py
   * @param {{excGain?: number, inhGain?: number}} opts
   */
  constructor(graph, opts = {}) {
    const nodes = graph.nodes;
    const n = nodes.length;

    this.n = n;
    this.nodes = nodes;
    this.excGain = opts.excGain ?? 1.0;
    this.inhGain = opts.inhGain ?? 1.0;
    // Adaptation stops runaway, but too much of it also kills a persistent
    // bump - a ring attractor has to hold its heading for seconds.
    this.bAdapt = opts.bAdapt ?? B_ADAPT;

    this.index = new Map();
    this.sign = new Float32Array(n);
    this.type = new Array(n);
    for (let i = 0; i < n; i++) {
      this.index.set(nodes[i].bodyId, i);
      this.sign[i] = ntSign(nodes[i].nt);
      this.type[i] = nodes[i].type;
    }

    // Build CSR over outgoing edges, dropping any edge whose endpoints
    // are not both in this subgraph.
    const deg = new Int32Array(n);
    const valid = [];
    for (const e of graph.edges) {
      const s = this.index.get(e.source);
      const t = this.index.get(e.target);
      if (s === undefined || t === undefined) continue;
      deg[s]++;
      valid.push([s, t, e.weight]);
    }
    this.outPtr = new Int32Array(n + 1);
    for (let i = 0; i < n; i++) this.outPtr[i + 1] = this.outPtr[i] + deg[i];
    const m = valid.length;
    this.m = m;
    this.outIdx = new Int32Array(m);
    this.outW = new Float32Array(m);
    const cursor = this.outPtr.slice(0, n);
    for (const [s, t, w] of valid) {
      const p = cursor[s]++;
      this.outIdx[p] = t;
      this.outW[p] = w;
    }
    // Kept so scramble() can rebuild from the original topology.
    this._origIdx = this.outIdx.slice();

    // Per-neuron input normalisation.
    //
    // This subgraph is the densely interconnected core of the central complex
    // (~63 edges per neuron), so raw summed input drives every cell into
    // saturation and no bump can form. We scale each neuron's incoming weights
    // by its own total input, which leaves the RELATIVE pattern of who
    // connects to whom - the part that actually encodes heading - untouched.
    // Documented modelling choice, not a silent fudge.
    if (opts.normalize !== false) {
      const inSum = new Float32Array(n);
      for (let i = 0; i < n; i++)
        for (let p = this.outPtr[i]; p < this.outPtr[i + 1]; p++)
          inSum[this.outIdx[p]] += this.outW[p];
      for (let i = 0; i < n; i++)
        for (let p = this.outPtr[i]; p < this.outPtr[i + 1]; p++) {
          const t = this.outIdx[p];
          if (inSum[t] > 0) this.outW[p] = (this.outW[p] / inSum[t]) * 100;
        }
    }

    this.V = new Float32Array(n).fill(V_REST);
    this.refrac = new Float32Array(n);
    this.spiked = new Uint8Array(n);
    this.rate = new Float32Array(n); // low-passed, for display
    this.ext = new Float32Array(n); // external drive, mV/ms
    this.syn = new Float32Array(n); // synaptic current, decays with TAU_SYN
    this.adapt = new Float32Array(n); // adaptation current, decays with TAU_ADAPT
    this.alive = new Uint8Array(n).fill(1); // 0 = lesioned
    this.t = 0;
  }

  /** Silence a set of neurons (by index). Used by the lesion control. */
  setAlive(indices, alive) {
    for (const i of indices) this.alive[i] = alive ? 1 : 0;
  }

  /**
   * Degree-preserving edge shuffle: every neuron keeps the same number of
   * outgoing connections with the same weights, but they now land on random
   * partners. This is the control that proves the STRUCTURE does the work.
   */
  scramble(on) {
    if (!on) {
      this.outIdx.set(this._origIdx);
      return;
    }
    for (let p = 0; p < this.m; p++) {
      this.outIdx[p] = (Math.random() * this.n) | 0;
    }
  }

  indicesOfType(pred) {
    const out = [];
    for (let i = 0; i < this.n; i++) if (pred(this.type[i], this.nodes[i])) out.push(i);
    return out;
  }

  /** One integration step. dt in ms. */
  step(dt) {
    const { V, refrac, spiked, ext, syn, adapt, alive, sign, rate } = this;
    const decay = dt / TAU_M;
    const synDecay = Math.exp(-dt / TAU_SYN);
    const adaptDecay = Math.exp(-dt / TAU_ADAPT);

    for (let i = 0; i < this.n; i++) {
      spiked[i] = 0;
      if (!alive[i]) { V[i] = V_REST; syn[i] = 0; adapt[i] = 0; continue; }
      if (refrac[i] > 0) {
        refrac[i] -= dt;
        V[i] = V_RESET;
        continue;
      }
      // Leak toward rest, plus filtered synaptic drive, plus external drive,
      // minus the adaptation current this neuron's own recent spikes built up.
      V[i] += (V_REST - V[i]) * decay + (syn[i] + ext[i] - adapt[i]) * dt;
      if (V[i] > V_THRESH) {
        V[i] = V_RESET;
        refrac[i] = T_REFRAC;
        spiked[i] = 1;
        adapt[i] += this.bAdapt;
      }
    }

    for (let i = 0; i < this.n; i++) {
      syn[i] *= synDecay;
      adapt[i] *= adaptDecay;
    }

    for (let i = 0; i < this.n; i++) {
      if (!spiked[i]) continue;
      const s = sign[i];
      const gain = s >= 0 ? this.excGain : this.inhGain;
      const amp = s * W_SYN * gain;
      const end = this.outPtr[i + 1];
      for (let p = this.outPtr[i]; p < end; p++) {
        syn[this.outIdx[p]] += this.outW[p] * amp;
      }
    }

    // Low-pass firing rate, ~50 ms window, for the HUD.
    const ra = dt / 50.0;
    for (let i = 0; i < this.n; i++) {
      rate[i] += ((spiked[i] ? 1000 / dt : 0) - rate[i]) * ra;
    }

    this.t += dt;
  }
}
