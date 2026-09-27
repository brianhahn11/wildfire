"use strict";
/* ============================================================================
   WILDFIRE — Vertical Slice v2
   Aethermere · The Rustfields · Ironhaven Gate
   9 classes with bespoke mechanics, 6 dragon companions, 3 connected areas.
   480x270 native · 16x16 tiles · 16x24 characters · 12x12 dragons (GDD §3)
   ========================================================================== */

// ---------------------------------------------------------------------------
// THE TWO COORDINATE SPACES
//
// VW, VH and TILE are WORLD units and they do not change. Every gameplay
// number in the game is expressed in them — speeds, ability ranges, aggro
// radii, knockback, the two-player tether, every `dist(a,b) < 40`. There are
// on the order of 1,300 of them. Redefining TILE as 32 would silently rescale
// all of them relative to the world and the game would play differently,
// which is the one thing an art pass must not do.
//
// ART is how many device pixels one world pixel occupies. The canvas is
// VW*ART x VH*ART, and the frame is drawn through a single scale(ART), so
// every existing draw call keeps its coordinates and simply comes out bigger.
// Terrain buffers are sized in device pixels and scaled the same way.
//
// At ART=2 the output is pixel-identical to the browser upscaling the old
// 480x270 frame — which is the point. Stage 0 does not change how the game
// looks. It creates the room for art that will.
// ---------------------------------------------------------------------------
const VW = 480, VH = 270, TILE = 16;   // world units
const ART = 2;                          // device pixels per world pixel
const CW = VW*ART, CH_ = VH*ART;        // the canvas, in device pixels

// ---------------------------------------------------------------------------
// AUTHORED UNITS
//
// The frame is drawn through a scale(ART), so a painter that writes in world
// units comes out at ART device pixels per unit — which is the old art,
// correct, and chunky. A painter that has been REDRAWN for the new density
// wants to place single device pixels instead.
//
// ART_UNIT is how many authored units make one world unit. 1 is old art; 2 is
// art authored at device resolution. The primitive divides by it, so a
// converted painter simply writes bigger numbers and gets finer detail, and
// an unconverted one is untouched.
//
// This is what makes a 1,480-site redraw survivable: the game renders
// correctly at every commit, with converted and unconverted art side by side,
// and nothing has to be finished before anything else can start.
// ---------------------------------------------------------------------------
let ART_UNIT = 1;
function withArt(n, fn){
  const prev = ART_UNIT; ART_UNIT = n;
  try { return fn(); } finally { ART_UNIT = prev; }
}

const BUILD_TAG = 'build b37';   // shown on the title screen, to confirm which file is running

