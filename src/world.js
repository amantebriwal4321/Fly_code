/**
 * Nona's Bangalore - Rich 3D daylight world with procedural architecture,
 * authentic landmarks, live traffic, dynamic clouds, and direct manual flight controls.
 */

import * as THREE from 'three';

export const LANDMARKS = [
  { key: 'home', label: '2586Labs', sub: '100 Feet Road, Indiranagar', pos: [0, 14, 0], colour: 0xffa439, home: true },
  { key: 'cubbon', label: 'Cubbon Park', sub: 'trees, shade, quiet', pos: [-120, 8, -90], colour: 0x48b865 },
  { key: 'vidhana', label: 'Vidhana Soudha', sub: 'grand legislative palace', pos: [-70, 30, -190], colour: 0xded8c7 },
  { key: 'ubcity', label: 'UB City', sub: 'luxury glass tower', pos: [95, 46, -150], colour: 0x4aa5f0 },
  { key: 'lalbagh', label: 'Lalbagh', sub: 'glasshouse & botanical gardens', pos: [150, 10, 120], colour: 0xe0488e },
  { key: 'traffic', label: '100 Feet Road', sub: 'traffic, autos, cafes', pos: [-40, 6, 140], colour: 0xf05030 },
];

/** Floating 3D nameplate badge facing camera */
function makeLabel(title, sub, colour, isLight = true) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');

  g.fillStyle = isLight ? 'rgba(255, 255, 255, 0.88)' : 'rgba(12, 16, 24, 0.82)';
  g.beginPath();
  g.roundRect(8, 20, 496, 88, 14);
  g.fill();

  g.strokeStyle = '#' + colour.toString(16).padStart(6, '0');
  g.lineWidth = 3;
  g.stroke();

  g.textAlign = 'center';
  g.fillStyle = '#' + colour.toString(16).padStart(6, '0');
  g.font = '700 36px ui-sans-serif, -apple-system, system-ui, sans-serif';
  g.fillText(title, 256, 60);

  g.fillStyle = isLight ? 'rgba(40, 48, 64, 0.82)' : 'rgba(215, 222, 235, 0.82)';
  g.font = '500 20px ui-monospace, "SF Mono", Menlo, monospace';
  g.fillText(sub, 256, 92);

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(110, 27.5, 1);
  return sp;
}

