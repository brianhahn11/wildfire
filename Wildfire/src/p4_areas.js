
// ============================================================================
// AREAS — four maps joined by door and edge triggers.
//   house    : where you wake up
//   clearing : the settlement outskirts, Hayla, and the Rustfields beyond
//   gate     : the outer gate of Ironhaven
//   cogway   : Ironhaven's upper ring, wrapped around the crater. Generated
//              from a radius test rather than hand-placed, so it's a true
//              circle — see buildCogway() for why the street is seven wide.
// ============================================================================

function makeArea(id, w, h, baseGround, opts){
  const a = {
    id, w, h, baseGround,
    map: new Uint8Array(w*h).fill(baseGround),
    exits: [], buildings: [], spawns: [], tint: null, indoor:false, name:''
  };
  Object.assign(a, opts||{});
  return a;
}
function setT(a,x,y,t){ if(x>=0&&y>=0&&x<a.w&&y<a.h) a.map[y*a.w+x]=t; }
function fillT(a,x,y,w,h,t){ for(let j=y;j<y+h;j++) for(let i=x;i<x+w;i++) setT(a,i,j,t); }
function rectT(a,x,y,w,h,t){
  for(let i=x;i<x+w;i++){ setT(a,i,y,t); setT(a,i,y+h-1,t); }
  for(let j=y;j<y+h;j++){ setT(a,x,j,t); setT(a,x+w-1,j,t); }
}
// Props that may be cleared to open a path. Structural tiles — the city mass,
// the crater, cliff faces — are not on this list and never move.
const REMOVABLE = {};
[T.CRATE,T.BARREL,T.SIGN,T.STALL,T.BENCH,T.CRYSTAL,T.GEARWHEEL,T.PILLAR,T.LAMP,
 T.BUSH,T.ROCK,T.STUMP,T.DRIFTWOOD,T.ORE,T.PLANTER,T.FENCE,T.CART
].forEach(t=>REMOVABLE[t]=1);

// Scattering props can seal a pocket of open ground against a wall — two
// cobbles behind a stall, with a sign closing the last gap. The fix is not to
// nudge the offending prop, because the next change to the scatter table will
// do it somewhere else; it's to find any open tile the player cannot reach and
// clear a removable prop beside it until it connects.
function healPockets(a, sx, sy, fill){
  for(let pass=0; pass<8; pass++){
    const seen = new Uint8Array(a.w*a.h), q = [[sx,sy]];
    seen[sy*a.w+sx] = 1;
    while(q.length){
      const [x,y] = q.pop();
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=x+dx, ny=y+dy;
        if(nx<0||ny<0||nx>=a.w||ny>=a.h||seen[ny*a.w+nx]) continue;
        if(SOLID[a.map[ny*a.w+nx]]) continue;
        seen[ny*a.w+nx]=1; q.push([nx,ny]);
      }
    }
    let opened = 0;
    for(let y=1;y<a.h-1;y++) for(let x=1;x<a.w-1;x++){
      if(seen[y*a.w+x] || SOLID[a.map[y*a.w+x]]) continue;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        if(REMOVABLE[a.map[(y+dy)*a.w+x+dx]]){ setT(a,x+dx,y+dy,fill); opened++; break; }
      }
    }
    if(!opened) break;
  }
}

function scatterT(a,rng,t,n,pred){
  let placed=0, guard=0;
  while(placed<n && guard++<n*60){
    const x=1+Math.floor(rng()*(a.w-2)), y=1+Math.floor(rng()*(a.h-2));
    if(pred && !pred(x,y)) continue;
    if(SOLID[a.map[y*a.w+x]]) continue;
    setT(a,x,y,t); placed++;
  }
}

// ---------------------------------------------------------------------------
// 1. THE HOUSE — small one-room cottage
// ---------------------------------------------------------------------------
function buildHouse(){
  const a = makeArea('house', 22, 15, T.FLOOR_WOOD, { indoor:true, name:'Your Cottage',
    tint:'rgba(70,40,20,0.16)' });
  const rng = makeRng(11);

  // shell: back wall runs along the top, side walls down both edges
  fillT(a,0,0,a.w,2,T.WALL_TOP);
  fillT(a,0,2,a.w,1,T.WALL);
  for(let y=3;y<a.h;y++){ setT(a,0,y,T.WALL); setT(a,a.w-1,y,T.WALL); }
  fillT(a,0,a.h-1,a.w,1,T.WALL);

  // furnishings
  setT(a,2,3,T.BED); setT(a,3,3,T.BED);
  setT(a,5,3,T.SHELF);
  fillT(a,9,3,3,1,T.HEARTH);
  setT(a,14,3,T.SHELF);
  setT(a,17,4,T.BARREL); setT(a,18,4,T.CRATE);
  setT(a,8,7,T.TABLE); setT(a,9,7,T.TABLE);
  fillT(a,7,9,6,3,T.RUG);
  setT(a,3,11,T.PLANTER);
  setT(a,18,11,T.PLANTER);

  // front door, bottom centre. Destination is in PIXELS, matching loadArea().
  const dx = 11;
  setT(a,dx,a.h-1,T.DOOR);
  a.exits.push({ x:dx, y:a.h-1, to:'clearing', tx:26*TILE+8, ty:17*TILE+10, label:'Outside' });

  a.playerStart = { x: dx*TILE+8, y: 10*TILE+8 };
  return a;
}

// ---------------------------------------------------------------------------
// 2. THE CLEARING — settlement edge opening onto the Rustfields
// ---------------------------------------------------------------------------
function buildClearing(){
  const a = makeArea('clearing', 52, 38, T.GRASS, { name:'Millbrook Clearing' });
  const rng = makeRng(2027);

  // Ground variation driven by coarse noise so dry patches and flower beds form
  // clumps across several tiles instead of speckling one tile at a time.
  for(let y=0;y<a.h;y++) for(let x=0;x<a.w;x++){
    const coarse = zoneNoise(x,y,5);
    const fine   = hash2(x*3,y*7);
    if(coarse<0.30 && fine<0.72) setT(a,x,y,T.DRY);
    else if(coarse>0.70 && fine>0.62) setT(a,x,y,T.FLOWERS);
    else if(fine>0.86) setT(a,x,y,T.GRASS_TUFT);
  }

  // dense treeline framing the map
  for(let x=0;x<a.w;x++){
    setT(a,x,0,T.TREE); setT(a,x,1,T.TREE);
    if(hash2(x,99)>0.35) setT(a,x,2,T.TREE);
    setT(a,x,a.h-1,T.TREE); setT(a,x,a.h-2,T.TREE);
    if(hash2(x,77)>0.5) setT(a,x,a.h-3,T.TREE);
  }
  for(let y=0;y<a.h;y++){
    setT(a,0,y,T.TREE); setT(a,1,y,T.TREE);
    if(hash2(55,y)>0.4) setT(a,2,y,T.TREE);
  }

  // --- your cottage, top-middle. Door lines up with the interior exit.
  const hx=22, hy=10, hw=9, hh=6;
  fillT(a,hx,hy,hw,hh,T.BUILDING);
  setT(a,26,hy+hh-1,T.DOOR);
  a.buildings.push({ x:hx, y:hy, w:hw, h:hh, style:'cottage', doorX:26 });
  a.exits.push({ x:26, y:hy+hh-1, to:'house', tx:11*TILE+8, ty:12*TILE+8, label:'Inside' });

  // neighbour cottages for a lived-in village edge
  const b2={x:8,y:8,w:8,h:6,style:'cottage2',doorX:11};
  fillT(a,b2.x,b2.y,b2.w,b2.h,T.BUILDING);
  setT(a,b2.doorX,b2.y+b2.h-1,T.DOOR); a.buildings.push(b2);

  const b3={x:37,y:7,w:10,h:7,style:'workshop',doorX:41};
  fillT(a,b3.x,b3.y,b3.w,b3.h,T.BUILDING);
  setT(a,b3.doorX,b3.y+b3.h-1,T.DOOR); a.buildings.push(b3);

  // --- paths: from your door south, then east toward the gate road
  fillT(a,25,17,3,8,T.PATH);
  fillT(a,12,24,30,3,T.PATH);
  fillT(a,41,24,10,3,T.PATH);
  fillT(a,10,14,3,11,T.PATH);
  fillT(a,40,14,3,11,T.PATH);

  // village dressing
  setT(a,20,23,T.WELL); setT(a,21,23,T.WELL);
  setT(a,17,22,T.CART);
  setT(a,31,22,T.BARREL); setT(a,32,22,T.CRATE); setT(a,33,22,T.BARREL);
  setT(a,15,28,T.CRATE);
  for(let x=14;x<=19;x++) setT(a,x,20,T.FENCE);
  for(let x=29;x<=35;x++) setT(a,x,20,T.FENCE);
  for(let y=29;y<=33;y++){ setT(a,12,y,T.FENCE); setT(a,30,y,T.FENCE); }
  for(let x=13;x<=29;x++) setT(a,x,33,T.FENCE);
  setT(a,24,10+6,T.PLANTER); setT(a,28,16,T.PLANTER);
  setT(a,19,18,T.LAMP); setT(a,34,18,T.LAMP);
  setT(a,23,26,T.LAMP); setT(a,38,26,T.LAMP);
  setT(a,29,25,T.SIGN);

  // --- pond, lower-left
  for(let y=27;y<=32;y++) for(let x=4;x<=10;x++){
    const d = Math.hypot((x-7)/3.6,(y-29.5)/2.9);
    if(d<0.78) setT(a,x,y,T.WATER);
    else if(d<1.0) setT(a,x,y,T.SHALLOW);
  }

  // --- the Rustfields proper: open ground east and south, scattered cover
  scatterT(a,rng,T.ROCK,14,(x,y)=>y>18 && !(y>=24&&y<=26));
  scatterT(a,rng,T.BUSH,26,(x,y)=>y>16);
  scatterT(a,rng,T.STUMP,7,(x,y)=>y>20);
  scatterT(a,rng,T.TREE,22,(x,y)=>(y>27||x>44) && !(y>=24&&y<=26));
  scatterT(a,rng,T.GRASS_TUFT,40,(x,y)=>y>18);

  // --- road east to Ironhaven
  fillT(a,a.w-2,24,2,3,T.PATH);
  a.exits.push({ x:a.w-1, y:24, to:'gate', tx:2*TILE+8, ty:17*TILE+8, label:'Ironhaven Road', wide:3 });
  a.exits.push({ x:a.w-1, y:25, to:'gate', tx:2*TILE+8, ty:17*TILE+8, label:'Ironhaven Road' });
  a.exits.push({ x:a.w-1, y:26, to:'gate', tx:2*TILE+8, ty:17*TILE+8, label:'Ironhaven Road' });

  a.playerStart = { x: 26*TILE+8, y: 17*TILE+8 };

  // creature spawn zones — kept well away from the houses
  a.spawns = [
    { kind:'rustquail', n:9,  x:14, y:28, w:16, h:8 },
    { kind:'rustquail', n:6,  x:33, y:27, w:14, h:9 },
    { kind:'gearrat',   n:5,  x:32, y:29, w:14, h:7 },
    { kind:'drone',     n:3,  x:36, y:16, w:10, h:6 },
    { kind:'sporeling', n:4,  x:6,  y:20, w:8,  h:6 }
  ];
  return a;
}

