// How loud is each sound effect, really?
//
// Every effect is a handful of tone() and noise() calls with a volume and a
// duration each. Stub those two, call every effect, and the energy each one
// puts out falls straight out of the arguments — no audio device needed.
//
// Effects are NOT meant to be equally loud: a crit should land harder than a
// menu click. What this is for is finding the outliers — the ones that are
// several times louder than everything around them and make the mix feel like
// it lurches.
const fs=require('fs'), path=require('path');
const SRC = fs.readFileSync(path.join(__dirname,'..','src','p1_core.js'),'utf8');

// Pull out just the Sfx IIFE and run it with a recording audio layer.
const a = SRC.indexOf('const Sfx = (()=>{');
const b = SRC.indexOf('\n})();', a);
if(a < 0){ console.error('Sfx not found'); process.exit(1); }
const body = SRC.slice(a, b).replace(/^const Sfx = /,'');

global.window = {};
// Swap the two primitives for recorders. The effects call the CLOSURE
// versions, not the exported ones, so the substitution has to happen in the
// source before it is evaluated.
const REC = [];
const patched = body
  .replace(/function tone\(type,f0,f1,dur,vol,delay\)\{/,
           'function tone(type,f0,f1,dur,vol,delay){ REC.push({k:"tone",dur,vol}); return;')
  .replace(/function noise\(dur,vol,f0,f1,q\)\{/,
           'function noise(dur,vol,f0,f1,q){ REC.push({k:"noise",dur,vol}); return;');
// `patched` already opens with `(()=>{`, so it needs no extra paren of
// its own — adding one left the expression a bracket short.
const S2 = eval(patched + '\n})()');

const SKIP = new Set(['ensure','bus','ctx','resume','toggle','isMuted','tone','noise']);
const rows = [];
for(const name of Object.keys(S2)){
  if(SKIP.has(name) || typeof S2[name] !== 'function') continue;
  REC.length = 0;
  try { S2[name](1); } catch(e){ continue; }
  if(!REC.length) continue;
  // energy = sum over components of amplitude^2 x effective duration.
  // Both primitives decay exponentially to silence, so the mean square is a
  // small fraction of the peak; noise contributes a third again less.
  let energy = 0, peak = 0, dur = 0;
  for(const c of REC){
    const duty = c.k==='noise' ? 0.018 : 0.054;
    energy += c.vol*c.vol*duty*c.dur;
    peak = Math.max(peak, c.vol);
    dur = Math.max(dur, c.dur);
  }
  const rms = Math.sqrt(energy/Math.max(0.02,dur));
  rows.push({ name, parts:REC.length, peak:+peak.toFixed(3),
              dur:+dur.toFixed(2), db:+(20*Math.log10(Math.max(1e-9,rms))).toFixed(1) });
}
// Effects that are SUPPOSED to sit under everything else. A footstep nine
// decibels below a detonation is not a fault, and a report that calls it one
// trains you to ignore the report.
const BACKGROUND = new Set(['step','talk','chirp','gauge','ui','swing','dodge']);
rows.sort((x,y)=>y.db-x.db);
const dbs = rows.map(r=>r.db);
const med = dbs[Math.floor(dbs.length/2)];
console.log('effect'.padEnd(12)+'rms dB'.padStart(8)+'  peak'.padStart(8)+'   vs median');
for(const r of rows){
  const rel = r.db - med;
  console.log('  '+r.name.padEnd(12)+String(r.db).padStart(6)+
              String(r.peak).padStart(8)+
              '   '+(rel>=0?'+':'')+rel.toFixed(1)+'dB'+
              (Math.abs(rel) > 6 && !BACKGROUND.has(r.name) ? '   <-- outlier' : '')+
              (BACKGROUND.has(r.name) ? '   (background, meant to be quiet)' : ''));
}
const fg = rows.filter(r=>!BACKGROUND.has(r.name)).map(r=>r.db);
console.log('\nmedian '+med+'dB');
console.log('spread, everything          '+(dbs[0]-dbs[dbs.length-1]).toFixed(1)+'dB');
console.log('spread, foreground effects  '+(fg[0]-fg[fg.length-1]).toFixed(1)+'dB'+
            ((fg[0]-fg[fg.length-1]) > 8 ? '   <-- the mix will lurch' : '   (even)'));
