/**
 * NonaOS 98 — Fluctfly Neuro-Symbolic Teaching & Code Workdesk
 *
 * Immersive retro desktop environment inspired by henryheffernan.com and voxmastery/Fluctfly:
 * - Bio-agent fly perched on the desk dock listening for programming code
 * - Fluctfly Recall Fabric: Theta-Gamma phase AST parsing into Central Complex & Mushroom Body
 * - Autonomous Code Synthesis: The fly learns code patterns and writes real Python/FlyLang back!
 * - Mechanical keyboard clicker and realistic acoustic fly wing buzzing audio
 * - Full 90s window manager with draggable windows, Start menu, and live wave visualizer
 */

const AUDIO_CTX = () => {
  if (!window._audioCtx) {
    window._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return window._audioCtx;
};

function playKeyClick() {
  if (Desk.muted) return;
  try {
    const ctx = AUDIO_CTX();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(650 + Math.random() * 250, ctx.currentTime);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.045);
  } catch {}
}

function playBeep(freq = 880, dur = 0.08) {
  if (Desk.muted) return;
  try {
    const ctx = AUDIO_CTX();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.01);
  } catch {}
}

function playFlyBuzz(duration = 0.35, pitch = 210) {
  if (Desk.muted) return;
  try {
    const ctx = AUDIO_CTX();
    const osc = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(pitch, ctx.currentTime);

    // 26 Hz wing wobble modulation
    mod.type = 'sine';
    mod.frequency.setValueAtTime(26, ctx.currentTime);
    modGain.gain.setValueAtTime(22, ctx.currentTime);
    mod.connect(osc.frequency);

    gain.gain.setValueAtTime(0.07, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    mod.start();
    osc.start();
    mod.stop(ctx.currentTime + duration);
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

// Curated code presets for teaching the connectome
const CODE_PRESETS = {
  nectar: `# 🍯 Cubbon Park Nectar Hunt & 360° Acrobatic Stunt!
def hunt_nectar():
    # 1. Teach connectome that Cubbon Park has sweet organic nectar!
    teach("cubbon")
    reward(1.0) # Maximum PAM Dopamine reinforcement
    
    # 2. Steer central-complex compass directly to Cubbon Park
    fly_to("cubbon")
    
    # 3. Launch from desk into the 3D sky!
    takeoff()
`,
  patrol: `# 1. Python Autonomous Flight Routine
# Teach Nona's 51,085 synapses how to think and fly!
def mission_bangalore():
    teach("home", landmark="2586Labs")
    reward(salience=1.0) # PAM Dopamine burst
    
    # Fly through city landmarks
    fly_to("cubbon")
    reward(0.8) # Bind positive valence to Cubbon Park
    fly_to("vidhana")
    fly_to("ubcity")
    
    # Return safely to desk charging dock
    return_to("home")
`,
  reflex: `# 2. Python Collision Reflex
def on_obstacle_detected(distance_m):
    # Reactive avoidance loop learned into Central Complex
    if distance_m < 10.0:
        steer_compass(delta_deg=-45)
        punish(0.9) # PPL1 Avoidance dopamine
    else:
        accelerate(boost=1.5)
        reward(0.4) # PAM Approach dopamine
`,
  spiral: `# 3. Aerobatic Spiral Climb & Airspace Scan
def spiral_acrobatics():
    takeoff(altitude_m=120, speed_kmh=65)
    for angle in [0, 60, 120, 180, 240, 300]:
        steer_compass(angle)
        accelerate(boost=2.0)
        buzz_wings(freq=240)
        
    orient_heading("home")
    return_to("home")
    land_dock()
`,
  homing: `# 4. Precision Docking & Learning Routine
def return_home_mission():
    teach("home", landmark="2586Labs")
    reward(1.0)
    reward(1.0)
    orient_heading("home")
    takeoff(altitude_m=90)
    land_dock()
`,
  flylang: `;; 5. Fluctfly Neuro-Symbolic DSL (Lisp Format)
(defroutine autonomous_mission
  (bind-sensory :cue "home" :target "2586Labs")
  (dopamine-burst :cluster "PAM" :weight 0.95)
  (steer-central-complex :wedge 8 :heading 180)
  (execute-flight :altitude 110))
`,
};

/**
 * Fluctfly Recall Fabric:
 * Brain-native memory engine inspired by voxmastery/Fluctfly & FluctlightDB.
 * Maintains a manifold lattice of learned language tokens and theta-gamma phase coupling.
 */
class FluctflyRecallFabric {
  constructor() {
    this.learnedTokens = new Map([
      ['def', { count: 12, confidence: 0.98, type: 'keyword' }],
      ['if', { count: 9, confidence: 0.96, type: 'keyword' }],
      ['teach', { count: 18, confidence: 1.0, type: 'biological' }],
      ['reward', { count: 22, confidence: 1.0, type: 'biological' }],
      ['punish', { count: 8, confidence: 0.92, type: 'biological' }],
      ['home', { count: 24, confidence: 1.0, type: 'landmark' }],
      ['cubbon', { count: 14, confidence: 0.95, type: 'landmark' }],
      ['takeoff', { count: 15, confidence: 0.98, type: 'motor' }],
      ['fly_to', { count: 11, confidence: 0.94, type: 'motor' }],
      ['steer', { count: 8, confidence: 0.91, type: 'motor' }],
      ['distance', { count: 7, confidence: 0.89, type: 'variable' }],
    ]);
    this.thetaFreq = 5.2; // Theta carrier (4-8 Hz)
    this.gammaFreq = 42.0; // Gamma bursts (30-80 Hz)
    this.grammarRules = 12;
    this.retentionRate = 98.4;
  }

  ingestCode(codeText) {
    const words = codeText.match(/\b[a-zA-Z_]\w*\b/g) || [];
    let tokensFound = 0;
    const extracted = [];

    for (const w of words) {
      const lower = w.toLowerCase();
      if (['def', 'if', 'else', 'while', 'for', 'return', 'class', 'import', 'print'].includes(lower)) {
        tokensFound++;
        extracted.push(lower);
        const cur = this.learnedTokens.get(lower) || { count: 0, confidence: 0.65, type: 'keyword' };
        cur.count++;
        cur.confidence = Math.min(0.99, cur.confidence + 0.04);
        this.learnedTokens.set(lower, cur);
      } else if (['teach', 'reward', 'punish', 'avoid', 'good', 'bad', 'forget', 'valence', 'taste_sugar'].includes(lower)) {
        tokensFound++;
        extracted.push(lower);
        const cur = this.learnedTokens.get(lower) || { count: 0, confidence: 0.7, type: 'biological' };
        cur.count++;
        cur.confidence = Math.min(1.0, cur.confidence + 0.05);
        this.learnedTokens.set(lower, cur);
      } else if (['takeoff', 'fly_to', 'steer', 'heading', 'land', 'dock', 'accelerate', 'climb', 'patrol', 'orbit'].includes(lower)) {
        tokensFound++;
        extracted.push(lower);
        const cur = this.learnedTokens.get(lower) || { count: 0, confidence: 0.68, type: 'motor' };
        cur.count++;
        cur.confidence = Math.min(0.99, cur.confidence + 0.05);
        this.learnedTokens.set(lower, cur);
      } else if (['home', 'cubbon', 'vidhana', 'ubcity', 'lalbagh', 'distance', 'speed', 'altitude', 'obstacle'].includes(lower)) {
        tokensFound++;
        extracted.push(lower);
        const cur = this.learnedTokens.get(lower) || { count: 0, confidence: 0.62, type: 'landmark' };
        cur.count++;
        cur.confidence = Math.min(0.99, cur.confidence + 0.05);
        this.learnedTokens.set(lower, cur);
      }
    }

    this.grammarRules += Math.max(1, Math.floor(tokensFound / 5));
    this.thetaFreq = 4.6 + Math.random() * 2.0;
    this.gammaFreq = 36.0 + Math.random() * 12.0;
    this.retentionRate = Math.min(99.9, +(this.retentionRate + 0.1).toFixed(1));

    return {
      tokensFound,
      keywords: Array.from(new Set(extracted)),
      theta: this.thetaFreq.toFixed(1),
      gamma: this.gammaFreq.toFixed(1),
      grammarRules: this.grammarRules,
      totalSymbols: this.learnedTokens.size,
      retention: this.retentionRate,
    };
  }

  synthesizeCode(promptOrMode = 'python', state = {}) {
    const highestValence = state.valence && state.valence.length > 0
      ? state.valence.reduce((prev, curr) => (curr.v > prev.v ? curr : prev), state.valence[0]).key
      : 'home';
    const epgRate = state.epgHz ? Math.round(state.epgHz) : 68;
    const p = (promptOrMode || '').toLowerCase();

    if (p.includes('spiral') || p.includes('acrobat') || p.includes('climb') || p.includes('loop')) {
      return `# 🪰 Synthesized by Nona's Connectome (Acrobatic Spiral Module)
# Central Complex: EPG Ring Attractor active at ${epgRate} Hz

def fly_aerobatic_spiral():
    print("Nona: Initiating 3D spiral climb over Bangalore airspace...")
    takeoff(altitude_m=130, speed_kmh=68)
    
    # Helical climb
    for heading in [0, 90, 180, 270, 360]:
        orient_heading(heading)
        accelerate(boost=2.2)
        buzz_wings(freq=250)
        
    orient_heading("home")
    return_to("home")
    land_dock()
`;
    }

    if (p.includes('avoid') || p.includes('reflex') || p.includes('traffic') || p.includes('danger') || p.includes('hazard')) {
      return `# 🪰 Synthesized by Nona's Connectome (Reactive Avoidance Module)
# PPL1 Compartment Plasticity: Depressed aversive compartments

def fly_collision_reflex(distance_sensor):
    if distance_sensor < 12.0:
        steer_compass(delta_deg=-60)
        buzz_wings(freq=210)
        punish(salience=0.95) # PPL1 avoidance dopamine
    else:
        climb_altitude(target_m=95)
        reward(salience=0.4) # PAM approach dopamine
`;
    }

    if (p.includes('cubbon') || p.includes('park') || p.includes('nectar')) {
      return `# 🪰 Synthesized by Nona's Connectome (Cubbon Bamboo Grove Survey)
def forage_cubbon():
    takeoff(altitude_m=90, speed_kmh=52)
    fly_to("cubbon")
    taste_sugar(reward=1.0)
    orient_heading("home")
    return_to("home")
    land_dock()
`;
    }

    if (p.includes('vidhana') || p.includes('soudha') || p.includes('dome')) {
      return `# 🪰 Synthesized by Nona's Connectome (Vidhana Soudha Granite Dome)
def survey_vidhana():
    takeoff(altitude_m=110, speed_kmh=55)
    orient_heading("vidhana")
    fly_to("vidhana")
    reward(0.9)
    return_to("home")
    land_dock()
`;
    }

    if (p === 'flylang' || p.includes('lisp')) {
      return `;; Synthesized by Fly Connectome (Neuro-Symbolic DSL)
;; Memory Lattice Confidence: 97.4% · Theta Phase: ${this.thetaFreq.toFixed(1)}Hz
(defroutine autonomous_mission
  (target-wedge :epg-ring 8 :hz ${epgRate})
  (seek-valence :target "${highestValence}")
  (thrust-surge :altitude 105)
  (if-obstacle-detected
    (then (steer :angle -45))
    (else (fly-to :landmark "${highestValence}"))))
`;
    }

    return `# 🪰 Synthesized by Nona's Connectome (Fluctfly Recall Fabric)
# EPG Compass: ${epgRate} Hz · Primary Valence Target: "${highestValence}" · Synapses: ${state.changed || '3,895'}

def fly_autonomous_routine():
    print("Nona: Executing learned connectome program...")
    takeoff(altitude_m=95, speed_kmh=48)
    
    # Evaluate Mushroom Body valence
    if check_valence("${highestValence}") > 0.3:
        orient_heading("${highestValence}")
        fly_to("${highestValence}")
        taste_sugar(reward=1.0)
    else:
        scan_airspace(sweep_deg=360)
        
    # Return safely to workstation desk charging dock
    return_to("home")
    land_dock()
`;
  }
}

/** Translates high-level Python/DSL expressions into low-level connectome commands */
function translate(line) {
  const s = line.trim();
  if (!s || s.startsWith('#') || s.startsWith('//') || s.startsWith(';;')) return null;

  // Python / function calls like: teach("home"), reward(1.0), fly_to("cubbon"), takeoff()
  const fnMatch = s.match(/^(\w+)\s*\((.*?)\)/);
  if (fnMatch) {
    const fn = fnMatch[1].toLowerCase();
    const rawArgs = fnMatch[2].replace(/['"]/g, '').split(',').map((a) => a.trim());
    const arg0 = rawArgs[0] || '';

    switch (fn) {
      case 'teach':
      case 'bind':
        return { phrase: `this is ${arg0 || 'home'}` };
      case 'reward':
      case 'taste_sugar':
      case 'good':
        return { phrase: arg0 && !isNaN(arg0) ? 'good girl' : arg0 ? `this is ${arg0}` : 'good girl', then: 'good girl' };
      case 'punish':
      case 'bad':
        return { phrase: 'bad' };
      case 'avoid':
        return { phrase: `${arg0} is bad` };
      case 'fly_to':
      case 'go':
      case 'return_to':
      case 'orient_heading':
        return { phrase: `go ${arg0 || 'home'}` };
      case 'takeoff':
      case 'launch':
        return { phrase: 'takeoff', isTakeoff: true };
      case 'land_dock':
        return { phrase: 'go home' };
      case 'hunt_nectar':
        return { phrase: 'this is cubbon', then: 'good girl', isStunt: true };
      case 'stunt':
      case 'barrel_roll':
      case 'corkscrew':
        return { phrase: 'this is cubbon', isStunt: true };
      case 'forget':
      case 'reset':
        return { phrase: 'forget' };
      default:
        break;
    }
  }

  // DSL or shell-style: teach home, reward, go cubbon, takeoff
  const m = s.toLowerCase().match(/^(\w+)(?:\s+(.*))?$/);
  if (!m) return { phrase: s };
  const cmd = m[1];
  const arg = (m[2] || '').replace(/['"]/g, '').trim();

  switch (cmd) {
    case 'teach': return { phrase: `this is ${arg}` };
    case 'reward': case 'good': return { phrase: arg ? `this is ${arg}` : 'good girl', then: arg ? 'good girl' : null };
    case 'punish': case 'bad': return { phrase: 'bad' };
    case 'avoid': return { phrase: `${arg} is bad` };
    case 'go': case 'fly': return { phrase: `go ${arg}` };
    case 'takeoff': case 'launch': return { phrase: 'takeoff', isTakeoff: true };
    case 'forget': case 'reset': return { phrase: 'forget' };
    default: return { phrase: s };
  }
}

export class Desk {
  static muted = false;

  constructor(root, runCommand, getState, onExit, onToggleRoomFocus, onFlyReact) {
    this.root = root;
    this.runCommand = runCommand;
    this.getState = getState;
    this.onExit = onExit;
    this.onToggleRoomFocus = onToggleRoomFocus;
    this.onFlyReact = onFlyReact || (() => {});
    this.visible = false;
    this.windows = new Map();
    this.zCounter = 100;
    this.activeWindow = null;
    this.roomView = false;
    this.fabric = new FluctflyRecallFabric();
    this.activeLang = 'python';
    this.fastMode = true;

    this._buildUI();
    this._initWindows();
    this._startClock();
    this._initWaveCanvas();
  }

  _buildUI() {
    this.root.innerHTML = `
      <div class="crt-frame">
        <div class="crt-header-bar">
          <div class="crt-brand">
            <span class="crt-brand-dot"></span>
            <span>nona@central-complex ~ Fluctfly Neuro-Symbolic Studio</span>
          </div>
          <div class="crt-fly-badge" id="crt-fly-status-pill">
            <span class="fly-indicator-dot"></span>
            <span>🪰 Bio-Fly Perched on Desk · Listening</span>
          </div>
          <div class="crt-header-actions">
            <button class="crt-action-btn" id="btn-header-call" title="Call Fly to Perch on Desk Dock">
              🪰 Call to Desk
            </button>
            <button class="crt-takeoff-btn" id="btn-header-takeoff" title="Take off from 2586Labs into the Bangalore sky (Esc)">
              🚀 LAUNCH (Takeoff) ↗
            </button>
          </div>
        </div>

        <div class="crt-screen">
          <!-- Retro Desktop -->
          <div class="desktop" id="desktop">
            <!-- Desktop Icons -->
            <div class="desktop-icons">
              <div class="d-icon" data-win="ide" title="FlyLang Neuro-Symbolic Code Tutor">
                <span class="ico">📝</span>
                <span class="txt">FlyLang_Studio.exe</span>
              </div>
              <div class="d-icon" data-win="fabric" title="Fluctfly Recall Fabric & Token Lattice">
                <span class="ico">🧬</span>
                <span class="txt">Fluctfly_Fabric.exe</span>
              </div>
              <div class="d-icon" data-win="perch" title="Bio-Agent Perched on Desk Telemetry">
                <span class="ico">🪰</span>
                <span class="txt">Desk_Perch.exe</span>
              </div>
              <div class="d-icon" data-win="brain" title="Live Connectome Monitor">
                <span class="ico">🧠</span>
                <span class="txt">Brain_Live.exe</span>
              </div>
              <div class="d-icon" data-win="radar" title="Bangalore GPS Radar">
                <span class="ico">🗺️</span>
                <span class="txt">City_Radar.exe</span>
              </div>
              <div class="d-icon" data-win="synapse" title="Plasticity Matrix">
                <span class="ico">⚡</span>
                <span class="txt">Synapses.exe</span>
              </div>
              <div class="d-icon" data-win="guide" title="User Field Manual">
                <span class="ico">📖</span>
                <span class="txt">Field_Guide.txt</span>
              </div>
              <div class="d-icon" id="btn-desktop-exit" title="Launch Fly Outside">
                <span class="ico">🚀</span>
                <span class="txt">Fly_Outside.bat</span>
              </div>
            </div>
          </div>

          <!-- Retro 90s Taskbar -->
          <div class="taskbar">
            <div class="start-btn" id="start-btn">
              <span class="start-flag">🪰</span>
              <b>Nona 98</b>
            </div>
            <div class="taskbar-apps" id="taskbar-apps"></div>
            <div class="tray">
              <button class="tray-btn" id="btn-room-toggle" title="Toggle Wide Room View / Monitor Zoom">🪑 Room View</button>
              <button class="tray-btn" id="btn-sound-toggle" title="Toggle Mechanical Audio">🔊 Sound</button>
              <span class="tray-clock" id="tray-clock">10:42 AM</span>
              <button class="tray-exit" id="btn-tray-exit" title="Exit to Flight (Esc)">🚀 Takeoff ↗</button>
            </div>
          </div>

          <!-- Start Menu Popup -->
          <div class="start-menu" id="start-menu">
            <div class="sm-banner"><span>NONA 98</span></div>
            <div class="sm-items">
              <div class="sm-item" data-action="ide">📝 FlyLang Code Studio</div>
              <div class="sm-item" data-action="fabric">🧬 Fluctfly Recall Fabric</div>
              <div class="sm-item" data-action="perch">🪰 Desk Perch Controls</div>
              <div class="sm-item" data-action="brain">🧠 Brain Telemetry</div>
              <div class="sm-item" data-action="radar">🗺️ City Radar</div>
              <div class="sm-item" data-action="synapse">⚡ Synapse Matrix</div>
              <div class="sm-item" data-action="guide">📖 Field Guide</div>
              <hr />
              <div class="sm-item" data-action="forget">🧹 Reset Naive Brain (Forget)</div>
              <div class="sm-item" data-action="exit">🚀 Launch Fly Outside (Esc)</div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Bind Desktop Icon clicks
    this.root.querySelectorAll('.d-icon[data-win]').forEach((el) => {
      el.addEventListener('dblclick', () => this.openWindow(el.dataset.win));
      el.addEventListener('click', () => {
        this.root.querySelectorAll('.d-icon').forEach((i) => i.classList.remove('selected'));
        el.classList.add('selected');
        playKeyClick();
      });
    });

    this.root.querySelector('#btn-header-takeoff').onclick = () => this.triggerTakeoff();
    this.root.querySelector('#btn-desktop-exit').onclick = () => this.triggerTakeoff();
    this.root.querySelector('#btn-tray-exit').onclick = () => this.triggerTakeoff();

    // Call fly to desk
    const callBtn = this.root.querySelector('#btn-header-call');
    if (callBtn) {
      callBtn.onclick = () => {
        playFlyBuzz(0.4, 210);
        this.onFlyReact('reward');
        this._logToIde('🪰 Fly called to charging dock on desk. Attention locked onto code editor.', 'good');
      };
    }

    // Sound toggle
    const soundBtn = this.root.querySelector('#btn-sound-toggle');
    soundBtn.onclick = () => {
      Desk.muted = !Desk.muted;
      soundBtn.textContent = Desk.muted ? '🔇 Muted' : '🔊 Sound';
      playBeep(440, 0.05);
    };

    // Room view toggle
    const roomBtn = this.root.querySelector('#btn-room-toggle');
    roomBtn.onclick = () => {
      this.roomView = !this.roomView;
      roomBtn.textContent = this.roomView ? '🖥️ Monitor View' : '🪑 Room View';
      if (this.onToggleRoomFocus) this.onToggleRoomFocus(this.roomView ? 'room' : 'monitor');
      this.root.querySelector('.crt-frame').classList.toggle('back-view', this.roomView);
    };

    // Start Menu Toggle
    const startBtn = this.root.querySelector('#start-btn');
    const startMenu = this.root.querySelector('#start-menu');
    startBtn.onclick = (e) => {
      e.stopPropagation();
      startMenu.classList.toggle('open');
      playKeyClick();
    };
    document.addEventListener('click', (e) => {
      if (!startMenu.contains(e.target) && e.target !== startBtn) {
        startMenu.classList.remove('open');
      }
    });

    startMenu.querySelectorAll('.sm-item').forEach((item) => {
      item.onclick = () => {
        const act = item.dataset.action;
        startMenu.classList.remove('open');
        playBeep(660, 0.04);
        if (act === 'exit') this.onExit();
        else if (act === 'forget') this.runCommand('forget');
        else if (act) this.openWindow(act);
      };
    });
  }

  _initWindows() {
    const desktop = this.root.querySelector('#desktop');

    // 1. FlyLang Code Studio Window (The Primary Teaching & Programming Environment)
    const ideWin = this._createWindow('ide', 'FlyLang_Studio.exe · Neuro-Symbolic Code Tutor', 16, 16, 640, 480, `
      <div class="win-body ide-body">
        <div class="ide-toolbar">
          <div class="ide-lang-selector">
            <button class="ide-lang-btn active" data-lang="python">🐍 Python</button>
            <button class="ide-lang-btn" data-lang="flylang">⚡ FlyLang</button>
          </div>
          <button class="ide-btn ide-teach-btn" id="ide-teach-btn" title="Parse AST and encode into Connectome & Fluctfly Recall Fabric">
            🧠 Teach Fly (AST Parse)
          </button>
          <button class="ide-btn ide-synth-btn" id="ide-synth-btn" title="Ask Nona the fly to synthesize & write code!">
            🪰 Fly, Write Code!
          </button>
          <button class="ide-btn ide-speed-btn active" id="ide-speed-btn" title="Toggle Typing Speed (Fast Instant vs Typewriter)">
            ⚡ Fast Mode
          </button>
          <button class="ide-btn ide-launch-btn" id="ide-run-fly-btn" title="Execute active script and launch fly into 3D flight!">
            🚀 Execute & Take Off
          </button>
          <div class="ide-presets">
            <span>Presets:</span>
            <button class="preset-btn" data-snip="nectar">🍯 Nectar</button>
            <button class="preset-btn" data-snip="patrol">Patrol</button>
            <button class="preset-btn" data-snip="reflex">Reflex</button>
            <button class="preset-btn" data-snip="spiral">Spiral</button>
            <button class="preset-btn" data-snip="homing">Homing</button>
            <button class="preset-btn" data-snip="flylang">Lisp</button>
          </div>
        </div>
        <div class="ide-prompt-bar">
          <span class="ip-icon">💡</span>
          <input type="text" class="ide-prompt-input" id="ide-prompt-input" placeholder="Prompt fly: e.g. 'spiral climb', 'avoid traffic', 'scout cubbon'..." />
          <button class="ide-prompt-btn" id="ide-prompt-btn">Ask Fly ↵</button>
        </div>
        <textarea class="ide-textarea" spellcheck="false">${CODE_PRESETS.patrol}</textarea>
        <div class="ide-output-panel">
          <div class="ide-output-title">
            <span>FLUCTFLY NEURO-SYMBOLIC CONSOLE</span>
            <span id="ide-status-pill" class="ide-status-pill">Ready · Listening for Code</span>
          </div>
          <div class="ide-log" id="ide-log"></div>
        </div>
      </div>
    `);
    desktop.appendChild(ideWin.el);

    // 2. Fluctfly Recall Fabric Window
    const fabricWin = this._createWindow('fabric', 'Fluctfly_Fabric.exe · Memory Lattice & Waves', 480, 24, 480, 440, `
      <div class="win-body fabric-body">
        <div class="fabric-header">
          <div class="fh-title">
            <span class="dot-live"></span>
            <b>FLUCTFLY RECALL FABRIC (MaleCNS v1.0)</b>
          </div>
          <div class="fh-metrics" id="fabric-metrics">Theta: 5.2 Hz · Gamma: 42 Hz · 98.4% Retention</div>
        </div>
        <div class="fabric-wave-wrap">
          <div class="wave-label">THETA-GAMMA PHASE OSCILLATOR (4-8 Hz carrier / 30-80 Hz token bursts)</div>
          <canvas id="fabric-wave-canvas" width="450" height="95"></canvas>
        </div>
        <div class="fabric-lattice-wrap">
          <div class="lattice-label">LEARNED SYMBOL & GRAMMAR LATTICE</div>
          <div class="fabric-tokens" id="fabric-tokens"></div>
        </div>
        <div class="fabric-actions">
          <button class="fb-btn" id="fb-prune-btn">🧹 Adaptive Forgetting (Prune)</button>
          <button class="fb-btn" id="fb-reinforce-btn">⚡ Consolidate Theta Lattice</button>
        </div>
      </div>
    `);
    desktop.appendChild(fabricWin.el);

    // 3. Desk Perch Controls Window
    const perchWin = this._createWindow('perch', 'Desk_Perch.exe · Bio-Agent Interaction', 180, 80, 420, 310, `
      <div class="win-body perch-body">
        <div class="perch-card">
          <div class="perch-header">
            <span class="perch-dot"></span>
            <b>🪰 BIO-AGENT WORKSTATION TELEMETRY</b>
          </div>
          <div class="perch-stat-grid">
            <div class="p-card"><span>LOCATION</span><b>CHARGING DOCK</b></div>
            <div class="p-card"><span>WING FLAP</span><b id="perch-flap">198 Hz</b></div>
            <div class="p-card"><span>ATTENTION</span><b>CODE EDITOR</b></div>
            <div class="p-card"><span>NEURAL STATE</span><b id="perch-status">LISTENING</b></div>
          </div>
          <div class="perch-interact">
            <span class="pi-title">INTERACT WITH PERCHED FLY</span>
            <div class="pi-row">
              <button class="p-btn" id="p-sugar-btn">🍬 Feed Sugar Drop (Reward)</button>
              <button class="p-btn" id="p-pet-btn">⚡ Pet Fly (Wing Flutter)</button>
              <button class="p-btn" id="p-call-btn">🪰 Call to Dock</button>
              <button class="p-btn p-btn-launch" id="p-launch-btn">🚀 Launch Flight (Takeoff)</button>
            </div>
          </div>
          <div class="perch-tip">
            💡 Nona is perched on the brass dock to your left. When you teach her code or ask her to synthesize programs, her wings flutter and her cyan aura pulses!
          </div>
        </div>
      </div>
    `);
    desktop.appendChild(perchWin.el);

    // 4. Brain Telemetry Window
    const brainWin = this._createWindow('brain', 'Brain_Live.exe', 615, 60, 380, 420, `
      <div class="win-body brain-body">
        <div class="brain-stat-grid">
          <div class="b-card"><span>BUMP STRENGTH</span><b id="w-bump">0.41</b></div>
          <div class="b-card"><span>EPG FREQUENCY</span><b id="w-epg">68 Hz</b></div>
          <div class="b-card"><span>DEPRESSED SYNAPSES</span><b id="w-syn">0</b></div>
        </div>
        <div class="win-subhead">LEARNED VALENCE PROFILE</div>
        <div class="win-valence-list" id="w-valence-list"></div>
        <div class="win-foot">Real Mushroom-Body KC→MBON synaptic plasticity readout.</div>
      </div>
    `);
    desktop.appendChild(brainWin.el);

    // 5. City Radar Window
    const radarWin = this._createWindow('radar', 'Bengaluru_Radar.exe', 120, 100, 480, 350, `
      <div class="win-body radar-body">
        <div class="radar-canvas-wrap">
          <canvas class="radar-canvas" width="440" height="220"></canvas>
        </div>
        <div class="radar-info" id="radar-info">📍 Bengaluru Airspace · Namma Metro & Live Traffic Active</div>
      </div>
    `);
    desktop.appendChild(radarWin.el);

    // 6. Synapse Matrix Window
    const synWin = this._createWindow('synapse', 'Synapses.exe', 160, 120, 480, 330, `
      <div class="win-body syn-body">
        <div class="syn-header">51,085 Plastic Synapses · PAM (Reward) & PPL1 (Punishment)</div>
        <div class="syn-grid-visual" id="syn-visual"></div>
        <div class="syn-metrics" id="syn-metrics">Calculating weight distribution...</div>
      </div>
    `);
    desktop.appendChild(synWin.el);

    // 7. Field Guide Window
    const guideWin = this._createWindow('guide', 'Field_Guide.txt', 80, 50, 530, 410, `
      <div class="win-body guide-body">
        <h3>Nona: Male Drosophila Connectome & Fluctfly Tutor</h3>
        <p><b>Teaching a Programming Language:</b> You can write Python or FlyLang routines into the editor. Nona parses the AST tokens, synchronizes theta-gamma oscillations, and depresses active KC&rarr;MBON synapses with simulated dopamine.</p>
        <p><b>Autonomous Code Synthesis:</b> Click <code>🪰 Fly, Write Code!</code> to watch Nona generate executable flight algorithms from her learned synaptic memory.</p>
        <h4>Code Primitives:</h4>
        <ul>
          <li><code>teach("home", landmark="2586Labs")</code>: Binds visual cue to location</li>
          <li><code>reward(1.0)</code>: Triggers PAM dopaminergic plasticity (+1)</li>
          <li><code>punish(0.8)</code>: Triggers PPL1 avoidance plasticity (-1)</li>
          <li><code>fly_to("place")</code>: Connectome compass aligns to landmark</li>
          <li><code>takeoff()</code>: Launches bio-drone from desk into 3D world</li>
        </ul>
      </div>
    `);
    desktop.appendChild(guideWin.el);

    // -------------------------------------------------------------
    // Bind IDE Interactions
    // -------------------------------------------------------------
    const textarea = ideWin.el.querySelector('.ide-textarea');
    const teachBtn = ideWin.el.querySelector('#ide-teach-btn');
    const synthBtn = ideWin.el.querySelector('#ide-synth-btn');
    const launchBtn = ideWin.el.querySelector('#ide-run-fly-btn');

    // Language buttons
    ideWin.el.querySelectorAll('.ide-lang-btn').forEach((btn) => {
      btn.onclick = () => {
        ideWin.el.querySelectorAll('.ide-lang-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeLang = btn.dataset.lang;
        playBeep(720, 0.04);
        if (this.activeLang === 'flylang') textarea.value = CODE_PRESETS.flylang;
        else textarea.value = CODE_PRESETS.patrol;
      };
    });

    // Preset buttons
    ideWin.el.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.onclick = () => {
        playBeep(750, 0.04);
        const s = btn.dataset.snip;
        if (CODE_PRESETS[s]) {
          textarea.value = CODE_PRESETS[s];
          if (s === 'flylang') {
            ideWin.el.querySelectorAll('.ide-lang-btn').forEach((b) => b.classList.toggle('active', b.dataset.lang === 'flylang'));
            this.activeLang = 'flylang';
          } else {
            ideWin.el.querySelectorAll('.ide-lang-btn').forEach((b) => b.classList.toggle('active', b.dataset.lang === 'python'));
            this.activeLang = 'python';
          }
        }
      };
    });

    // Teach Fly Button
    teachBtn.onclick = () => this._teachFlyFromEditor(textarea.value);

    // Speed Toggle Button
    const speedBtn = ideWin.el.querySelector('#ide-speed-btn');
    if (speedBtn) {
      speedBtn.onclick = () => {
        this.fastMode = !this.fastMode;
        speedBtn.classList.toggle('active', this.fastMode);
        speedBtn.textContent = this.fastMode ? '⚡ Fast Mode' : '⏳ Typewriter';
        playBeep(650, 0.04);
      };
    }

    // Prompt Input & Ask Fly Button
    const promptInput = ideWin.el.querySelector('#ide-prompt-input');
    const promptBtn = ideWin.el.querySelector('#ide-prompt-btn');
    const doPrompt = () => {
      const q = promptInput ? promptInput.value.trim() : '';
      this._askFlyToWriteCode(textarea, q);
    };

    synthBtn.onclick = doPrompt;
    if (promptBtn) promptBtn.onclick = doPrompt;
    if (promptInput) {
      promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          doPrompt();
        }
      });
    }

    // Execute & Takeoff
    launchBtn.onclick = () => {
      this._runEditorScript(textarea.value);
      setTimeout(() => this.triggerTakeoff(), 460);
    };

    textarea.addEventListener('keydown', (e) => {
      playKeyClick();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this._teachFlyFromEditor(textarea.value);
      }
    });

    // -------------------------------------------------------------
    // Bind Perch Window Actions
    // -------------------------------------------------------------
    const pSugar = perchWin.el.querySelector('#p-sugar-btn');
    const pPet = perchWin.el.querySelector('#p-pet-btn');
    const pCall = perchWin.el.querySelector('#p-call-btn');
    const pLaunch = perchWin.el.querySelector('#p-launch-btn');

    if (pSugar) {
      pSugar.onclick = () => {
        playFlyBuzz(0.4, 240);
        this.onFlyReact('reward');
        this.runCommand('good girl');
        this._logToIde('🍬 Sugar drop fed to Nona! PAM dopaminergic surge (+1.0).', 'good');
      };
    }
    if (pPet) {
      pPet.onclick = () => {
        playFlyBuzz(0.35, 220);
        this.onFlyReact('learn');
        this._logToIde('⚡ Petting Nona. Translucent wings fluttering happily at 210 Hz.', 'good');
      };
    }
    if (pCall) {
      pCall.onclick = () => {
        playFlyBuzz(0.4, 200);
        this.onFlyReact('reward');
        this._logToIde('🪰 Nona perched comfortably on brass desk dock.', 'good');
      };
    }
    if (pLaunch) {
      pLaunch.onclick = () => this.triggerTakeoff();
    }

    // Fabric window buttons
    const fbPrune = fabricWin.el.querySelector('#fb-prune-btn');
    const fbReinforce = fabricWin.el.querySelector('#fb-reinforce-btn');
    if (fbPrune) {
      fbPrune.onclick = () => {
        playBeep(440, 0.08);
        this._logToIde('🧹 Fluctfly Adaptive Forgetting: Weak synaptic tokens pruned.', 'hint');
        this._renderTokens();
      };
    }
    if (fbReinforce) {
      fbReinforce.onclick = () => {
        playBeep(880, 0.08);
        this.fabric.retentionRate = Math.min(99.9, +(this.fabric.retentionRate + 0.5).toFixed(1));
        this._logToIde('⚡ Theta phase memory lattice consolidated (Retention: 99.8%).', 'good');
        this._renderTokens();
      };
    }

    // Start with IDE, Fabric, and Brain windows open
    this.openWindow('ide');
    this.openWindow('fabric');
    this.openWindow('brain');
    this._renderTokens();
  }

  _teachFlyFromEditor(text) {
    playFlyBuzz(0.42, 220);
    this.onFlyReact('learn');

    // Fluctfly Recall Fabric Ingestion
    const res = this.fabric.ingestCode(text);
    this._renderTokens();

    const pill = this.root.querySelector('#ide-status-pill');
    if (pill) {
      pill.textContent = `Learning · ${res.tokensFound} AST Tokens`;
      pill.classList.add('active');
      setTimeout(() => {
        if (pill) {
          pill.textContent = 'Grammar Encoded · Synapses Updated';
          pill.classList.remove('active');
        }
      }, 1600);
    }

    this._logToIde(`> [Fluctfly AST Tokenizer] Ingested ${res.tokensFound} tokens into Theta-Gamma lattice.`, 'echo');
    this._logToIde(`> [Theta-Gamma Phase] Synchronized at ${res.theta} Hz Theta / ${res.gamma} Hz Gamma.`, 'good');
    this._logToIde(`> [Mushroom Body] KC 5% sparse coding activated for: ${res.keywords.slice(0, 5).join(', ')}.`, 'good');

    // Execute any underlying biological commands
    let actionsRan = 0;
    const lines = text.split('\n');
    for (const line of lines) {
      const t = translate(line);
      if (t && t.phrase) {
        const r = this.runCommand(t.phrase);
        if (r) {
          this._logToIde(`  ↳ [Connectome] ${r.text}`, r.tone || '');
          actionsRan++;
        }
      }
    }

    this._logToIde(`> [Neuro-Symbolic Status] Fly has mastered ${res.grammarRules} flight rules & ${res.totalSymbols} symbols!`, 'good');
  }

  _askFlyToWriteCode(textarea, customPrompt = '') {
    playFlyBuzz(0.5, 240);
    this.onFlyReact('write');

    const s = this.getState();
    const query = customPrompt || this.activeLang;
    const synthesized = this.fabric.synthesizeCode(query, s);

    const pill = this.root.querySelector('#ide-status-pill');
    if (pill) pill.textContent = `Synthesizing ${customPrompt ? `'${customPrompt}'` : 'Code'}...`;

    this._logToIde(`> [Fluctfly Recall Fabric] Synthesizing module: '${query}'...`, 'echo');
    this._logToIde(`> [Central Complex] EPG Compass lock: ${s.epgHz ? s.epgHz.toFixed(0) : '68'} Hz.`, 'good');

    // Typewriter or Instant streaming
    this._typeCodeIntoEditor(textarea, synthesized, () => {
      playFlyBuzz(0.3, 260);
      if (pill) pill.textContent = 'Code Synthesized by Fly!';
      this._logToIde(`> [Synthesis Complete] Nona synthesized ${synthesized.split('\n').length} lines of executable flight code!`, 'good');
    });
  }

  _typeCodeIntoEditor(textarea, fullCode, onComplete) {
    if (this.fastMode) {
      textarea.value = fullCode;
      textarea.scrollTop = 0;
      playKeyClick();
      if (onComplete) onComplete();
      return;
    }

    textarea.value = '';
    const lines = fullCode.split('\n');
    let idx = 0;

    const step = () => {
      if (idx < lines.length) {
        textarea.value += lines[idx] + '\n';
        textarea.scrollTop = textarea.scrollHeight;
        playKeyClick();
        idx++;
        setTimeout(step, 14);
      } else {
        if (onComplete) onComplete();
      }
    };
    step();
  }

  _logToIde(text, tone = '') {
    const log = this.root.querySelector('#ide-log');
    if (!log) return;
    const line = document.createElement('div');
    line.className = `log-line ${tone}`;
    line.textContent = text;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  _renderTokens() {
    const tokensEl = this.root.querySelector('#fabric-tokens');
    if (!tokensEl) return;
    tokensEl.innerHTML = '';

    for (const [sym, info] of this.fabric.learnedTokens) {
      const b = document.createElement('span');
      b.className = `f-badge ${info.type}`;
      b.title = `${info.type.toUpperCase()}: ${sym} · Confidence: ${(info.confidence * 100).toFixed(0)}% · Seen: ${info.count}x`;
      b.innerHTML = `<code>${sym}</code> <small>${(info.confidence * 100).toFixed(0)}%</small>`;
      b.onclick = () => {
        playBeep(650, 0.04);
        this._logToIde(`[Symbol Inspector] '${sym}' (${info.type}) · Synaptic weight: ${(info.confidence).toFixed(2)} · Frequency: ${info.count}`, 'hint');
      };
      tokensEl.appendChild(b);
    }
  }

  _initWaveCanvas() {
    this._waveT = 0;
  }

  _drawWaves() {
    const canvas = this.root.querySelector('#fabric-wave-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#050a14';
    ctx.fillRect(0, 0, w, h);

    // Subtle grid lines
    ctx.strokeStyle = 'rgba(30, 58, 95, 0.35)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 35) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 24) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    this._waveT += 0.05;

    // Draw Theta Carrier Wave (Cyan)
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const tVal = (x / 30) - this._waveT * (this.fabric.thetaFreq / 5.0);
      const theta = Math.sin(tVal) * 22;
      const y = h / 2 + theta;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw Nested Gamma Token Bursts (Gold spikes on positive peaks)
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x < w; x += 2) {
      const tVal = (x / 30) - this._waveT * (this.fabric.thetaFreq / 5.0);
      const theta = Math.sin(tVal);
      if (theta > 0.3) {
        // High frequency gamma packet
        const gamma = Math.sin(x * 0.7 + this._waveT * 8) * (14 * theta);
        const y = h / 2 + (theta * 22) + gamma;
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Text legend
    ctx.fillStyle = '#67e8f9';
    ctx.font = '500 9px monospace';
    ctx.fillText(`THETA ${this.fabric.thetaFreq.toFixed(1)} Hz`, 10, 15);
    ctx.fillStyle = '#fcd34d';
    ctx.fillText(`GAMMA ${this.fabric.gammaFreq.toFixed(0)} Hz (PACKETS)`, w - 145, 15);
  }

  _createWindow(id, title, x, y, w, h, bodyHtml) {
    const el = document.createElement('div');
    el.className = 'win-frame';
    el.id = `win-${id}`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;

    el.innerHTML = `
      <div class="win-titlebar">
        <div class="win-title">
          <span class="win-ico">🗔</span>
          <span>${title}</span>
        </div>
        <div class="win-controls">
          <button class="wc-btn wc-min" title="Minimize">_</button>
          <button class="wc-btn wc-max" title="Maximize">□</button>
          <button class="wc-btn wc-close" title="Close">×</button>
        </div>
      </div>
      <div class="win-content">${bodyHtml}</div>
    `;

    // Make Draggable
    const titlebar = el.querySelector('.win-titlebar');
    let isDragging = false, startX, startY, origX, origY;

    titlebar.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      origX = el.offsetLeft;
      origY = el.offsetTop;
      this.focusWindow(id);
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      el.style.left = `${Math.max(0, origX + (e.clientX - startX))}px`;
      el.style.top = `${Math.max(0, origY + (e.clientY - startY))}px`;
    });

    window.addEventListener('mouseup', () => { isDragging = false; });
    el.addEventListener('mousedown', () => this.focusWindow(id));

    // Controls
    el.querySelector('.wc-close').onclick = () => this.closeWindow(id);
    el.querySelector('.wc-min').onclick = () => this.minimizeWindow(id);
    el.querySelector('.wc-max').onclick = () => el.classList.toggle('maximized');

    const winObj = { id, title, el, minimized: false, open: false };
    this.windows.set(id, winObj);
    return winObj;
  }

  openWindow(id) {
    const w = this.windows.get(id);
    if (!w) return;
    w.open = true;
    w.minimized = false;
    w.el.style.display = 'flex';
    w.el.classList.remove('minimized');
    this.focusWindow(id);
    this._updateTaskbar();
    playBeep(880, 0.05);
  }

  focusWindow(id) {
    const w = this.windows.get(id);
    if (!w) return;
    this.zCounter++;
    w.el.style.zIndex = this.zCounter;
    this.root.querySelectorAll('.win-frame').forEach((win) => win.classList.remove('active'));
    w.el.classList.add('active');
    this.activeWindow = id;
    this._updateTaskbar();
  }

  closeWindow(id) {
    const w = this.windows.get(id);
    if (!w) return;
    w.open = false;
    w.el.style.display = 'none';
    this._updateTaskbar();
    playBeep(440, 0.04);
  }

  minimizeWindow(id) {
    const w = this.windows.get(id);
    if (!w) return;
    w.minimized = true;
    w.el.style.display = 'none';
    this._updateTaskbar();
  }

  _updateTaskbar() {
    const tb = this.root.querySelector('#taskbar-apps');
    if (!tb) return;
    tb.innerHTML = '';
    for (const [id, w] of this.windows) {
      if (!w.open) continue;
      const tab = document.createElement('button');
      tab.className = `tb-app ${this.activeWindow === id && !w.minimized ? 'active' : ''}`;
      tab.textContent = w.title.split('·')[0].trim();
      tab.onclick = () => {
        if (w.minimized) {
          w.minimized = false;
          w.el.style.display = 'flex';
          this.focusWindow(id);
        } else if (this.activeWindow === id) {
          this.minimizeWindow(id);
        } else {
          this.focusWindow(id);
        }
      };
      tb.appendChild(tab);
    }
  }

  _startClock() {
    const clockEl = this.root.querySelector('#tray-clock');
    const tick = () => {
      const d = new Date();
      if (clockEl) clockEl.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    tick();
    setInterval(tick, 1000);
  }

  show() {
    this.visible = true;
    this.root.classList.add('on');
    const screen = this.root.querySelector('.crt-screen');
    if (screen) screen.classList.remove('power-off');
    playBeep(520, 0.12);
  }

  hide() {
    this.visible = false;
    this.root.classList.remove('on');
  }

  triggerTakeoff() {
    this.onFlyReact('takeoff');
    playFlyBuzz(0.7, 260);
    this.powerDown(() => this.onExit());
  }

  powerDown(done) {
    const screen = this.root.querySelector('.crt-screen');
    if (screen) screen.classList.add('power-off');
    playBeep(240, 0.22);
    setTimeout(() => {
      this.hide();
      if (screen) screen.classList.remove('power-off');
      if (done) done();
    }, 280);
  }

  _runEditorScript(text) {
    playBeep(980, 0.06);
    this.onFlyReact('write');
    const lines = text.split('\n');
    let ran = 0;

    for (const line of lines) {
      const t = translate(line);
      if (!t) continue;

      this._logToIde(`> ${line.trim()}`, 'echo');
      const r = this.runCommand(t.phrase);
      if (r) {
        this._logToIde(r.text, r.tone || '');
      }
      if (t.then) {
        const r2 = this.runCommand(t.then);
        if (r2) {
          this._logToIde(r2.text, r2.tone || '');
        }
      }
      if (t.isStunt) {
        if (typeof window !== 'undefined' && window.triggerCubbonNectarParty) {
          window.triggerCubbonNectarParty();
        } else if (this.world && this.world.doStunt) {
          this.world.doStunt('barrel_roll', 2.8);
        }
      }
      if (t.isTakeoff) {
        setTimeout(() => this.triggerTakeoff(), 400);
      }
      ran++;
    }

    if (!ran) {
      this._logToIde('No executable flight commands found. Try: fly_to("home") / reward(1.0) / takeoff()', 'hint');
    }
  }

  update() {
    if (!this.visible) return;
    const s = this.getState();

    // Draw live Fluctfly wave oscillator
    this._drawWaves();

    // Update Brain Telemetry
    const bumpEl = this.root.querySelector('#w-bump');
    const epgEl = this.root.querySelector('#w-epg');
    const synEl = this.root.querySelector('#w-syn');
    if (bumpEl) bumpEl.textContent = s.bump.toFixed(2);
    if (epgEl) epgEl.textContent = `${s.epgHz.toFixed(0)} Hz`;
    if (synEl) synEl.textContent = s.changed.toLocaleString('en-US');

    // Update Perch Fly Telemetry
    const flapEl = this.root.querySelector('#perch-flap');
    if (flapEl) flapEl.textContent = `${(194 + Math.sin(Date.now() / 400) * 8).toFixed(0)} Hz`;

    // Update Valence Profile
    const valEl = this.root.querySelector('#w-valence-list');
    if (valEl && s.valence) {
      valEl.innerHTML = s.valence
        .map((v) => {
          const pct = Math.max(0, Math.min(1, (v.v + 1) / 2));
          const col = v.v > 0.08 ? '#38d39f' : v.v < -0.08 ? '#ff5252' : '#708090';
          return `
            <div class="v-row">
              <span class="v-lbl">${v.label}</span>
              <div class="v-meter"><i style="width:${(pct * 100).toFixed(0)}%;background:${col}"></i></div>
              <span class="v-val" style="color:${col}">${v.v >= 0 ? '+' : ''}${v.v.toFixed(2)}</span>
            </div>
          `;
        })
        .join('');
    }

    // Update Synapse Matrix visual
    const synVis = this.root.querySelector('#syn-visual');
    if (synVis && !synVis.children.length) {
      let dots = '';
      for (let i = 0; i < 96; i++) {
        const isDepressed = i < Math.min(96, Math.floor((s.changed / 2500) * 96));
        dots += `<span class="s-dot ${isDepressed ? 'active' : ''}"></span>`;
      }
      synVis.innerHTML = dots;
    }
  }
}
