
// ============================================================================
// THE DRAGON COMPANION
// ============================================================================
// Like `player`, this is a cursor. Each roster entry owns a dragon and
// withPlayer() points this at theirs.
const DRAGON_PROTO = {
  x:0, y:0, bond:1, bondXp:0,
  cds:[0,0], bob:0, flap:0, orbit:0, chirpT:4,
  dashT:0, dashAng:0
};
let dragon = Object.assign({}, DRAGON_PROTO);
function dragonBodies(){ return [{x:dragon.x, y:dragon.y}]; }

// ---------------------------------------------------------------------------
// THE DRAGON AIMS ITSELF
//
// Its abilities used to fire along the PLAYER's angle to the mark while
// emitting from the dragon's own position, several tiles off to one side and
// drifting on an orbit — so the cone left from the wrong place at the wrong
// angle and the further round the hatchling had drifted, the worse it missed.
// Aiming has to be measured from whoever is doing the shooting.
//
// It uses the player's mark when there is one, exactly like the player's own
// abilities do, and otherwise picks up the nearest thing itself rather than
// firing into empty air.
// ---------------------------------------------------------------------------
function dragonTarget(){
  const reach = targetRange() + 40;        // a little further than you can mark
  if(G.target && !G.target.dead && dist(dragon.x, dragon.y, G.target.x, G.target.y) <= reach)
    return G.target;
  return nearestEnemy(dragon.x, dragon.y, reach);
}
function dragonAim(from){
  const t = dragonTarget();
  const o = from || dragon;
  if(t) return Math.atan2((t.y - 4) - o.y, t.x - o.x);
  return aimAngle();                       // nothing about: follow the rider
}

function updateDragon(dt){
  dragon.orbit += dt*0.85;
  dragon.bob   += dt*4.6;
  dragon.flap  += dt*12;
  dragon.cds[0]=Math.max(0,dragon.cds[0]-dt);
  dragon.cds[1]=Math.max(0,dragon.cds[1]-dt);

  if(dragon.dashT>0){
    dragon.dashT-=dt;
    dragon.x += Math.cos(dragon.dashAng)*220*dt;
    dragon.y += Math.sin(dragon.dashAng)*220*dt;
    for(let i=0;i<2;i++) spark(dragon.x,dragon.y,drg.b,1.1);
  } else {
    const ax = player.x + Math.cos(dragon.orbit)*17;
    const ay = player.y - 13 + Math.sin(dragon.orbit*1.3)*5;
    dragon.x = lerp(dragon.x, ax, Math.min(1, dt*3.4));
    dragon.y = lerp(dragon.y, ay, Math.min(1, dt*3.4));
  }

  // face whatever it would shoot at, so the sprite agrees with the cone
  const look = dragonTarget();
  if(look) dragon.face = look.x >= dragon.x ? 1 : -1;
  else if(Math.abs(player.dx) > 0.01) dragon.face = player.dx >= 0 ? 1 : -1;

  dragon.chirpT -= dt;
  if(dragon.chirpT<=0){ dragon.chirpT = 6+Math.random()*8; if(G.state===ST.PLAY) Sfx.chirp(); }

  // trailing elemental motes
  if(G.state===ST.PLAY && Math.random()<0.25){
    G.particles.push({ x:dragon.x+(Math.random()-0.5)*8, y:dragon.y+2,
      vx:(Math.random()-0.5)*8, vy:-12-Math.random()*8,
      life:0.32, max:0.44, kind:'flame', col:drg.c, s:1 });
  }
  if(hasBuff('regen') && Math.random()<dt*2){
    player.hp=Math.min(player.maxhp,player.hp+1);
  }
}
// ============================================================================
// LEVELS
//
// Two ladders off the same events. The dragon's bond begins at 1 and is EARNED
// — it used to start at 12, which meant the number on the dragon pane was a
// decoration rather than a record of anything the player had done.
//
// The player climbs the same ladder slightly faster, so your own level is
// usually one or two ahead of your dragon's. That gap is the point: it gives
// the dragon somewhere to catch up to, and it means feeding the dragon with
// its own abilities (which grant bond and no player XP) is a real choice
// rather than a free one.
//
// Both curves widen with level, so the first few come quickly and the later
// ones ask for a zone's worth of work.
// ============================================================================
function bondNeed(lv){   return 8  + lv*4; }    // 12, 16, 20, 24 …
function levelNeed(lv){  return  7 + lv*3; }    // 10, 13, 16, 19 …  (faster)
// The player's curve has to sit UNDER the dragon's at every level, not just
// most of them. The first pair crossed at level 1 — 13 against 12 — so the
// very first level was the one place the dragon pulled ahead, which is the
// opposite of the intended feel and exactly where a player would notice it.

function gainBond(n){
  if(!dragon) return;
  dragon.bondXp += n;
  while(dragon.bond < 100 && dragon.bondXp >= bondNeed(dragon.bond)){
    dragon.bondXp -= bondNeed(dragon.bond);
    dragon.bond++;
    floatText(dragon.x, dragon.y-26, 'BOND '+dragon.bond, C.aether4, true);
    Sfx.learn();
  }
  if(dragon.bond >= 100) dragon.bondXp = 0;
}

// A level is +8 max health and +4% damage, applied the moment it lands rather
// than being recomputed from the level everywhere: maxhp is written to by
// other things in this game (Hayla's shawl, for one) and a recompute would
// quietly throw those away.
const LEVEL_HP = 8, LEVEL_ATK = 0.04;
function gainXp(n){
  if(!player) return;
  player.xp = (player.xp||0) + n;
  while(player.level < 99 && player.xp >= levelNeed(player.level)){
    player.xp -= levelNeed(player.level);
    player.level++;
    player.maxhp += LEVEL_HP;
    player.hp = Math.min(player.maxhp, player.hp + LEVEL_HP);
    floatText(player.x, player.y-34, 'LEVEL '+player.level, C.amber5, true);
    toast(cls.name.toUpperCase()+' \u2014 LEVEL '+player.level);
    Sfx.learn();
  }
  if(player.level >= 99) player.xp = 0;
}

// What a kill is worth, to everyone. Experience is shared rather than given
// to whoever landed the blow: a co-op partner who spends the fight tanking
// should not finish it a level behind, and a kill from a burn tick has no
// "whoever landed the blow" to give it to in the first place.
function awardKill(e){
  const worth = (ENEMY_TYPES[e.kind] && ENEMY_TYPES[e.kind].xp) || 1;
  // PLAYERS is empty on the older single-player path (and in a few tests),
  // where the cursor globals are the whole roster.
  if(PLAYERS.length) eachPlayer(()=>{ gainBond(worth); gainXp(worth); });
  else { gainBond(worth); gainXp(worth); }
}