// ---------------------------------------------------------------------------
// PALETTE — deeper ramps than v1 so tiles can carry real shading. Roughly the
// Stardew / DQXI approach: every material gets shadow / base / light / accent
// rather than a flat fill plus noise.
// ---------------------------------------------------------------------------
const C = {
  // grass & ground
  grass1:'#2f5d33', grass2:'#3d7a3f', grass3:'#4f9a4c', grass4:'#69b85e', grass5:'#8ad275',
  dryGrass1:'#6b6330', dryGrass2:'#8a7d3c', dryGrass3:'#a89a4e',
  dirt1:'#4a3626', dirt2:'#63492f', dirt3:'#7d5d3c', dirt4:'#96744e',
  path1:'#6d5942', path2:'#8a7357', path3:'#a48d6d', path4:'#bda985',
  stone1:'#3a3a42', stone2:'#55555f', stone3:'#72727d', stone4:'#94949f', stone5:'#b6b6c0',
  sand1:'#8a7548', sand2:'#ab9463', sand3:'#c9b283',

  // water
  water1:'#17405e', water2:'#22608c', water3:'#2f85b8', water4:'#57b0dc', water5:'#a8e0f2',

  // wood & buildings
  wood1:'#3b2617', wood2:'#57381f', wood3:'#75502f', wood4:'#956b43', wood5:'#b58a5d',
  roof1:'#5a2128', roof2:'#7d3038', roof3:'#a24450', roof4:'#c25f68',
  roofB1:'#1e3a4a', roofB2:'#2d5468', roofB3:'#427389', roofB4:'#5f95ac',
  plaster1:'#8a7a62', plaster2:'#ad9c80', plaster3:'#cbbb9e', plaster4:'#e3d6bb',

  // metal & steam tech
  iron1:'#2b2b33', iron2:'#45454f', iron3:'#63636e', iron4:'#84848f',
  rust1:'#5a2a16', rust2:'#7d3e1f', rust3:'#a3552c', rust4:'#c47444',
  brass1:'#5e4517', brass2:'#8c6a22', brass3:'#bf9435', brass4:'#e2bc5e', brass5:'#f7dc9a',
  copper1:'#5c3118', copper2:'#8a4a24', copper3:'#b06a35', copper4:'#d18f53',

  // light & magic
  amber1:'#a35a0c', amber2:'#d98c1c', amber3:'#ffb43c', amber4:'#ffd98a', amber5:'#fff3cc',
  aether1:'#3a1f6b', aether2:'#5c34a3', aether3:'#8b52d4', aether4:'#b98cf0', aether5:'#e0ccff',

  // foliage
  // The Glimmervein: dry dark rock, and six gem colours that are the only
  // light in the place. They are the accent stones of the city one floor up,
  // still in the ground.
  cave1:'#100d16', cave2:'#1a1522', cave3:'#261f33', cave4:'#332a44', cave5:'#463a5c',
  leaf1:'#1d4426', leaf2:'#2b6431', leaf3:'#3d8740', leaf4:'#57a851', leaf5:'#7ec96a',
  bark1:'#33200f', bark2:'#4d3319', bark3:'#684626', bark4:'#8a6238',
  flowerR:'#d8434f', flowerY:'#f0cc4a', flowerB:'#5f8fd8', flowerP:'#a76cd8',
  flowerW:'#f2ecdc',

  // ui
  ink:'#120d16', ink2:'#1d1624', ink3:'#2c2235',
  ui1:'#3a2f46', ui2:'#5a4a68', uiGold:'#d9b45a', uiText:'#efe6d8', uiDim:'#8a7f98',
  hpRed:'#d0403c', hpDark:'#3d1512', mpBlue:'#3f7fd0',
  skin1:'#8a5a3c', skin2:'#c98f68', skin3:'#f0c39a', skin4:'#ffdcba',
  shadow:'rgba(16,10,20,0.30)', shadowHard:'rgba(16,10,20,0.45)',

  // --- IRONHAVEN. The GDD called the hub warm amber and brass; the city is
  // being rebuilt cold instead — grey stone and iron, with colour arriving
  // only as accent. These greys run cooler and flatter than the stone ramp
  // used out in the fields, so the two never read as the same material.
  cstone1:'#24262d', cstone2:'#363942', cstone3:'#4c505b', cstone4:'#666a76',
  cstone5:'#878c99', cstone6:'#a8adba',
  // the crater, top down: each ring further down loses light
  pit1:'#1a1620', pit2:'#141119', pit3:'#0f0d14', pit4:'#0a080e', pit5:'#050409',

  // --- THE IRON SCARP: bare rock, warmer and browner than the city's greys
  crag1:'#3a352e', crag2:'#554d42', crag3:'#736a5b', crag4:'#948a77', crag5:'#b8ad96',
  pine1:'#16301f', pine2:'#20462c', pine3:'#2d6038', pine4:'#3f7d47',
  // --- THE RIVET SHOALS
  shore1:'#8a7548', shore2:'#b09a68', shore3:'#cfba8c', shore4:'#e8d8ae',
  wet1:'#6b5c3c', wet2:'#8a7852', foam:'#e8f4f8'
};

// The six accent stones, keyed to the six hatchlings. Everything coloured in
// the city pulls from this one table — inlaid paving, awnings, lamp glass,
// aethite outcrops — so the accents always agree with the dragons even if the
// dragon palettes are later retuned.
const ACCENTS = [
  { id:'ember',  d:'#5e1e0e', a:'#8f2c16', b:'#c8452b', c:'#ff8a4c' },
  { id:'frost',  d:'#14344c', a:'#1f5578', b:'#3d86b8', c:'#8fd6ff' },
  { id:'volt',   d:'#4e3b0c', a:'#8a6a12', b:'#c9a81e', c:'#ffe86a' },
  { id:'verd',   d:'#1a3a1e', a:'#2c5e30', b:'#4a8f45', c:'#8fd07a' },
  { id:'void',   d:'#2a1740', a:'#452a68', b:'#6b3fa8', c:'#b98cf0' },
  { id:'lumin',  d:'#4a4536', a:'#7d7660', b:'#b8ae8a', c:'#fff3cc' }
];
// Deterministic accent for a tile, so a given stone is the same colour every
// time the area is rebuilt and the scatter still looks hand-placed.
function accentAt(x,y){ return ACCENTS[(hash2(x*13+5, y*7+3)*ACCENTS.length)|0]; }

