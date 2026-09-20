/**
 * Nona.
 *
 * Master integration loop joining:
 *   - Central complex (compass.js)
 *   - Mushroom body plasticity (mushroom.js)
 *   - Bangalore 3D world with manual flight & light theme (world.js)
 *   - Live 3D brain morphology (brain3d.js)
 *   - 2D HUD telemetry (hud.js)
 *   - Speech & NLP intent parser (listen.js)
 *   - 3D Workstation room (room.js)
 *   - NonaOS 98 retro desktop computer (desk.js)
 */

import { Compass, ringAngle } from './compass.js?v=5';
import { MushroomBody } from './mushroom.js?v=5';
import { World, LANDMARKS } from './world.js?v=5';
import { Hud } from './hud.js?v=5';
import { Brain3D, TYPE_COLOUR, TYPE_LABEL } from './brain3d.js?v=5';
import { parse, makeListener, resolve } from './listen.js?v=5';
import { Desk } from './desk.js?v=5';
import { Room } from './room.js?v=5';
import { TacticalMap } from './map.js?v=7';

const $ = (id) => document.getElementById(id);

const state = {
  cue: null, // the word currently on her mind
  goal: null, // landmark key she is oriented on
  explicitGoal: null, // user-selected destination override
  lesioned: false,
  scrambled: false,
  micOn: false,
  inside: false, // sitting at the computer inside home
  diving: false, // the enter-home camera tween is playing
};

let inspectedNeuronType = 'EPG';

function say(who, text, tone = '') {
  const log = $('log');
  if (!log) return;
  const row = document.createElement('div');
  row.className = 'term-line';

  const now = new Date();
  const ts = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  let tagText = 'SYS';
  let tagClass = 'tag-sys';

  if (who === 'you') {
    tagText = 'CMD';
    tagClass = 'tag-cmd';
  } else if (tone === 'good') {
    tagText = 'DAN+';
    tagClass = 'tag-good';
  } else if (tone === 'bad') {
    tagText = 'DAN-';
    tagClass = 'tag-bad';
  } else if (tone === 'epg') {
    tagText = 'EPG';
    tagClass = 'tag-epg';
  } else if (tone === 'nav') {
    tagText = 'NAV';
    tagClass = 'tag-epg';
  } else if (tone === 'hint') {
    tagText = 'SYS';
    tagClass = 'tag-hint';
  }

  let msgContent = text;
  if (!text.includes('<') && (text.includes('\n') || text.includes('•') || text.includes('─'))) {
    msgContent = `<pre>${text}</pre>`;
  }

  row.innerHTML = `
    <span class="term-ts">${ts}</span>
    <span class="term-tag ${tagClass}">[${tagText}]</span>
    <span class="term-msg">${msgContent}</span>
  `;
  log.appendChild(row);
  log.scrollTop = log.scrollHeight;
  while (log.children.length > 100) log.removeChild(log.firstChild);
}