// ============================================================================
// CREATURES — all passive in this build, so the demo is about your controls
// ============================================================================
let enemyId = 1;
const ENEMY_TYPES = {
  rustquail: { zone:'rustfields', name:'Rustquail', hp:26, spd:30, r:5, xp:1, wander:1.5,
               col:{ a:'#6b4a2a', b:'#9a7040', c:'#c49a5e', accent:'#c8452b', metal:'#9a9690' } },
  gearrat:   { zone:'rustfields', name:'Gear-Rat',  hp:34, spd:38, r:5, xp:1, wander:1.0,
               col:{ a:'#4a3a2a', b:'#6b5540', c:'#8a7358', accent:'#ff6a3c', metal:'#9a9690' } },
  drone:     { zone:'rustfields', name:'Scrap Drone',hp:48, spd:26, r:6, xp:2, wander:2.2,
               col:{ a:'#3a3a44', b:'#5a5a66', c:'#84848f', accent:'#ff3c3c', metal:'#c8a13c' } },
  sporeling: { name:'Sporeling', hp:30, spd:22, r:5, xp:1, wander:2.0, zone:'rustfields',
               col:{ a:'#2f4a2a', b:'#4a7040', c:'#7aa85e', accent:'#c9d86a', metal:'#8ad275' } },

  // ==========================================================================
  // BEYOND THE WALLS
  //
  // Every one of these is an ordinary animal that has grown metal. Aethite in
  // the water and the soil does this — the hare's ears came in as hammered
  // brass, the boar's tail wound itself into a spring. That shared rule is
  // what keeps nine species from three different biomes looking like one
  // bestiary rather than three.
  //
  // All hostile. `windT` is the telegraph before every strike and it is the
  // single most important number here: it is what makes a hit feel earned
  // rather than arbitrary, and what gives the dodge a purpose.
  // ==========================================================================

  // --- THE VERGE, north: open grassland --------------------------------------
  brasshare:  { name:'Brass Hare', zone:'verge', hp:30, spd:82, r:5, xp:2, wander:1.0,
                hostile:true, aggro:130, atkRange:30, atkKind:'lunge', lungeSpd:300,
                atk:7, windT:0.40, strikeT:0.30, recover:0.75, atkCd:1.2,
                col:{ a:'#6b5a3a', b:'#9a8557', c:'#c4ab76', accent:'#e2bc5e', metal:'#bf9435' } },
  tickboar:   { name:'Tickboar', zone:'verge', hp:78, spd:46, r:7, xp:4, wander:1.8,
                hostile:true, aggro:120, atkRange:34, atkKind:'lunge', lungeSpd:360,
                atk:13, windT:0.62, strikeT:0.42, recover:1.1, atkCd:1.8,
                col:{ a:'#332a26', b:'#55463d', c:'#7d6a5e', accent:'#c8452b', metal:'#84848f' } },
  pollenmoth: { name:'Foundry Moth', zone:'verge', hp:40, spd:34, r:6, xp:3, wander:2.4,
                hostile:true, aggro:150, atkRange:96, atkKind:'spit', shotSpd:130,
                shotStyle:'spark', atk:8, windT:0.50, recover:0.9, atkCd:1.6,
                col:{ a:'#4a3d5e', b:'#7d68a0', c:'#b09ecc', accent:'#ffe86a', metal:'#b06a35' } },

  // --- THE IRON SCARP, east: mountains ---------------------------------------
  cragram:    { name:'Crag Ram', zone:'scarp', hp:96, spd:52, r:7, xp:5, wander:2.0,
                hostile:true, aggro:140, atkRange:36, atkKind:'lunge', lungeSpd:400,
                atk:16, windT:0.70, strikeT:0.46, recover:1.2, atkCd:2.0,
                col:{ a:'#45423c', b:'#6a655c', c:'#928b7e', accent:'#d18f53', metal:'#9a9690' } },
  slagbear:   { name:'Slag Bear', zone:'scarp', hp:150, spd:32, r:9, xp:8, wander:2.6,
                hostile:true, aggro:110, atkRange:32, atkKind:'melee',
                atk:22, windT:0.78, recover:1.3, atkCd:1.9,
                col:{ a:'#2b2521', b:'#483c33', c:'#6b5a4a', accent:'#ff6a3c', metal:'#7d3e1f' } },
  pylonhawk:  { name:'Pylon Hawk', zone:'scarp', hp:52, spd:70, r:6, xp:5, wander:1.4,
                hostile:true, aggro:170, atkRange:110, atkKind:'spit', shotSpd:210,
                shotStyle:'bolt', atk:12, windT:0.44, recover:0.8, atkCd:1.5,
                col:{ a:'#33333d', b:'#53535f', c:'#7d7d89', accent:'#8fd6ff', metal:'#b06a35' } },

  // --- THE RIVET SHOALS, south: beach ----------------------------------------
  anvilcrab:  { name:'Anvil Crab', zone:'shoals', hp:120, spd:38, r:7, xp:5, wander:1.6,
                hostile:true, aggro:100, atkRange:28, atkKind:'melee',
                atk:15, windT:0.60, recover:1.0, atkCd:1.6,
                col:{ a:'#6b2a24', b:'#9a4038', c:'#c4635a', accent:'#e2bc5e', metal:'#84848f' } },
  turbineel:  { name:'Turbine Eel', zone:'shoals', hp:64, spd:60, r:6, xp:4, wander:1.2,
                hostile:true, aggro:120, atkRange:40, atkKind:'nova',
                atk:14, windT:0.66, recover:1.1, atkCd:2.0,
                col:{ a:'#1c4547', b:'#2d7370', c:'#57a49c', accent:'#8fd6ff', metal:'#9a9690' } },
  gullwright: { name:'Gullwright', zone:'shoals', hp:44, spd:76, r:6, xp:3, wander:1.0,
                hostile:true, aggro:160, atkRange:44, atkKind:'lunge', lungeSpd:330,
                atk:10, windT:0.46, strikeT:0.34, recover:0.8, atkCd:1.3,
                col:{ a:'#7d7d87', b:'#aeaeb8', c:'#e0e0e8', accent:'#ffab3c', metal:'#bf9435' } },

  // ==========================================================================
  // THE GLIMMERVEIN, below: one creature in three colours
  //
  // Not animals. A spirit poured out of a generator on the cave floor, shaped
  // roughly like a small devil and holding a forked spear. Killing one buys
  // you about thirty seconds; the pylon simply pours another.
  //
  // The three are deliberately the SAME creature. Same silhouette, same
  // timings, same two attacks — only the colour and the element differ, and
  // the element is the entire fight: each is immune to its own and takes
  // nearly double from the other two. A player who brings one damage type to
  // this cave is going to have a bad time with a third of it.
  //
  // `pylon` is the id of the generator that made it. Cut the generator and the
  // spirit it was pouring stops coming back.
  // ==========================================================================
  emberimp:   { name:'Ember Imp', zone:'glimmervein', hp:54, spd:74, r:6, xp:5, wander:0.8,
                hostile:true, aggro:150, atkRange:26, atkKind:'melee',
                atk:13, windT:0.42, recover:0.7, atkCd:1.3,
                hurl:{ cd:3.2, range:150, spd:190, style:'fork', dmg:14 },
                elem:'fire', immune:'fire', weak:['ice','lightning'], melt:true,
                col:{ a:'#2a0d0d', b:'#8e1f16', c:'#ff5a28', accent:'#ffc25c', metal:'#1a0a0a' } },
  rimeimp:    { name:'Rime Imp', zone:'glimmervein', hp:62, spd:66, r:6, xp:5, wander:0.8,
                hostile:true, aggro:150, atkRange:26, atkKind:'melee',
                atk:12, windT:0.48, recover:0.8, atkCd:1.4,
                hurl:{ cd:3.6, range:150, spd:170, style:'forkice', dmg:13 },
                elem:'ice', immune:'ice', weak:['fire','lightning'], melt:true,
                col:{ a:'#0c1c2e', b:'#1f5a8e', c:'#7fd8ff', accent:'#e4f6ff', metal:'#0a1420' } },
  stormimp:   { name:'Storm Imp', zone:'glimmervein', hp:48, spd:88, r:6, xp:5, wander:0.8,
                hostile:true, aggro:160, atkRange:26, atkKind:'melee',
                atk:14, windT:0.36, recover:0.6, atkCd:1.1,
                hurl:{ cd:2.8, range:160, spd:230, style:'forkarc', dmg:15 },
                elem:'lightning', immune:'lightning', weak:['fire','ice'], melt:true,
                col:{ a:'#241c06', b:'#8a6a12', c:'#ffe74a', accent:'#fffbd0', metal:'#14100a' } },

  // The generator. It does not move, does not chase and cannot hurt you — it
  // just keeps making the thing that can. Tough enough that you have to
  // decide to deal with it while something is stabbing you.
  pylon:      { name:'Spirit Pylon', zone:'glimmervein', hp:150, spd:0, r:8, xp:8, wander:0,
                hostile:false, inert:true, pylon:true,
                col:{ a:'#2a2438', b:'#463c5e', c:'#6e5f90', accent:'#b98cf0', metal:'#8a8496' } }
};

