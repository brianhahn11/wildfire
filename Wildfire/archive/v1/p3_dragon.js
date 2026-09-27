
// ============================================================================
// MUTATION SYSTEM (GDD §10) — 5 slots, freely swappable at the Refinery.
// Every mutation must do two things: change the dragon's sprite, and change a
// number you can feel. That pairing is the whole point of the system.
// ============================================================================

const MUTATIONS = [
  // --- Elemental Aspects -----------------------------------------------
  { id:'ember_core',   name:'Ember Core',      cat:'Elemental', el:'fire',
    desc:'Fire aspect. Dragon attacks burn for longer.',      vis:'Flame particle trail' },
  { id:'frost_shard',  name:'Frost Shard',     cat:'Elemental', el:'ice',
    desc:'Ice aspect. Dragon attacks slow enemies by 45%.',   vis:'Icy wing tips, frost breath' },
  { id:'storm_cell',   name:'Storm Cell',      cat:'Elemental', el:'lightning',
    desc:'Lightning aspect. Dragon hits chain to a 2nd enemy.', vis:'Crackling sparks along body' },
  { id:'void_fragment',name:'Void Fragment',   cat:'Elemental', el:'dark',
    desc:'Dark aspect. Dragon attacks heal you for 15%.',     vis:'Shadow wisps, darker palette' },

  // --- Physical Mutations ----------------------------------------------
  { id:'twin_heart',   name:'Twin Heart',      cat:'Physical',
    desc:'Dragon splits into TWINS. Each at 60% power.',      vis:'Two tiny dragons' },
  { id:'hydra_crest',  name:'Hydra Crest',     cat:'Physical',
    desc:'Second head. Ember Breath fires two cones.',        vis:'Two-headed sprite' },
  { id:'serpent_tail', name:'Serpent Tail',    cat:'Physical',
    desc:'Tail-swipe counter-attack when you take a hit.',    vis:'Forked tail' },
  { id:'wyrm_scale',   name:'Wyrm Scale',      cat:'Physical',
    desc:'+25 max HP, +10% defense. Dragon flies slower.',    vis:'Larger armored body' },
  { id:'fae_wings',    name:'Fae Wings',       cat:'Physical',
    desc:'Dragon flies 60% faster and keeps up in a fight.',  vis:'Oversized iridescent wings' },
  { id:'claw_gauntlets',name:'Claw Gauntlets', cat:'Physical',
    desc:'Dragon auto-claws enemies that come close.',        vis:'Oversized front claws' },

  // --- Stat Infusions ---------------------------------------------------
  { id:'power_crystal',   name:'Power Crystal',   cat:'Stat', desc:'+15% attack power.',        vis:'Red gem glow' },
  { id:'ward_crystal',    name:'Ward Crystal',    cat:'Stat', desc:'+10% defense.',             vis:'Blue gem glow' },
  { id:'haste_crystal',   name:'Haste Crystal',   cat:'Stat', desc:'+15% cooldown reduction.',  vis:'Yellow gem glow' },
  { id:'vitality_crystal',name:'Vitality Crystal',cat:'Stat', desc:'+30 max HP.',               vis:'Green gem glow' },
  { id:'resonance_crystal',name:'Resonance Crystal',cat:'Stat',desc:'+25% dragon ability damage.',vis:'Violet gem glow' },

  // --- Accessories -------------------------------------------------------
  { id:'tiny_goggles',   name:'Tiny Goggles',   cat:'Accessory', desc:'+12% critical hit chance.', vis:'Goggles on its head' },
  { id:'clockwork_scarf',name:'Clockwork Scarf',cat:'Accessory', desc:'+8% movement speed.',       vis:'Tiny fluttering scarf' },
  { id:'mini_shield',    name:'Mini Shield',    cat:'Accessory', desc:'Dragon blocks one hit every 12s.', vis:'Wee shield strapped on' },
  { id:'bell_collar',    name:'Bell Collar',    cat:'Accessory', desc:'+40% dragon bond gain.',    vis:'Tiny jingling bell' }
];
const MUT_BY_ID = {}; for(const m of MUTATIONS) MUT_BY_ID[m.id]=m;

