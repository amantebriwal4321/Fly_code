/**
 * Bangalore GPS Navigation Map — realistic vector cartography with Live Bengaluru Traffic
 *
 * Renders Indiranagar + authentic Bengaluru geography:
 * - Ulsoor Lake (ಹಲಸೂರು ಕೆರೆ) with animated water ripples
 * - Cubbon Park (ಕಬ್ಬನ್ ಪಾರ್ಕ್) with lush tree canopy & Central Library
 * - Lalbagh Botanical Gardens (ಲಾಲ್ ಬಾಗ್) with Glasshouse & lotus lake
 * - Chinnaswamy Stadium (ಚಿನ್ನಸ್ವಾಮಿ ಕ್ರೀಡಾಂಗಣ) cricket pitch
 * - Indiranagar numbered cross-streets grid & 12th Main cafe strip
 * - Namma Metro Purple Line (ನಮ್ಮ ಮೆಟ್ರೋ ನೇರಳೆ ಮಾರ್ಗ) with animated 3-car metro train
 * - Namma Metro Green Line interchange at Majestic (ಮೆಜೆಸ್ಟಿಕ್)
 * - Major arterials: 100 Feet Road, CMH Road, Old Airport Road, MG Road, Brigade Road, Outer Ring Road
 * - Live dynamic Bengaluru traffic simulation:
 *   * Auto-rickshaws (vibrant yellow-green nimble autos darting between lanes)
 *   * BMTC Buses (royal blue & white public transport buses)
 *   * Tech park cabs & private cars
 *   * Pulsing Silk Board Junction traffic bottleneck with 45-min delay crawl
 *   * Live traffic flow heatmap overlays (green free flow, amber moderate, red gridlock)
 * - Dual Kannada & English signage throughout
 * - 2586Labs HQ beacon, Vidhana Soudha, UB City
 * - Flight trail, Central Complex EPG heading cone, live navigation vector
 */

export class TacticalMap {
  constructor(options = {}) {
    this.canvas = options.canvas;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.landmarks = options.landmarks || [];
    this.getFlyState = options.getFlyState || (() => ({
      pos: { x: 0, y: 88, z: 0 },
      heading: 0, theta: 0, strength: 0.4,
      trail: [], speed: 42, goal: null, valences: {},
    }));
    this.onSelectLandmark = options.onSelectLandmark || (() => {});
    this.onSelectWaypoint = options.onSelectWaypoint || (() => {});

    this.mode = options.mode || 'north-up';
    this.zoom = options.zoom || 1.0;
    this.centerOnFly = options.centerOnFly !== undefined ? options.centerOnFly : true;
    this.showTrail = true;
    this.showRoads = true;
    this.showLandmarks = true;
    this.showTraffic = true;
    this.showHeatmap = true;

    this.sweepAngle = 0;
    this.pingPhase = 0;
    this.navPulse = 0;
    this.waterPhase = 0;
    this.hoveredLandmark = null;
    this.customWaypoint = null;

    // Bangalore dynamic simulation state
    this.trafficVehicles = this._initTrafficVehicles();
    this.metroState = {
      progress: 0.22, // 0..1 along purple line
      dwellTimer: 0,
      currentStation: 'Indiranagar',
    };

    this._bindEvents();
  }

  setZoom(delta) {
    this.zoom = Math.round(Math.max(0.5, Math.min(2.8, this.zoom + delta)) * 10) / 10;
    return this.zoom;
  }

  toggleMode() {
    this.mode = this.mode === 'north-up' ? 'heading-up' : 'north-up';
    return this.mode;
  }

  toggleTraffic() {
    this.showTraffic = !this.showTraffic;
    return this.showTraffic;
  }

  toggleHeatmap() {
    this.showHeatmap = !this.showHeatmap;
    return this.showHeatmap;
  }