// The three colours of the same spirit, and the pylon each pours from.
const IMP_KINDS = ['emberimp','rimeimp','stormimp'];
const IMP_RESPAWN = 30;         // seconds, per the design: it comes back

function spawnEnemy(kind,x,y){
  const T0=ENEMY_TYPES[kind];
  G.enemies.push({
    id:enemyId++, kind, name:T0.name,
    x, y, hx:x, hy:y,                       // home point, for wandering
    hp:T0.hp, maxhp:T0.hp, r:T0.r,
    dead:false, deadT:0, flash:0,
    anim:Math.random()*4, bob:Math.random()*6, facing:Math.random()<0.5?1:-1,
    walk:Math.random()*6, frame:0, idleFr:0, atkFr:-1, moving:false,
    wanderT:Math.random()*2, wx:0, wy:0,
    fleeT:0, knock:0, knockX:0, knockY:0,
    burn:0, burnT:0, poison:0, poisonT:0, slow:0, slowT:0,
    stagger:0, marked:0, blind:0, taunt:0, shattered:0,
    // hostile state machine: idle -> chase -> wind -> strike -> recover
    ai:'idle', windT:0, strikeT:0, recoverT:0, atkCd:Math.random()*1.2,
    hurlCd:(T0.hurl ? Math.random()*T0.hurl.cd : 0),
    pylonId:0, elem:T0.elem||null,
    aimX:0, aimY:0
  });
  return G.enemies[G.enemies.length-1];
}
function populateArea(a){
  G.enemies.length=0;

  // Pylons are placed differently from everything else in the game. The rest
  // of the world is seeded off the area id so a zone looks the same every
  // time you walk into it; the Glimmervein is rolled fresh, because which
  // three elements are waiting for you is the whole encounter and knowing it
  // in advance would make the cave a checklist.
  if(a.pylonSpots){
    const spots = a.pylonSpots.slice();
    for(let i=spots.length-1;i>0;i--){
      const j=(Math.random()*(i+1))|0; const t=spots[i]; spots[i]=spots[j]; spots[j]=t;
    }
    const n = 4 + ((Math.random()*2)|0);
    for(let i=0;i<Math.min(n, spots.length);i++){
      const [x,y] = spots[i];
      const py = spawnEnemy('pylon', x*TILE+8, y*TILE+8);
      py.impKind = IMP_KINDS[(Math.random()*IMP_KINDS.length)|0];
      py.spawnT  = 0;                 // pours its first spirit immediately
    }
  }

  if(!a.spawns) return;
  const rng = makeRng(a.id.length*977 + a.w);
  for(const s of a.spawns){
    for(let i=0;i<s.n;i++){
      for(let t=0;t<80;t++){
        const x=s.x+Math.floor(rng()*s.w), y=s.y+Math.floor(rng()*s.h);
        if(x<1||y<1||x>=a.w-1||y>=a.h-1) continue;
        if(SOLID[a.map[y*a.w+x]]) continue;
        spawnEnemy(s.kind, x*TILE+8, y*TILE+8);
        break;
      }
    }
  }
}

function nearestEnemy(x,y,maxD,exclude){
  let best=null, bd=maxD||1e9;
  for(const e of G.enemies){
    if(e.dead||e===exclude) continue;
    const d=dist(x,y,e.x,e.y);
    if(d<bd){ bd=d; best=e; }
  }
  return best;
}

// The codex records what you have FOUGHT. That has to cut both ways: if
// something mauls you and drives you off, you have certainly met it, and
// keeping it out of the codex because you never landed a hit would be a
// strange thing for a field journal to do.
function recordCreature(kind){
  if(G.seen[kind]) return;
  G.seen[kind] = true;
  toast('CODEX: '+ENEMY_TYPES[kind].name.toUpperCase()+' RECORDED');
  Sfx.pickup();
}

const ZONE_MILESTONE = { verge:'verge', scarp:'scarp', shoals:'shoals',
                         glimmervein:'glimmervein' };

// ============================================================================
// ELEMENTS
// ============================================================================
// Damage carries an element the way the player cursor carries a player: a
// global, set for the duration of one source and restored after. Threading a
// parameter down through resolveArc / resolveLine / spawnShot / hurtEnemy
// would have touched seventeen call sites, fifteen of which would pass null
// forever, and the one that forgot would be silent.
//
// Neutral (null) is the default and is never resisted. A creature is immune to
// exactly one element and weak to the others it cares about, so the answer to
// a fire-immune enemy is never "you cannot hurt it" — a sword still works.
const ELEM_COL = { fire:'#ff8a3c', ice:'#a8e0f2', lightning:'#fff58a',
                   nature:'#7ec96a', dark:'#b088e0', light:'#fff3cc' };
let DMG_ELEM = null;
function withElement(el, fn){
  const prev = DMG_ELEM; DMG_ELEM = el || null;
  try { return fn(); } finally { DMG_ELEM = prev; }
}
function elemImmune(e, el){
  const T0 = ENEMY_TYPES[e.kind];
  return !!(el && T0 && T0.immune === el);
}
function elemMul(e, el){
  const T0 = ENEMY_TYPES[e.kind];
  if(!el || !T0) return 1;
  if(T0.immune === el) return 0;
  if(T0.weak && T0.weak.indexOf(el) >= 0) return 1.8;
  return 1;
}

