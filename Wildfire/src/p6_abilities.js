
// ============================================================================
// HIT RESOLUTION
// ============================================================================
function resolveArc(ox,oy,ang,arc,range,dmg,knock,hitSet,heavy,kind){
  let landed=0;
  for(const e of G.enemies){
    if(e.dead) continue;
    if(hitSet && hitSet.has(e.id)) continue;
    const d=dist(ox,oy,e.x,e.y);
    if(d > range+e.r) continue;
    if(arc>0){
      const ea=Math.atan2(e.y-oy,e.x-ox);
      if(Math.abs(angDiff(ang,ea))>arc/2) continue;
    }
    if(hitSet) hitSet.add(e.id);
    const crit=rollCrit(e);
    hurtEnemy(e, dmg*(crit?1.9:1), ox, oy, crit, knock/50);
    onHitLanded(e, dmg, kind);
    landed++;
  }
  if(landed){ G.hitlag=Math.max(G.hitlag,heavy?0.07:0.04); G.shake=Math.max(G.shake,heavy?3:1.4); }
  return landed;
}
function resolveCircle(ox,oy,r,dmg,knock,hitSet,kind){
  let landed=0;
  for(const e of G.enemies){
    if(e.dead) continue;
    if(hitSet && hitSet.has(e.id)) continue;
    if(dist(ox,oy,e.x,e.y) > r+e.r) continue;
    if(hitSet) hitSet.add(e.id);
    const crit=rollCrit(e);
    hurtEnemy(e, dmg*(crit?1.9:1), ox, oy, crit, knock/50);
    onHitLanded(e, dmg, kind);
    landed++;
  }
  return landed;
}
function resolveLine(ox,oy,ang,len,halfW,dmg,knock,hitSet,stagger,kind){
  let landed=0;
  const cx=Math.cos(ang), cy=Math.sin(ang);
  for(const e of G.enemies){
    if(e.dead) continue;
    if(hitSet && hitSet.has(e.id)) continue;
    const rx=e.x-ox, ry=e.y-oy;
    const along=rx*cx+ry*cy;
    if(along<-6||along>len) continue;
    if(Math.abs(-rx*cy+ry*cx) > halfW+e.r) continue;
    if(hitSet) hitSet.add(e.id);
    const crit=rollCrit(e);
    hurtEnemy(e, dmg*(crit?1.9:1), ox, oy, crit, knock/50);
    if(stagger) applyStagger(e,stagger);
    onHitLanded(e, dmg, kind);
    landed++;
  }
  return landed;
}
function rollCrit(e){
  let c = 0.08;
  if(cls.id==='longshot') c += player.focus/100 * 0.5;
  if(cls.id==='phantom'){ if(player.stealthT>0) return true; if(isBehind(e)) c += 0.4; }
  if(hasBuff('deadeye')) c += 0.3;
  return Math.random() < c;
}

// ============================================================================
// PROJECTILES
// ============================================================================
function spawnShot(x,y,ang,spd,dmg,style,pierce,extra){
  G.shots = G.shots || [];
  G.shots.push(Object.assign({
    x, y, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd, ang,
    dmg, style, pierce:pierce||1, life:1.6, hit:new Set(), r:3
  }, extra||{}));
}
function updateShots(dt){
  G.shots = G.shots || [];
  for(let i=G.shots.length-1;i>=0;i--){
    const s=G.shots[i];
    s.life-=dt; s.x+=s.vx*dt; s.y+=s.vy*dt;
    if(s.life<=0 || !walkableAt(s.x,s.y)){
      for(let k=0;k<6;k++) spark(s.x,s.y,shotColor(s.style),1);
      G.shots.splice(i,1); continue;
    }
    // Creature shots travel in the same list but only ever hit the player.
    // Keeping one list means one set of movement, wall and lifetime rules.
    if(s.foe){
      if(dist(s.x,s.y,player.x,player.y-6) < 9){
        hurtPlayer(s.dmg, s.x, s.y);
        for(let k=0;k<6;k++) spark(s.x,s.y,shotColor(s.style),1);
        G.shots.splice(i,1);
      }
      continue;
    }
    for(const e of G.enemies){
      if(e.dead||s.hit.has(e.id)) continue;
      if(dist(s.x,s.y,e.x,e.y-4) > e.r+4) continue;
      s.hit.add(e.id);
      const crit=rollCrit(e);
      withElement(s.elem, ()=>
        hurtEnemy(e, s.dmg*(crit?1.9:1), s.x-s.vx*0.1, s.y-s.vy*0.1, crit, 0.6));
      onHitLanded(e, s.dmg, s.tempoKind||'gun');
      if(s.onHit) s.onHit(e);
      if(--s.pierce<=0){ G.shots.splice(i,1); break; }
    }
  }
}
function shotColor(style){
  switch(style){
    case 'bullet': return C.brass4;
    case 'bolt':   return C.aether4;
    case 'fire':   return C.amber3;
    case 'ice':    return C.water5;
    case 'spark':  return C.brass5;
    case 'fork':   return C.amber3;
    case 'forkice':return C.water5;
    case 'forkarc':return '#fff58a';
    default:       return C.uiText;
  }
}

// ============================================================================
// RUNES (Runebreaker)
// ============================================================================
function inscribeRune(e,n){
  let r = G.runes.find(q=>q.e===e);
  if(!r){ r={ e, n:0, life:12 }; G.runes.push(r); }
  r.n = Math.min(5, r.n+n); r.life=12;
  Sfx.rune();
  floatText(e.x, e.y-20-e.r, '◈'.repeat(r.n), C.aether4);
}
function detonateRunes(mode){
  let total=0;
  const marked = G.runes.filter(r=>r.e && !r.e.dead && r.n>0);
  if(!marked.length){ toast('NO RUNES TO DETONATE'); Sfx.ui(); return 0; }
  for(const r of marked){
    const e=r.e, n=r.n; total+=n;
    if(mode==='flare'){
      const dmg = 9*n*attackPower();
      hurtEnemy(e, dmg, player.x, player.y, false, 0.5);
      onHitLanded(e, dmg, 'detonate');
      applyBurn(e, 2.2);
      resolveCircle(e.x, e.y, 20, 4*n*attackPower(), 30, new Set([e.id]), 'detonate');
      G.hitmarks.push({ kind:'burst', x:e.x, y:e.y-4, life:0.3, max:0.3, r:22, col:C.amber3 });
      for(let k=0;k<6*n;k++) spark(e.x, e.y-6, C.amber3, 1.2);
    } else {
      const dmg = 7*n*attackPower();
      hurtEnemy(e, dmg, player.x, player.y, false, 0.3);
      onHitLanded(e, dmg, 'detonate');
      const near = nearestEnemy(e.x, e.y, 60, e);
      if(near){
        hurtEnemy(near, dmg*0.6, e.x, e.y, false, 0.2);
        G.hitmarks.push({ kind:'chain', ax:e.x, ay:e.y-6, bx:near.x, by:near.y-6, life:0.2, max:0.2 });
      }
      for(let k=0;k<5*n;k++) spark(e.x, e.y-6, C.brass5, 1.2);
    }
  }
  G.runes.length = 0;
  player.runeTotal = 0;
  Sfx.detonate();
  G.shake = Math.max(G.shake, 4);
  return total;
}

