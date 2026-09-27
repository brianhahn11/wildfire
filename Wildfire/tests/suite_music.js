// The score.
//
// There is no audio device here, so nothing in this file listens to anything.
// What it CAN check is everything that would make the music wrong before a
// speaker is involved: a note name that does not parse (and therefore plays
// at 0Hz — silence, with no error), a zone with no theme, a harmony sitting
// on the lead, a tempo that makes the look-ahead scheduler stutter.
//
// It also checks the thing that matters most in this environment: that the
// whole music module is INERT without an AudioContext. It runs a setInterval,
// and a stray interval in a headless run keeps node alive and hangs the suite
// runner rather than failing it.
const {X, press, tick} = require('./harness.js');
require('./strict.js');

let fails = 0;
const ok = (c,l,e) => { console.log('  '+(c?'ok  ':'FAIL')+'  '+l+(e?'  — '+e:'')); if(!c) fails++; };
const M = X.Music;

// ---------------------------------------------------------------------------
console.log('=== EVERY NOTE IN EVERY TRACK IS A NOTE ===');
{
  // A token that does not parse returns 0Hz, which is not an error and not a
  // crash — it is simply a hole in the tune that nothing reports.
  const bad = [];
  const range = [];
  for(const id in M.TRACKS){
    const tr = M.TRACKS[id];
    for(const voice of ['lead','harm','bass']){
      const part = tr[voice]; if(!part) continue;
      part.forEach((tok,i)=>{
        if(tok==='-' || tok==='.') return;
        const f = M.hz(tok);
        if(!f) bad.push(id+'.'+voice+'['+i+']="'+tok+'"');
        // 55Hz is the bottom of what a laptop speaker reproduces; above 3kHz a
        // square wave stops being a note and starts being a whistle
        else if(f < 55 || f > 3000) range.push(id+'.'+voice+' '+tok+' @'+Math.round(f)+'Hz');
      });
    }
    if(tr.drum){
      const odd = [...tr.drum].filter(ch=>'ksh-'.indexOf(ch)<0);
      if(odd.length) bad.push(id+'.drum has "'+odd.join('')+'"');
    }
  }
  ok(bad.length===0, 'every token parses to a pitch or a rest', bad.join(', '));
  ok(range.length===0, 'and every pitch is inside what a speaker reproduces',
     range.join(', '));

  // the parser itself, against the two anchors everything else hangs off
  ok(Math.abs(M.hz('A4')-440) < 0.01, 'A4 is 440Hz', M.hz('A4').toFixed(2));
  ok(Math.abs(M.hz('A5')-880) < 0.01, 'and an octave up is double', M.hz('A5').toFixed(2));
  ok(Math.abs(M.hz('C#5')-M.hz('Db5')) < 0.01, 'sharps and flats agree');
}

// ---------------------------------------------------------------------------
console.log('\n=== EVERY PLACE YOU CAN STAND HAS A THEME ===');
{
  const missing = Object.keys(X.AREAS).filter(id=>!M.forArea(id));
  ok(missing.length===0, 'every area maps to a track', missing.join(','));
  const dangling = Object.keys(M.ZONE_TRACK).filter(z=>!M.TRACKS[M.ZONE_TRACK[z]]);
  ok(dangling.length===0, 'and every mapping names a track that exists',
     dangling.join(','));
  const unused = Object.keys(M.TRACKS)
    .filter(t=>t!=='title' && !Object.values(M.ZONE_TRACK).includes(t));
  ok(unused.length===0, 'and no track is written and never played', unused.join(','));
  ok(!!M.TRACKS.title, 'the title has its own');
}