// ---------------------------------------------------------------------------
// 3. THE IRONHAVEN GATE
// ---------------------------------------------------------------------------
function buildGate(){
  const a = makeArea('gate', 40, 30, T.DIRT, { name:'Ironhaven — Outer Gate' });
  const rng = makeRng(404);

  for(let y=0;y<a.h;y++) for(let x=0;x<a.w;x++){
    const n=hash2(x*5,y*5);
    if(x<14 && n>0.6) setT(a,x,y,T.GRASS);
    else if(n>0.82) setT(a,x,y,T.GRAVEL);
  }

  // the great wall across the east side
  for(let y=0;y<a.h;y++){ setT(a,a.w-4,y,T.RAMPART); setT(a,a.w-3,y,T.RAMPART);
                          setT(a,a.w-2,y,T.RAMPART); setT(a,a.w-1,y,T.RAMPART); }
  // and wrapping along the top
  for(let x=24;x<a.w;x++){ setT(a,x,0,T.RAMPART); setT(a,x,1,T.RAMPART); }

  // the gate itself
  for(let y=13;y<=17;y++){ setT(a,a.w-4,y,T.GATE); setT(a,a.w-3,y,T.GATE); }
  fillT(a,a.w-6,13,2,5,T.STONE);
  setT(a,a.w-7,12,T.BANNER); setT(a,a.w-7,18,T.BANNER);

  // approach road
  fillT(a,0,15,a.w-6,4,T.PATH);
  fillT(a,10,15,8,4,T.STONE);
  fillT(a,a.w-12,14,6,6,T.STONE);

  // guard posts and industry
  setT(a,a.w-9,13,T.LAMP); setT(a,a.w-9,18,T.LAMP);
  setT(a,a.w-14,12,T.LAMP); setT(a,a.w-14,20,T.LAMP);
  for(let x=a.w-16;x<a.w-6;x++){ setT(a,x,10,T.PIPE); }
  for(let x=a.w-16;x<a.w-6;x++){ setT(a,x,22,T.PIPE); }
  setT(a,a.w-18,11,T.BARREL); setT(a,a.w-17,11,T.BARREL);
  setT(a,a.w-18,21,T.CRATE);  setT(a,a.w-17,21,T.CRATE);
  setT(a,22,13,T.CART); setT(a,26,20,T.CART);
  setT(a,18,12,T.SIGN);

  // wilds on the approach
  for(let x=0;x<a.w;x++){ setT(a,x,0,T.TREE); setT(a,x,a.h-1,T.TREE); setT(a,x,a.h-2,T.TREE); }
  for(let y=0;y<a.h;y++){ if(y<13||y>19) setT(a,0,y,T.TREE); }
  scatterT(a,rng,T.TREE,16,(x,y)=>x<16 && (y<12||y>20));
  scatterT(a,rng,T.BUSH,14,(x,y)=>x<20 && (y<13||y>19));
  scatterT(a,rng,T.ROCK,9,(x,y)=>(y<12||y>20));

  // Into the Cogway. The trigger sits on the stone apron in FRONT of the gate,
  // not on the gate tiles themselves — those are solid, so the player can
  // never stand on them and the exit would never fire.
  for(let y=13;y<=17;y++)
    a.exits.push({ x:a.w-5, y, to:'cogway', tx:0, ty:0, gate:'w',
                   label:'Into Ironhaven' });

  a.exits.push({ x:0, y:16, to:'clearing', tx:(52-3)*TILE+8, ty:25*TILE+8, label:'Back to Millbrook' });
  a.exits.push({ x:0, y:17, to:'clearing', tx:(52-3)*TILE+8, ty:25*TILE+8, label:'Back to Millbrook' });
  a.exits.push({ x:0, y:18, to:'clearing', tx:(52-3)*TILE+8, ty:25*TILE+8, label:'Back to Millbrook' });

  a.playerStart = { x: 3*TILE+8, y: 17*TILE+8 };
  a.spawns = [
    { kind:'drone',   n:3, x:6,  y:22, w:10, h:5 },
    { kind:'gearrat', n:4, x:4,  y:5,  w:11, h:6 }
  ];
  return a;
}

// ---------------------------------------------------------------------------
// 4. THE COGWAY — Ironhaven's upper ring, wrapped around the crater
//
// The whole area is generated from a radius test rather than hand-placed, so
// the street is a true circle. Three numbers define it:
//
//   r < PIT_R          the crater. Solid, and drawn in one pass by drawPit().
//   PIT_R..STREET_R    the street you walk, seven tiles wide.
//   STREET_R..RING_R   the built-up outer ring: shopfronts and city mass.
//
// Seven tiles is not an arbitrary width. The viewport is 30x17 tiles, so the
// camera reaches 8.5 tiles above and below you. A street any wider than that
// would let you stand at the outer kerb with the crater off the bottom of the
// screen, and the brief is that you can always see the hole. At seven, the
// worst case — outer kerb, due north — still leaves the crater lip in frame.
// ---------------------------------------------------------------------------
const COG = { cx:32, cy:32, PIT_R:15.5, STREET_R:23, RING_R:28, W:64, H:64 };

// ---------------------------------------------------------------------------
// THE WALKING LANE
//
// The street is seven and a half tiles of annulus, and everything in the city
// used to be scattered across the middle of it. The result was a ring you had
// to thread rather than walk: a brazier at 18.1, a bench at 19.7, a vent at
// 19.8 and a crate at 20.1 are four separate obstacles stacked across the one
// radius the player actually travels along.
//
// Everything now goes to one of two bands, and the three and a half tiles
// between them are left empty. Nothing is placed by eye any more — each
// scatter names a band, so the lane cannot silently close up again the next
// time something is added to the city.
//
//   INNER   against the crater railing: braziers, benches, vents, crystals
//   lane    ~17.9 .. 21.1, kept clear
//   OUTER   against the shopfronts: stalls, lamps, gearwheels, pillars
// ---------------------------------------------------------------------------
// Two radii per band, not one. The first attempt put every inner scatter on
// a single radius and two thirds of the furniture vanished: fourteen braziers
// every 0.449 rad and seven benches every 0.898 rad land on the same tiles,
// because 14 and 7 share a factor. Counts are kept coprime for the same
// reason — a scatter that harmonises with its neighbour is a scatter that
// silently deletes itself.
// ONE inner band, not two. There is only about half a tile of usable radius
// on this side: below 17.2 a rounded spot lands on the crater railing, which
// is solid, and above 17.8 it lands in the lane. A second inner sub-band was
// tried at 16.6 and half of everything put on it was swallowed by the
// railing before it was ever drawn.
COG.INNER = COG.PIT_R + 1.8;      // 17.3
COG.OUTER = COG.STREET_R - 1.5;   // 21.5
COG.FRONT = COG.STREET_R - 0.9;   // 22.1 — hard against the shopfronts