  _bindEvents() {
    if (!this.canvas) return;
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const hovered = this._hitTest(e.clientX - rect.left, e.clientY - rect.top);
      if (hovered !== this.hoveredLandmark) {
        this.hoveredLandmark = hovered;
        this.canvas.style.cursor = hovered ? 'pointer' : 'crosshair';
      }
    });
    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredLandmark = null;
      this.canvas.style.cursor = 'default';
    });
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const hit = this._hitTest(mx, my);
      if (hit) {
        this.customWaypoint = null;
        this.onSelectLandmark(hit.key);
      } else {
        const wCoord = this._screenToWorld(mx, my);
        if (wCoord) {
          this.customWaypoint = wCoord;
          this.onSelectWaypoint(wCoord.x, wCoord.z);
        }
      }
    });
  }

  _worldToScreen(wx, wz, cx, cy, scale, headingOffset = 0) {
    let dx = wx, dz = wz;
    if (this.centerOnFly) {
      const fly = this.getFlyState();
      dx = wx - fly.pos.x;
      dz = wz - fly.pos.z;
    }
    if (headingOffset !== 0) {
      const cos = Math.cos(headingOffset), sin = Math.sin(headingOffset);
      const rx = dx * cos - dz * sin, rz = dx * sin + dz * cos;
      dx = rx; dz = rz;
    }
    return { x: cx + dx * scale, y: cy + dz * scale };
  }

  _screenToWorld(sx, sy) {
    const w = this.canvas.width, h = this.canvas.height;
    const cx = w / 2, cy = h / 2;
    const scale = (Math.min(w, h) * 0.44 * this.zoom) / 460;
    const fly = this.getFlyState();
    const ho = this.mode === 'heading-up' ? fly.heading : 0;
    let dx = (sx - cx) / scale, dz = (sy - cy) / scale;
    if (ho !== 0) {
      const cos = Math.cos(-ho), sin = Math.sin(-ho);
      const rx = dx * cos - dz * sin, rz = dx * sin + dz * cos;
      dx = rx; dz = rz;
    }
    return this.centerOnFly ? { x: dx + fly.pos.x, z: dz + fly.pos.z } : { x: dx, z: dz };
  }

  _hitTest(sx, sy) {
    const w = this.canvas.width, h = this.canvas.height;
    const cx = w / 2, cy = h / 2;
    const scale = (Math.min(w, h) * 0.44 * this.zoom) / 460;
    const fly = this.getFlyState();
    const ho = this.mode === 'heading-up' ? fly.heading : 0;
    for (const L of this.landmarks) {
      const sp = this._worldToScreen(L.pos[0], L.pos[2], cx, cy, scale, ho);
      if (Math.hypot(sx - sp.x, sy - sp.y) < 22) return L;
    }
    // Silk Board bottleneck hotspot
    const sb = this._worldToScreen(0, 300, cx, cy, scale, ho);
    if (Math.hypot(sx - sb.x, sy - sb.y) < 24) {
      return { key: 'traffic', label: 'Silk Board Jam', sub: 'Bengaluru bottleneck (45m delay)' };
    }
    return null;
  }

  _poly(ctx, pts, cx, cy, scale, ho) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const sp = this._worldToScreen(pts[i][0], pts[i][1], cx, cy, scale, ho);
      i === 0 ? ctx.moveTo(sp.x, sp.y) : ctx.lineTo(sp.x, sp.y);
    }
    ctx.closePath();
  }

  _road(ctx, pts, cx, cy, scale, ho, width, color) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const sp = this._worldToScreen(pts[i][0], pts[i][1], cx, cy, scale, ho);
      i === 0 ? ctx.moveTo(sp.x, sp.y) : ctx.lineTo(sp.x, sp.y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  // =========================================================================
  // BENGALURU TRAFFIC SIMULATION ENGINE
  // =========================================================================
  _initTrafficVehicles() {
    const list = [];
    let id = 0;

    // 1. 100 Feet Road (Indiranagar North-South spine: x = -40, z = -380 to +380)
    const n100 = 22;
    for (let i = 0; i < n100; i++) {
      const isNorth = i % 2 === 0;
      const laneX = isNorth ? -43 : -37;
      const dir = isNorth ? -1 : 1;
      const type = i % 3 === 0 ? 'auto' : i % 5 === 0 ? 'bus' : i % 4 === 0 ? 'bike' : 'car';
      const speed = type === 'bus' ? 22 : type === 'auto' ? 28 : type === 'bike' ? 36 : 32;
      list.push({
        id: ++id,
        route: '100ft',
        x: laneX,
        z: -380 + (i / n100) * 760,
        laneX,
        dir,
        speed: speed * (0.85 + Math.random() * 0.3),
        type,
        heading: dir > 0 ? 0 : Math.PI,
        wobble: Math.random() * Math.PI * 2,
      });
    }

    // 2. CMH Road (Indiranagar East-West: z = -160, x = -320 to 220)
    const nCMH = 14;
    for (let i = 0; i < nCMH; i++) {
      const isEast = i % 2 === 0;
      const laneZ = isEast ? -158 : -162;
      const dir = isEast ? 1 : -1;
      const type = i % 3 === 0 ? 'auto' : i % 4 === 0 ? 'bus' : 'car';
      const speed = type === 'bus' ? 20 : type === 'auto' ? 26 : 30;
      list.push({
        id: ++id,
        route: 'cmh',
        x: -320 + (i / nCMH) * 540,
        z: laneZ,
        laneZ,
        dir,
        speed: speed * (0.85 + Math.random() * 0.3),
        type,
        heading: dir > 0 ? Math.PI / 2 : -Math.PI / 2,
        wobble: Math.random() * Math.PI * 2,
      });
    }

    // 3. Old Airport Road (East-West: z = 160, x = -320 to 280)
    const nOAR = 12;
    for (let i = 0; i < nOAR; i++) {
      const isEast = i % 2 === 0;
      const laneZ = isEast ? 162 : 158;
      const dir = isEast ? 1 : -1;
      const type = i % 3 === 0 ? 'bus' : i % 4 === 0 ? 'auto' : 'car';
      const speed = type === 'bus' ? 25 : 34;
      list.push({
        id: ++id,
        route: 'oar',
        x: -320 + (i / nOAR) * 600,
        z: laneZ,
        laneZ,
        dir,
        speed: speed * (0.85 + Math.random() * 0.3),
        type,
        heading: dir > 0 ? Math.PI / 2 : -Math.PI / 2,
        wobble: Math.random() * Math.PI * 2,
      });
    }

    // 4. MG Road (Diagonal: [-250, -200] to [-80, -95])
    const nMG = 10;
    for (let i = 0; i < nMG; i++) {
      const dir = i % 2 === 0 ? 1 : -1;
      const type = i % 2 === 0 ? 'auto' : 'car';
      list.push({
        id: ++id,
        route: 'mg',
        t: i / nMG,
        dir,
        speed: 0.05 * (0.85 + Math.random() * 0.3),
        type,
        heading: dir > 0 ? 0.56 : 0.56 + Math.PI,
        wobble: Math.random() * Math.PI * 2,
      });
    }

    // 5. Outer Ring Road (Curved Highway)
    const nORR = 12;
    for (let i = 0; i < nORR; i++) {
      list.push({
        id: ++id,
        route: 'orr',
        t: i / nORR,
        dir: i % 2 === 0 ? 1 : -1,
        speed: 0.06 * (0.9 + Math.random() * 0.25),
        type: i % 4 === 0 ? 'bus' : i % 3 === 0 ? 'auto' : 'car',
        heading: 0,
        wobble: Math.random() * Math.PI * 2,
      });
    }

    // 6. Silk Board & Hosur Road (Legendary traffic bottleneck: z = 130 to 420)
    const nSilk = 16;
    for (let i = 0; i < nSilk; i++) {
      const isSouth = i % 2 === 0;
      const dir = isSouth ? 1 : -1;
      const type = i % 2 === 0 ? 'auto' : i % 3 === 0 ? 'bus' : 'car';
      list.push({
        id: ++id,
        route: 'silk_board',
        x: isSouth ? 4 : -4,
        z: 130 + (i / nSilk) * 280,
        dir,
        speed: 7 * (0.8 + Math.random() * 0.4), // Crawl at 7 km/h!
        type,
        heading: dir > 0 ? 0 : Math.PI,
        wobble: Math.random() * Math.PI * 2,
      });
    }

    return list;
  }

  _updateTraffic(dt) {
    for (const v of this.trafficVehicles) {
      v.wobble = (v.wobble + dt * 3) % (Math.PI * 2);

      if (v.route === '100ft') {
        // Slow down near 100ft / CMH junction (z ~ -160) and 100ft / OAR (z ~ 160)
        let curSpeed = v.speed;
        if (Math.abs(v.z - (-160)) < 40 || Math.abs(v.z - 160) < 40) curSpeed *= 0.6;
        v.z += v.dir * curSpeed * dt;
        if (v.z > 380) v.z = -380;
        if (v.z < -380) v.z = 380;
        // Autos weave playfully
        if (v.type === 'auto') v.x = v.laneX + Math.sin(v.wobble) * 1.2;
        v.heading = v.dir > 0 ? 0 : Math.PI;

      } else if (v.route === 'cmh') {
        v.x += v.dir * v.speed * dt;
        if (v.x > 220) v.x = -320;
        if (v.x < -320) v.x = 220;
        if (v.type === 'auto') v.z = v.laneZ + Math.sin(v.wobble) * 1.0;
        v.heading = v.dir > 0 ? Math.PI / 2 : -Math.PI / 2;

      } else if (v.route === 'oar') {
        v.x += v.dir * v.speed * dt;
        if (v.x > 280) v.x = -320;
        if (v.x < -320) v.x = 280;
        if (v.type === 'auto') v.z = v.laneZ + Math.sin(v.wobble) * 1.0;
        v.heading = v.dir > 0 ? Math.PI / 2 : -Math.PI / 2;

      } else if (v.route === 'mg') {
        v.t += v.dir * v.speed * dt;
        if (v.t > 1) v.t = 0;
        if (v.t < 0) v.t = 1;
        const p1 = [-250, -200], p2 = [-80, -95];
        v.x = p1[0] + (p2[0] - p1[0]) * v.t;
        v.z = p1[1] + (p2[1] - p1[1]) * v.t;
        v.heading = v.dir > 0 ? 0.56 : 0.56 + Math.PI;

      } else if (v.route === 'orr') {
        v.t += v.dir * v.speed * dt;
        if (v.t > 1) v.t = 0;
        if (v.t < 0) v.t = 1;
        // 4-point bezier/polyline curve
        const pts = [[-350, -300], [-200, -320], [0, -300], [200, -250], [300, -150]];
        const idx = Math.min(pts.length - 2, Math.floor(v.t * (pts.length - 1)));
        const frac = (v.t * (pts.length - 1)) - idx;
        const pA = pts[idx], pB = pts[idx + 1];
        v.x = pA[0] + (pB[0] - pA[0]) * frac;
        v.z = pA[1] + (pB[1] - pA[1]) * frac;
        v.heading = Math.atan2(pB[0] - pA[0], pB[1] - pA[1]);
        if (v.dir < 0) v.heading += Math.PI;

      } else if (v.route === 'silk_board') {
        // Severe bottleneck compression near z = 300
        const distToJunction = Math.abs(v.z - 300);
        const bottleneckFactor = Math.max(0.25, Math.min(1.0, distToJunction / 70));
        v.z += v.dir * v.speed * bottleneckFactor * dt;
        if (v.z > 420) v.z = 130;
        if (v.z < 130) v.z = 420;
        v.heading = v.dir > 0 ? 0 : Math.PI;
      }
    }
  }

  _updateMetro(dt) {
    if (this.metroState.dwellTimer > 0) {
      this.metroState.dwellTimer -= dt;
      return;
    }
    // Progress along Purple Line
    this.metroState.progress = (this.metroState.progress + dt * 0.045) % 1.0;

    // Check station dwells (near Indiranagar = ~0.22, MG Road = ~0.60)
    if (Math.abs(this.metroState.progress - 0.22) < 0.008 && !this.metroState.dwelledInd) {
      this.metroState.dwellTimer = 1.8;
      this.metroState.dwelledInd = true;
      this.metroState.currentStation = 'Indiranagar (ಇಂದಿರಾನಗರ)';
    } else if (Math.abs(this.metroState.progress - 0.60) < 0.008 && !this.metroState.dwelledMG) {
      this.metroState.dwellTimer = 1.8;
      this.metroState.dwelledMG = true;
      this.metroState.currentStation = 'MG Road (ಎಂ.ಜಿ. ರಸ್ತೆ)';
    } else {
      if (Math.abs(this.metroState.progress - 0.22) > 0.05) this.metroState.dwelledInd = false;
      if (Math.abs(this.metroState.progress - 0.60) > 0.05) this.metroState.dwelledMG = false;
    }
  }

  // =========================================================================
  // MAIN RENDER LOOP
  // =========================================================================
  render(dt = 0.016) {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;

    const w = canvas.width, h = canvas.height;
    if (!(w > 0) || !(h > 0)) return;
    const cx = w / 2, cy = h / 2;
    const rMax = Math.min(w, h) * 0.46;
    const scale = (rMax * this.zoom) / 460;

    this.sweepAngle = (this.sweepAngle + dt * 1.2) % (Math.PI * 2);
    this.pingPhase = (this.pingPhase + dt * 2.5) % 1;
    this.navPulse = (this.navPulse + dt * 3.0) % 1;
    this.waterPhase = (this.waterPhase + dt * 1.8) % (Math.PI * 2);

    this._updateTraffic(dt);
    this._updateMetro(dt);

    const fly = this.getFlyState();
    const ho = this.mode === 'heading-up' ? fly.heading : 0;

    // 1. Background — warm cartographic parchment
    ctx.fillStyle = '#f2ede4';
    ctx.fillRect(0, 0, w, h);

    // 2. Terrain & roads
    if (this.showRoads) {
      this._drawTerrain(ctx, cx, cy, scale, ho);
      this._drawRoads(ctx, cx, cy, scale, ho);
      if (this.showHeatmap) {
        this._drawTrafficHeatmap(ctx, cx, cy, scale, ho);
      }
      this._drawMetro(ctx, cx, cy, scale, ho);
      if (this.showTraffic) {
        this._drawTrafficVehicles(ctx, cx, cy, scale, ho);
      }
    }

    // 3. Flight trail
    if (this.showTrail && fly.trail && fly.trail.length > 1) {
      this._drawFlightTrail(ctx, cx, cy, scale, ho, fly.trail);
    }

    // 4. Navigation vector
    this._drawNavVector(ctx, cx, cy, scale, ho, fly);

    // 5. Landmarks with Kannada & English
    if (this.showLandmarks) {
      this._drawLandmarks(ctx, cx, cy, scale, ho, fly);
    }

    // 6. Fly marker + heading cone
    this._drawFly(ctx, cx, cy, scale, ho, fly);

    // 7. Scale bar & compass
    this._drawScaleBar(ctx, w, h, scale);
    this._drawCompass(ctx, w, h, ho);

    // 8. Authentic Bengaluru Airspace & Traffic HUD
    this._drawHUD(ctx, w, h, fly);
  }

  // =========================================================================
  // MAP CARTOGRAPHY & GEOGRAPHY
  // =========================================================================
  _drawTerrain(ctx, cx, cy, scale, ho) {
    // --- Ulsoor Lake (ಹಲಸೂರು ಕೆರೆ) ---
    const ulsoor = [
      [80, -80], [100, -110], [140, -120], [180, -105],
      [200, -80], [190, -55], [160, -40], [120, -45], [90, -55],
    ];
    this._poly(ctx, ulsoor, cx, cy, scale, ho);
    ctx.fillStyle = '#9cd3e8';
    ctx.fill();
    ctx.strokeStyle = '#6ebed4';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Animated water shimmer ripples
    const ulCenter = this._worldToScreen(140, -80, cx, cy, scale, ho);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.arc(ulCenter.x, ulCenter.y, 14 * scale + Math.sin(this.waterPhase) * 3, 0, Math.PI * 2);
    ctx.stroke();

    // Ulsoor Lake Bilingual Label
    const ulLabel = this._worldToScreen(140, -78, cx, cy, scale, ho);
    ctx.font = `italic 600 ${Math.max(7, 8.5 * scale)}px "Georgia", serif`;
    ctx.fillStyle = '#2c7a90';
    ctx.textAlign = 'center';
    ctx.fillText('Ulsoor Lake · ಹಲಸೂರು ಕೆರೆ', ulLabel.x, ulLabel.y);

    // --- Cubbon Park (ಕಬ್ಬನ್ ಪಾರ್ಕ್) ---
    const cubbon = [
      [-170, -130], [-90, -130], [-90, -95], [-130, -95],
      [-130, -50], [-170, -50],
    ];
    this._poly(ctx, cubbon, cx, cy, scale, ho);
    ctx.fillStyle = '#c5e8bc';
    ctx.fill();
    ctx.strokeStyle = '#85ba7b';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Tree grove clusters inside Cubbon Park
    ctx.fillStyle = '#659c58';
    const treeSeed = [
      [-155, -115], [-140, -105], [-125, -120], [-110, -115],
      [-160, -75], [-145, -65], [-155, -90], [-135, -80],
    ];
    for (const t of treeSeed) {
      const tp = this._worldToScreen(t[0], t[1], cx, cy, scale, ho);
      ctx.beginPath();
      ctx.arc(tp.x, tp.y, 2.8 * scale + 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cubbon Park Bilingual Tag
    const cbLabel = this._worldToScreen(-130, -110, cx, cy, scale, ho);
    ctx.font = `italic 600 ${Math.max(6.5, 8 * scale)}px "Georgia", serif`;
    ctx.fillStyle = '#3a7530';
    ctx.fillText('Cubbon Park · ಕಬ್ಬನ್ ಪಾರ್ಕ್', cbLabel.x, cbLabel.y);

    // --- M. Chinnaswamy Cricket Stadium (ಚಿನ್ನಸ್ವಾಮಿ ಕ್ರೀಡಾಂಗಣ) ---
    const stadiumSp = this._worldToScreen(-85, -145, cx, cy, scale, ho);
    ctx.beginPath();
    ctx.ellipse(stadiumSp.x, stadiumSp.y, 18 * scale, 14 * scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#d4edda';
    ctx.fill();
    ctx.strokeStyle = '#7bc676';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // Pitch oval
    ctx.fillStyle = '#d7b377';
    ctx.fillRect(stadiumSp.x - 2, stadiumSp.y - 4 * scale, 4, 8 * scale);
    if (this.zoom >= 0.8) {
      ctx.font = `500 ${Math.max(5.5, 6.5 * scale)}px system-ui`;
      ctx.fillStyle = '#2f6828';
      ctx.fillText('Chinnaswamy Stadium', stadiumSp.x, stadiumSp.y - 14 * scale);
    }

    // --- Lalbagh Botanical Gardens (ಲಾಲ್ ಬಾಗ್) ---
    const lb = this._worldToScreen(150, 120, cx, cy, scale, ho);
    const lbRx = 55 * scale, lbRy = 42 * scale;
    ctx.beginPath();
    ctx.ellipse(lb.x, lb.y, lbRx, lbRy, 0.15, 0, Math.PI * 2);
    ctx.fillStyle = '#c2dfb6';
    ctx.fill();
    ctx.strokeStyle = '#88b87a';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Lalbagh Lake & Lotus pond inside
    const llk = this._worldToScreen(140, 140, cx, cy, scale, ho);
    ctx.beginPath();
    ctx.ellipse(llk.x, llk.y, 22 * scale, 13 * scale, 0.25, 0, Math.PI * 2);
    ctx.fillStyle = '#9cd3e8';
    ctx.fill();

    // Iconic Glasshouse (ಗಾಜಿನ ಮನೆ) marker
    const gh = this._worldToScreen(155, 110, cx, cy, scale, ho);
    ctx.beginPath();
    ctx.arc(gh.x, gh.y, 3.5 * scale + 1, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.0;
    ctx.fill();
    ctx.stroke();

    // Lalbagh Bilingual Tag
    ctx.font = `italic 600 ${Math.max(6.5, 8 * scale)}px "Georgia", serif`;
    ctx.fillStyle = '#3f7335';
    ctx.fillText('Lalbagh · ಲಾಲ್ ಬಾಗ್', lb.x, lb.y - 20 * scale);

    // --- Vidhana Soudha grounds (ವಿಧಾನ ಸೌಧ) ---
    const vs = [
      [-100, -210], [-40, -210], [-40, -170], [-100, -170],
    ];
    this._poly(ctx, vs, cx, cy, scale, ho);
    ctx.fillStyle = '#e8e2d5';
    ctx.fill();
    ctx.strokeStyle = '#c0b49e';
    ctx.lineWidth = 1;
    ctx.stroke();

    // --- UB City Block (ಯುಬಿ ಸಿಟಿ) ---
    const ub = [
      [75, -170], [115, -170], [115, -130], [75, -130],
    ];
    this._poly(ctx, ub, cx, cy, scale, ho);
    ctx.fillStyle = '#e2dfd8';
    ctx.fill();
    ctx.strokeStyle = '#bfb8ab';
    ctx.lineWidth = 1;
    ctx.stroke();

    // --- Indiranagar Modern Residential Blocks Grid ---
    const blocks = [
      [[-30, -60], [20, -60], [20, -20], [-30, -20]],
      [[25, -60], [70, -60], [70, -20], [25, -20]],
      [[-30, 20], [20, 20], [20, 60], [-30, 60]],
      [[25, 20], [70, 20], [70, 60], [25, 60]],
      [[-30, 70], [20, 70], [20, 110], [-30, 110]],
      // Domlur (ದೊಮ್ಮಲೂರು)
      [[-110, -30], [-70, -30], [-70, 10], [-110, 10]],
      [[-110, 20], [-70, 20], [-70, 60], [-110, 60]],
      // Koramangala (ಕೋರಮಂಗಲ)
      [[30, 160], [90, 160], [90, 210], [30, 210]],
      [[-30, 160], [20, 160], [20, 210], [-30, 210]],
      // HAL Airport area
      [[100, -30], [160, -30], [160, 20], [100, 20]],
      [[100, 30], [160, 30], [160, 80], [100, 80]],
    ];
    ctx.fillStyle = '#eae5db';
    ctx.strokeStyle = '#d7d0c4';
    ctx.lineWidth = 0.6;
    for (const blk of blocks) {
      this._poly(ctx, blk, cx, cy, scale, ho);
      ctx.fill();
      ctx.stroke();
    }
  }

  _drawRoads(ctx, cx, cy, scale, ho) {
    const major = Math.max(3.2, 5.0 * scale);
    const arterial = Math.max(2.2, 3.8 * scale);
    const local = Math.max(1.0, 1.8 * scale);

    // --- Major Highways & Arterial Roads ---

    // 100 Feet Road (Indiranagar North-South Commercial Spine)
    this._road(ctx, [[-40, -380], [-40, 380]], cx, cy, scale, ho, major + 2, '#d4cbb8'); // Casing
    this._road(ctx, [[-40, -380], [-40, 380]], cx, cy, scale, ho, major, '#ffffff'); // Asphalt

    // CMH Road (East-West Indiranagar)
    this._road(ctx, [[-320, -160], [220, -160]], cx, cy, scale, ho, major + 1.5, '#d4cbb8');
    this._road(ctx, [[-320, -160], [220, -160]], cx, cy, scale, ho, major, '#ffffff');

    // Old Airport Road (East-West HAL corridor)
    this._road(ctx, [[-320, 160], [280, 160]], cx, cy, scale, ho, major + 1.5, '#d4cbb8');
    this._road(ctx, [[-320, 160], [280, 160]], cx, cy, scale, ho, major, '#ffffff');

    // MG Road (Diagonal northwest)
    this._road(ctx, [[-250, -200], [-80, -95]], cx, cy, scale, ho, major + 1.5, '#d4cbb8');
    this._road(ctx, [[-250, -200], [-80, -95]], cx, cy, scale, ho, major, '#ffffff');

    // Brigade Road (South from MG Road)
    this._road(ctx, [[-160, -150], [-130, -50]], cx, cy, scale, ho, arterial, '#ffffff');

    // Outer Ring Road (ORR curved bypass)
    const orrPts = [[-350, -300], [-200, -320], [0, -300], [200, -250], [300, -150]];
    this._road(ctx, orrPts, cx, cy, scale, ho, major + 2, '#eab308');
    this._road(ctx, orrPts, cx, cy, scale, ho, major, '#fef08a');

    // HAL Airport Road East
    this._road(ctx, [[60, 0], [120, -10], [200, -20], [300, -30]], cx, cy, scale, ho, arterial, '#ffffff');

    // Hosur Road to Silk Board Junction (South)
    const hosurPts = [[-60, 130], [-30, 200], [0, 300], [20, 420]];
    this._road(ctx, hosurPts, cx, cy, scale, ho, major + 2, '#d4cbb8');
    this._road(ctx, hosurPts, cx, cy, scale, ho, major, '#ffffff');

    // Indiranagar Grid Cross-Streets
    const crossStreets = [-60, -35, -10, 15, 40, 65, 90, 115];
    for (const z of crossStreets) {
      this._road(ctx, [[-55, z], [80, z]], cx, cy, scale, ho, local, '#ffffff');
    }

    // Indiranagar 12th Main (Famous Pub & Cafe Boulevard)
    this._road(ctx, [[15, -70], [15, 130]], cx, cy, scale, ho, local + 0.8, '#ffffff');

    // Parallel streets
    for (const x of [-25, 0, 45, 70]) {
      this._road(ctx, [[x, -70], [x, 130]], cx, cy, scale, ho, local, '#ffffff');
    }

    // --- Bilingual Road Signage ---
    ctx.font = `700 ${Math.max(6.5, 8 * scale)}px "Helvetica Neue", system-ui, sans-serif`;
    ctx.textAlign = 'center';

    // 100 Feet Road
    ctx.save();
    const ftLabel = this._worldToScreen(-40, 50, cx, cy, scale, ho);
    ctx.translate(ftLabel.x, ftLabel.y);
    ctx.rotate(-Math.PI / 2 + ho);
    ctx.fillStyle = '#645748';
    ctx.fillText('100 FEET ROAD · ೧೦೦ ಅಡಿ ರಸ್ತೆ', 0, -6);
    ctx.restore();

    // CMH Road
    const cmhLabel = this._worldToScreen(-50, -160, cx, cy, scale, ho);
    ctx.fillStyle = '#645748';
    ctx.fillText('CMH ROAD · ಸಿ.ಎಂ.ಎಚ್. ರಸ್ತೆ', cmhLabel.x, cmhLabel.y - 5);

    // Old Airport Road
    const oarLabel = this._worldToScreen(50, 160, cx, cy, scale, ho);
    ctx.fillStyle = '#645748';
    ctx.fillText('OLD AIRPORT RD · ಹಳೆ ಏರ್ಪೋರ್ಟ್ ರಸ್ತೆ', oarLabel.x, oarLabel.y - 5);

    // MG Road
    ctx.save();
    const mgLabel = this._worldToScreen(-160, -150, cx, cy, scale, ho);
    ctx.translate(mgLabel.x, mgLabel.y);
    ctx.rotate(0.56 + ho);
    ctx.fillStyle = '#645748';
    ctx.fillText('MG ROAD · ಎಂ.ಜಿ. ರಸ್ತೆ', 0, -5);
    ctx.restore();

    // Outer Ring Road
    const orrLabel = this._worldToScreen(0, -300, cx, cy, scale, ho);
    ctx.fillStyle = '#92400e';
    ctx.fillText('OUTER RING ROAD · ಹೊರ ವರ್ತುಲ ರಸ್ತೆ (ORR)', orrLabel.x, orrLabel.y - 5);

    // Hosur Road / Silk Board
    const hosurLabel = this._worldToScreen(0, 340, cx, cy, scale, ho);
    ctx.fillStyle = '#b91c1c';
    ctx.fillText('HOSUR RD · ಸಿಲ್ಕ್ ಬೋರ್ಡ್', hosurLabel.x, hosurLabel.y - 6);
  }

  // =========================================================================
  // TRAFFIC HEATMAP & BOTTLENECK VISUALIZER
  // =========================================================================
  _drawTrafficHeatmap(ctx, cx, cy, scale, ho) {
    // 1. Free-flow corridors (Green glow on Outer Ring Road)
    const orrPts = [[-350, -300], [-200, -320], [0, -300], [200, -250], [300, -150]];
    this._road(ctx, orrPts, cx, cy, scale, ho, Math.max(6, 10 * scale), 'rgba(34, 197, 94, 0.28)');

    // 2. Moderate traffic corridor (Amber glow on CMH Road and Old Airport Road)
    this._road(ctx, [[-300, -160], [200, -160]], cx, cy, scale, ho, Math.max(5, 8 * scale), 'rgba(245, 158, 11, 0.25)');
    this._road(ctx, [[-300, 160], [250, 160]], cx, cy, scale, ho, Math.max(5, 8 * scale), 'rgba(245, 158, 11, 0.25)');

    // 3. Dense 100 Feet Road cafe & shopping corridor (Orange glow)
    this._road(ctx, [[-40, -200], [-40, 200]], cx, cy, scale, ho, Math.max(6, 10 * scale), 'rgba(234, 88, 12, 0.35)');

    // 4. BENGALURU'S FAMOUS SILK BOARD BOTTLENECK (Intense pulsating red glow)
    const sb = this._worldToScreen(0, 300, cx, cy, scale, ho);
    const pulseR = (18 + Math.sin(this.sweepAngle * 3) * 6) * scale + 4;
    const pulseR2 = (28 + Math.sin(this.sweepAngle * 3 + 1) * 8) * scale + 8;

    // Outer warning pulse ring
    ctx.beginPath();
    ctx.arc(sb.x, sb.y, pulseR2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.14)';
    ctx.fill();

    // Inner jam circle
    ctx.beginPath();
    ctx.arc(sb.x, sb.y, pulseR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
    ctx.fill();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Silk Board Bottleneck Badge
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#b91c1c';
    ctx.lineWidth = 1.2;
    const badgeW = Math.max(120, 140 * scale);
    const badgeH = 26;
    ctx.beginPath();
    ctx.roundRect(sb.x - badgeW / 2, sb.y - 32, badgeW, badgeH, 6);
    ctx.fill();
    ctx.stroke();

    // Warning icon + Kannada text
    ctx.font = '700 9px system-ui';
    ctx.fillStyle = '#b91c1c';
    ctx.textAlign = 'center';
    ctx.fillText('⚠️ SILK BOARD (ಸಿಲ್ಕ್ ಬೋರ್ಡ್)', sb.x, sb.y - 20);
    ctx.font = '600 7.5px monospace';
    ctx.fillStyle = '#7f1d1d';
    ctx.fillText('CRAWL: 4 km/h · 45 MIN DELAY', sb.x, sb.y - 10);
  }

  // =========================================================================
  // DYNAMIC TRAFFIC VEHICLES (AUTOS, BMTC BUSES, CABS, BIKES)
  // =========================================================================
  _drawTrafficVehicles(ctx, cx, cy, scale, ho) {
    for (const v of this.trafficVehicles) {
      const sp = this._worldToScreen(v.x, v.z, cx, cy, scale, ho);
      // Skip if way outside canvas
      if (sp.x < -20 || sp.x > this.canvas.width + 20 || sp.y < -20 || sp.y > this.canvas.height + 20) {
        continue;
      }

      ctx.save();
      ctx.translate(sp.x, sp.y);
      ctx.rotate(v.heading - ho);

      if (v.type === 'auto') {
        // --- Bangalore Auto Rickshaw (Yellow & Green) ---
        const wAuto = Math.max(2.4, 3.4 * scale);
        const hAuto = Math.max(4.2, 5.8 * scale);

        // Lower body: Forest green
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(-wAuto / 2, -hAuto / 2, wAuto, hAuto);

        // Canopy roof: Vibrant canary yellow
        ctx.fillStyle = '#facc15';
        ctx.fillRect(-wAuto / 2, -hAuto / 2 + hAuto * 0.25, wAuto, hAuto * 0.75);

        // Black windshield
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-wAuto / 2 + 0.3, -hAuto / 2, wAuto - 0.6, 1.2);

        // Headlight glow beam
        ctx.fillStyle = 'rgba(254, 240, 138, 0.7)';
        ctx.beginPath();
        ctx.arc(0, -hAuto / 2 - 1, 1.2, 0, Math.PI * 2);
        ctx.fill();

      } else if (v.type === 'bus') {
        // --- BMTC Bangalore Bus (Royal Blue & White) ---
        const wBus = Math.max(3.2, 4.6 * scale);
        const hBus = Math.max(7.5, 11.5 * scale);

        // Blue bus body
        ctx.fillStyle = '#1d4ed8';
        ctx.beginPath();
        ctx.roundRect(-wBus / 2, -hBus / 2, wBus, hBus, 1.5);
        ctx.fill();

        // White roof longitudinal strip
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-wBus / 4, -hBus / 2 + 1, wBus / 2, hBus - 2);

        // Headlights & Taillights
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(-wBus / 2 + 0.3, -hBus / 2 - 0.5, 1, 1);
        ctx.fillRect(wBus / 2 - 1.3, -hBus / 2 - 0.5, 1, 1);

        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-wBus / 2 + 0.3, hBus / 2 - 0.5, 1, 1);
        ctx.fillRect(wBus / 2 - 1.3, hBus / 2 - 0.5, 1, 1);

        // BMTC text when zoomed in
        if (this.zoom >= 1.2) {
          ctx.font = 'bold 5px system-ui';
          ctx.fillStyle = '#1d4ed8';
          ctx.textAlign = 'center';
          ctx.fillText('BMTC', 0, 1.5);
        }

      } else if (v.type === 'bike') {
        // --- Fast zippy Two-Wheeler ---
        const rBike = Math.max(1.2, 1.8 * scale);
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(0, 0, rBike, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(0, -rBike - 0.8, 0.8, 0, Math.PI * 2);
        ctx.fill();

      } else {
        // --- City Car / White Cab ---
        const wCar = Math.max(2.6, 3.8 * scale);
        const hCar = Math.max(4.8, 6.8 * scale);
        ctx.fillStyle = v.color || '#ffffff';
        ctx.beginPath();
        ctx.roundRect(-wCar / 2, -hCar / 2, wCar, hCar, 1.2);
        ctx.fill();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Windshield glass
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-wCar / 2 + 0.5, -hCar / 4, wCar - 1, hCar * 0.28);

        // Headlight glow
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(-wCar / 2 + 0.3, -hCar / 2 - 0.5, 0.8, 0.8);
        ctx.fillRect(wCar / 2 - 1.1, -hCar / 2 - 0.5, 0.8, 0.8);
      }

      ctx.restore();
    }
  }

  // =========================================================================
  // NAMMA METRO (PURPLE & GREEN LINES + MOVING METRO TRAIN)
  // =========================================================================
  _drawMetro(ctx, cx, cy, scale, ho) {
    const purpleStations = [
      { name: 'Baiyappanahalli', kName: 'ಬೈಯಪ್ಪನಹಳ್ಳಿ', pos: [220, -140] },
      { name: 'Swami Vivekananda', kName: 'ವಿವೇಕಾನಂದ', pos: [140, -150] },
      { name: 'Indiranagar', kName: 'ಇಂದಿರಾನಗರ', pos: [60, -160] },
      { name: 'Halasuru', kName: 'ಹಲಸೂರು', pos: [-20, -150] },
      { name: 'Trinity', kName: 'ಟ್ರಿನಿಟಿ', pos: [-55, -130] },
      { name: 'MG Road', kName: 'ಎಂ.ಜಿ. ರಸ್ತೆ', pos: [-85, -110] },
      { name: 'Cubbon Park', kName: 'ಕಬ್ಬನ್ ಪಾರ್ಕ್', pos: [-130, -100] },
      { name: 'Vidhana Soudha', kName: 'ವಿಧಾನ ಸೌಧ', pos: [-80, -190] },
      { name: 'Majestic (Kempegowda)', kName: 'ಮೆಜೆಸ್ಟಿಕ್', pos: [-160, -210] },
    ];

    // Green Line interchange at Majestic
    const greenLine = [
      [-160, -280], [-160, -210], [-160, -130], [-160, -50],
    ];

    // 1. Green Line Track
    ctx.beginPath();
    for (let i = 0; i < greenLine.length; i++) {
      const sp = this._worldToScreen(greenLine[i][0], greenLine[i][1], cx, cy, scale, ho);
      i === 0 ? ctx.moveTo(sp.x, sp.y) : ctx.lineTo(sp.x, sp.y);
    }
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = Math.max(2.2, 3.2 * scale);
    ctx.lineCap = 'round';
    ctx.stroke();

    // 2. Purple Line Track (High contrast violet)
    ctx.beginPath();
    for (let i = 0; i < purpleStations.length; i++) {
      const sp = this._worldToScreen(purpleStations[i].pos[0], purpleStations[i].pos[1], cx, cy, scale, ho);
      i === 0 ? ctx.moveTo(sp.x, sp.y) : ctx.lineTo(sp.x, sp.y);
    }
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = Math.max(2.5, 4.0 * scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Inner track center line
    ctx.beginPath();
    for (let i = 0; i < purpleStations.length; i++) {
      const sp = this._worldToScreen(purpleStations[i].pos[0], purpleStations[i].pos[1], cx, cy, scale, ho);
      i === 0 ? ctx.moveTo(sp.x, sp.y) : ctx.lineTo(sp.x, sp.y);
    }
    ctx.strokeStyle = '#f5f3ff';
    ctx.lineWidth = Math.max(1.0, 1.5 * scale);
    ctx.stroke();

    // 3. Stations with Kannada & English names
    const stSize = Math.max(3.0, 4.2 * scale);
    for (const st of purpleStations) {
      const sp = this._worldToScreen(st.pos[0], st.pos[1], cx, cy, scale, ho);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, stSize, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#7c3aed';
      ctx.lineWidth = 1.8;
      ctx.fill();
      ctx.stroke();

      if (this.zoom >= 0.75) {
        ctx.font = `600 ${Math.max(6, 7.5 * scale)}px system-ui, sans-serif`;
        ctx.fillStyle = '#6d28d9';
        ctx.textAlign = 'left';
        ctx.fillText(`${st.name} · ${st.kName}`, sp.x + stSize + 4, sp.y + 3);
      }
    }

    // 4. ANIMATED 3-CAR NAMMA METRO TRAIN!
    const nSegs = purpleStations.length - 1;
    const segT = this.metroState.progress * nSegs;
    const sIdx = Math.min(nSegs - 1, Math.floor(segT));
    const sFrac = segT - sIdx;
    const pA = purpleStations[sIdx].pos;
    const pB = purpleStations[sIdx + 1].pos;

    const mTrainPos = [
      pA[0] + (pB[0] - pA[0]) * sFrac,
      pA[1] + (pB[1] - pA[1]) * sFrac,
    ];
    const mAngle = Math.atan2(pB[0] - pA[0], pB[1] - pA[1]);

    const trainSp = this._worldToScreen(mTrainPos[0], mTrainPos[1], cx, cy, scale, ho);

    ctx.save();
    ctx.translate(trainSp.x, trainSp.y);
    ctx.rotate(mAngle - ho);

    // Draw 3 articulated silver/purple metro coaches
    const carW = Math.max(3.4, 4.8 * scale);
    const carH = Math.max(7.0, 9.5 * scale);
    for (let c = -1; c <= 1; c++) {
      const cyOffset = c * (carH + 1.2);
      // Silver coach body
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.roundRect(-carW / 2, cyOffset - carH / 2, carW, carH, 1.5);
      ctx.fill();

      // Purple roof & accent stripe
      ctx.fillStyle = '#9333ea';
      ctx.fillRect(-carW / 2, cyOffset - carH / 4, carW, carH * 0.5);

      // Windows
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(-carW / 2 + 0.4, cyOffset - carH / 2 + 1, carW - 0.8, 1);
      ctx.fillRect(-carW / 2 + 0.4, cyOffset + carH / 2 - 2, carW - 0.8, 1);
    }

    // Front headlights beam
    ctx.fillStyle = 'rgba(253, 224, 71, 0.9)';
    ctx.beginPath();
    ctx.moveTo(-carW / 2, -carH * 1.5);
    ctx.lineTo(carW / 2, -carH * 1.5);
    ctx.lineTo(carW * 1.2, -carH * 2.2);
    ctx.lineTo(-carW * 1.2, -carH * 2.2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(250, 204, 21, 0.35)';
    ctx.fill();

    ctx.restore();

    // Metro Line Badge "ನಮ್ಮ ಮೆಟ್ರೋ M"
    const mBadge = this._worldToScreen(100, -155, cx, cy, scale, ho);
    ctx.fillStyle = '#7c3aed';
    ctx.beginPath();
    ctx.arc(mBadge.x, mBadge.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 8.5px system-ui';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('M', mBadge.x, mBadge.y + 0.5);
    ctx.textBaseline = 'alphabetic';
  }

  _drawFlightTrail(ctx, cx, cy, scale, ho, trail) {
    if (trail.length < 2) return;
    const len = trail.length;
    const step = len > 300 ? 3 : len > 150 ? 2 : 1;

    ctx.beginPath();
    let started = false;
    for (let i = 0; i < len; i += step) {
      const pt = trail[i];
      const sp = this._worldToScreen(pt.x, pt.z, cx, cy, scale, ho);
      if (!started) { ctx.moveTo(sp.x, sp.y); started = true; }
      else ctx.lineTo(sp.x, sp.y);
    }
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.65)';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  _drawNavVector(ctx, cx, cy, scale, ho, fly) {
    let targetVec = null, targetColour = '#3b82f6';
    if (this.customWaypoint) {
      targetVec = [this.customWaypoint.x, 0, this.customWaypoint.z];
      targetColour = '#8b5cf6';
    } else if (fly.goal) {
      const L = this.landmarks.find(m => m.key === fly.goal);
      if (L) {
        targetVec = L.pos;
        targetColour = '#' + (L.colour || 0x3b82f6).toString(16).padStart(6, '0');
      }
    }
    if (!targetVec) return;

    const flySp = this._worldToScreen(fly.pos.x, fly.pos.z, cx, cy, scale, ho);
    const tgtSp = this._worldToScreen(targetVec[0], targetVec[2], cx, cy, scale, ho);

    ctx.beginPath();
    ctx.moveTo(flySp.x, flySp.y);
    ctx.lineTo(tgtSp.x, tgtSp.y);
    ctx.strokeStyle = targetColour;
    ctx.lineWidth = 2.2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Animated pulse bead along nav line
    const dx = tgtSp.x - flySp.x, dy = tgtSp.y - flySp.y;
    const px = flySp.x + dx * this.navPulse, py = flySp.y + dy * this.navPulse;
    ctx.beginPath();
    ctx.arc(px, py, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = targetColour;
    ctx.fill();
  }

  _drawLandmarks(ctx, cx, cy, scale, ho, fly) {
    const activeGoal = fly.goal;

    for (const L of this.landmarks) {
      const sp = this._worldToScreen(L.pos[0], L.pos[2], cx, cy, scale, ho);
      const isGoal = L.key === activeGoal;
      const isHovered = this.hoveredLandmark && this.hoveredLandmark.key === L.key;
      const dist = Math.hypot(fly.pos.x - L.pos[0], fly.pos.z - L.pos[2]);

      const v = fly.valences && fly.valences[L.key] !== undefined ? fly.valences[L.key] : 0;
      let pinColor = '#' + (L.colour || 0x3b82f6).toString(16).padStart(6, '0');
      if (v > 0.08) pinColor = '#22c55e';
      else if (v < -0.08) pinColor = '#ef4444';

      const r = isGoal || isHovered ? 9 : 6.5;

      // Pulse ring on locked destination
      if (isGoal) {
        const pr = r + 4 + this.pingPhase * 12;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, pr, 0, Math.PI * 2);
        ctx.strokeStyle = pinColor + '70';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }

      // Pin drop shadow
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y + r + 2, r * 0.6, 2.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fill();

      // Pin stem
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y + r + 2);
      ctx.lineTo(sp.x - 1.2, sp.y);
      ctx.lineTo(sp.x + 1.2, sp.y);
      ctx.closePath();
      ctx.fillStyle = pinColor;
      ctx.fill();

      // Pin circle head
      ctx.beginPath();
      ctx.arc(sp.x, sp.y - r * 0.3, r, 0, Math.PI * 2);
      ctx.fillStyle = pinColor;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Landmark icon
      const icon = L.key === 'home' ? '🏠' :
                   L.key === 'cubbon' ? '🌳' :
                   L.key === 'vidhana' ? '🏛️' :
                   L.key === 'ubcity' ? '🏢' :
                   L.key === 'lalbagh' ? '🌸' : '🚗';
      ctx.font = `${r + 2}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, sp.x, sp.y - r * 0.3);

      // Kannada subtitle mapping
      const kNames = {
        home: '೨೫೮೬ ಲ್ಯಾಬ್ಸ್',
        cubbon: 'ಕಬ್ಬನ್ ಪಾರ್ಕ್',
        vidhana: 'ವಿಧಾನ ಸೌಧ',
        ubcity: 'ಯುಬಿ ಸಿಟಿ',
        lalbagh: 'ಲಾಲ್ ಬಾಗ್',
        traffic: '೧೦೦ ಅಡಿ ಟ್ರಾಫಿಕ್',
      };

      // Label (English + Kannada)
      ctx.font = `${isGoal ? '700' : '600'} ${Math.max(8, 9.5 * scale)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(L.label, sp.x, sp.y + r + 4);

      if (kNames[L.key]) {
        ctx.font = `500 ${Math.max(6.5, 7.5 * scale)}px system-ui`;
        ctx.fillStyle = '#64748b';
        ctx.fillText(kNames[L.key], sp.x, sp.y + r + 16);
      }

      // Range distance
      ctx.font = `600 ${Math.max(6.5, 7.5 * scale)}px system-ui, sans-serif`;
      ctx.fillStyle = isGoal ? '#0284c7' : '#94a3b8';
      ctx.fillText(`${dist.toFixed(0)}m`, sp.x, sp.y + r + 27);
    }

    // Custom waypoint
    if (this.customWaypoint) {
      const wpSp = this._worldToScreen(this.customWaypoint.x, this.customWaypoint.z, cx, cy, scale, ho);
      const wpDist = Math.hypot(fly.pos.x - this.customWaypoint.x, fly.pos.z - this.customWaypoint.z);

      ctx.beginPath();
      ctx.arc(wpSp.x, wpSp.y, 6 + this.pingPhase * 10, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(wpSp.x, wpSp.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#8b5cf6';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.font = `700 ${Math.max(7, 8.5 * scale)}px system-ui`;
      ctx.fillStyle = '#7c3aed';
      ctx.textAlign = 'center';
      ctx.fillText('Waypoint · ವೇಪಾಯಿಂಟ್', wpSp.x, wpSp.y - 12);
      ctx.font = `600 ${Math.max(6.5, 7.5 * scale)}px system-ui`;
      ctx.fillStyle = '#64748b';
      ctx.fillText(`${wpDist.toFixed(0)}m`, wpSp.x, wpSp.y + 10);
    }
  }

  _drawFly(ctx, cx, cy, scale, ho, fly) {
    const sp = this._worldToScreen(fly.pos.x, fly.pos.z, cx, cy, scale, ho);
    const flyAngle = -Math.PI / 2 + (fly.heading - ho);

    // Heading cone (Central Complex EPG bump)
    const coneAngle = -Math.PI / 2 + ((fly.theta !== undefined ? fly.theta : fly.heading) - ho);
    const coneSpan = Math.max(0.3, 0.8 - (fly.strength || 0.4) * 0.5);
    const coneLen = 32 + (fly.strength || 0.4) * 44;

    ctx.save();
    ctx.translate(sp.x, sp.y);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, coneLen, coneAngle - coneSpan / 2, coneAngle + coneSpan / 2);
    ctx.closePath();
    const coneGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, coneLen);
    coneGrad.addColorStop(0, 'rgba(59, 130, 246, 0.35)');
    coneGrad.addColorStop(0.6, 'rgba(59, 130, 246, 0.12)');
    coneGrad.addColorStop(1, 'rgba(59, 130, 246, 0)');
    ctx.fillStyle = coneGrad;
    ctx.fill();
    ctx.restore();

    // Fly body
    ctx.save();
    ctx.translate(sp.x, sp.y);
    ctx.rotate(flyAngle + Math.PI / 2);

    // Accuracy ring
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(59, 130, 246, 0.12)';
    ctx.fill();

    // Fly indicator arrow
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(8, 8);
    ctx.lineTo(0, 3.5);
    ctx.lineTo(-8, 8);
    ctx.closePath();
    ctx.fillStyle = '#2563eb';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.2;
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  _drawScaleBar(ctx, w, h, scale) {
    const barWorld = 100; // 100m
    const barPx = barWorld * scale;
    const x0 = 12, y0 = h - 22;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x0, y0, barPx, 3);
    ctx.fillRect(x0, y0 - 3, 1, 6);
    ctx.fillRect(x0 + barPx, y0 - 3, 1, 6);

    ctx.font = '700 8px system-ui, sans-serif';
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('100m · ೧೦೦ ಮೀ', x0, y0 - 5);
  }

  _drawCompass(ctx, w, h, ho) {
    const cr = 19, cx = w - 30, cy = 36;

    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.2;
    ctx.fill();
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-ho);

    // North arrow (red)
    ctx.beginPath();
    ctx.moveTo(0, -cr + 5);
    ctx.lineTo(-4, 2);
    ctx.lineTo(0, -1);
    ctx.closePath();
    ctx.fillStyle = '#ef4444';
    ctx.fill();

    // South arrow (slate)
    ctx.beginPath();
    ctx.moveTo(0, cr - 5);
    ctx.lineTo(4, -2);
    ctx.lineTo(0, 1);
    ctx.closePath();
    ctx.fillStyle = '#94a3b8';
    ctx.fill();

    // N label
    ctx.font = 'bold 9px system-ui';
    ctx.fillStyle = '#ef4444';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', 0, -cr + 2);

    ctx.restore();
  }

  _drawHUD(ctx, w, h, fly) {
    // Top Left: Mode & Zoom Badges
    const badge = this.mode === 'north-up' ? 'N-UP' : 'H-UP';
    ctx.font = '700 8.5px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const bw = ctx.measureText(badge).width + 10;
    ctx.fillStyle = 'rgba(255,255,255,0.90)';
    ctx.beginPath();
    ctx.roundRect(8, 8, bw, 16, 4);
    ctx.fill();
    ctx.fillStyle = this.mode === 'north-up' ? '#2563eb' : '#d97706';
    ctx.fillText(badge, 13, 12);

    const zoomText = `${this.zoom.toFixed(1)}x`;
    const zw = ctx.measureText(zoomText).width + 10;
    ctx.fillStyle = 'rgba(255,255,255,0.90)';
    ctx.beginPath();
    ctx.roundRect(8 + bw + 4, 8, zw, 16, 4);
    ctx.fill();
    ctx.fillStyle = '#334155';
    ctx.fillText(zoomText, 13 + bw + 4, 12);

    // Top Center Banner: BENGALURU AIRSPACE · ನಮ್ಮ ಬೆಂಗಳೂರು
    if (w > 260) {
      const blrText = '📍 BENGALURU AIRSPACE · ನಮ್ಮ ಬೆಂಗಳೂರು';
      ctx.font = '700 8.5px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const bbw = ctx.measureText(blrText).width + 14;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.beginPath();
      ctx.roundRect(w / 2 - bbw / 2, 8, bbw, 16, 4);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.fillText(blrText, w / 2, 12);
    }

    // Top Right: Speed & Altitude
    const speed = `${(fly.speed * 0.95).toFixed(0)} km/h`;
    const alt = `${fly.pos.y.toFixed(0)}m alt`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.90)';
    const sw = ctx.measureText(speed + '  ' + alt).width + 14;
    ctx.beginPath();
    ctx.roundRect(w - sw - 52, 8, sw, 16, 4);
    ctx.fill();
    ctx.fillStyle = '#1e293b';
    ctx.fillText(`${speed}  ${alt}`, w - 57, 12);

    // Bottom Traffic Telemetry Bar
    const trafText = '🚦 BLR TRAFFIC: 87% PEAK · 🛺 48 AUTOS · 🚌 BMTC ACTIVE';
    ctx.font = '600 7.5px system-ui, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#475569';
    ctx.fillText(trafText, w / 2, h - 5);
  }
}
