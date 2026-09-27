
// ============================================================================
// THE IRONCLAD (GDD §8.1) — "The front line holds because I hold it."
// Greatsword, 3-hit combo, dodge roll with i-frames, and Momentum: consecutive
// hits stack to 5, max stacks empower the next ability, taking a hit resets it.
// ============================================================================

const player = {
  x: SPAWN_TX*TILE+8, y: SPAWN_TY*TILE+8,
  dx: 1, dy: 0, dir: 3,
  baseHp: 100, maxhp: 100, hp: 100,
  spd: 62,
  momentum: 0, momTimer: 0,
  anim: 0, frame: 0, moving: false,

  atkState: '',            // '', 'wind', 'active', 'recover'
  atkT: 0, comboStep: 0, comboWindow: 0, queued: false,
  atkHits: null,

  dodgeT: 0, dodgeCd: 0, dodgeDx: 0, dodgeDy: 0,
  iframe: 0, hurtFlash: 0,

  castT: 0, castKind: '',
  cds: [0,0,0,0],
  chargeT: 0, chargeDx: 0, chargeDy: 0, chargeHits: null,
  tempestT: 0, tempestHits: null, tempestPower: 0
};

// --- Ability table. Slots 1-4, equipped from the Ironclad's 8 skills.
const ABILITIES = [
  { key:'1', name:'Forge Cleave',      cd:4.0,  cast:0.16, desc:'180° slash. At max Momentum: 270°.' },
  { key:'2', name:'Iron Tempest',      cd:9.0,  cast:0.22, desc:'Spin. Consumes Momentum for bonus damage.' },
  { key:'3', name:'Unyielding Charge', cd:6.0,  cast:0.10, desc:'Dash through enemies. +2 Momentum on hit.' },
  { key:'4', name:'Earthsplitter',     cd:8.0,  cast:0.26, desc:'Shockwave + Stagger. At max: splits 3 ways.' }
];

const MAX_MOMENTUM = 5;

function addMomentum(n){
  const before = player.momentum;
  player.momentum = Math.min(MAX_MOMENTUM, player.momentum + n);
  player.momTimer = 4.0;
  if(player.momentum !== before){
    Sfx.momentum(player.momentum);
    if(player.momentum === MAX_MOMENTUM && before < MAX_MOMENTUM){
      Sfx.empowered();
      floatText(player.x, player.y-30, 'EMPOWERED', '#ffd98a');
      for(let i=0;i<14;i++) spark(player.x, player.y-8, '#ffd98a', 1.2);
    }
  }
}
function resetMomentum(){
  if(player.momentum>0){
    for(let i=0;i<6;i++) spark(player.x, player.y-10, '#8a7730', 1);
    player.momentum = 0;
  }
}
const isEmpowered = ()=> player.momentum >= MAX_MOMENTUM;
function attackPower(){ return MODS.atkMul; }

// ---------------------------------------------------------------- basic combo
const COMBO = [
  { wind:0.07, active:0.07, rec:0.13, dmg:11, arc:1.5, range:26, knock:34 },
  { wind:0.07, active:0.07, rec:0.13, dmg:12, arc:1.6, range:26, knock:36 },
  { wind:0.13, active:0.09, rec:0.22, dmg:19, arc:2.0, range:31, knock:78 }   // finisher
];

function startAttack(){
  if(player.dodgeT>0 || player.castT>0 || player.chargeT>0 || player.tempestT>0) return;
  if(player.atkState==='wind' || player.atkState==='active'){ player.queued = true; return; }
  const step = (player.comboWindow>0) ? (player.comboStep % COMBO.length) : 0;
  player.comboStep = step;
  player.atkState='wind'; player.atkT=0; player.atkHits=new Set();
  Sfx.swing(step);
}