// The lane is its own pair of numbers rather than being derived from the
// bands. Derived, it had to include the rounding slop as a margin, and that
// margin ate two thirds of the city's furniture: a brazier nominally at 16.9
// can round out to 17.6, and if the lane began at 17.7 it was refused. These
// say where the player walks, and the bands say where things go; the gap
// between them is the slop, and it belongs to neither.
COG.LANE_IN  = 18.3;
COG.LANE_OUT = 20.9;

// a point on the ring, in pixels. ang 0 = east, and y grows downward.
function ringPx(ang, r){
  return { x:(COG.cx + Math.cos(ang)*r)*TILE + 8,
           y:(COG.cy + Math.sin(ang)*r)*TILE + 8 };
}
function ringTile(ang, r){
  return { x:Math.round(COG.cx + Math.cos(ang)*r),
           y:Math.round(COG.cy + Math.sin(ang)*r) };
}

// ONE gate for every placement on the ring. Returns the tile, or null if the
// spot is no good, so a scatter cannot forget one of the three checks:
//
//   solid      something is already there
//   gate mouth a pillar dropped in a gate mouth seals an exit from the city,
//              which the old pillar radius of 21.9 came close to doing. A
//              mouth is five tiles across, so at the outer band its
//              half-angle is about 2.5/22 = 0.11 rad; 0.16 leaves a tile of
//              margin. An earlier draft used 0.28, which quietly excluded a
//              third of the ring and halved the surviving furniture.
//   the lane   ringTile() rounds x and y INDEPENDENTLY, so a spot nominally
//              on a band lands up to two thirds of a tile off it. Trusting
//              the nominal radius left nine obstacles standing in the middle
//              of the street. The tile's real radius is what is tested.
function ringSpot(a, ang, r){
  const p = ringTile(ang, r);
  if(SOLID[tileAt(a,p.x,p.y)]) return null;
  if(COG.GATES.some(g => Math.abs(angDiff(g.ang, ang)) < 0.16)) return null;
  const rr = Math.hypot(p.x+0.5-COG.cx, p.y+0.5-COG.cy);
  if(rr > COG.LANE_IN && rr < COG.LANE_OUT) return null;
  return p;
}

function buildCogway(){
  const a = makeArea('cogway', COG.W, COG.H, T.VOID,
                     { name:'Ironhaven — The Cogway' });
  const rng = makeRng(8181);
  const R = (x,y) => Math.hypot(x+0.5-COG.cx, y+0.5-COG.cy);

  // --- carve the ring out of solid --------------------------------------
  for(let y=0;y<a.h;y++) for(let x=0;x<a.w;x++){
    const r = R(x,y);
    if(r < COG.PIT_R)        setT(a,x,y,T.PIT);
    else if(r < COG.STREET_R){
      // Paving is mostly plain grey. Iron decking rings the crater lip where
      // the street is walked hardest, and inlaid aethite is scattered thinly
      // — roughly one sett in twelve, which is often enough to notice and
      // rare enough to still read as precious.
      const n = hash2(x*3, y*3);
      if(r < COG.PIT_R + 2.2)   setT(a,x,y,T.IRONPLATE);
      else if(n > 0.92)         setT(a,x,y,T.INLAY);
      else                      setT(a,x,y,T.COBBLE);
    }
    else if(r < COG.RING_R)  setT(a,x,y,T.BUILDING);   // outer city mass
    else                     setT(a,x,y,T.VOID);
  }
  a.pit = { cx:COG.cx, cy:COG.cy, r:COG.PIT_R };

  // --- railing all the way round the lip ---------------------------------
  for(let y=0;y<a.h;y++) for(let x=0;x<a.w;x++){
    const r = R(x,y);
    if(r >= COG.PIT_R && r < COG.PIT_R+1) setT(a,x,y,T.RAILING);
  }

  // --- four gates through the outer ring ----------------------------------
  // One per compass point, each a straight stone passage cut clean through the
  // city mass. Driving them off the same table keeps the four consistent and
  // means the geometry only has to be right once.
  // The road in is the WEST gate and the beach is the SOUTH one, which is how
  // the world map has always drawn them. They used to be the other way round
  // in the world and only in the world, so the first thing the map told you
  // was a lie about the journey you had just made.
  COG.GATES = [
    { dir:'w', ang: Math.PI,   to:'gate',      tx:(40-6)*TILE+8, ty:15*TILE+8, label:'Outer Gate' },
    { dir:'n', ang:-Math.PI/2, to:'verge',     tx:46*TILE+8,     ty:56*TILE+8, label:'The Verge' },
    // The Scarp is the dangerous one, so it is the one behind a lock.
    { dir:'e', ang: 0,         to:'scarp',     tx:3*TILE+8,      ty:26*TILE+8, label:'The Iron Scarp', lock:'scarpgate' },
    { dir:'s', ang: Math.PI/2, to:'shoals',    tx:28*TILE+8,     ty:3*TILE+8,  label:'The Rivet Shoals' }
  ];
  for(const g of COG.GATES){
    const ca=Math.cos(g.ang), sa=Math.sin(g.ang);
    // the passage: everything within 2.5 tiles of the gate's axis, from the
    // inner kerb out through the wall
    for(let y=0;y<a.h;y++) for(let x=0;x<a.w;x++){
      const dx=x+0.5-COG.cx, dy=y+0.5-COG.cy;
      const along = dx*ca + dy*sa, across = Math.abs(-dx*sa + dy*ca);
      if(along > COG.STREET_R-1.5 && along < COG.RING_R+1.5 && across <= 2.5)
        setT(a,x,y,T.STONE);
    }
    const mouth = ringTile(g.ang, COG.RING_R);
    for(let k=-2;k<=2;k++){
      const px2 = Math.round(mouth.x - sa*k), py2 = Math.round(mouth.y + ca*k);
      setT(a,px2,py2,T.STONE);
      a.exits.push({ x:px2, y:py2, to:g.to, tx:g.tx, ty:g.ty, label:g.label, lock:g.lock });
    }
    // A sealed gate gets a curtain of Aethite across the passage, one tile
    // inside the mouth. It sits on the exits themselves, so the barrier and
    // the thing it bars are the same tiles and cannot drift apart.
    if(g.lock){
      a.seals = a.seals || {};
      a.seals[g.lock] = [];
      const inner = ringTile(g.ang, COG.RING_R-1);
      for(let k=-2;k<=2;k++){
        const px2 = Math.round(inner.x - sa*k), py2 = Math.round(inner.y + ca*k);
        setT(a,px2,py2,T.SEAL);
        a.seals[g.lock].push([px2,py2]);
      }
    }
    const p1=ringTile(g.ang,COG.RING_R-1);
    setT(a, Math.round(p1.x - sa*3), Math.round(p1.y + ca*3), T.PILLAR);
    setT(a, Math.round(p1.x + sa*3), Math.round(p1.y - ca*3), T.PILLAR);
  }

  // --- vendor stalls, braziers and street furniture around the circle -----
  // Everything is placed by angle so it follows the street instead of sitting
  // on a grid the curve then cuts through.
  for(let i=0;i<10;i++){
    const ang = -Math.PI/2 + i*(Math.PI*2/10) + 0.16;
    // leave all four gate mouths clear
    if(COG.GATES.some(g=>Math.abs(angDiff(g.ang, ang)) < 0.30)) continue;
    for(let k=-1;k<=1;k++){
      const q = ringSpot(a, ang + k*0.045, COG.OUTER);
      if(q) setT(a,q.x,q.y,T.STALL);
    }
  }

  // The stall the three children run circles around, in the south-west. It is
  // placed explicitly rather than falling out of the loop above, because the
  // thing it is for is a fixed point three NPCs orbit — if the scatter moved
  // it, they would be chasing each other round nothing.
  {
    // Nudged along the arc until it finds a tile that really is on the band.
    // It cannot just be dropped at the nominal radius and hoped for: if
    // rounding puts it in the lane it is both an obstacle and, once the
    // children orbit it, an obstacle that moves.
    let q = null;
    for(let k=0; k<12 && !q; k++)
      q = ringSpot(a, 2.356 + (k%2?k:-k)*0.03, COG.INNER);
    if(q){ setT(a,q.x,q.y,T.STALL); a.kidStall = q; }
  }

  for(let i=0;i<17;i++){
    const ang = i*(Math.PI*2/17);
    const p = ringSpot(a, ang, COG.INNER);
    if(p) setT(a,p.x,p.y,T.BRAZIER);
  }
  for(let i=0;i<9;i++){
    const ang = 0.3 + i*(Math.PI*2/9);
    const p = ringSpot(a, ang, COG.FRONT);
    if(p) setT(a,p.x,p.y,T.LAMP);
  }
  for(let i=0;i<13;i++){
    const ang = 0.9 + i*(Math.PI*2/13);
    const p = ringSpot(a, ang, COG.INNER);
    if(p) setT(a,p.x,p.y,T.BENCH);
  }
  for(let i=0;i<14;i++){
    const ang = 1.7 + i*(Math.PI*2/14);
    const p = ringSpot(a, ang, COG.INNER);
    if(p) setT(a,p.x,p.y,T.VENT);
  }
  for(let i=0;i<11;i++){
    const ang = 2.4 + i*(Math.PI*2/11);
    const p = ringSpot(a, ang, COG.INNER);
    if(p) setT(a,p.x,p.y,T.CRYSTAL);
  }
  for(let i=0;i<10;i++){
    const ang = 0.55 + i*(Math.PI*2/10);
    const p = ringSpot(a, ang, COG.FRONT);
    if(p) setT(a,p.x,p.y,T.GEARWHEEL);
  }
  for(let i=0;i<9;i++){
    const ang = 0.12 + i*(Math.PI*2/9);
    const p = ringSpot(a, ang, COG.FRONT);
    if(p) setT(a,p.x,p.y,T.PILLAR);
  }
  // clutter: crates, barrels and signage where there's room
  // Clutter, split between the bands so neither one silts up. The jitter is
  // kept inside its band rather than being free to wander into the lane.
  for(const [tile,n,rr,off] of [[T.CRATE, 14, COG.OUTER, 0.2],
                                [T.BARREL,13, COG.INNER, 1.1],
                                [T.SIGN,   9, COG.FRONT, 2.0]]){
    for(let i=0;i<n;i++){
      const ang = off + i*(Math.PI*2/n) + rng()*0.1;
      const p = ringSpot(a, ang, rr + (rng()-0.5)*0.5);
      if(p) setT(a,p.x,p.y,tile);
    }
  }

  // --- THE COGWAY LIFT ----------------------------------------------------
  // A cage hung over the drop on the north-west arc, reached by a short deck
  // through the railing. The railing is cut here deliberately: the lift is
  // the one place on the ring where the barrier between you and the crater
  // is meant to be missing.
  const LIFT_ANG = -2.30;
  a.lift = [];
  for(let k=-1;k<=1;k++){
    for(let d=0; d<3; d++){
      const p = ringTile(LIFT_ANG + k*0.045, COG.PIT_R + 0.4 + d);
      setT(a, p.x, p.y, T.LIFT);
      a.lift.push([p.x,p.y]);
    }
  }
  const cage = ringTile(LIFT_ANG, COG.PIT_R - 0.6);
  for(let k=-1;k<=1;k++){
    const p = ringTile(LIFT_ANG + k*0.05, COG.PIT_R - 0.6);
    setT(a, p.x, p.y, T.LIFTCAGE);
  }
  a.liftCage = { x:cage.x, y:cage.y };
  // beside the deck on the inner band, not out in the lane
  { const p = ringSpot(a, LIFT_ANG + 0.15, COG.INNER); if(p) setT(a,p.x,p.y,T.SIGN); }

  const start = ringPx(Math.PI/2, (COG.INNER+COG.OUTER)/2);
  a.playerStart = { x:start.x, y:start.y };
  healPockets(a, Math.floor(start.x/TILE), Math.floor(start.y/TILE), T.COBBLE);
  a.spawns = [];                            // the hub is safe
  return a;
}