// ---------------------------------------------------------------------------
// TILE TYPES
// ---------------------------------------------------------------------------
const T = {
  VOID:0, GRASS:1, GRASS_TUFT:2, FLOWERS:3, DRY:4, DIRT:5, PATH:6, GRAVEL:7,
  WATER:8, SHALLOW:9, STONE:10, ROCK:11, TREE:12, BUSH:13, STUMP:14,
  FENCE:15, WALL:16, WALL_TOP:17, FLOOR_WOOD:18, RUG:19, TABLE:20, BED:21,
  HEARTH:22, SHELF:23, DOOR:24, CRATE:25, BARREL:26, PIPE:27, LAMP:28,
  SIGN:29, GATE:30, RAMPART:31, BANNER:32, PLANTER:33, WELL:34, CART:35,
  // Footprint of an exterior building: blocks movement but draws nothing of its
  // own, because drawBuilding() has already painted the whole structure.
  BUILDING:36,
  // --- IRONHAVEN. PIT is the crater footprint: solid, and like BUILDING it
  // draws nothing per-tile, because drawPit() paints the whole crater in one
  // pass. Tile-by-tile it could only ever be a ring of squares.
  PIT:37, RAILING:38, COBBLE:39, INLAY:40, IRONPLATE:41, STALL:42,
  CRYSTAL:43, BRAZIER:44, VENT:45, PILLAR:46, GEARWHEEL:47, BENCH:48,
  // --- BEYOND THE WALLS: the three outer zones
  CLIFF:49, SCREE:50, ORE:51, PINE:52,          // the Iron Scarp
  SAND:53, WETSAND:54, SURF:55, DUNEGRASS:56,   // the Rivet Shoals
  PALM:57, DRIFTWOOD:58, WRECK:59,
  TALLGRASS:60, REEDS:61, MENHIR:62, PYLON:63,  // the Verge
  SEAL:64,                                      // an Aethite lock, barring a way
  LIFT:65, LIFTCAGE:66,                         // the Cogway lift down into the crater
  CAVEFLOOR:67, GEMCLUSTER:68, GEMVEIN:69,      // the Glimmervein, below the Undercroft
  FLOWSTONE:70, CAVEWALL:71,
  NODE:72                                       // a gathering node, any zone
};
// which tiles block movement
const SOLID = {};
[T.VOID,T.WATER,T.ROCK,T.TREE,T.STUMP,T.FENCE,T.WALL,T.WALL_TOP,T.TABLE,T.BED,
 T.HEARTH,T.SHELF,T.CRATE,T.BARREL,T.PIPE,T.LAMP,T.SIGN,T.RAMPART,T.PLANTER,
 T.WELL,T.CART,T.GATE,T.BUILDING,
 T.PIT,T.RAILING,T.STALL,T.CRYSTAL,T.BRAZIER,T.PILLAR,T.GEARWHEEL,T.BENCH,
 T.CLIFF,T.ORE,T.PINE,T.PALM,T.DRIFTWOOD,T.WRECK,T.MENHIR,T.PYLON,T.SEAL,T.LIFTCAGE,
 T.GEMCLUSTER,T.FLOWSTONE,T.CAVEWALL,T.NODE
].forEach(t=>SOLID[t]=1);
// tiles drawn tall (their top half overlaps the tile above)
const TALL = {};
[T.TREE,T.WALL,T.LAMP,T.SIGN,T.HEARTH,T.SHELF,T.RAMPART,T.GATE,T.WELL,
 T.RAILING,T.STALL,T.BRAZIER,T.PILLAR,T.GEARWHEEL,
 T.CLIFF,T.PINE,T.PALM,T.MENHIR,T.PYLON,T.WRECK,T.SEAL,T.LIFTCAGE,
 T.GEMCLUSTER,T.FLOWSTONE,T.CAVEWALL,T.NODE].forEach(t=>TALL[t]=1);