function hurtEnemy(e,dmg,sx,sy,crit,knockMul){
  if(e.dead) return;
  recordCreature(e.kind);
  // first blood in each of the three hunting grounds is a capacity grant
  const ms = ZONE_MILESTONE[G.areaId];
  if(ms) grantMilestone(ms);
  // Immunity is announced rather than silently absorbed: a number that does
  // not appear reads as a bug, and the player has to be told which element
  // to stop using.
  const mul = elemMul(e, DMG_ELEM);
  if(mul === 0){
    floatText(e.x, e.y-14-e.r, 'IMMUNE', ELEM_COL[DMG_ELEM] || C.ui2);
    e.flash = 0.08; Sfx.ui();
    return;
  }
  let amount = dmg * mul;
  if(mul > 1) floatText(e.x-10, e.y-20-e.r, 'WEAK', ELEM_COL[DMG_ELEM] || C.amber4);
  // Analyzed. The Savant's whole second half: once a species has nothing left
  // to teach, marking it is what the scan button becomes. 15% was invisible
  // next to a crit and the button felt dead.
  if(e.marked>0) amount *= 1.40;
  if(e.shattered>0) amount *= 1.15;
  amount = Math.max(1, Math.round(amount));
  e.hp -= amount; e.flash=0.12;
  e.fleeT = 2.4 + Math.random()*1.6;        // spooked, not angry
  floatText(e.x+(Math.random()-0.5)*6, e.y-12-e.r, String(amount),
            crit?C.amber4:'#ffffff', crit);
  if(crit){ Sfx.crit(); G.hitlag=Math.max(G.hitlag,0.08); } else Sfx.hit();
  if(knockMul){
    const a=Math.atan2(e.y-sy,e.x-sx);
    e.knockX=Math.cos(a)*90*knockMul; e.knockY=Math.sin(a)*90*knockMul; e.knock=0.17;
  }
  for(let i=0;i<(crit?9:5);i++) spark(e.x,e.y-e.r,crit?C.amber4:'#ffcf9a',crit?1.3:1);
  if(e.hp<=0) killEnemy(e);
}

function killEnemy(e){
  e.dead=true; e.deadT=0.4; e.hp=0;
  awardKill(e);
  rollDrops(e);
  questKilled(e.kind);
  Sfx.die();
  for(let i=0;i<14;i++) spark(e.x,e.y-e.r, i%3?C.rust3:C.stone4, 1.3);
  // quest progress
  if(G.quest.state==='active' && e.kind==='rustquail'){
    G.quest.kills++;
    floatText(e.x, e.y-26, 'RUSTQUAIL '+G.quest.kills+'/'+G.quest.need, C.amber4, true);
    if(G.quest.kills>=G.quest.need){
      G.quest.state='done';
      toast('QUEST COMPLETE — RETURN TO HAYLA');
      Sfx.quest();
    } else Sfx.pickup();
  }
}

function applyBurn(e,d){ if(!e.dead && !elemImmune(e,'fire')) e.burn=Math.max(e.burn,d); }
function applyPoison(e,d){ if(!e.dead && !elemImmune(e,'nature')) e.poison=Math.max(e.poison,d); }
function applySlow(e,a,d){ if(!e.dead && !elemImmune(e,'ice')){ e.slow=Math.max(e.slow,a); e.slowT=Math.max(e.slowT,d); } }
function applyStagger(e,d){
  if(e.dead) return;
  e.stagger=Math.max(e.stagger,d);
  floatText(e.x,e.y-18-e.r,'STAGGER',C.aether4);
}