const rand = (s) => {
  let a = s;
  return () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
};

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.5, 3600);

    this.theme = 'light'; // Default to light theme as requested!
    this._t = 0;
    this.frozen = false;

    // Flight state & manual controls
    this.pos = new THREE.Vector3(50, 88, 200);
    this.heading = 0;
    this.pitch = 0;
    this.roll = 0;
    this.speed = 42;
    this.altitude = 88;
    this.manualMode = false;
    this.boost = false;
    this.inputs = { forward: 0, turn: 0, pitch: 0, boost: false };
    this.trail = [];

    // Lighting & Environment
    this._setupEnvironment();
    this._ground();
    this._clouds();
    this._landmarks();
    this._city();
    this._traffic();
    this._fly();
    this._bindControls();
  }

  _setupEnvironment() {
    if (this.theme === 'light') {
      this.renderer.setClearColor(0xcbe6f8, 1);
      this.scene.fog = new THREE.FogExp2(0xd6ecfa, 0.0011);

      this.hemiLight = new THREE.HemisphereLight(0xdcf0ff, 0x82a874, 0.78);
      this.scene.add(this.hemiLight);

      this.sunLight = new THREE.DirectionalLight(0xfff6e4, 1.35);
      this.sunLight.position.set(-180, 280, -120);
      this.scene.add(this.sunLight);

      this.fillLight = new THREE.DirectionalLight(0x9fc8e8, 0.45);
      this.fillLight.position.set(160, 140, 160);
      this.scene.add(this.fillLight);
    } else {
      this.renderer.setClearColor(0x181224, 1);
      this.scene.fog = new THREE.FogExp2(0x3e2840, 0.0016);

      this.hemiLight = new THREE.HemisphereLight(0xffd2a8, 0x1b1428, 0.52);
      this.scene.add(this.hemiLight);

      this.sunLight = new THREE.DirectionalLight(0xff9852, 0.95);
      this.sunLight.position.set(-160, 190, -110);
      this.scene.add(this.sunLight);

      this.fillLight = new THREE.DirectionalLight(0x6b84b8, 0.3);
      this.fillLight.position.set(160, 100, 160);
      this.scene.add(this.fillLight);
    }
    this._sky();
  }

  setTheme(mode) {
    this.theme = mode === 'dusk' ? 'dusk' : 'light';
    if (this.skyMesh) this.scene.remove(this.skyMesh);
    if (this.hemiLight) this.scene.remove(this.hemiLight);
    if (this.sunLight) this.scene.remove(this.sunLight);
    if (this.fillLight) this.scene.remove(this.fillLight);
    this._setupEnvironment();
  }

  _sky() {
    const g = new THREE.SphereGeometry(1800, 32, 20);
    const isLight = this.theme === 'light';
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      fog: false,
      uniforms: {
        top: { value: isLight ? new THREE.Color(0x358dd6) : new THREE.Color(0x130d24) },
        mid: { value: isLight ? new THREE.Color(0x91c8f2) : new THREE.Color(0x563050) },
        bot: { value: isLight ? new THREE.Color(0xe8f4fc) : new THREE.Color(0xd66d3b) },
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `
        varying vec3 vP;
        uniform vec3 top; uniform vec3 mid; uniform vec3 bot;
        void main(){
          float h = normalize(vP).y;
          vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.75)) : mix(mid, bot, pow(-h, 0.4));
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    });
    this.skyMesh = new THREE.Mesh(g, m);
    this.scene.add(this.skyMesh);
  }

  _clouds() {
    const cloudGrp = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.05,
      transparent: true,
      opacity: 0.85,
      flatShading: true,
    });
    const rnd = rand(10293);
    const nPuffs = 42;
    for (let i = 0; i < nPuffs; i++) {
      const puff = new THREE.Group();
      const px = (rnd() - 0.5) * 1400;
      const pz = (rnd() - 0.5) * 1400;
      const py = 240 + rnd() * 60;
      const nBlocks = 3 + Math.floor(rnd() * 4);
      for (let j = 0; j < nBlocks; j++) {
        const sx = 35 + rnd() * 45;
        const sy = 12 + rnd() * 18;
        const sz = 30 + rnd() * 40;
        const b = new THREE.Mesh(new THREE.DodecahedronGeometry(sx * 0.5, 1), cloudMat);
        b.scale.set(1, sy / sx, sz / sx);
        b.position.set((j - nBlocks / 2) * 25 + rnd() * 10, rnd() * 6, rnd() * 12);
        puff.add(b);
      }
      puff.position.set(px, py, pz);
      cloudGrp.add(puff);
    }
    this.clouds = cloudGrp;
    this.scene.add(cloudGrp);
  }

  _ground() {
    const isLight = this.theme === 'light';
    const groundMat = new THREE.MeshStandardMaterial({
      color: isLight ? 0xccdbbe : 0x1d1628,
      roughness: 0.95,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2800, 2800), groundMat);
    ground.rotateX(-Math.PI / 2);
    this.scene.add(ground);

    // Major road grid with Bangalore boulevards
    const roadMat = new THREE.MeshStandardMaterial({
      color: isLight ? 0x464e5c : 0x241d30,
      roughness: 0.85,
    });

    const roadsGrp = new THREE.Group();
    // 100 Feet Road running north-south through Indiranagar
    const hundredFt = new THREE.Mesh(new THREE.PlaneGeometry(42, 2400), roadMat);
    hundredFt.rotateX(-Math.PI / 2);
    hundredFt.position.set(-40, 0.2, 0);
    roadsGrp.add(hundredFt);

    // Cross roads
    for (let i = -6; i <= 6; i++) {
      if (i === 0) continue;
      const cross = new THREE.Mesh(new THREE.PlaneGeometry(2400, 24), roadMat);
      cross.rotateX(-Math.PI / 2);
      cross.position.set(0, 0.15, i * 160);
      roadsGrp.add(cross);
    }

    // White dashed center line along 100 Feet Road
    const dashPts = [];
    for (let z = -1100; z <= 1100; z += 18) {
      dashPts.push(-40, 0.3, z, -40, 0.3, z + 9);
    }
    const dashGeo = new THREE.BufferGeometry();
    dashGeo.setAttribute('position', new THREE.Float32BufferAttribute(dashPts, 3));
    const dashLines = new THREE.LineSegments(
      dashGeo,
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })
    );
    roadsGrp.add(dashLines);
    this.scene.add(roadsGrp);
  }

  _landmarks() {
    this.marks = [];
    const isLight = this.theme === 'light';

    for (const L of LANDMARKS) {
      const grp = new THREE.Group();
      const [x, y, z] = L.pos;
      grp.position.set(x, 0, z);

      // Unique bespoke architectural 3D model for each landmark!
      if (L.key === 'home') {
        this._buildHome2586(grp, L);
      } else if (L.key === 'vidhana') {
        this._buildVidhanaSoudha(grp, L);
      } else if (L.key === 'ubcity') {
        this._buildUBCity(grp, L);
      } else if (L.key === 'cubbon') {
        this._buildCubbonPark(grp, L);
      } else if (L.key === 'lalbagh') {
        this._buildLalbagh(grp, L);
      } else {
        this._buildTrafficStation(grp, L);
      }

      // Beacon beam
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(L.home ? 2.4 : 1.2, 0.3, 260, 8, 1, true),
        new THREE.MeshBasicMaterial({
          color: L.colour,
          transparent: true,
          opacity: L.home ? 0.35 : 0.2,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      beam.position.y = 130;
      grp.add(beam);

      // Radar pulse halo on ground
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(24, 32, 32),
        new THREE.MeshBasicMaterial({
          color: L.colour,
          transparent: true,
          opacity: 0.45,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 1.2;
      grp.add(halo);

      // Floating title plate
      const plate = makeLabel(L.label, L.sub, L.colour, isLight);
      plate.position.y = (y * 2) + 52;
      grp.add(plate);

      this.scene.add(grp);
      this.marks.push({ ...L, group: grp, halo, beam, plate, vec: new THREE.Vector3(x, y, z) });
    }
  }

  _buildHome2586(grp, L) {
    const concrete = new THREE.MeshStandardMaterial({ color: 0xded8ce, roughness: 0.6 });
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x3e2b20, roughness: 0.7 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x5cc5e8, roughness: 0.2, metalness: 0.8, transparent: true, opacity: 0.85 });
    const warmGlow = new THREE.MeshStandardMaterial({ color: 0xffa439, emissive: 0xffa439, emissiveIntensity: 0.65 });

    // Main 3-story modern incubator building
    const base = new THREE.Mesh(new THREE.BoxGeometry(36, 16, 34), concrete);
    base.position.y = 8;
    grp.add(base);

    // Glass frontage
    const win = new THREE.Mesh(new THREE.BoxGeometry(36.4, 10, 16), glass);
    win.position.set(0, 8, 4);
    grp.add(win);

    // 2nd Tier with terrace
    const tier2 = new THREE.Mesh(new THREE.BoxGeometry(26, 12, 24), darkWood);
    tier2.position.set(0, 22, -2);
    grp.add(tier2);

    // Rooftop Perch / Helipad for Nona
    const perch = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 1, 24), warmGlow);
    perch.position.set(0, 28.5, -2);
    grp.add(perch);

    // Entrance canopy
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(18, 1.2, 10), concrete);
    canopy.position.set(0, 6, 20);
    grp.add(canopy);
  }

  _buildVidhanaSoudha(grp, L) {
    const granite = new THREE.MeshStandardMaterial({ color: 0xeae6dc, roughness: 0.75 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xe6b843, metalness: 0.6, roughness: 0.35 });

    // Grand Dravidian stepped podium
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(84, 8, 48), granite);
    plinth.position.y = 4;
    grp.add(plinth);

    // Main facade
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(76, 22, 40), granite);
    mainBody.position.y = 19;
    grp.add(mainBody);

    // Front colonnade (pillars)
    for (let x = -32; x <= 32; x += 8) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 20, 10), granite);
      col.position.set(x, 18, 21.5);
      grp.add(col);
    }

    // Central Grand Dome
    const domeBase = new THREE.Mesh(new THREE.CylinderGeometry(12, 13, 6, 24), granite);
    domeBase.position.y = 33;
    grp.add(domeBase);

    const dome = new THREE.Mesh(new THREE.SphereGeometry(11, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), granite);
    dome.position.y = 36;
    grp.add(dome);

    const finial = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.8, 8, 12), gold);
    finial.position.y = 49;
    grp.add(finial);

    // 4 Corner Chattris
    for (const cx of [-32, 32]) {
      for (const cz of [-16, 16]) {
        const cPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 8, 8), granite);
        cPillar.position.set(cx, 34, cz);
        const cDome = new THREE.Mesh(new THREE.SphereGeometry(3.2, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), gold);
        cDome.position.set(cx, 38, cz);
        grp.add(cPillar, cDome);
      }
    }
  }

  _buildUBCity(grp, L) {
    const glass = new THREE.MeshStandardMaterial({
      color: 0x2a7ec4,
      roughness: 0.15,
      metalness: 0.85,
    });
    const frame = new THREE.MeshStandardMaterial({ color: 0xd8e4ed, roughness: 0.4 });

    // Tier 1 Base
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(40, 24, 40), glass);
    b1.position.y = 12;
    grp.add(b1);

    // Tier 2 Tower
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(32, 38, 32), glass);
    b2.position.y = 43;
    grp.add(b2);

    // Tier 3 Penthouse
    const b3 = new THREE.Mesh(new THREE.BoxGeometry(22, 28, 22), glass);
    b3.position.y = 76;
    grp.add(b3);

    // Helipad ring & crown
    const heli = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 1.8, 24), frame);
    heli.position.y = 91;
    grp.add(heli);

    // Iconic Spire
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 2.5, 32, 8), frame);
    spire.position.y = 107;
    grp.add(spire);
  }

  _buildCubbonPark(grp, L) {
    // Green mound
    const lawn = new THREE.Mesh(
      new THREE.CylinderGeometry(44, 48, 4, 24),
      new THREE.MeshStandardMaterial({ color: 0x3d8547, roughness: 0.9 })
    );
    lawn.position.y = 2;
    grp.add(lawn);

    // Lush trees cluster
    const rnd = rand(4482);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3e2a, roughness: 0.8 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e6b36, roughness: 0.85, flatShading: true });
    const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x3c8544, roughness: 0.85, flatShading: true });

    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + rnd() * 0.4;
      const r = 8 + rnd() * 28;
      const tx = Math.cos(a) * r;
      const tz = Math.sin(a) * r;
      const h = 7 + rnd() * 6;

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, h, 6), trunkMat);
      trunk.position.set(tx, 4 + h / 2, tz);

      const crown = new THREE.Mesh(
        new THREE.DodecahedronGeometry(4.5 + rnd() * 3, 1),
        i % 2 === 0 ? leafMat : leafMat2
      );
      crown.position.set(tx, 4 + h + 2.5, tz);
      crown.scale.set(1.1, 0.85, 1.1);

      grp.add(trunk, crown);
    }
  }

  _buildLalbagh(grp, L) {
    // Lalbagh Victorian Glass House
    const lawn = new THREE.Mesh(
      new THREE.CylinderGeometry(40, 44, 4, 24),
      new THREE.MeshStandardMaterial({ color: 0x3d8547, roughness: 0.9 })
    );
    lawn.position.y = 2;
    grp.add(lawn);

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xaee6f8,
      roughness: 0.2,
      metalness: 0.5,
      transparent: true,
      opacity: 0.75,
    });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });

    // Cruciform glass palace
    const n1 = new THREE.Mesh(new THREE.BoxGeometry(46, 12, 20), glassMat);
    n1.position.y = 8;
    const n2 = new THREE.Mesh(new THREE.BoxGeometry(20, 12, 46), glassMat);
    n2.position.y = 8;
    grp.add(n1, n2);

    // Arched glass roof
    const roof1 = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 46, 16, 1, false, 0, Math.PI), glassMat);
    roof1.rotation.z = Math.PI / 2;
    roof1.rotation.y = Math.PI / 2;
    roof1.position.set(0, 14, 0);
    grp.add(roof1);

    // Center rotunda dome
    const dome = new THREE.Mesh(new THREE.SphereGeometry(12, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), ironMat);
    dome.position.y = 15;
    grp.add(dome);
  }

  _buildTrafficStation(grp, L) {
    const roadPlaza = new THREE.Mesh(
      new THREE.BoxGeometry(40, 3, 60),
      new THREE.MeshStandardMaterial({ color: 0x383e4a, roughness: 0.85 })
    );
    roadPlaza.position.y = 1.5;
    grp.add(roadPlaza);

    // Traffic signal gantries
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xffc442 });
    const gantry = new THREE.Mesh(new THREE.BoxGeometry(28, 2, 2), poleMat);
    gantry.position.set(0, 18, 0);
    const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 18, 8), poleMat);
    leg1.position.set(-13, 9, 0);
    const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 18, 8), poleMat);
    leg2.position.set(13, 9, 0);
    grp.add(gantry, leg1, leg2);
  }

  _city() {
    const rnd = rand(31415);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const isLight = this.theme === 'light';

    // Varied architectural building palettes
    const matA = new THREE.MeshStandardMaterial({ color: isLight ? 0xf0f3f6 : 0x221a2e, roughness: 0.65 });
    const matB = new THREE.MeshStandardMaterial({ color: isLight ? 0xdeaa88 : 0x2e203c, roughness: 0.8 }); // Terracotta
    const matC = new THREE.MeshStandardMaterial({ color: isLight ? 0x4a94c7 : 0x2a3d5e, metalness: 0.7, roughness: 0.25 }); // Glass tech park

    const n = 280;
    const a = new THREE.InstancedMesh(box, matA, n);
    const b = new THREE.InstancedMesh(box, matB, Math.floor(n * 0.35));
    const c = new THREE.InstancedMesh(box, matC, Math.floor(n * 0.25));

    const m4 = new THREE.Matrix4();
    let bi = 0, ci = 0;

    for (let i = 0; i < n; i++) {
      const x = (rnd() - 0.5) * 940;
      const z = (rnd() - 0.5) * 940;

      // Keep landmarks and main road uncluttered
      if (Math.hypot(x, z) < 48) continue;
      if (Math.abs(x - (-40)) < 36) continue; // 100 Feet Road corridor

      const h = 10 + rnd() * rnd() * 85;
      const w = 12 + rnd() * 22;
      const d = 12 + rnd() * 22;

      m4.makeScale(w, h, d);
      m4.setPosition(x, h / 2, z);
      a.setMatrixAt(i, m4);

      if (rnd() < 0.35 && bi < b.count) b.setMatrixAt(bi++, m4);
      else if (rnd() < 0.25 && ci < c.count) c.setMatrixAt(ci++, m4);
    }

    a.instanceMatrix.needsUpdate = true;
    b.instanceMatrix.needsUpdate = true;
    c.instanceMatrix.needsUpdate = true;
    this.scene.add(a, b, c);
  }

  _traffic() {
    // Dynamic animated vehicles on 100 Feet Road
    this.vehicles = [];
    const autoMat = new THREE.MeshStandardMaterial({ color: 0x36a64f, roughness: 0.5 }); // Green auto body
    const yellowTop = new THREE.MeshStandardMaterial({ color: 0xffd000, roughness: 0.4 }); // Yellow hood
    const busMat = new THREE.MeshStandardMaterial({ color: 0x1f74ba, roughness: 0.5 }); // BMTC blue
    const carMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });

    const nCars = 18;
    for (let i = 0; i < nCars; i++) {
      const isAuto = i % 3 === 0;
      const isBus = i % 5 === 0;
      const lane = i % 2 === 0 ? -46 : -34; // Northbound vs Southbound lane
      const dir = lane < -40 ? 1 : -1;
      const speed = isBus ? 22 : isAuto ? 28 : 36;
      const zStart = (i / nCars) * 1600 - 800;

      const vGroup = new THREE.Group();
      if (isAuto) {
        // Bangalore Auto Rickshaw!
        const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 4.4), autoMat);
        body.position.y = 1.3;
        const hood = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 3.8), yellowTop);
        hood.position.set(0, 2.8, -0.2);
        vGroup.add(body, hood);
      } else if (isBus) {
        // BMTC Bangalore Bus!
        const bus = new THREE.Mesh(new THREE.BoxGeometry(4.4, 4.6, 14), busMat);
        bus.position.y = 2.4;
        vGroup.add(bus);
      } else {
        // City Car
        const car = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2.2, 6.5), carMat);
        car.position.y = 1.2;
        vGroup.add(car);
      }

      vGroup.position.set(lane, 0, zStart);
      this.scene.add(vGroup);
      this.vehicles.push({ group: vGroup, speed: speed * dir, dir, lane });
    }
  }

  _fly() {
    this.fly = new THREE.Group();

    // High detail fly morphology
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x221933,
      emissive: 0x48b6d8,
      emissiveIntensity: 0.35,
      roughness: 0.35,
      metalness: 0.1,
    });

    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xcc1838,
      emissive: 0xff284c,
      emissiveIntensity: 0.7,
      roughness: 0.2,
    });

    // Thorax
    const thorax = new THREE.Mesh(new THREE.SphereGeometry(1.6, 18, 14), bodyMat);
    thorax.scale.set(1, 0.95, 1.2);
    this.fly.add(thorax);

    // Abdomen with subtle stripes
    const abdomen = new THREE.Mesh(new THREE.SphereGeometry(1.95, 18, 14), bodyMat);
    abdomen.position.z = 3.2;
    abdomen.scale.set(0.95, 0.9, 1.65);
    this.fly.add(abdomen);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), bodyMat);
    head.position.z = -1.8;
    this.fly.add(head);

    // Ruby compound eyes
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 10), eyeMat);
    eyeL.position.set(0.65, 0.2, -2.1);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 10), eyeMat);
    eyeR.position.set(-0.65, 0.2, -2.1);
    this.fly.add(eyeL, eyeR);

    // Wings
    const wingMat = new THREE.MeshBasicMaterial({
      color: 0xd6f4ff,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const wg = new THREE.PlaneGeometry(7.2, 2.6);
    wg.translate(3.5, 0, 0);

    this.wingL = new THREE.Mesh(wg, wingMat);
    this.wingR = new THREE.Mesh(wg.clone(), wingMat);
    this.wingR.scale.x = -1;
    this.wingL.position.set(0.4, 0.9, 0.2);
    this.wingR.position.set(-0.4, 0.9, 0.2);
    this.fly.add(this.wingL, this.wingR);

    // Halo glow
    this.flyGlow = new THREE.PointLight(0x6be6ff, 2.4, 70);
    this.fly.add(this.flyGlow);

    this.fly.scale.setScalar(0.75);
    this.scene.add(this.fly);

    // Flight Ribbon / Trail
    const maxTrail = 700;
    this.trailGeo = new THREE.BufferGeometry();
    this.trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxTrail * 3), 3));
    this.trailLine = new THREE.Line(
      this.trailGeo,
      new THREE.LineBasicMaterial({ color: 0x48c4ea, transparent: true, opacity: 0.65 })
    );
    this.scene.add(this.trailLine);
  }

  _bindControls() {
    this.keys = {};
    this.pointerSteer = 0; // -1 to +1 from mouse drag
    this.pointerDown = false;

    window.addEventListener('keydown', (e) => {
      // Don't capture keys when typing in input boxes or textareas
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
      this.keys[e.key.toLowerCase()] = true;
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    // Easy Mouse / Pointer Steering:
    // Click or drag left/right on the 3D sky to steer effortlessly!
    const canvas = this.renderer.domElement;
    const updatePointer = (clientX) => {
      const rect = canvas.getBoundingClientRect();
      const nx = ((clientX - rect.left) / rect.width) * 2 - 1; // -1 (left) to +1 (right)
      if (Math.abs(nx) < 0.1) {
        this.pointerSteer = 0;
      } else {
        this.pointerSteer = (nx - Math.sign(nx) * 0.1) / 0.9;
      }
      this.manualMode = true;
    };

    canvas.addEventListener('pointerdown', (e) => {
      this.pointerDown = true;
      updatePointer(e.clientX);
    });
    window.addEventListener('pointermove', (e) => {
      if (this.pointerDown) updatePointer(e.clientX);
    });
    window.addEventListener('pointerup', () => {
      this.pointerDown = false;
      this.pointerSteer = 0;
    });
  }

  /** Toggle between Autopilot (Brain-driven) and Manual Flight */
  toggleManual() {
    this.manualMode = !this.manualMode;
    return this.manualMode;
  }

  nearest() {
    let best = null;
    let bd = Infinity;
    for (const m of this.marks) {
      const d = this.pos.distanceTo(m.vec);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    return { mark: best, dist: bd };
  }

  bearingTo(key) {
    const m = this.marks.find((x) => x.key === key);
    if (!m) return null;
    return Math.atan2(m.vec.x - this.pos.x, -(m.vec.z - this.pos.z));
  }

  /**
   * Main update tick.
   * Accepts autonomous heading/speed from the connectome, but applies user manual overrides if active!
   */
  update(dt, autoHeading, autoSpeed, highlightKey) {
    this._t += dt;

    // Read manual controls
    const k = this.keys;
    const isW = k['w'] || k['arrowup'];
    const isS = k['s'] || k['arrowdown'];
    const isA = k['a'] || k['arrowleft'];
    const isD = k['d'] || k['arrowright'];
    const isBoost = k[' '] || k['shift'];

    // Auto-detect pilot input: pressing any flight key or intentionally dragging mouse activates manual mode
    const isMouseSteering = this.pointerDown && Math.abs(this.pointerSteer) > 0.15;
    if (isW || isS || isA || isD || isBoost || isMouseSteering) {
      this.manualMode = true;
    }

    let targetSpeed = autoSpeed;

    if (this.manualMode) {
      // Natural, Non-Inverted Steering:
      // A / ArrowLeft / Mouse Left  -> Turns LEFT  (decreases heading)
      // D / ArrowRight / Mouse Right -> Turns RIGHT (increases heading)
      let steerInput = 0;
      if (isA) steerInput -= 1;
      if (isD) steerInput += 1;
      if (this.pointerDown && this.pointerSteer !== 0) {
        steerInput = Math.max(-1, Math.min(1, steerInput + this.pointerSteer));
      }

      const yawRate = steerInput * 2.4; // rad/s (~140 deg/s)
      this.heading += yawRate * dt;

      // Natural banking roll into the turn:
      // Turn left (steerInput < 0)  -> bank left (-0.45 rad)
      // Turn right (steerInput > 0) -> bank right (+0.45 rad)
      const targetRoll = steerInput * 0.45;
      this.roll = THREE.MathUtils.lerp(this.roll, targetRoll, dt * 7);

      // Simple, intuitive Altitude:
      // W or Up Arrow   -> Climb gently (+18 m/s) and accelerate
      // S or Down Arrow -> Descend gently (-20 m/s) and brake
      let targetPitch = 0;
      if (isW) {
        targetPitch = 0.12;
        this.altitude += 20 * dt;
      }
      if (isS) {
        targetPitch = -0.12;
        this.altitude -= 22 * dt;
      }
      this.pitch = THREE.MathUtils.lerp(this.pitch, targetPitch, dt * 6);
      this.altitude = Math.max(25, Math.min(220, this.altitude));

      // Speed & Boost
      this.boost = isBoost || (isW && !isS);
      targetSpeed = this.boost ? 75 : (isS ? 28 : 46);
    } else {
      // Autopilot: Critically-damped aerodynamic turn towards autoHeading (no instant snapping/shaking!)
      const dHeading = ((autoHeading - this.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      const maxTurn = 2.6 * dt; // Natural turn rate limit ~150 deg/s
      const turnStep = Math.max(-maxTurn, Math.min(maxTurn, dHeading * 3.6 * dt));
      this.heading += turnStep;

      // Silky-smooth banking roll proportional to turning speed
      const targetRoll = Math.max(-0.45, Math.min(0.45, (turnStep / Math.max(0.001, dt)) * 0.16));
      this.roll = THREE.MathUtils.lerp(this.roll, targetRoll, dt * 6);

      // Stable cruising altitude
      this.altitude = THREE.MathUtils.lerp(this.altitude, 86, dt * 2.5);
      this.pitch = THREE.MathUtils.lerp(this.pitch, 0, dt * 5);
      this.boost = false;
    }

    this.speed = THREE.MathUtils.lerp(this.speed, targetSpeed, dt * 4);

    // Compute velocity along heading vector
    const v = new THREE.Vector3(Math.sin(this.heading), 0, -Math.cos(this.heading)).multiplyScalar(this.speed * dt);
    this.pos.add(v);
    this.pos.y = THREE.MathUtils.lerp(this.pos.y, this.altitude, dt * 5);

    // Gentle boundary leash keeping fly within Bangalore airspace
    const lim = 420;
    const r = Math.hypot(this.pos.x, this.pos.z);
    if (r > lim) {
      const pull = Math.min(1, (r - lim) / 120) * this.speed * dt;
      this.pos.x -= (this.pos.x / r) * pull;
      this.pos.z -= (this.pos.z / r) * pull;
    }

    // Orient fly model
    this.fly.position.copy(this.pos);
    this.fly.rotation.y = this.heading;
    this.fly.rotation.z = this.roll;
    this.fly.rotation.x = this.pitch;

    // Wing flap frequency
    const flapFreq = this.boost ? 72 : 44;
    const flap = Math.sin(this._t * flapFreq) * 0.95;
    this.wingL.rotation.z = flap;
    this.wingR.rotation.z = -flap;

    // Update trail
    this.trail.push(this.pos.clone());
    if (this.trail.length > 700) this.trail.shift();
    const arr = this.trailGeo.attributes.position.array;
    for (let i = 0; i < this.trail.length; i++) {
      arr[i * 3] = this.trail[i].x;
      arr[i * 3 + 1] = this.trail[i].y;
      arr[i * 3 + 2] = this.trail[i].z;
    }
    this.trailGeo.setDrawRange(0, this.trail.length);
    this.trailGeo.attributes.position.needsUpdate = true;

    // Update traffic animation
    if (this.vehicles) {
      for (const v of this.vehicles) {
        v.group.position.z += v.speed * dt;
        if (v.group.position.z > 800) v.group.position.z = -800;
        if (v.group.position.z < -800) v.group.position.z = 800;
      }
    }

    // Drifting clouds
    if (this.clouds) {
      this.clouds.position.x = Math.sin(this._t * 0.02) * 40;
    }

    // Landmark halos & distance scaling
    for (const m of this.marks) {
      const on = m.key === highlightKey;
      m.halo.material.opacity = on ? 0.6 + Math.sin(this._t * 5) * 0.25 : 0.25;
      m.halo.scale.setScalar(on ? 1.35 + Math.sin(this._t * 5) * 0.12 : 1);
      m.beam.material.opacity = on ? 0.45 : (m.home ? 0.3 : 0.18);

      const d = this.pos.distanceTo(m.vec);
      const ph = Math.max(6.5, this.camera.position.distanceTo(m.vec) * 0.046);
      m.plate.scale.set(ph * 4, ph, 1);
    }

    // Dynamic Chase Camera with continuous altitude damping and Steadicam lookAt
    const backDist = this.boost ? 84 : 70;
    const upDist = 24 + Math.max(0, (this.pos.y - 80) * 0.08);
    const back = new THREE.Vector3(-Math.sin(this.heading), 0, Math.cos(this.heading)).multiplyScalar(backDist);
    const wantCam = this.pos.clone().add(back).add(new THREE.Vector3(0, upDist, 0));

    this.camera.position.lerp(wantCam, 1 - Math.pow(0.001, dt));

    // Smooth Steadicam look-at target filtering out any angular vibration
    const rawLookTarget = this.pos.clone().add(new THREE.Vector3(Math.sin(this.heading) * 20, -10, -Math.cos(this.heading) * 20));
    if (!this._camLook) this._camLook = rawLookTarget.clone();
    this._camLook.lerp(rawLookTarget, 1 - Math.pow(0.0002, dt));
    this.camera.lookAt(this._camLook);
  }

  enterHome(done) {
    this.frozen = true;
    const home = this.marks.find((m) => m.home);
    const target = home
      ? new THREE.Vector3(home.vec.x, 26, home.vec.z + 42)
      : new THREE.Vector3(0, 26, 42);
    const look = home ? new THREE.Vector3(home.vec.x, 22, home.vec.z) : new THREE.Vector3(0, 22, 0);
    const from = this.camera.position.clone();
    const t0 = performance.now();
    const dur = 1100;

    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      this.camera.position.lerpVectors(from, target, e);
      this.camera.lookAt(look);
      this.render();
      if (t < 1) requestAnimationFrame(step);
      else if (done) done();
    };
    requestAnimationFrame(step);
  }

  /**
   * Cinematic takeoff from 2586Labs rooftop perch out into the Bangalore sky.
   */
  exitHome(done) {
    this.frozen = true;
    const home = this.marks.find((m) => m.home);
    const homeVec = home ? home.vec : new THREE.Vector3(0, 14, 0);

    // Position fly on the rooftop perch ready for launch
    this.pos.set(homeVec.x, 34, homeVec.z + 6);
    this.heading = 0; // facing south along 100 Feet Road
    this.pitch = -0.15; // nose up ready for climb
    this.roll = 0;
    this.speed = 12;
    this.altitude = 34;
    this.trail = [];

    // Camera starts framed right at the rooftop perch watching Nona lift off
    const camStart = new THREE.Vector3(homeVec.x - 8, 36, homeVec.z + 32);
    const camEnd = new THREE.Vector3(homeVec.x, 72, homeVec.z + 80);
    this.camera.position.copy(camStart);
    this.camera.lookAt(this.pos);

    const t0 = performance.now();
    const dur = 1400; // 1.4s smooth takeoff

    const step = () => {
      const now = performance.now();
      const dt = 0.016;
      const t = Math.min(1, (now - t0) / dur);
      const e = t * t * (3 - 2 * t); // smoothstep ease

      // Fly accelerates and lifts off
      this.speed = THREE.MathUtils.lerp(12, 54, e);
      this.altitude = THREE.MathUtils.lerp(34, 88, e);
      this.pos.z += this.speed * dt * 0.85;
      this.pos.y = this.altitude;

      // Dynamic wing flutter during launch
      const flap = Math.sin(now * 0.06) * 0.95;
      this.wingL.rotation.z = flap;
      this.wingR.rotation.z = -flap;

      this.fly.position.copy(this.pos);
      this.fly.rotation.y = this.heading;
      this.fly.rotation.x = THREE.MathUtils.lerp(-0.25, 0, e);

      // Camera smoothly tracks from the rooftop out into the wide chase position
      this.camera.position.lerpVectors(camStart, camEnd, e);
      this.camera.lookAt(this.pos.x, this.pos.y - 12, this.pos.z);
      this.render();

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        this.frozen = false;
        if (done) done();
      }
    };
    requestAnimationFrame(step);
  }

  resize(w, h) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
