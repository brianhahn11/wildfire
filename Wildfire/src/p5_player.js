
// ============================================================================
// THE PLAYER — one controller, nine mechanics hanging off it.
// ============================================================================

// ============================================================================
// PLAYERS
//
// `player`, `cls` and `drg` are a CURSOR, not a singleton. Every system in
// this game — abilities, targeting, the reticle, the dragon, collision —
// already reads those three globals, and threading a player argument through
// all of it would have been a rewrite. Instead PLAYERS holds the real state
// and withPlayer() points the cursor at one of them for the duration of a
// call. Existing code keeps working unchanged and simply operates on whoever
// is current.
//
// The one hazard this creates is deferred work: a callback scheduled by P1
// and run later would execute against whoever the cursor happened to be
// pointing at. setDelayed() captures the owner and restores it — see there.
// ============================================================================
const PLAYERS = [];
let PC = 0;                       // index of the player the cursor is on

function withPlayer(p, fn){
  const sp=player, sc=cls, sd=drg, si=PC, sg=dragon;
  player = p; cls = p.cls; drg = p.drg; PC = p.idx;
  if(p.dragon) dragon = p.dragon;
  try { return fn(); }
  finally { player = sp; cls = sc; drg = sd; PC = si; dragon = sg; }
}
function eachPlayer(fn){ for(const p of PLAYERS) if(p.alive!==false) withPlayer(p, ()=>fn(p)); }
function otherPlayer(){ return PLAYERS.length>1 ? PLAYERS[1-PC] : null; }
function twoPlayer(){ return PLAYERS.length>1; }

const P_COL = [
  { id:'1P', main:'#d0403c', dark:'#5e1a18', lite:'#ff8a80' },
  { id:'2P', main:'#3f7fd0', dark:'#1a3560', lite:'#8ab8ff' }
];

// Two players on one keyboard: P1 on the left hand, P2 on the right. Every
// action each player has is named here rather than being read as a literal
// key anywhere else, so adding a pad later means adding a third map.
const KEYMAPS = [
  { up:'w', down:'s', left:'a', right:'d',
    ab:['arrowup','arrowleft','arrowdown','arrowright'],
    dodge:' ', dragon:['q','e'], burn:'r', act:'f' },
  { up:'i', down:'k', left:'j', right:'l',
    ab:['7','8','9','0'],
    dodge:'n', dragon:['u','o'], burn:'y', act:'h' }
];

// ---------------------------------------------------------------------------
// REBINDABLE CONTROLS
//
// KEYMAPS is MUTATED IN PLACE rather than replaced, because every player holds
// a direct reference to their own entry (p.keys = KEYMAPS[i]). Rebinding
// therefore takes effect on the very next frame with nothing to re-wire, and
// it lasts exactly until the page is reloaded — which is what was asked for.
// Nothing is written to storage.
// ---------------------------------------------------------------------------
const BINDINGS = [
  { id:'up',       label:'MOVE UP'     },
  { id:'left',     label:'MOVE LEFT'   },
  { id:'down',     label:'MOVE DOWN'   },
  { id:'right',    label:'MOVE RIGHT'  },
  { id:'dodge',    label:'DODGE'       },
  { id:'act',      label:'INTERACT'    },
  { id:'burn',     label:'BURN AETHITE'},
  { id:'ab.0',     label:'ABILITY 1'   },
  { id:'ab.1',     label:'ABILITY 2'   },
  { id:'ab.2',     label:'ABILITY 3'   },
  { id:'ab.3',     label:'ABILITY 4'   },
  { id:'dragon.0', label:'DRAGON 1'    },
  { id:'dragon.1', label:'DRAGON 2'    }
];
// Taken before anything can touch KEYMAPS, so "defaults" means the defaults
// and not whatever the last player left behind.
const KEYMAP_DEFAULTS = KEYMAPS.map(m => JSON.parse(JSON.stringify(m)));

function bindGet(map, id){
  const d = id.indexOf('.');
  return d<0 ? map[id] : map[id.slice(0,d)][+id.slice(d+1)];
}
function bindSet(map, id, k){
  const d = id.indexOf('.');
  if(d<0) map[id] = k; else map[id.slice(0,d)][+id.slice(d+1)] = k;
}
// A key this player already uses is SWAPPED, not duplicated: two actions on
// one key is a control scheme that silently does the wrong thing, and the
// player who did it has no way to see which binding they broke.
//
// A key the OTHER player holds is refused outright, but only in two-player —
// in one-player, P2's map is inert and refusing WASD because an absent second
// player nominally holds it would be nonsense.
function bindApply(pi, id, k){
  const map = KEYMAPS[pi], other = KEYMAPS[1-pi];
  if(typeof twoPlayer === 'function' && twoPlayer() && other &&
     BINDINGS.some(b => bindGet(other, b.id) === k)) return 'clash';
  const held = BINDINGS.find(b => b.id !== id && bindGet(map, b.id) === k);
  const was  = bindGet(map, id);
  if(held) bindSet(map, held.id, was);
  bindSet(map, id, k);
  return held ? held.label : 'ok';
}
function bindReset(pi){
  const d = KEYMAP_DEFAULTS[pi];
  for(const b of BINDINGS) bindSet(KEYMAPS[pi], b.id, bindGet(d, b.id));
}
// What to print on a key cap. The raw values are what a KeyboardEvent hands
// over, which is fine to compare against and unreadable to look at.
const KEY_NAMES = { ' ':'SPACE', arrowup:'UP', arrowleft:'LEFT',
  arrowdown:'DOWN', arrowright:'RIGHT', escape:'ESC', enter:'ENTER',
  backspace:'BKSP', tab:'TAB', shift:'SHIFT', control:'CTRL', alt:'ALT' };
function keyName(k){
  if(k === undefined || k === null) return '—';
  return KEY_NAMES[k] || (k.length===1 ? k.toUpperCase() : k.toUpperCase());
}

const PROTO_PLAYER = {
  clsId:'ironclad', dragonId:'pyraling',
  x:0, y:0, dx:0, dy:1, dir:0,
  inx:0, iny:1,                              // intent (last WASD heading)
  hp:100, maxhp:100, spd:60,
  anim:0, frame:0, moving:false, stepT:0,

  // universal movement abilities
  dodgeT:0, dodgeCd:0, dodgeDx:0, dodgeDy:0,
  // The Phantom's puddle. `melting` is a flag rather than just a positive
  // timer, because the move starts at t=0 and a `meltT>0` test would skip
  // the whole first frame of it.
  melting:false, meltT:0, meltOx:0, meltOy:0, meltNx:0, meltNy:0,

  iframe:0, hurtFlash:0,

  // ability system
  cds:[0,0,0,0], castT:0, castKind:-1,
  chargeT:0, chargeDx:0, chargeDy:0, chargeHits:null,
  spinT:0, spinPower:0, channelT:0,

  // ---- per-class mechanic state ----
  momentum:0, momTimer:0,                    // Ironclad
  aegis:0, bastion:false,                    // Bulwark
  level:1, xp:0,                             // see gainXp() in p7_actors
  runeTotal:0,                               // Runebreaker
  mode:0,                                    // Aethermancer  0 = Focus, 1 = Spread
  lastElement:'fire',
  tempo:0, lastTempoKind:'', tempoDecay:0,   // Reaver
  combatT:0,                                 // seconds since last hit taken
  // Aethite is per player: each Forgebound's own dragon holds their own
  // store, so burning yours never costs your partner theirs. Capacity grows
  // for both at the same shared milestones.
  aethite:0, aethiteMax:0, burning:false, burnT:0, burnCd:0,
  focus:0, killzone:false, kzRepeat:0,       // Longshot
  shadow:0, stealthT:0, stealthCd:0,         // Phantom
  codex:[], scanT:0, scanTarget:null,        // Savant
  buffs:{}                                   // generic timed buffs
};
// The cursor. Points at PLAYERS[n] once a roster exists; before that it is
// a lone object, which is what the single-player path and the tests use.
let player = Object.assign({}, PROTO_PLAYER);