// ---------------------------------------------------------------------------
// UTILITIES
// ---------------------------------------------------------------------------
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const dist=(ax,ay,bx,by)=>Math.hypot(ax-bx,ay-by);
function makeRng(seed){let s=seed>>>0||1;return()=>{s^=s<<13;s>>>=0;s^=s>>17;s^=s<<5;s>>>=0;return s/4294967296;};}
function hash2(x,y){let h=x*374761393+y*668265263;h=(h^(h>>13))*1274126177;return ((h^(h>>16))>>>0)/4294967296;}
function angDiff(a,b){ let d=b-a; while(d>Math.PI)d-=Math.PI*2; while(d<-Math.PI)d+=Math.PI*2; return d; }
function shade(hex,mul){
  const p=s=>[parseInt(s.slice(1,3),16),parseInt(s.slice(3,5),16),parseInt(s.slice(5,7),16)];
  return '#'+p(hex).map(v=>clamp(Math.round(v*mul),0,255).toString(16).padStart(2,'0')).join('');
}
function mixHex(h1,h2,t){
  const p=s=>[parseInt(s.slice(1,3),16),parseInt(s.slice(3,5),16),parseInt(s.slice(5,7),16)];
  const A=p(h1),B=p(h2);
  return '#'+[0,1,2].map(i=>Math.round(lerp(A[i],B[i],t)).toString(16).padStart(2,'0')).join('');
}