function updateAttack(dt){
  player.comboWindow = Math.max(0, player.comboWindow - dt);
  if(!player.atkState) return;
  const C = COMBO[player.comboStep];
  player.atkT += dt;

  if(player.atkState==='wind' && player.atkT >= C.wind){
    player.atkState='active'; player.atkT=0;
    resolveArc(player.x, player.y, Math.atan2(player.dy,player.dx), C.arc, C.range,
               C.dmg*attackPower(), C.knock, player.atkHits, player.comboStep===2);
    G.hitmarks.push({ kind:'slash', x:player.x, y:player.y,
      ang:Math.atan2(player.dy,player.dx), arc:C.arc, range:C.range,
      life:0.13, max:0.13, heavy:player.comboStep===2 });
  }
  else if(player.atkState==='active' && player.atkT >= C.active){
    player.atkState='recover'; player.atkT=0;
  }
  else if(player.atkState==='recover' && player.atkT >= C.rec){
    player.atkState=''; player.atkT=0;
    player.comboStep = (player.comboStep+1) % COMBO.length;
    player.comboWindow = 0.34;
    if(player.queued){ player.queued=false; startAttack(); }
  }
}

// ---------------------------------------------------------------- hit volumes
function resolveArc(ox,oy,ang,arc,range,dmg,knock,hitSet,heavy){
  let landed = 0;
  for(const e of G.enemies){
    if(e.dead) continue;
    if(hitSet && hitSet.has(e.id)) continue;
    const d = dist(ox,oy,e.x,e.y);
    if(d > range + e.r) continue;
    const ea = Math.atan2(e.y-oy, e.x-ox);
    if(Math.abs(angDiff(ang, ea)) > arc/2) continue;
    if(hitSet) hitSet.add(e.id);
    const crit = Math.random() < (0.08 + MODS.critBonus);
    hurtEnemy(e, dmg*(crit?1.9:1), ox, oy, crit, knock/50);
    landed++;
  }
  if(landed){
    addMomentum(1);
    G.hitlag = Math.max(G.hitlag, heavy?0.075:0.045);
    G.shake = Math.max(G.shake, heavy?3.2:1.5);
  }
  return landed;
}

function resolveCircle(ox,oy,radius,dmg,knock,hitSet){
  let landed=0;
  for(const e of G.enemies){
    if(e.dead) continue;
    if(hitSet && hitSet.has(e.id)) continue;
    if(dist(ox,oy,e.x,e.y) > radius + e.r) continue;
    if(hitSet) hitSet.add(e.id);
    const crit = Math.random() < (0.08 + MODS.critBonus);
    hurtEnemy(e, dmg*(crit?1.9:1), ox, oy, crit, knock/50);
    landed++;
  }
  return landed;
}

function resolveLine(ox,oy,ang,len,halfW,dmg,knock,hitSet,stagger){
  let landed=0;
  const cx=Math.cos(ang), cy=Math.sin(ang);
  for(const e of G.enemies){
    if(e.dead) continue;
    if(hitSet && hitSet.has(e.id)) continue;
    const rx=e.x-ox, ry=e.y-oy;
    const along = rx*cx + ry*cy;
    if(along < -6 || along > len) continue;
    const perp = Math.abs(-rx*cy + ry*cx);
    if(perp > halfW + e.r) continue;
    if(hitSet) hitSet.add(e.id);
    const crit = Math.random() < (0.08 + MODS.critBonus);
    hurtEnemy(e, dmg*(crit?1.9:1), ox, oy, crit, knock/50);
    if(stagger) applyStagger(e, stagger);
    landed++;
  }
  return landed;
}