// ---------------------------------------------------------------------------
console.log('\n=== THE TITLE IS THE LOUD ONE AND THE ZONES ARE NOT ===');
{
  // The brief was "dramatic, high energy" for the title and "lower key" for
  // everywhere else. That is a measurable claim: notes per second, and
  // whether there is a kit under it at all.
  const density = id => {
    const tr = M.TRACKS[id], sd = 60/tr.bpm/tr.div;
    const steps = 64;
    let n = 0;
    for(let i=0;i<steps;i++)
      for(const v of ['lead','harm','bass']){
        const p = tr[v]; if(!p||!p.length) continue;
        const t = p[i%p.length];
        if(t && t!=='-' && t!=='.') n++;
      }
    return n / (steps*sd);
  };
  const title = density('title');
  const zones = Object.keys(M.ZONE_TRACK).map(z=>M.ZONE_TRACK[z])
                  .filter((v,i,a)=>a.indexOf(v)===i);
  const worst = Math.max(...zones.map(density));
  ok(title > worst * 2, 'the title is at least twice as busy as any zone',
     title.toFixed(1)+' notes/s vs '+worst.toFixed(1));
  ok(M.TRACKS.title.bpm >= 140, 'and fast', M.TRACKS.title.bpm+'bpm');
  ok(!!M.TRACKS.title.drum && /k/.test(M.TRACKS.title.drum),
     'and has a kick under it', M.TRACKS.title.drum);
  for(const z of zones)
    ok(M.TRACKS[z].bpm < M.TRACKS.title.bpm, z+' is slower than the title',
       M.TRACKS[z].bpm+'bpm');
}

// ---------------------------------------------------------------------------
console.log('\n=== TWO SQUARE VOICES NEVER PLAY THE SAME NOTE ===');
{
  // Lead and harmony are both square channels. Landing on the same pitch is
  // not a chord, it is one slightly louder voice — a third of a four-channel
  // arrangement silently thrown away.
  const clashes = [];
  for(const id in M.TRACKS){
    const tr = M.TRACKS[id];
    if(!tr.lead || !tr.harm) continue;
    for(let i=0;i<256;i++){
      const l = tr.lead[i % tr.lead.length], h = tr.harm[i % tr.harm.length];
      if(!l||!h||l==='-'||h==='-'||l==='.'||h==='.') continue;
      if(Math.abs(M.hz(l)-M.hz(h)) < 0.6) clashes.push(id+' step '+i+': '+l);
    }
  }
  ok(clashes.length===0, 'no unisons anywhere in the score',
     clashes.slice(0,4).join(', '));
}

// ---------------------------------------------------------------------------
console.log('\n=== IT IS COMPLETELY INERT WITHOUT AN AUDIO DEVICE ===');
{
  // This is the one that protects the test runner itself. The module drives a
  // setInterval; if it ever starts one in a headless run, node never exits and
  // the suite hangs instead of failing, which looks like an infrastructure
  // problem rather than a bug.
  ok(X.Sfx ? X.Sfx.ctx()===null : true, 'there is no audio context here');

  const before = process._getActiveHandles ? process._getActiveHandles().length : 0;
  M.play('title');
  M.play('ironhaven');
  M.wake();
  for(const z in M.ZONE_TRACK) M.play(M.ZONE_TRACK[z]);
  M.stop();
  const after = process._getActiveHandles ? process._getActiveHandles().length : 0;
  ok(after <= before, 'playing every track starts no timers',
     before+' -> '+after);

  // and the game driving it is equally quiet
  X.G.nPlayers = 1; X.G.picks = [{cls:4,drg:0}];
  X.G.state = X.ST.PLAY; X.beginGame();
  for(let i=0;i<10;i++) tick();
  let threw = null;
  try {
    for(const z of Object.keys(X.AREAS))
      X.loadArea(z, X.AREAS[z].playerStart.x, X.AREAS[z].playerStart.y);
  } catch(err){ threw = err.message; }
  ok(!threw, 'and walking the whole world throws nothing', threw||'');
  ok(M.playing()!==undefined, 'while still tracking what it would be playing',
     String(M.playing()));
}

// ---------------------------------------------------------------------------
console.log('\n=== THE AREA DECIDES THE TRACK ===');
{
  const want = { house:'millbrook', clearing:'millbrook', gate:'millbrook',
                 cogway:'ironhaven', verge:'verge', scarp:'scarp',
                 shoals:'shoals', undercroft:'deep', glimmervein:'deep' };
  for(const id in want){
    X.loadArea(id, X.AREAS[id].playerStart.x, X.AREAS[id].playerStart.y);
    ok(M.playing()===want[id], id+' plays '+want[id], String(M.playing()));
  }
}

