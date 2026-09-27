"use strict";
/* ============================================================================
   WILDFIRE — Vertical Slice Prototype
   Ironclad + Pyraling + Mutation System, Rustfields expedition room.
   Built to the GDD: 480x270 native, 16x16 tiles, 16x24 characters, 12x12 dragon.
   ========================================================================== */

// ------------------------------------------------------------------ constants
const VW = 480, VH = 270;                 // native resolution (GDD §3)
const TILE = 16;
const MAP_W = 40, MAP_H = 24;             // arena is larger than the screen
const WORLD_W = MAP_W * TILE, WORLD_H = MAP_H * TILE;

// Rustfields palette (GDD §6): golden grass, rust-orange metal, pale blue sky
const PAL = {
  grass:'#a8933f', grassD:'#8a7730', grassL:'#c6b155', grassDry:'#bfa64a',
  dirt:'#7a5c38', dirtD:'#62482b', dirtL:'#94734a',
  rust:'#a4502a', rustD:'#7a3a1d', rustL:'#c9713f',
  iron:'#6e6a63', ironD:'#4c4944', ironL:'#8f8b83',
  brass:'#c8a13c', brassD:'#98771f', brassL:'#e8c866',
  amber:'#ffb43c', amberL:'#ffe08a', amberD:'#c97d18',
  sky:'#9fc6d8', stone:'#7d7a74', stoneD:'#5b5854', stoneL:'#9f9c96',
  shadow:'rgba(20,12,8,.32)',
  hpRed:'#d8443c', hpDark:'#3a1614',
  ink:'#1a1218', ink2:'#2a1f2c'
};

const T = { GRASS:0, DRY:1, DIRT:2, GRAVEL:3, PLATE:4, RUBBLE:5, RIG:6, PIPE:7, CRATE:8 };
const SOLID = [0,0,0,0,0,1,1,1,1];   // rubble, rig, pipe, crate block movement

// ------------------------------------------------------------------ utilities
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const dist=(ax,ay,bx,by)=>Math.hypot(ax-bx,ay-by);
function makeRng(seed){let s=seed>>>0||1;return()=>{s^=s<<13;s>>>=0;s^=s>>17;s^=s<<5;s>>>=0;return s/4294967296;};}
function hash2(x,y){let h=x*374761393+y*668265263;h=(h^(h>>13))*1274126177;return ((h^(h>>16))>>>0)/4294967296;}
// shortest signed angular difference
function angDiff(a,b){ let d=b-a; while(d>Math.PI)d-=Math.PI*2; while(d<-Math.PI)d+=Math.PI*2; return d; }

// ------------------------------------------------------------------ audio
// Procedural only — no external assets. GDD §17: "pixel-crunch", mechanical,
// steam hisses for UI, tiny chirps for the dragon.
const Sfx = (()=>{
  let ctx=null, master=null, muted=false;
  function ensure(){
    if(ctx) return ctx;
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return null;
    ctx=new AC(); master=ctx.createGain(); master.gain.value=0.26; master.connect(ctx.destination);
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
    const bp=c.createBiquadFilter(); bp.type='bandpass'; bp.Q=q||0.9;
    bp.frequency.setValueAtTime(f0,t); bp.frequency.exponentialRampToValueAtTime(f1,t+dur);
    const g=c.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    src.connect(bp); bp.connect(g); g.connect(master); src.start(t); src.stop(t+dur);
  }
  return {
    ensure, resume(){ const c=ensure(); if(c&&c.state==='suspended') c.resume(); },
    toggle(){ muted=!muted; if(master) master.gain.value=muted?0:0.26; return muted; },
    isMuted(){ return muted; },
    swing(i){ noise(0.07,0.10,2200-i*400,500,1.2); tone('square',300-i*40,150,0.05,0.06); },
    hit(){ noise(0.09,0.17,1400,260,0.8); tone('square',180,70,0.08,0.13); },
    crit(){ noise(0.14,0.22,2600,300,0.7); tone('square',420,110,0.14,0.17); tone('square',640,180,0.10,0.10,0.03); },
    dodge(){ noise(0.16,0.09,900,2400,1.6); },
    cleave(){ noise(0.20,0.16,900,200,0.6); tone('sawtooth',260,80,0.18,0.12); },
    tempest(){ noise(0.42,0.18,1500,300,0.5); tone('sawtooth',200,60,0.40,0.12); },
    charge(){ noise(0.18,0.13,400,1500,1.1); tone('square',140,320,0.16,0.10); },
    quake(){ noise(0.34,0.22,240,60,0.5); tone('sine',90,40,0.30,0.20); },
    momentum(n){ tone('square',330+n*90,430+n*90,0.05,0.07); },
    empowered(){ tone('square',520,780,0.10,0.12); tone('square',780,1170,0.12,0.09,0.06); },
    chirp(){ tone('square',880+Math.random()*180,1300,0.05,0.07); tone('square',1300,1000,0.04,0.05,0.05); },
    breath(){ noise(0.30,0.14,700,180,0.7); tone('sawtooth',180,70,0.24,0.08); },
    burn(){ noise(0.10,0.05,600,200,0.8); },
    hurt(){ tone('sawtooth',280,70,0.20,0.19); noise(0.12,0.10,700,160,0.7); },
    die(){ noise(0.34,0.16,900,120,0.6); tone('square',200,60,0.30,0.12); },
    pickup(){ tone('square',660,660,0.05,0.12); tone('square',880,880,0.09,0.11,0.05); },
    ui(){ tone('square',520,520,0.03,0.09); noise(0.05,0.05,1800,900,1.4); },
    slot(){ tone('square',440,660,0.07,0.11); noise(0.09,0.07,1200,400,0.9); tone('square',880,880,0.08,0.08,0.07); },
    bond(){ [523,659,784].forEach((f,i)=>tone('square',f,f,0.11,0.11,i*0.07)); },
    wipe(){ [392,330,262,180].forEach((f,i)=>tone('sawtooth',f,f*0.9,0.28,0.16,i*0.15)); },
    clear(){ [523,659,784,1046].forEach((f,i)=>tone('square',f,f,0.16,0.13,i*0.10)); }
  };
})();

// ------------------------------------------------------------------ canvas
const canvas = document.getElementById('game');
canvas.width = VW; canvas.height = VH;
const ctx = canvas.getContext('2d', { alpha:false });
ctx.imageSmoothingEnabled = false;

const terrainCv = document.createElement('canvas');
terrainCv.width = WORLD_W; terrainCv.height = WORLD_H;
const tctx = terrainCv.getContext('2d'); tctx.imageSmoothingEnabled = false;

// ------------------------------------------------------------------ game state
const ST = { TITLE:0, PLAY:1, REFINERY:2, PAUSE:3, WIPE:4, CLEAR:5 };

const G = {
  state: ST.TITLE,
  time: 0, runTime: 0,
  wave: 1, maxWave: 4, waveT: 0, betweenWaves: 0,
  lives: 5,                    // GDD §19 Medium: shared pool of 5
  kills: 0, dmgDealt: 0, dmgTaken: 0,
  shake: 0, hitlag: 0, flash: 0,
  cam: { x:0, y:0 },
  map: null, props: [],
  enemies: [], particles: [], floats: [], pickups: [], hitmarks: [],
  dirty: true,
  refinerySel: 0, refineryTab: 0, refineryOpenedBy: '',
  toast: '', toastT: 0,
  rng: makeRng(7)
};

function toast(msg){ G.toast = msg; G.toastT = 2.6; }
