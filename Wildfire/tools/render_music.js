// Render the score offline: a WAV per track, plus a piano roll to look at.
//
// There is no browser here, so the only way to check a tune is to build the
// same notes the game would schedule and synthesise them directly. This uses
// the game's own TRACKS table and its own note parser, so if the table is
// wrong this is wrong in exactly the same way — which is the point. It is a
// check on the WRITING, not on the Web Audio plumbing.
//
// Usage: node tools/render_music.js [outdir] [bars]
const fs = require('fs'), path = require('path');
// Read the module's own source rather than carving it out of the bundle:
// the bundle contains other IIFEs that end the same way, and slicing on
// "})();" found one of theirs.
const SRC = fs.readFileSync(path.join(__dirname,'..','src','p1b_music.js'),'utf8');
const Music = (function(){
  // the two things the module asks of the audio layer, stubbed to nothing —
  // this renders the NOTES, not the Web Audio plumbing
  const Sfx = { ctx:()=>null, bus:()=>null };
  return eval(SRC + '\n;Music');
})();

const OUT  = process.argv[2] || '/tmp/music';
const BARS = parseInt(process.argv[3] || '8', 10);
fs.mkdirSync(OUT, { recursive:true });

const RATE = 22050;

// --- the same four voices, as sample generators ----------------------------
function square(t, f){ return ((t*f) % 1) < 0.5 ? 1 : -1; }
function triangle(t, f){ const p=(t*f)%1; return p<0.5 ? (4*p-1) : (3-4*p); }

function mixNote(buf, at, dur, freq, vol, type){
  const i0 = Math.floor(at*RATE), n = Math.floor(dur*RATE);
  const atk = Math.floor(0.008*RATE), rel = Math.floor(Math.min(0.09,dur*0.5)*RATE);
  for(let i=0;i<n;i++){
    const j = i0+i; if(j<0||j>=buf.length) continue;
    let env = 1;
    if(i < atk) env = i/atk;
    else if(i > n-rel) env = (n-i)/rel;
    const t = i/RATE;
    buf[j] += (type==='triangle' ? triangle(t,freq) : square(t,freq)) * vol * env;
  }
}
function mixHit(buf, at, kind, vol){
  const dur = kind==='k' ? 0.14 : kind==='h' ? 0.035 : 0.13;
  const i0 = Math.floor(at*RATE), n = Math.floor(dur*RATE);
  let lp = 0;
  for(let i=0;i<n;i++){
    const j = i0+i; if(j<0||j>=buf.length) continue;
    const t = i/RATE, env = Math.pow(1 - i/n, 2.2);
    let v;
    if(kind==='k'){
      const f = 150*Math.pow(42/150, t/0.11);
      v = Math.sin(2*Math.PI*f*t);
    } else {
      const w = Math.random()*2-1;
      if(kind==='h'){ v = w - lp; lp = lp*0.5 + w*0.5; }   // crude highpass
      else { lp = lp*0.85 + w*0.15; v = lp*3; }            // crude bandpass
    }
    buf[j] += v * vol * env;
  }
}

// Loudness, the way a listener hears it: RMS, not peak. A track with one loud
// kick and a lot of silence peaks high and sounds quiet; a dense track with no
// transients does the opposite. Matching peaks is what made these seven tracks
// sound like seven different mixes.
function loudness(buf){
  let sum = 0, peak = 0, n = 0;
  for(const v of buf){ sum += v*v; n++; if(Math.abs(v) > peak) peak = Math.abs(v); }
  const rms = Math.sqrt(sum/Math.max(1,n));
  return { rms, peak, rmsDb: 20*Math.log10(Math.max(1e-9, rms)),
                      peakDb: 20*Math.log10(Math.max(1e-9, peak)) };
}

function wav(buf, fixedScale){
  // `fixedScale` renders every track at the SAME gain, so the files can be
  // compared against each other. Normalising each one to its own peak — which
  // is what this did — hides exactly the problem we are looking for.
  let peak = 0; for(const v of buf) peak = Math.max(peak, Math.abs(v));
  const k = fixedScale !== undefined ? fixedScale : (peak > 0 ? 0.89/peak : 1);
  const data = Buffer.alloc(buf.length*2);
  for(let i=0;i<buf.length;i++) data.writeInt16LE(Math.max(-32767,Math.min(32767,Math.round(buf[i]*k*32767))), i*2);
  const h = Buffer.alloc(44);
  h.write('RIFF',0); h.writeUInt32LE(36+data.length,4); h.write('WAVE',8);
  h.write('fmt ',12); h.writeUInt32LE(16,16); h.writeUInt16LE(1,20); h.writeUInt16LE(1,22);
  h.writeUInt32LE(RATE,24); h.writeUInt32LE(RATE*2,28); h.writeUInt16LE(2,32); h.writeUInt16LE(16,34);
  h.write('data',36); h.writeUInt32LE(data.length,40);
  return Buffer.concat([h,data]);
}