// ---------------------------------------------------------------- abilities
function useAbility(i){
  if(player.cds[i] > 0) return;
  if(player.dodgeT>0 || player.castT>0 || player.chargeT>0 || player.tempestT>0) return;
  const A = ABILITIES[i];
  player.cds[i] = A.cd * MODS.cdrMul;
  player.castT = A.cast;
  player.castKind = i;
  player.atkState=''; player.queued=false;

  const ang = Math.atan2(player.dy, player.dx);
  const emp = isEmpowered();

  if(i===0){                                   // Forge Cleave
    const arc = emp ? 4.71 : 3.14;             // 270 vs 180 degrees
    const dmg = (emp ? 26 : 18) * attackPower();
    setTimeout0(()=>{
      resolveArc(player.x, player.y, ang, arc, 34, dmg, 62, new Set(), true);
      G.hitmarks.push({ kind:'cleave', x:player.x, y:player.y, ang, arc, range:34, life:0.24, max:0.24, emp });
      Sfx.cleave(); G.shake=Math.max(G.shake, emp?5:3.2);
    }, A.cast);
  }
  else if(i===1){                              // Iron Tempest — consumes Momentum
    player.tempestPower = player.momentum;
    player.tempestT = 0.52;
    player.tempestHits = new Set();
    resetMomentum();
    Sfx.tempest();
  }
  else if(i===2){                              // Unyielding Charge
    setTimeout0(()=>{
      player.chargeT = 0.24;
      player.chargeDx = Math.cos(ang); player.chargeDy = Math.sin(ang);
      player.chargeHits = new Set();
      Sfx.charge();
    }, A.cast);
  }
  else if(i===3){                              // Earthsplitter
    setTimeout0(()=>{
      const dmg = 22 * attackPower();
      const angles = emp ? [ang-0.72, ang, ang+0.72] : [ang];
      for(const a of angles){
        resolveLine(player.x, player.y, a, 76, 11, dmg, 55, new Set(), 3.0);
        G.hitmarks.push({ kind:'quake', x:player.x, y:player.y, ang:a, len:76, life:0.34, max:0.34 });
      }
      Sfx.quake(); G.shake=Math.max(G.shake, emp?7:5);
    }, A.cast);
  }
}

// Tiny deferred-action queue. Avoids real timers so the sim stays
// deterministic and pausable — everything advances on the game clock.
const pending = [];
function setTimeout0(fn, delay){ pending.push({ fn, t:delay }); }
function updatePending(dt){
  for(let i=pending.length-1;i>=0;i--){
    pending[i].t -= dt;
    if(pending[i].t<=0){ const f=pending[i].fn; pending.splice(i,1); f(); }
  }
}

// ---------------------------------------------------------------- player tick
function updatePlayer(dt){
  // timers
  for(let i=0;i<4;i++) player.cds[i] = Math.max(0, player.cds[i]-dt);
  player.dodgeCd = Math.max(0, player.dodgeCd-dt);
  player.iframe  = Math.max(0, player.iframe-dt);
  player.hurtFlash = Math.max(0, player.hurtFlash-dt);
  player.castT   = Math.max(0, player.castT-dt);

  // Momentum decays if you stop connecting
  if(player.momentum>0){
    player.momTimer -= dt;
    if(player.momTimer<=0){ player.momentum--; player.momTimer=1.3; }
  }

  // --- input vector
  let mx=0,my=0;
  if(keys['a']||keys['arrowleft'])  mx-=1;
  if(keys['d']||keys['arrowright']) mx+=1;
  if(keys['w']||keys['arrowup'])    my-=1;
  if(keys['s']||keys['arrowdown'])  my+=1;
  if(mx||my){ const l=Math.hypot(mx,my); mx/=l; my/=l; }

  // --- Unyielding Charge movement (overrides normal control)
  if(player.chargeT>0){
    player.chargeT -= dt;
    const sp = 270;
    moveWithCollision(player.chargeDx*sp*dt, player.chargeDy*sp*dt);
    const landed = resolveCircle(player.x, player.y, 17, 15*attackPower(), 95, player.chargeHits);
    if(landed){ addMomentum(2); G.shake=Math.max(G.shake,2.6); }
    for(let i=0;i<2;i++) spark(player.x-player.chargeDx*8, player.y+4, PAL.dirtL, 1);
    if(player.chargeT<=0) player.chargeHits=null;
  }
  // --- Iron Tempest (spin in place, repeated ticks)
  else if(player.tempestT>0){
    player.tempestT -= dt;
    if(mx||my){ player.dx=mx; player.dy=my; setDir(mx,my); }
    moveWithCollision(mx*player.spd*0.45*dt, my*player.spd*0.45*dt);
    if(Math.random() < dt*26){
      const dmg = (9 + player.tempestPower*7) * attackPower();
      const hits = resolveCircle(player.x, player.y, 32, dmg, 55, null);
      if(hits){ G.hitlag=Math.max(G.hitlag,0.03); G.shake=Math.max(G.shake,2.2); }
    }
    for(let i=0;i<2;i++){
      const a=Math.random()*Math.PI*2;
      G.particles.push({x:player.x+Math.cos(a)*30, y:player.y+Math.sin(a)*30-6,
        vx:Math.cos(a)*30, vy:Math.sin(a)*30, life:0.16, max:0.22, kind:'spark', col:'#e8c866', s:1});
    }
    if(player.tempestT<=0) player.tempestHits=null;
  }
  // --- dodge roll
  else if(player.dodgeT>0){
    player.dodgeT -= dt;
    const t = 1 - (player.dodgeT/0.34);
    const sp = 190 * (1 - t*0.55);
    moveWithCollision(player.dodgeDx*sp*dt, player.dodgeDy*sp*dt);
  }
  // --- normal movement
  else {
    const slowed = (player.atkState==='wind'||player.atkState==='active') ? 0.35
                 : player.atkState==='recover' ? 0.55
                 : player.castT>0 ? 0.3 : 1;
    if(mx||my){
      player.dx=mx; player.dy=my; setDir(mx,my);
      const sp = player.spd * MODS.moveMul * slowed;
      moveWithCollision(mx*sp*dt, my*sp*dt);
      player.moving=true; player.anim += dt*8.5;
    } else { player.moving=false; player.anim += dt*2.4; }
  }
  player.frame = Math.floor(player.anim)%4;

  updateAttack(dt);
}

