/**
 * Talking to Nona.
 *
 * This parser is DELIBERATELY small and local - no API key, no network, no
 * model. It does exactly one job: turn what you said into (a) a stimulus and
 * (b) a dopamine signal. It never decides where she flies.
 *
 * That constraint is the whole honesty of the project. If this file steered
 * her directly, the claim "the connectome learned it" would be false. All the
 * learning happens in mushroom.js, in real synapses.
 */

export const PRAISE = ['good', 'good girl', 'well done', 'yes', 'nice', 'clever', 'great', 'lovely', 'correct', 'shabash'];
export const SCOLD = ['no', 'bad', 'stop', 'wrong', 'dont', "don't", 'ugh', 'nasty', 'bad girl'];

/** Landmark synonyms -> the key the world uses. */
export const SYNONYMS = {
  home: 'home', house: 'home', lab: 'home', labs: 'home', '2586': 'home', '2586labs': 'home',
  devfolio: 'home', indiranagar: 'home',
  cubbon: 'cubbon', park: 'cubbon', trees: 'cubbon', garden: 'cubbon',
  vidhana: 'vidhana', soudha: 'vidhana', 'vidhana soudha': 'vidhana', government: 'vidhana',
  ub: 'ubcity', ubcity: 'ubcity', 'ub city': 'ubcity', tower: 'ubcity', mall: 'ubcity',
  lalbagh: 'lalbagh', flowers: 'lalbagh', glasshouse: 'lalbagh',
  traffic: 'traffic', road: 'traffic', horns: 'traffic', jam: 'traffic', fumes: 'traffic',
};

const has = (text, list) => list.some((p) => new RegExp(`(^|\\s)${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|\\s|[.!,])`).test(text));

/**
 * @returns {{kind:string, word?:string, text:string}}
 *   kind: 'reward' | 'punish' | 'cue' | 'name' | 'forget' | 'unknown'
 */
export function parse(input) {
  const text = String(input || '').toLowerCase().trim().replace(/\s+/g, ' ');
  if (!text) return { kind: 'unknown', text };

  if (/\b(forget|reset|start over|unlearn)\b/.test(text)) return { kind: 'forget', text };

  // "this is home" / "remember this as home" / "call this home"
  const name = text.match(/(?:this is|remember this as|call this|that is)\s+(?:the\s+)?([a-z0-9 ']{2,24})/);
  if (name) {
    const w = resolve(name[1]);
    if (w) return { kind: 'name', word: w, text };
  }

  const praise = has(text, PRAISE);
  const scold = has(text, SCOLD);

  // "go home", "go to lalbagh", "find the park"
  const go = text.match(/(?:go to|go|fly to|fly|find|take me to|head to|visit)\s+(?:the\s+)?([a-z0-9 ']{2,24})/);
  if (go) {
    const w = resolve(go[1]);
    if (w) return { kind: 'cue', word: w, text };
  }

  // a bare landmark word anywhere in the sentence
  const bare = resolve(text);
  if (bare && !praise && !scold) return { kind: 'cue', word: bare, text };

  if (praise) return { kind: 'reward', word: bare || undefined, text };
  if (scold) return { kind: 'punish', word: bare || undefined, text };

  return { kind: 'unknown', text };
}

/** First landmark synonym found in a phrase. */
export function resolve(phrase) {
  const t = ` ${String(phrase).toLowerCase().trim()} `;
  let best = null;
  let bestAt = Infinity;
  for (const k of Object.keys(SYNONYMS)) {
    const at = t.indexOf(` ${k} `);
    if (at >= 0 && at < bestAt) { bestAt = at; best = SYNONYMS[k]; }
  }
  return best;
}

/** Browser speech input. Returns null where the API is unavailable. */
export function makeListener(onText, onState) {
  const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.lang = 'en-IN';
  r.continuous = true;
  r.interimResults = false;
  r.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) onText(e.results[i][0].transcript);
    }
  };
  r.onend = () => onState && onState(false);
  r.onerror = () => onState && onState(false);
  let on = false;
  return {
    toggle() {
      on = !on;
      try { on ? r.start() : r.stop(); } catch { /* already started/stopped */ }
      onState && onState(on);
      return on;
    },
    get active() { return on; },
  };
}