// ---------------------------------------------------------------------------
// 5-7. BEYOND THE WALLS
//
// Three hunting grounds, one per gate. They share a shape — a wide open map
// with the city gate on one edge and terrain funnelling you away from it —
// and differ in ground, cover and what lives there. Everything in all three
// is hostile, so each one opens with a stretch of clear ground: walking into
// a fight you did not choose the moment the screen fades in is the fastest
// way to make a zone feel cheap.
// ---------------------------------------------------------------------------

// Ground fill shared by all three zones.
//
// Interpolated, not quantised. `hash2((x/sc)|0, (y/sc)|0)` is the obvious way
// to get large-scale variation and it gives every patch a hard rectangular
// edge on the cell boundary — a whole map of visible 6x6 blocks. Smoothstep
// between the four corners of each cell instead, and two octaves so the blobs
// have some bite to their outline.
function smoothNoise(x,y,sc){
  const fx=x/sc, fy=y/sc;
  const ix=Math.floor(fx), iy=Math.floor(fy);
  const tx=fx-ix, ty=fy-iy;
  const sx=tx*tx*(3-2*tx), sy=ty*ty*(3-2*ty);
  return lerp(lerp(hash2(ix,iy),   hash2(ix+1,iy),   sx),
              lerp(hash2(ix,iy+1), hash2(ix+1,iy+1), sx), sy);
}
function zoneNoise(x,y,sc){
  return smoothNoise(x,y,sc)*0.66 + smoothNoise(x,y,Math.max(2,sc/2.6))*0.34;
}

function buildVerge(){
  const a = makeArea('verge', 60, 60, T.GRASS, { name:'The Verge' });
  const rng = makeRng(7301);

  for(let y=0;y<a.h;y++) for(let x=0;x<a.w;x++){
    const n = zoneNoise(x,y,6), f = hash2(x*3,y*7);
    if(n<0.32 && f<0.7)      setT(a,x,y,T.DRY);
    else if(n>0.72 && f>0.5) setT(a,x,y,T.TALLGRASS);
    else if(f>0.9)           setT(a,x,y,T.FLOWERS);
    else if(f>0.84)          setT(a,x,y,T.GRASS_TUFT);
  }

  // a slow river across the north, with reed beds
  for(let x=0;x<a.w;x++){
    const ry = 9 + Math.round(Math.sin(x*0.13)*3 + Math.sin(x*0.05)*2);
    for(let y=ry;y<ry+4;y++) setT(a,x,y,T.WATER);
    setT(a,x,ry-1,T.REEDS); setT(a,x,ry+4,T.REEDS);
  }
  // …and a ford, so the north bank is reachable
  for(let x=27;x<=32;x++){
    const ry = 9 + Math.round(Math.sin(x*0.13)*3 + Math.sin(x*0.05)*2);
    for(let y=ry-1;y<ry+5;y++) setT(a,x,y,T.SHALLOW);
  }

  // standing stones in a broken ring — the Verge is full of them
  for(let i=0;i<9;i++){
    const ang=i*(Math.PI*2/9)+0.3;
    setT(a, Math.round(30+Math.cos(ang)*11), Math.round(34+Math.sin(ang)*8), T.MENHIR);
  }
  setT(a,30,34,T.MENHIR);

  scatterT(a,rng,T.TREE,34,(x,y)=>y>18 && (x<12||x>46));
  scatterT(a,rng,T.BUSH,40,(x,y)=>y>16);
  scatterT(a,rng,T.ROCK,22,(x,y)=>y>18);
  scatterT(a,rng,T.PYLON,6,(x,y)=>y>22 && y<52);
  scatterT(a,rng,T.TALLGRASS,60,(x,y)=>y>16);

  // the gate road home, running south
  fillT(a,44,52,5,8,T.PATH);
  for(let x=44;x<49;x++)
    a.exits.push({ x, y:a.h-1, to:'cogway', tx:0, ty:0, gate:'n', label:'Ironhaven' });

  a.playerStart = { x:46*TILE+8, y:56*TILE+8 };
  healPockets(a, 46, 56, T.GRASS);
  a.spawns = [
    { kind:'brasshare',  n:7, x:12, y:30, w:18, h:12 },
    { kind:'brasshare',  n:5, x:36, y:22, w:16, h:10 },
    { kind:'tickboar',   n:4, x:14, y:44, w:20, h:10 },
    { kind:'tickboar',   n:3, x:38, y:36, w:14, h:10 },
    { kind:'pollenmoth', n:5, x:20, y:18, w:22, h:10 },
    { kind:'pollenmoth', n:3, x:8,  y:20, w:10, h:14 }
  ];
  return a;
}

function buildScarp(){
  const a = makeArea('scarp', 56, 52, T.SCREE, { name:'The Iron Scarp',
    tint:'rgba(40,36,60,0.10)' });
  const rng = makeRng(4412);

  for(let y=0;y<a.h;y++) for(let x=0;x<a.w;x++){
    const n = zoneNoise(x,y,7), f = hash2(x*5,y*3);
    if(n>0.70 && f>0.55)      setT(a,x,y,T.GRAVEL);
    else if(n<0.28 && f<0.62) setT(a,x,y,T.DIRT);
  }

  // Cliff walls closing in from north and south, so the zone reads as a pass
  // rather than an open field of rock. The gap between them narrows as you go
  // east, which funnels you toward the far end.
  for(let x=0;x<a.w;x++){
    const squeeze = Math.round(x*0.16);
    const topH = 5 + squeeze + Math.round(Math.sin(x*0.21)*2);
    const botH = 5 + squeeze + Math.round(Math.sin(x*0.17+2)*2);
    for(let y=0;y<topH;y++)           setT(a,x,y,T.CLIFF);
    for(let y=a.h-botH;y<a.h;y++)     setT(a,x,y,T.CLIFF);
    if(hash2(x,3)>0.6) setT(a,x,topH,T.ORE);
    if(hash2(x,9)>0.7) setT(a,x,a.h-botH-1,T.ORE);
  }
  for(let y=0;y<a.h;y++){ setT(a,a.w-1,y,T.CLIFF); setT(a,a.w-2,y,T.CLIFF); }

  // a talus slope and a couple of outcrops mid-pass
  for(let i=0;i<5;i++){
    const ox=10+i*9, oy=16+((rng()*18)|0);
    for(let j=0;j<4+((rng()*4)|0);j++)
      setT(a, ox+((rng()*5)|0), oy+((rng()*4)|0), T.CLIFF);
  }

  scatterT(a,rng,T.PINE,26,(x,y)=>x<34);
  scatterT(a,rng,T.ROCK,44,()=>true);
  scatterT(a,rng,T.ORE,18,(x,y)=>x>10);
  scatterT(a,rng,T.STUMP,8,(x,y)=>x<26);

  fillT(a,0,24,6,5,T.PATH);
  for(let y=24;y<29;y++)
    a.exits.push({ x:0, y, to:'cogway', tx:0, ty:0, gate:'e', label:'Ironhaven' });

  a.playerStart = { x:3*TILE+8, y:26*TILE+8 };
  healPockets(a, 3, 26, T.SCREE);
  a.spawns = [
    { kind:'cragram',   n:5, x:14, y:16, w:16, h:16 },
    { kind:'cragram',   n:4, x:34, y:18, w:12, h:14 },
    { kind:'pylonhawk', n:5, x:20, y:12, w:24, h:10 },
    { kind:'pylonhawk', n:3, x:12, y:30, w:14, h:12 },
    { kind:'slagbear',  n:3, x:30, y:24, w:16, h:12 },
    { kind:'slagbear',  n:2, x:42, y:20, w:10, h:14 }
  ];
  return a;
}