let cls = CLASSES[0];      // class of the player the cursor is on
let drg = DRAGONS[0];      // dragon of the player the cursor is on

// Build the roster. Each player gets their own copy of everything the cursor
// will point at — including a private clone of the class definition, because
// the Savant WRITES to cls.abilities when it learns something, and two
// Savants sharing one object would share a loadout.
function makeRoster(picks){
  PLAYERS.length = 0;
  picks.forEach((pick,i)=>{
    const p = Object.assign({}, PROTO_PLAYER);
    p.idx = i;
    p.col = P_COL[i];
    p.cls = JSON.parse(JSON.stringify(CLASSES[pick.cls]));
    p.drg = DRAGONS[pick.drg];
    p.cds = [0,0,0,0];
    p.buffs = {}; p.codex = [];
    p.keys = KEYMAPS[i];
    p.down = false; p.downT = 0; p.reviveT = 0;
    // Parts live on the player, not on G: two players, two dragons, two
    // sets of bolt-ons. The bag they come out of is still shared.
    p.fitted = { head:null, wing:null, body:null };
    p.dragon = Object.assign({}, DRAGON_PROTO);
    p.dragon.orbit = i * Math.PI;      // so two hatchlings don't overlap
    PLAYERS.push(p);
  });
  // The cursor starts on P1, and `player` IS PLAYERS[0] from here on.
  //
  // `dragon` has to be moved with it. It was left pointing at the standalone
  // object it was declared with, so at the top level — outside any
  // withPlayer — `dragon` and PLAYERS[0].dragon were two different objects.
  // Everything the game does happens inside withPlayer, so the game never
  // noticed; anything reading the cursor from outside one got a phantom.
  restoreCursor();
  for(const p of PLAYERS) withPlayer(p, ()=>setupPlayer());
  restoreCursor();
}
function restoreCursor(){
  player = PLAYERS[0]; cls = player.cls; drg = player.drg; PC = 0;
  if(player.dragon) dragon = player.dragon;
}

function setupPlayer(classIdx, dragonIdx){
  // Called two ways: by makeRoster with no arguments, against a roster entry
  // the cursor is already on; and directly with indices by the old single
  // player path, which the tests still use.
  if(classIdx!==undefined){ cls = CLASSES[classIdx]; drg = DRAGONS[dragonIdx]; }
  if(player.cls) player.cls = cls;
  if(player.drg) player.drg = drg;
  player.clsId = cls.id;
  player.dragonId = drg.id;
  // Base values are kept separately so a body part's bonus can be recomputed
  // from scratch each time one is fitted or removed, rather than being added
  // and subtracted incrementally — which drifts.
  player.baseMaxhp = cls.hp; player.baseSpd = cls.spd;
  player.maxhp = cls.hp; player.hp = cls.hp;
  player.spd = cls.spd;
  player.cds = [0,0,0,0];
  player.momentum=0; player.aegis=0; player.runeTotal=0;
  player.level=1; player.xp=0;
  player.mode=0; player.tempo=0; player.lastTempoKind='';
  player.focus=0; player.shadow=0; player.stealthT=0; player.killzone=false;
  player.codex=[]; player.buffs={};
  player.dodgeT=0; player.melting=false; player.meltT=0; player.castT=0; player.inx=0; player.iny=1;
  player.chargeT=0; player.spinT=0; player.channelT=0;
  G.summons.length=0; G.runes.length=0;
  // The Savant keeps one tool of their own in slot 0 and fills the other
  // three with whatever they scan off creatures.
  //
  // That tool is SCAN, not the old Codex Strike. Scanning used to live on
  // SPACE, which left the Savant the only class in the game without a dodge;
  // and Codex Strike was a weak swipe whose only job was to apply the mark,
  // which is now what Scan does to anything already in the codex. One button,
  // two jobs, and neither of them costs the class its dodge.
  if(cls.id==='savant'){
    cls.abilities = [
      { name:'Scan', cd:0.7, cast:0.12, kind:'scan',
        desc:'New creature: learn it. Known creature: mark it Analyzed for +40% from everything.' },
      ...[1,2,3].map(()=>({ name:'— Empty —', cd:0, cast:0,
        desc:'Scan a new creature with UP to fill this slot.' }))
    ];
  }
}

// ---------------------------------------------------------------------------
// GAUGE ACCESS — the HUD reads these, so every class reports the same shape
// ---------------------------------------------------------------------------
function gaugeValue(){
  switch(cls.id){
    case 'ironclad':    return player.momentum / 5;
    case 'bulwark':     return player.aegis / 100;
    case 'runebreaker': return Math.min(1, player.runeTotal / 20);
    case 'aethermancer':return player.mode;
    case 'reaver':      return player.tempo / 6;
    case 'longshot':    return player.focus / 100;
    case 'phantom':     return player.shadow / 100;
    case 'eidolon':     return G.summons.length / 2;
    case 'savant':      return player.codex.length / 8;
  }
  return 0;
}
function gaugeText(){
  switch(cls.id){
    case 'ironclad':    return player.momentum>=5 ? 'EMPOWERED' : player.momentum+'/5';
    case 'bulwark':     return aegisTier()===2?'AEGIS':aegisTier()===1?'GUARDIAN':'SENTINEL';
    case 'runebreaker': return player.runeTotal+' RUNES';
    case 'aethermancer':return player.mode ? 'SPREAD' : 'FOCUS';
    case 'reaver':      return player.tempo+'/6';
    case 'longshot':    return Math.round(player.focus)+'%';
    case 'phantom':     return Math.round(player.shadow)+'%';
    case 'eidolon':     return G.summons.length+'/2';
    case 'savant':      return player.codex.length+' LEARNED';
  }
  return '';
}
function aegisTier(){ return player.aegis>=67 ? 2 : player.aegis>=34 ? 1 : 0; }
const isEmpowered = ()=> cls.id==='ironclad' && player.momentum>=5;

// buffs
function addBuff(k, dur){ player.buffs[k] = Math.max(player.buffs[k]||0, dur); }
function hasBuff(k){ return (player.buffs[k]||0) > 0; }

function attackPower(){
  let m = cls.atk * partEff('atk');
  // +4% a level. LEVEL_ATK lives with the rest of the levelling in p7_actors,
  // which loads after this file — fine, because this only runs at play time.
  m *= 1 + ((player.level||1)-1)*LEVEL_ATK;
  if(hasBuff('benediction')) m *= 1.25;
  if(cls.id==='phantom' && player.stealthT>0) m *= 1.5;
  if(cls.id==='savant') m *= 1 + player.codex.length*0.08;
  return m;
}