const SLOTS = 5;

// Element display colours — the dragon's palette blends these
const EL_COL = {
  fire:     { a:'#e8562a', b:'#ffa43c', c:'#ffd98a', name:'Fire' },
  ice:      { a:'#3f8fd0', b:'#7fd0f0', c:'#d8f4ff', name:'Ice' },
  lightning:{ a:'#c9a41f', b:'#ffe14a', c:'#fffbc0', name:'Lightning' },
  dark:     { a:'#4b2a6b', b:'#8b52c4', c:'#c9a2ff', name:'Dark' }
};

// Dual-element names, per GDD's "Pyraling + Frost Shard = Steamdrake"
const DUAL_NAME = {
  'fire+ice':'Steamdrake', 'fire+lightning':'Cinderbolt', 'fire+dark':'Emberwraith',
  'ice+lightning':'Stormfrost', 'ice+dark':'Grimfrost', 'lightning+dark':'Voidspark'
};

// ---------------------------------------------------------------------------
// Aggregate every slotted mutation into one modifier bundle. Recomputed on
// every slot change, never mutated in place elsewhere.
// ---------------------------------------------------------------------------
function computeMods(){
  const m = {
    atkMul:1, defMul:1, cdrMul:1, hpBonus:0, critBonus:0, moveMul:1,
    dragonDmgMul:1, dragonCount:1, heads:1, dragonSpeedMul:1, bondMul:1,
    burnBonus:0, slowOnHit:0, chain:0, lifesteal:0,
    claws:false, tail:false, shield:false, bell:false, goggles:false,
    scarf:false, scale:false, wings:false, twins:false,
    elements:['fire'], ids:[]
  };
  for(const id of dragon.slots){
    if(!id) continue;
    m.ids.push(id);
    const mu = MUT_BY_ID[id]; if(!mu) continue;
    if(mu.el && !m.elements.includes(mu.el)) m.elements.push(mu.el);
    switch(id){
      case 'ember_core':      m.burnBonus += 2.0; break;
      case 'frost_shard':     m.slowOnHit = 0.45; break;
      case 'storm_cell':      m.chain = 1; break;
      case 'void_fragment':   m.lifesteal = 0.15; break;
      case 'twin_heart':      m.twins=true; m.dragonCount=2; m.dragonDmgMul*=0.6; break;
      case 'hydra_crest':     m.heads=2; break;
      case 'serpent_tail':    m.tail=true; break;
      case 'wyrm_scale':      m.scale=true; m.hpBonus+=25; m.defMul*=0.90; m.dragonSpeedMul*=0.75; break;
      case 'fae_wings':       m.wings=true; m.dragonSpeedMul*=1.60; break;
      case 'claw_gauntlets':  m.claws=true; break;
      case 'power_crystal':   m.atkMul*=1.15; break;
      case 'ward_crystal':    m.defMul*=0.90; break;
      case 'haste_crystal':   m.cdrMul*=0.85; break;
      case 'vitality_crystal':m.hpBonus+=30; break;
      case 'resonance_crystal':m.dragonDmgMul*=1.25; break;
      case 'tiny_goggles':    m.goggles=true; m.critBonus+=0.12; break;
      case 'clockwork_scarf': m.scarf=true; m.moveMul*=1.08; break;
      case 'mini_shield':     m.shield=true; break;
      case 'bell_collar':     m.bell=true; m.bondMul*=1.40; break;
    }
  }
  return m;
}

