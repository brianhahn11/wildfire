// A picture of the score, because there is no way to listen to it here.
//
// One panel per track: pitch up the page, time across, one bar per gridline.
// This is the only check on the WRITING there can be in this environment —
// whether the title track is dense and driving and the zone tracks are not,
// whether the harmony sits under the lead instead of crossing it, and whether
// the bass actually moves.
const fs=require('fs'), path=require('path');
const {Canvas}=require(path.join(__dirname,'..','tests','shim.js'));
const SRC = fs.readFileSync(path.join(__dirname,'..','src','p1b_music.js'),'utf8');
const Music = (function(){
  const Sfx = { ctx:()=>null, bus:()=>null };
  return eval(SRC + '\n;Music');
})();

const BARS = parseInt(process.argv[3]||'8',10);
const W=900, PH=118, PAD=54;
const ids = Object.keys(Music.TRACKS);
const H = ids.length*PH + 20;
const cv=new Canvas(W,H), c=cv.getContext('2d');
c.fillStyle='#12101a'; c.fillRect(0,0,W,H);

const VOICE={ lead:'#ffb43c', harm:'#b98cf0', bass:'#57d0c4' };
function midi(f){ return f>0 ? 69 + 12*Math.log2(f/440) : 0; }

ids.forEach((id,pi)=>{
  const tr=Music.TRACKS[id], sd=60/tr.bpm/tr.div;
  const steps=BARS*tr.div*4, span=steps*sd;
  const y0=pi*PH+14, h=PH-40;

  c.fillStyle='#1a1726'; c.fillRect(PAD, y0, W-PAD-14, h);
  // bar lines
  c.fillStyle='#2a2438';
  for(let b=0;b<=BARS;b++){ const x=PAD+(W-PAD-14)*(b*tr.div*4*sd)/span; c.fillRect(x,y0,1,h); }

  // gather
  const ev=[];
  for(let i=0;i<steps;i++){
    for(const name of ['lead','harm','bass']){
      const part=tr[name]; if(!part||!part.length) continue;
      const tok=part[i%part.length];
      if(!tok||tok==='-'||tok==='.') continue;
      let len=1; for(let k=1;k<16;k++){ if(part[(i+k)%part.length]==='.'){len++;continue;} break; }
      ev.push({t:i*sd,dur:sd*len*0.92,m:midi(Music.hz(tok)),v:name});
    }
    if(tr.drum){ const d=tr.drum[i%tr.drum.length]; if(d&&d!=='-') ev.push({t:i*sd,d}); }
  }
  const pitched=ev.filter(e=>e.v);
  const lo=Math.min(...pitched.map(e=>e.m))-2, hi=Math.max(...pitched.map(e=>e.m))+2;
  for(const e of pitched){
    const x=PAD+(W-PAD-14)*e.t/span, w=Math.max(2,(W-PAD-14)*e.dur/span);
    const y=y0+h-2-(h-4)*(e.m-lo)/(hi-lo);
    c.fillStyle=VOICE[e.v]; c.fillRect(x,y-2,w,3);
  }
  // drum lane
  const dy=y0+h+3;
  c.fillStyle='#241f30'; c.fillRect(PAD,dy,W-PAD-14,7);
  for(const e of ev) if(e.d){
    const x=PAD+(W-PAD-14)*e.t/span;
    c.fillStyle = e.d==='k'?'#ff6a3c' : e.d==='s'?'#e0e0e8' : '#6a6070';
    c.fillRect(x,dy,2,7);
  }
  c.fillStyle='#ffab3c'; c.font='11px monospace';
  c.fillText(id.toUpperCase(), 6, y0+11);
  c.fillStyle='#6a6070'; c.font='9px monospace';
  c.fillText(tr.bpm+'bpm', 6, y0+24);
  c.fillText(pitched.length+'n', 6, y0+36);
});
fs.writeFileSync(process.argv[2]||'/tmp/roll.png', cv.toPNG(1));
console.log('piano roll written');
