// The three outer zones, the creatures in them, and the codex.
//
// The load-bearing claim of this whole feature is that the world is now
// dangerous OUTSIDE the walls and unchanged INSIDE them. That is two
// assertions, not one, and the second is the one that will rot: it would be
// very easy for a later change to `hostile` or to the AI to quietly turn the
// starting area into a place that kills new players. Both are pinned here.
const {X, press, tick} = require('./harness.js');
require('./strict.js');

let fails = 0;
const ok = (c,l,e) => { console.log('  '+(c?'ok  ':'FAIL')+'  '+l+(e?'  — '+e:'')); if(!c) fails++; };

press('Enter'); X.setCls(0,0); X.beginGame();
for(let i=0;i<30;i++) tick();

const ZONES = ['verge','scarp','shoals'];
const T = X.TILES;

console.log('=== THE ZONES EXIST AND ARE REACHABLE FROM THE RING ===');
{
  const gates = X.AREAS.cogway.exits.filter(e=>e.to!=='gate');
  const dests = [...new Set(gates.map(e=>e.to))].sort();
  ok(dests.length===3, 'three new gates out of the Cogway', dests.join(', '));
  // and each zone can get back
  const orphan = ZONES.filter(z=>!X.AREAS[z].exits.some(e=>e.to==='cogway'));
  ok(orphan.length===0, 'every zone has a way home', orphan.join(', '));
  // the return coordinates must land on ground you can stand on, or the
  // player arrives inside the city wall
  const stuck=[];
  for(const z of ZONES){
    const ex = X.AREAS[z].exits.find(e=>e.to==='cogway');
    X.loadArea('cogway', ex.tx, ex.ty);
    if(!X.canStand(ex.tx, ex.ty)) stuck.push(z+' -> ('+(ex.tx/16|0)+','+(ex.ty/16|0)+')');
  }
  ok(stuck.length===0, 'each gate drops you on solid footing', stuck.join('; '));
}

console.log('\n=== EVERY ZONE IS WALKABLE AND ITS CREATURES CAN BE REACHED ===');
for(const z of ZONES){
  const A = X.AREAS[z], W=A.w, H=A.h;
  X.loadArea(z, A.playerStart.x, A.playerStart.y);
  const seen = new Uint8Array(W*H);
  const sx = Math.floor(A.playerStart.x/16), sy = Math.floor(A.playerStart.y/16);
  seen[sy*W+sx]=1; const q=[[sx,sy]];
  while(q.length){
    const [x,y]=q.pop();
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx, ny=y+dy;
      if(nx<0||ny<0||nx>=W||ny>=H||seen[ny*W+nx]||X.SOLID[A.map[ny*W+nx]]) continue;
      seen[ny*W+nx]=1; q.push([nx,ny]);
    }
  }
  let open=0, got=0;
  for(let i=0;i<W*H;i++){ if(!X.SOLID[A.map[i]]){ open++; if(seen[i]) got++; } }
  ok(got===open, z+': every open tile reachable from the gate', got+' / '+open);
  // and the things that spawned are standing somewhere you can get to
  const marooned = X.G.enemies.filter(e=>!seen[Math.floor(e.y/16)*W+Math.floor(e.x/16)]);
  ok(marooned.length===0, z+': no creature spawned somewhere unreachable',
     marooned.length+' of '+X.G.enemies.length);
  ok(X.G.enemies.length>=15, z+': properly populated', X.G.enemies.length+' creatures');
}

console.log('\n=== OUTSIDE THE WALLS IS DANGEROUS ===');
{
  // Drop the player next to a Slag Bear and let it work. It must close, wind
  // up, and take real health off. Damage arriving with no wind-up first would
  // mean the telegraph had been lost, which is the whole fairness contract.
  X.loadArea('scarp', 20*16, 26*16);
  X.G.enemies.length = 0;
  X.spawnEnemy('slagbear', 20*16+40, 26*16);
  const hp0 = X.player.hp;
  let sawWind = false, windBeforeHit = false;
  for(let i=0;i<260;i++){
    tick();
    if(X.G.enemies[0] && X.G.enemies[0].ai==='wind') sawWind = true;
    if(X.player.hp < hp0){ windBeforeHit = sawWind; break; }
  }
  ok(X.player.hp < hp0, 'a Slag Bear will actually hurt you', hp0+' -> '+X.player.hp);
  ok(windBeforeHit, 'and it telegraphs before every hit');
}

console.log('\n=== INSIDE THE WALLS IS NOT ===');
{
  // Stand still in the middle of the Rustfields, surrounded, and take nothing.
  X.loadArea('clearing', X.AREAS.clearing.playerStart.x, X.AREAS.clearing.playerStart.y);
  X.player.hp = X.player.maxhp;
  X.player.x = 22*16; X.player.y = 30*16;
  for(const e of X.G.enemies){ e.x = X.player.x + (Math.random()-0.5)*30;
                               e.y = X.player.y + (Math.random()-0.5)*30; }
  const hp0 = X.player.hp;
  for(let i=0;i<400;i++) tick();
  ok(X.player.hp === hp0, 'the Rustfields still cannot hurt you',
     X.G.enemies.length+' creatures, hp '+hp0+' -> '+X.player.hp);

  // same for the city
  X.loadArea('cogway', X.AREAS.cogway.playerStart.x, X.AREAS.cogway.playerStart.y);
  const hp1 = X.player.hp;
  for(let i=0;i<200;i++) tick();
  ok(X.player.hp === hp1 && X.G.enemies.length===0, 'and the Cogway is empty and safe');
}