// Name the dragon's current form from its element mix
function dragonFormName(){
  const els = MODS.elements;
  if(els.length===1) return MODS.twins ? 'Twin Pyralings' : 'Pyraling';
  const pair = els.slice(0,2).sort((a,b)=>{
    const order=['fire','ice','lightning','dark']; return order.indexOf(a)-order.indexOf(b);
  }).join('+');
  const base = DUAL_NAME[pair] || 'Chimeradrake';
  return MODS.twins ? ('Twin '+base+'s') : base;
}

// ============================================================================
// THE PYRALING — 12x12 (14x14 with Wyrm Scale), orbital follow, idle bob.
// ============================================================================

const dragon = {
  x: 0, y: 0, vx: 0, vy: 0,
  bond: 12, bondXp: 0,
  breathCd: 0, clawCd: 0, shieldCd: 0, tailCd: 0,
  bob: 0, orbit: 0, flap: 0, chirpT: 3,
  slots: ['ember_core', null, null, null, null],
  // second body for Twin Heart
  x2: 0, y2: 0, orbit2: Math.PI
};
let MODS = null;   // assigned after dragon exists

function refreshMods(){
  MODS = computeMods();
  player.maxhp = player.baseHp + MODS.hpBonus;
  player.hp = Math.min(player.hp, player.maxhp);
}

function dragonAnchor(px,py,phase){
  // trails behind and to the side of the player, gently orbiting
  return { x: px + Math.cos(phase)*17, y: py - 11 + Math.sin(phase*1.3)*5 };
}

function updateDragon(dt){
  const spd = 3.4 * MODS.dragonSpeedMul;
  dragon.orbit  += dt * 0.9 * MODS.dragonSpeedMul;
  dragon.orbit2 += dt * 0.9 * MODS.dragonSpeedMul;
  dragon.bob    += dt * 4.6;
  dragon.flap   += dt * (MODS.wings ? 16 : 11);

  const a1 = dragonAnchor(player.x, player.y, dragon.orbit);
  dragon.x = lerp(dragon.x, a1.x, Math.min(1, dt*spd));
  dragon.y = lerp(dragon.y, a1.y, Math.min(1, dt*spd));
  if(MODS.twins){
    const a2 = dragonAnchor(player.x, player.y, dragon.orbit2);
    dragon.x2 = lerp(dragon.x2, a2.x, Math.min(1, dt*spd));
    dragon.y2 = lerp(dragon.y2, a2.y, Math.min(1, dt*spd));
  }

  dragon.breathCd = Math.max(0, dragon.breathCd - dt);
  dragon.clawCd   = Math.max(0, dragon.clawCd - dt);
  dragon.shieldCd = Math.max(0, dragon.shieldCd - dt);
  dragon.tailCd   = Math.max(0, dragon.tailCd - dt);

  // idle chirps — GDD §17 wants the dragon to feel alive
  dragon.chirpT -= dt;
  if(dragon.chirpT<=0){ dragon.chirpT = 5 + Math.random()*7; if(G.state===ST.PLAY) Sfx.chirp(); }

  // Claw Gauntlets: the dragon fights on its own initiative
  if(MODS.claws && dragon.clawCd<=0){
    const bodies = dragonBodies();
    for(const b of bodies){
      const e = nearestEnemy(b.x, b.y, 26);
      if(e){
        dragon.clawCd = 1.5;
        dragonDamage(e, 7 * MODS.dragonDmgMul, b.x, b.y, 'claw');
        for(let i=0;i<6;i++) spark(e.x, e.y-4, elemColor(), 1);
        Sfx.chirp();
        break;
      }
    }
  }
}

// One entry per physical dragon body (two with Twin Heart)
function dragonBodies(){
  return MODS.twins
    ? [{x:dragon.x,y:dragon.y,i:0},{x:dragon.x2,y:dragon.y2,i:1}]
    : [{x:dragon.x,y:dragon.y,i:0}];
}

function elemColor(){
  const el = MODS.elements[MODS.elements.length-1];
  return EL_COL[el] ? EL_COL[el].b : PAL.amber;
}