function setDir(mx,my){
  if(Math.abs(mx) > Math.abs(my)) player.dir = mx>0 ? 3 : 2;
  else player.dir = my>0 ? 0 : 1;
}

function moveWithCollision(ddx,ddy){
  if(canStand(player.x+ddx, player.y)) player.x += ddx;
  if(canStand(player.x, player.y+ddy)) player.y += ddy;
  player.x = clamp(player.x, 8, WORLD_W-8);
  player.y = clamp(player.y, 10, WORLD_H-6);
}

function startDodge(){
  if(player.dodgeCd>0 || player.dodgeT>0 || player.chargeT>0 || player.tempestT>0) return;
  let mx=0,my=0;
  if(keys['a']||keys['arrowleft'])  mx-=1;
  if(keys['d']||keys['arrowright']) mx+=1;
  if(keys['w']||keys['arrowup'])    my-=1;
  if(keys['s']||keys['arrowdown'])  my+=1;
  if(!mx && !my){ mx=player.dx; my=player.dy; }
  const l=Math.hypot(mx,my)||1;
  player.dodgeDx=mx/l; player.dodgeDy=my/l;
  player.dodgeT = 0.34; player.dodgeCd = 0.62;
  player.iframe = Math.max(player.iframe, 0.26);   // GDD: dodge grants i-frames
  player.atkState=''; player.queued=false;
  Sfx.dodge();
}

function hurtPlayer(dmg, sx, sy){
  if(player.iframe>0 || G.state!==ST.PLAY) return;

  // Mini Shield: the dragon eats one hit on a cooldown
  if(MODS.shield && dragon.shieldCd<=0){
    dragon.shieldCd = 12;
    player.iframe = 0.5;
    floatText(player.x, player.y-30, 'BLOCKED', '#8fd6ff');
    for(let i=0;i<12;i++) spark(player.x, player.y-10, '#8fd6ff', 1.2);
    Sfx.ui();
    return;
  }

  const taken = Math.max(1, Math.round(dmg * MODS.defMul));
  player.hp -= taken;
  G.dmgTaken += taken;
  player.iframe = 0.7;
  player.hurtFlash = 0.35;
  resetMomentum();                                  // GDD: taking a hit wipes Momentum
  G.shake = Math.max(G.shake, 4.5);
  G.flash = Math.max(G.flash, 0.3);
  floatText(player.x, player.y-26, '-'+taken, '#ff6a5a');
  Sfx.hurt();

  // Serpent Tail: counter-swipe at whatever hit us
  if(MODS.tail && dragon.tailCd<=0){
    dragon.tailCd = 3.0;
    const e = nearestEnemy(player.x, player.y, 40);
    if(e){
      dragonDamage(e, 12*MODS.dragonDmgMul, dragon.x, dragon.y, 'tail');
      floatText(dragon.x, dragon.y-12, 'COUNTER', '#ffd98a');
    }
  }

  if(player.hp<=0){
    player.hp = 0;
    G.lives--;
    if(G.lives<=0){ G.state=ST.WIPE; Sfx.wipe(); }
    else {
      // respawn at the deployment point with a moment of grace
      player.hp = player.maxhp;
      player.x = SPAWN_TX*TILE+8; player.y = SPAWN_TY*TILE+8;
      player.iframe = 2.0;
      toast('DOWNED — '+G.lives+' LIVES LEFT');
      Sfx.die();
    }
  }
}