function buildShoals(){
  const a = makeArea('shoals', 58, 46, T.SAND, { name:'The Rivet Shoals' });
  const rng = makeRng(9920);

  // The sea fills the south-west, and the bands run diagonally so the
  // waterline isn't a straight edge. Order matters: deep, then surf, then
  // wet sand, each overwriting the last where they overlap.
  for(let y=0;y<a.h;y++) for(let x=0;x<a.w;x++){
    const d = (y*1.0 + (a.w-x)*0.42) + Math.sin(x*0.16)*2.2 + Math.sin(y*0.2)*1.6;
    if(d > 52)      setT(a,x,y,T.WATER);
    else if(d > 47) setT(a,x,y,T.SURF);
    else if(d > 43) setT(a,x,y,T.WETSAND);
    else {
      const n = zoneNoise(x,y,6), f = hash2(x*3,y*5);
      if(n>0.68 && f>0.55) setT(a,x,y,T.DUNEGRASS);
    }
  }
  // dunes along the north edge
  for(let x=0;x<a.w;x++){
    const h=3+Math.round(Math.sin(x*0.18)*2);
    for(let y=0;y<h;y++) setT(a,x,y,T.DUNEGRASS);
  }
  for(let y=0;y<a.h;y++){ setT(a,a.w-1,y,T.PALM); }

  // the wreck the Shoals are named for, half-buried
  for(let i=0;i<9;i++) setT(a, 20+i, 20+Math.round(Math.sin(i*0.7)*3), T.WRECK);
  for(let i=0;i<5;i++) setT(a, 24+i, 26+Math.round(Math.cos(i*0.8)*2), T.WRECK);

  scatterT(a,rng,T.PALM,22,(x,y)=>y<16);
  // Driftwood, crates and wreck all read as brown boxes at a glance, so they
  // are deliberately thinned and separated: wood high on the beach, wreckage
  // low near the tide, rock between.
  scatterT(a,rng,T.DRIFTWOOD,14,(x,y)=>y>8 && y<22);
  scatterT(a,rng,T.ROCK,20,(x,y)=>y>20);
  scatterT(a,rng,T.DUNEGRASS,50,(x,y)=>y<22);
  scatterT(a,rng,T.CRATE,5,(x,y)=>y>14 && y<24);

  // You come down onto the beach from the city, which is now north of it, so
  // the way back is a path over the dunes rather than a gap in the palms.
  fillT(a,26,0,5,7,T.PATH);
  for(let x=26;x<31;x++)
    a.exits.push({ x, y:0, to:'cogway', tx:0, ty:0, gate:'s', label:'Ironhaven' });

  a.playerStart = { x:28*TILE+8, y:6*TILE+8 };
  healPockets(a, 28, 6, T.SAND);
  a.spawns = [
    { kind:'gullwright', n:6, x:16, y:8,  w:26, h:12 },
    { kind:'gullwright', n:4, x:8,  y:20, w:14, h:12 },
    { kind:'anvilcrab',  n:5, x:12, y:26, w:22, h:10 },
    { kind:'anvilcrab',  n:3, x:34, y:28, w:12, h:10 },
    { kind:'turbineel',  n:5, x:10, y:32, w:24, h:8  },
    { kind:'turbineel',  n:3, x:36, y:34, w:12, h:8  }
  ];
  return a;
}

// ---------------------------------------------------------------------------
// 8. THE UNDERCROFT LANDING
//
// Where the lift stops. Deliberately small and deliberately a dead end: the
// next ring of the city is not built, and rather than pretend otherwise this
// is a lit landing with a sealed door and a view back up the shaft. It is
// where the following zone plugs in.
// ---------------------------------------------------------------------------
function buildUndercroft(){
  // The landing is built around the shaft, not beside it. The cage comes down
  // in the MIDDLE of the chamber and the two ways on lead off it left and
  // right, so the first thing you see when the doors open is a choice —
  // rather than a corridor with the lift behind you and one door at the end.
  const a = makeArea('undercroft', 34, 21, T.IRONPLATE,
                     { name:'The Undercroft \u2014 Lift Landing',
                       tint:'rgba(10,14,26,0.30)' });
  for(let y=0;y<a.h;y++) for(let x=0;x<a.w;x++){
    if(x<2||y<2||x>=a.w-2||y>=a.h-2) setT(a,x,y,T.CLIFF);
    else if(hash2(x*3,y*5)>0.86)     setT(a,x,y,T.COBBLE);
  }

  // --- the shaft, dead centre ----------------------------------------------
  const CX = 16, CY = 10;                      // the middle of the room
  for(let y=CY-2;y<=CY+1;y++) for(let x=CX-2;x<=CX+1;x++) setT(a,x,y,T.LIFT);
  a.lift = [];
  for(let y=CY-2;y<=CY+1;y++) for(let x=CX-2;x<=CX+1;x++) a.lift.push([x,y]);
  // a rail around three sides, open toward the player's arrival
  for(let x=CX-3;x<=CX+2;x++){ setT(a,x,CY-3,T.LIFTCAGE); }
  setT(a,CX-3,CY-2,T.LIFTCAGE); setT(a,CX+2,CY-2,T.LIFTCAGE);
  setT(a,CX-3,CY-1,T.LIFTCAGE); setT(a,CX+2,CY-1,T.LIFTCAGE);

  // --- WEST: the Glimmervein, through a crack nobody cut -------------------
  // The Undercroft was built up against something that was already here.
  for(let y=CY-1;y<=CY+1;y++) for(let x=0;x<=6;x++) setT(a,x,y,T.CAVEFLOOR);
  setT(a,6,CY-2,T.FLOWSTONE); setT(a,5,CY+2,T.GEMCLUSTER); setT(a,2,CY+2,T.GEMVEIN);
  for(let y=CY-1;y<=CY+1;y++)
    a.exits.push({ x:0, y, to:'glimmervein', tx:0, ty:0, cave:true,
                   label:'The Glimmervein' });

  // --- EAST: a door that has not been opened yet ---------------------------
  // Cut stone rather than raw rock, and a seal across it. There is nothing
  // behind it in this build, and the dialogue at it says exactly that rather
  // than promising a zone that does not exist.
  for(let y=CY-1;y<=CY+1;y++) for(let x=a.w-7;x<a.w-4;x++) setT(a,x,y,T.COBBLE);
  for(let y=CY-2;y<=CY+2;y++){ setT(a,a.w-4,y,T.CLIFF); setT(a,a.w-3,y,T.CLIFF); }
  for(let y=CY-1;y<=CY+1;y++) setT(a,a.w-5,y,T.SEAL);
  setT(a,a.w-6,CY-3,T.PILLAR); setT(a,a.w-6,CY+3,T.PILLAR);
  a.doorSeal = true;

  // --- dressing, kept off both approaches ----------------------------------
  for(const [x,y] of [[9,4],[9,16],[24,4],[24,16]])  setT(a,x,y,T.BRAZIER);
  for(const [x,y] of [[12,5],[12,15],[21,5],[21,15]]) setT(a,x,y,T.PILLAR);
  for(const [x,y] of [[8,7],[26,13],[10,13]])         setT(a,x,y,T.CRATE);
  setT(a,26,7,T.BARREL); setT(a,CX-1,CY+4,T.SIGN);

  // You step off the cage facing south into the room, with both ways on in
  // sight to either side.
  a.playerStart = { x:CX*TILE+8, y:(CY+3)*TILE+8 };
  healPockets(a, CX, CY+3, T.IRONPLATE);
  a.spawns = [];
  return a;
}

