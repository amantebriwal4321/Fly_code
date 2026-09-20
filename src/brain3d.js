/**
 * Her brain, as it actually is.
 *
 * Every strand here is a real neuron's real shape, traced from electron
 * microscopy and served by neuPrint as a skeleton of xyz + radius. Nothing in
 * this view is a diagram: the ellipsoid-body donut and the protocerebral
 * bridge are not drawn, they are what 166 arbors happen to form when you put
 * them where they belong.
 *
 * The bump of activity you see travelling around the donut is the same
 * simulation driving the 2D ring and driving Nona's heading. Brightness is
 * firing rate.
 *
 * Rendering follows Blob Mixer's approach - PBR MeshPhysicalMaterial, with
 * activity driving vertex displacement in the shader. One difference worth
 * stating: the reference recomputes normals after displacement because its
 * blobs deform arbitrarily. Ours swell RADIALLY along a tube, and a uniform
 * radial scale leaves the surface normal pointing the same way, so there is
 * nothing to recompute. Said plainly rather than performing the step for show.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const RADIAL = 8; // sides per tube ring
const RADIUS_BOOST = 1.7; // real radii are hair-thin at this scale
const RADIUS_MAX = 1.05; // trunks and somata are 6x the mean; uncapped they read as faceted blocks

/** Same palette as the 2D ring, so the two views agree. */
export const TYPE_COLOUR = {
  EPG: 0x6be6ff,
  Delta7: 0xff6a8c,
  'PEN_a(PEN1)': 0xffc46b,
  'PEN_b(PEN2)': 0xffa04b,
  PEG: 0xb98cff,
  EL: 0x7fd48a,
  ER: 0x5ad1c8, // landmark input (ring neurons)
  PFL3: 0xffd84d, // steering output
};

export const TYPE_LABEL = {
  EPG: 'EPG — the heading bump',
  Delta7: 'Delta7 — inhibition',
  'PEN_a(PEN1)': 'PEN1 — rotation',
  'PEN_b(PEN2)': 'PEN2 — rotation',
  PEG: 'PEG — feedback',
  EL: 'EL',
  ER: 'ER — landmark input',
  PFL3: 'PFL3 — steering out',
};

/** ER has many subtypes (ER1_, ER2_, ...); fold them, and PFL3, to one family. */
export function family(type) {
  if (!type) return type;
  if (type.startsWith('ER')) return 'ER';
  if (type.startsWith('PFL3')) return 'PFL3';
  return type;
}

/**
 * Build a tube around a polyline using a parallel-transport frame.
 * TubeGeometry wants a Curve per path and there are 7,260 paths, so this does
 * the same job directly into shared arrays.
 */