// ============================================================================
// SUMMONS (Eidolon)
// ============================================================================
const SUMMON_TYPES = {
  golem:  { name:'Forge Golem',  hp:80, spd:34, r:8, dmg:14, cool:1.6, life:20, col:{a:'#5a4a3a',b:'#8a7358',c:'#b09a7a'} },
  sprite: { name:'Storm Sprite', hp:34, spd:52, r:5, dmg:9,  cool:1.0, life:18, col:{a:'#6a5a12',b:'#e8c422',c:'#fff58a'} },
  hound:  { name:'Shadow Hound', hp:46, spd:68, r:6, dmg:11, cool:0.9, life:16, col:{a:'#26212f',b:'#4a3a5f',c:'#9a6fd0'} },
  mega:   { name:'Mega-Eidolon', hp:140,spd:46, r:11,dmg:22, cool:1.1, life:10, col:{a:'#2b4a4a',b:'#2f9c92',c:'#57d0c4'} }
};
function summonEidolon(kind){
  if(G.summons.length>=2){
    const old=G.summons.shift();
    for(let i=0;i<10;i++) spark(old.x,old.y,SUMMON_TYPES[old.kind].col.c,1);
  }
  const T0=SUMMON_TYPES[kind];
  G.summons.push({ kind, x:player.x+(Math.random()-0.5)*20, y:player.y+10,
    hp:T0.hp, maxhp:T0.hp, r:T0.r, cd:0, life:T0.life, anim:Math.random()*4, bob:Math.random()*6 });
  for(let i=0;i<18;i++) spark(player.x, player.y-6, T0.col.c, 1.3);
  Sfx.summon();
  toast(T0.name.toUpperCase()+' SUMMONED');
}
// ---------------------------------------------------------------------------
// SUMMON SPECIALS
// Pressing a summon's key again while that construct is already out spends a
// short cooldown to command its signature move instead of re-summoning.
// ---------------------------------------------------------------------------
const SPECIAL_CD = { golem:5.0, sprite:4.0, hound:4.5, mega:5.0 };
const SPECIAL_NAME = {
  golem:'Bulwark Wall', sprite:'Rapid Fire', hound:'Rending Howl', mega:'Detonation'
};

function summonSpecial(s){
  const T0 = SUMMON_TYPES[s.kind];
  const pow = attackPower();
  const aimAt = nearestEnemy(s.x, s.y, 150) || G.target;
  const ang = aimAt ? Math.atan2(aimAt.y - s.y, aimAt.x - s.x)
                    : Math.atan2(player.dy, player.dx);

  switch(s.kind){
    case 'golem': {
      // slams a barrier into the ground: damage, stagger, then a wall that
      // enemies cannot walk through while it stands
      const wx = s.x + Math.cos(ang)*18, wy = s.y + Math.sin(ang)*18;
      resolveLine(s.x, s.y, ang, 40, 16, 14*pow, 70, new Set(), 2.0, 'summon');
      G.walls.push({ x:wx, y:wy, ang:ang+Math.PI/2, half:30, life:7, max:7 });
      G.hitmarks.push({ kind:'quake', x:s.x, y:s.y, ang, len:40, life:0.34, max:0.34 });
      G.shake = Math.max(G.shake, 5);
      Sfx.quake();
      toast('FORGE GOLEM — BULWARK WALL');
      break;
    }
    case 'sprite': {
      // six bolts in quick succession at whatever it is tracking
      for(let k=0;k<6;k++) setDelayed(()=>{
        if(!G.summons.includes(s)) return;
        const t2 = nearestEnemy(s.x, s.y, 150);
        const a2 = t2 ? Math.atan2(t2.y-s.y, t2.x-s.x) : ang;
        spawnShot(s.x, s.y-6, a2 + (Math.random()-0.5)*0.12, 220, 7*pow, 'spark', 1);
        Sfx.bolt();
      }, k*0.07);
      toast('STORM SPRITE — RAPID FIRE');
      break;
    }
    case 'hound': {
      // spinning rend around the hound
      resolveCircle(s.x, s.y, 34, 18*pow, 60, new Set(), 'summon');
      G.hitmarks.push({ kind:'burst', x:s.x, y:s.y, life:0.36, max:0.36, r:34, col:T0.col.c });
      for(let k=0;k<20;k++){
        const a=Math.random()*Math.PI*2;
        G.particles.push({ x:s.x+Math.cos(a)*30, y:s.y+Math.sin(a)*30-4,
          vx:Math.cos(a)*40, vy:Math.sin(a)*40, life:0.22, max:0.3,
          kind:'spark', col:T0.col.c, s:1 });
      }
      for(const e of G.enemies)
        if(!e.dead && dist(e.x,e.y,s.x,s.y) < 38) applyStagger(e, 1.4);
      G.shake = Math.max(G.shake, 3);
      Sfx.crit();
      toast('SHADOW HOUND — RENDING HOWL');
      break;
    }
    case 'mega': {
      // Big blast, and the Mega survives it. The Fusion itself is on a 20s
      // cooldown and the Mega only lives ten seconds, so the detonation's own
      // cooldown is what decides how many times you get to use the form you
      // just spent both summons on. At 8s that was twice; 5s makes it three
      // and gives the window a rhythm.
      resolveCircle(s.x, s.y, 56, 34*pow, 110, new Set(), 'summon');
      G.hitmarks.push({ kind:'burst', x:s.x, y:s.y, life:0.5, max:0.5, r:56, col:T0.col.c });
      G.hitmarks.push({ kind:'burst', x:s.x, y:s.y, life:0.34, max:0.34, r:34, col:'#ffffff' });
      for(let k=0;k<34;k++) spark(s.x, s.y-6, k%2?T0.col.c:C.amber4, 1.5);
      for(const e of G.enemies)
        if(!e.dead && dist(e.x,e.y,s.x,s.y) < 60) applyStagger(e, 2.2);
      G.shake = Math.max(G.shake, 8);
      G.flash = Math.max(G.flash, 0.4);
      Sfx.detonate();
      toast('MEGA-EIDOLON — DETONATION');
      break;
    }
  }
  s.flash = 0.3;
}

