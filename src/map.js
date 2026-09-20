/**
 * Bangalore GPS Navigation Map — realistic vector cartography
 *
 * Renders Indiranagar + surroundings with real geography:
 * - Ulsoor Lake (northeast of Indiranagar)
 * - Cubbon Park (L-shaped botanical reserve)
 * - Lalbagh Botanical Gardens with Glasshouse & lake
 * - Indiranagar grid (numbered cross-streets)
 * - Namma Metro Purple Line with stations
 * - Major arterials: 100 Feet Road, CMH Road, Old Airport Road, MG Road
 * - 2586Labs HQ beacon, Vidhana Soudha, UB City
 * - Flight trail, heading cone, live telemetry
 */

export class TacticalMap {
  constructor(options = {}) {
    this.canvas = options.canvas;
    this.ctx = this.canvas.getContext('2d');
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

    this.sweepAngle = 0;
    this.pingPhase = 0;
    this.navPulse = 0;
    this.hoveredLandmark = null;
    this.customWaypoint = null;

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
      if (hit) { this.customWaypoint = null; this.onSelectLandmark(hit.key); }
      else {
        const wCoord = this._screenToWorld(mx, my);
        if (wCoord) { this.customWaypoint = wCoord; this.onSelectWaypoint(wCoord.x, wCoord.z); }
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
      if (Math.hypot(sx - sp.x, sy - sp.y) < 20) return L;
    }
    return null;
  }