// Damage from the dragon — routes every elemental mutation effect
function dragonDamage(e, amount, sx, sy, source){
  const crit = Math.random() < (0.05 + MODS.critBonus);
  let dmg = amount * (crit?1.8:1);
  hurtEnemy(e, dmg, sx, sy, crit, 0.6);

  if(MODS.elements.includes('fire')) applyBurn(e, 2.0 + MODS.burnBonus);
  if(MODS.slowOnHit) applySlow(e, MODS.slowOnHit, 2.4);
  if(MODS.lifesteal){
    const heal = Math.max(1, Math.round(dmg*MODS.lifesteal));
    player.hp = Math.min(player.maxhp, player.hp + heal);
    floatText(player.x, player.y-22, '+'+heal, '#7ddc6a');
  }
  if(MODS.chain){
    const near = nearestEnemy(e.x, e.y, 46, e);
    if(near){
      hurtEnemy(near, dmg*0.5, e.x, e.y, false, 0.3);
      G.hitmarks.push({ kind:'chain', ax:e.x, ay:e.y-6, bx:near.x, by:near.y-6, life:0.18, max:0.18 });
      if(MODS.elements.includes('fire')) applyBurn(near, 1.4);
    }
  }
  gainBond(0.35, source==='breath');
}

function gainBond(amount, announce){
  dragon.bondXp += amount * MODS.bondMul;
  while(dragon.bondXp >= 10){
    dragon.bondXp -= 10;
    dragon.bond = Math.min(100, dragon.bond+1);
    if(announce){ Sfx.bond(); floatText(dragon.x, dragon.y-14, 'BOND '+dragon.bond, '#ffd98a'); }
  }
}

// --- Ember Breath (dragon ability, Q) — bond 10 ------------------------------
function emberBreath(){
  if(dragon.breathCd>0) return false;
  dragon.breathCd = 5.0 * MODS.cdrMul;

  const bodies = dragonBodies();
  for(const b of bodies){
    // Hydra Crest gives a second head, so a second cone at a slight splay
    const cones = MODS.heads;
    for(let k=0;k<cones;k++){
      const splay = cones>1 ? (k===0 ? -0.34 : 0.34) : 0;
      const ang = Math.atan2(player.dy, player.dx) + splay;
      G.hitmarks.push({ kind:'breath', x:b.x, y:b.y, ang, life:0.45, max:0.45, col:elemColor() });
      const range = 58, spread = 0.52;
      for(const e of G.enemies){
        if(e.dead) continue;
        const d = dist(b.x,b.y,e.x,e.y);
        if(d > range) continue;
        const ea = Math.atan2(e.y-b.y, e.x-b.x);
        if(Math.abs(angDiff(ang, ea)) > spread) continue;
        dragonDamage(e, 16 * MODS.dragonDmgMul, b.x, b.y, 'breath');
      }
      // breath particles
      for(let i=0;i<20;i++){
        const a = ang + (Math.random()-0.5)*spread*1.7;
        const sp = 40 + Math.random()*90;
        G.particles.push({ x:b.x, y:b.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-8,
          life:0.24+Math.random()*0.30, max:0.55, kind:'flame', col:elemColor(), s:1 });
      }
    }
  }
  Sfx.breath();
  gainBond(1.2, true);
  return true;
}

// ---------------------------------------------------------------- dragon art
function px(c,col,x,y,w,h){ c.fillStyle=col; c.fillRect(Math.round(x),Math.round(y),w||1,h||1); }

function dragonPalette(){
  // Base Pyraling is fire. A second element blends its colours in.
  const els = MODS.elements;
  const base = EL_COL[els[0]];
  if(els.length===1) return { a:base.a, b:base.b, c:base.c, belly:'#ffd07a' };
  const add = EL_COL[els[1]];
  const mix=(h1,h2)=>{
    const p=s=>[parseInt(s.slice(1,3),16),parseInt(s.slice(3,5),16),parseInt(s.slice(5,7),16)];
    const A=p(h1),B=p(h2);
    return '#'+[0,1,2].map(i=>Math.round(A[i]*0.55+B[i]*0.45).toString(16).padStart(2,'0')).join('');
  };
  return { a:mix(base.a,add.a), b:mix(base.b,add.b), c:mix(base.c,add.c), belly:mix('#ffd07a',add.c) };
}