// walls block enemy pathing but never the player
function updateWalls(dt){
  for(let i=G.walls.length-1;i>=0;i--){
    const w=G.walls[i];
    w.life -= dt;
    if(w.life<=0) G.walls.splice(i,1);
  }
}
function wallBlocks(x,y){
  for(const w of G.walls){
    const rx=x-w.x, ry=y-w.y;
    const ca=Math.cos(w.ang), sa=Math.sin(w.ang);
    const along = rx*ca + ry*sa;
    const perp  = Math.abs(-rx*sa + ry*ca);
    if(Math.abs(along) <= w.half && perp <= 4) return true;
  }
  return false;
}

function updateSummons(dt){
  for(let i=G.summons.length-1;i>=0;i--){
    const s=G.summons[i], T0=SUMMON_TYPES[s.kind];
    s.life-=dt; s.anim+=dt*6; s.bob+=dt*3.2; s.cd=Math.max(0,s.cd-dt);
    if(s.life<=0){
      for(let k=0;k<12;k++) spark(s.x,s.y,T0.col.c,1.1);
      G.summons.splice(i,1); continue;
    }
    const tgt = nearestEnemy(s.x,s.y,120);
    if(tgt){
      const d=dist(s.x,s.y,tgt.x,tgt.y);
      const range = s.kind==='sprite' ? 58 : 16;
      if(d > range){
        const a=Math.atan2(tgt.y-s.y,tgt.x-s.x);
        const nx=s.x+Math.cos(a)*T0.spd*dt, ny=s.y+Math.sin(a)*T0.spd*dt;
        if(walkableAt(nx,s.y)) s.x=nx;
        if(walkableAt(s.x,ny)) s.y=ny;
      } else if(s.cd<=0){
        s.cd = T0.cool;
        if(s.kind==='sprite'){
          spawnShot(s.x,s.y-6,Math.atan2(tgt.y-s.y,tgt.x-s.x),190,T0.dmg,'spark',1);
          Sfx.bolt();
        } else {
          hurtEnemy(tgt, T0.dmg, s.x, s.y, false, 0.5);
          for(let k=0;k<6;k++) spark(tgt.x,tgt.y-6,T0.col.c,1);
          if(s.kind==='golem'){
            resolveCircle(s.x,s.y,26,T0.dmg*0.5,40,new Set([tgt.id]),'summon');
            G.hitmarks.push({kind:'burst',x:s.x,y:s.y,life:0.3,max:0.3,r:26,col:T0.col.c});
            G.shake=Math.max(G.shake,2);
          }
          Sfx.hit();
        }
      }
    } else {
      // no target: trail the player
      const a=Math.atan2(player.y+8-s.y, player.x-s.x);
      if(dist(s.x,s.y,player.x,player.y)>26){
        const nx=s.x+Math.cos(a)*T0.spd*0.8*dt, ny=s.y+Math.sin(a)*T0.spd*0.8*dt;
        if(walkableAt(nx,s.y)) s.x=nx;
        if(walkableAt(s.x,ny)) s.y=ny;
      }
    }
  }
}