// --- walk a track exactly as the scheduler would ---------------------------
function events(tr, steps){
  const sd = 60/tr.bpm/tr.div, V = tr.vol||{}, out = [];
  for(let i=0;i<steps;i++){
    const t = i*sd;
    for(const name of ['lead','harm','bass']){
      const part = tr[name]; if(!part || !part.length) continue;
      const tok = part[i % part.length];
      if(!tok || tok==='-' || tok==='.') continue;
      let len = 1;
      for(let k=1;k<16;k++){ if(part[(i+k)%part.length]==='.'){ len++; continue; } break; }
      out.push({ t, voice:name, note:tok, f:Music.hz(tok), dur:sd*len*0.92,
                 vol: name==='bass' ? (V.bass||0.09) : name==='harm' ? (V.harm||0.03) : (V.lead||0.06),
                 type: name==='bass' ? 'triangle' : 'square' });
    }
    if(tr.drum){
      const d = tr.drum[i % tr.drum.length];
      if(d && d!=='-') out.push({ t, voice:'drum', kind:d, vol:(V.drum||0.2)*(d==='h'?0.45:1) });
    }
  }
  return out;
}

const report = [];
for(const id in Music.TRACKS){
  const tr = Music.TRACKS[id];
  const sd = 60/tr.bpm/tr.div;
  const steps = BARS * tr.div * 4;
  const secs = steps*sd + 0.5;
  const buf = new Float32Array(Math.ceil(secs*RATE));
  const ev = events(tr, steps);
  // At the bus level the game would actually use, so these files are a fair
  // comparison rather than seven separate mixes.
  const g = Music.busLevel(id) * 5;      // enough level to hear, short of clipping
  for(const e of ev){
    if(e.voice==='drum') mixHit(buf, e.t, e.kind, e.vol*g);
    else mixNote(buf, e.t, e.dur, e.f, e.vol*g, e.type);
  }
  // A fixed scale for every track: these files exist to be compared.
  fs.writeFileSync(path.join(OUT, id+'.wav'), wav(buf, 1.0));
  const L = loudness(buf);

  const notes = ev.filter(e=>e.voice!=='drum');
  const lows  = notes.filter(e=>e.f>0 && e.f<40);
  const highs = notes.filter(e=>e.f>2400);
  const bad   = notes.filter(e=>!e.f);
  report.push({ id, bpm:tr.bpm, secs:+(steps*sd).toFixed(1),
                notes:notes.length, drums:ev.length-notes.length,
                perSec:+(notes.length/(steps*sd)).toFixed(2),
                rmsDb:+L.rmsDb.toFixed(1), peakDb:+L.peakDb.toFixed(1),
                unparsed:bad.map(b=>b.note), tooLow:lows.length, tooHigh:highs.length });
}
console.log(JSON.stringify(report, null, 1));
console.log('wrote '+Object.keys(Music.TRACKS).length+' wavs to '+OUT);

// --- voice-leading report ---------------------------------------------------
// Two square voices landing on the SAME note is a wasted channel — it sounds
// like one slightly louder voice, and on a four-channel budget that is a
// third of the arrangement gone. Crossings (harmony above the lead) are worth
// knowing about too, though they are not always wrong.
console.log('\nvoice leading:');
for(const id in Music.TRACKS){
  const tr = Music.TRACKS[id];
  const sd = 60/tr.bpm/tr.div;
  const steps = 64 * tr.div;
  const at = (part,i)=>{ if(!part||!part.length) return null;
                         const t=part[i%part.length]; return (!t||t==='-'||t==='.')?null:t; };
  let uni=0, cross=0, both=0;
  const examples=[];
  for(let i=0;i<steps;i++){
    const L=at(tr.lead,i), Hm=at(tr.harm,i), B=at(tr.bass,i);
    if(L&&Hm){
      both++;
      const lf=Music.hz(L), hf=Music.hz(Hm);
      if(Math.abs(lf-hf)<0.6){ uni++; if(examples.length<4) examples.push('step '+i+': '+L+'='+Hm); }
      else if(hf>lf){ cross++; }
    }
    if(Hm&&B && Math.abs(Music.hz(Hm)-Music.hz(B))<0.6) uni++;
  }
  console.log('  '+id.padEnd(10)+' lead+harm together '+String(both).padStart(3)+
              '   unisons '+String(uni).padStart(3)+
              '   harm above lead '+String(cross).padStart(3)+
              (examples.length?('   e.g. '+examples.join(', ')):''));
}

// --- loudness report --------------------------------------------------------
// What to do with it: pick a target, then set each track's `gain` in
// src/p1b_music.js to 10^((target - rmsDb)/20). The tool prints the arithmetic
// rather than making the edit, because the gains are part of the score.
{
  console.log('\nloudness (RMS, at the level the game plays each track):');
  for(const r of report){
    console.log('  '+r.id.padEnd(10)+
      ' rms '+String(r.rmsDb).padStart(6)+'dB' +
      '  peak '+String(r.peakDb).padStart(6)+'dB' +
      '  computed gain x'+Music.trackGain(r.id).toFixed(2));
  }
  const spread = Math.max(...report.map(r=>r.rmsDb)) - Math.min(...report.map(r=>r.rmsDb));
  console.log('  spread across the score: '+spread.toFixed(1)+'dB'+
              (spread > 3 ? '   <-- audible; these are not the same volume' : '   (even)'));
  const clipped = report.filter(r=>r.peakDb > -0.5).map(r=>r.id);
  if(clipped.length) console.log('  CLIPPING: '+clipped.join(', '));
}
