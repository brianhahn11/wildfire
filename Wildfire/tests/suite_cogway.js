// The Cogway — Ironhaven's upper ring.
//
// Most of this is geometry, which is exactly the part that breaks silently.
// The area is generated from a radius test rather than hand-placed, so a
// prop table that drifts by half a tile can wall the street off without
// anything looking obviously wrong in a screenshot.
//
// Two of these assertions were wrong before they were right, and the way they
// were wrong is worth remembering: both originally probed a single hand-picked
// point (four compass tiles, and a straight line inward from each NPC). Both
// reported failures that did not exist, because the probe happened to land on
// a crate. Testing generated geometry means measuring the property across the
// whole space, not sampling it at points you chose by eye.
const H=require('./harness.js');
const {X,press,tick}=H;
press('Enter'); X.setCls(0,0); X.beginGame();
for(let i=0;i<30;i++) tick();
const A=X.AREAS.cogway, W=A.w, Hh=A.h, CX=X.COG.cx, CY=X.COG.cy;
X.loadArea('cogway', A.playerStart.x, A.playerStart.y);
let fails=0;
const ok=(c,l,e)=>{ console.log('  '+(c?'ok  ':'FAIL')+'  '+l+(e?'  — '+e:'')); if(!c) fails++; };

console.log('=== EVERY CITIZEN STANDS ON THE STREET ===');
const off=[];
for(const n of X.G.npcs){
  const r=Math.hypot(n.x/16-CX, n.y/16-CY);
  if(r < X.COG.PIT_R || r >= X.COG.STREET_R) off.push(n.id+' r='+r.toFixed(1));
}
// Count the roster, not a number typed once. A hard 13 only ever reports
// that somebody was added to the city, which is not news — what matters is
// that everyone in COGWAY_FOLK actually got spawned.
ok(X.G.npcs.length===X.COGWAY_FOLK.length,
   'every citizen on the roster is standing in the city',
   X.G.npcs.length+' of '+X.COGWAY_FOLK.length);
{
  const want = new Set(X.COGWAY_FOLK.map(f=>f.id));
  const got  = new Set(X.G.npcs.map(n=>n.id));
  const missing = [...want].filter(i=>!got.has(i));
  ok(missing.length===0, 'and nobody was dropped', missing.join(','));
  ok(got.size===X.G.npcs.length, 'and nobody was spawned twice');
}
ok(off.length===0, 'none in the crater or inside the wall', off.join(', '));

console.log('\n=== AND EVERY ONE OF THEM CAN BE REACHED AND TALKED TO ===');
// The real condition is simply: does open ground exist within talking range?
// Walking straight in from the crater, as the first version of this did, fails
// the moment a crate happens to sit on that radius — which says nothing about
// whether the shopkeeper can be reached.
const unreachable=[];
for(const n of X.G.npcs){
  let hit=false;
  for(let a=0; a<24 && !hit; a++) for(let d=8; d<=28; d+=4){
    const px=n.x+Math.cos(a*Math.PI/12)*d, py=n.y+Math.sin(a*Math.PI/12)*d;
    if(X.canStand(px,py) && Math.hypot(px-n.x,py-n.y)<30){ hit=true; break; }
  }
  if(!hit) unreachable.push(n.id);
}
ok(unreachable.length===0, 'all have standable ground within talking range', unreachable.join(', '));
// Lines may be a function of world state, and a function's .length is its
// parameter count — so resolve before measuring, or every stateful NPC reads
// as mute.
const resolve = n => typeof n.lines==='function' ? n.lines() : n.lines;
const mute = X.G.npcs.filter(n=>{ const l = n.lines && resolve(n); return !l || !l.length; })
                     .map(n=>n.id);
ok(mute.length===0, 'all have dialogue', mute.join(', '));

console.log('\n=== THE STREET IS ONE UNBROKEN LOOP ===');
// flood fill from the spawn; it must reach all four compass points
const seen=new Uint8Array(W*Hh), q=[[Math.floor(A.playerStart.x/16),Math.floor(A.playerStart.y/16)]];
seen[q[0][1]*W+q[0][0]]=1;
let n2=0;
while(q.length){
  const [x,y]=q.pop(); n2++;
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const nx=x+dx, ny=y+dy;
    if(nx<0||ny<0||nx>=W||ny>=Hh) continue;
    if(seen[ny*W+nx]) continue;
    if(X.SOLID[A.map[ny*W+nx]]) continue;
    seen[ny*W+nx]=1; q.push([nx,ny]);
  }
}
// Compare against every open tile on the street, not four hand-picked points:
// those can land on a crate and report a severed ring that is perfectly fine.
let streetOpen=0, streetSeen=0;
for(let y=0;y<Hh;y++) for(let x=0;x<W;x++){
  const r=Math.hypot(x+0.5-CX,y+0.5-CY);
  if(r<X.COG.PIT_R || r>=X.COG.STREET_R) continue;
  if(X.SOLID[A.map[y*W+x]]) continue;
  streetOpen++; if(seen[y*W+x]) streetSeen++;
}
ok(streetSeen === streetOpen, 'every open tile on the street is reachable',
   streetSeen+' / '+streetOpen);