// ---------------------------------------------------------------------------
// MECHANIC TICK
// ---------------------------------------------------------------------------
function updateMechanic(dt){
  switch(cls.id){
    case 'ironclad': {
      if(player.momentum>0){
        player.momTimer -= dt;
        if(player.momTimer<=0){ player.momentum--; player.momTimer=1.4; }
      }
      break;
    }
    case 'bulwark': {
      // aggro-as-resource: every creature paying attention to you feeds the gauge
      let watchers = 0;
      for(const e of G.enemies){
        if(e.dead) continue;
        if(e.taunt>0) watchers += 1;
        else if(dist(e.x,e.y,player.x,player.y) < 46) watchers += 0.35;
      }
      // Bastion MULTIPLIES what the fight gives you; it does not generate on
      // its own. As a hold that distinction did not matter, because nobody
      // holds a key in an empty room. As a toggle it matters a lot: left on,
      // a flat bonus would fill the gauge by walking around.
      const fill = watchers * (player.bastion ? 11 : 7);
      player.aegis = clamp(player.aegis + (fill - 3.5)*dt, 0, 100);
      break;
    }
    case 'runebreaker': {
      player.runeTotal = G.runes.reduce((s,r)=>s+r.n, 0);
      for(let i=G.runes.length-1;i>=0;i--){
        const r=G.runes[i];
        r.life -= dt;
        if(r.life<=0 || !r.e || r.e.dead) G.runes.splice(i,1);
      }
      break;
    }
    case 'reaver': {
      if(player.tempo>0){
        player.tempoDecay -= dt;
        if(player.tempoDecay<=0){ player.tempo--; player.tempoDecay=3.0; }
      }
      break;
    }
    case 'longshot': {
      // standing still tightens the crosshair; any movement dumps it
      const rate = player.killzone ? 132 : 44;
      if(player.moving) player.focus = 0;
      else player.focus = clamp(player.focus + rate*dt, 0, 100);
      break;
    }
    case 'phantom': {
      if(player.stealthT>0){
        player.stealthT -= dt;
        player.shadow = clamp(player.shadow + 5*dt, 0, 100);
        if(player.stealthT<=0) toast('REVEALED');
      }
      player.stealthCd = Math.max(0, player.stealthCd-dt);
      break;
    }
    case 'eidolon': break;    // summon count is the gauge
    case 'savant': {
      player.scanT = Math.max(0, player.scanT - dt);
      break;
    }
  }
  // generic buffs
  for(const k in player.buffs){
    player.buffs[k] -= dt;
    if(player.buffs[k]<=0) delete player.buffs[k];
  }
}

// mechanic hook: a hit landed
function onHitLanded(e, dmg, kind){
  switch(cls.id){
    case 'ironclad': {
      const before=player.momentum;
      player.momentum=Math.min(5,player.momentum+1); player.momTimer=4.0;
      if(player.momentum!==before){
        Sfx.gauge(player.momentum);
        if(player.momentum===5){ Sfx.empowered(); floatText(player.x,player.y-34,'EMPOWERED',C.amber4); }
      }
      break;
    }
    case 'bulwark': player.aegis = clamp(player.aegis+3,0,100); break;
    case 'runebreaker': if(kind!=='detonate') inscribeRune(e,1); break;
    // Reaver Tempo is handled per *action* in bumpTempo(), not per hit — a
    // three-slash combo is one Blade action, so it builds rather than decays.
    case 'phantom': {
      const behind = isBehind(e);
      player.shadow = clamp(player.shadow + (behind?25:5), 0, 100);
      if(player.stealthT>0){ player.stealthT=0; }
      break;
    }
  }
}
// Reaver: one call per Blade or Gun *action*. Alternating builds, repeating drops.
function bumpTempo(kind, gain){
  if(cls.id!=='reaver') return;
  if(player.lastTempoKind === kind){
    player.tempo = Math.max(0, player.tempo-1);
  } else {
    player.tempo = Math.min(6, player.tempo + (gain||1));
    Sfx.gauge(player.tempo);
  }
  player.lastTempoKind = kind;
  player.tempoDecay = 3.0;
}

function onPlayerDamaged(){
  if(cls.id==='ironclad' && player.momentum>0){
    for(let i=0;i<6;i++) spark(player.x,player.y-12,C.dryGrass2,1);
    player.momentum=0;
  }
  // taking the hit is the main way the gauge fills, and Bastion is what
  // makes taking hits survivable enough to be a plan
  if(cls.id==='bulwark') player.aegis = clamp(player.aegis + (player.bastion?22:14), 0, 100);
  if(cls.id==='phantom'){ player.shadow = clamp(player.shadow-10,0,100); player.stealthT=0; }
  if(cls.id==='longshot') player.focus = 0;
}

function isBehind(e){
  // "behind" is relative to the direction the creature is facing
  const fx = e.facing||1;
  return (fx>0 && player.x < e.x) || (fx<0 && player.x > e.x);
}

// ---------------------------------------------------------------------------
// TARGETING
// Picks the nearest enemy roughly in front of you and marks it with a reticle.
// Ranged classes get a longer lock, and auto-aimed abilities prefer this target
// so what you see marked is what you actually hit.
// ---------------------------------------------------------------------------
// The mark only appears on something you could actually hit, so each class
// declares the reach of its longest ability.
function targetRange(){
  if(player.killzone) return 190;          // tripod sees a lot further
  return cls.lockRange || 80;
}

// Where an ability should fire. A marked target always wins over facing.
function aimAngle(){
  if(G.target && !G.target.dead)
    return Math.atan2((G.target.y - 4) - (player.y - 8), G.target.x - player.x);
  return Math.atan2(player.dy, player.dx);
}

// Killzone: WASD stops moving you and starts picking targets instead. Chooses
// the enemy best matching the direction pressed, measured from the current mark.
function cycleTarget(dx,dy){
  const from = G.target && !G.target.dead ? G.target : player;
  const aim = Math.atan2(dy,dx);
  let best=null, bestScore=Infinity;
  for(const e of G.enemies){
    if(e.dead || e===G.target) continue;
    if(dist(player.x,player.y,e.x,e.y) > targetRange()) continue;
    const off = Math.abs(angDiff(aim, Math.atan2(e.y-from.y, e.x-from.x)));
    if(off > 1.15) continue;                       // must be roughly that way
    const d = dist(from.x,from.y,e.x,e.y);
    const score = d * (1 + off*2);
    if(score < bestScore){ bestScore=score; best=e; }
  }
  if(best){ G.target=best; G.targetT=0; Sfx.ui(); return true; }
  return false;
}

function updateTarget(){
  // in Killzone the mark is yours to steer — don't snap it back automatically
  if(player.killzone){
    if(!G.target || G.target.dead || dist(player.x,player.y,G.target.x,G.target.y) > targetRange())
      G.target = nearestEnemy(player.x, player.y, targetRange());
    G.targetT = Math.min(1, (G.targetT||0) + 0.12);
    G.targetInReach = !!(G.target && dist(player.x,player.y,G.target.x,G.target.y)
                          <= (cls.primaryReach||34) + G.target.r + 4);
    return;
  }
  const maxD = targetRange();
  // Range is the only hard gate — anything you could actually hit is eligible,
  // and the character turns to face it. Your heading is a *preference*, not a
  // filter, so walking toward one of two creatures picks that one without ever
  // leaving you unable to mark something beside or behind you.
  // (Acquisition reads intent, never the aim: aiming follows the mark, so
  // scoring off the aim would trap the search on whatever is already marked.)
  const aim = Math.atan2(player.iny, player.inx);
  let best = null, bestScore = Infinity;
  for(const e of G.enemies){
    if(e.dead) continue;
    const d = dist(player.x, player.y, e.x, e.y);
    if(d > maxD) continue;
    const off = Math.abs(angDiff(aim, Math.atan2(e.y-player.y, e.x-player.x)));
    const score = d * (1 + off*0.55);
    if(score < bestScore){ bestScore = score; best = e; }
  }
  if(best !== G.target){ G.target = best; G.targetT = 0; }
  else G.targetT = Math.min(1, (G.targetT||0) + 0.12);
  // is the mark inside the reach of your primary right now? the reticle
  // renders hollow when it isn't, so "marked" never over-promises
  G.targetInReach = !!(best && dist(player.x,player.y,best.x,best.y)
                        <= (cls.primaryReach||34) + best.r + 4);
}
// abilities that lock on should use the marked enemy first
function lockTarget(maxD){
  if(G.target && !G.target.dead && dist(player.x,player.y,G.target.x,G.target.y) <= (maxD||targetRange()))
    return G.target;
  return nearestEnemy(player.x, player.y, maxD||targetRange());
}