  // --- Draw a polygon from world coords ---
  _poly(ctx, pts, cx, cy, scale, ho) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const sp = this._worldToScreen(pts[i][0], pts[i][1], cx, cy, scale, ho);
      i === 0 ? ctx.moveTo(sp.x, sp.y) : ctx.lineTo(sp.x, sp.y);
    }
    ctx.closePath();
  }

  // --- Draw a road segment ---
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

    const fly = this.getFlyState();
    const ho = this.mode === 'heading-up' ? fly.heading : 0;

    // 1. Background — warm map cream
    ctx.fillStyle = '#f0ece4';
    ctx.fillRect(0, 0, w, h);

    // 2. Terrain: parks, lakes, building blocks
    if (this.showRoads) {
      this._drawTerrain(ctx, cx, cy, scale, ho);
      this._drawRoads(ctx, cx, cy, scale, ho);
      this._drawMetro(ctx, cx, cy, scale, ho);
    }

    // 3. Flight trail
    if (this.showTrail && fly.trail && fly.trail.length > 1)
      this._drawFlightTrail(ctx, cx, cy, scale, ho, fly.trail);

    // 4. Navigation vector
    this._drawNavVector(ctx, cx, cy, scale, ho, fly);

    // 5. Landmarks
    if (this.showLandmarks) this._drawLandmarks(ctx, cx, cy, scale, ho, fly);

    // 6. Fly marker + heading cone
    this._drawFly(ctx, cx, cy, scale, ho, fly);

    // 7. Scale bar
    this._drawScaleBar(ctx, w, h, scale);

    // 8. Compass rose
    this._drawCompass(ctx, w, h, ho);

    // 9. HUD overlay
    this._drawHUD(ctx, w, h, fly);
  }

  _drawTerrain(ctx, cx, cy, scale, ho) {
    // --- Ulsoor Lake (major feature NE of Indiranagar) ---
    const ulsoor = [
      [80, -80], [100, -110], [140, -120], [180, -105],
      [200, -80], [190, -55], [160, -40], [120, -45], [90, -55],
    ];
    this._poly(ctx, ulsoor, cx, cy, scale, ho);
    ctx.fillStyle = '#a8d8ea';
    ctx.fill();
    ctx.strokeStyle = '#7ec8d8';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Ulsoor Lake label
    const ulLabel = this._worldToScreen(140, -78, cx, cy, scale, ho);
    ctx.font = `italic ${Math.max(7, 9 * scale)}px "Georgia", serif`;
    ctx.fillStyle = '#4a90a4';
    ctx.textAlign = 'center';
    ctx.fillText('Ulsoor Lake', ulLabel.x, ulLabel.y);

    // --- Cubbon Park (L-shaped, west of center) ---
    const cubbon = [
      [-170, -130], [-90, -130], [-90, -95], [-130, -95],
      [-130, -50], [-170, -50],
    ];
    this._poly(ctx, cubbon, cx, cy, scale, ho);
    ctx.fillStyle = '#c8e6c0';
    ctx.fill();
    ctx.strokeStyle = '#8cbd82';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Tree dots inside Cubbon Park
    ctx.fillStyle = '#7aad6e';
    const treeSeed = [
      [-155, -115], [-140, -105], [-125, -120], [-110, -115],
      [-160, -75], [-145, -65], [-155, -90], [-135, -80],
    ];
    for (const t of treeSeed) {
      const tp = this._worldToScreen(t[0], t[1], cx, cy, scale, ho);
      ctx.beginPath();
      ctx.arc(tp.x, tp.y, 2.5 * scale + 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- Lalbagh Botanical Gardens (large oval, south) ---
    const lb = this._worldToScreen(150, 120, cx, cy, scale, ho);
    const lbRx = 55 * scale, lbRy = 42 * scale;
    ctx.beginPath();
    ctx.ellipse(lb.x, lb.y, lbRx, lbRy, 0.15, 0, Math.PI * 2);
    ctx.fillStyle = '#c2dfb6';
    ctx.fill();
    ctx.strokeStyle = '#88b87a';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Lalbagh Lake inside
    const llk = this._worldToScreen(140, 140, cx, cy, scale, ho);
    ctx.beginPath();
    ctx.ellipse(llk.x, llk.y, 20 * scale, 12 * scale, 0.25, 0, Math.PI * 2);
    ctx.fillStyle = '#a0ccdb';
    ctx.fill();

    // Glasshouse dot
    const gh = this._worldToScreen(155, 110, cx, cy, scale, ho);
    ctx.beginPath();
    ctx.arc(gh.x, gh.y, 3 * scale + 1, 0, Math.PI * 2);
    ctx.fillStyle = '#e8e0d0';
    ctx.strokeStyle = '#b0a898';
    ctx.lineWidth = 0.8;
    ctx.fill();
    ctx.stroke();

    // --- Vidhana Soudha grounds ---
    const vs = [
      [-100, -210], [-40, -210], [-40, -170], [-100, -170],
    ];
    this._poly(ctx, vs, cx, cy, scale, ho);
    ctx.fillStyle = '#e8e0d0';
    ctx.fill();
    ctx.strokeStyle = '#c8bfae';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // --- UB City block ---
    const ub = [
      [75, -170], [115, -170], [115, -130], [75, -130],
    ];
    this._poly(ctx, ub, cx, cy, scale, ho);
    ctx.fillStyle = '#e0dbd5';
    ctx.fill();
    ctx.strokeStyle = '#c0b8ae';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // --- Residential building blocks (Indiranagar grid) ---
    const blocks = [
      // Indiranagar 1st stage (north of home)
      [[-30, -60], [20, -60], [20, -20], [-30, -20]],
      [[25, -60], [70, -60], [70, -20], [25, -20]],
      // Indiranagar 2nd stage (south of home)
      [[-30, 20], [20, 20], [20, 60], [-30, 60]],
      [[25, 20], [70, 20], [70, 60], [25, 60]],
      // Indiranagar 3rd stage
      [[-30, 70], [20, 70], [20, 110], [-30, 110]],
      // Domlur (west)
      [[-110, -30], [-70, -30], [-70, 10], [-110, 10]],
      [[-110, 20], [-70, 20], [-70, 60], [-110, 60]],
      // Koramangala (far south)
      [[30, 160], [90, 160], [90, 210], [30, 210]],
      [[-30, 160], [20, 160], [20, 210], [-30, 210]],
      // HAL area (east)
      [[100, -30], [160, -30], [160, 20], [100, 20]],
      [[100, 30], [160, 30], [160, 80], [100, 80]],
    ];
    ctx.fillStyle = '#e8e4dc';
    ctx.strokeStyle = '#d5d0c8';
    ctx.lineWidth = 0.5;
    for (const blk of blocks) {
      this._poly(ctx, blk, cx, cy, scale, ho);
      ctx.fill();
      ctx.stroke();
    }
  }

  _drawRoads(ctx, cx, cy, scale, ho) {
    const major = Math.max(2, 4 * scale);
    const arterial = Math.max(1.5, 3 * scale);
    const local = Math.max(0.8, 1.5 * scale);

    // --- Highways / Major arterials ---

    // 100 Feet Road (N-S spine through Indiranagar)
    this._road(ctx, [[-40, -350], [-40, 350]], cx, cy, scale, ho, major, '#ffffff');
    this._road(ctx, [[-40, -350], [-40, 350]], cx, cy, scale, ho, major - 1, '#f5f0e8');

    // CMH Road (E-W, north)
    this._road(ctx, [[-300, -160], [200, -160]], cx, cy, scale, ho, major, '#ffffff');
    this._road(ctx, [[-300, -160], [200, -160]], cx, cy, scale, ho, major - 1, '#f5f0e8');

    // Old Airport Road (E-W, south)
    this._road(ctx, [[-300, 160], [250, 160]], cx, cy, scale, ho, major, '#ffffff');
    this._road(ctx, [[-300, 160], [250, 160]], cx, cy, scale, ho, major - 1, '#f5f0e8');

    // MG Road (diagonal, NW)
    this._road(ctx, [[-250, -200], [-80, -95]], cx, cy, scale, ho, major, '#ffffff');
    this._road(ctx, [[-250, -200], [-80, -95]], cx, cy, scale, ho, major - 1, '#f5f0e8');

    // Outer Ring Road (curves around)
    this._road(ctx, [[-350, -300], [-200, -320], [0, -300], [200, -250], [300, -150]],
      cx, cy, scale, ho, major, '#fff3cd');
    this._road(ctx, [[-350, -300], [-200, -320], [0, -300], [200, -250], [300, -150]],
      cx, cy, scale, ho, major - 1, '#fde68a');

    // HAL Old Airport Road (east, roughly E-W)
    this._road(ctx, [[60, 0], [120, -10], [200, -20], [300, -30]],
      cx, cy, scale, ho, arterial, '#ffffff');

    // Hosur Road (SE)
    this._road(ctx, [[-60, 130], [-30, 200], [0, 300], [20, 400]],
      cx, cy, scale, ho, arterial, '#ffffff');

    // --- Indiranagar cross streets (the grid is this area's defining feature) ---
    const crossStreets = [-60, -35, -10, 15, 40, 65, 90, 115];
    for (const z of crossStreets) {
      this._road(ctx, [[-55, z], [80, z]], cx, cy, scale, ho, local, '#ffffff');
    }

    // Indiranagar parallel streets (N-S)
    const parallelSts = [-25, 0, 25, 50];
    for (const x of parallelSts) {
      this._road(ctx, [[x, -70], [x, 130]], cx, cy, scale, ho, local, '#ffffff');
    }

    // Defence Colony Road
    this._road(ctx, [[70, -70], [70, 130]], cx, cy, scale, ho, local + 0.5, '#ffffff');

    // --- Road labels ---
    ctx.font = `600 ${Math.max(6, 7.5 * scale)}px "Helvetica Neue", system-ui, sans-serif`;
    ctx.textAlign = 'center';

    // 100 Feet Road label
    ctx.save();
    const ftLabel = this._worldToScreen(-40, 50, cx, cy, scale, ho);
    ctx.translate(ftLabel.x, ftLabel.y);
    ctx.rotate(-Math.PI / 2 + ho);
    ctx.fillStyle = '#8a8070';
    ctx.fillText('100 FEET ROAD', 0, -5);
    ctx.restore();

    // CMH Road label
    const cmhLabel = this._worldToScreen(-50, -160, cx, cy, scale, ho);
    ctx.fillStyle = '#8a8070';
    ctx.fillText('CMH ROAD', cmhLabel.x, cmhLabel.y - 4);

    // Old Airport Road label
    const oarLabel = this._worldToScreen(50, 160, cx, cy, scale, ho);
    ctx.fillStyle = '#8a8070';
    ctx.fillText('OLD AIRPORT RD', oarLabel.x, oarLabel.y - 4);

    // MG Road label
    ctx.save();
    const mgLabel = this._worldToScreen(-160, -150, cx, cy, scale, ho);
    ctx.translate(mgLabel.x, mgLabel.y);
    ctx.rotate(0.56 + ho);
    ctx.fillStyle = '#8a8070';
    ctx.fillText('MG ROAD', 0, -4);
    ctx.restore();

    // Outer Ring Road
    const orrLabel = this._worldToScreen(0, -300, cx, cy, scale, ho);
    ctx.fillStyle = '#9a8a50';
    ctx.fillText('OUTER RING ROAD', orrLabel.x, orrLabel.y - 4);
  }

  _drawMetro(ctx, cx, cy, scale, ho) {
    // Purple Line route (more stations, accurate positions)
    const stations = [
      { name: 'Baiyappanahalli', pos: [220, -140] },
      { name: 'Indiranagar', pos: [60, -160] },
      { name: 'Halasuru', pos: [-20, -150] },
      { name: 'Trinity', pos: [-55, -130] },
      { name: 'MG Road', pos: [-85, -110] },
      { name: 'Cubbon Park', pos: [-130, -100] },
      { name: 'Vidhana Soudha', pos: [-80, -190] },
    ];

    // Track
    ctx.beginPath();
    for (let i = 0; i < stations.length; i++) {
      const sp = this._worldToScreen(stations[i].pos[0], stations[i].pos[1], cx, cy, scale, ho);
      i === 0 ? ctx.moveTo(sp.x, sp.y) : ctx.lineTo(sp.x, sp.y);
    }
    ctx.strokeStyle = '#9333ea';
    ctx.lineWidth = Math.max(2, 3 * scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Stations
    const stSize = Math.max(2.5, 3.5 * scale);
    for (const st of stations) {
      const sp = this._worldToScreen(st.pos[0], st.pos[1], cx, cy, scale, ho);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, stSize, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#9333ea';
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();

      if (this.zoom >= 0.8) {
        ctx.font = `500 ${Math.max(5.5, 6.5 * scale)}px system-ui, sans-serif`;
        ctx.fillStyle = '#7c3aed';
        ctx.textAlign = 'left';
        ctx.fillText(st.name, sp.x + stSize + 3, sp.y + 2);
      }
    }

    // "M" badge for Metro line
    if (this.zoom >= 0.9) {
      const mBadge = this._worldToScreen(140, -150, cx, cy, scale, ho);
      ctx.fillStyle = '#9333ea';
      ctx.beginPath();
      ctx.arc(mBadge.x, mBadge.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = 'bold 8px system-ui';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('M', mBadge.x, mBadge.y + 0.5);
      ctx.textBaseline = 'alphabetic';
    }
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
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
    ctx.lineWidth = 2;
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
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Animated pulse along nav line
    const dx = tgtSp.x - flySp.x, dy = tgtSp.y - flySp.y;
    const px = flySp.x + dx * this.navPulse, py = flySp.y + dy * this.navPulse;
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
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

      const r = isGoal || isHovered ? 8 : 6;

      // Pulse ring on goal
      if (isGoal) {
        const pr = r + 4 + this.pingPhase * 12;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, pr, 0, Math.PI * 2);
        ctx.strokeStyle = pinColor + '60';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Pin drop shadow
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y + r + 2, r * 0.6, 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fill();

      // Pin stem
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y + r + 1);
      ctx.lineTo(sp.x - 1, sp.y);
      ctx.lineTo(sp.x + 1, sp.y);
      ctx.closePath();
      ctx.fillStyle = pinColor;
      ctx.fill();

      // Pin head circle
      ctx.beginPath();
      ctx.arc(sp.x, sp.y - r * 0.3, r, 0, Math.PI * 2);
      ctx.fillStyle = pinColor;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Icon inside pin
      const icon = L.key === 'home' ? '🏠' :
                   L.key === 'cubbon' ? '🌳' :
                   L.key === 'vidhana' ? '🏛️' :
                   L.key === 'ubcity' ? '🏢' :
                   L.key === 'lalbagh' ? '🌺' : '🚗';
      ctx.font = `${r + 2}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, sp.x, sp.y - r * 0.3);

      // Label
      ctx.font = `${isGoal ? '700' : '600'} ${Math.max(8, 9 * scale)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#1e293b';
      ctx.fillText(L.label, sp.x, sp.y + r + 5);

      // Distance
      ctx.font = `400 ${Math.max(7, 7.5 * scale)}px system-ui, sans-serif`;
      ctx.fillStyle = '#64748b';
      ctx.fillText(`${dist.toFixed(0)}m`, sp.x, sp.y + r + 16);

      // Valence indicator
      if (Math.abs(v) > 0.05) {
        const vLabel = v > 0 ? `+${(v * 100).toFixed(0)}%` : `${(v * 100).toFixed(0)}%`;
        ctx.font = `700 ${Math.max(7, 7.5 * scale)}px system-ui`;
        ctx.fillStyle = v > 0 ? '#16a34a' : '#dc2626';
        ctx.fillText(vLabel, sp.x, sp.y + r + 26);
      }
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
      ctx.arc(wpSp.x, wpSp.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#8b5cf6';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.font = `600 ${Math.max(7, 8 * scale)}px system-ui`;
      ctx.fillStyle = '#7c3aed';
      ctx.textAlign = 'center';
      ctx.fillText('Waypoint', wpSp.x, wpSp.y - 10);
      ctx.font = `400 ${Math.max(6, 7 * scale)}px system-ui`;
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
    const coneLen = 30 + (fly.strength || 0.4) * 40;

    ctx.save();
    ctx.translate(sp.x, sp.y);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, coneLen, coneAngle - coneSpan / 2, coneAngle + coneSpan / 2);
    ctx.closePath();
    const coneGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, coneLen);
    coneGrad.addColorStop(0, 'rgba(59, 130, 246, 0.30)');
    coneGrad.addColorStop(0.6, 'rgba(59, 130, 246, 0.10)');
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
    ctx.fillStyle = 'rgba(59, 130, 246, 0.10)';
    ctx.fill();

    // Arrow marker
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(7, 7);
    ctx.lineTo(0, 3);
    ctx.lineTo(-7, 7);
    ctx.closePath();
    ctx.fillStyle = '#3b82f6';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  _drawScaleBar(ctx, w, h, scale) {
    const barWorld = 100; // 100m
    const barPx = barWorld * scale;
    const x0 = 12, y0 = h - 20;

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x0, y0, barPx, 3);
    ctx.fillRect(x0, y0 - 3, 1, 6);
    ctx.fillRect(x0 + barPx, y0 - 3, 1, 6);

    ctx.font = '600 8px system-ui, sans-serif';
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('100m', x0, y0 - 5);
  }

  _drawCompass(ctx, w, h, ho) {
    const cr = 18, cx = w - 30, cy = 35;

    // Background circle
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
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

    // South arrow (gray)
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
    ctx.fillText('N', 0, -cr + 1);

    ctx.restore();
  }

  _drawHUD(ctx, w, h, fly) {
    // Mode badge (top left)
    const badge = this.mode === 'north-up' ? 'N-UP' : 'H-UP';
    ctx.font = '700 8px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Badge background
    const bw = ctx.measureText(badge).width + 10;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.roundRect(8, 8, bw, 16, 4);
    ctx.fill();
    ctx.fillStyle = this.mode === 'north-up' ? '#3b82f6' : '#f59e0b';
    ctx.fillText(badge, 13, 12);

    // Zoom badge
    const zoomText = `${this.zoom.toFixed(1)}x`;
    const zw = ctx.measureText(zoomText).width + 10;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.roundRect(8 + bw + 4, 8, zw, 16, 4);
    ctx.fill();
    ctx.fillStyle = '#475569';
    ctx.fillText(zoomText, 13 + bw + 4, 12);

    // Speed & altitude (top right)
    const speed = `${(fly.speed * 0.95).toFixed(0)} km/h`;
    const alt = `${fly.pos.y.toFixed(0)}m alt`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const sw = ctx.measureText(speed + '  ' + alt).width + 14;
    ctx.beginPath();
    ctx.roundRect(w - sw - 50, 8, sw, 16, 4);
    ctx.fill();
    ctx.fillStyle = '#334155';
    ctx.fillText(`${speed}  ${alt}`, w - 55, 12);

    // Bottom hint
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = '500 7px system-ui';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Click landmark to navigate', w / 2, h - 4);
  }
}