async function boot() {
  const grab = async (u, tries = 4) => {
    for (let i = 0; i < tries; i++) {
      try {
        const r = await fetch(u, { cache: 'no-store' });
        if (!r.ok) throw new Error(r.status);
        return await r.json();
      } catch (e) {
        if (i === tries - 1) throw e;
        await new Promise((res) => setTimeout(res, 150 * (i + 1)));
      }
    }
  };

  const [compassData, mbData, skeletons, plus] = await Promise.all([
    grab('./data/compass.json'),
    grab('./data/mushroom.json'),
    grab('./data/skeletons.json'),
    grab('./data/compass_plus.json'),
  ]);

  const compass = new Compass(compassData);
  const mb = new MushroomBody(mbData);
  const world = new World($('scene'));
  const room = new Room(world.renderer);
  const hud = new Hud($('brain'));

  // 3D Brain morphology integration
  const nodeByBody = new Map(plus.nodes.map((n) => [n.bodyId, n]));
  const erMeta = [];
  const pflMeta = [];
  {
    const erAcc = new Map(), pflAcc = new Map();
    for (const n of plus.nodes) {
      if (String(n.type).startsWith('ER')) erAcc.set(n.bodyId, { x: 0, y: 0 });
      else if (n.type === 'PFL3') pflAcc.set(n.bodyId, { x: 0, y: 0 });
    }
    for (const e of plus.edges) {
      const tgt = nodeByBody.get(e.target), src = nodeByBody.get(e.source);
      const er = erAcc.get(e.source);
      if (er && tgt && tgt.type === 'EPG') {
        const a = ringAngle(tgt.instance);
        if (a != null) { er.x += Math.cos(a) * e.weight; er.y += Math.sin(a) * e.weight; }
      }
      const pf = pflAcc.get(e.target);
      if (pf && src && src.type === 'EPG') {
        const a = ringAngle(src.instance);
        if (a != null) { pf.x += Math.cos(a) * e.weight; pf.y += Math.sin(a) * e.weight; }
      }
    }
    for (const [bid, er] of erAcc) if (er.x || er.y) erMeta.push({ bodyId: bid, pref: Math.atan2(er.y, er.x) });
    for (const [bid, pf] of pflAcc) if (pf.x || pf.y) pflMeta.push({ bodyId: bid, azi: Math.atan2(pf.y, pf.x) });
  }

  const bodyOrder = [
    ...compass.net.nodes.map((n) => n.bodyId),
    ...erMeta.map((m) => m.bodyId),
    ...pflMeta.map((m) => m.bodyId),
  ];
  const CORE_N = compass.net.n;
  const rateBuf = new Float32Array(bodyOrder.length);
  let brain3d = null;
  try {
    brain3d = new Brain3D($('brain3d'), skeletons, bodyOrder);
    $('brain-stat').textContent =
      `${Object.keys(skeletons).length} neurons · ${brain3d.stats.paths.toLocaleString('en-US')} branches · ` +
      `${Math.round(brain3d.stats.vertices / 1000)}k vertices`;
  } catch (e) {
    console.error('3D brain failed, continuing without it:', e);
    $('brain-wrap').style.display = 'none';
  }

  // Dismiss Fluctfly Boot Veil
  if ($('boot-bar-prog')) $('boot-bar-prog').style.width = '100%';
  setTimeout(() => {
    if ($('boot')) $('boot').classList.add('done');
  }, 350);

  if ($('stat-cx')) $('stat-cx').textContent = `${compass.net.n}`;
  const st = mb.stats();
  if ($('stat-mb')) $('stat-mb').textContent = `${compass.net.m.toLocaleString('en-US')}`;

  compass.seed(0);

  // Global console exposure
  globalThis.nona = {
    compass, mb, world, room, hud, state,
    get brain3d() { return brain3d; },
    get fps() { return perf.fps; },
    enterHome: () => enterHome(),
    exitHome: () => exitHome(),
  };

  function resize() {
    const wrap = $('stage');
    if (wrap) world.resize(wrap.clientWidth, wrap.clientHeight);
    const p = $('panel-canvas');
    if (p && p.clientWidth > 0 && p.clientHeight > 0) {
      hud.resize(p.clientWidth, p.clientHeight);
    }
    if (wrap) room.resize(wrap.clientWidth, wrap.clientHeight);
    if (brain3d) {
      const b = $('brain-wrap');
      if (b && b.clientWidth > 0 && b.clientHeight > 0) {
        brain3d.resize(b.clientWidth, b.clientHeight, b.classList.contains('big'));
      }
    }
  }
  addEventListener('resize', resize);
  resize();

  // Navigation Goal Selection (Autopilot)
  function chooseGoal() {
    if (state.explicitGoal) {
      return { key: state.explicitGoal, v: 1.0 };
    }
    let best = null;
    let bestV = 0.12;
    for (const L of LANDMARKS) {
      const v = mb.valence(L.key);
      if (v > bestV) { bestV = v; best = { key: L.key, v }; }
    }
    if (!best && state.cue) {
      const v = mb.valence(state.cue);
      if (v < -0.12) return { key: state.cue, v, avoid: true };
    }
    return best;
  }

  // Workstation Setup (Henry Heffernan style)
  const desk = new Desk(
    $('desk'),
    (raw) => runCommand(raw),
    () => ({
      bump: compass.heading().strength,
      epgHz: compass.epgRate(),
      changed: mb.changedSynapses(),
      valence: LANDMARKS.map((L) => ({ key: L.key, label: L.label, v: mb.valence(L.key) })),
    }),
    () => exitHome(),
    (mode) => room.setFocus(mode),
    (type) => room.flyReact(type),
  );

  function enterHome() {
    if (state.inside || state.diving) return;
    state.diving = true;
    world.frozen = true;
    room.enter();
    state.inside = true;
    setTimeout(() => {
      state.diving = false;
      desk.show();
    }, 1100);
  }

  function exitHome() {
    if (!state.inside || state.diving) return;
    state.diving = true;

    // 1. CRT power-down on the screen
    desk.powerDown(() => {
      // 2. Camera swoops from monitor toward sunny Bangalore window
      room.exit(() => {
        state.inside = false;
        // 3. Fly accelerates and takes off from 2586Labs rooftop perch out into the sky!
        world.exitHome(() => {
          state.diving = false;
          homeArmed = false;
          say('nona', '🚀 Airborne! Flying over Bangalore. Steer with WASD or let the connectome guide her.', 'good');
        });
      });
    });
  }
  let homeArmed = true;

  // Global Flight & Navigation Keybindings
  addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

    if (e.key === 'Escape' && state.inside) {
      exitHome();
    }
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
      state.explicitGoal = null;
      document.querySelectorAll('.dest-btn').forEach((b) => b.classList.remove('active'));
    }
    if (e.key.toLowerCase() === 'c') {
      const isManual = world.toggleManual();
      updateFlightModeUI(isManual);
      if (isManual) {
        state.explicitGoal = null;
        document.querySelectorAll('.dest-btn').forEach((b) => b.classList.remove('active'));
      }
      say('nona', isManual
        ? 'Manual Pilot active! Use WASD or Arrow Keys to steer, pitch & dive. Space to boost.'
        : 'Biological Autopilot engaged. Connectome heading active.', 'hint');
    }
    if (e.key.toLowerCase() === 'e') {
      enterHome();
    }
    if (e.key.toLowerCase() === 'm') {
      toggleFoldMiniMap();
    }
    if (e.key.toLowerCase() === 'n') {
      if (miniMap) {
        const m = miniMap.toggleMode();
        if ($('mm-mode-btn')) $('mm-mode-btn').textContent = m === 'north-up' ? 'N-UP' : 'HDG-UP';
        say('nona', `Map orientation: ${m === 'north-up' ? 'North-Up' : 'Heading-Up (Fly forward)'}.`, 'hint');
      }
    }
  });

  function updateFlightModeUI(isManual) {
    const dot = $('mode-dot');
    const txt = $('mode-text');
    if (dot && txt) {
      dot.className = `dot ${isManual ? 'manual' : 'auto'}`;
      txt.textContent = isManual ? 'Manual Pilot (You)' : 'Autopilot (Brain)';
    }
  }

  // Header HUD Button Handlers
  if ($('btn-mode')) {
    $('btn-mode').onclick = () => {
      const isManual = world.toggleManual();
      updateFlightModeUI(isManual);
      if (isManual) {
        state.explicitGoal = null;
        document.querySelectorAll('.dest-btn').forEach((b) => b.classList.remove('active'));
      }
    };
  }
  if ($('btn-dock')) {
    $('btn-dock').onclick = () => enterHome();
  }
  if ($('btn-theme')) {
    $('btn-theme').onclick = (e) => {
      const next = world.theme === 'light' ? 'dusk' : 'light';
      world.setTheme(next);
      document.body.classList.toggle('theme-dusk', next === 'dusk');
      e.currentTarget.textContent = next === 'light' ? '☀️ Light Theme' : '🌙 Dusk Theme';
    };
  }

  // Unified Fly-To Destination & Navigation System
  function flyTo(key) {
    const L = LANDMARKS.find((x) => x.key === key);
    if (!L) return;

    // Visual active glow on destination chips
    document.querySelectorAll('.dest-btn').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-place') === key);
    });

    // Set explicit goal priority
    state.explicitGoal = key;
    state.cue = key;

    // Reinforce in mushroom body
    if (mb.valence(key) <= 0.12) {
      mb.teach(key, +1);
    }

    // Engage autopilot cleanly
    world.manualMode = false;
    updateFlightModeUI(false);

    // Fast-orient cue toward destination
    const b = world.bearingTo(key);
    if (b !== null) {
      cueAngle = b;
      compass.setCue(b, 0.95);
    }
    const mark = world.marks.find((m) => m.key === key);
    const dist = mark ? world.pos.distanceTo(mark.vec).toFixed(0) : '—';
    say('nona', `🚀 Navigation Locked: ${L.label} (${dist}m). Autopilot steering!`, 'good');
    if (key === 'cubbon') {
      setMascotSpeech(
        `"Locking onto <b>Cubbon Park</b>! 100% organic bamboo nectar blossoms ahead! Get ready for the victory roll!"`,
        '🍯 NECTAR EN ROUTE',
        false
      );
    }
    renderRadarWaypoints();
  }

  function setCustomWaypoint(x, z) {
    const dist = Math.hypot(world.pos.x - x, world.pos.z - z);
    const bearing = Math.atan2(x - world.pos.x, -(z - world.pos.z));
    state.explicitGoal = null;
    cueAngle = bearing;
    compass.setCue(bearing, 0.92);
    world.manualMode = false;
    updateFlightModeUI(false);
    document.querySelectorAll('.dest-btn').forEach((b) => b.classList.remove('active'));
    say('nona', `📍 Waypoint [X: ${x.toFixed(0)}m, Z: ${z.toFixed(0)}m] set (range ${dist.toFixed(0)}m). Autopilot tracking!`, 'nav');
    renderRadarWaypoints();
  }

  // Quick Destination Chips
  const destBtns = document.querySelectorAll('.dest-btn');
  destBtns.forEach((btn) => {
    btn.onclick = () => flyTo(btn.getAttribute('data-place'));
  });

  // =========================================================================
  // SASSY CARTOON FLY MASCOT & CUBBON NECTAR RUSH SYSTEM
  // =========================================================================
  let audioCtx = null;
  function playSoundChime(type = 'chime') {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      if (type === 'chime') {
        const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
        notes.forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, audioCtx.currentTime + idx * 0.07);
          gain.gain.setValueAtTime(0.09, audioCtx.currentTime + idx * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + idx * 0.07 + 0.35);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(audioCtx.currentTime + idx * 0.07);
          osc.stop(audioCtx.currentTime + idx * 0.07 + 0.35);
        });
      } else if (type === 'buzz') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(230, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.26);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.26);
      }
    } catch {}
  }

  const SASSY_QUOTES = [
    `"1 microwatt of metabolic brain power, baby. Can ChatGPT do a 720° corkscrew over Cubbon Park? Didn't think so!"`,
    `"You gave me 1.0 dopamine reward?! Pure organic sugar rush straight to my Mushroom Body!"`,
    `"4,000 compound eye ommatidia. I see Bangalore in 200 FPS ultra-HD, human."`,
    `"Cruising Bangalore airspace at 65 km/h. Watch out for pigeons and coconut trees!"`,
    `"My central complex has 166 neurons and I still navigate better than Google Maps in Silk Board traffic!"`,
    `"Did somebody say sugar? Say no more, steering compass straight to the blossoms!"`,
    `"Bamboo nectar in Cubbon Park is 10/10. Highly recommend!"`,
    `"Catch me if you can! Doing a victory roll over the lush canopy!"`,
    `"Hey! Tickling my wings increases wingbeat frequency to 240 Hz! Careful!"`
  ];

  let quoteIdx = 0;
  function setMascotSpeech(html, mood = '🍯 NECTAR SCOUT', stunt = false) {
    const textEl = $('mascot-speech-text');
    const moodEl = $('mascot-mood');
    const cardEl = $('mascot-svg-card');

    if (textEl) textEl.innerHTML = html;
    if (moodEl) moodEl.textContent = mood;

    if (cardEl) {
      if (stunt) {
        cardEl.classList.remove('mascot-hop');
        cardEl.classList.remove('mascot-stunt-active');
        void cardEl.offsetWidth; // trigger reflow
        cardEl.classList.add('mascot-stunt-active');
        setTimeout(() => cardEl.classList.remove('mascot-stunt-active'), 1400);
      } else {
        cardEl.classList.remove('mascot-hop');
        void cardEl.offsetWidth;
        cardEl.classList.add('mascot-hop');
        setTimeout(() => cardEl.classList.remove('mascot-hop'), 500);
      }
    }
  }

  function triggerRandomSassyQuote() {
    playSoundChime('buzz');
    const q = SASSY_QUOTES[quoteIdx % SASSY_QUOTES.length];
    quoteIdx++;
    setMascotSpeech(q, '🪰 SASSY QUIP', false);
  }

  let cubbonStuntDone = false;
  function triggerCubbonNectarParty() {
    // 1. Trigger 720° Corkscrew Stunt in 3D Sky
    world.doStunt('barrel_roll', 2.8);

    // 2. Play Audio Celebration
    playSoundChime('chime');

    // 3. Dopamine burst in Mushroom Body
    mb.reward('cubbon', 1.0);
    state.cue = 'cubbon';

    // 4. Mascot celebration reaction & speech
    setMascotSpeech(
      `"🍯 <b>NECTAR OVERDOSE!</b> 100% Organic Bamboo Nectar hits different! Mushroom Body dopamine at <b>1.0 MAX</b>! Watch this 360° victory barrel roll!"`,
      '🎉 SUGAR RUSH!',
      true
    );

    // 5. Golden Flash FX
    const flash = $('nectar-flash');
    if (flash) {
      flash.classList.add('show');
      setTimeout(() => flash.classList.remove('show'), 650);
    }

    // 6. Terminal notification
    say('nona', '🍯 NECTAR FIESTA! Cubbon Park sugar harvest! 720° acrobatic barrel roll initiated. +1.0 Dopamine burst!', 'good');
  }

  // Mascot UI Button bindings
  if ($('btn-hunt-nectar')) {
    $('btn-hunt-nectar').onclick = () => {
      playSoundChime('buzz');
      flyTo('cubbon');
      setMascotSpeech(
        `"Locking onto <b>Cubbon Park</b>! 100% organic bamboo nectar blossoms ahead! Get ready for the victory roll!"`,
        '🚀 EN ROUTE',
        false
      );
    };
  }

  if ($('btn-avoid-traffic')) {
    $('btn-avoid-traffic').onclick = () => {
      playSoundChime('buzz');
      // 1. Train negative valence into Mushroom body via PPL1 dopamine avoidance
      mb.teach('traffic', -1);
      state.cue = 'traffic';
      state.explicitGoal = null;

      // 2. Point compass toward traffic initially to trigger the collision avoidance reflex
      const b = world.bearingTo('traffic');
      if (b !== null) {
        cueAngle = b;
        compass.setCue(b, 0.95);
      }
      world.manualMode = false;
      updateFlightModeUI(false);

      setMascotSpeech(
        `"🚨 <b>TRAFFIC HAZARD DETECTED!</b> 100 Feet Road autos ahead! PPL1 dopamine avoidance fired! Watch me flip heading <b>180° away</b>!"`,
        '🚗 AVOIDANCE REFLEX',
        false
      );
      say('nona', '⚠️ Traffic avoidance reflex engaged. PPL1 dopamine depressed approach synapses. Steering 180° away from 100 Feet Road vehicles!', 'bad');
      renderRadarWaypoints();
    };
  }

  if ($('btn-stunt-now')) {
    $('btn-stunt-now').onclick = () => {
      world.doStunt('barrel_roll', 2.8);
      playSoundChime('chime');
      setMascotSpeech(
        `"Wheeeee! 720° Corkscrew barrel roll in action! Rate my aerobatics, human!"`,
        '🔄 360° STUNT',
        true
      );
    };
  }

  if ($('btn-mascot-talk')) {
    $('btn-mascot-talk').onclick = () => triggerRandomSassyQuote();
  }

  if ($('mascot-close-btn')) {
    $('mascot-close-btn').onclick = (e) => {
      e.stopPropagation();
      const b = $('mascot-bubble');
      if (b) b.style.display = 'none';
    };
  }

  if ($('mascot-avatar')) {
    $('mascot-avatar').onclick = () => {
      const b = $('mascot-bubble');
      if (b && b.style.display === 'none') {
        b.style.display = '';
      }
      triggerRandomSassyQuote();
    };
  }

  window.triggerCubbonNectarParty = triggerCubbonNectarParty;
  window.triggerNectarRush = triggerCubbonNectarParty;
  window.setMascotSpeech = setMascotSpeech;


  // Tactical GPS Mini-Map & Console Radar Instances
  const getFlyMapState = () => ({
    pos: world.pos,
    heading: world.heading,
    theta: compass.heading().theta,
    strength: compass.heading().strength,
    trail: world.trail,
    speed: world.speed,
    goal: state.goal,
    valences: Object.fromEntries(LANDMARKS.map((L) => [L.key, mb.valence(L.key)])),
  });

  const miniMapCanvas = $('minimap-canvas');
  const miniMap = miniMapCanvas ? new TacticalMap({
    canvas: miniMapCanvas,
    landmarks: LANDMARKS,
    getFlyState: getFlyMapState,
    onSelectLandmark: (key) => flyTo(key),
    onSelectWaypoint: (x, z) => setCustomWaypoint(x, z),
  }) : null;

  const fullRadarCanvas = $('radar-canvas-full');
  const fullRadar = fullRadarCanvas ? new TacticalMap({
    canvas: fullRadarCanvas,
    landmarks: LANDMARKS,
    getFlyState: getFlyMapState,
    onSelectLandmark: (key) => flyTo(key),
    onSelectWaypoint: (x, z) => setCustomWaypoint(x, z),
  }) : null;

  // Mini-Map Controls & Folding
  const toggleFoldMiniMap = () => {
    const card = $('minimap-card');
    if (!card) return;
    const folded = card.classList.toggle('folded');
    if ($('mm-fold-btn')) $('mm-fold-btn').textContent = folded ? '▲' : '▾';
  };
  if ($('mm-fold-btn')) $('mm-fold-btn').onclick = toggleFoldMiniMap;
  if ($('mm-status-pill')) $('mm-status-pill').onclick = toggleFoldMiniMap;

  if ($('mm-traffic-btn')) {
    $('mm-traffic-btn').onclick = () => {
      if (miniMap) {
        const on = miniMap.toggleTraffic();
        $('mm-traffic-btn').style.opacity = on ? '1' : '0.45';
        $('mm-traffic-btn').style.color = on ? '#b91c1c' : '#64748b';
      }
    };
  }

  if ($('mm-mode-btn')) {
    $('mm-mode-btn').onclick = () => {
      if (miniMap) {
        const m = miniMap.toggleMode();
        $('mm-mode-btn').textContent = m === 'north-up' ? 'N-UP' : 'HDG-UP';
      }
    };
  }
  if ($('mm-zoom-out')) {
    $('mm-zoom-out').onclick = () => {
      if (miniMap) miniMap.setZoom(-0.25);
    };
  }
  if ($('mm-zoom-in')) {
    $('mm-zoom-in').onclick = () => {
      if (miniMap) miniMap.setZoom(+0.25);
    };
  }
  if ($('mm-max-btn')) {
    $('mm-max-btn').onclick = () => {
      const card = $('minimap-card');
      if (!card) return;
      const isMax = card.classList.toggle('maximized');
      const cv = $('minimap-canvas');
      if (cv) {
        cv.width = isMax ? 480 : 250;
        cv.height = isMax ? 420 : 230;
      }
      $('mm-max-btn').textContent = isMax ? '✕' : '⛶';
    };
  }

  // Full Radar Tab Controls
  if ($('tab-map-mode')) {
    $('tab-map-mode').onclick = () => {
      if (fullRadar) {
        const m = fullRadar.toggleMode();
        $('tab-map-mode').textContent = m === 'north-up' ? 'N-UP' : 'HDG-UP';
      }
    };
  }
  if ($('tab-map-zoom-out')) {
    $('tab-map-zoom-out').onclick = () => {
      if (fullRadar) fullRadar.setZoom(-0.25);
    };
  }
  if ($('tab-map-zoom-in')) {
    $('tab-map-zoom-in').onclick = () => {
      if (fullRadar) fullRadar.setZoom(+0.25);
    };
  }
  if ($('tab-map-center')) {
    $('tab-map-center').onclick = () => {
      if (fullRadar) {
        fullRadar.centerOnFly = !fullRadar.centerOnFly;
        $('tab-map-center').textContent = fullRadar.centerOnFly ? 'Center' : 'City View';
      }
    };
  }
  if ($('tab-map-traffic')) {
    $('tab-map-traffic').onclick = () => {
      if (fullRadar) {
        const on = fullRadar.toggleTraffic();
        $('tab-map-traffic').style.opacity = on ? '1' : '0.45';
      }
    };
  }

  // Render Landmark Waypoint Cards in Radar Tab
  function renderRadarWaypoints() {
    const list = $('rtw-list');
    if (!list) return;
    list.innerHTML = LANDMARKS.map((L) => {
      const mark = world.marks.find((m) => m.key === L.key);
      const dist = mark ? world.pos.distanceTo(mark.vec).toFixed(0) : '—';
      const b = world.bearingTo(L.key);
      const bDeg = b !== null ? `${(((b * 180) / Math.PI + 360) % 360).toFixed(0)}°` : '—';
      const v = mb.valence(L.key);
      const vStr = v > 0.05 ? `+${v.toFixed(2)}` : v < -0.05 ? `${v.toFixed(2)}` : `0.00`;
      const vColor = v > 0.05 ? 'var(--accent)' : v < -0.05 ? 'var(--pink)' : 'var(--faint)';
      const isActive = state.goal === L.key;
      const icon = L.key === 'home' ? '🏠' :
                   L.key === 'cubbon' ? '🌳' :
                   L.key === 'vidhana' ? '🏛️' :
                   L.key === 'ubcity' ? '🏢' :
                   L.key === 'lalbagh' ? '🌸' : '🚗';

      return `
        <div class="rtw-card ${isActive ? 'active' : ''}" data-key="${L.key}">
          <div class="rtw-icon">${icon}</div>
          <div class="rtw-info">
            <div class="rtw-name">
              <span>${L.label}</span>
              ${isActive ? '<span class="mast-badge">LOCKED</span>' : ''}
            </div>
            <div class="rtw-sub">${L.sub}</div>
            <div class="rtw-stats">RANGE: ${dist}m · BRG: ${bDeg} · VALENCE: <span style="color:${vColor}">${vStr}</span></div>
          </div>
          <button class="rtw-btn" data-fly="${L.key}">
            ${isActive ? 'FLYING ✈' : 'LOCK ➔'}
          </button>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.rtw-btn').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        flyTo(btn.getAttribute('data-fly'));
      };
    });
    list.querySelectorAll('.rtw-card').forEach((card) => {
      card.onclick = () => {
        flyTo(card.getAttribute('data-key'));
      };
    });
  }

  // On-Screen Steering Buttons
  const bindHoldBtn = (id, keyName) => {
    const el = $(id);
    if (!el) return;
    const press = (e) => {
      e.preventDefault();
      state.explicitGoal = null;
      destBtns.forEach((b) => b.classList.remove('active'));
      world.manualMode = true;
      updateFlightModeUI(true);
      world.keys[keyName] = true;
    };
    const release = (e) => {
      e.preventDefault();
      world.keys[keyName] = false;
    };
    el.addEventListener('pointerdown', press);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointerleave', release);
  };
  bindHoldBtn('ctrl-left', 'a');
  bindHoldBtn('ctrl-right', 'd');
  bindHoldBtn('ctrl-boost', 'w');

  let last = performance.now();
  let wander = 0;
  let atHome = 0;
  const perf = { frames: 0, since: performance.now(), fps: 0 };
  let cueAngle = 0;
  let smoothHeading = world.heading;
  const slew = (from, to, rate) => {
    const d = ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    return from + Math.max(-rate, Math.min(rate, d));
  };

  // Main Simulation & Render Loop
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    // Inside the computer room
    if (state.inside) {
      for (let i = 0; i < 8; i++) compass.step(1.0);
      room.render(dt);
      desk.update();
      requestAnimationFrame(frame);
      return;
    }

    const goal = chooseGoal();
    state.goal = goal ? goal.key : null;

    let goalDist = Infinity;
    if (goal) {
      const b = world.bearingTo(goal.key);
      if (b !== null) {
        const mark = world.marks.find((m) => m.key === goal.key);
        goalDist = mark ? world.pos.distanceTo(mark.vec) : Infinity;

        // When nearing non-home landmark (< 55m), enter an orbital patrol circle so Nona doesn't overshoot
        let targetBearing = b;
        if (goalDist < 52 && !goal.avoid && goal.key !== 'home') {
          targetBearing = b + Math.PI * 0.42; // Orbit gracefully around landmark
        } else if (goal.avoid) {
          targetBearing = b + Math.PI;
        }

        cueAngle = slew(cueAngle, targetBearing, 2.4 * dt);
        compass.setCue(cueAngle, Math.min(1, Math.abs(goal.v)));
      }
    } else {
      wander -= dt;
      if (wander <= 0) {
        wander = 2.8 + Math.random() * 3.2;
        cueAngle = Math.random() * Math.PI * 2;
      }
      compass.setCue(cueAngle, 0.45);
    }

    // Connectome execution (8 ms of neural time per frame)
    if (world.manualMode) {
      // Connectome coupling during manual flight:
      // Turn rate feeds into PEN angular velocity integration neurons
      const k = world.keys || {};
      const turnDrive = (k['a'] || k['arrowleft'] ? 0.8 : 0) - (k['d'] || k['arrowright'] ? 0.8 : 0);
      compass.setTurn(turnDrive);
      smoothHeading = world.heading;
    } else {
      compass.setTurn(0);
    }

    for (let i = 0; i < 8; i++) compass.step(1.0);

    const h = compass.heading();
    // Smooth biological heading: filter out neural spike micro-jitter
    if (h.strength > 0.08) {
      const d = ((h.theta - smoothHeading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      smoothHeading += d * Math.min(1, dt * 5.5);
    }
    const heading = smoothHeading;
    const arrive = Math.max(0.35, Math.min(1, (goalDist - 25) / 80));
    const autoSpeed = (28 + (h.strength > 0.1 ? h.strength : 0.4) * 32) * (goal ? arrive : 1);

    // Update flight dynamics (world handles manual pilot vs autopilot internally)
    world.update(dt, heading, autoSpeed, state.goal);
    world.render();

    // Update Flight Mode pill state if user tapped flight keys
    updateFlightModeUI(world.manualMode);

    // 2D HUD update
    const act = state.cue ? mb.mbonActivity(state.cue) : new Float32Array(mb.mbon.length);
    let mx = 0;
    for (const v of act) mx = Math.max(mx, v);
    hud.draw({
      epg: compass.epg.map((i) => ({ angle: compass.angle[i], rate: compass.net.rate[i] })),
      delta7: compass.delta7.map((i) => ({ angle: compass.angle[i], rate: compass.net.rate[i] })),
      theta: h.theta,
      strength: h.strength,
      epgRate: compass.epgRate(),
      lesioned: state.lesioned,
      scrambled: state.scrambled,
      mbon: Array.from(act, (v) => (mx > 0 ? v / mx : 0)),
      mbonSign: Array.from(mb.mbonSign),
      valence: state.cue ? mb.valence(state.cue) : 0,
      cue: state.cue,
      kcActive: state.cue ? new Set(mb.encode(state.cue)) : null,
      kcTotal: mb.kc.length,
      changed: mb.changedSynapses(),
    });

    // 3D Brain update
    if (brain3d) {
      let peak = 1;
      for (const i of compass.epg) peak = Math.max(peak, compass.net.rate[i]);
      for (let i = 0; i < CORE_N; i++) rateBuf[i] = compass.net.rate[i];

      const lm = goal ? cueAngle : null;
      let off = CORE_N;
      for (let j = 0; j < erMeta.length; j++) {
        let r = 0;
        if (lm != null) {
          const d = ((erMeta[j].pref - lm + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          r = peak * 0.8 * Math.exp(-(d * d) / 0.5);
        }
        rateBuf[off + j] = r;
      }

      off += erMeta.length;
      const hd = h.strength > 0.1 ? h.theta : null;
      for (let j = 0; j < pflMeta.length; j++) {
        rateBuf[off + j] = hd != null ? Math.max(0, Math.cos(pflMeta[j].azi - hd)) * h.strength * peak : 0;
      }
      brain3d.setActivity(rateBuf, peak);
      brain3d.render(dt);
    }

    // Telemetry & readouts
    const near = world.nearest();

    // Cubbon Park Nectar Stunt Trigger (Triggers during both autopilot & manual navigation)
    if (near && near.mark && near.mark.key === 'cubbon' && near.dist < 58 && !cubbonStuntDone) {
      cubbonStuntDone = true;
      triggerCubbonNectarParty();
    } else if (near && near.mark && (near.mark.key !== 'cubbon' || near.dist > 120)) {
      cubbonStuntDone = false;
    }

    const headingDeg = h.strength > 0.1 ? `${(((h.theta * 180) / Math.PI + 360) % 360).toFixed(0)}°` : '—';
    if ($('near')) $('near').textContent = `${near.mark.label} · ${near.dist.toFixed(0)}m`;
    if ($('heading')) $('heading').textContent = headingDeg;
    if ($('stat-heading')) $('stat-heading').textContent = headingDeg;
    if ($('goal')) $('goal').textContent = state.goal
      ? (LANDMARKS.find((L) => L.key === state.goal) || {}).label || state.goal
      : 'nothing yet';
    if ($('airspeed')) $('airspeed').textContent = `${(world.speed * 0.95).toFixed(0)} km/h`;
    if ($('altitude')) $('altitude').textContent = `${world.pos.y.toFixed(0)} m`;

    if ($('stat-lit')) {
      let lit = 0;
      for (let i = 0; i < rateBuf.length; i++) {
        if (rateBuf[i] > 1.2) lit++;
      }
      $('stat-lit').textContent = lit;
    }

    if ($('inspector') && !$('inspector').classList.contains('hidden') && $('ins-rate')) {
      let r = 0;
      if (inspectedNeuronType === 'EPG') r = compass.epgRate();
      else if (inspectedNeuronType === 'Delta7') {
        let sum = 0;
        for (const idx of compass.delta7) sum += compass.net.rate[idx];
        r = compass.delta7.length ? sum / compass.delta7.length : 0;
      } else {
        r = compass.epgRate() * 0.72;
      }
      $('ins-rate').textContent = `${r.toFixed(1)} Hz`;
    }

    // Proximity to 2586Labs auto-dock
    if (near.mark.home && near.dist < 55 && !world.manualMode && (state.goal === 'home' || atHome > 0)) {
      atHome += dt;
      if (homeArmed && atHome > 0.4) {
        enterHome();
        homeArmed = false;
      }
    } else {
      atHome = 0;
      if (!near.mark.home || near.dist > 75) homeArmed = true;
    }

    // Update Tactical Mini-Map and Radar Tab
    if (miniMap && $('minimap-card') && !$('minimap-card').classList.contains('folded')) {
      miniMap.render(dt);
      const mmCoords = $('mm-coords');
      if (mmCoords) {
        mmCoords.textContent = `X: ${world.pos.x.toFixed(0)}m · Z: ${world.pos.z.toFixed(0)}m · ALT: ${world.pos.y.toFixed(0)}m`;
      }
      const mmTarget = $('mm-target');
      if (mmTarget) {
        const goalLandmark = LANDMARKS.find((l) => l.key === state.goal);
        mmTarget.textContent = goalLandmark ? `LOCK: ${goalLandmark.label.toUpperCase()}` : (miniMap.customWaypoint ? 'WAYPOINT LOCK' : 'FREE ROAM');
      }
    }
    if (fullRadar && $('tab-map') && $('tab-map').classList.contains('active')) {
      fullRadar.render(dt);
    }

    perf.frames++;
    if (now - perf.since > 1000) {
      perf.fps = Math.round((perf.frames * 1000) / (now - perf.since));
      perf.frames = 0;
      perf.since = now;
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Command Execution Pipeline
  function runCommand(raw) {
    const trimmed = raw.trim();
    const lower = trimmed.toLowerCase();
    const parts = lower.split(/\s+/);
    const cmd = parts[0];
    const arg = parts.slice(1).join(' ');

    // 1. HELP / ? / COMMANDS
    if (cmd === 'help' || cmd === '?' || cmd === 'commands') {
      return {
        tone: 'hint',
        text: `AVAILABLE CONNECTOME CLI COMMANDS:
• fly <dest>        Lock autopilot to landmark (home, cubbon, vidhana, ubcity, lalbagh)
• teach <word>      Associate sensory cue with nearest landmark in Mushroom Body
• reward / good     Trigger DAN dopamine burst to reinforce association (+valence)
• punish / bad      Trigger avoidance dopamine burst (-valence)
• status / top      Dump real-time Central Complex & Mushroom Body telemetry
• scan / radar      Airspace scan: range & bearing to all landmarks
• lesion delta7     Toggle Delta7 ring inhibitory population
• scramble          Shuffle synaptic wiring graph (structural control)
• forget / reset    Reset all Mushroom Body synapses to naive
• mode auto|manual  Toggle biological autopilot vs manual pilot
• theme light|dusk  Toggle daylight lighting
• dock / exit       Enter or leave 2586Labs workstation
• clear / cls       Clear terminal output buffer
[Tips: Use Up/Down for command history, Tab to autocomplete, Ctrl+L to clear]`
      };
    }

    // 2. CLEAR / CLS
    if (cmd === 'clear' || cmd === 'cls') {
      const log = $('log');
      if (log) log.innerHTML = '';
      return { tone: 'hint', text: 'Terminal buffer cleared. Nona connectome ready.' };
    }

    // 3. STATUS / TOP / PS
    if (cmd === 'status' || cmd === 'top' || cmd === 'ps') {
      const h = compass.heading();
      const deg = (((h.theta * 180) / Math.PI + 360) % 360).toFixed(0);
      const near = world.nearest();
      const st = mb.stats();
      const changed = mb.changedSynapses();
      const rows = LANDMARKS.map((L) => {
        const v = mb.valence(L.key);
        const sign = v > 0.05 ? `+${v.toFixed(2)} [reward]` : v < -0.05 ? `${v.toFixed(2)} [avoid]` : ` 0.00 [naive]`;
        return `  • ${L.label.padEnd(16)}: ${sign}`;
      }).join('\n');

      return {
        tone: 'epg',
        text: `CONNECTOME TELEMETRY SNAPSHOT:
[Central Complex Ring Attractor]
• Heading Bump: ${deg}° (theta ${h.theta.toFixed(2)} rad) · Strength: ${h.strength.toFixed(2)}
• EPG Rate: ${compass.epgRate().toFixed(1)} Hz · Delta7 Lesion: ${state.lesioned ? 'ACTIVE (LOST NORTH)' : 'None'} · Scramble: ${state.scrambled ? 'ACTIVE' : 'Off'}
[Flight Dynamics]
• Mode: ${world.manualMode ? 'Manual Pilot' : 'Biological Autopilot'} · Airspeed: ${(world.speed * 0.95).toFixed(0)} km/h · Alt: ${world.pos.y.toFixed(0)}m
• Target Goal: ${state.goal || 'None (Wandering)'} · Nearest: ${near.mark.label} (${near.dist.toFixed(0)}m)
[Mushroom Body Associative Memory]
• Kenyon Cells: ${st.kc} · MBONs: ${st.mbon} · DANs: ${st.dan} · Synapses Changed: ${changed}
• Landmark Valences:
${rows}`
      };
    }

    // 4. SCAN / RADAR / AIRSPACE
    if (cmd === 'scan' || cmd === 'radar' || cmd === 'landmarks') {
      const scanLines = LANDMARKS.map((L) => {
        const mark = world.marks.find((m) => m.key === L.key);
        if (!mark) return null;
        const d = world.pos.distanceTo(mark.vec);
        const b = world.bearingTo(L.key);
        const bDeg = b !== null ? (((b * 180) / Math.PI + 360) % 360).toFixed(0) + '°' : '—';
        const v = mb.valence(L.key);
        const vStr = v > 0.05 ? `+${v.toFixed(2)}` : v < -0.05 ? `${v.toFixed(2)}` : ` 0.00`;
        return `  • ${L.label.padEnd(16)}: dist ${d.toFixed(0).padStart(4)}m · bearing ${bDeg.padStart(4)} · valence ${vStr}`;
      }).filter(Boolean).join('\n');

      return {
        tone: 'nav',
        text: `AIRSPACE SENSORY RADAR SCAN:
${scanLines}`
      };
    }

    // 5. FLY / GOTO
    if (cmd === 'fly' || cmd === 'goto' || (cmd === 'go' && arg && !['home', 'cubbon', 'vidhana', 'ubcity', 'lalbagh'].includes(arg))) {
      const target = resolve(arg) || arg.trim();
      const L = LANDMARKS.find((x) => x.key === target);
      if (!L) {
        return { tone: 'hint', text: `Unknown destination "${arg}". Available: home, cubbon, vidhana, ubcity, lalbagh.` };
      }
      flyTo(L.key);
      const mark = world.marks.find((m) => m.key === L.key);
      const dist = mark ? world.pos.distanceTo(mark.vec).toFixed(0) : '—';
      return { tone: 'good', text: `🚀 Nav locked on ${L.label} (range ${dist}m). Autopilot engaged, connectome steering!` };
    }

    // 6. TEACH / LEARN / ASSOCIATE
    if (cmd === 'teach' || cmd === 'learn' || cmd === 'associate') {
      const word = resolve(arg) || arg.trim();
      if (!word) return { tone: 'hint', text: 'Usage: teach <landmark|word> (e.g. "teach home", "teach vidhana")' };
      state.cue = word;
      const L = LANDMARKS.find((x) => x.key === word);
      if (L) {
        const b = world.bearingTo(L.key);
        if (b !== null) compass.setCue(b, 0.6);
      }
      const near = world.nearest();
      return { tone: 'hint', text: `🏷️ Sensory cue "${word}" bound to connectome near ${near.mark.label}. Now reinforce with "reward" / "good girl".` };
    }

    // 7. REWARD / GOOD
    if (cmd === 'reward' || (cmd === 'good' && !arg)) {
      const target = state.cue || 'home';
      const n = mb.teach(target, +1);
      state.cue = target;
      return { tone: 'good', text: `Dopamine burst. ${n.toLocaleString('en-US')} KC→MBON synapses depressed in reward compartments. "${target}" valence is now +${mb.valence(target).toFixed(2)}.` };
    }

    // 8. PUNISH / BAD
    if (cmd === 'punish' || (cmd === 'bad' && !arg)) {
      const target = state.cue || 'traffic';
      const n = mb.teach(target, -1);
      state.cue = target;
      return { tone: 'bad', text: `Punishment signal. ${n.toLocaleString('en-US')} synapses depressed in avoidance compartments. "${target}" valence is now ${mb.valence(target).toFixed(2)}.` };
    }

    // 8.5. STUNT / NECTAR
    if (cmd === 'stunt' || cmd === 'roll' || cmd === 'barrel_roll') {
      world.doStunt('barrel_roll', 2.8);
      playSoundChime('chime');
      setMascotSpeech(
        `"Wheeeee! 720° Corkscrew barrel roll in action! Rate my aerobatics, human!"`,
        '🔄 360° STUNT',
        true
      );
      return { tone: 'good', text: '🔄 720° Corkscrew barrel roll executed in Bangalore airspace!' };
    }

    if (cmd === 'nectar' || cmd === 'hunt_nectar' || cmd === 'sugar_rush') {
      flyTo('cubbon');
      setTimeout(() => triggerCubbonNectarParty(), 900);
      return { tone: 'good', text: '🍯 Nectar mission engaged! Steering to Cubbon Park & triggering victory stunt.' };
    }

    // 9. LESION
    if (cmd === 'lesion') {
      state.lesioned = !state.lesioned;
      compass.lesionDelta7(state.lesioned);
      const btn = $('lesion');
      if (btn) btn.classList.toggle('on', state.lesioned);
      return {
        tone: state.lesioned ? 'bad' : 'good',
        text: state.lesioned
          ? '⚡ Delta7 inhibitory ring population silenced. Bump smeared — compass lost north.'
          : '✅ Delta7 population restored. Ring attractor heading re-formed.'
      };
    }

    // 10. SCRAMBLE
    if (cmd === 'scramble') {
      state.scrambled = !state.scrambled;
      compass.scramble(state.scrambled);
      const btn = $('scramble');
      if (btn) btn.classList.toggle('on', state.scrambled);
      return {
        tone: state.scrambled ? 'bad' : 'good',
        text: state.scrambled
          ? '⚡ Connectome wiring shuffled (degree-preserving control). Bump destroyed.'
          : '✅ Real Janelia/Google connectome wiring restored.'
      };
    }

    // 11. FORGET
    if (cmd === 'forget' || cmd === 'reset' || cmd === 'unlearn') {
      mb.forget();
      state.cue = null;
      state.explicitGoal = null;
      destBtns.forEach((b) => b.classList.remove('active'));
      return { tone: 'hint', text: '🧹 All Mushroom Body KC→MBON synapses reset to naive (valence 0.00).' };
    }

    // 12. MODE
    if (cmd === 'mode') {
      const targetMode = arg.includes('man') ? true : arg.includes('auto') ? false : !world.manualMode;
      world.manualMode = targetMode;
      updateFlightModeUI(targetMode);
      if (targetMode) {
        state.explicitGoal = null;
        destBtns.forEach((b) => b.classList.remove('active'));
      }
      return { tone: 'hint', text: targetMode ? 'Manual flight engaged (WASD / Arrows to steer).' : 'Biological Autopilot engaged (connectome steering).' };
    }

    // 13. THEME
    if (cmd === 'theme') {
      const next = arg.includes('light') ? 'light' : arg.includes('dusk') || arg.includes('dark') ? 'dusk' : (world.theme === 'light' ? 'dusk' : 'light');
      world.setTheme(next);
      document.body.classList.toggle('theme-dusk', next === 'dusk');
      const btn = $('btn-theme');
      if (btn) btn.textContent = next === 'light' ? '☀️ Light Theme' : '🌙 Dusk Theme';
      return { tone: 'hint', text: `Environment theme set to ${next}.` };
    }

    // 14. DOCK / LAB
    if (cmd === 'dock' || cmd === 'lab' || (cmd === 'enter' && arg.includes('lab'))) {
      enterHome();
      return { tone: 'good', text: 'Entering 2586Labs workstation...' };
    }

    // 15. EXIT / TAKEOFF
    if (cmd === 'exit' || cmd === 'takeoff') {
      if (state.inside) {
        exitHome();
        return { tone: 'good', text: 'Exiting workstation and taking off into Bangalore sky...' };
      }
      return { tone: 'hint', text: 'Already airborne over Bangalore.' };
    }

    // 16. Fall back to natural language associative parser
    const p = parse(raw);
    const near = world.nearest();

    switch (p.kind) {
      case 'name': {
        state.cue = p.word;
        const L = LANDMARKS.find((x) => x.key === p.word);
        if (L) compass.setCue(world.bearingTo(L.key) ?? 0, 0.6);
        return { tone: 'hint', text: `She looks at ${near.mark.label}. "${p.word}" means nothing to her yet — reward it.` };
      }
      case 'cue': {
        state.cue = p.word;
        const v = mb.valence(p.word);
        const L = LANDMARKS.find((x) => x.key === p.word);
        if (v > 0.12) {
          if (L) {
            state.explicitGoal = L.key;
            destBtns.forEach((b) => b.classList.toggle('active', b.getAttribute('data-place') === L.key));
            const b = world.bearingTo(L.key);
            if (b !== null) {
              cueAngle = b;
              compass.setCue(b, 0.95);
            }
          }
          if (world.manualMode) {
            world.manualMode = false;
            updateFlightModeUI(false);
          }
          return { tone: 'good', text: `She knows "${p.word}" — Autopilot engaged, turning toward ${L ? L.label : p.word}. (valence +${v.toFixed(2)})` };
        }
        if (v < -0.12) {
          if (world.manualMode) {
            world.manualMode = false;
            updateFlightModeUI(false);
          }
          return { tone: 'bad', text: `She flinches at "${p.word}" — Autopilot avoiding ${L ? L.label : p.word}. (valence ${v.toFixed(2)})` };
        }
        return { tone: 'hint', text: `"${p.word}" is just a sound to her (valence 0.00). First teach her: "this is home" then "good girl" near the place!` };
      }
      case 'reward': {
        const target = p.word || state.cue;
        if (!target) return { tone: 'hint', text: 'She perks up, but about what? Name something first.' };
        const n = mb.teach(target, +1);
        state.cue = target;
        return { tone: 'good', text: `Dopamine. ${n.toLocaleString('en-US')} KC→MBON synapses depressed in reward compartments. "${target}" now reads ${mb.valence(target).toFixed(2)}.` };
      }
      case 'punish': {
        const target = p.word || state.cue;
        if (!target) return { tone: 'hint', text: 'She cowers slightly. But about what? Name something first.' };
        const n = mb.teach(target, -1);
        state.cue = target;
        return { tone: 'bad', text: `Punishment signal. ${n.toLocaleString('en-US')} synapses depressed in punishment compartments. "${target}" now reads ${mb.valence(target).toFixed(2)}.` };
      }
      case 'forget':
        mb.forget();
        state.cue = null;
        return { tone: 'hint', text: 'Every synapse back to naive. She remembers nothing.' };
      default:
        return { tone: 'hint', text: 'She tilts her head. Try: "help", "status", "fly home", "good girl", "scan".' };
    }
  }

  function heard(raw) {
    say('you', raw);
    const parts = raw.split(/[·;,\n]+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length > 1) {
      for (const part of parts) {
        const r = runCommand(part);
        if (r && r.text) say('nona', r.text, r.tone);
      }
    } else {
      const r = runCommand(raw);
      if (r && r.text) say('nona', r.text, r.tone);
    }
  }

  // Live Command Preview & Suggestion Chips
  const previewEl = $('say-preview');
  const updateSayPreview = (text) => {
    if (!previewEl) return;
    const t = text.trim();
    if (!t) {
      previewEl.className = 'say-preview';
      previewEl.innerHTML = '💡 Type or click a chip to teach Nona\'s connectome';
      return;
    }
    const lower = t.toLowerCase();
    const parts = lower.split(/\s+/);
    const cmd = parts[0];
    const arg = parts.slice(1).join(' ');

    previewEl.className = 'say-preview active';
    if (cmd === 'help' || cmd === '?') {
      previewEl.innerHTML = `💻 <b>CLI Help:</b> Display cybernetic connectome command list`;
      return;
    }
    if (cmd === 'status' || cmd === 'top' || cmd === 'ps') {
      previewEl.innerHTML = `📊 <b>Telemetry:</b> Real-time Central Complex heading & Mushroom Body valences`;
      return;
    }
    if (cmd === 'scan' || cmd === 'radar') {
      previewEl.innerHTML = `📡 <b>Radar Scan:</b> Airspace range & bearing to all Bangalore landmarks`;
      return;
    }
    if (cmd === 'fly' || cmd === 'goto') {
      const target = resolve(arg) || arg;
      const L = LANDMARKS.find((x) => x.key === target);
      previewEl.innerHTML = `🚀 <b>Autopilot Lock:</b> Steer directly toward ${L ? L.label : target}`;
      return;
    }
    if (cmd === 'teach' || cmd === 'learn') {
      previewEl.innerHTML = `🏷️ <b>Bind Sensory Cue:</b> Associate "${arg || '...'}" with nearest landmark`;
      return;
    }
    if (cmd === 'reward') {
      previewEl.innerHTML = `🍬 <b>Dopamine Burst:</b> Depress KC→MBON synapses for "${state.cue || 'current cue'}"`;
      return;
    }
    if (cmd === 'punish') {
      previewEl.innerHTML = `⚡ <b>Punishment Signal:</b> Reinforce avoidance compartments`;
      return;
    }
    if (cmd === 'clear' || cmd === 'cls') {
      previewEl.innerHTML = `🧹 <b>Clear Buffer:</b> Flush terminal screen log`;
      return;
    }

    const p = parse(t);
    switch (p.kind) {
      case 'name':
        previewEl.innerHTML = `🏷️ <b>Name Landmark:</b> "${p.word}" maps to current location`;
        break;
      case 'reward':
        previewEl.innerHTML = `🍬 <b>Dopamine Reward:</b> Depresses KC→MBON synapses (+valence)`;
        break;
      case 'punish':
        previewEl.innerHTML = `⚡ <b>Punishment Signal:</b> Reinforces avoidance compartments`;
        break;
      case 'cue': {
        const v = mb.valence(p.word);
        previewEl.innerHTML = `🚀 <b>Navigation Cue:</b> "${p.word}" (valence: ${v >= 0 ? '+' : ''}${v.toFixed(2)}) → Engages Autopilot`;
        break;
      }
      case 'forget':
        previewEl.innerHTML = `🧹 <b>Reset Synapses:</b> Clears all learned associations to naive`;
        break;
      default:
        previewEl.innerHTML = `💬 <b>Command:</b> "${t}"`;
    }
  };

  if ($('say')) $('say').oninput = (e) => updateSayPreview(e.target.value);

  // Command History Buffer & Autocomplete
  const cmdHistory = [];
  let historyIndex = -1;

  const AUTOCOMPLETE_LIST = [
    'help', 'status', 'scan', 'radar',
    'fly home', 'fly cubbon', 'fly vidhana', 'fly ubcity', 'fly lalbagh',
    'teach home', 'teach cubbon', 'teach vidhana', 'teach ubcity', 'teach lalbagh',
    'reward', 'punish', 'good girl', 'bad girl', 'this is home', 'go home',
    'lesion delta7', 'scramble', 'forget', 'theme light', 'theme dusk',
    'mode auto', 'mode manual', 'dock', 'exit', 'clear'
  ];

  if ($('say')) {
    $('say').onkeydown = (e) => {
      if (e.key === 'Enter') {
        if ($('send')) $('send').click();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (cmdHistory.length === 0) return;
        if (historyIndex === -1) historyIndex = cmdHistory.length - 1;
        else if (historyIndex > 0) historyIndex--;
        $('say').value = cmdHistory[historyIndex];
        updateSayPreview($('say').value);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex >= 0 && historyIndex < cmdHistory.length - 1) {
          historyIndex++;
          $('say').value = cmdHistory[historyIndex];
        } else {
          historyIndex = -1;
          $('say').value = '';
        }
        updateSayPreview($('say').value);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const cur = $('say').value.toLowerCase().trim();
        if (!cur) return;
        const match = AUTOCOMPLETE_LIST.find((c) => c.startsWith(cur) && c !== cur);
        if (match) {
          $('say').value = match;
          updateSayPreview(match);
        }
      } else if (e.key.toLowerCase() === 'l' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if ($('log')) $('log').innerHTML = '';
        say('nona', 'Terminal buffer cleared.', 'hint');
      }
    };
  }

  document.querySelectorAll('.sc-btn').forEach((btn) => {
    btn.onclick = () => {
      const text = btn.getAttribute('data-fill');
      if ($('say')) {
        $('say').value = text;
        updateSayPreview(text);
      }
      heard(text);
      setTimeout(() => {
        if ($('say')) $('say').value = '';
        updateSayPreview('');
      }, 400);
    };
  });

  if ($('send')) {
    $('send').onclick = () => {
      const v = $('say') ? $('say').value.trim() : '';
      if (!v) return;
      if (cmdHistory.length === 0 || cmdHistory[cmdHistory.length - 1] !== v) {
        cmdHistory.push(v);
      }
      historyIndex = -1;
      if ($('say')) $('say').value = '';
      updateSayPreview('');
      heard(v);
    };
  }

  // Panel Mode Tabs (Split / Full CMD Terminal / 3D Brain)
  const panel = $('panel');
  const modeTabs = document.querySelectorAll('.pm-tab');
  let setBig = null;

  function setPanelMode(mode) {
    if (!panel) return;
    panel.classList.remove('mode-split', 'mode-terminal', 'mode-brain');
    panel.classList.add(`mode-${mode}`);
    modeTabs.forEach((tab) => tab.classList.toggle('active', tab.getAttribute('data-mode') === mode));
    if (mode === 'brain') {
      if (setBig) setBig(true);
    } else {
      if (setBig) setBig(false);
    }
    resize();
  }
  modeTabs.forEach((tab) => {
    tab.onclick = () => setPanelMode(tab.getAttribute('data-mode'));
  });

  // Fluctfly Console Tabs (CMD | MAP | TEACH | COMPASS | OPTICS)
  const consoleTabs = document.querySelectorAll('.c-tab');
  const consolePanels = document.querySelectorAll('.c-panel');
  function setConsoleTab(tabKey) {
    consoleTabs.forEach((b) => b.classList.toggle('active', b.getAttribute('data-tab') === tabKey));
    consolePanels.forEach((p) => p.classList.toggle('active', p.id === `tab-${tabKey}`));
    if (tabKey === 'compass') {
      requestAnimationFrame(() => resize());
    }
    if (tabKey === 'map') {
      renderRadarWaypoints();
      if (fullRadarCanvas && fullRadarCanvas.parentElement) {
        fullRadarCanvas.width = fullRadarCanvas.parentElement.clientWidth || 370;
      }
    }
    if (tabKey === 'teach') {
      renderEngramList();
    }
  }
  consoleTabs.forEach((btn) => {
    btn.onclick = () => setConsoleTab(btn.getAttribute('data-tab'));
  });

  // Floating Neuron Inspector
  const NEURON_META = {
    'EPG': {
      cls: 'Central Complex Compass (Heading Attractor)',
      nt: 'Acetylcholine (Cholinergic)',
      syn: 'Delta7, PEG, PEN_a, PEN_b',
      codex: 'https://codex.flywire.ai/app/search?q=EPG'
    },
    'Delta7': {
      cls: 'Ring Attractor Global Inhibitory Loop',
      nt: 'GABA (Inhibitory)',
      syn: 'EPG, PEG (sinusoidal inhibition)',
      codex: 'https://codex.flywire.ai/app/search?q=Delta7'
    },
    'PEN_a(PEN1)': {
      cls: 'Angular Velocity Integrator (Left/Right Shift)',
      nt: 'Acetylcholine (Cholinergic)',
      syn: 'EPG, Protocerebral Bridge',
      codex: 'https://codex.flywire.ai/app/search?q=PEN'
    },
    'PEN_b(PEN2)': {
      cls: 'Angular Velocity Integrator (Sustained Turn)',
      nt: 'Acetylcholine (Cholinergic)',
      syn: 'EPG, Protocerebral Bridge',
      codex: 'https://codex.flywire.ai/app/search?q=PEN'
    },
    'PEG': {
      cls: 'Attractor Feedback Stabilizer',
      nt: 'Glutamate',
      syn: 'EPG, Gall, Ellipsoid Body',
      codex: 'https://codex.flywire.ai/app/search?q=PEG'
    },
    'PFL3': {
      cls: 'Premotor Steering Output',
      nt: 'Acetylcholine (Cholinergic)',
      syn: 'Descending Motor Neurons, EPG',
      codex: 'https://codex.flywire.ai/app/search?q=PFL3'
    },
    'ER': {
      cls: 'Visual Landmark / Polarization Ring Input',
      nt: 'GABA / Acetylcholine',
      syn: 'EPG, Anterior Optic Tubercle',
      codex: 'https://codex.flywire.ai/app/search?q=ER'
    },
    'EL': {
      cls: 'Ellipsoid Body Lateral Bilateral Interneuron',
      nt: 'GABA (Inhibitory)',
      syn: 'EPG, PB',
      codex: 'https://codex.flywire.ai/app/search?q=EL'
    }
  };

  function inspectNeuron(type) {
    inspectedNeuronType = type;
    const ins = $('inspector');
    if (!ins) return;
    const meta = NEURON_META[type] || {
      cls: 'MaleCNS Identified Neuron',
      nt: 'Cholinergic / Peptidergic',
      syn: 'Central Complex Arbors',
      codex: `https://codex.flywire.ai/app/search?q=${encodeURIComponent(type)}`
    };
    if ($('ins-type')) $('ins-type').textContent = type;
    if ($('ins-class')) $('ins-class').textContent = meta.cls;
    if ($('ins-nt')) $('ins-nt').textContent = meta.nt;
    if ($('ins-syn')) $('ins-syn').textContent = meta.syn;
    if ($('ins-link')) $('ins-link').href = meta.codex;
    ins.classList.remove('hidden');
  }

  if ($('inspector-close')) {
    $('inspector-close').onclick = () => {
      if ($('inspector')) $('inspector').classList.add('hidden');
    };
  }

  // Teach Panel (Associative Learning Studio)
  function renderEngramList() {
    const list = $('engram-list');
    if (!list) return;
    const items = [...LANDMARKS.map((L) => ({ key: L.key, label: L.label }))];
    if (state.cue && !items.some((x) => x.key === state.cue)) {
      items.unshift({ key: state.cue, label: `"${state.cue}"` });
    }
    list.innerHTML = items.map((item) => {
      const v = mb.valence(item.key);
      const pct = Math.min(100, Math.round(Math.abs(v) * 100));
      const color = v > 0.05 ? '#ffc55c' : v < -0.05 ? '#f87171' : '#64748b';
      const sign = v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2);
      return `
        <div class="engram-row">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;">${item.label}</span>
          <div class="engram-meter">
            <i class="engram-fill" style="width:${pct}%;background:${color};"></i>
          </div>
          <span class="engram-val" style="color:${color}">${sign}</span>
        </div>
      `;
    }).join('');
  }

  if ($('teach-salience')) {
    $('teach-salience').oninput = (e) => {
      if ($('teach-sal-out')) $('teach-sal-out').textContent = `${e.target.value}x`;
    };
  }

  if ($('teach-landmark')) {
    $('teach-landmark').onchange = (e) => {
      if ($('teach-cue')) $('teach-cue').value = e.target.value;
    };
  }

  if ($('btn-teach-reward')) {
    $('btn-teach-reward').onclick = () => {
      const cue = ($('teach-cue') ? $('teach-cue').value.trim() : '') || 'home';
      const reps = $('teach-salience') ? parseInt($('teach-salience').value, 10) || 1 : 1;
      let n = 0;
      for (let i = 0; i < reps; i++) {
        n = mb.teach(cue, +1);
      }
      state.cue = cue;
      renderEngramList();
      say('nona', `🍬 Dopamine burst (${reps}x): depressed ${n.toLocaleString('en-US')} KC→MBON synapses in reward compartments. "${cue}" valence is now +${mb.valence(cue).toFixed(2)}.`, 'good');
    };
  }

  if ($('btn-teach-punish')) {
    $('btn-teach-punish').onclick = () => {
      const cue = ($('teach-cue') ? $('teach-cue').value.trim() : '') || 'home';
      const reps = $('teach-salience') ? parseInt($('teach-salience').value, 10) || 1 : 1;
      let n = 0;
      for (let i = 0; i < reps; i++) {
        n = mb.teach(cue, -1);
      }
      state.cue = cue;
      renderEngramList();
      say('nona', `⚡ Punishment signal (${reps}x): depressed ${n.toLocaleString('en-US')} synapses in avoidance compartments. "${cue}" valence is now ${mb.valence(cue).toFixed(2)}.`, 'bad');
    };
  }

  if ($('btn-teach-forget')) {
    $('btn-teach-forget').onclick = () => {
      mb.forget();
      state.cue = null;
      renderEngramList();
      say('nona', '🧹 All Mushroom Body KC→MBON synapses reset to naive (0.00).', 'hint');
    };
  }

  // Optics Panel
  if ($('opt-glow')) {
    $('opt-glow').oninput = (e) => {
      const val = parseFloat(e.target.value);
      if ($('opt-glow-out')) $('opt-glow-out').textContent = `${val.toFixed(1)}x`;
      if (brain3d) brain3d.setGlow(val);
    };
  }

  if ($('opt-thick')) {
    $('opt-thick').oninput = (e) => {
      const val = parseFloat(e.target.value);
      if ($('opt-thick-out')) $('opt-thick-out').textContent = `${val.toFixed(2)}x`;
      if (brain3d) {
        for (const mesh of brain3d.meshes.values()) {
          mesh.scale.set(val, val, val);
        }
      }
    };
  }

  if ($('opt-spin')) {
    $('opt-spin').onchange = (e) => {
      if (brain3d) brain3d.controls.autoRotate = e.target.checked;
      if ($('brain-spin')) $('brain-spin').classList.toggle('on', e.target.checked);
    };
  }

  if ($('opt-theme-toggle')) {
    $('opt-theme-toggle').onclick = () => {
      if ($('btn-theme')) $('btn-theme').click();
    };
  }

  if ($('opt-reset-cam')) {
    $('opt-reset-cam').onclick = () => {
      if (brain3d) brain3d.resetCamera();
    };
  }

  const btnTermMax = $('btn-term-max');
  if (btnTermMax) {
    btnTermMax.onclick = () => {
      const isFull = panel && panel.classList.contains('mode-terminal');
      setPanelMode(isFull ? 'split' : 'terminal');
      btnTermMax.textContent = isFull ? '⛶ max' : '⚡ split';
    };
  }

  const btnTermClear = $('btn-term-clear');
  if (btnTermClear) {
    btnTermClear.onclick = () => {
      if ($('log')) $('log').innerHTML = '';
      say('nona', 'Terminal buffer cleared. System ready.', 'hint');
    };
  }

  const btnTermHelp = $('btn-term-help');
  if (btnTermHelp) {
    btnTermHelp.onclick = () => {
      heard('help');
    };
  }

  const listener = makeListener(heard, (on) => {
    state.micOn = on;
    $('mic').classList.toggle('on', on);
    $('mic').textContent = on ? '● listening' : '● speak';
  });
  if (!listener) {
    $('mic').disabled = true;
    $('mic').title = 'Speech recognition not available in this browser';
  } else {
    $('mic').onclick = () => listener.toggle();
  }

  if ($('lesion')) {
    $('lesion').onclick = (e) => {
      state.lesioned = !state.lesioned;
      compass.lesionDelta7(state.lesioned);
      e.target.classList.toggle('on', state.lesioned);
      say('nona', state.lesioned
        ? 'Delta7 silenced. Without that inhibition the bump smears across the whole ring — she has lost north.'
        : 'Delta7 restored. The bump re-forms.', state.lesioned ? 'bad' : 'good');
    };
  }

  if ($('scramble')) {
    $('scramble').onclick = (e) => {
      state.scrambled = !state.scrambled;
      compass.scramble(state.scrambled);
      e.target.classList.toggle('on', state.scrambled);
      say('nona', state.scrambled
        ? 'Wiring shuffled — same neurons, same number of connections, random partners. The bump cannot form. This is the control: the STRUCTURE does the work.'
        : 'Real wiring restored.', state.scrambled ? 'bad' : 'good');
    };
  }

  if ($('forget')) {
    $('forget').onclick = () => heard('forget');
  }

  // 3D Brain controls
  if (brain3d) {
    const wrap = $('brain-wrap');
    setBig = (on) => {
      wrap.classList.toggle('big', on);
      document.body.classList.toggle('brain-fullscreen', on);
      $('brain-expand').innerHTML = on ? '&#10005;' : '&#9974;';
      $('brain-expand').title = on ? 'Close' : 'Expand';
      if (!on) {
        modeTabs.forEach((tab) => tab.classList.toggle('active', tab.getAttribute('data-mode') === 'split'));
        if (panel) {
          panel.classList.remove('mode-brain');
          panel.classList.add('mode-split');
        }
      }
      requestAnimationFrame(() => requestAnimationFrame(resize));
    };
    $('brain-expand').onclick = () => setBig(!wrap.classList.contains('big'));
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && wrap.classList.contains('big')) setBig(false);
    });

    $('brain-spin').onclick = (e) => {
      brain3d.controls.autoRotate = !brain3d.controls.autoRotate;
      e.currentTarget.classList.toggle('on', brain3d.controls.autoRotate);
      if ($('opt-spin')) $('opt-spin').checked = brain3d.controls.autoRotate;
    };

    const HEAVY = new Set(['ER', 'PFL3']);
    const box = $('brain-types');
    const order = brain3d.types().sort((a, b) => (HEAVY.has(a) ? 1 : 0) - (HEAVY.has(b) ? 1 : 0));
    for (const type of order) {
      const on = !HEAVY.has(type);
      brain3d.setTypeVisible(type, on);
      const lab = document.createElement('label');
      if (!on) lab.classList.add('off');
      lab.title = TYPE_LABEL[type] || type;
      const hex = '#' + (TYPE_COLOUR[type] ?? 0x8899aa).toString(16).padStart(6, '0');
      lab.innerHTML =
        `<input type="checkbox" ${on ? 'checked' : ''}><i style="background:${hex}"></i>${type.replace(/\(.*\)/, '')}`;
      const input = lab.querySelector('input');
      input.onchange = (e) => {
        e.stopPropagation();
        brain3d.setTypeVisible(type, input.checked);
        lab.classList.toggle('off', !input.checked);
      };
      lab.onclick = (e) => {
        if (e.target !== input) {
          inspectNeuron(type);
        }
      };
      box.appendChild(lab);
    }
  }

  say('nona', 'NONA CONNECTOME TERMINAL v1.0 [Drosophila MaleCNS Active]', 'hint');
  say('nona', '166 Central Complex neurons computing heading · 4,063 Kenyon cells ready.', 'epg');
  say('nona', 'Tabs: [CMD] Terminal · [TEACH] Associative Plasticity · [COMPASS] 2D Ring · [OPTICS] Shaders.', 'good');
}

boot().catch((e) => {
  document.body.insertAdjacentHTML('afterbegin',
    `<pre style="color:#ff6a8c;padding:20px;font:13px ui-monospace">Failed to start: ${e.message}\n\nThis page must be served over http (module imports + fetch).\nRun:  python -m http.server 8080</pre>`);
  console.error(e);
});