function updateEnemies(dt){
  for(let i=G.enemies.length-1;i>=0;i--){
    const e=G.enemies[i], T0=ENEMY_TYPES[e.kind];
    if(e.dead){ e.deadT-=dt; if(e.deadT<=0) G.enemies.splice(i,1); continue; }

    e.flash=Math.max(0,e.flash-dt);
    e.anim+=dt*6; e.bob+=dt*3.2;

    // Animation state for stage 4 of the art pass. Before this every creature
    // flipped between two poses on a free-running clock, which is why a
    // standing brasshare still trotted on the spot. Three separate clocks now:
    //   frame   a six-step walk that ONLY advances while the thing is moving
    //   idleFr  a two-step breathe that always runs
    //   atkFr   a three-step strike driven by the attack state machine rather
    //           than by time, so the pose and the hitbox cannot disagree
    const dx0 = e.x - (e._px===undefined ? e.x : e._px);
    const dy0 = e.y - (e._py===undefined ? e.y : e._py);
    e.moving = (dx0*dx0 + dy0*dy0) > 0.02;
    e._px = e.x; e._py = e.y;
    if(e.moving) e.walk = (e.walk||0) + dt*7.5;
    e.frame  = Math.floor(e.walk||0) % 6;
    e.idleFr = Math.floor(e.bob*0.5) % 2;
    e.atkFr  = e.ai==='wind' ? 0 : e.ai==='strike' ? 1 : e.ai==='recover' ? 2 : -1;
    for(const k of ['marked','blind','taunt','shattered','stagger'])
      if(e[k]>0) e[k]=Math.max(0,e[k]-dt);

    // damage over time
    if(e.burn>0){
      e.burn-=dt; e.burnT-=dt;
      if(e.burnT<=0){
        e.burnT=0.5; e.hp-=3;
        floatText(e.x+(Math.random()-0.5)*5,e.y-10-e.r,'3',C.amber3);
        for(let k=0;k<3;k++) G.particles.push({x:e.x+(Math.random()-0.5)*8,y:e.y-4,
          vx:(Math.random()-0.5)*10,vy:-22,life:0.3,max:0.4,kind:'flame',col:C.amber3,s:1});
        if(e.hp<=0){ killEnemy(e); continue; }
      }
    }
    if(e.poison>0){
      e.poison-=dt; e.poisonT-=dt;
      if(e.poisonT<=0){
        e.poisonT=0.7; e.hp-=2;
        floatText(e.x+(Math.random()-0.5)*5,e.y-10-e.r,'2',C.leaf5);
        if(e.hp<=0){ killEnemy(e); continue; }
      }
    }
    if(e.slowT>0){ e.slowT-=dt; if(e.slowT<=0) e.slow=0; }
    if(e.fleeT>0) e.fleeT-=dt;

    // knockback overrides everything
    if(e.knock>0){
      e.knock-=dt;
      const nx=e.x+e.knockX*dt, ny=e.y+e.knockY*dt;
      if(walkableAt(nx,e.y)) e.x=nx;
      if(walkableAt(e.x,ny)) e.y=ny;
      e.knockX*=0.86; e.knockY*=0.86;
      continue;
    }
    if(e.stagger>0) continue;

    // --- THE PYLON --------------------------------------------------------
    // It does nothing but pour. The countdown only runs while there is no
    // spirit standing, so killing an imp buys the full thirty seconds rather
    // than however much was left on a clock that never stopped.
    if(T0.pylon){
      const child = G.enemies.find(q=>q.pylonId===e.id && !q.dead);
      if(child){ e.spawnT = IMP_RESPAWN; }
      else {
        e.spawnT -= dt;
        if(e.spawnT<=0){
          const imp = spawnEnemy(e.impKind, e.x, e.y+10);
          imp.pylonId = e.id;
          e.spawnT = IMP_RESPAWN;
          for(let k=0;k<18;k++) G.particles.push({
            x:e.x+(Math.random()-0.5)*10, y:e.y+4,
            vx:(Math.random()-0.5)*22, vy:-40-Math.random()*40,
            life:0.4+Math.random()*0.3, max:0.7, kind:'flame',
            col:ENEMY_TYPES[e.impKind].col.c, s:1 });
          Sfx.cast();
        }
      }
      continue;
    }
    if(T0.inert) continue;

    const spd = T0.spd*(1-e.slow);

    // --- HOSTILE BEHAVIOUR ------------------------------------------------
    // Everything beyond the city walls hunts. The state machine is small on
    // purpose — chase, wind up, strike, recover — but the wind-up is the part
    // that matters: a telegraphed beat before every hit is what makes the
    // difference between difficulty and unfairness, and it's what gives the
    // dodge something to be for.
    if(T0.hostile && !e.blind){
      e.atkCd = Math.max(0, e.atkCd - dt);
      if(T0.hurl) e.hurlCd = Math.max(0, e.hurlCd - dt);
      const pd = dist(e.x, e.y, player.x, player.y);

      if(e.ai==='wind'){
        e.windT -= dt;
        e.facing = player.x >= e.x ? 1 : -1;
        if(e.windT<=0){
          e.ai='strike'; e.strikeT = T0.strikeT || 0.18;
          e.aimX = player.x; e.aimY = player.y;          // committed: aim locks here
          creatureStrike(e, T0);
        }
        continue;
      }
      if(e.ai==='strike'){
        e.strikeT -= dt;
        if(T0.atkKind==='lunge'){
          const a=Math.atan2(e.aimY-e.y, e.aimX-e.x);
          stepEnemy(e, Math.cos(a)*T0.lungeSpd*dt, Math.sin(a)*T0.lungeSpd*dt);
          if(pd < e.r+9) { hurtPlayer(T0.atk, e.x, e.y); e.ai='recover'; e.recoverT=T0.recover||0.7; }
        }
        if(e.strikeT<=0){ e.ai='recover'; e.recoverT = T0.recover||0.7; }
        continue;
      }
      if(e.ai==='recover'){
        e.recoverT -= dt;
        if(e.recoverT<=0){ e.ai='idle'; e.atkCd = T0.atkCd || 1.4; }
        continue;
      }

      // chase, and commit to an attack once in range
      if(pd < (T0.aggro||110)){
        // The fork leaves the hand when you are too far to stab but close
        // enough to be worth the throw. It is the reason backing off from an
        // imp is not a safe answer.
        if(T0.hurl && e.hurlCd<=0 && pd > (T0.atkRange||24) && pd < T0.hurl.range){
          e.ai='wind'; e.windT = T0.windT || 0.42; e.hurling = true;
          e.hurlCd = T0.hurl.cd;
          Sfx.ui();
          continue;
        }
        if(pd <= (T0.atkRange||24) && e.atkCd<=0){
          e.ai='wind'; e.windT = T0.windT || 0.42; e.hurling = false;
          Sfx.ui();
          continue;
        }
        const a=Math.atan2(player.y-e.y, player.x-e.x);
        e.facing = Math.cos(a)>=0?1:-1;
        // hold at range if this one shoots, otherwise close
        const want = T0.atkKind==='spit' ? (T0.atkRange||90)*0.8 : 0;
        const dir = pd < want ? -1 : 1;
        stepEnemy(e, Math.cos(a)*spd*dir*dt, Math.sin(a)*spd*dir*dt);
        continue;
      }
      // out of range: drift home
      e.wanderT -= dt;
      if(e.wanderT<=0){
        e.wanderT = T0.wander + Math.random()*T0.wander;
        let a = Math.random()*Math.PI*2;
        if(dist(e.x,e.y,e.hx,e.hy) > 70) a = Math.atan2(e.hy-e.y, e.hx-e.x)+(Math.random()-0.5)*0.7;
        e.wx=Math.cos(a); e.wy=Math.sin(a); e.facing = e.wx>=0?1:-1;
      }
      stepEnemy(e, e.wx*spd*0.4*dt, e.wy*spd*0.4*dt);
      continue;
    }

    // --- PASSIVE BEHAVIOUR ---------------------------------------------
    // The Rustfields and the city stay harmless. Creatures graze, drift, and
    // bolt when startled. Bulwark's taunt is the one thing that pulls them in,
    // so Aegis still works.
    if(e.taunt>0){
      const a=Math.atan2(player.y-e.y, player.x-e.x);
      e.facing = Math.cos(a)>=0?1:-1;
      if(dist(e.x,e.y,player.x,player.y)>22) stepEnemy(e,Math.cos(a)*spd*dt,Math.sin(a)*spd*dt);
    }
    else if(e.fleeT>0){
      // scatter away from the player after being hit
      const a=Math.atan2(e.y-player.y, e.x-player.x) + (Math.random()-0.5)*0.4;
      e.facing = Math.cos(a)>=0?1:-1;
      stepEnemy(e, Math.cos(a)*spd*1.6*dt, Math.sin(a)*spd*1.6*dt);
    }
    else {
      // idle wander around a home point
      e.wanderT -= dt;
      if(e.wanderT<=0){
        e.wanderT = T0.wander + Math.random()*T0.wander;
        if(Math.random()<0.4){ e.wx=0; e.wy=0; }        // pause to graze
        else {
          let a = Math.random()*Math.PI*2;
          // drift home if we've strayed
          if(dist(e.x,e.y,e.hx,e.hy) > 60) a = Math.atan2(e.hy-e.y, e.hx-e.x)+(Math.random()-0.5)*0.8;
          e.wx=Math.cos(a); e.wy=Math.sin(a);
          e.facing = e.wx>=0?1:-1;
        }
      }
      if(e.wx||e.wy) stepEnemy(e, e.wx*spd*0.55*dt, e.wy*spd*0.55*dt);
    }

    // soft separation so flocks don't overlap into one blob
    for(const o of G.enemies){
      if(o===e||o.dead) continue;
      const dd=dist(e.x,e.y,o.x,o.y);
      if(dd<e.r+o.r && dd>0.01){
        const pa=Math.atan2(e.y-o.y,e.x-o.x), push=(e.r+o.r-dd)*0.5;
        stepEnemy(e, Math.cos(pa)*push*dt*16, Math.sin(pa)*push*dt*16);
      }
    }
  }
}
// What actually comes out at the end of a wind-up. Split out so every species
// shares the same timing and only the payload differs.
function creatureStrike(e, T0){
  recordCreature(e.kind);
  const a = Math.atan2(e.aimY-e.y, e.aimX-e.x);
  if(e.hurling && T0.hurl){
    e.hurling = false;
    spawnShot(e.x, e.y-6, a, T0.hurl.spd, T0.hurl.dmg, T0.hurl.style, 1,
              { foe:true, r:5, life:1.4 });
    Sfx.gun();
    return;
  }
  switch(T0.atkKind){
    case 'spit':
      spawnShot(e.x, e.y-4, a, T0.shotSpd||150, T0.atk, T0.shotStyle||'spark', 1,
                { foe:true, r:4 });
      Sfx.gun();
      break;
    case 'nova':
      G.hitmarks.push({ kind:'burst', x:e.x, y:e.y, r:T0.atkRange+8,
                        col:T0.col.accent, life:0.34, max:0.34 });
      if(dist(e.x,e.y,player.x,player.y) < T0.atkRange+8) hurtPlayer(T0.atk, e.x, e.y);
      Sfx.hit();
      break;
    case 'lunge':
      Sfx.swing(0);
      break;
    default: {          // 'melee' — a short arc in the facing direction
      G.hitmarks.push({ kind:'cleave', x:e.x, y:e.y, ang:a, arc:1.5,
                        range:T0.atkRange+6, col:T0.col.accent, life:0.26, max:0.26 });
      if(dist(e.x,e.y,player.x,player.y) < T0.atkRange+10 &&
         Math.abs(angDiff(a, Math.atan2(player.y-e.y, player.x-e.x))) < 1.0)
        hurtPlayer(T0.atk, e.x, e.y);
      Sfx.swing(0);
    }
  }
}