// ---------------------------------------------------------------------------
// DODGE — and the two classes that replace it
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// THE PHANTOM'S DODGE
//
// Not a roll. The Phantom loses cohesion: the figure collapses straight down
// into a puddle, the puddle runs along the ground, and it stands back up
// somewhere else. Three beats rather than one, because the whole point is
// that the shape stops being a person for a moment.
//
// The player's real position slides with the puddle rather than teleporting
// at the end, so the camera tracks it, a partner can still see where you went,
// and the thing on screen is where you actually are. i-frames cover the whole
// move: there is no moment where you are a puddle and can still be stabbed.
//
// SLIDE_ONLY matters. The destination is probed the same way Rift Step probes
// its blink — outwards in small steps, stopping at the last standable point —
// so this can put you against a wall but never inside one, and never through
// one. A dodge that phases through geometry is a different ability and a much
// bigger design decision than "artistic flair".
// ---------------------------------------------------------------------------
const MELT = { collapse:0.15, slide:0.16, rise:0.15, reach:56 };
const MELT_DUR = MELT.collapse + MELT.slide + MELT.rise;

function meltDodge(){
  if(player.dodgeCd>0 || player.melting) return;
  let mx=0, my=0;
  const K = player.keys||KEYMAPS[0];
  if(keys[K.left]) mx-=1; if(keys[K.right]) mx+=1;
  if(keys[K.up])   my-=1; if(keys[K.down])  my+=1;
  if(!mx&&!my){ mx=player.inx; my=player.iny; }
  const l = Math.hypot(mx,my)||1; mx/=l; my/=l;

  const ox = player.x, oy = player.y;
  let best = 0;
  for(let d=6; d<=MELT.reach; d+=2){
    if(canStand(ox+mx*d, oy+my*d)) best = d; else break;
  }
  player.melting = true;
  player.meltT   = 0;
  player.meltOx  = ox;      player.meltOy  = oy;
  player.meltNx  = ox+mx*best; player.meltNy = oy+my*best;
  player.dodgeCd = 0.62;
  player.iframe  = Math.max(player.iframe, MELT_DUR + 0.06);
  Sfx.stealth();
  if(hasBuff('ghoststep')) player.stealthT = Math.max(player.stealthT, 1.0);
  for(let i=0;i<14;i++){
    const a = Math.random()*Math.PI*2;
    G.particles.push({ x:ox+Math.cos(a)*5, y:oy-6+Math.sin(a)*3,
      vx:Math.cos(a)*16, vy:-6-Math.random()*10,
      life:0.32, max:0.44, kind:'mote', col:cls.col.accentL, s:1 });
  }
}

// Where in the move we are, and how far along that beat. Shared by the update
// and the renderer so the sprite and the position can never disagree.
function meltPhase(){
  const t = player.meltT;
  if(t <= MELT.collapse) return { at:'collapse', f:t/MELT.collapse };
  if(t <= MELT.collapse+MELT.slide)
    return { at:'slide', f:(t-MELT.collapse)/MELT.slide };
  return { at:'rise', f:Math.min(1,(t-MELT.collapse-MELT.slide)/MELT.rise) };
}

function updateMelt(dt){
  player.meltT += dt;
  const ph = meltPhase();
  if(ph.at==='slide'){
    // ease out, so it arrives rather than stopping
    const e = 1-Math.pow(1-ph.f, 2.2);
    player.x = lerp(player.meltOx, player.meltNx, e);
    player.y = lerp(player.meltOy, player.meltNy, e);
    if(Math.random() < dt*50)
      G.particles.push({ x:player.x+(Math.random()-0.5)*10, y:player.y-1,
        vx:(Math.random()-0.5)*8, vy:-4, life:0.3, max:0.4,
        kind:'mote', col:cls.col.accent, s:1 });
  }
  if(player.meltT >= MELT_DUR){
    player.melting = false; player.meltT = 0;
    player.x = player.meltNx; player.y = player.meltNy;
    for(let i=0;i<10;i++){
      const a = Math.random()*Math.PI*2;
      G.particles.push({ x:player.x+Math.cos(a)*4, y:player.y-8,
        vx:Math.cos(a)*22, vy:Math.sin(a)*10-14,
        life:0.26, max:0.34, kind:'mote', col:cls.col.accentL, s:1 });
    }
    Sfx.blink();
  }
}

function dodgeAction(){
  if(cls.id==='aethermancer') return riftStep();
  if(cls.id==='phantom')      return meltDodge();
  // The Savant used to scan here, which left them the only class in the game
  // without a dodge. Scanning is slot 0 now — see the 'scan' arm in
  // useAbility — and SPACE does what SPACE does for everybody else.
  if(player.dodgeCd>0||player.dodgeT>0||player.chargeT>0||player.spinT>0) return;
  let mx=0,my=0;
  const K=player.keys||KEYMAPS[0];
  if(keys[K.left]) mx-=1; if(keys[K.right]) mx+=1;
  if(keys[K.up])   my-=1; if(keys[K.down])  my+=1;
  if(!mx&&!my){ mx=player.inx; my=player.iny; }   // heading, not aim
  const l=Math.hypot(mx,my)||1;
  player.dodgeDx=mx/l; player.dodgeDy=my/l;
  player.dodgeT=0.32; player.dodgeCd=0.58;
  player.iframe=Math.max(player.iframe,0.24);
  Sfx.dodge();
  if(hasBuff('ghoststep')) player.stealthT=Math.max(player.stealthT,1.0);
}

function riftStep(){
  if(player.dodgeCd>0) return;
  player.dodgeCd = 0.75;
  let mx=0,my=0;
  const K=player.keys||KEYMAPS[0];
  if(keys[K.left]) mx-=1; if(keys[K.right]) mx+=1;
  if(keys[K.up])   my-=1; if(keys[K.down])  my+=1;
  if(!mx&&!my){ mx=player.inx; my=player.iny; }   // heading, not aim
  const l=Math.hypot(mx,my)||1; mx/=l; my/=l;
  const ox=player.x, oy=player.y;
  // blink up to 40px, stopping short of anything solid
  let best=0;
  for(let d=6; d<=40; d+=2){
    if(canStand(ox+mx*d, oy+my*d)) best=d; else break;
  }
  player.x = ox+mx*best; player.y = oy+my*best;
  player.iframe = Math.max(player.iframe, 0.30);
  // an elemental echo detonates where you left
  G.hitmarks.push({ kind:'echo', x:ox, y:oy, life:0.5, max:0.5, el:player.lastElement });
  setDelayed(()=>{
    const col = player.lastElement==='ice' ? C.water4 : player.lastElement==='lightning' ? C.brass4 : C.amber3;
    resolveCircle(ox, oy, 22, 12*attackPower(), 40, null, 'echo');
    for(let i=0;i<14;i++) spark(ox, oy-6, col, 1.2);
    if(player.lastElement==='ice') for(const e of G.enemies) if(!e.dead && dist(e.x,e.y,ox,oy)<24) applySlow(e,0.5,2);
  }, 0.5);
  for(let i=0;i<10;i++) spark(player.x, player.y-8, C.aether4, 1.1);
  Sfx.blink();
}

function assimilate(target){
  if(player.scanT>0) return;
  const e = target || nearestEnemy(player.x, player.y, 90);
  if(!e){ toast('NO SUBJECT IN RANGE'); Sfx.ui(); return; }
  const learn = LEARNABLE[e.kind];
  if(!learn){ toast('NOTHING TO LEARN HERE'); Sfx.ui(); return; }
  if(player.codex.some(a=>a.name===learn.name)){ toast('ALREADY IN YOUR CODEX'); Sfx.ui(); return; }
  player.scanT = 1.0; player.scanTarget = e;
  Sfx.scan();
  setDelayed(()=>{
    if(!player.scanTarget || player.scanTarget.dead) { toast('SCAN LOST'); return; }
    // `kind` here is the CREATURE — it is what the codex page indexes by.
    // The ability's own kind has to ride along under another name, or
    // equipFromCodex below builds a slot whose kind is 'emberimp', which
    // matches no arm of the Savant dispatch and silently falls through to
    // the default one. Every ability equipped from the codex page has been
    // casting a poison nova.
    player.codex.push({ ...learn, kind:e.kind, akind:learn.kind, source:e.name });
    // fill the first empty ability slot
    // from slot 1: slot 0 is Scan itself and must not be overwritten by the
    // first thing you learn
    const slot = cls.abilities.findIndex((a,i)=>i>0 && a.name.indexOf('Empty')>=0);
    if(slot>=0){
      cls.abilities[slot] = { name:learn.name, cd:learn.cd, cast:0.14, desc:learn.desc,
                              kind:learn.kind, elem:learn.elem };
      toast('LEARNED: '+learn.name.toUpperCase()+' — SLOT '+(slot+1));
    } else {
      toast('LEARNED: '+learn.name.toUpperCase()+' (CODEX FULL)');
    }
    Sfx.learn();
    for(let i=0;i<20;i++) spark(player.x, player.y-12, C.brass4, 1.3);
  }, 1.0);
}