// ---------------------------------------------------------------------------
// AUDIO — procedural, no assets (GDD §17)
// ---------------------------------------------------------------------------
const Sfx = (()=>{
  let ctx=null, master=null, muted=false;
  function ensure(){
    if(ctx) return ctx;
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return null;
    ctx=new AC(); master=ctx.createGain(); master.gain.value=0.24; master.connect(ctx.destination);
    return ctx;
  }
  function tone(type,f0,f1,dur,vol,delay){
    const c=ensure(); if(!c||muted) return;
    const t=c.currentTime+(delay||0);
    const o=c.createOscillator(), g=c.createGain();
    o.type=type; o.frequency.setValueAtTime(f0,t);
    if(f1!==f0) o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(vol,t+0.006);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t+dur+0.02);
  }
  function noise(dur,vol,f0,f1,q){
    const c=ensure(); if(!c||muted) return;
    const t=c.currentTime, n=Math.max(1,Math.floor(c.sampleRate*dur));
    const buf=c.createBuffer(1,n,c.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<n;i++) d[i]=Math.random()*2-1;
    const src=c.createBufferSource(); src.buffer=buf;
    // NOTE: Q is a read-only AudioParam. Assigning to it directly throws in
    // strict mode ("Cannot set property Q ... which has only a getter").
    const bp=c.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=q||0.9;
    bp.frequency.setValueAtTime(f0,t); bp.frequency.exponentialRampToValueAtTime(f1,t+dur);
    const g=c.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    src.connect(bp); bp.connect(g); g.connect(master); src.start(t); src.stop(t+dur);
  }
  // The music runs on its own bus off the same master, so M mutes both and
  // the score can be balanced against the effects without touching either.
  let musicBus=null;
  function bus(){
    const c=ensure(); if(!c) return null;
    if(!musicBus){ musicBus=c.createGain(); musicBus.gain.value=0.55; musicBus.connect(master); }
    return musicBus;
  }
  // LEVELS. These were written one at a time over a long stretch and drifted
  // more than twenty decibels apart, so a crit or a quest fanfare landed at
  // several times the volume of the fight it interrupted. They are NOT all
  // the same now — a footstep should not be as loud as a detonation — but the
  // range is compressed to about twelve decibels, and the things that fire
  // often sit near the middle of it. tools/sfx_levels.js measures this
  // without an audio device; run it after touching anything here.
  return {
    ensure, bus,
    ctx(){ return ctx; },
    resume(){ const c=ensure(); if(c&&c.state==='suspended') c.resume(); },
    toggle(){ muted=!muted; if(master) master.gain.value=muted?0:0.24; return muted; },
    isMuted(){ return muted; },
    tone, noise,
    swing(i){ noise(0.08,0.12,2200-i*400,520,1.2); tone('square',300-i*40,150,0.06,0.075); },
    hit(){ noise(0.08,0.15,1300,240,0.8); tone('square',180,70,0.07,0.11); },
    crit(){ noise(0.13,0.13,2500,300,0.7); tone('square',430,0.10*0+110,0.13,0.10); tone('square',660,180,0.09,0.07,0.03); },
    dodge(){ noise(0.16,0.13,900,2400,1.6); },
    blink(){ tone('sine',900,1800,0.10,0.10); noise(0.12,0.07,2400,600,1.4); },
    cast(){ tone('triangle',420,900,0.14,0.10); },
    fire(){ noise(0.24,0.14,900,220,0.6); tone('sawtooth',260,80,0.20,0.10); },
    ice(){ tone('sine',1400,500,0.20,0.10); noise(0.16,0.08,3000,800,1.6); },
    bolt(){ tone('square',1600,380,0.10,0.12); noise(0.11,0.12,4000,900,1.8); },
    quake(){ noise(0.32,0.13,240,60,0.5); tone('sine',90,40,0.28,0.12); },
    gun(){ noise(0.07,0.15,2600,400,0.9); tone('square',520,110,0.06,0.085); },
    bow(){ noise(0.10,0.13,1800,600,1.3); tone('triangle',700,300,0.09,0.095); },
    rune(){ tone('square',660,990,0.07,0.115); },
    detonate(){ noise(0.26,0.14,1400,180,0.6); tone('sawtooth',300,70,0.22,0.10); },
    summon(){ [392,523,659].forEach((f,i)=>tone('triangle',f,f*1.5,0.16,0.078,i*0.06)); },
    stealth(){ tone('sine',600,180,0.24,0.115); noise(0.22,0.08,1400,300,1.1); },
    shield(){ tone('triangle',300,600,0.16,0.12); noise(0.10,0.06,900,300,1.0); },
    taunt(){ tone('sawtooth',180,320,0.22,0.12); },
    scan(){ tone('square',880,1320,0.18,0.10); tone('square',1320,880,0.12,0.08,0.16); },
    learn(){ [523,659,784,1046].forEach((f,i)=>tone('square',f,f,0.12,0.075,i*0.08)); },
    gauge(n){ tone('square',330+n*70,420+n*70,0.06,0.09); },
    empowered(){ tone('square',520,780,0.10,0.11); tone('square',780,1170,0.12,0.08,0.06); },
    chirp(){ tone('square',880+Math.random()*180,1300,0.06,0.085); tone('square',1300,1000,0.05,0.06,0.05); },
    breath(){ noise(0.28,0.13,700,180,0.7); tone('sawtooth',180,70,0.22,0.07); },
    hurt(){ tone('sawtooth',280,70,0.20,0.13); noise(0.11,0.07,700,160,0.7); },
    die(){ noise(0.30,0.14,900,120,0.6); tone('square',200,60,0.26,0.10); },
    pickup(){ tone('square',660,660,0.05,0.11); tone('square',880,880,0.09,0.10,0.05); },
    ui(){ tone('square',520,520,0.04,0.10); noise(0.045,0.055,1800,900,1.4); },
    confirm(){ tone('square',523,784,0.09,0.11); tone('square',784,1046,0.09,0.09,0.07); },
    talk(){ tone('square',440+Math.random()*120,520,0.045,0.085); },
    door(){ noise(0.30,0.11,420,120,0.6); tone('sine',160,90,0.24,0.09); },
    quest(){ [523,659,784,1046,1318].forEach((f,i)=>tone('square',f,f,0.14,0.068,i*0.09)); },
    step(){ noise(0.05,0.075,700,300,1.1); }
  };
})();

// ---------------------------------------------------------------------------
// CANVAS
// ---------------------------------------------------------------------------
const canvas = document.getElementById('game');
canvas.width = CW; canvas.height = CH_;
const ctx = canvas.getContext('2d', { alpha:false });
ctx.imageSmoothingEnabled = false;

// Re-applied at the top of every frame. Setting a canvas's .width resets both
// the transform and imageSmoothingEnabled, so neither can be set once and
// forgotten — and a buffer that loses its scale draws its whole area into a
// quarter of itself, which looks like an art bug rather than a state bug.
function artScale(c){
  c.setTransform(ART,0,0,ART,0,0);
  c.imageSmoothingEnabled = false;
}

// terrain is pre-rendered per area into an offscreen buffer
const terrainCv = document.createElement('canvas');
const tctx = terrainCv.getContext('2d');
// tall props draw above actors, into their own buffer
const overCv = document.createElement('canvas');
const octx = overCv.getContext('2d');