function stepEnemy(e,ddx,ddy){
  // summoned walls block creatures but never the player
  if(walkableAt(e.x+ddx, e.y) && !wallBlocks(e.x+ddx, e.y)) e.x+=ddx;
  if(walkableAt(e.x, e.y+ddy) && !wallBlocks(e.x, e.y+ddy)) e.y+=ddy;
  e.x=clamp(e.x,8,G.area.w*TILE-8);
  e.y=clamp(e.y,10,G.area.h*TILE-8);
}

// ============================================================================
// NPCs
// ============================================================================
// Nine palettes to draw costumes from. Kept as data so a new citizen is one
// line in the roster rather than a block of colour literals.
const NPC_PAL = {
  ironmonger:{ hair:'#3a2a1a', hairD:'#241a10', dress:'#3d3f48', dressD:'#26282f',
               apron:'#6b4a2a', apronD:'#472f1a', skin:C.skin2, skinD:C.skin1 },
  lapidary:  { hair:'#6b3a6b', hairD:'#452445', dress:'#2f3a52', dressD:'#1e2536',
               apron:'#6b3fa8', apronD:'#452a68', skin:C.skin3, skinD:C.skin2 },
  cook:      { hair:'#8a4a2a', hairD:'#5f3018', dress:'#54402e', dressD:'#36291d',
               apron:'#c8452b', apronD:'#8f2c16', skin:C.skin3, skinD:C.skin2 },
  broker:    { hair:'#1b1118', hairD:'#0b070c', dress:'#2a2433', dressD:'#191420',
               apron:'#4a8f45', apronD:'#2c5e30', skin:C.skin2, skinD:C.skin1 },
  runner:    { hair:'#c9a81e', hairD:'#8a6a12', dress:'#3d86b8', dressD:'#1f5578',
               apron:'#c9a81e', apronD:'#8a6a12', skin:C.skin3, skinD:C.skin2 },
  elder:     { hair:'#c9c5bd', hairD:'#8a867e', dress:'#42404c', dressD:'#2b2a33',
               apron:'#7d3038', apronD:'#5a2128', skin:C.skin2, skinD:C.skin1 },
  warden:    { hair:'#3a2a1a', hairD:'#241a10', dress:'#3a4654', dressD:'#242c38',
               apron:'#7d3038', apronD:'#5a2128', skin:C.skin3, skinD:C.skin2 },
  engineer:  { hair:'#5a3a1a', hairD:'#3a2410', dress:'#3f4a3a', dressD:'#283024',
               apron:'#8a6a12', apronD:'#4e3b0c', skin:C.skin2, skinD:C.skin1 },
  scholar:   { hair:'#4a2f1c', hairD:'#2f1d10', dress:'#3a2f52', dressD:'#241c34',
               apron:'#b8ae8a', apronD:'#7d7660', skin:C.skin3, skinD:C.skin2 },
  forgebound:{ hair:'#2a1a20', hairD:'#170e12', dress:'#47303a', dressD:'#2c1d24',
               apron:'#c8452b', apronD:'#8f2c16', skin:C.skin2, skinD:C.skin1 },
  clerk:     { hair:'#8a867e', hairD:'#5f5c56', dress:'#2f4a63', dressD:'#1d2f40',
               apron:'#b8ae8a', apronD:'#7d7660', skin:C.skin3, skinD:C.skin2 },
  miner:     { hair:'#3a2a1a', hairD:'#241a10', dress:'#3a3630', dressD:'#24211c',
               apron:'#6b5220', apronD:'#453510', skin:C.skin2, skinD:C.skin1 }
};