// Move the selected codex ability into one of the Savant's three free slots.
// Slot 0 is always Codex Strike: it is the only thing a Savant has at the
// start and the Analyzed mark it applies is what makes everything else worth
// using, so it is not reassignable.
function equipFromCodex(slot){
  if(cls.id!=='savant'){ toast('SAVANT ONLY'); Sfx.ui(); return; }
  const kind = CODEX_ORDER[G.codexSel];
  const entry = player.codex.find(a=>a.kind===kind);
  if(!entry){ toast('NOT LEARNED — SCAN A LIVE ONE'); Sfx.ui(); return; }

  // If it's already somewhere else, swap rather than duplicate: two slots
  // holding the same ability share no cooldown and read as a UI bug.
  const existing = cls.abilities.findIndex((a,i)=>i>0 && a.name===entry.name);
  const outgoing = cls.abilities[slot];
  if(existing>0 && existing!==slot) cls.abilities[existing] = outgoing;

  cls.abilities[slot] = { name:entry.name, cd:entry.cd, cast:0.14,
                          desc:entry.desc, elem:entry.elem,
                          kind:entry.akind || (LEARNABLE[entry.kind]||{}).kind };
  player.cds[slot] = 0;
  toast('EQUIPPED: '+entry.name.toUpperCase()+' \u2014 SLOT '+(slot+1));
  Sfx.learn();
}

// ---------------------------------------------------------------------------
// MOVEMENT
// ---------------------------------------------------------------------------
function walkableAt(px,py){
  const a=G.area;
  const cx=Math.floor(px/TILE), cy=Math.floor(py/TILE);
  if(cx<0||cy<0||cx>=a.w||cy>=a.h) return false;
  return !SOLID[a.map[cy*a.w+cx]];
}
// Body box is deliberately narrower than a tile (7px across, feet-anchored) so
// a one-tile doorway is actually passable with a little slop either side.
// canStand() against a specific area rather than the current one — loadArea
// needs to test footing in the map it is switching TO.
function canStandAt(a, px, py){
  const ok = (x,y) => {
    const cx=Math.floor(x/TILE), cy=Math.floor(y/TILE);
    if(cx<0||cy<0||cx>=a.w||cy>=a.h) return false;
    return !SOLID[a.map[cy*a.w+cx]];
  };
  return ok(px-3,py-1) && ok(px+3,py-1) && ok(px-3,py+5) && ok(px+3,py+5);
}

function canStand(px,py){
  return walkableAt(px-3,py-1) && walkableAt(px+3,py-1)
      && walkableAt(px-3,py+5) && walkableAt(px+3,py+5);
}
// The tether. With two players the viewport edge is a wall: you can walk
// right up to it and slide along it, but not through. No warning, no snap,
// no marker — the screen simply stops you, which needs no explaining and
// never yanks anybody anywhere.
//
// It has to be checked per axis and against where the camera WOULD end up,
// not where it is, or you get a frame of overshoot and a visible stutter as
// the camera chases and the wall pushes back.
const TETHER_MARGIN = 22;
// Doorways sit ON the map edge, and at a map edge the camera stops scrolling,
// so the tether wall lands INSIDE the level — a foot or two short of the exit
// tile. Two players could walk to the door and never through it. A doorway is
// therefore always reachable: the transition takes both of you anyway, so
// there is nothing for the wall to protect against here.
function nearExit(x, y){
  const a = G.area; if(!a || !a.exits) return false;
  for(const ex of a.exits)
    if(dist(x, y, ex.x*TILE+8, ex.y*TILE+8) < 34) return true;
  return false;
}
function tetherOk(nx, ny){
  if(PLAYERS.length<2) return true;
  const o = otherPlayer(); if(!o) return true;
  if(nearExit(nx, ny)) return true;
  // A move that brings you CLOSER is always allowed. Without this the tether
  // is a trap rather than a wall: anything that puts two players too far
  // apart — a mis-placed spawn, a blink, a lift — would freeze them both
  // solid with no way to recover.
  const was = dist(player.x, player.y, o.x, o.y);
  if(dist(nx, ny, o.x, o.y) < was) return true;
  const a = G.area;
  const fx = (nx+o.x)/2, fy = (ny+o.y)/2;
  const cx = clamp(fx-VW/2, 0, Math.max(0, a.w*TILE-VW));
  const cy = clamp(fy-VH/2, 0, Math.max(0, a.h*TILE-VH));
  for(const [px,py] of [[nx,ny],[o.x,o.y]]){
    if(px < cx+TETHER_MARGIN || px > cx+VW-TETHER_MARGIN) return false;
    if(py < cy+TETHER_MARGIN+16 || py > cy+VH-TETHER_MARGIN) return false;
  }
  return true;
}

function moveBy(ddx,ddy){
  if(canStand(player.x+ddx, player.y) && tetherOk(player.x+ddx, player.y)) player.x += ddx;
  if(canStand(player.x, player.y+ddy) && tetherOk(player.x, player.y+ddy)) player.y += ddy;
  player.x = clamp(player.x, 6, G.area.w*TILE-6);
  player.y = clamp(player.y, 8, G.area.h*TILE-6);
}
function setDir(mx,my){
  if(Math.abs(mx)>Math.abs(my)) player.dir = mx>0?3:2;
  else player.dir = my>0?0:1;
}