// ============================================================================
// RUSTFIELDS ENEMIES (GDD §6, §14) — readable telegraphs, learnable patterns.
// ============================================================================

let enemyId = 1;

const ENEMY_TYPES = {
  rat: {
    name:'Feral Gear-Rat', hp:22, spd:52, r:5, dmg:7, touch:false,
    range:15, windup:0.32, strike:0.12, recover:0.42, knockRes:0.2, xp:1,
    col:{ body:'#7a5c38', bodyD:'#54402a', metal:'#8f8b83', eye:'#ff6a3c' }
  },
  drone: {
    name:'Scrap Drone', hp:38, spd:44, r:6, dmg:10, touch:false,
    range:19, windup:0.46, strike:0.16, recover:0.55, knockRes:0.35, xp:2,
    col:{ body:'#6e6a63', bodyD:'#4c4944', metal:'#c8a13c', eye:'#ff3c3c' }
  },
  golem: {
    name:'Scrap Golem', hp:95, spd:26, r:9, dmg:18, touch:false,
    range:24, windup:0.72, strike:0.20, recover:0.80, knockRes:0.8, xp:5,
    col:{ body:'#a4502a', bodyD:'#7a3a1d', metal:'#6e6a63', eye:'#ffb43c' }
  }
};

function spawnEnemy(kind, x, y){
  const T0 = ENEMY_TYPES[kind];
  G.enemies.push({
    id: enemyId++, kind, name:T0.name,
    x, y, vx:0, vy:0,
    hp: T0.hp, maxhp: T0.hp, r: T0.r, spd: T0.spd,
    state:'idle', stateT:0, dead:false, deadT:0,
    burn:0, burnT:0, slow:0, slowT:0, stagger:0,
    flash:0, anim: Math.random()*4, bob: Math.random()*6,
    facing: 1, knock:0, knockX:0, knockY:0,
    stuckT:0, lastX:x, lastY:y, detourT:0, detourDir:1, aliveT:0
  });
}

function nearestEnemy(x,y,maxD,exclude){
  let best=null, bd=maxD||1e9;
  for(const e of G.enemies){
    if(e.dead || e===exclude) continue;
    const d = dist(x,y,e.x,e.y);
    if(d < bd){ bd=d; best=e; }
  }
  return best;
}

function hurtEnemy(e, dmg, sx, sy, crit, knockMul){
  if(e.dead) return;
  const T0 = ENEMY_TYPES[e.kind];
  const amount = Math.max(1, Math.round(dmg));
  e.hp -= amount;
  e.flash = 0.12;
  G.dmgDealt += amount;

  floatText(e.x + (Math.random()-0.5)*6, e.y-12-e.r, String(amount),
            crit ? '#ffd24a' : '#ffffff', crit);
  if(crit){ Sfx.crit(); G.hitlag=Math.max(G.hitlag,0.085); }
  else Sfx.hit();

  // knockback, resisted by heavier enemies
  if(knockMul){
    const a = Math.atan2(e.y-sy, e.x-sx);
    const power = 100*knockMul*(1-T0.knockRes);
    e.knockX = Math.cos(a)*power; e.knockY = Math.sin(a)*power;
    e.knock = 0.18;
  }
  for(let i=0;i<(crit?10:5);i++) spark(e.x, e.y-e.r, crit?'#ffd24a':'#ffcf9a', crit?1.3:1);

  if(e.hp<=0) killEnemy(e);
}