function tubePath(raw, neuronIdx, out) {
  // Drop coincident points first. Zero-length tangents produce a degenerate
  // frame, which renders as a flat paper ribbon instead of a tube.
  const pts = [raw[0], raw[1], raw[2], raw[3]];
  for (let i = 1; i < raw.length / 4; i++) {
    const dx = raw[i * 4] - pts[pts.length - 4];
    const dy = raw[i * 4 + 1] - pts[pts.length - 3];
    const dz = raw[i * 4 + 2] - pts[pts.length - 2];
    if (dx * dx + dy * dy + dz * dz > 1e-6) {
      pts.push(raw[i * 4], raw[i * 4 + 1], raw[i * 4 + 2], raw[i * 4 + 3]);
    }
  }
  const n = pts.length / 4;
  if (n < 2) return;
  const base = out.pos.length / 3;

  // initial frame
  let tx = pts[4] - pts[0];
  let ty = pts[5] - pts[1];
  let tz = pts[6] - pts[2];
  let tl = Math.hypot(tx, ty, tz) || 1;
  tx /= tl; ty /= tl; tz /= tl;
  // any vector not parallel to the tangent
  let ux = Math.abs(tx) < 0.9 ? 1 : 0;
  let uy = Math.abs(tx) < 0.9 ? 0 : 1;
  let uz = 0;
  // normal = normalize(u - t*(t.u))
  let d = tx * ux + ty * uy + tz * uz;
  let nx = ux - tx * d, ny = uy - ty * d, nz = uz - tz * d;
  let nl = Math.hypot(nx, ny, nz) || 1;
  nx /= nl; ny /= nl; nz /= nl;

  for (let i = 0; i < n; i++) {
    const px = pts[i * 4], py = pts[i * 4 + 1], pz = pts[i * 4 + 2];
    // Clamp the radius to the local segment length. A thick tube over a short
    // segment renders as a flat paddle, which is what the branch tips were.
    const iPrev = Math.max(0, i - 1);
    const iNext = Math.min(n - 1, i + 1);
    const segLen = Math.max(
      1e-3,
      Math.min(
        Math.hypot(px - pts[iPrev * 4], py - pts[iPrev * 4 + 1], pz - pts[iPrev * 4 + 2]) || 1e9,
        Math.hypot(pts[iNext * 4] - px, pts[iNext * 4 + 1] - py, pts[iNext * 4 + 2] - pz) || 1e9
      )
    );
    const r = Math.min(pts[i * 4 + 3] * RADIUS_BOOST, segLen * 0.75, RADIUS_MAX);

    if (i > 0) {
      // transport the frame along the new tangent
      const j = Math.min(i + 1, n - 1);
      let ax = pts[j * 4] - pts[(i - 1) * 4];
      let ay = pts[j * 4 + 1] - pts[(i - 1) * 4 + 1];
      let az = pts[j * 4 + 2] - pts[(i - 1) * 4 + 2];
      const al = Math.hypot(ax, ay, az) || 1;
      ax /= al; ay /= al; az /= al;
      const dd = ax * nx + ay * ny + az * nz;
      nx -= ax * dd; ny -= ay * dd; nz -= az * dd;
      const l2 = Math.hypot(nx, ny, nz) || 1;
      nx /= l2; ny /= l2; nz /= l2;
      tx = ax; ty = ay; tz = az;
    }
    // binormal
    const bx = ty * nz - tz * ny;
    const by = tz * nx - tx * nz;
    const bz = tx * ny - ty * nx;

    for (let k = 0; k < RADIAL; k++) {
      const a = (k / RADIAL) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const dx = nx * ca + bx * sa;
      const dy = ny * ca + by * sa;
      const dz = nz * ca + bz * sa;
      out.pos.push(px + dx * r, py + dy * r, pz + dz * r);
      out.nor.push(dx, dy, dz);
      out.neu.push(neuronIdx);
    }
  }

  for (let i = 0; i < n - 1; i++) {
    const a = base + i * RADIAL;
    const b = base + (i + 1) * RADIAL;
    for (let k = 0; k < RADIAL; k++) {
      const k2 = (k + 1) % RADIAL;
      out.idx.push(a + k, b + k, a + k2);
      out.idx.push(a + k2, b + k, b + k2);
    }
  }
}