function updatePlayer(dt){
  for(let i=0;i<4;i++) player.cds[i]=Math.max(0,player.cds[i]-dt);
  player.dodgeCd=Math.max(0,player.dodgeCd-dt);
  player.iframe=Math.max(0,player.iframe-dt);
  player.hurtFlash=Math.max(0,player.hurtFlash-dt);
  player.castT=Math.max(0,player.castT-dt);

  // movement is WASD only — the arrow keys are abilities now
  let mx=0,my=0;
  const K=player.keys||KEYMAPS[0];
  if(keys[K.left])  mx-=1;
  if(keys[K.right]) mx+=1;
  if(keys[K.up])    my-=1;
  if(keys[K.down])  my+=1;
  if(mx||my){ const l=Math.hypot(mx,my); mx/=l; my/=l; }

  // Bulwark holds Bastion Stance while ability 1 is held
  // Bastion is a toggle now (see useAbility), so nothing here reads the key.
  // It only gets cleared when the class cannot hold it.
  if(cls.id!=='bulwark') player.bastion = false;

  // --- Killzone: rooted, WASD steers the mark instead of the feet
  if(player.killzone){
    player.moving = false;
    player.anim += dt*2.2;
    player.kzRepeat = Math.max(0, player.kzRepeat - dt);
    if(player.kzRepeat<=0 && (mx||my)){
      if(cycleTarget(mx,my)) player.kzRepeat = 0.20;
      else player.kzRepeat = 0.12;
    }
    player.frame = 0;
    updateTarget();
    faceTarget();      // always face whatever is marked
    updateMechanic(dt);
    return;
  }

  if(player.chargeT>0){
    player.chargeT -= dt;
    moveBy(player.chargeDx*280*dt, player.chargeDy*280*dt);
    const hits = resolveCircle(player.x, player.y, 17, 15*attackPower(), 90, player.chargeHits, 'charge');
    if(hits && cls.id==='ironclad'){ player.momentum=Math.min(5,player.momentum+2); player.momTimer=4; }
    for(let i=0;i<2;i++) spark(player.x-player.chargeDx*8, player.y+4, C.path3, 1);
  }
  else if(player.spinT>0){
    player.spinT -= dt;
    if(mx||my){ player.inx=mx; player.iny=my; }
    moveBy(mx*player.spd*0.45*dt, my*player.spd*0.45*dt);
    if(Math.random() < dt*26){
      const dmg=(9+player.spinPower*7)*attackPower();
      if(resolveCircle(player.x,player.y,32,dmg,55,null,'spin')) G.shake=Math.max(G.shake,2);
    }
    for(let i=0;i<2;i++){
      const a=Math.random()*Math.PI*2;
      G.particles.push({x:player.x+Math.cos(a)*30,y:player.y+Math.sin(a)*30-6,
        vx:Math.cos(a)*30,vy:Math.sin(a)*30,life:0.16,max:0.22,kind:'spark',col:cls.col.accentL,s:1});
    }
  }
  else if(player.melting){
    // a puddle does not take direction; the move plays out on its own
    updateMelt(dt);
    player.moving = false;
  }
  else if(player.dodgeT>0){
    player.dodgeT -= dt;
    const t = 1-(player.dodgeT/0.32);
    moveBy(player.dodgeDx*185*(1-t*0.55)*dt, player.dodgeDy*185*(1-t*0.55)*dt);
  }
  else if(player.channelT>0){
    player.channelT -= dt;   // Killzone / Bastion: rooted
    player.moving=false;
  }
  else {
    const slow = player.castT>0 ? 0.3
               : player.bastion ? 0.5
               : player.scanT>0 ? 0.25 : 1;
    let spd = player.spd * slow;
    if(hasBuff('voltsurge')) spd *= 1.4;
    if(cls.id==='reaver') spd *= 1 + player.tempo*0.03;
    if(player.stealthT>0) spd *= 1.3;
    if(mx||my){
      player.inx=mx; player.iny=my;          // where you're heading
      moveBy(mx*spd*dt, my*spd*dt);
      player.moving=true; player.anim+=dt*8.5;
      player.stepT -= dt;
      if(player.stepT<=0){ player.stepT=0.30; Sfx.step(); }
    } else { player.moving=false; player.anim+=dt*2.4; }
  }
  // EIGHT frames walking, four breathing.
  //
  // The walk was four frames of which two were identical, so it was really
  // three poses. Eight gives a contact, a low point, a pass and a high point
  // for each leg, which is what a walk cycle is.
  //
  // Idle had no art at all: stop moving and the character froze. It is on
  // screen every second of the game and it was the most visible gap in it.
  player.frame  = Math.floor(player.anim)%8;
  player.idleFr = Math.floor(player.anim*0.9)%4;

  updateTarget();
  faceTarget();
  updateMechanic(dt);
}

// Aim snaps to whatever is marked; with nothing marked it follows your heading.
function faceTarget(){
  if(G.target && !G.target.dead){
    const a = Math.atan2(G.target.y - player.y, G.target.x - player.x);
    player.dx = Math.cos(a); player.dy = Math.sin(a);
  } else {
    player.dx = player.inx; player.dy = player.iny;
  }
  setDir(player.dx, player.dy);
}

// ---------------------------------------------------------------------------
// DAMAGE TO THE PLAYER
// ---------------------------------------------------------------------------
function hurtPlayer(dmg, sx, sy){
  if(player.iframe>0 || G.state!==ST.PLAY || player.down) return;
  let taken = dmg;
  if(player.bastion) taken *= 0.30;
  if(cls.id==='bulwark') taken *= 0.85;
  if(hasBuff('glacialward')){ taken *= 0.35; }
  if(hasBuff('slaghide')){
    taken *= 0.40;
    // the plating burns back — anything close enough to have hit you catches it
    for(const e of G.enemies)
      if(!e.dead && dist(e.x,e.y,player.x,player.y) < 30) applyBurn(e, 3);
  }
  taken = Math.max(1, Math.round(taken));
  player.hp -= taken;
  player.iframe = 0.7; player.hurtFlash = 0.35;
  // A mend only leaves residue if there was damage to mend. Ivo's collector
  // reads this, which is what stops it being charged by standing in an empty
  // field burning off a full store.
  player.residueT = 14;
  player.combatT = 3.0;              // burning is locked out for this long
  player.burning = false;
  onPlayerDamaged();
  G.shake=Math.max(G.shake,4); G.flash=Math.max(G.flash,0.28);
  floatText(player.x, player.y-28, '-'+taken, '#ff6a5a');
  Sfx.hurt();
  if(player.hp<=0){
    player.hp=0;
    // With a partner still standing you go DOWN; updateRevive decides when a
    // wipe is a wipe. Alone, PLAYERS is empty or length 1 and this is the
    // old behaviour exactly.
    if(PLAYERS.length>1) downPlayer(player);
    else { G.state=ST.DEAD; Sfx.die(); }
  }
}

// deferred actions on the game clock (pausable, deterministic)
const delayed = [];
// Deferred work remembers which player scheduled it. Without this, an ability
// P2 fired would resolve against whoever the cursor happened to be on when
// the timer expired — so P2's Lacerate would credit P1's Tempo, and every
// multi-hit ability in the game would attribute its damage to the wrong
// character.
function setDelayed(fn,t){ delayed.push({ fn, t, owner:player }); }
function updateDelayed(dt){
  for(let i=delayed.length-1;i>=0;i--){
    delayed[i].t -= dt;
    if(delayed[i].t<=0){
      const d = delayed[i]; delayed.splice(i,1);
      if(d.owner && d.owner!==player) withPlayer(d.owner, d.fn); else d.fn();
    }
  }
}

// ============================================================================
// AETHITE
//
// Capacity comes only from milestones — seven authored beats, each a
// permanent grant. Nothing you can farm. The consequence is that the ladder
// has to actually reach every lock in the game, which is asserted in
// tests/suite_aethite.js rather than left to hope.
// ============================================================================
const MILESTONES = [
  { id:'bond',    grant:40, name:'Bonded with your hatchling' },
  { id:'hayla',   grant:25, name:"Hayla's hunt" },
  { id:'verge',   grant:20, name:'First blood in the Verge' },
  { id:'shoals',  grant:20, name:'First blood in the Rivet Shoals' },
  { id:'codex6',  grant:30, name:'Six creatures recorded' },
  { id:'scarp',   grant:25, name:'First blood in the Iron Scarp' },
  { id:'codex12', grant:40, name:'Twelve creatures recorded' }
];
const MILESTONE_BY_ID = {};
MILESTONES.forEach(m=>MILESTONE_BY_ID[m.id]=m);

// Every Aethite lock in the world. `need` is the capacity you must have grown
// to before the lock will even consider you; `cost` is what it takes out of
// the pool. Keeping them in one table is what makes the ladder checkable.
const AETHITE_LOCKS = {
  scarpgate: { need:85,  cost:55,  name:'The Scarp Gate' },
  elevator:  { need:155, cost:120, name:'The Cogway Lift' }
};

// Milestones are shared — they come from quests, and the party does quests
// together — but the STORE is per player: each Forgebound's own dragon holds
// their own Aethite, and burning yours does not cost your partner theirs.
function grantMilestone(id){
  if(G.milestones[id]) return;
  const m = MILESTONE_BY_ID[id]; if(!m) return;
  G.milestones[id] = true;
  for(const q of (PLAYERS.length?PLAYERS:[player])){
    q.aethiteMax += m.grant;
    q.aethite = q.aethiteMax;                     // a grant always tops you up
  }
  toast('AETHITE STORE GROWS  +'+m.grant+'  ('+m.name+')');
  floatText(player.x, player.y-34, '+'+m.grant+' AETHITE', '#5ad4c8', true);
  for(let i=0;i<26;i++) spark(player.x, player.y-10, '#5ad4c8', 1.4);
  Sfx.quest();
}