function killEnemy(e){
  e.dead = true; e.deadT = 0.4; e.hp = 0;
  G.kills++;
  gainBond(1.0, false);
  Sfx.die();
  for(let i=0;i<16;i++) spark(e.x, e.y-e.r, i%3?PAL.rust:PAL.ironL, 1.4);
  for(let i=0;i<6;i++)
    G.particles.push({x:e.x,y:e.y-e.r,vx:(Math.random()-0.5)*70,vy:-40-Math.random()*50,
      life:0.5,max:0.6,kind:'debris',col:PAL.iron,s:1});
}

function applyBurn(e, dur){ if(e.dead) return; e.burn = Math.max(e.burn, dur); }
function applySlow(e, amt, dur){ if(e.dead) return; e.slow = Math.max(e.slow, amt); e.slowT = Math.max(e.slowT, dur); }
function applyStagger(e, dur){
  if(e.dead) return;
  e.stagger = Math.max(e.stagger, dur);
  e.state='stagger'; e.stateT=0;
  floatText(e.x, e.y-16-e.r, 'STAGGER', '#c9a2ff');
}

function updateEnemies(dt){
  for(let i=G.enemies.length-1;i>=0;i--){
    const e = G.enemies[i];
    const T0 = ENEMY_TYPES[e.kind];

    if(e.dead){ e.deadT -= dt; if(e.deadT<=0) G.enemies.splice(i,1); continue; }

    e.flash = Math.max(0, e.flash-dt);
    e.anim += dt*6; e.bob += dt*3.4;
    e.aliveT += dt;

    // Hard safety valve: an enemy that has spent 22s unable to reach the player
    // redeploys near them. Guarantees a wave always resolves.
    if(e.aliveT > 22 && dist(e.x,e.y,player.x,player.y) > 110){
      for(let a=0;a<120;a++){
        const ang = Math.random()*Math.PI*2, rad = 66 + Math.random()*34;
        const nx = player.x + Math.cos(ang)*rad, ny = player.y + Math.sin(ang)*rad;
        if(!walkableTile(Math.floor(nx/TILE), Math.floor(ny/TILE))) continue;
        for(let k=0;k<8;k++) spark(e.x, e.y-e.r, PAL.rust, 1);
        e.x=nx; e.y=ny; e.aliveT=0; e.detourT=0; e.stuckT=0;
        e.lastX=nx; e.lastY=ny;
        for(let k=0;k<8;k++) spark(nx, ny-e.r, PAL.amber, 1.2);
        break;
      }
    }

    // --- damage over time
    if(e.burn>0){
      e.burn -= dt; e.burnT -= dt;
      if(e.burnT<=0){
        e.burnT = 0.5;
        const tick = 3;
        e.hp -= tick; G.dmgDealt += tick;
        floatText(e.x+(Math.random()-0.5)*5, e.y-10-e.r, String(tick), '#ff9a3c');
        for(let k=0;k<3;k++)
          G.particles.push({x:e.x+(Math.random()-0.5)*8,y:e.y-4,vx:(Math.random()-0.5)*10,vy:-22,
            life:0.3,max:0.4,kind:'flame',col:'#ffa43c',s:1});
        if(Math.random()<0.3) Sfx.burn();
        if(e.hp<=0){ killEnemy(e); continue; }
      }
    }
    if(e.slowT>0){ e.slowT -= dt; if(e.slowT<=0) e.slow=0; }
    if(e.stagger>0) e.stagger -= dt;

    // --- knockback takes priority over AI movement
    if(e.knock>0){
      e.knock -= dt;
      const nx = e.x + e.knockX*dt, ny = e.y + e.knockY*dt;
      if(walkableTile(Math.floor(nx/TILE), Math.floor(e.y/TILE))) e.x = nx;
      if(walkableTile(Math.floor(e.x/TILE), Math.floor(ny/TILE))) e.y = ny;
      e.knockX *= 0.86; e.knockY *= 0.86;
      continue;
    }

    if(e.stagger>0){ e.state='stagger'; continue; }

    const d = dist(e.x,e.y,player.x,player.y);
    const spd = e.spd * (1 - e.slow);
    e.stateT += dt;

    switch(e.state){
      case 'idle':
      case 'chase': {
        e.state='chase';
        if(d < T0.range){ e.state='wind'; e.stateT=0; break; }

        // Steer toward the player, sliding along walls. Direct steering alone
        // wedges enemies in concave pockets and stalls the wave forever, so
        // anything that stops making progress commits to a sidestep.
        const a = Math.atan2(player.y-e.y, player.x-e.x);
        e.facing = Math.cos(a)>=0 ? 1 : -1;

        e.stuckT = (e.stuckT||0) + dt;
        if(e.stuckT > 0.6){
          const moved = Math.hypot(e.x-(e.lastX??e.x), e.y-(e.lastY??e.y));
          if(moved < 3 && (e.detourT||0) <= 0){
            e.detourT = 1.1;
            e.detourDir = Math.random()<0.5 ? 1 : -1;
          }
          e.lastX=e.x; e.lastY=e.y; e.stuckT=0;
        }

        let hx, hy;
        if((e.detourT||0) > 0){
          e.detourT -= dt;
          // slide perpendicular to the player direction, biased forward
          const pa = a + e.detourDir*Math.PI/2;
          hx = Math.cos(pa)*0.85 + Math.cos(a)*0.35;
          hy = Math.sin(pa)*0.85 + Math.sin(a)*0.35;
          const l = Math.hypot(hx,hy)||1; hx/=l; hy/=l;
        } else {
          hx = Math.cos(a); hy = Math.sin(a);
        }

        const mvx = hx*spd*dt, mvy = hy*spd*dt;
        const okX = walkableTile(Math.floor((e.x+mvx)/TILE), Math.floor(e.y/TILE));
        const okY = walkableTile(Math.floor(e.x/TILE), Math.floor((e.y+mvy)/TILE));
        if(okX) e.x += mvx;
        if(okY) e.y += mvy;
        // fully boxed in on both axes — force a fresh detour next frame
        if(!okX && !okY && (e.detourT||0) <= 0){
          e.detourT = 1.1; e.detourDir = Math.random()<0.5 ? 1 : -1;
        }
        // soft separation so packs don't stack into one sprite
        for(const o of G.enemies){
          if(o===e || o.dead) continue;
          const dd = dist(e.x,e.y,o.x,o.y);
          if(dd < e.r+o.r && dd>0.01){
            const push = (e.r+o.r-dd)*0.5;
            const pa = Math.atan2(e.y-o.y, e.x-o.x);
            e.x += Math.cos(pa)*push*dt*18; e.y += Math.sin(pa)*push*dt*18;
          }
        }
        break;
      }
      case 'wind': {
        // GDD §11: clear telegraph before the blow lands
        if(e.stateT >= T0.windup){ e.state='strike'; e.stateT=0; doEnemyStrike(e, T0); }
        break;
      }
      case 'strike': {
        if(e.stateT >= T0.strike){ e.state='recover'; e.stateT=0; }
        break;
      }
      case 'recover': {
        if(e.stateT >= T0.recover){ e.state='chase'; e.stateT=0; }
        break;
      }
      case 'stagger': {
        if(e.stagger<=0){ e.state='chase'; e.stateT=0; }
        break;
      }
    }
  }
}

function doEnemyStrike(e, T0){
  const d = dist(e.x,e.y,player.x,player.y);
  if(e.kind==='golem'){
    // ground pound — AoE around the golem
    G.hitmarks.push({ kind:'pound', x:e.x, y:e.y, life:0.3, max:0.3, r:T0.range+8 });
    G.shake = Math.max(G.shake, 3);
    if(d < T0.range+8) hurtPlayer(T0.dmg, e.x, e.y);
    for(let i=0;i<14;i++) spark(e.x+(Math.random()-0.5)*20, e.y+4, PAL.dirtL, 1.2);
  } else {
    const a = Math.atan2(player.y-e.y, player.x-e.x);
    G.hitmarks.push({ kind:'lunge', x:e.x, y:e.y, ang:a, life:0.18, max:0.18, range:T0.range });
    if(d < T0.range + 4) hurtPlayer(T0.dmg, e.x, e.y);
    // small lunge forward
    const lx = e.x + Math.cos(a)*9, ly = e.y + Math.sin(a)*9;
    if(walkableTile(Math.floor(lx/TILE), Math.floor(ly/TILE))){ e.x=lx; e.y=ly; }
  }
}