// ============================================================================
// ABILITY DISPATCH — one entry point, nine very different behaviours
// ============================================================================
function useAbility(i){
  if(G.state!==ST.PLAY) return;
  const A = cls.abilities[i];
  if(!A || A.name.indexOf('Empty')>=0){
    if(cls.id==='savant'){ toast('SLOT EMPTY — SCAN A CREATURE WITH SPACE'); Sfx.ui(); }
    return;
  }
  if(player.cds[i]>0) return;
  if(player.dodgeT>0||player.castT>0||player.chargeT>0||player.spinT>0) return;

  const ang = aimAngle();          // always fire at the marked target
  const pow = attackPower();
  let cd = A.cd;

  switch(cls.id){
  // ---------------------------------------------------------------- IRONCLAD
  case 'ironclad': {
    const emp = isEmpowered();
    if(i===0){
      setDelayed(()=>{
        const arc = emp?4.71:3.14;
        resolveArc(player.x,player.y,ang,arc,34,(emp?26:18)*pow,62,new Set(),true,'blade');
        G.hitmarks.push({kind:'cleave',x:player.x,y:player.y,ang,arc,range:34,life:0.24,max:0.24,emp,col:C.amber3});
        Sfx.fire(); G.shake=Math.max(G.shake,emp?5:3);
      }, A.cast);
    } else if(i===1){
      player.spinPower=player.momentum; player.spinT=0.52; player.momentum=0;
      Sfx.quake();
    } else if(i===2){
      setDelayed(()=>{ player.chargeT=0.24; player.chargeDx=Math.cos(ang); player.chargeDy=Math.sin(ang);
        player.chargeHits=new Set(); Sfx.dodge(); }, A.cast);
    } else {
      setDelayed(()=>{
        const angles = emp ? [ang-0.72,ang,ang+0.72] : [ang];
        for(const a of angles){
          resolveLine(player.x,player.y,a,76,11,22*pow,55,new Set(),3.0,'blade');
          G.hitmarks.push({kind:'quake',x:player.x,y:player.y,ang:a,len:76,life:0.34,max:0.34});
        }
        Sfx.quake(); G.shake=Math.max(G.shake,emp?7:5);
      }, A.cast);
    }
    break;
  }
  // ----------------------------------------------------------------- BULWARK
  case 'bulwark': {
    const tier = aegisTier();
    if(i===0){
      // Bastion is a TOGGLE, matching Longshot's Killzone. Held, it fought
      // the rest of the kit: the key had to stay down while you were also
      // trying to aim and press other things, and letting go for a single
      // frame silently dropped the damage reduction.
      player.bastion = !player.bastion;
      cd = 0.8;
      if(player.bastion){ toast('BASTION STANCE \u2014 HOLDING'); Sfx.shield(); }
      else { toast('BASTION DOWN'); Sfx.ui(); }
      break;
    }
    if(i===1){
      if(player.aegis<20){ toast('NOT ENOUGH AEGIS'); Sfx.ui(); return; }
      setDelayed(()=>{
        const dmg=(16+tier*12)*pow;
        resolveArc(player.x,player.y,ang,2.2,34,dmg,80+tier*30,new Set(),true,'shield');
        G.hitmarks.push({kind:'cleave',x:player.x,y:player.y,ang,arc:2.2,range:34,life:0.26,max:0.26,emp:tier===2,col:'#6fa8f0'});
        if(tier===2){
          resolveCircle(player.x,player.y,44,dmg*0.5,60,new Set(),'shield');
          G.hitmarks.push({kind:'burst',x:player.x,y:player.y,life:0.34,max:0.34,r:44,col:'#6fa8f0'});
          for(const e of G.enemies) if(!e.dead && dist(e.x,e.y,player.x,player.y)<48) applyStagger(e,1.5);
        }
        player.aegis = Math.max(0, player.aegis-50);
        Sfx.shield(); G.shake=Math.max(G.shake,4);
      }, A.cast);
    } else if(i===2){
      setDelayed(()=>{
        let n=0;
        for(const e of G.enemies){
          if(e.dead) continue;
          if(dist(e.x,e.y,player.x,player.y) > 88) continue;
          e.taunt = 5.0; n++;
          floatText(e.x, e.y-22-e.r, '!', '#ff6a5a');
        }
        G.hitmarks.push({kind:'burst',x:player.x,y:player.y,life:0.4,max:0.4,r:88,col:'#6fa8f0'});
        player.aegis = clamp(player.aegis + n*10, 0, 100);
        toast(n?('TAUNTED '+n):'NOTHING IN RANGE');
        Sfx.taunt(); G.shake=Math.max(G.shake,2);
      }, A.cast);
    } else {
      if(tier<1){ toast('NEEDS GUARDIAN TIER'); Sfx.ui(); return; }
      setDelayed(()=>{
        for(const e of G.enemies){
          if(e.dead) continue;
          if(dist(e.x,e.y,player.x,player.y) > 70) continue;
          hurtEnemy(e, 26*pow, player.x, player.y, false, 1.2);
          applyStagger(e, 2.5); e.shattered = 6.0;
          onHitLanded(e, 26, 'shield');
        }
        G.hitmarks.push({kind:'burst',x:player.x,y:player.y,life:0.5,max:0.5,r:70,col:'#a8d0ff'});
        player.aegis = Math.max(0, player.aegis-40);
        Sfx.quake(); G.shake=Math.max(G.shake,6);
      }, A.cast);
    }
    break;
  }
  // ------------------------------------------------------------- RUNEBREAKER
  case 'runebreaker': {
    if(i===0){
      setDelayed(()=>{
        for(let k=0;k<3;k++) setDelayed(()=>{
          resolveArc(player.x,player.y,Math.atan2(player.dy,player.dx),1.6,26,7*pow,26,new Set(),k===2,'blade');
          Sfx.swing(k);
        }, k*0.11);
      }, A.cast);
    } else if(i===1){ setDelayed(()=>detonateRunes('flare'), A.cast); }
    else if(i===2){ setDelayed(()=>detonateRunes('shock'), A.cast); }
    else {
      // blink through a line of enemies, inscribing as you pass
      const ox=player.x, oy=player.y;
      let best=0;
      for(let d=6; d<=52; d+=2){ if(canStand(ox+Math.cos(ang)*d, oy+Math.sin(ang)*d)) best=d; else break; }
      player.x=ox+Math.cos(ang)*best; player.y=oy+Math.sin(ang)*best;
      player.iframe=Math.max(player.iframe,0.24);
      for(const e of G.enemies){
        if(e.dead) continue;
        const rx=e.x-ox, ry=e.y-oy;
        const along=rx*Math.cos(ang)+ry*Math.sin(ang);
        if(along<-4||along>best+10) continue;
        if(Math.abs(-rx*Math.sin(ang)+ry*Math.cos(ang))>16+e.r) continue;
        inscribeRune(e,2);
      }
      G.hitmarks.push({kind:'warp',ax:ox,ay:oy,bx:player.x,by:player.y,life:0.3,max:0.3});
      for(let k=0;k<14;k++) spark(player.x,player.y-8,C.aether4,1.2);
      Sfx.blink();
    }
    break;
  }
  // ------------------------------------------------------------ AETHERMANCER
  case 'aethermancer': {
    if(i===3){
      player.mode = player.mode?0:1;
      toast(player.mode?'ATTUNEMENT: SPREAD':'ATTUNEMENT: FOCUS');
      for(let k=0;k<16;k++){
        const a=Math.random()*Math.PI*2, rr=player.mode?4:16;
        G.particles.push({x:player.x+Math.cos(a)*rr,y:player.y-8+Math.sin(a)*rr,
          vx:Math.cos(a)*(player.mode?40:-40),vy:Math.sin(a)*(player.mode?40:-40),
          life:0.3,max:0.4,kind:'spark',col:C.aether4,s:1});
      }
      Sfx.cast(); cd = 0.35;
      break;
    }
    const el = ['fire','ice','lightning'][i];
    player.lastElement = el;
    setDelayed(()=>{
      if(player.mode===0){
        // FOCUS: single target, heavy
        if(el==='fire'){ spawnShot(player.x,player.y-8,ang,210,20*pow,'fire',2,{onHit:e=>applyBurn(e,3)}); Sfx.fire(); }
        if(el==='ice'){  spawnShot(player.x,player.y-8,ang,180,24*pow,'ice',1,{onHit:e=>{applySlow(e,0.9,2);applyStagger(e,1.2);}}); Sfx.ice(); }
        if(el==='lightning'){
          const t=lockTarget(150);
          if(t){
            hurtEnemy(t,26*pow,player.x,player.y,rollCrit(t),0.4);
            onHitLanded(t,26,'spell');
            G.hitmarks.push({kind:'chain',ax:player.x,ay:player.y-8,bx:t.x,by:t.y-6,life:0.2,max:0.2});
          } else spawnShot(player.x,player.y-8,ang,260,22*pow,'spark',1);
          Sfx.bolt();
        }
      } else {
        // SPREAD: area coverage
        if(el==='fire'){
          resolveArc(player.x,player.y,ang,2.1,52,13*pow,30,new Set(),false,'spell');
          G.hitmarks.push({kind:'cone',x:player.x,y:player.y-6,ang,spread:1.05,range:52,life:0.34,max:0.34,col:C.amber3});
          for(const e of G.enemies) if(!e.dead && dist(e.x,e.y,player.x,player.y)<56) applyBurn(e,2);
          Sfx.fire();
        }
        if(el==='ice'){
          resolveCircle(player.x,player.y,52,12*pow,26,new Set(),'spell');
          G.hitmarks.push({kind:'burst',x:player.x,y:player.y,life:0.42,max:0.42,r:52,col:C.water5});
          for(const e of G.enemies) if(!e.dead && dist(e.x,e.y,player.x,player.y)<56) applySlow(e,0.45,3.5);
          Sfx.ice();
        }
        if(el==='lightning'){
          // four strikes in a cage around the player
          for(let k=0;k<4;k++) setDelayed(()=>{
            const a=ang+(k-1.5)*0.5, tx=player.x+Math.cos(a)*44, ty=player.y+Math.sin(a)*44;
            resolveCircle(tx,ty,18,11*pow,24,null,'spell');
            G.hitmarks.push({kind:'strike',x:tx,y:ty,life:0.26,max:0.26});
            Sfx.bolt();
          }, k*0.08);
        }
      }
    }, A.cast);
    Sfx.cast();
    break;
  }
  // ------------------------------------------------------------------ REAVER
  case 'reaver': {
    if(i===0){
      // Three slashes are one Blade action. Tempo only builds off slashes that
      // actually connect, and the alternation rule is applied once at the end
      // so the 2nd and 3rd slash can't be read as "same type twice".
      let landed = 0;
      for(let k=0;k<3;k++) setDelayed(()=>{
        if(resolveArc(player.x,player.y,aimAngle(),1.5,26,8*pow,26,new Set(),k===2,'blade')) landed++;
        Sfx.swing(k);
      }, A.cast + k*0.10);
      setDelayed(()=>{ if(landed>0) bumpTempo('blade', landed); }, A.cast + 0.33);
    } else if(i===1){
      // Rounds are in flight, so Tempo is credited when one of them lands —
      // once per volley, no matter how many bullets connect.
      const credited = { done:false };
      setDelayed(()=>{
        const n = player.tempo>=4 ? 3 : 1;
        for(let k=0;k<n;k++)
          spawnShot(player.x,player.y-8,ang+(k-(n-1)/2)*0.16,240,9*pow,'bullet',1,{
            tempoKind:'gun',
            onHit: ()=>{ if(!credited.done){ credited.done=true; bumpTempo('gun',1); } }
          });
        Sfx.gun();
      }, A.cast);
    } else if(i===2){
      // BLADE FINISHER — single target, one strike per point of Tempo.
      // Weak per hit, but the last one lands hard at full Tempo.
      const spent = player.tempo;
      if(spent<1){ toast('NEEDS TEMPO'); Sfx.ui(); return; }
      const t = lockTarget(90);
      if(!t){ toast('NO TARGET'); Sfx.ui(); return; }
      const ox=player.x, oy=player.y;
      const a=Math.atan2(t.y-oy,t.x-ox);
      const lx=t.x-Math.cos(a)*14, ly=t.y-Math.sin(a)*14;
      if(canStand(lx,ly)){ player.x=lx; player.y=ly; }
      G.hitmarks.push({kind:'warp',ax:ox,ay:oy,bx:lx,by:ly,life:0.22,max:0.22});
      player.iframe=Math.max(player.iframe, 0.12*spent + 0.2);

      for(let k=0;k<spent;k++) setDelayed(()=>{
        if(t.dead) return;
        const last = (k===spent-1);
        const bonus = (last && spent>=6) ? 20*pow : 0;   // full Tempo payoff
        hurtEnemy(t, 7*pow + bonus, player.x, player.y, last && spent>=6, 0.3);
        onHitLanded(t, 7*pow, 'blade');
        G.hitmarks.push({kind:'slash', x:player.x, y:player.y,
          ang:a + (k%2?0.5:-0.5), arc:1.4, range:26,
          life:0.1, max:0.1, heavy:last, col:cls.col.accentL});
        Sfx.swing(k%3);
        if(last && spent>=6){
          Sfx.crit(); G.shake=Math.max(G.shake,5);
          floatText(t.x, t.y-32, 'FULL TEMPO', C.amber4, true);
        }
      }, 0.09*k);

      // return to where you started once the flurry ends
      setDelayed(()=>{ if(canStand(ox,oy)){ player.x=ox; player.y=oy; } }, 0.09*spent + 0.12);
      player.tempo=0; player.lastTempoKind='blade'; player.tempoDecay=3.0;
      Sfx.dodge();
    } else {
      // GUN FINISHER — one volley per point of Tempo, fanned downrange.
      const spent = player.tempo;
      if(spent<1){ toast('NEEDS TEMPO'); Sfx.ui(); return; }
      setDelayed(()=>{
        for(let v=0; v<spent; v++) setDelayed(()=>{
          const last = (v===spent-1);
          const dmg = (last && spent>=6) ? 12*pow : 4*pow;
          for(let b=0;b<3;b++)
            spawnShot(player.x, player.y-8, ang + (b-1)*0.16 + (Math.random()-0.5)*0.12,
                      230, dmg, 'bullet', 1, {tempoKind:'gun'});
          Sfx.gun();
          if(last && spent>=6){
            Sfx.crit(); G.shake=Math.max(G.shake,5);
            floatText(player.x, player.y-34, 'FULL TEMPO', C.amber4, true);
          }
        }, v*0.11);
        G.shake=Math.max(G.shake,3);
      }, A.cast);
      player.tempo=0; player.lastTempoKind='gun'; player.tempoDecay=3.0;
    }
    break;
  }
  // ---------------------------------------------------------------- LONGSHOT
  case 'longshot': {
    // while the tripod is up, every shot flies at whatever the reticle marks
    const shotAng = ang;      // aimAngle() already points at the mark
    if(i===0){
      setDelayed(()=>{
        const f=player.focus/100;
        const dmg=(10+26*f)*pow;
        spawnShot(player.x,player.y-8,shotAng,220+90*f,dmg,'bullet',1);
        player.focus = 0;
        Sfx.bow(); if(f>=0.99){ Sfx.crit(); G.shake=Math.max(G.shake,3); }
      }, A.cast);
    } else if(i===1){
      if(player.focus<50){ toast('NEEDS 50% FOCUS'); Sfx.ui(); return; }
      setDelayed(()=>{
        // a railgun round: ignores terrain entirely and keeps going
        resolveLine(player.x,player.y,shotAng,210,7,26*pow,40,new Set(),0,'gun');
        G.hitmarks.push({kind:'beam',x:player.x,y:player.y-8,ang:shotAng,len:210,
                         life:0.30,max:0.30,col:C.brass5});
        player.focus=0; Sfx.gun(); G.shake=Math.max(G.shake,4);
      }, A.cast);
    } else if(i===2){
      setDelayed(()=>{
        let n=0;
        for(const e of G.enemies){
          if(e.dead||dist(e.x,e.y,player.x,player.y)>130) continue;
          e.marked=6.0; n++;
        }
        G.hitmarks.push({kind:'burst',x:player.x,y:player.y,life:0.5,max:0.5,r:130,col:C.leaf5});
        toast(n?('MARKED '+n):'NOTHING IN RANGE');
        Sfx.cast();
      }, A.cast);
    } else {
      // Killzone is a toggle: rooted, Focus builds 3x, and WASD stops moving
      // you and starts steering the reticle between targets instead.
      player.killzone = !player.killzone;
      cd = 0.8;
      if(player.killzone){
        if(!G.target) G.target = nearestEnemy(player.x, player.y, targetRange());
        toast('KILLZONE ON — WASD SELECTS TARGET');
        Sfx.shield();
      } else {
        toast('KILLZONE OFF');
        Sfx.ui();
      }
    }
    break;
  }
  // ----------------------------------------------------------------- PHANTOM
  case 'phantom': {
    if(i===0){
      setDelayed(()=>{
        const t=lockTarget(34);
        if(t){
          const behind=isBehind(t) || player.stealthT>0;
          const dmg=(behind?30:12)*pow;
          hurtEnemy(t,dmg*(behind?1.6:1),player.x,player.y,behind,0.5);
          onHitLanded(t,dmg,'blade');
          if(behind) floatText(t.x,t.y-26-t.r,'BACKSTAB',C.aether5);
        }
        G.hitmarks.push({kind:'slash',x:player.x,y:player.y,ang,arc:1.2,range:26,life:0.1,max:0.1,heavy:true,col:'#c9c5bd'});
        Sfx.hit();
      }, A.cast);
    } else if(i===1){
      if(player.shadow<20){ toast('NEEDS 20% SHADOW'); Sfx.ui(); return; }
      player.shadow-=20; player.stealthT=6.0;
      toast('VANISHED'); Sfx.stealth();
      for(let k=0;k<20;k++) spark(player.x,player.y-10,'#6b4a9c',1.2);
    } else if(i===2){
      setDelayed(()=>{
        for(const e of G.enemies){
          if(e.dead||dist(e.x,e.y,player.x,player.y)>46) continue;
          e.blind=3.0;
        }
        player.stealthT=Math.max(player.stealthT,3.0);
        G.hitmarks.push({kind:'smoke',x:player.x,y:player.y,life:3.0,max:3.0,r:46});
        toast('SMOKE — STEALTHED'); Sfx.stealth();
      }, A.cast);
    } else {
      if(player.shadow<60){ toast('NEEDS 60% SHADOW'); Sfx.ui(); return; }
      player.shadow-=60;
      const targets=[];
      for(const e of G.enemies){ if(!e.dead && dist(e.x,e.y,player.x,player.y)<110) targets.push(e); }
      targets.sort((a,b)=>dist(a.x,a.y,player.x,player.y)-dist(b.x,b.y,player.x,player.y));
      const chain=targets.slice(0,3);
      if(!chain.length){ toast('NO TARGETS'); return; }
      player.iframe=Math.max(player.iframe,0.9);
      chain.forEach((t,k)=> setDelayed(()=>{
        if(t.dead) return;
        const ox=player.x, oy=player.y;
        const lx=t.x-8, ly=t.y+6;
        if(canStand(lx,ly)){ player.x=lx; player.y=ly; }
        hurtEnemy(t, 24*pow, player.x, player.y, true, 0.6);
        onHitLanded(t, 24, 'blade');
        G.hitmarks.push({kind:'warp',ax:ox,ay:oy,bx:player.x,by:player.y,life:0.2,max:0.2});
        Sfx.crit();
      }, k*0.18));
      G.shake=Math.max(G.shake,4);
    }
    break;
  }
  // ----------------------------------------------------------------- EIDOLON
  case 'eidolon': {
    // Each slot is summon-or-command: if that construct is already on the
    // field, the same key spends a shorter cooldown to trigger its special.
    const kind = ['golem','sprite','hound','mega'][i];
    const out  = G.summons.find(s=>s.kind===kind);
    if(out){
      summonSpecial(out);
      cd = SPECIAL_CD[kind];
      break;
    }
    if(i===3){
      if(G.summons.length<2){ toast('NEEDS TWO EIDOLONS TO FUSE'); Sfx.ui(); return; }
      G.summons.length=0;
      summonEidolon('mega');
      G.shake=Math.max(G.shake,5);
    } else {
      setDelayed(()=>summonEidolon(kind), A.cast);
      Sfx.cast();
    }
    break;
  }
  // ------------------------------------------------------------------ SAVANT
  case 'savant': {
    // A learned ability carries the element of the thing it was learned from,
    // which is the whole point of the cave: the fork you take off an ember imp
    // is the wrong tool for the next ember imp and the right one for a rime.
    const k = A.kind, kel = A.elem;
    setDelayed(()=>withElement(kel, ()=>{
      if(k==='scan'){
        // One button, two jobs, decided by whether this creature is already
        // in the codex. Learning is the Savant's progression; marking is what
        // they do once there is nothing left to learn from a species, so the
        // button never becomes dead weight in a fight.
        const tgt = (G.target && !G.target.dead &&
                     dist(player.x,player.y,G.target.x,G.target.y) < 90)
                  ? G.target : nearestEnemy(player.x, player.y, 90);
        if(!tgt){ toast('NO SUBJECT IN RANGE'); Sfx.ui(); return; }
        const learn = LEARNABLE[tgt.kind];
        const known = !learn || player.codex.some(a=>a.kind===tgt.kind);
        if(!known){
          assimilate(tgt);
        } else {
          tgt.marked = Math.max(tgt.marked, 8);
          player.scanT = Math.max(player.scanT, 0.35);
          player.scanTarget = tgt;
          floatText(tgt.x, tgt.y-22-tgt.r, 'ANALYZED', '#8fd6ff', true);
          for(let n=0;n<10;n++) spark(tgt.x, tgt.y-8, '#8fd6ff', 1.1);
          Sfx.scan();
        }
        return;
      }
      if(k==='poke'){
        // Codex Strike: feeble on purpose. Its value is the Analyzed mark,
        // which makes everything you have learned hit harder.
        const hits = resolveArc(player.x, player.y, ang, 1.5, 26, 8*pow, 22, new Set(), false, 'poke');
        G.hitmarks.push({ kind:'slash', x:player.x, y:player.y, ang, arc:1.5,
                          range:24, life:0.11, max:0.11, col:C.brass4 });
        if(hits){
          for(const e of G.enemies)
            if(!e.dead && dist(e.x,e.y,player.x,player.y) < 30) e.marked = Math.max(e.marked, 5);
        }
        Sfx.swing(0);
      } else if(k==='dash'){
        player.chargeT=0.2; player.chargeDx=Math.cos(ang); player.chargeDy=Math.sin(ang);
        player.chargeHits=new Set(); Sfx.dodge();
      } else if(k==='arc'){
        resolveArc(player.x,player.y,ang,1.8,30,30*pow,90,new Set(),true,'blade');
        G.hitmarks.push({kind:'cleave',x:player.x,y:player.y,ang,arc:1.8,range:30,life:0.22,max:0.22,col:C.brass4});
        Sfx.hit();
      } else if(k==='cone'){
        resolveArc(player.x,player.y,ang,1.5,48,23*pow,30,new Set(),false,'spell');
        G.hitmarks.push({kind:'cone',x:player.x,y:player.y-6,ang,spread:0.75,range:48,life:0.32,max:0.32,col:'#d8dee9'});
        for(const e of G.enemies) if(!e.dead && dist(e.x,e.y,player.x,player.y)<52) applyBurn(e,2);
        Sfx.fire();
      } else if(k==='leap'){
        // jump onto the marked target, land hard
        const t = G.target && !G.target.dead ? G.target : nearestEnemy(player.x,player.y,150);
        if(t){
          const a=Math.atan2(t.y-player.y, t.x-player.x);
          const lx=t.x-Math.cos(a)*16, ly=t.y-Math.sin(a)*16;
          if(canStand(lx,ly)){ player.x=lx; player.y=ly; }
          G.hitmarks.push({kind:'warp',ax:player.x,ay:player.y,bx:t.x,by:t.y,life:0.2,max:0.2});
        }
        resolveCircle(player.x,player.y,30,34*pow,70,new Set(),'blade');
        G.hitmarks.push({kind:'burst',x:player.x,y:player.y,life:0.3,max:0.3,r:30,col:C.brass4});
        G.shake=Math.max(G.shake,4); Sfx.crit();
      } else if(k==='slam'){
        resolveArc(player.x,player.y,ang,1.4,36,40*pow,150,new Set(),true,'blade');
        G.hitmarks.push({kind:'quake',x:player.x,y:player.y,ang,len:44,life:0.34,max:0.34});
        for(const e of G.enemies)
          if(!e.dead && dist(e.x,e.y,player.x,player.y)<44) applyStagger(e,1.1);
        G.shake=Math.max(G.shake,6); Sfx.hit();
      } else if(k==='blind'){
        G.hitmarks.push({kind:'cone',x:player.x,y:player.y-6,ang,spread:0.85,range:56,
                         life:0.4,max:0.4,col:'#b09ecc'});
        for(const e of G.enemies){
          if(e.dead || dist(e.x,e.y,player.x,player.y)>60) continue;
          if(Math.abs(angDiff(ang, Math.atan2(e.y-player.y,e.x-player.x)))>0.9) continue;
          e.blind = Math.max(e.blind, 5);              // hostiles lose track of you
          floatText(e.x, e.y-20-e.r, 'BLIND', '#b09ecc');
        }
        Sfx.cast();
      } else if(k==='guard'){
        addBuff('slaghide', 6);
        floatText(player.x, player.y-30, 'SLAG HIDE', C.amber3, true);
        for(let n=0;n<16;n++) spark(player.x, player.y-8, C.amber3, 1.2);
        Sfx.quest();
      } else if(k==='chain'){
        let prev={x:player.x,y:player.y}, hops=0;
        const used=new Set();
        for(let n=0;n<5;n++){
          let best=null,bd=90;
          for(const e of G.enemies){
            if(e.dead||used.has(e.id)) continue;
            const d=dist(prev.x,prev.y,e.x,e.y);
            if(d<bd){bd=d;best=e;}
          }
          if(!best) break;
          used.add(best.id); hops++;
          G.hitmarks.push({kind:'chain',ax:prev.x,ay:prev.y-8,bx:best.x,by:best.y-8,life:0.26,max:0.26});
          hurtEnemy(best, 22*pow, prev.x, prev.y, rollCrit(best), 0.3);
          prev={x:best.x,y:best.y};
        }
        if(!hops) toast('NOTHING IN ARC RANGE');
        Sfx.zap ? Sfx.zap() : Sfx.cast();
      } else if(k==='shatter'){
        const hit = resolveArc(player.x,player.y,ang,1.3,30,30*pow,110,new Set(),true,'blade');
        G.hitmarks.push({kind:'cleave',x:player.x,y:player.y,ang,arc:1.3,range:30,
                         life:0.24,max:0.24,col:C.iron4});
        if(hit) for(const e of G.enemies)
          if(!e.dead && dist(e.x,e.y,player.x,player.y)<36){
            e.shattered = Math.max(e.shattered, 6);
            floatText(e.x, e.y-22-e.r, 'SHATTERED', C.iron4);
          }
        G.shake=Math.max(G.shake,3); Sfx.crit();
      } else if(k==='hurl'){
        // The imps' own trick: the fork leaves the hand, and a second one is
        // already there. Pierces, because a thrown spear that stops in the
        // first thing it touches is a disappointment.
        const style = kel==='ice' ? 'forkice' : kel==='lightning' ? 'forkarc' : 'fork';
        spawnShot(player.x, player.y-6, ang, 230, 26*pow, style, 3,
                  { elem:kel, r:5, life:1.1 });
        G.hitmarks.push({ kind:'slash', x:player.x, y:player.y, ang, arc:0.9,
                          range:20, life:0.1, max:0.1, col:shotColor(style) });
        for(let n=0;n<8;n++) spark(player.x+Math.cos(ang)*10, player.y-6+Math.sin(ang)*10,
                                   shotColor(style), 1.1);
        Sfx.gun();
      } else if(k==='slowfield'){
        resolveCircle(player.x,player.y,46,18*pow,20,new Set(),'spell');
        G.hitmarks.push({kind:'burst',x:player.x,y:player.y,life:0.42,max:0.42,r:46,col:'#8fd6ff'});
        for(const e of G.enemies)
          if(!e.dead && dist(e.x,e.y,player.x,player.y)<50) applySlow(e,0.55,4);
        Sfx.cast();
      } else {
        resolveCircle(player.x,player.y,42,24*pow,30,new Set(),'spell');
        G.hitmarks.push({kind:'burst',x:player.x,y:player.y,life:0.4,max:0.4,r:42,col:C.leaf4});
        for(const e of G.enemies) if(!e.dead && dist(e.x,e.y,player.x,player.y)<46) applyPoison(e,4);
        Sfx.cast();
      }
    }), A.cast);
    break;
  }
  }

  player.cds[i] = cd * partEff('cdr');   // body parts shorten your cooldowns
  player.castT = A.cast;
  player.castKind = i;
}