// ---------------------------------------------------------------------------
// GAME STATE
// ---------------------------------------------------------------------------
const ST = {
  TITLE:0, SELECT_CLASS:1, SELECT_DRAGON:2, STORY:3,
  PLAY:4, DIALOGUE:5, PAUSE:6, DEAD:7, JOURNAL:8
};

const G = {
  state: ST.TITLE,
  time: 0, playTime: 0,
  area: null, areaId: '',
  cam: {x:0, y:0},
  enemies: [], npcs: [], particles: [], floats: [], hitmarks: [],
  summons: [], runes: [], pickups: [], walls: [],
  shake: 0, hitlag: 0, flash: 0, fade: 0, fadeDir: 0, fadeThen: null,
  toast: '', toastT: 0,
  dialogue: null, dialogueLine: 0, dialogueChar: 0,
  quest: { state:'none', kills:0, need:10 },   // none → offered → active → done → complete
  selClass: 0, selDragon: 0, storyPage: 0, storyT: 0,
  target: null, targetT: 0,          // reticle lock
  // The codex records what you have FOUGHT, not what you have walked past —
  // set on first damage dealt. Learning a creature's ability is a second,
  // separate step and only the Savant can do it.
  seen: {},
  menuOwner: 0,                      // which player opened the TAB menu
  codexPage: 0, codexSel: 0, questSel: 0,
  assignFrom: null,                  // codex: which creature is being assigned
  remap: null,                       // options: the key-rebinding modal, or null
  godMode: false, godBuf: '',   // the 777 test switch, and the digits so far         // TAB menu: 0 = journal, 1 = codex, 2 = options

  // --- AETHITE
  // One pool does two jobs: it heals you, and it is the key to every lock in
  // the world. That is the whole design — spending it to survive a fight is
  // spending the thing that opens the next gate, and the pool only ever grows
  // at authored milestones, so progress is something you are given rather
  // than something you can grind toward.
  milestones: {},                    // which capacity grants have fired (shared)
  channel: null,                     // an in-progress channel into a lock
  liftRide: null,                    // an in-progress descent
  locks: {},                         // which Aethite locks have been opened
  visited: {},                       // areaId -> true, once you have set foot in it
  mapFloor: 0,                       // which floor the map page is showing
  nodesDone: {},                     // 'areaId:x,y' -> seconds until it grows back
  quests: {},                        // quest id -> { state, n, ... }
  towers: {},                        // areaId -> a placed Aethite collector
  marks: 0,                          // Aions. The field keeps its old name
                                     // so a save from before the rename still loads.
  inv: [],                           // everything you are carrying
  fitted: { head:null, wing:null, body:null },
  invSel: 0, dragSel: 0,
  easyAttack: false,                 // one-button rotation, off by default
  inputP1: 0,                        // options mockup: 0 = keyboard
  titleSel: 0, titleOpts: false, optSel: 0,
  nPlayers: 1, picks: [], pickWho: 0,

  rng: makeRng(1337),
  tips: [], tipT: 0
};

function toast(msg, dur){ G.toast = msg; G.toastT = dur || 2.8; }

// ---------------------------------------------------------------------------
// CRASH REPORTING
// A thrown error used to kill requestAnimationFrame outright, which showed up
// as a silent blank screen with no way to tell what happened. Now anything
// that throws is captured and painted on the canvas instead.
// ---------------------------------------------------------------------------
G.error = null;
function reportError(err, where){
  if(G.error) return;                       // keep the first one; it's the cause
  const msg = (err && (err.message || err.toString())) || String(err);
  const stack = (err && err.stack) ? err.stack.split('\n').slice(0,4) : [];
  G.error = { where, msg, stack };
  try{ console.error('[WILDFIRE] error in '+where+':', err); }catch(e){}
}
function guarded(where, fn){
  try{ return fn(); }
  catch(err){ reportError(err, where); }
}

// cross-fade between areas
function fadeTo(fn){
  if(G.fadeDir !== 0) return;
  G.fadeDir = 1; G.fadeThen = fn;
}
function updateFade(dt){
  if(G.fadeDir > 0){
    G.fade = Math.min(1, G.fade + dt*3.2);
    if(G.fade >= 1){ if(G.fadeThen) G.fadeThen(); G.fadeThen=null; G.fadeDir = -1; }
  } else if(G.fadeDir < 0){
    G.fade = Math.max(0, G.fade - dt*3.2);
    if(G.fade <= 0) G.fadeDir = 0;
  }
}