// ---------------------------------------------------------------------------
// 9. THE GLIMMERVEIN
//
// West of the Undercroft, through a crack in a wall somebody built to keep
// this out. A dry cavern lit only by the gem seams running through it — the
// same six accent stones the city one floor up paves its streets with, still
// in the ground, still growing.
//
// The cavern itself is carved out of noise rather than laid out by hand,
// because a cave that reads as a cave has no straight lines and no symmetry.
// What IS placed by hand is the spine: a walkable corridor from the entrance
// through the middle, so the noise can never seal the player in. healPockets
// then removes whatever it cut off from that spine.
// ---------------------------------------------------------------------------
function buildGlimmervein(){
  const a = makeArea('glimmervein', 56, 40, T.CAVEWALL,
                     { name:'The Glimmervein', tint:'rgba(10,6,24,0.34)' });
  const rng = makeRng(4471);

  for(let y=1;y<a.h-1;y++) for(let x=1;x<a.w-1;x++){
    const n = zoneNoise(x, y, 9);
    // the walls thicken toward the edges, so the cavern has a shape rather
    // than a rectangle with texture in it
    const edge = Math.min(x, y, a.w-1-x, a.h-1-y) / 4;
    if(n * Math.min(1, edge) > 0.17) setT(a,x,y,T.CAVEFLOOR);
  }
  // the spine: entrance corridor east-to-west, then two branches
  for(let x=2;x<a.w-1;x++){
    const yy = 20 + Math.round(Math.sin(x*0.16)*5);
    for(let k=-1;k<=1;k++) setT(a,x,yy+k,T.CAVEFLOOR);
  }
  for(let y=8;y<32;y++){
    for(let k=-1;k<=1;k++){ setT(a,16+k,y,T.CAVEFLOOR); setT(a,38+k,y,T.CAVEFLOOR); }
  }

  // --- water. Three pools, each with a shallow rim, sunk into the floor ----
  for(const [px,py,pr] of [[11,30,5],[33,10,6],[46,28,4]]){
    for(let y=py-pr-1;y<=py+pr+1;y++) for(let x=px-pr-1;x<=px+pr+1;x++){
      if(x<1||y<1||x>=a.w-1||y>=a.h-1) continue;
      if(a.map[y*a.w+x]!==T.CAVEFLOOR) continue;
      const d = Math.hypot((x-px)*0.9, y-py);
      if(d < pr-1)      setT(a,x,y,T.WATER);
      else if(d < pr+1) setT(a,x,y,T.SHALLOW);
    }
  }

  // --- what grows out of it ------------------------------------------------
  const floor = (x,y)=>a.map[y*a.w+x]===T.CAVEFLOOR;
  // Sparse on purpose. A gem every few tiles reads as a seam; a gem every
  // tile reads as a carpet, and stops being the thing you look at.
  scatterT(a,rng,T.GEMVEIN,   70, floor);
  scatterT(a,rng,T.GEMCLUSTER,22, (x,y)=>floor(x,y));
  scatterT(a,rng,T.FLOWSTONE, 14, floor);
  scatterT(a,rng,T.ROCK,      30, floor);

  // --- back up to the Undercroft, on the east wall --------------------------
  for(let y=19;y<=21;y++) for(let x=a.w-3;x<a.w;x++) setT(a,x,y,T.CAVEFLOOR);
  for(let y=19;y<=21;y++)
    // Resolved after both areas exist (see buildAllAreas) rather than written
    // here: the landing has been rearranged once already, and a hand-copied
    // coordinate is how you end up arriving inside a wall.
    a.exits.push({ x:a.w-1, y, to:'undercroft', tx:0, ty:0, backFromCave:true,
                   label:'The Undercroft' });

  a.playerStart = { x:(a.w-5)*TILE+8, y:20*TILE+8 };
  healPockets(a, a.w-5, 20, T.CAVEFLOOR);

  // --- where the pylons can stand ------------------------------------------
  // Anchors, not spawns: which imp each one pours is rolled fresh every time
  // you walk in, so the cave is never the same fight twice. They are spread
  // over the cavern and kept off the entrance so you are not jumped at the
  // door.
  a.pylonSpots = [];
  for(const [x,y] of [[12,12],[20,8],[26,24],[14,27],[34,32],[41,14],[44,23],[30,17],[8,21]]){
    if(x<1||y<1||x>=a.w-1||y>=a.h-1) continue;
    if(a.map[y*a.w+x]!==T.CAVEFLOOR){
      // nudge to the nearest floor tile rather than dropping the anchor
      let found=null;
      for(let r=1;r<6&&!found;r++)
        for(let dy=-r;dy<=r&&!found;dy++) for(let dx=-r;dx<=r&&!found;dx++){
          const nx=x+dx, ny=y+dy;
          if(nx<1||ny<1||nx>=a.w-1||ny>=a.h-1) continue;
          if(a.map[ny*a.w+nx]===T.CAVEFLOOR) found=[nx,ny];
        }
      if(!found) continue;
      a.pylonSpots.push(found);
    } else a.pylonSpots.push([x,y]);
  }
  a.spawns = [];
  return a;
}


// ---------------------------------------------------------------------------
// GATHERING NODES
//
// Scattered after everything else is placed, and only onto ground the player
// can already stand next to — a node walled in by its own zone's scenery is
// worse than no node, because the quest that wants it has no way to say so.
// Seeded off the area, so a zone's nodes are in the same places every visit;
// only whether they have been WORKED changes, and that lives in G.
// ---------------------------------------------------------------------------
function placeNodes(a, matId, n, pred){
  const M = MAT_BY_ID[matId];
  if(!M) return;
  a.nodeMat = matId;
  a.nodes = [];
  const rng = makeRng(a.w*31 + a.h*7 + matId.length*101);
  let guard = 0;
  while(a.nodes.length < n && guard++ < n*400){
    const x = 2+Math.floor(rng()*(a.w-4)), y = 2+Math.floor(rng()*(a.h-4));
    if(pred && !pred(x,y)) continue;
    if(SOLID[a.map[y*a.w+x]]) continue;
    // must have an open tile beside it to stand on, and not crowd another node
    const open = [[1,0],[-1,0],[0,1],[0,-1]]
      .filter(([dx,dy])=>!SOLID[a.map[(y+dy)*a.w+(x+dx)]]).length;
    if(open < 2) continue;
    if(a.nodes.some(q=>Math.abs(q[0]-x)+Math.abs(q[1]-y) < 6)) continue;
    // Nodes are placed after everything else, including the Glimmervein's
    // pylon anchors — and a node is SOLID, so dropping one on an anchor
    // walls the generator into the rock and the cave quietly ships with
    // fewer of them than it was designed around.
    if((a.pylonSpots||[]).some(q=>Math.abs(q[0]-x)+Math.abs(q[1]-y) < 3)) continue;
    setT(a,x,y,T.NODE);
    a.nodes.push([x,y]);
  }
}

const AREAS = {};
function buildAllAreas(){
  AREAS.house    = buildHouse();
  AREAS.clearing = buildClearing();
  AREAS.gate     = buildGate();
  AREAS.cogway   = buildCogway();
  AREAS.verge    = buildVerge();
  AREAS.scarp    = buildScarp();
  AREAS.shoals   = buildShoals();
  AREAS.undercroft = buildUndercroft();
  AREAS.glimmervein = buildGlimmervein();

  // --- gathering nodes, one material per zone ------------------------------
  // Placed here rather than inside each builder so the five sit together and
  // the "one material per zone, found nowhere else" rule is visible as a rule
  // rather than as five separate coincidences.
  AREAS.clearing.nodeGround = T.GRASS;
  placeNodes(AREAS.clearing,    'rustscrap', 7,  (x,y)=>y>24);
  AREAS.verge.nodeGround = T.GRASS;
  placeNodes(AREAS.verge,       'bloomiron', 10, (x,y)=>y<52);
  AREAS.scarp.nodeGround = T.SCREE;
  placeNodes(AREAS.scarp,       'cragglass', 10);
  AREAS.shoals.nodeGround = T.SAND;
  placeNodes(AREAS.shoals,      'brinesalt', 10, (x,y)=>y>4 && y<34);
  AREAS.glimmervein.nodeGround = T.CAVEFLOOR;
  placeNodes(AREAS.glimmervein, 'veinshard', 9);

  // The zones send you back to a named Cogway gate rather than to fixed
  // coordinates, because the gate positions are derived from COG and would
  // have to be kept in sync by hand otherwise.
  for(const ex of AREAS.undercroft.exits)
    if(ex.cave){ ex.tx = (AREAS.glimmervein.w-4)*TILE+8; ex.ty = 20*TILE+8; }
  {
    // and back the other way, onto the mouth of the crack in the landing
    const mouth = AREAS.undercroft.exits.find(e=>e.cave);
    for(const ex of AREAS.glimmervein.exits)
      if(ex.backFromCave){ ex.tx = 5*TILE+8; ex.ty = (mouth ? mouth.y : 10)*TILE+8; }
  }

  for(const id of ['gate','verge','scarp','shoals'])
    for(const ex of AREAS[id].exits){
      if(!ex.gate) continue;
      const g = COG.GATES.find(q=>q.dir===ex.gate);
      const p = ringPx(g.ang, COG.RING_R-2.5);
      ex.tx = p.x; ex.ty = p.y;
    }
}

