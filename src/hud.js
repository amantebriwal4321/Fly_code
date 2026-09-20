/**
 * The brain panel: what is actually happening in the connectome, drawn live.
 *
 * Left: the ellipsoid-body ring. Each dot is one real EPG neuron placed at the
 * heading its protocerebral-bridge glomerulus encodes. Brightness is its
 * firing rate. The bright arc IS the bump - her sense of which way she faces.
 * The inner ring is Delta7, the inhibition that keeps the bump to one place.
 *
 * Right: the mushroom body. Sparse Kenyon-cell code for whatever she is being
 * told, and the MBON bars whose imbalance is the learned valence.
 */

const TAU = Math.PI * 2;

export class Hud {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(devicePixelRatio, 2);
    this.spikeFlash = new Map();
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    this.c.width = w * this.dpr;
    this.c.height = h * this.dpr;
    this.c.style.width = w + 'px';
    this.c.style.height = h + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  draw(state) {
    const { ctx, w, h } = this;
    // The 2D HUD canvas can be 0-sized or hidden by the panel's tab layout.
    // Drawing then yields non-finite geometry (NaN radii) that throws from
    // createRadialGradient and would kill the whole render loop. Bail out.
    if (!ctx || !(w > 0) || !(h > 0)) return;
    ctx.clearRect(0, 0, w, h);
    const ringH = Math.min(h * 0.46, w * 0.8);
    this._ring(state, 0, 0, w, ringH);
    this._mb(state, 0, ringH, w, h - ringH);
  }

  _label(x, y, text, colour, size = 10, align = 'left') {
    const { ctx } = this;
    ctx.font = `500 ${size}px ui-monospace, "SF Mono", Menlo, monospace`;
    ctx.fillStyle = colour;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
    ctx.textAlign = 'left';
  }

  _ring(s, x0, y0, w, h) {
    const { ctx } = this;
    // Normalise against the current peak. A broad bump at 90-107 Hz against a
    // 1-13 Hz trough is a real bump, but against a fixed ceiling every neuron
    // clips to full brightness and the ring looks uniform.
    let peak = 1;
    for (const e of s.epg) peak = Math.max(peak, e.rate);
    let d7peak = 1;
    for (const d of s.delta7) d7peak = Math.max(d7peak, d.rate);
    const cx = x0 + w / 2;
    const cy = y0 + h / 2 + 6;
    const R = Math.min(w, h) * 0.33;

    this._label(x0 + 14, y0 + 18, 'ELLIPSOID BODY · heading', '#7d8598', 10);
    this._label(x0 + w - 14, y0 + 18, `${s.epgRate.toFixed(0)} Hz`, '#4b5164', 10, 'right');

    // ring track
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 26;
    ctx.stroke();

    // Delta7, inner - the inhibition
    for (const d of s.delta7) {
      const a = d.angle - Math.PI / 2;
      const r = Math.min(1, d.rate / d7peak);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * (R - 26), cy + Math.sin(a) * (R - 26), 2 + r * 2.4, 0, TAU);
      ctx.fillStyle = `rgba(255,106,140,${0.16 + r * 0.7})`;
      ctx.fill();
    }

    // EPG, on the ring
    for (const e of s.epg) {
      const a = e.angle - Math.PI / 2;
      const n = Math.min(1, e.rate / peak);
      const r = n * n;
      const px = cx + Math.cos(a) * R;
      const py = cy + Math.sin(a) * R;
      if (r > 0.12) {
        const g = ctx.createRadialGradient(px, py, 0, px, py, 15 + r * 20);
        g.addColorStop(0, `rgba(107,230,255,${0.5 * r})`);
        g.addColorStop(1, 'rgba(107,230,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(px - 36, py - 36, 72, 72);
      }
      ctx.beginPath();
      ctx.arc(px, py, 2.4 + r * 4, 0, TAU);
      ctx.fillStyle = `rgba(${107 + r * 148},${230},${255},${0.22 + r * 0.78})`;
      ctx.fill();
    }

    // the population vector - where she thinks she is pointing
    if (s.strength > 0.05) {
      const a = s.theta - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * R * s.strength * 1.5, cy + Math.sin(a) * R * s.strength * 1.5);
      ctx.strokeStyle = '#ffc46b';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, TAU);
      ctx.fillStyle = '#ffc46b';
      ctx.fill();
    }

    const deg = ((s.theta * 180) / Math.PI + 360) % 360;
    this._label(cx, cy + R + 30, s.strength > 0.15 ? `${deg.toFixed(0)}°` : 'no heading', s.strength > 0.15 ? '#ffc46b' : '#5a6070', 15, 'center');
    this._label(cx, cy + R + 46, s.strength > 0.15 ? `bump ${s.strength.toFixed(2)}` : 'bump lost', '#5a6070', 9, 'center');

    if (s.lesioned) this._label(cx, y0 + 18, 'DELTA7 LESIONED', '#ff6a8c', 10, 'center');
    if (s.scrambled) this._label(cx, y0 + 32, 'WIRING SCRAMBLED', '#ff6a8c', 10, 'center');
  }

  _mb(s, x0, y0, w, h) {
    const { ctx } = this;
    this._label(x0 + 14, y0 + 15, 'MUSHROOM BODY · memory', '#7d8598', 10);
    this._label(x0 + w - 14, y0 + 15, `${s.changed} synapses changed`, '#4b5164', 10, 'right');

    // Kenyon cell sparse code
    const gx = x0 + 14;
    const gy = y0 + 24;
    const gw = w - 28;
    const gh = Math.max(16, Math.min(26, h * 0.22));
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(gx, gy, gw, gh);
    const cols = Math.floor(gw / 3);
    const rows = Math.max(1, Math.floor(gh / 3));
    if (s.kcActive && s.kcActive.size) {
      ctx.fillStyle = 'rgba(160,255,190,0.9)';
      for (const k of s.kcActive) {
        const i = k % (cols * rows);
        ctx.fillRect(gx + (i % cols) * 3, gy + Math.floor(i / cols) * 3, 2, 2);
      }
    }
    this._label(gx, gy + gh + 10, s.cue ? `cue "${s.cue}" → ${s.kcActive ? s.kcActive.size : 0} of ${s.kcTotal} Kenyon cells` : 'no stimulus', '#5a6070', 9);

    // MBON bars (guaranteed never to overlap with valence label)
    const by = gy + gh + 16;
    const valY = y0 + h - 6;
    const bh = Math.max(8, valY - by - 16);
    const n = Math.min(s.mbon.length, 60);
    const bw = (w - 28) / n;
    for (let i = 0; i < n; i++) {
      const v = s.mbon[i];
      const sign = s.mbonSign[i];
      const hgt = Math.min(1, v) * bh;
      ctx.fillStyle = sign > 0 ? 'rgba(107,230,255,0.75)' : 'rgba(255,164,107,0.75)';
      ctx.fillRect(x0 + 14 + i * bw, by + bh - hgt, Math.max(1, bw - 1), hgt);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.moveTo(x0 + 14, by + bh);
    ctx.lineTo(x0 + w - 14, by + bh);
    ctx.stroke();

    const val = s.valence;
    const col = val > 0.08 ? '#7fd48a' : val < -0.08 ? '#ff6a8c' : '#5a6070';
    const word = val > 0.08 ? 'approach' : val < -0.08 ? 'avoid' : 'neutral';
    this._label(x0 + 14, valY, `valence ${val >= 0 ? '+' : ''}${val.toFixed(2)} · ${word}`, col, 11);
  }
}