// Milestones that are derived from world state rather than fired by an event.
function checkMilestones(){
  const recorded = Object.keys(G.seen).length;
  if(recorded>=6)  grantMilestone('codex6');
  if(recorded>=12) grantMilestone('codex12');
}

const TOWNS = { cogway:1, clearing:1, house:1, gate:1 };
function inTown(){ return !!TOWNS[G.areaId]; }
// Arriving in the city tops you up at once. Standing in it refills you fast
// but not instantly (AETHITE_TOWN_REGEN), so mending inside the walls costs
// you a few seconds rather than a trip, and a lock in the city still has to
// be paid for out of a store that is visibly lower afterwards.
function refillInTown(){
  if(!inTown()) return;
  for(const q of (PLAYERS.length?PLAYERS:[player])){ q.aethite = q.aethiteMax; q.burning = false; }
}

// Out of combat means: nothing hostile is near, and nothing has hit you
// recently. Both halves matter — without the timer you could burn between two
// swings of a Slag Bear, which would make the whole "not in combat" rule
// decorative.
function outOfCombat(){
  if(player.combatT>0) return false;
  for(const e of G.enemies){
    if(e.dead) continue;
    const T0 = ENEMY_TYPES[e.kind];
    if(T0 && T0.hostile && dist(e.x,e.y,player.x,player.y) < 150) return false;
  }
  return true;
}

const BURN_DRAIN = 20;      // aethite per second while burning
const BURN_HEAL  = 10;      // hp per second while burning
const AETHITE_REGEN = 3.2;   // per second, out of combat only
// Inside the walls the store refills fast enough that spending it there costs
// you a few seconds rather than a trip. It is still SPENT, which is what keeps
// the locks inside the city honest — the old rule simply refused to let you
// burn in town, so a rider could walk home bleeding and stand there unable to
// mend beside a full tank.
const AETHITE_TOWN_REGEN = 26.0;

function updateAethite(dt){
  player.combatT = Math.max(0, (player.combatT||0) - dt);
  player.burnCd = Math.max(0, (player.burnCd||0) - dt);

  if(player.burning){
    if(!outOfCombat() || player.aethite<=0 || player.hp>=player.maxhp){
      if(player.burning && !outOfCombat()) toast('CANNOT BURN IN COMBAT');
      player.burning = false; player.healAcc = 0; player.burnCd = BURN_RECAST;
    } else {
      player.aethite = Math.max(0, player.aethite - BURN_DRAIN*dt);
      // Health is an integer everywhere else in the game, so the fraction
      // accumulates here rather than inside player.hp.
      player.healAcc = (player.healAcc||0) + BURN_HEAL*dt;
      const whole = Math.floor(player.healAcc);
      if(whole){
        player.healAcc -= whole;
        player.hp = Math.min(player.maxhp, player.hp + whole);
      }
      player.burnT += dt;
      // teal steam, rising and turning
      if(Math.random() < dt*40){
        const a = player.burnT*3.4 + Math.random()*Math.PI*2, r = 7+Math.random()*7;
        G.particles.push({
          x: player.x + Math.cos(a)*r, y: player.y - 4 + Math.sin(a)*3,
          vx: Math.cos(a+1.5)*12, vy: -22 - Math.random()*16,
          life:0.7, max:0.9, kind:'steam', col:'#5ad4c8', s:1
        });
      }
    }
  } else if(player.aethite < player.aethiteMax && outOfCombat()){
    const rate = inTown() ? AETHITE_TOWN_REGEN : AETHITE_REGEN*partEff('regen');
    player.aethite = Math.min(player.aethiteMax, player.aethite + rate*dt);
  }
}

const BURN_RECAST = 1.0;

function toggleBurn(){
  if(G.state!==ST.PLAY) return;
  // Stopping is always allowed; starting again has to wait out the recast, so
  // tapping R can't be used to dodge the in-combat check frame by frame.
  if(player.burning){ player.burning=false; player.burnCd=BURN_RECAST; return; }
  if(player.burnCd>0){ Sfx.ui(); return; }
  if(player.hp>=player.maxhp){ toast('NOTHING TO MEND'); Sfx.ui(); return; }
  if(!outOfCombat()){ toast('CANNOT BURN IN COMBAT'); Sfx.ui(); return; }
  if(player.aethite<=1){ toast('AETHITE STORE EMPTY'); Sfx.ui(); return; }
  player.burning = true; player.burnT = 0; player.healAcc = 0; player.burnCd = BURN_RECAST;
  Sfx.cast();
  towerBurn();          // Ivo's collector drinks the residue off a mend
}

// ---------------------------------------------------------------------------
// CHANNELLING — the same action for every lock in the world
// ---------------------------------------------------------------------------
function channelInto(lockId, onOpen){
  const L = AETHITE_LOCKS[lockId];
  if(!L) return false;
  if(G.locks[lockId]){ onOpen && onOpen(); return true; }
  if(player.aethiteMax < L.need){
    startDialogue('Aethite Lock', [
      L.name+' will not answer you.',
      'The seal wants '+L.need+' of store and your dragon holds '+player.aethiteMax+'.',
      'It is not a question of what you are carrying. It is a question of what it can hold.'
    ]);
    Sfx.ui();
    return false;
  }
  if(player.aethite < L.cost){
    toast('NEEDS '+L.cost+' AETHITE — YOU HAVE '+Math.floor(player.aethite));
    Sfx.ui(); return false;
  }
  G.channel = { id:lockId, t:0, dur:1.6, onOpen };
  Sfx.scan();
  return true;
}

// Take down whatever barrier a lock was holding up. Owned by the lock rather
// than by whoever triggered the channel, so it happens however it was opened.
function openSeals(lockId){
  const a = G.area;
  if(!a || !a.seals || !a.seals[lockId]) return;
  for(const [sx,sy] of a.seals[lockId]) a.map[sy*a.w+sx] = T.STONE;
  renderStaticLayers();
}

function updateChannel(dt){
  const ch = G.channel; if(!ch) return;
  ch.t += dt;
  const a = player.burnT*2 + ch.t*7, r = 10 + Math.sin(ch.t*6)*4;
  for(let i=0;i<2;i++)
    G.particles.push({ x:player.x+Math.cos(a+i*3.1)*r, y:player.y-6+Math.sin(a+i*3.1)*4,
                       vx:0, vy:-16, life:0.5, max:0.6, kind:'steam', col:'#5ad4c8', s:1 });
  if(ch.t >= ch.dur){
    const L = AETHITE_LOCKS[ch.id];
    player.aethite = Math.max(0, player.aethite - L.cost);
    G.locks[ch.id] = true;
    G.channel = null;
    openSeals(ch.id);
    toast(L.name.toUpperCase()+' OPENS');
    G.flash = Math.max(G.flash, 0.5);
    for(let i=0;i<30;i++) spark(player.x, player.y-8, '#5ad4c8', 1.5);
    Sfx.quest();
    ch.onOpen && ch.onOpen();
  }
}

// ============================================================================
// INVENTORY, PARTS AND MONEY
// ============================================================================
function addItem(kind, id, n){
  const e = G.inv.find(q=>q.kind===kind && q.id===id);
  if(e){ e.n += (n||1); return e; }
  const it = { kind, id, n:(n||1) };
  G.inv.push(it);
  return it;
}
function itemDef(it){
  return it.kind==='part' ? PARTS_BY_ID[it.id]
       : it.kind==='mat'  ? MAT_BY_ID[it.id]
       : TRASH_BY_ID[it.id];
}
function countItem(kind,id){
  const e = G.inv.find(q=>q.kind===kind && q.id===id);
  return e ? e.n : 0;
}
function takeItems(kind,id,n){
  if(countItem(kind,id) < n) return false;
  for(let i=0;i<n;i++) takeItem(kind,id);
  return true;
}