// ---------------------------------------------------------------------------
console.log('\n=== ALL SEVEN TRACKS ARE THE SAME VOLUME ===');
{
  // Written one at a time at seven different densities, they came out ten
  // decibels apart — the title was roughly twice as loud as the cave, so
  // riding the lift down felt like someone had turned the game off.
  //
  // The module now computes each track's gain from its own notes. The
  // temptation is to test that by repeating the same sum here, which would be
  // a test that cannot fail. So this SYNTHESISES each track instead — actual
  // samples, actual envelopes — and measures the result. That is what caught
  // the original error: drums were modelled as a flat duty when they are an
  // exponential decay, which over-counted the only track with a kit by about
  // fivefold and pushed it below everything else.
  const RATE = 11025, SECS = 6;
  const sq = (t,f)=> ((t*f)%1) < 0.5 ? 1 : -1;
  const tri = (t,f)=>{ const p=(t*f)%1; return p<0.5 ? 4*p-1 : 3-4*p; };

  function render(id){
    const tr = M.TRACKS[id], V = tr.vol||{}, sd = 60/tr.bpm/tr.div;
    const g = M.busLevel(id);
    const buf = new Float32Array(RATE*SECS);
    const note=(at,dur,f,vol,type)=>{
      const i0=Math.floor(at*RATE), n=Math.floor(dur*RATE);
      const atk=Math.floor(0.008*RATE), rel=Math.floor(Math.min(0.09,dur*0.5)*RATE);
      for(let i=0;i<n;i++){
        const j=i0+i; if(j<0||j>=buf.length) continue;
        let e=1; if(i<atk) e=i/atk; else if(i>n-rel) e=(n-i)/rel;
        buf[j] += (type==='tri'?tri(i/RATE,f):sq(i/RATE,f))*vol*e*g;
      }
    };
    const hit=(at,kind,vol)=>{
      const dur = kind==='k'?0.14 : kind==='h'?0.035 : 0.13;
      const i0=Math.floor(at*RATE), n=Math.floor(dur*RATE);
      for(let i=0;i<n;i++){
        const j=i0+i; if(j<0||j>=buf.length) continue;
        const t=i/RATE, e=Math.pow(1-i/n,2.2);
        const v = kind==='k' ? Math.sin(2*Math.PI*(150*Math.pow(42/150,t/0.11))*t)
                             : (Math.random()*2-1);
        buf[j] += v*vol*e*g;
      }
    };
    for(let i=0; i*sd < SECS; i++){
      const t=i*sd;
      for(const nm of ['lead','harm','bass']){
        const part=tr[nm]; if(!part||!part.length) continue;
        const tok=part[i%part.length];
        if(!tok||tok==='-'||tok==='.') continue;
        let len=1; for(let k=1;k<16;k++){ if(part[(i+k)%part.length]==='.'){len++;continue;} break; }
        const vol = nm==='bass'?(V.bass||0.09):nm==='harm'?(V.harm||0.03):(V.lead||0.06);
        note(t, sd*len*0.92, M.hz(tok), vol, nm==='bass'?'tri':'sq');
      }
      if(tr.drum){ const d=tr.drum[i%tr.drum.length];
        if(d&&d!=='-') hit(t, d, (V.drum||0.2)*(d==='h'?0.45:1)); }
    }
    let sum=0, peak=0;
    for(const v of buf){ sum+=v*v; if(Math.abs(v)>peak) peak=Math.abs(v); }
    return { db: 20*Math.log10(Math.max(1e-9, Math.sqrt(sum/buf.length))), peak };
  }

  const ids = Object.keys(M.TRACKS);
  const out = ids.map(render);
  const dbs = out.map(o=>o.db);
  const spread = Math.max(...dbs) - Math.min(...dbs);
  ok(spread < 3.5, 'no more than 3.5dB between the loudest and the quietest',
     spread.toFixed(1)+'dB  ('+ids.map((id,i)=>id+' '+dbs[i].toFixed(1)).join(', ')+')');
  const clipped = ids.filter((id,i)=>out[i].peak > 1);
  ok(clipped.length===0, 'and nothing clips', clipped.join(','));

  const hot = ids.filter(id=>M.trackGain(id) > 2);
  ok(hot.length===0, 'nothing had to be amplified past 2x to get there', hot.join(','));
  const quiet = ids.filter(id=>M.busLevel(id) < 0.05);
  ok(quiet.length===0, 'nor turned down into inaudibility', quiet.join(','));
}