// ---------------------------------------------------------------------------
// THE CRATER
//
// Seen from directly above, a shaft is concentric rings: each level down is a
// smaller circle, darker than the one outside it, and the sliver of the
// previous ring still showing is that level's terrace. Nine of them is enough
// to read as a very long way down. Drawn in one pass into the terrain buffer,
// because per-tile this could only ever be a ring of squares.
// ---------------------------------------------------------------------------
function ringDisc(c, col, cx, cy, r){
  c.fillStyle = col;
  const R = Math.ceil(r);
  for(let dy=-R; dy<=R; dy++){
    const w = Math.floor(Math.sqrt(Math.max(0, r*r - dy*dy)));
    if(w>0) c.fillRect(Math.round(cx-w), Math.round(cy+dy), w*2, 1);
  }
}

function drawPit(c, pit){
  const CX = pit.cx*TILE + 8, CY = pit.cy*TILE + 8, R0 = pit.r*TILE;
  const rng = makeRng(5150);
  const LEVELS = 9;

  // The value ramp starts high and falls a long way. An earlier pass began in
  // the pit darks and every terrace came out the same near-black, so the hole
  // read as a flat disc. The top two levels have to be genuinely lit — they
  // are the only evidence that anything is down there.
  const WALL = [C.cstone2,C.cstone1,'#1e1a26','#191521','#14111b','#100d16','#0b0910','#07060b','#040308'];
  const LIP  = [C.cstone6,C.cstone5,C.cstone4,C.cstone3,C.cstone2,C.cstone1,'#1a1622','#131019','#0d0b12'];

  // the lip: bare rock where the paving has been cut clean through
  ringDisc(c, C.cstone3, CX, CY, R0+4);
  ringDisc(c, C.cstone5, CX, CY, R0+2);
  ringDisc(c, C.cstone1, CX, CY, R0);

  for(let k=0;k<LEVELS;k++){
    const t = k/(LEVELS-1);
    const r = R0 * (1 - t*0.88) - 5;
    ringDisc(c, LIP[k],  CX, CY, r+3);
    ringDisc(c, WALL[k], CX, CY, r);

    // Buildings crowding each terrace, thinning and dimming with depth. Their
    // lit windows are the only thing telling you the hole is inhabited.
    const n = Math.max(8, 52 - k*5);
    const lit = Math.max(0.05, 0.9 - k*0.10);
    for(let i=0;i<n;i++){
      const ang = (i/n)*Math.PI*2 + rng()*0.06;
      const ca=Math.cos(ang), sa=Math.sin(ang);
      const bx = CX + ca*(r+1.5), by = CY + sa*(r+1.5);
      const w = 2 + ((rng()*3)|0), h = 2 + ((rng()*3)|0);
      tpx(c, LIP[k],  Math.round(bx), Math.round(by), w, h);
      tpx(c, WALL[k], Math.round(bx+w-1), Math.round(by), 1, h);
      if(k<6) tpx(c, LIP[Math.max(0,k-1)], Math.round(bx), Math.round(by), w, 1);
      if(rng() < lit){
        const A = ACCENTS[(rng()*ACCENTS.length)|0];
        tpx(c, rng()<0.45 ? A.b : C.amber3, Math.round(bx), Math.round(by), 1, 1);
      }
    }
    // gantries and pipe runs bridging one terrace down to the next
    if(k < LEVELS-2) for(let i=0;i<6;i++){
      const ang = (i/6)*Math.PI*2 + k*0.37;
      const r2 = R0*(1-((k+1)/(LEVELS-1))*0.88)-3;
      for(let d=r2; d<r+3; d++)
        tpx(c, LIP[Math.min(LEVELS-1,k+1)],
            Math.round(CX+Math.cos(ang)*d), Math.round(CY+Math.sin(ang)*d), 2, 2);
    }
  }

  // Chains strung clear across the shaft, and the lift cages riding them. Seen
  // from above these are the one thing that crosses the rings, which is what
  // gives the hole a sense of span rather than just depth.
  for(let i=0;i<3;i++){
    const ang = i*(Math.PI/3) + 0.4, ca=Math.cos(ang), sa=Math.sin(ang);
    for(let d=-R0+6; d<R0-6; d++){
      tpx(c,'#1c1925', Math.round(CX+ca*d), Math.round(CY+sa*d), 1, 1);
      if((d&7)===0) tpx(c,'#2c2838', Math.round(CX+ca*d), Math.round(CY+sa*d), 1, 1);
    }
    for(const dd of [-R0*0.45, R0*0.3]){
      tpx(c,'#0d0b12', Math.round(CX+ca*dd)-3, Math.round(CY+sa*dd)-3, 7, 7);
      tpx(c,C.iron2,   Math.round(CX+ca*dd)-2, Math.round(CY+sa*dd)-2, 5, 5);
      tpx(c,C.amber3,  Math.round(CX+ca*dd)-1, Math.round(CY+sa*dd)-1, 2, 2);
    }
  }

  // something still burning at the bottom, too far down to make out
  for(let g=7; g>0; g--)
    ringDisc(c, 'rgba(255,150,60,'+(0.045+0.028*(7-g))+')', CX, CY, g*3.4);
  ringDisc(c, 'rgba(255,205,120,0.34)', CX, CY, 4);
}

// ---------------------------------------------------------------------------
// THE OUTER RING — the city mass the street is cut into
//
// Same trick as the crater, outward instead of inward: bands of stone at
// growing radius, getting darker as they rise away from the street, with the
// inner face catching the light. Shopfronts are stamped around the inner edge
// afterwards, facing in.
// ---------------------------------------------------------------------------
function drawOuterRing(c, pit){
  const CX = pit.cx*TILE + 8, CY = pit.cy*TILE + 8;
  const R0 = COG.STREET_R*TILE, R1 = COG.RING_R*TILE;
  const rng = makeRng(2266);

  ringDisc(c, C.cstone1, CX, CY, R1+TILE);        // outer bound
  for(let k=5;k>=0;k--){
    const r = R0 + (R1-R0)*(k/5);
    ringDisc(c, [C.cstone3,C.cstone3,C.cstone2,C.cstone2,C.cstone1,'#1b1d23'][k], CX, CY, r);
  }
  ringDisc(c, C.cstone4, CX, CY, R0+3);           // lit inner face
  ringDisc(c, C.cstone3, CX, CY, R0+1);

  // --- THE STREET ----------------------------------------------------------
  // The walkable ring is painted by this radial pass, not by the COBBLE tile
  // arm — the arm draws underneath and is covered. So the paving goes on here,
  // and it follows the CURVE: courses of setts laid concentrically, the way a
  // road round a hole would actually be laid. Square setts on a circular
  // street look like a tilemap someone cut a hole in.
  //
  // Stamped per tile rather than per device pixel: a full-resolution pass over
  // this annulus is a million iterations on area load, and the difference is
  // not visible under the props and lamps that cover most of it.
  {
    const rIn = COG.PIT_R*TILE + 6, rOut = R0 - 1;
    const step = 5*ART;                           // a course, in device units
    for(let r = rIn*ART; r < rOut*ART; r += step){
      const circ = 2*Math.PI*r;
      const n = Math.max(24, Math.round(circ/step));
      const jitter = hash2((r/step)|0, 3);
      for(let i=0;i<n;i++){
        const ang = ((i+jitter)/n)*Math.PI*2;
        const ca=Math.cos(ang), sa=Math.sin(ang);
        const v = hash2(i*7+((r/step)|0)*13, ((r/step)|0)*5);
        const col = v>0.80 ? C.cstone5 : v>0.50 ? C.cstone4 : v>0.20 ? C.cstone3 : C.cstone2;
        const px2 = CX*ART + ca*r, py2 = CY*ART + sa*r;
        const w = step-1;
        // the sett, then its lit upper-left and the mortar shadow below
        withArt(ART, ()=>{
          tpx(c, deep(col), Math.round(px2-w/2),   Math.round(py2-w/2)+1, w, w);
          tpx(c, col,       Math.round(px2-w/2),   Math.round(py2-w/2),   w, w);
          tpx(c, lit(col),  Math.round(px2-w/2),   Math.round(py2-w/2),   w-1, 1);
          tpx(c, lit(col),  Math.round(px2-w/2),   Math.round(py2-w/2),   1, w-1);
          if(v>0.93) tpx(c, C.cstone6, Math.round(px2-w/2), Math.round(py2-w/2), 1, 1);
        });
      }
    }
    // A scatter of aethite inlay, the street's entire colour budget. Eighteen,
    // not seventy: at seventy they stopped reading as stones set into the road
    // and started reading as litter dropped on it.
    for(let k=0;k<18;k++){
      const ang = hash2(k*11, 7)*Math.PI*2;
      const r = (rIn + hash2(k*5, 13)*(rOut-rIn))*ART;
      const A = ACCENTS[(hash2(k*3,k*9)*ACCENTS.length)|0];
      const px2 = Math.round(CX*ART + Math.cos(ang)*r), py2 = Math.round(CY*ART + Math.sin(ang)*r);
      withArt(ART, ()=>{
        tpx(c, deep(A.d), px2-3, py2-3, 7, 7);       // the socket it sits in
        tpx(c, A.a,       px2-2, py2-2, 5, 5);
        tpx(c, A.b,       px2-2, py2-2, 4, 4);
        tpx(c, A.c,       px2-2, py2-2, 2, 1);       // one catch of light
        tpx(c, dim(A.a),  px2+1, py2-1, 1, 4);
      });
    }
  }

  // Vertical seams so the mass reads as a terrace of separate buildings
  // rather than one continuous wall.
  for(let i=0;i<64;i++){
    const ang = (i/64)*Math.PI*2;
    const ca=Math.cos(ang), sa=Math.sin(ang);
    for(let d=R0; d<R1; d++)
      tpx(c, C.cstone1, Math.round(CX+ca*d), Math.round(CY+sa*d), 1, 1);
  }
  // rooflines, chimneys and the odd lit window on the upper storeys
  for(let i=0;i<150;i++){
    const ang = rng()*Math.PI*2, d = R0 + 6 + rng()*(R1-R0-10);
    const bx = CX+Math.cos(ang)*d, by = CY+Math.sin(ang)*d;
    const w = 3+((rng()*5)|0), h = 3+((rng()*4)|0);
    tpx(c, rng()<0.5 ? C.cstone2 : C.iron2, Math.round(bx), Math.round(by), w, h);
    tpx(c, C.cstone4, Math.round(bx), Math.round(by), w, 1);
    if(rng()<0.25) tpx(c, C.amber2, Math.round(bx+1), Math.round(by+1), 1, 1);
  }

  // Shopfronts around the inner face. Only the arc facing the camera can show
  // a real facade — on the far side you would be looking at the back of the
  // roof — so the doors and windows fade out towards the top of the ring.
  for(let i=0;i<40;i++){
    const ang = (i/40)*Math.PI*2;
    const facing = Math.sin(ang);                 // +1 = south side, faces us
    if(facing < -0.25) continue;
    const ca=Math.cos(ang), sa=Math.sin(ang);
    const fx = CX+ca*(R0+2), fy = CY+sa*(R0+2);
    const A  = ACCENTS[(rng()*ACCENTS.length)|0];
    const w=13, h=Math.round(10+facing*8);
    const X = Math.round(fx-w/2), Y = Math.round(fy-h);
    tpx(c,C.cstone2, X,   Y,   w,   h);           // facade
    tpx(c,C.cstone4, X,   Y,   w,   1);
    tpx(c,C.cstone1, X,   Y+h-1, w, 1);
    if(h>11){
      tpx(c,C.iron1,   X+2, Y+3, 4, h-5);         // door
      tpx(c,C.iron2,   X+3, Y+4, 2, h-6);
      tpx(c,C.amber2,  X+8, Y+3, 4, 4);           // lit window
      tpx(c,C.amber4,  X+8, Y+3, 4, 2);
      tpx(c,C.iron1,   X+7, Y+2, 6, 1);
      tpx(c,A.a,       X,   Y+1, w, 2);           // painted lintel
      tpx(c,A.b,       X,   Y+1, w, 1);
      tpx(c,A.c,       X+w-4, Y+1, 2, 1);
    } else {
      tpx(c,C.amber2,  X+4, Y+3, 4, 3);
      tpx(c,A.a,       X,   Y+1, w, 2);
    }
  }
}