// Row-based sprite pieces, written facing RIGHT and mirrored for the other way.
// Each row is [dy, x0, width] relative to the dragon's body centre.
const DR_BODY = [[-4,-4,8],[-3,-5,10],[-2,-6,11],[-1,-6,11],[0,-6,11],[1,-5,9],[2,-4,7],[3,-3,5]];
// The head is thrust FORWARD at roughly shoulder height, not perched on a
// raised neck — that difference is what separates "dragon" from "deer".
const DR_HEAD = [[-8,4,5],[-7,3,7],[-6,3,8],[-5,4,7],[-4,5,4]];
const DR_NECK = [[-5,1,4],[-4,1,5]];

function rowsDraw(c, rows, X, Y, f, col, inset){
  for(const r of rows){
    const w = Math.max(1, r[2] - (inset?2:0));
    const x0 = r[1] + (inset?1:0);
    // mirroring: reflect the run across the body centre
    const sx = f>0 ? X + x0 : X - x0 - w;
    px(c, col, sx, Y + r[0], w, 1);
  }
}

function drawOneDragon(c, dx, dy, scale, phaseOffset){
  const P = dragonPalette();
  const big = MODS.scale;
  const bob = Math.round(Math.sin(dragon.bob + phaseOffset)*1.4);
  const X = Math.round(dx), Y = Math.round(dy) + bob;
  const faceRight = player.dx >= 0;
  const f = faceRight ? 1 : -1;      // horizontal mirror
  const S = big ? 1 : 0;             // Wyrm Scale grows the body by 1px each way

  // shadow on the ground beneath
  px(c,'rgba(20,12,8,.28)', X-5, Y+9, 10, 3);

  // --- wings (behind the body). Drawn scanline by scanline so they taper into
  // a membrane instead of reading as a floating block.
  const flap = Math.sin(dragon.flap + phaseOffset);
  const wy = Math.round(flap*2);
  // each row: [dy, distance behind the shoulder, width]
  // rows rise above the back so the wing is visible in silhouette
  const WING = MODS.wings
    ? [[-12,-1,3],[-11,-1,5],[-10,0,7],[-9,0,8],[-8,1,8],[-7,2,7],[-6,3,5],[-5,4,3]]
    : [[-9,-1,3],[-8,-1,5],[-7,0,6],[-6,1,5],[-5,2,4]];
  const wingA = MODS.wings ? '#b07be0' : P.a;
  const wingB = MODS.wings ? '#d9a8ff' : P.b;
  const wingC = MODS.wings ? '#f0d4ff' : P.c;
  for(const r of WING){
    // f>0 means facing right, so the wing sweeps out to the left
    const wx = f>0 ? X - r[1] - r[2] : X + r[1];
    px(c, wingA, wx, Y + r[0] + wy, r[2], 1);
  }
  for(const r of WING){
    if(r[2] < 3) continue;
    const wx = f>0 ? X - r[1] - r[2] + 1 : X + r[1] + 1;
    px(c, wingB, wx, Y + r[0] + wy, r[2]-2, 1);
  }
  // membrane highlight catching the light
  const hl = WING[Math.floor(WING.length/2)];
  px(c, wingC, f>0 ? X-hl[1]-hl[2]+1 : X+hl[1]+1, Y+hl[0]+wy, 2, 1);
  if(MODS.wings){
    // iridescent sheen along the leading edge
    const lead = WING[1];
    px(c,'#f7e8ff', f>0 ? X-lead[1]-lead[2] : X+lead[1], Y+lead[0]+wy, 2, 1);
  }
  // Frost Shard rimes the wing tips
  if(MODS.elements.includes('ice')){
    const tip = WING[MODS.wings ? 4 : 2];
    px(c,'#d8f4ff', f>0 ? X-tip[1]-tip[2] : X+tip[1]+tip[2]-2, Y+tip[0]+wy, 2, 2);
  }

  // --- tail, sweeping back and curling up (Serpent Tail forks it)
  const tailRows = [[1,-8,3],[0,-10,3],[-1,-11,2],[-2,-12,2]];
  for(const r of tailRows) px(c,P.a, f>0 ? X+r[1] : X-r[1]-r[2], Y+r[0], r[2], 1);
  if(MODS.tail){
    px(c,P.b, f>0 ? X-14 : X+12, Y-4, 2, 2);          // upper fork
    px(c,P.b, f>0 ? X-14 : X+12, Y-1, 2, 2);          // lower fork
    px(c,P.c, f>0 ? X-15 : X+13, Y-4, 1, 1);
    px(c,P.c, f>0 ? X-15 : X+13, Y,   1, 1);
  } else {
    px(c,P.c, f>0 ? X-13 : X+11, Y-4, 2, 3);          // single spade tip
  }

  // --- body: chunky and low, wider than it is tall
  rowsDraw(c, DR_BODY, X, Y+S, f, P.a);
  rowsDraw(c, DR_BODY, X, Y+S, f, P.b, true);
  px(c,P.belly, X-3, Y+1+S, 6, 3);                     // pale underside
  if(MODS.scale){                                      // armoured plating ridges
    px(c,P.a, X-5, Y-1+S, 10, 1);
    px(c,P.a, X-4, Y+2+S, 8, 1);
  }
  // dorsal spines, rear half of the back only — keeping them away from the
  // neck so they don't read as a second pair of horns
  for(let i=0;i<2;i++)
    px(c,P.c, f>0 ? X-5+i*3 : X+3-i*3, Y-5, 2, 1);

  // --- stubby legs / claws
  if(MODS.claws){
    px(c,P.a, f>0 ? X+2 : X-5, Y+3, 4, 5);
    px(c,'#f4e4c0', f>0 ? X+4 : X-6, Y+6, 3, 2);       // oversized front claws
    px(c,'#f4e4c0', f>0 ? X+4 : X-6, Y+3, 2, 1);
    px(c,P.a, f>0 ? X-4 : X+1, Y+4, 3, 4);
  } else {
    px(c,P.a, X-3, Y+4, 3, 4);
    px(c,P.a, X+1, Y+4, 3, 4);
    px(c,P.c, X-3, Y+7, 3, 1);
    px(c,P.c, X+1, Y+7, 3, 1);
  }

  // --- head(s), carried forward on a short neck. Hydra Crest adds a second.
  const heads = MODS.heads;
  for(let hIdx=0; hIdx<heads; hIdx++){
    // with Hydra Crest the second head sits lower and a little further back
    const hoy = heads>1 ? (hIdx===0 ? -3 : 2) : 0;
    const hox = heads>1 ? (hIdx===0 ? 0 : -3) : 0;
    const HX = X + (f>0 ? hox : -hox);
    const HY = Y + hoy;
    const L = (dxp)=> f>0 ? HX+dxp : HX-dxp;   // mirror a single x offset

    rowsDraw(c, DR_NECK, HX, HY, f, P.a);
    rowsDraw(c, DR_HEAD, HX, HY, f, P.a);
    rowsDraw(c, DR_HEAD, HX, HY, f, P.b, true);
    // blunt snout + nostril
    px(c,P.a, L(f>0?10:-11), HY-6, 2, 2);
    px(c,P.c, L(f>0?10:-11), HY-6, 1, 1);
    px(c,'#2a1520', L(f>0?11:-11), HY-5, 1, 1);
    // eye with a catchlight so it reads as alive
    px(c,'#2a1520', L(f>0?6:-7), HY-7, 2, 2);
    px(c,'#ffffff', L(f>0?6:-7), HY-7, 1, 1);
    // one small swept-back horn, hugging the skull
    px(c,P.c, L(f>0?4:-5), HY-10, 2, 2);
    px(c,P.c, L(f>0?3:-4), HY-9,  2, 1);
    // jaw line
    px(c,P.a, L(f>0?5:-8), HY-4, 5, 1);

    if(MODS.goggles && hIdx===0){
      px(c,'#4a3a2a', L(f>0?3:-10), HY-8, 7, 3);
      px(c,'#8fd6ff', L(f>0?6:-7),  HY-7, 2, 2);
      px(c,'#c8a13c', L(f>0?3:-10), HY-8, 1, 3);
    }
  }

  // --- accessories
  if(MODS.scarf){
    // wrapped at the base of the neck, trailing behind
    px(c,'#c8452b', f>0 ? X+1 : X-5, Y-4, 5, 2);
    px(c,'#e06a48', f>0 ? X+1 : X-5, Y-4, 5, 1);
    const sw = Math.round(Math.sin(dragon.flap*0.7+phaseOffset)*2);
    px(c,'#a63520', f>0 ? X-6 : X+2, Y-3+sw, 5, 2);
    px(c,'#a63520', f>0 ? X-10 : X+5, Y-2+sw, 4, 2);
  }
  if(MODS.shield){
    const ready = dragon.shieldCd<=0;
    px(c, ready?'#9f9c96':'#5b5854', f>0 ? X-7 : X+4, Y-1, 4, 6);
    px(c, ready?'#c8a13c':'#775f1f', f>0 ? X-6 : X+5, Y, 2, 4);
    px(c, ready?'#e8c866':'#8a6a22', f>0 ? X-6 : X+5, Y, 2, 1);
  }
  if(MODS.bell){
    px(c,'#98771f', f>0 ? X+2 : X-4, Y-3, 3, 1);       // collar strap
    px(c,'#e8c866', f>0 ? X+2 : X-4, Y-2, 3, 3);
    px(c,'#fff0c0', f>0 ? X+2 : X-4, Y-2, 1, 1);
    px(c,'#98771f', f>0 ? X+2 : X-4, Y,   3, 1);
  }

  // --- elemental aura particles
  if(G.state===ST.PLAY){
    if(MODS.elements.includes('fire') && Math.random()<0.28)
      G.particles.push({x:X+(Math.random()-0.5)*8, y:Y+2, vx:(Math.random()-0.5)*8, vy:-14-Math.random()*10,
        life:0.3, max:0.42, kind:'flame', col:P.b, s:1});
    if(MODS.elements.includes('lightning') && Math.random()<0.20){
      const sx=X+(Math.random()-0.5)*10, sy=Y+(Math.random()-0.5)*10;
      px(c,'#fffbc0', sx, sy, 1, 2);
    }
    if(MODS.elements.includes('dark') && Math.random()<0.22)
      G.particles.push({x:X+(Math.random()-0.5)*10, y:Y+1, vx:(Math.random()-0.5)*6, vy:-6-Math.random()*8,
        life:0.44, max:0.6, kind:'wisp', col:'#8b52c4', s:1});
    if(MODS.elements.includes('ice') && Math.random()<0.16)
      G.particles.push({x:X+(Math.random()-0.5)*9, y:Y+3, vx:(Math.random()-0.5)*5, vy:10+Math.random()*10,
        life:0.4, max:0.5, kind:'frost', col:'#d8f4ff', s:1});
  }
}

function drawDragon(c){
  if(MODS.twins){
    drawOneDragon(c, dragon.x2, dragon.y2, 1, 2.1);
    drawOneDragon(c, dragon.x,  dragon.y,  1, 0);
  } else {
    drawOneDragon(c, dragon.x, dragon.y, 1, 0);
  }
}