// The Cogway's population. Each entry is an angle around the ring and a
// radius, so people stand along the street rather than on a grid the curve
// then cuts through. `r` near STREET_R-2 puts them behind their stall.
// Traders buy salvage. `buys:true` is all it takes — talkToNPC turns the
// trade into an extra line of their own dialogue rather than a separate menu,
// which keeps selling inside the conversation you were having anyway.
const COGWAY_FOLK = [
  { id:'vosk', name:'Vosk', build:'vendor', pal:'ironmonger', ang:-1.4124, r:COG.OUTER, dir:0, buys:true,
    lines:[
      "Iron, rivets, brace plate, cable. If it holds a city up, I sell it.",
      "You're Forgebound, so you'll want the thin stuff — light, and it fails politely instead of all at once.",
      "No, I'll not take Guild scrip. Third ring can do what it likes; up here we deal in weight."
    ] },
  { id:'halla', name:'Halla Pike', build:'vendor', pal:'lapidary', ang:-0.7841, r:COG.OUTER, dir:0, buys:true,
    lines:[
      "Careful where you put your hands. Half of what's on that cloth is sharper than your blades.",
      "Six colours, six dragons. Everyone assumes we dye them. We don't — that's what comes out of the rock.",
      "The violet ones come up from the deepest cuts. They're cheapest, and nobody will tell me why."
    ] },
  // The friendliest patter on the ring, attached to the coldest arithmetic.
  // He is not lying to you — he tells you exactly what he is doing, in the
  // same voice he uses to sell you a skewer.
  { id:'tolliver', name:'Philicious', build:'vendor', pal:'cook', ang:-0.1558, r:COG.OUTER, dir:0, buys:true,
    lines:[
      "Skewers! Two bits, still spitting! You want the quail — everybody wants the quail.",
      "Everybody wants the quail because I price the quail so everybody wants the quail. I am not a cook. I am a cold hard calculator in an apron.",
      "Nineteen years on this pitch. I know what a Forgebound pays after a bad week, what a Guild clerk pays on a good one, and to the Aion what each of you will walk away over.",
      "You are hungry, you are carrying salvage, and you have not eaten since the Verge. That is three numbers. The skewer is four bits.",
      "Don't look wounded. You'd have paid five. I rounded down because you'll be back."
    ] },
  { id:'sable', name:'Sable', build:'vendor', pal:'broker', ang:0.4726, r:COG.OUTER, dir:0, buys:true,
    lines:[
      "That's a fine hatchling. Bright eyes. Healthy scale.",
      "I trade in what they eat — mutagens, resonant scrap, the odd thing that shouldn't be sold at all.",
      "Feed it something from the bottom of the Pit and it'll grow strange. Strange is worth money. Remember that."
    ] },
  { id:'nim', name:'Cryser', build:'child', pal:'runner', ang:1.25, r:COG.INNER, dir:0,
    lines:[
      "Message? Message! I'm the fastest on the ring, ask anyone, ask Tolliver —",
      "Four rings down and back before the bell, that's my record. I only fell once.",
      "You're not supposed to go past the Undercroft. I've been past the Undercroft."
    ] },
  { id:'ost', name:'Grandmother Ost', build:'elder', pal:'elder', ang:1.95, r:COG.INNER, dir:1,
    lines:[
      "Sit if you like. I've the bench and the view and nowhere I need to be.",
      "I've watched that hole seventy years. They tell you it's a mine. It was a mine.",
      "It's deeper every spring and no one digs in spring. You work that out and come tell me."
    ] },
  { id:'kesh', name:'Warden Kesh', build:'guard', pal:'warden', ang:2.60, r:COG.OUTER, dir:0, static:true,
    lines:[
      "Cogway's open. Forgeworks is open. Guild Quarter wants your licence at the stair.",
      "Don't climb the railing. I'm not being officious — we lose two a year and they're always sure-footed people.",
      "If the lift bell rings three times, get off the iron and onto stone. That's all you need to know."
    ] },
  { id:'ivo', name:'Deep-Marshal Ivo', build:'engineer', pal:'engineer', ang:-2.55, r:COG.INNER, dir:0,
    lines:[
      "Cage is down at the fourth. Be a while. You can wait or you can walk, and walking takes a day.",
      "Chain's three hundred years of somebody else's arithmetic and it has never once been wrong.",
      "I don't look down any more. You get used to the noise instead. The noise tells you more."
    ] },
  { id:'weal', name:'Archivist Weal', build:'scholar', pal:'scholar', ang:-2.00, r:COG.OUTER, dir:0,
    lines:[
      "The Codex Hall is two rings down and I would rather be in it, but the light up here is better.",
      "Every creature you kill has something to teach. A Savant could learn it outright. The rest of you just get the note.",
      "Bring me anything that shouldn't exist. I'll tell you what it is and then argue with myself about it for a month."
    ] },
  { id:'rook', name:'Rook', build:'townsfolk', pal:'forgebound', ang:0.95, r:COG.OUTER, dir:1,
    lines:[
      "Off duty. Don't. Whatever it is, don't.",
      "Two weeks in the Rustfields with a party that couldn't hold a line. Came back with everyone, though.",
      "Get a tank. I mean it. Find a Bulwark, buy them a drink, never let them leave."
    ] },
  { id:'marta', name:'Marta Quill', build:'townsfolk', pal:'clerk', ang:-2.95, r:COG.OUTER, dir:0,
    lines:[
      "Board's up. Bounties on the left, notices on the right, and don't pin anything over the Guild seal.",
      "Three postings for the Rustfields and nobody's taken one. Quail don't sound frightening enough, I suppose.",
      "Somebody keeps putting up a notice for a lost hatchling. Same notice, eleven days running. I haven't the heart."
    ] },
  { id:'thorne', name:'Gate-Warden Jarod', build:'guard', pal:'warden', ang:-0.34, r:COG.OUTER, dir:0,
    lines:()=>{
      if(G.locks.scarpgate) return [
        "Seal's down. On your head, then.",
        "Keep the cliffs on your left and don't let a bear get above you. That's the whole of the advice.",
        "And come back. I'd rather do the paperwork for a live one."
      ];
      if(player.aethiteMax >= AETHITE_LOCKS.scarpgate.need) return [
        "You've got the measure of it now. I can see it on the beast.",
        "Seal answers to store, not to rank. Put your hand on it and pour.",
        "It'll take "+AETHITE_LOCKS.scarpgate.cost+" out of you and it won't give it back. Be certain."
      ];
      return [
        "Gate's sealed and it stays sealed. Not my doing — the seal decides.",
        "Scarp eats people. Not the rams, they just knock you down. It's the bears, and the hawks that bring the sky down on you.",
        "The seal reads your hatchling, not you. It wants a store of "+AETHITE_LOCKS.scarpgate.need+
          " and yours holds "+player.aethiteMax+".",
        "Grow it. Finish what Hayla set you. Bleed something in the Verge and the Shoals. Fill that codex. Come back when the beast can carry more."
      ];
    } },
  { id:'bell', name:'Ashen Bell', build:'miner', pal:'miner', ang:2.15, r:COG.OUTER, dir:0,
    lines:[
      "Came up this morning. First light I've seen in nine days and it's grey light at that.",
      "We were cutting a new gallery under the Undercroft. Hit a seam that was already hollow.",
      "Something had been living in it. Not recently. But the walls were smooth, and nobody smoothed them."
    ] },

  // ---- THREE CHILDREN, ONE STALL -------------------------------------------
  //
  // The only NPCs in the game that move. They run a ring around a stall in the
  // south-west of the Cogway, at three different radii and three different
  // speeds, so one is always gaining on another. Walk up and they stop dead —
  // children do — and talk to you until you leave.
  //
  // `chase` carries the orbit; updateNPCs advances it. Everyone else in the
  // city is still furniture, which is what makes these three read as alive.
  { id:'jood',   name:'Jood',   build:'townsfolk', pal:'forgebound', ang:2.356, r:COG.INNER, dir:0,
    chase:{ r:20, spd:1.05, ph:0 },
    lines:[
      "Whoa \u2014 sorry, sorry, didn't see you. I'm IT. I'm always IT, because I'm the biggest and they think that's fair.",
      "It isn't fair. I can't turn. Tytous can turn like a cat and Mabrel just CHEATS, she goes under the stall \u2014",
      "...she drives me completely mad. Best part of my day, though. Every day."
    ] },
  { id:'mabrel', name:'Mabrel', build:'townsfolk', pal:'clerk', ang:2.356, r:COG.INNER, dir:0,
    chase:{ r:14, spd:-1.35, ph:2.1 },
    lines:[
      "Don't tell them where I am. Don't. I'm winning.",
      "Jood says going under the stall is cheating. Jood is twice my size and has legs like a cart horse, so I've decided it is not.",
      "They're the loudest, slowest, most infuriating boys on this ring and I would not swap them for anything. Don't tell them that either."
    ] },
  { id:'tytous', name:'Tytous', build:'child', pal:'runner', ang:2.356, r:COG.INNER, dir:0,
    chase:{ r:26, spd:1.62, ph:4.3 },
    lines:[
      "I'm fastest! I'm fastest but my legs are SHORT so it works out about even, which Mabrel says is called maths.",
      "Jood lets me win sometimes. He thinks I don't notice. I notice.",
      "We fight about it every single day and then we do it again tomorrow. That's what makes them mine."
    ] },

  // The city's money explained by the woman who counts it. She is a changer
  // rather than a vendor — she does not buy your salvage, she explains what
  // she would be paying you IN, which is the one thing every other trader on
  // the ring takes for granted.
  { id:'wen', name:'Changer Wen', build:'clerk', pal:'clerk', ang:-1.05, r:COG.INNER, dir:0,
    lines:()=>{
      const held = G.marks|0;
      const base = [
        "New, aren't you. Hold out your crystal — no, not like that, palm flat, thumb clear of the facet.",
        "There. That's an Aion moving. One ionic charge of Aethite, off my stone and onto yours.",
        "That's all money is here. Not coin, not paper \u2014 charge. The crystal is only the jar.",
        "Everyone carries one. Pocket, glove, sewn into a cuff if they're nervous. Touch two together and the charge runs from the fuller to the emptier until somebody pulls away.",
        "Which is why you settle a price BEFORE you touch. Pull away late and you've been generous; pull away early and you've been rude."
      ];
      if(held > 400) base.push(
        "You're carrying "+held+". That's a warm stone. Keep it out of the rain and off the iron.");
      else if(held > 0) base.push(
        "You're carrying "+held+". Barely a glow. Sell some scrap to Vosk and come back.");
      else base.push(
        "Yours is dark, by the way. Empty. Nothing shameful in it \u2014 everybody starts dark.");
      base.push(
        "A dead crystal is just a rock. A cracked one is worse: the charge goes out of it over a week and you cannot feel it going.");
      return base;
    } }
];