export class Brain3D {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} skeletons  data/skeletons.json
   * @param {string[]} bodyOrder  bodyIds in the simulation's neuron order
   */
  constructor(canvas, skeletons, bodyOrder) {
    this.canvas = canvas;
    this.enabled = true;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setClearColor(0x05070c, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.78;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05070c);
    this.camera = new THREE.PerspectiveCamera(42, 1, 1, 2000);
    // Framed on the ellipsoid body, not the bounding-box centre. The EB sits
    // well off-centre (the protocerebral bridge projections spread far wider),
    // so a naive fit shows a hairball and hides the thing worth looking at.
    this.camera.position.set(7, 58, 6);

    // Real environment lighting - this is what makes the material read as a
    // physical surface rather than a flat colour.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    // Dim, or the whole arbor reads as white plastic and the colours vanish.
    this.scene.environmentIntensity = 0.17;
    pmrem.dispose();

    const key = new THREE.DirectionalLight(0xdfe8ff, 0.55);
    key.position.set(60, 90, 70);
    this.scene.add(key);
    this.scene.add(new THREE.AmbientLight(0x2a3350, 0.35));

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.55;
    this.controls.minDistance = 40;
    this.controls.maxDistance = 420;
    this.controls.target.set(0, 3, -13); // ellipsoid body (densest EPG convergence)
    this.controls.update();

    // ---- activity texture: one texel per neuron, rewritten every frame ----
    this.order = bodyOrder.map(String);
    this.slot = new Map(this.order.map((b, i) => [b, i]));
    this.count = this.order.length;
    this.actData = new Float32Array(this.count * 4);
    this.actTex = new THREE.DataTexture(this.actData, this.count, 1, THREE.RGBAFormat, THREE.FloatType);
    this.actTex.needsUpdate = true;

    this.uniforms = {
      uActivity: { value: this.actTex },
      uCount: { value: this.count },
      uTime: { value: 0 },
      uGlow: { value: 1.0 },
    };

    this._build(skeletons);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.62, 0.6, 0.5);
    this.composer.addPass(this.bloom);

    this._t = 0;
  }

  _build(skeletons) {
    // One merged mesh per cell type: six draw calls, and per-type visibility
    // becomes a one-line toggle. Per-neuron brightness still works, because
    // every vertex carries which neuron it belongs to.
    const byType = new Map();
    for (const [bid, rec] of Object.entries(skeletons)) {
      const fam = family(rec.type); // fold ER* and PFL3 into one mesh each
      if (!byType.has(fam)) byType.set(fam, []);
      byType.get(fam).push([bid, rec]);
    }

    this.meshes = new Map();
    this.stats = { vertices: 0, paths: 0 };

    for (const [type, list] of byType) {
      const out = { pos: [], nor: [], neu: [], idx: [] };
      for (const [bid, rec] of list) {
        const idx = this.slot.get(String(bid));
        if (idx === undefined) continue;
        for (const path of rec.paths) {
          tubePath(path, idx, out);
          this.stats.paths++;
        }
      }
      if (!out.pos.length) continue;

      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(out.nor, 3));
      g.setAttribute('aNeuron', new THREE.Float32BufferAttribute(out.neu, 1));
      g.setIndex(out.idx);
      g.computeBoundingSphere();
      this.stats.vertices += out.pos.length / 3;

      const colour = new THREE.Color(TYPE_COLOUR[type] ?? 0x8899aa);
      const mat = new THREE.MeshPhysicalMaterial({
        color: colour.clone().multiplyScalar(0.05),
        emissive: colour,
        emissiveIntensity: 0.10,
        roughness: 0.45,
        metalness: 0.0,
        clearcoat: 0.3,
        clearcoatRoughness: 0.3,
        iridescence: 0.35,
        iridescenceIOR: 1.3,
        sheen: 0.25,
        sheenColor: colour,
      });
      mat.userData.uniforms = this.uniforms;
      mat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, this.uniforms);
        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            `#include <common>
             attribute float aNeuron;
             uniform sampler2D uActivity;
             uniform float uCount;
             uniform float uTime;
             varying float vAct;`
          )
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             vAct = texture2D(uActivity, vec2((aNeuron + 0.5) / uCount, 0.5)).r;
             // Active neurons swell. The swell is radial on a tube, so the
             // surface normal is unchanged and needs no recomputation.
             float pulse = 1.0 + 0.16 * sin(uTime * 3.4 + aNeuron * 0.9);
             transformed += objectNormal * vAct * 0.42 * pulse;`
          );
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\n varying float vAct;\n uniform float uGlow;')
          .replace(
            '#include <emissivemap_fragment>',
            `#include <emissivemap_fragment>
             totalEmissiveRadiance *= 1.0 + vAct * uGlow * 9.0;`
          );
      };

      const mesh = new THREE.Mesh(g, mat);
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      this.meshes.set(type, mesh);
    }
  }

  setTypeVisible(type, on) {
    const m = this.meshes.get(type);
    if (m) m.visible = on;
  }

  types() {
    return [...this.meshes.keys()];
  }

  /** @param {Float32Array} rate firing rate per neuron, in simulation order */
  setActivity(rate, peak) {
    const p = Math.max(12, peak || 1);
    // Smoothstep from 35% of peak, then cube. The bump is broad - every EPG
    // carries SOME activity - so a linear map lights the whole ring and the
    // crest disappears. This isolates the crest, which is the thing to see.
    for (let i = 0; i < this.count; i++) {
      const r = Math.min(1, (rate[i] || 0) / p);
      const t = Math.max(0, Math.min(1, (r - 0.35) / 0.65));
      const sm = t * t * (3 - 2 * t);
      this.actData[i * 4] = sm * sm;
    }
    this.actTex.needsUpdate = true;
  }

  resize(w, h, hi) {
    if (w <= 0 || h <= 0) return;
    this.renderer.setPixelRatio(hi ? Math.min(devicePixelRatio, 2) : 1);
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setGlow(val) {
    if (this.uniforms && this.uniforms.uGlow) this.uniforms.uGlow.value = val;
    if (this.bloom) this.bloom.strength = 0.62 * val;
  }

  resetCamera() {
    this.camera.position.set(0, 18, 120);
    this.controls.target.set(0, 3, -13);
    this.controls.update();
  }

  render(dt) {
    if (!this.enabled) return;
    this._t += dt;
    this.uniforms.uTime.value = this._t;
    this.controls.update();
    this.composer.render();
  }
}