// ---------------------------------------------------------------------------
// GATHERING
//
// A node is a tile, and whether it has been worked lives in G rather than in
// the map — the map is rebuilt from scratch on load and shared between saves,
// and a node you emptied should still be empty when you walk back in, not
// when you reload.
// ---------------------------------------------------------------------------
function nodeKey(x,y){ return G.areaId+':'+x+','+y; }
function nodeReady(x,y){ return !(G.nodesDone[nodeKey(x,y)] > 0); }
function nodeHere(){
  const a = G.area;
  if(!a || !a.nodes) return null;
  for(const [x,y] of a.nodes)
    if(dist(player.x, player.y, x*TILE+8, y*TILE+8) < 26) return [x,y];
  return null;
}
function harvestHere(){
  const at = nodeHere();
  if(!at) return false;
  const [x,y] = at;
  const M = MAT_BY_ID[G.area.nodeMat];
  if(!M) return false;
  if(!nodeReady(x,y)){
    const left = Math.ceil(G.nodesDone[nodeKey(x,y)]);
    toast('WORKED OUT \u2014 ANOTHER IN '+left+'S');
    Sfx.ui();
    return true;
  }
  const n = 1 + (Math.random()<0.28 ? 1 : 0);
  addItem('mat', M.id, n);
  G.nodesDone[nodeKey(x,y)] = NODE_RESPAWN;
  // The terrain is baked into a buffer once per area load, so a node that
  // has changed appearance has to be baked again or it keeps showing the
  // ore you just took. Once per gather is cheap; once per frame would not be.
  renderStaticLayers();
  floatText(x*TILE+8, y*TILE-10, '+'+n+' '+M.name.toUpperCase(), M.col.lit, true);
  toast('GATHERED \u2014 '+M.name.toUpperCase()+' x'+n);
  for(let i=0;i<16;i++) spark(x*TILE+8, y*TILE+2, M.col.lit, 1.3);
  Sfx.pickup();
  questGathered(M.id, n);
  return true;
}
function updateNodes(dt){
  for(const k in G.nodesDone){
    if(G.nodesDone[k] > 0){
      G.nodesDone[k] -= dt;
      if(G.nodesDone[k] <= 0){
        delete G.nodesDone[k];
        // it grew back — repaint, for the same reason working it repainted
        if(k.indexOf(G.areaId+':') === 0) renderStaticLayers();
      }
    }
  }
}
function haveItem(kind,id){ return G.inv.some(q=>q.kind===kind && q.id===id); }
function takeItem(kind,id){
  const i = G.inv.findIndex(q=>q.kind===kind && q.id===id);
  if(i<0) return false;
  if(--G.inv[i].n <= 0) G.inv.splice(i,1);
  return true;
}

// What a creature leaves behind. Trash is common and is what pays for things;
// its own part is rare, and there is only ever one part per species, so a
// given add-on always traces back to a specific animal.
const TRASH_DROPS = {
  rustquail:['flake','spring'], gearrat:['gear','rivet'], drone:['lens','wire'],
  sporeling:['flake','shard'],  brasshare:['spring','rivet'], tickboar:['plate','spring'],
  pollenmoth:['wire','shard'],  cragram:['plate','gear'],     slagbear:['plate','shard'],
  pylonhawk:['wire','lens'],    anvilcrab:['plate','rivet'],  turbineel:['wire','gear'],
  gullwright:['rivet','flake'],
  // the spirits leave slag and cooled glass where they melted
  emberimp:['shard','flake'], rimeimp:['shard','lens'], stormimp:['wire','lens'],
  pylon:['lens','gear']
};
const PART_DROP_CHANCE = 0.14;

function rollDrops(e){
  const tbl = TRASH_DROPS[e.kind];
  if(tbl && Math.random() < 0.72){
    const id = tbl[(Math.random()*tbl.length)|0];
    addItem('trash', id);
    floatText(e.x, e.y-18, TRASH_BY_ID[id].name.toUpperCase(), '#b8ae8a');
  }
  // Creatures carry a little of the ground they live on. It is the same
  // material as the zone's nodes, at a much worse rate — gathering is the
  // reliable way to get it, and killing things is the way you get it while
  // you are busy doing something else.
  const zm = MAT_BY_ZONE[ENEMY_TYPES[e.kind].zone] ||
             MAT_BY_ZONE[G.areaId];
  if(zm && Math.random() < 0.18){
    addItem('mat', zm.id);
    floatText(e.x, e.y-24, zm.name.toUpperCase(), zm.col.lit);
    questGathered(zm.id, 1);
  }

  const part = PART_BY_BEAST[e.kind];
  if(part && Math.random() < PART_DROP_CHANCE){
    addItem('part', part.id);
    floatText(e.x, e.y-30, part.name.toUpperCase(), C.brass4, true);
    toast('PART RECOVERED — '+part.name.toUpperCase());
    for(let i=0;i<18;i++) spark(e.x, e.y-8, C.brass4, 1.4);
    Sfx.learn();
  }
}

// --- fitted parts -----------------------------------------------------------
function fittedSet(){ return (player && player.fitted) || G.fitted; }
function fittedPart(slot){ const f=fittedSet(); return f[slot] ? PARTS_BY_ID[f[slot]] : null; }
// Look up one effect across every fitted part. Multiplicative so two parts
// touching the same number compose instead of one silently winning.
function partEff(key, base){
  let v = (base===undefined) ? 1 : base;
  for(const sl of SLOTS){
    const p = fittedPart(sl);
    if(p && p.eff[key]!==undefined) v = (base===undefined) ? v*p.eff[key] : v + p.eff[key];
  }
  return v;
}
function fitPart(id){
  const p = PARTS_BY_ID[id];
  if(!p) return false;
  if(!haveItem('part', id)){ toast('YOU DO NOT HAVE THAT PART'); Sfx.ui(); return false; }
  // one part per slot: whatever was there comes off and goes back in the bag
  const F = fittedSet();
  const prev = F[p.slot];
  if(prev === id){ unfitPart(p.slot); return true; }
  if(prev) addItem('part', prev);
  takeItem('part', id);
  F[p.slot] = id;
  applyPartStats();
  toast('FITTED — '+p.name.toUpperCase());
  Sfx.learn();
  return true;
}
function unfitPart(slot){
  const F = fittedSet();
  const id = F[slot];
  if(!id) return false;
  F[slot] = null;
  addItem('part', id);
  applyPartStats();
  toast('REMOVED — '+PARTS_BY_ID[id].name.toUpperCase());
  Sfx.ui();
  return true;
}

// Max health and speed are stored on the player, so a body part has to be
// folded in when it changes rather than read live. Everything else (attack,
// cooldowns, regen) is read through partEff() at the point of use.
function applyPartStats(){
  const bonusHp = Math.round(partEff('maxhp', 0));
  const newMax  = player.baseMaxhp + bonusHp;
  const delta   = newMax - player.maxhp;
  player.maxhp  = newMax;
  player.hp     = clamp(player.hp + Math.max(0,delta), 1, player.maxhp);
  player.spd    = player.baseSpd * partEff('spd');
}

// --- money ------------------------------------------------------------------
function trashValue(){
  return G.inv.filter(i=>i.kind==='trash')
              .reduce((s,i)=>s + TRASH_BY_ID[i.id].value*i.n, 0);
}
function sellAllTrash(){
  const v = trashValue();
  if(v<=0) return 0;
  G.inv = G.inv.filter(i=>i.kind!=='trash');
  G.marks += v;
  toast('SOLD FOR '+v+' AIONS');
  Sfx.pickup();
  return v;
}