console.log('\n=== EVERY CREATURE IS COMPLETE ===');
{
  const missing = [];
  for(const kind of X.CODEX_ORDER){
    const T0 = X.ENEMY_TYPES[kind], L = X.LEARNABLE[kind];
    if(!T0)            missing.push(kind+': no stats');
    else if(!T0.zone)  missing.push(kind+': no zone');
    else if(!L)        missing.push(kind+': no codex entry');
    else if(!L.lore)   missing.push(kind+': no field note');
    else if(!L.desc)   missing.push(kind+': no ability text');
    if(T0 && T0.hostile && !(T0.atk>0)) missing.push(kind+': hostile but harmless');
  }
  ok(missing.length===0,
     'stats, zone, field note and Savant ability on all '+X.CODEX_ORDER.length,
     missing.join('; '));

  // Everything in the codex has to be findable. Most creatures are findable
  // because a spawn table places them; the Glimmervein's are findable because
  // a pylon pours them, which is a different mechanism and has to be counted
  // as one rather than read as a gap.
  const spawned = new Set();
  for(const z of ZONES.concat(['clearing','glimmervein']))
    for(const s of (X.AREAS[z].spawns||[])) spawned.add(s.kind);
  if((X.AREAS.glimmervein.pylonSpots||[]).length){
    spawned.add('pylon');
    for(const k of X.IMP_KINDS) spawned.add(k);
  }
  const unfindable = X.CODEX_ORDER.filter(k=>!spawned.has(k));
  ok(unfindable.length===0, 'and every one of them actually spawns somewhere',
     unfindable.join(', '));
}

console.log('\n=== THE CODEX FILLS IN BY FIGHTING ===');
{
  X.G.seen = {};
  X.loadArea('verge', X.AREAS.verge.playerStart.x, X.AREAS.verge.playerStart.y);
  const e = X.G.enemies.find(q=>q.kind==='brasshare');
  ok(!X.G.seen.brasshare, 'unrecorded before you touch it');
  X.hurtEnemy(e, 1, e.x, e.y, false, 0);
  ok(!!X.G.seen.brasshare, 'recorded on first damage dealt');
  ok(!X.G.seen.tickboar, 'and only the one you hit');

  // and the other way round: something that attacks YOU is recorded too.
  // Only landing hits would mean a creature that drives you off never makes
  // it into the journal, which is a strange thing for a field journal to do.
  X.G.seen = {};
  X.loadArea('scarp', 20*16, 26*16);
  X.G.enemies.length = 0;
  X.spawnEnemy('slagbear', 20*16+40, 26*16);
  for(let i=0;i<260 && !X.G.seen.slagbear;i++) tick();
  ok(!!X.G.seen.slagbear, 'and recorded by being attacked, not only by attacking');
}

console.log('\n=== AND ONLY A SAVANT CAN EQUIP FROM IT ===');
{
  // A non-Savant is refused even with the entry in hand.
  X.setCls(0,0);
  X.player.codex = [{ ...X.LEARNABLE.brasshare, kind:'brasshare' }];
  X.G.codexSel = X.CODEX_ORDER.indexOf('brasshare');
  const before = X.CLASSES[0].abilities[1].name;
  X.equipFromCodex(1);
  ok(X.CLASSES[0].abilities[1].name === before, 'an Ironclad cannot re-slot', before);

  X.setCls(8,0);
  const sav = X.CLASSES[8];
  X.player.codex = [{ ...X.LEARNABLE.brasshare, kind:'brasshare' },
                    { ...X.LEARNABLE.cragram,   kind:'cragram'   }];
  X.equipFromCodex(1);
  ok(sav.abilities[1].name === 'Spring Step', 'a Savant can', sav.abilities[1].name);

  // An unlearned creature is refused even for a Savant.
  X.G.codexSel = X.CODEX_ORDER.indexOf('slagbear');
  X.equipFromCodex(2);
  ok(sav.abilities[2].name.indexOf('Empty') >= 0, 'but not one they have never scanned');

  // Slotting the same ability twice must MOVE it, not clone it: two slots
  // sharing a name don't share a cooldown and read as a bug.
  X.G.codexSel = X.CODEX_ORDER.indexOf('brasshare');
  X.equipFromCodex(3);
  const count = sav.abilities.filter(a=>a.name==='Spring Step').length;
  ok(count === 1, 'and equipping it elsewhere moves it rather than duplicating',
     count + ' copies');
  // Slot 0 is the Savant's own tool and equipping must never land on it.
  // That tool is Scan now — it used to be Codex Strike, a weak swipe whose
  // only job was to apply the Analyzed mark, which Scan does to anything
  // already in the codex. Scanning moved off SPACE at the same time, so the
  // class has a dodge like everybody else.
  ok(sav.abilities[0].name === 'Scan' && sav.abilities[0].kind === 'scan',
     'and slot 0 is still the Savant\u2019s own Scan', sav.abilities[0].name);
}

console.log(fails ? '\nFAIL ('+fails+')' : '\nPASS');
process.exit(fails ? 1 : 0);