// and the loop really closes: all four arcs are in the same connected region
const arcSeen = ang => {
  for(let r=X.COG.PIT_R+1; r<X.COG.STREET_R; r+=0.3){
    const x=Math.round(CX+Math.cos(ang)*r), y=Math.round(CY+Math.sin(ang)*r);
    if(!X.SOLID[A.map[y*W+x]] && seen[y*W+x]) return true;
  }
  return false;
};
const missed=[['N',-Math.PI/2],['E',0],['S',Math.PI/2],['W',Math.PI]]
  .filter(([l,a])=>!arcSeen(a)).map(c=>c[0]);
ok(missed.length===0, 'you can walk the full circle', missed.length?'cut off: '+missed.join(','):'');

console.log('\n=== THE CRATER IS NEVER OFF-SCREEN ===');
// Sample the whole street — every angle, every radius — and require the
// camera frame to overlap the crater disc. This is the brief, stated as a test.
let worst=null, worstVis=1e9;
for(let ai=0; ai<180; ai++){
  const ang=ai*Math.PI*2/180;
  for(let r=X.COG.PIT_R+0.6; r<X.COG.STREET_R-0.2; r+=0.5){
    X.player.x=(CX+Math.cos(ang)*r)*16+8;
    X.player.y=(CY+Math.sin(ang)*r)*16+8;
    const cam=X.camTarget();
    // how many pixels of the crater's bounding box fall inside the viewport
    const pl=(CX-X.COG.PIT_R)*16, pr=(CX+X.COG.PIT_R)*16;
    const pt=(CY-X.COG.PIT_R)*16, pb=(CY+X.COG.PIT_R)*16;
    const ow=Math.min(pr,cam.x+480)-Math.max(pl,cam.x);
    const oh=Math.min(pb,cam.y+270)-Math.max(pt,cam.y);
    const vis=Math.min(ow,oh);
    if(vis<worstVis){ worstVis=vis; worst={ang:(ang*57.3)|0, r:r.toFixed(1)}; }
  }
}
ok(worstVis > 40, 'crater in frame from every point on the street',
   'worst case '+worstVis.toFixed(0)+'px at '+worst.ang+'° r='+worst.r);

console.log('\n=== THE CITY IS GREY, WITH COLOUR AS ACCENT ===');
// Sample the street surface and count how much of it is saturated. Grey with
// accents should be overwhelmingly desaturated; if a later palette change
// floods the place with colour this catches it.
// The terrain buffer is at DEVICE resolution, so a world coordinate has to be
// multiplied by ART to index it. Without that this sampled the top-left
// quadrant of the map — which is the Verge-facing side of the ring, greener
// than the average, and the test failed for a reason that had nothing to do
// with the palette.
const cv=X.terrainCv; let sat=0, tot=0;
for(let ai=0; ai<400; ai++){
  const ang=ai*Math.PI*2/400, r=X.COG.PIT_R+3+(ai%9);
  const px=Math.round((CX+Math.cos(ang)*r)*16*X.ART),
        py=Math.round((CY+Math.sin(ang)*r)*16*X.ART);
  const k=(py*cv.width+px)*4, d=cv.data;
  const R=d[k]*d[k+3], G2=d[k+1]*d[k+3], B=d[k+2]*d[k+3];
  const mx=Math.max(R,G2,B), mn=Math.min(R,G2,B);
  if(mx>8 && (mx-mn)/mx > 0.30) sat++;
  tot++;
}
const pct=100*sat/tot;
ok(pct < 18, 'street reads grey', pct.toFixed(1)+'% saturated samples');
ok(pct > 0.4, 'but the accent stones are actually there', pct.toFixed(1)+'%');

console.log(fails ? '\nFAIL ('+fails+')' : '\nPASS');
process.exit(fails?1:0);