// ---------------------------------------------------------------------------
console.log('\n=== A TRACK ONLY RESTARTS WHEN YOU CHANGE ZONE ===');
{
  // wake() runs on EVERY keypress, because that is the only reliable moment
  // the browser will let us make a sound. It used to reset the playhead each
  // time, so the tune restarted from the top on every step, swing and menu
  // keystroke and never reached its second bar.
  //
  // There is no audio clock here, so what is checked is the decision: play()
  // on the track already playing must be a no-op, and only a genuinely new
  // track may reset anything.
  X.G.nPlayers = 1; X.G.picks = [{cls:4,drg:0}];
  X.G.state = X.ST.PLAY; X.beginGame();
  for(let i=0;i<10;i++) tick();

  X.loadArea('verge', X.AREAS.verge.playerStart.x, X.AREAS.verge.playerStart.y);
  ok(M.playing()==='verge', 'walking into the Verge starts its theme', String(M.playing()));

  // hammer the keys the way a player does
  for(let n=0;n<50;n++){ press('w'); press(' '); press('arrowup'); press('tab'); press('tab'); }
  ok(M.playing()==='verge', 'fifty keystrokes later it is still the Verge theme',
     String(M.playing()));

  // the same area again is not a zone change
  X.loadArea('verge', X.AREAS.verge.playerStart.x, X.AREAS.verge.playerStart.y);
  ok(M.playing()==='verge', 'and reloading the same area does not switch tracks');

  // two areas that share a theme must not restart it either
  X.loadArea('undercroft', X.AREAS.undercroft.playerStart.x, X.AREAS.undercroft.playerStart.y);
  ok(M.playing()==='deep', 'the Undercroft plays the deep theme');
  X.loadArea('glimmervein', X.AREAS.glimmervein.playerStart.x, X.AREAS.glimmervein.playerStart.y);
  ok(M.playing()==='deep', 'and walking into the cave keeps playing it',
     String(M.playing()));

  X.loadArea('cogway', X.AREAS.cogway.playerStart.x, X.AREAS.cogway.playerStart.y);
  ok(M.playing()==='ironhaven', 'but a real change of zone does change it',
     String(M.playing()));
}

// ---------------------------------------------------------------------------
console.log('\n=== 777 ===');
{
  X.G.nPlayers = 2; X.G.picks = [{cls:4,drg:0},{cls:1,drg:2}];
  X.G.state = X.ST.PLAY; X.beginGame();
  for(let i=0;i<10;i++) tick();
  ok(!X.G.godMode, 'off to begin with');
  const base = X.PLAYERS[0].aethiteMax;

  X.G.state = X.ST.JOURNAL;
  X.G.codexPage = X.TABS.findIndex(t=>t.id==='options');
  press('7'); press('7');
  ok(!X.G.godMode, 'two sevens are not three', String(X.G.godBuf));
  press('7');
  ok(X.G.godMode, 'three are');
  ok(X.PLAYERS.every(p=>p.aethiteMax===999), 'both players get 999 of store',
     X.PLAYERS.map(p=>p.aethiteMax).join('/'));
  ok(X.PLAYERS.every(p=>p.dragon.bond===99), 'and both dragons go to bond 99',
     X.PLAYERS.map(p=>p.dragon.bond).join('/'));
  ok(base < 999, 'which is not where they started', String(base));

  // an interrupted run must not arm it
  X.G.godMode = false; X.G.godBuf = '';
  press('7'); press('3'); press('7'); press('7');
  ok(!X.G.godMode, '7 3 7 7 does not count', String(X.G.godBuf));
  press('7');
  ok(X.G.godMode, 'but the next 7 completes it');

  // and it is not reachable from the ordinary game keys
  X.G.godMode = false; X.G.godBuf = '';
  X.G.state = X.ST.PLAY;
  for(let n=0;n<10;n++) press('7');
  ok(!X.G.godMode, 'and it does nothing outside the options page');
}

console.log(fails ? '\nFAIL ('+fails+')' : '\nPASS');
process.exit(fails ? 1 : 0);