// ---------------------------------------------------------------------------
// BUILDING EXTERIORS — drawn straight into the terrain buffer once per area
// ---------------------------------------------------------------------------
function drawBuilding(c, b){
  const X=b.x*TILE, Y=b.y*TILE, W=b.w*TILE, H=b.h*TILE;
  // A cottage reads as a cottage mostly through roof-to-wall ratio. Give the
  // roof a bit over half the height and a steep pitch with a real overhang.
  const wallTop = Y + Math.round(H*0.52);
  const wallH   = H - (wallTop - Y);
  const rc = b.style==='workshop' ? [C.roofB1,C.roofB2,C.roofB3,C.roofB4]
                                  : [C.roof1,C.roof2,C.roof3,C.roof4];

  tpx(c,C.shadowHard, X+2, Y+H-5, W-4, 7);

  // ---- walls: plaster between exposed timber posts
  tpx(c,C.plaster1, X, wallTop, W, wallH);
  tpx(c,C.plaster2, X+2, wallTop+1, W-4, wallH-3);
  tpx(c,C.plaster3, X+2, wallTop+1, W-4, 4);
  // corner posts + intermediate studs
  const studs = Math.max(2, Math.round(W/38));
  for(let i=0;i<=studs;i++){
    const sx = X + Math.round(i*(W-5)/studs);
    tpx(c,C.wood1, sx, wallTop, 5, wallH);
    tpx(c,C.wood3, sx+1, wallTop, 3, wallH);
    tpx(c,C.wood4, sx+1, wallTop, 1, wallH);
  }
  // sill beam and stone footing
  tpx(c,C.wood1, X, wallTop, W, 3);
  tpx(c,C.wood3, X, wallTop+1, W, 1);
  tpx(c,C.stone1, X, Y+H-6, W, 6);
  tpx(c,C.stone2, X+1, Y+H-5, W-2, 4);
  tpx(c,C.stone3, X+1, Y+H-5, W-2, 1);

  // ---- windows, lit from inside
  const winY = wallTop + Math.round(wallH*0.30);
  const winH = Math.max(10, Math.round(wallH*0.40));
  for(const wx of [X+Math.round(W*0.18)-7, X+Math.round(W*0.78)-7]){
    tpx(c,C.wood1, wx-3, winY-3, 20, winH+6);
    tpx(c,C.wood3, wx-2, winY-2, 18, winH+4);
    tpx(c,C.iron1, wx, winY, 14, winH);
    tpx(c,C.amber2, wx+1, winY+1, 12, winH-2);
    tpx(c,C.amber4, wx+1, winY+1, 12, Math.round(winH*0.4));
    tpx(c,C.amber5, wx+2, winY+2, 4, 2);
    tpx(c,C.wood2, wx+6, winY, 2, winH);            // mullions
    tpx(c,C.wood2, wx, winY+Math.round(winH/2)-1, 14, 2);
    tpx(c,C.wood4, wx-3, winY+winH+2, 20, 2);       // sill
  }

  // ---- roof: stepped courses climbing to a ridge, overhanging both eaves
  const steps = 9;
  const roofBottom = wallTop + 3;
  const stepH = Math.max(3, Math.round((roofBottom - Y + 10)/steps));
  for(let s=0;s<steps;s++){
    const t = s/(steps-1);
    const inset = Math.round(t * (W*0.5 - 9));
    const ry = roofBottom - s*stepH;
    const rw = W + 12 - inset*2;
    tpx(c, rc[0], X-6+inset, ry-stepH, rw, stepH+1);
    tpx(c, rc[1], X-6+inset, ry-stepH, rw, stepH);
    tpx(c, rc[2], X-5+inset, ry-stepH, rw-2, 1);
    // individual tile seams
    for(let i=2;i<rw;i+=7) tpx(c, rc[0], X-6+inset+i, ry-stepH, 1, stepH);
  }
  // ridge cap
  const ridgeY = roofBottom - steps*stepH;
  tpx(c, rc[0], X+Math.round(W*0.5)-11, ridgeY, 22, 4);
  tpx(c, rc[3], X+Math.round(W*0.5)-10, ridgeY, 20, 2);
  // heavy eaves line and its shadow on the wall
  tpx(c, rc[0], X-6, roofBottom, W+12, 3);
  tpx(c, C.shadow, X, roofBottom+3, W, 4);

  // ---- chimney, offset from the ridge
  const chx = X + W - 30;
  tpx(c,C.stone1, chx, ridgeY-14, 13, 26);
  tpx(c,C.stone2, chx+1, ridgeY-13, 11, 24);
  tpx(c,C.stone3, chx+1, ridgeY-13, 11, 2);
  for(let r=0;r<4;r++) tpx(c,C.stone1, chx+1, ridgeY-9+r*5, 11, 1);
  tpx(c,C.stone1, chx-2, ridgeY-18, 17, 5);
  tpx(c,C.stone4, chx-2, ridgeY-18, 17, 1);
  tpx(c,C.iron1,  chx+3, ridgeY-21, 7, 3);

  // ---- door surround
  if(b.doorX!==undefined){
    const dxp = b.doorX*TILE;
    tpx(c,C.wood1, dxp-5, Y+H-30, 26, 30);
    tpx(c,C.wood3, dxp-4, Y+H-29, 24, 4);
    tpx(c,C.wood4, dxp-4, Y+H-29, 24, 1);
    tpx(c,C.wood1, dxp-4, Y+H-25, 3, 25);
    tpx(c,C.wood1, dxp+17, Y+H-25, 3, 25);
    // little porch lantern
    tpx(c,C.iron1, dxp+20, Y+H-32, 3, 6);
    tpx(c,C.brass2, dxp+19, Y+H-28, 5, 5);
    tpx(c,C.amber3, dxp+20, Y+H-27, 3, 3);
  }
}