function spawnNPCs(areaId){
  G.npcs.length=0;
  if(areaId==='cogway'){
    for(const f of COGWAY_FOLK){
      const p = ringPx(f.ang, f.r);
      G.npcs.push({
        id:f.id, name:f.name, x:p.x, y:p.y, build:f.build, lines:f.lines, buys:f.buys,
        dir:f.dir|0, anim:0, frame:0, moving:false, bob:Math.random()*6,
        static:!!f.static, look:NPC_PAL[f.pal],
        // the point a chaser orbits: where they were placed
        chase:f.chase ? { ...f.chase } : null, homeX:p.x, homeY:p.y
      });
      // A chaser's placement is the CENTRE of its orbit — the stall — so it
      // has to be moved out to the ring straight away or the first frame
      // draws it standing inside the furniture.
      if(f.chase){
        const n = G.npcs[G.npcs.length-1];
        n.x = n.homeX + Math.cos(f.chase.ph)*f.chase.r;
        n.y = n.homeY + Math.sin(f.chase.ph)*f.chase.r*0.62;
      }
    }
  }
  if(areaId==='clearing'){
    G.npcs.push({
      id:'hayla', name:'Hayla', x:29*TILE+8, y:18*TILE+10, quest:true, build:'matron',
      dir:0, anim:0, bob:Math.random()*6,
      look:{ hair:'#8a4a2a', hairD:'#5f3018', dress:'#4a6b8a', dressD:'#2f4a63',
             apron:'#d8cdb4', apronD:'#b0a389', skin:C.skin3, skinD:C.skin2 }
    });
  }
  if(areaId==='gate'){
    G.npcs.push({
      id:'guard1', name:'Gate Warden', x:(40-9)*TILE+8, y:13*TILE+10,
      build:'guard', dir:0, anim:0, bob:Math.random()*6, static:true,
      look:{ hair:'#3a2a1a', hairD:'#241a10', dress:'#3a4654', dressD:'#242c38',
             apron:'#7d3038', apronD:'#5a2128', skin:C.skin2, skinD:C.skin1 }
    });
    G.npcs.push({
      id:'guard2', name:'Gate Warden', x:(40-9)*TILE+8, y:19*TILE+10,
      build:'guard', dir:1, anim:0, bob:Math.random()*6, static:true,
      look:{ hair:'#5a3a1a', hairD:'#3a2410', dress:'#3a4654', dressD:'#242c38',
             apron:'#7d3038', apronD:'#5a2128', skin:C.skin3, skinD:C.skin2 }
    });
  }
}
function updateNPCs(dt){
  for(const n of G.npcs){
    n.anim += dt*2; n.bob += dt*2.4;

    // --- the three who actually run about
    if(n.chase){
      const near = dist(n.x, n.y, player.x, player.y) < 54;
      const busy = G.state===ST.DIALOGUE;
      n.halted = near || busy;
      if(!n.halted){
        n.chase.ph += dt*n.chase.spd;
        const px2 = n.homeX + Math.cos(n.chase.ph)*n.chase.r;
        const py2 = n.homeY + Math.sin(n.chase.ph)*n.chase.r*0.62;   // seen from above
        // face the way they are going, not the way they are standing
        n.dir = Math.abs(px2-n.x) > Math.abs(py2-n.y)
              ? (px2>n.x ? 3 : 2) : (py2>n.y ? 0 : 1);
        n.x = px2; n.y = py2;
        n.moving = true;
        n.frame = Math.floor(n.anim*3)%4;
      } else {
        n.moving = false; n.frame = 0;
      }
    }

    if(!n.static){
      // face the player when they're close enough to talk
      const d = dist(n.x,n.y,player.x,player.y);
      if(d<48){
        const a=Math.atan2(player.y-n.y, player.x-n.x);
        n.dir = Math.abs(Math.cos(a))>Math.abs(Math.sin(a)) ? (Math.cos(a)>0?3:2) : (Math.sin(a)>0?0:1);
      }
    }
  }
}
function nearestNPC(){
  let best=null, bd=30;
  for(const n of G.npcs){
    const d=dist(n.x,n.y,player.x,player.y);
    if(d<bd){ bd=d; best=n; }
  }
  return best;
}

// ============================================================================
// PARTICLES & FLOATING TEXT
// ============================================================================
function spark(x,y,col,s){
  if(G.particles.length>420) return;
  G.particles.push({ x,y, vx:(Math.random()-0.5)*70, vy:-24-Math.random()*50,
    life:0.22+Math.random()*0.26, max:0.5, kind:'spark', col, s:s||1 });
}
function floatText(x,y,txt,col,big){
  G.floats.push({ x,y,txt,col, life:0.85, max:0.85, big:!!big, vy:-26 });
}
function updateParticles(dt){
  for(let i=G.particles.length-1;i>=0;i--){
    const p=G.particles[i]; p.life-=dt;
    if(p.life<=0){ G.particles.splice(i,1); continue; }
    if(p.kind==='flame'){ p.vy-=26*dt; p.vx*=0.94; }
    else if(p.kind==='leaf'){ p.vy+=8*dt; p.vx+=Math.sin(G.time*3+p.x)*6*dt; }
    else if(p.kind==='mote'){ p.vy-=4*dt; }
    // Aethite steam: rises, slows, and curls. The curl is the whole read —
    // straight-up particles look like smoke, turning ones look like something
    // being driven out of you.
    else if(p.kind==='steam'){
      p.vy -= 16*dt;
      const turn = 2.6*dt;
      const nx = p.vx*Math.cos(turn) - p.vy*Math.sin(turn)*0.25;
      p.vx = nx*0.97;
      p.vx += Math.sin(p.life*9)*10*dt;
    }
    else p.vy+=150*dt;
    p.x+=p.vx*dt; p.y+=p.vy*dt;
  }
  for(let i=G.floats.length-1;i>=0;i--){
    const f=G.floats[i]; f.life-=dt; f.y+=f.vy*dt; f.vy*=0.90;
    if(f.life<=0) G.floats.splice(i,1);
  }
  for(let i=G.hitmarks.length-1;i>=0;i--){
    const h=G.hitmarks[i]; h.life-=dt; if(h.life<=0) G.hitmarks.splice(i,1);
  }
  // ambient life: drifting pollen outdoors, embers indoors
  if(!G.area.indoor){
    if(Math.random()<dt*7){
      G.particles.push({ x:G.cam.x+Math.random()*VW, y:G.cam.y+Math.random()*VH,
        vx:8+Math.random()*12, vy:-2+Math.random()*6, life:2.4, max:2.4,
        kind:'mote', col:Math.random()<0.5?'#e8e0a0':'#d0e8a0', s:1 });
    }
  } else if(Math.random()<dt*3){
    G.particles.push({ x:G.cam.x+Math.random()*VW, y:G.cam.y+VH*0.9,
      vx:(Math.random()-0.5)*6, vy:-8-Math.random()*8, life:2.0, max:2.0,
      kind:'mote', col:'#f0c070', s:1 });
  }
}