// ============================================================================
// DRAGON ABILITIES — mapped to < and >
// ============================================================================
function dragonAbility(slot){
  if(G.state!==ST.PLAY) return;
  if(dragon.cds[slot]>0) return;
  // Measured from the DRAGON, not from the rider — see dragonAim().
  const ang = dragonAim();
  const pow = attackPower();
  const el = drg.el.toLowerCase();

  if(slot===0){
    dragon.cds[0] = 5.0 * partEff('qCd');
    const qd = partEff('qDmg'), qr = partEff('qRange');
    // breath: a cone from the dragon, flavoured by element
    for(const b of dragonBodies()){
      const bang = dragonAim(b);
      G.hitmarks.push({ kind:'breath', x:b.x, y:b.y, ang:bang, life:0.45, max:0.45, col:drg.b });
      for(const e of G.enemies){
        if(e.dead) continue;
        const d=dist(b.x,b.y,e.x,e.y);
        if(d>58*qr) continue;
        const ea=Math.atan2(e.y-b.y,e.x-b.x);
        if(Math.abs(angDiff(bang,ea))>0.52) continue;
        withElement(el, ()=>hurtEnemy(e, 16*pow*qd, b.x, b.y, rollCrit(e), 0.5));
        onHitLanded(e, 16*qd, 'dragon');
        if(el==='fire') applyBurn(e,3);
        if(el==='ice') applySlow(e,0.5,3);
        if(el==='nature') applyPoison(e,4);
        if(el==='lightning'){
          const n=nearestEnemy(e.x,e.y,50,e);
          if(n){ withElement('lightning', ()=>hurtEnemy(n,8*pow,e.x,e.y,false,0.2));
            G.hitmarks.push({kind:'chain',ax:e.x,ay:e.y-6,bx:n.x,by:n.y-6,life:0.2,max:0.2}); }
        }
        if(el==='dark'){ player.hp=Math.min(player.maxhp,player.hp+3); floatText(player.x,player.y-26,'+3','#7ddc6a'); }
        if(el==='light'){ player.hp=Math.min(player.maxhp,player.hp+2); }
      }
      for(let k=0;k<20;k++){
        const a=bang+(Math.random()-0.5)*0.9, sp=40+Math.random()*90;
        G.particles.push({x:b.x,y:b.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-8,
          life:0.24+Math.random()*0.3,max:0.55,kind:'flame',col:drg.b,s:1});
      }
    }
    Sfx.breath();
    gainBond(1.2);
  } else {
    dragon.cds[1] = 11.0 * partEff('eCd');
    const ed = partEff('eDmg');
    switch(el){
      // Only fire's second skill deals damage; the rest are buffs. So a wing
      // part's `eDmg` lengthens the buff where there is no damage to raise —
      // otherwise five of the six hatchlings would have a dead upgrade slot.
      case 'fire': {
        dragon.dashT = 0.3; dragon.dashAng = ang;
        setDelayed(()=>{
          withElement('fire', ()=>
            resolveLine(dragon.x,dragon.y,ang,64,12,20*pow*ed,50,new Set(),0,'dragon'));
          G.hitmarks.push({kind:'quake',x:dragon.x,y:dragon.y,ang,len:64,life:0.3,max:0.3});
          for(const e of G.enemies) if(!e.dead && dist(e.x,e.y,dragon.x,dragon.y)<70) applyBurn(e,3);
          Sfx.fire();
        }, 0.12);
        break;
      }
      case 'ice':   addBuff('glacialward',6*ed); toast('GLACIAL WARD'); Sfx.shield(); break;
      case 'lightning': addBuff('voltsurge',6*ed); toast('VOLT SURGE — +40% SPEED'); Sfx.bolt(); break;
      case 'nature': {
        const heal = Math.round(player.maxhp*0.22*ed);
        player.hp=Math.min(player.maxhp,player.hp+heal);
        floatText(player.x,player.y-30,'+'+heal,'#7ddc6a');
        G.hitmarks.push({kind:'roots',x:player.x,y:player.y,life:1.4,max:1.4});
        addBuff('regen',6*ed); Sfx.cast(); break;
      }
      case 'dark':  player.stealthT=Math.max(player.stealthT,4*ed); addBuff('veil',4*ed);
                    toast('SHADOW VEIL'); Sfx.stealth(); break;
      case 'light': addBuff('benediction',8*ed); toast('BENEDICTION — +25% DAMAGE'); Sfx.learn(); break;
    }
    gainBond(0.8);
  }
}

