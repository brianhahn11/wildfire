
// ============================================================================
// MUSIC — a four-voice chiptune tracker, no assets
//
// The same rule as everything else in this project: nothing is loaded, it is
// all generated. Four voices, because four is what the hardware this is
// pretending to be had — two pulse channels, a triangle, and a noise channel:
//
//   lead   square    the tune
//   harm   square    a second pulse under it, usually a third or a fifth
//   bass   triangle  the root movement
//   drum   noise     kick, snare, hat
//
// SCHEDULING. Notes are scheduled against the AUDIO clock, never against
// setTimeout. A timer fires often, looks a little way into the future, and
// books every step that falls inside that window at an exact audio time. The
// timer being late by 30ms therefore costs nothing — the notes were already
// booked. Sequencing straight off setTimeout gives you a tune that swims,
// which is the one thing an eight-bit score cannot survive.
//
// Each voice loops at ITS OWN length. A bassline sixteen steps long under a
// sixty-four step melody is written once rather than four times, and a hat
// pattern of eight steps under both costs eight characters. That is also how
// these things were actually written.
// ============================================================================

const Music = (()=>{
  const LOOKAHEAD = 0.14;    // seconds of future to book on each pass
  const TICK      = 30;      // ms between passes

  // --- notes ---------------------------------------------------------------
  // Scientific pitch: 'A4', 'C#5', 'Eb3'. '-' is a rest, '.' is a tie (hold
  // whatever is sounding). Parsed once and cached, because this runs inside
  // the scheduler and the table is small.
  const SEMI = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
  const HZ = {};
  function hz(n){
    if(HZ[n]!==undefined) return HZ[n];
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(n);
    if(!m) return (HZ[n] = 0);
    let k = SEMI[m[1]] + (m[2]==='#' ? 1 : m[2]==='b' ? -1 : 0);
    const oct = parseInt(m[3],10);
    // A4 = 440Hz = MIDI 69
    const midi = (oct+1)*12 + k;
    return (HZ[n] = 440 * Math.pow(2, (midi-69)/12));
  }

  // --- voices --------------------------------------------------------------
  // Every voice is one oscillator per note with its own envelope. Reusing a
  // single oscillator per channel and sliding its frequency is more faithful,
  // but it makes rests and overlapping releases fiddly for no audible gain at
  // this tempo.
  function pluck(t, freq, dur, vol, type, glideFrom){
    const c = Sfx.ctx(), out = Sfx.bus();
    if(!c || !out || !freq) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    if(glideFrom){
      o.frequency.setValueAtTime(glideFrom, t);
      o.frequency.exponentialRampToValueAtTime(freq, t+0.045);
    } else {
      o.frequency.setValueAtTime(freq, t);
    }
    const atk = 0.008, rel = Math.min(0.09, dur*0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t+atk);
    g.gain.setValueAtTime(vol, t+Math.max(atk, dur-rel));
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t+dur+0.02);
  }

  // One shared noise buffer. Building a fresh one per hat at 8 hats a bar was
  // the single most expensive thing in here.
  let NOISE = null;
  function noiseBuf(c){
    if(NOISE && NOISE.sampleRate===c.sampleRate) return NOISE;
    const n = Math.floor(c.sampleRate * 0.5);
    const b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for(let i=0;i<n;i++) d[i] = Math.random()*2-1;
    NOISE = b; return b;
  }
  function hit(t, kind, vol){
    const c = Sfx.ctx(), out = Sfx.bus();
    if(!c || !out) return;
    if(kind==='k'){
      // kick: a pitch drop on a sine, which is all a kick has ever been
      const o=c.createOscillator(), g=c.createGain();
      o.type='sine';
      o.frequency.setValueAtTime(150,t);
      o.frequency.exponentialRampToValueAtTime(42,t+0.11);
      g.gain.setValueAtTime(vol,t);
      g.gain.exponentialRampToValueAtTime(0.0001,t+0.14);
      o.connect(g); g.connect(out); o.start(t); o.stop(t+0.16);
      return;
    }
    const src=c.createBufferSource(); src.buffer=noiseBuf(c);
    src.playbackRate.value = kind==='h' ? 1.9 : 1.0;
    const bp=c.createBiquadFilter();
    bp.type = kind==='h' ? 'highpass' : 'bandpass';
    bp.frequency.setValueAtTime(kind==='h' ? 6500 : 1500, t);
    bp.Q.value = kind==='h' ? 0.7 : 1.4;
    const dur = kind==='h' ? 0.035 : 0.13;
    const g=c.createGain();
    g.gain.setValueAtTime(vol,t);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    src.connect(bp); bp.connect(g); g.connect(out);
    src.start(t); src.stop(t+dur+0.01);
  }

  // --- the songs -----------------------------------------------------------
  // `div` is steps per beat. Voice arrays loop independently at their own
  // length. Drums are a string, one character per step: k kick, s snare,
  // h hat, - nothing.
  //
  // Everything is in D minor or a mode of it, so a zone change is a change of
  // pace and register rather than a change of key — walking from the city out
  // to the beach should not sound like changing the channel.
  const TRACKS = {

    // ---- TITLE. 154bpm, driving, the only track with a full kit. ----------
    title: {
      bpm:154, div:4,
      lead:[
        'D5','-','A4','-',  'F5','-','E5','-',  'D5','-','C5','-',  'A4','-','-','-',
        'F5','-','C5','-',  'A5','-','G5','-',  'F5','-','E5','-',  'D5','-','-','-',
        'A5','-','G5','-',  'F5','-','E5','-',  'D5','-','E5','-',  'F5','-','G5','-',
        'A5','-','-','-',   'G5','F5','E5','-', 'D5','-','A4','-',  'D5','-','-','-'
      ],
      harm:[
        'A4','-','F4','-',  'D5','-','C5','-',  'A4','-','G4','-',  'F4','-','-','-',
        'D4','-','A4','-',  'F5','-','E5','-',  'D5','-','C5','-',  'A4','-','-','-',
        'F5','-','E5','-',  'D5','-','C5','-',  'A4','-','C5','-',  'D5','-','E5','-',
        'F5','-','-','-',   'E5','D5','C5','-', 'A4','-','F4','-',  'A4','-','-','-'
      ],
      bass:[
        'D2','-','D3','-',  'D2','-','D2','-',  'Bb1','-','Bb2','-', 'Bb1','-','Bb1','-',
        'F2','-','F3','-',  'F2','-','F2','-',  'C2','-','C3','-',  'C2','-','A1','-'
      ],
      drum: 'k-h-s-h-k-h-s-hh',
      vol:{ lead:0.085, harm:0.052, bass:0.115, drum:0.30 }
    },

    // ---- MILLBROOK. The cottage, the clearing, the road. Warm, unhurried. --
    millbrook: {
      bpm:84, div:2,
      lead:[
        'D4','-','F4','-',  'A4','-','G4','-',  'F4','-','E4','-',  'D4','-','-','-',
        'A4','-','G4','-',  'F4','-','D4','-',  'E4','-','F4','-',  'D4','-','-','-'
      ],
      harm:[ 'F3','-','-','-', 'A3','-','-','-', 'D4','-','-','-', 'A3','-','-','-' ],
      bass:[ 'D2','-','-','-', 'Bb1','-','-','-', 'F2','-','-','-', 'A1','-','-','-' ],
      drum: null,
      vol:{ lead:0.055, harm:0.030, bass:0.075 }
    },

    // ---- IRONHAVEN. The ring. Stately, mechanical, a slow pulse under it. --
    ironhaven: {
      bpm:96, div:2,
      lead:[
        'A4','-','-','-',   'C5','-','A4','-',  'G4','-','-','-',   'F4','-','-','-',
        'D5','-','-','-',   'C5','-','A4','-',  'Bb4','-','A4','-', 'G4','-','-','-'
      ],
      harm:[ 'D4','-','F4','-', 'E4','-','D4','-' ],
      bass:[ 'D2','-','A2','-', 'Bb1','-','F2','-', 'C2','-','G2','-', 'D2','-','A1','-' ],
      drum: 'k---h---k---h-h-',
      vol:{ lead:0.050, harm:0.028, bass:0.085, drum:0.10 }
    },

    // ---- THE VERGE. Grassland. Open, airy, the highest of the five. -------
    verge: {
      bpm:90, div:2,
      lead:[
        'A4','-','D5','-',  'E5','-','D5','-',  'C5','-','A4','-',  'G4','-','-','-',
        'F4','-','A4','-',  'C5','-','D5','-',  'E5','-','D5','-',  'A4','-','-','-'
      ],
      // Sat on the lead's own F4 every other bar — two square channels on the
      // same note is one slightly louder channel and a wasted third of the
      // arrangement. Dropped an octave, it holds the chord instead.
      harm:[ 'F3','-','-','-', 'A3','-','-','-', 'G3','-','-','-', 'E3','-','-','-' ],
      // G2 rather than G1: 49Hz is below what a laptop speaker reproduces,
      // so the fourth bar's root simply disappeared and the phrase landed on
      // nothing.
      bass:[ 'D2','-','-','-', 'F2','-','-','-', 'C2','-','-','-', 'G2','-','-','-' ],
      drum: null,
      vol:{ lead:0.050, harm:0.028, bass:0.070 }
    },

    // ---- THE IRON SCARP. Mountains. Cold, sparse, low, slow. --------------
    scarp: {
      bpm:70, div:2,
      lead:[
        'D4','-','-','-',   '-','-','F4','-',   'E4','-','-','-',   '-','-','-','-',
        'Bb3','-','-','-',  '-','-','D4','-',   'C4','-','-','-',   '-','-','-','-'
      ],
      harm:[ 'A3','-','-','-','-','-','-','-' ],
      bass:[ 'D2','-','-','-','-','-','-','-', 'Bb1','-','-','-','-','-','-','-' ],
      drum: '----------------k---------------',
      vol:{ lead:0.048, harm:0.026, bass:0.090, drum:0.08 }
    },

    // ---- THE RIVET SHOALS. Beach. Gentle, rolling, a hat like surf. -------
    shoals: {
      bpm:80, div:2,
      lead:[
        'F4','-','A4','-',  'C5','-','A4','-',  'G4','-','F4','-',  'D4','-','-','-',
        'C4','-','F4','-',  'A4','-','G4','-',  'F4','-','E4','-',  'D4','-','-','-'
      ],
      harm:[ 'D3','-','-','-', 'F3','-','-','-', 'C4','-','-','-', 'A3','-','-','-' ],
      bass:[ 'D2','-','-','-', 'F2','-','-','-', 'C2','-','-','-', 'A1','-','-','-' ],
      drum: '--h---h---h---h-',
      vol:{ lead:0.048, harm:0.026, bass:0.070, drum:0.055 }
    },

    // ---- BELOW. Undercroft and Glimmervein. Dark, minimal, uneasy. -------
    // Deliberately the thinnest track in the game: two voices, no drums, and
    // long gaps. It is the only place you go where the game wants you to feel
    // that nothing up there can hear you.
    deep: {
      bpm:62, div:2,
      lead:[
        'D4','-','-','-',   '-','-','-','-',    'Eb4','-','-','-',  '-','-','-','-',
        'C4','-','-','-',   '-','-','-','-',    'A3','-','-','-',   '-','-','-','-'
      ],
      harm:[ '-','-','-','-','-','-','-','-','Bb2','-','-','-','-','-','-','-' ],
      // D2, not D1. A 37Hz drone is the right idea and completely inaudible
      // on anything without a woofer, so the low end simply vanished and the
      // track was two voices where it was meant to be three.
      bass:[ 'D2','-','-','-','-','-','-','-' ],
      drum: null,
      vol:{ lead:0.045, harm:0.030, bass:0.100 }
    }
  };

  // Which track plays where. Anything not listed gets no music rather than a
  // default, because a zone silently inheriting the wrong theme is worse than
  // one that is quiet.
  const ZONE_TRACK = {
    house:'millbrook', clearing:'millbrook', gate:'millbrook',
    cogway:'ironhaven',
    verge:'verge', scarp:'scarp', shoals:'shoals',
    undercroft:'deep', glimmervein:'deep'
  };

  // --- levelling -----------------------------------------------------------
  //
  // Seven tracks written by hand at seven different densities came out ten
  // decibels apart — the title was roughly twice as loud as the cave, so
  // walking down a lift felt like someone had turned the game down.
  //
  // Rather than a hand-tuned gain per track, which goes stale the moment a
  // pattern is edited, each track's level is COMPUTED from its own notes: sum
  // the energy one note at a time over a long window, take the RMS, and scale
  // to a common target. Loudness is RMS and not peak, because a track with one
  // loud kick and a lot of silence peaks high and sounds quiet, and matching
  // peaks is what produced the ten-decibel spread in the first place.
  //
  // Edit any pattern and the level follows it. Nothing to remember.
  const MUSIC_LEVEL = 0.55;     // where a normalised track sits on the bus
  const TARGET_RMS  = 0.036;    // the common loudness, in raw amplitude
  const NORM_STEPS  = 512;      // long enough to cover any lcm of our patterns
  // A note's mean square, as a fraction of its peak. The envelope is a short
  // attack, a sustain, and a release, so this is the sustain at full power
  // plus the two ramps at a third of it — a linear ramp's mean square is 1/3.
  //
  // A flat guess was used first and left a four-decibel spread, because a
  // sparse track is mostly LONG notes, which spend nearly all of their time at
  // full amplitude, while a busy one is mostly short notes that are nearly all
  // ramp. Getting this wrong systematically favours whichever track is sparse.
  const ATTACK = 0.008;
  function envDuty(dur){
    const rel = Math.min(0.09, dur*0.5);
    const flat = Math.max(0, dur - ATTACK - rel);
    return (flat + (ATTACK + rel)/3) / dur;
  }
  // Drums are an exponential decay, not a sustain: the gain falls to nothing
  // over the hit, so the mean square is a small fraction of the peak — and a
  // third of that again for the two noise voices, which is a noise signal's
  // mean square. Treating them as a flat 30% over-counted their energy about
  // fivefold and pushed the only track with a kit down below everything else.
  const HIT_DUTY = { k:0.027, s:0.018, h:0.018 };
  const levelCache = {};

  function noteLen(part, i){
    let len = 1;
    for(let k=1;k<16;k++){ if(part[(i+k) % part.length]==='.'){ len++; continue; } break; }
    return len;
  }
  function trackGain(id){
    if(levelCache[id] !== undefined) return levelCache[id];
    const tr = TRACKS[id];
    if(!tr) return 1;
    const V = tr.vol || {}, sd = 60/tr.bpm/tr.div;
    let energy = 0;                              // amplitude^2 x seconds
    for(let i=0;i<NORM_STEPS;i++){
      for(const name of ['lead','harm','bass']){
        const part = tr[name]; if(!part || !part.length) continue;
        const tok = part[i % part.length];
        if(!tok || tok==='-' || tok==='.') continue;
        const v = name==='bass' ? (V.bass||0.09)
                : name==='harm' ? (V.harm||0.03)
                :                 (V.lead||0.06);
        const dur = sd * noteLen(part,i) * 0.92;
        energy += v*v * envDuty(dur) * dur;
      }
      if(tr.drum){
        const d = tr.drum[i % tr.drum.length];
        if(d && d!=='-'){
          const v = (V.drum||0.2) * (d==='h' ? 0.45 : 1);
          energy += v*v * (HIT_DUTY[d]||0.02) * (d==='h' ? 0.035 : 0.13);
        }
      }
    }
    const rms = Math.sqrt(energy / (NORM_STEPS*sd));
    // Capped, so a nearly-empty track cannot be amplified into a roar of its
    // own two notes chasing a target it was never going to reach honestly.
    const g = rms > 0 ? Math.min(2.2, TARGET_RMS/rms) : 1;
    return (levelCache[id] = g);
  }
  function busLevel(id){ return MUSIC_LEVEL * trackGain(id); }

  // --- transport -----------------------------------------------------------
  let timer = null;        // the look-ahead interval
  let cur   = null;        // the track playing now
  let curId = null;
  let step  = 0;           // which step of the song is next to be booked
  let nextT = 0;           // the audio time that step falls on
  let fade  = null;        // { from, to, t, dur } while crossfading

  function stepDur(tr){ return 60 / tr.bpm / tr.div; }

  function bookStep(tr, i, t){
    const V = tr.vol || {};
    const sd = stepDur(tr);
    for(const name of ['lead','harm','bass']){
      const part = tr[name];
      if(!part || !part.length) continue;
      const tok = part[i % part.length];
      if(!tok || tok==='-' || tok==='.') continue;
      // how long the note rings: until the next non-tie token in this voice
      let len = 1;
      for(let k=1;k<16;k++){
        const nx = part[(i+k) % part.length];
        if(nx==='.') { len++; continue; }
        break;
      }
      const dur = sd*len*0.92;
      const f = hz(tok);
      if(name==='bass')      pluck(t, f, dur, V.bass||0.09, 'triangle');
      else if(name==='harm') pluck(t, f, dur, V.harm||0.03, 'square');
      else                   pluck(t, f, dur, V.lead||0.06, 'square');
    }
    if(tr.drum){
      const d = tr.drum[i % tr.drum.length];
      if(d && d!=='-') hit(t, d, (V.drum||0.2) * (d==='h' ? 0.45 : 1));
    }
  }

  function pump(){
    const c = Sfx.ctx();
    if(!c || !cur){ return; }
    const now = c.currentTime;
    if(nextT < now) nextT = now + 0.06;          // we were suspended; resync
    let guard = 0;
    while(nextT < now + LOOKAHEAD && guard++ < 128){
      bookStep(cur, step, nextT);
      step++;
      nextT += stepDur(cur);
    }
  }

  function ensureTimer(){
    if(timer || typeof setInterval!=='function') return;
    timer = setInterval(pump, TICK);
  }

  // --- the two calls the rest of the game makes ----------------------------
  function play(id){
    if(id === curId) return;                      // already on it
    const tr = TRACKS[id];
    const c = Sfx.ctx();
    curId = id || null;
    cur = tr || null;
    if(!tr){ return; }                            // a zone with no theme: silence
    if(!c) return;                                // no audio yet; started on resume
    const bus = Sfx.bus();
    if(bus){
      // Duck through the change rather than cutting. The new track starts at
      // the top of its own song, which is what makes each zone feel like its
      // own place rather than one long piece you are wandering around inside.
      const t = c.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(bus.gain.value, t);
      bus.gain.linearRampToValueAtTime(0.0001, t+0.18);
      bus.gain.linearRampToValueAtTime(busLevel(id), t+0.75);
    }
    step  = 0;
    nextT = c.currentTime + 0.22;
    ensureTimer();
  }

  function stop(){
    cur = null; curId = null;
    if(timer){ clearInterval(timer); timer = null; }
  }

  // Called once the browser has let us make noise. The title screen is drawn
  // before any click, and autoplay policy means the context is suspended
  // until one happens — so whatever was requested before then gets started
  // here instead of being lost.
  function wake(){
    const c = Sfx.ctx();
    if(!c || !curId) return;
    if(!cur) cur = TRACKS[curId] || null;
    if(!cur) return;
    // ONLY start something that is not already running.
    //
    // This is called on every keypress, because that is the only reliable
    // moment at which the browser will let us make a sound. It used to reset
    // the playhead every time, so the tune restarted from the top on every
    // step, swing and menu keystroke and never got past its first bar. The
    // transport is already running if there is a timer and the next step is
    // still in the future; in that case there is nothing to wake.
    if(timer && nextT > c.currentTime - 0.5) return;
    step = 0;
    nextT = c.currentTime + 0.22;
    const bus = Sfx.bus();
    if(bus) bus.gain.setValueAtTime(busLevel(curId), c.currentTime);
    ensureTimer();
  }

  function forArea(id){ return ZONE_TRACK[id] || null; }

  return { play, stop, wake, forArea, TRACKS, ZONE_TRACK, hz,
           trackGain, busLevel, MUSIC_LEVEL, TARGET_RMS,
           playing(){ return curId; } };
})();