// ============================================================================
// EASY ATTACKS
//
// One button drives the whole rotation. Most classes here are built around a
// builder/spender loop — stack the gauge, then dump it — so "rotation" is not
// a fixed cycle but a decision: spend if the gauge is ready and a spender is
// off cooldown, otherwise build. The classes with no such shape fall back to
// cycling whatever is usable, in order.
//
// Only the FIRST ability key is rerouted. The other three still fire their own
// slots, so turning this on adds a simple option without taking the manual one
// away — which matters, because a player who switches it on mid-fight should
// not discover their other three buttons have stopped working.
// ============================================================================
const EASY_ROTATION = {
  ironclad:     { build:[0,2], spend:[1,3], at:0.99 },
  bulwark:      { build:[2,0], spend:[1,3], at:0.50 },
  runebreaker:  { build:[0],   spend:[1,2], at:0.45 },
  reaver:       { build:[0,1], spend:[2,3], at:0.99 },
  phantom:      { build:[0],   spend:[1,3], at:0.60 },
  longshot:     { build:[0],   spend:[1,2], at:0.50 },
  // no builder/spender shape — just cycle what can be used
  aethermancer: { order:[0,1,2] },
  eidolon:      { order:[0,1,2] },
  savant:       { order:[0,1,2,3] }
};

function abilityUsable(i){
  const A = cls.abilities[i];
  if(!A) return false;
  if(A.name.indexOf('Empty') >= 0) return false;     // unfilled Savant slot
  return player.cds[i] <= 0;
}

// Which slot the easy button should fire right now. Returns -1 when nothing
// is off cooldown, so the caller can stay silent rather than firing slot 0
// into its own cooldown.
function easyNextAbility(){
  const R = EASY_ROTATION[cls.id];
  if(!R) return abilityUsable(0) ? 0 : -1;

  if(R.order){
    // cycle from wherever we left off, so repeated presses walk the list
    const n = R.order.length;
    for(let k=1; k<=n; k++){
      const i = R.order[(((player.easyIdx|0) + k) % n)];
      if(abilityUsable(i)){ player.easyIdx = R.order.indexOf(i); return i; }
    }
    return -1;
  }

  // builder / spender
  const full = gaugeValue() >= R.at;
  if(full){
    for(const i of R.spend) if(abilityUsable(i)) return i;
  }
  for(const i of R.build) if(abilityUsable(i)) return i;
  // Gauge not ready and every builder cooling. Fire a spender only if there
  // is something banked to spend: dumping a finisher on an empty gauge is
  // strictly worse than the half-beat of silence before a builder returns,
  // and at a normal mashing rate the builders are cooling most of the time,
  // so this arm runs far more often than it looks like it would.
  if(gaugeValue() > 0){ for(const i of R.spend) if(abilityUsable(i)) return i; }
  return -1;
}

// What the HUD should label the easy button with, so the player can see what
// the next press will actually do.
function easyNextName(){
  const i = easyNextAbility();
  return i<0 ? null : cls.abilities[i].name;
}
