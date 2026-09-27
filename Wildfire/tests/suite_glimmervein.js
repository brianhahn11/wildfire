// The Glimmervein: elements, the three imps, and the pylons that pour them.
//
// This zone is the first thing in the game where the ANSWER to an encounter is
// a damage type rather than a number, and the first with an enemy that comes
// back. Both are easy to break silently: an immunity that quietly multiplies
// by one instead of zero looks like a slightly tanky enemy, and a respawn
// timer that never stops looks like a hard fight. So both are asserted by
// reading the numbers, not by fighting and forming an impression.
const {X, press, tick} = require('./harness.js');
require('./strict.js');

let fails = 0;
const ok = (c,l,e) => { console.log('  '+(c?'ok  ':'FAIL')+'  '+l+(e?'  — '+e:'')); if(!c) fails++; };

function fresh(cls, drg){
  X.G.nPlayers = 1; X.G.picks = [{cls:cls===undefined?4:cls, drg:drg===undefined?0:drg}];
  X.G.state = X.ST.PLAY; X.beginGame();
  for(let i=0;i<10;i++) tick();
}
function enterCave(){
  const a = X.AREAS.glimmervein;
  X.loadArea('glimmervein', a.playerStart.x, a.playerStart.y);
  X.G.fade = 0; X.G.areaNameT = 0;
}
const imps = ()=>X.G.enemies.filter(e=>!e.dead && e.kind.endsWith('imp'));
const pylons = ()=>X.G.enemies.filter(e=>!e.dead && e.kind==='pylon');

// ---------------------------------------------------------------------------
console.log('=== THE WORLD MATCHES THE MAP ===');
{
  // The map has always drawn the road in to the WEST of the ring and the
  // beach to the SOUTH. The world used to have them the other way round, so
  // the first thing the map told you was a lie about the walk you had just
  // made. These two assertions are the whole reason that changed.
  const g = {}; for(const q of X.COG.GATES) g[q.to] = q.dir;
  ok(g.gate   === 'w', 'the Outer Gate is the west gate',  g.gate);
  ok(g.shoals === 's', 'the Rivet Shoals are the south gate', g.shoals);
  ok(g.verge  === 'n' && g.scarp === 'e', 'the other two are unchanged',
     g.verge+'/'+g.scarp);

  // and each zone sends you back to the gate it actually hangs off
  for(const id of ['gate','verge','scarp','shoals']){
    const ex = X.AREAS[id].exits.find(e=>e.gate);
    ok(!!ex && X.COG.GATES.some(q=>q.dir===ex.gate && q.to===id),
       id+' returns through its own gate', ex && ex.gate);
  }
}

// ---------------------------------------------------------------------------
console.log('\n=== THE CAVE IS REACHABLE AND WALKABLE ===');
{
  fresh();
  const u = X.AREAS.undercroft;
  const crack = u.exits.filter(e=>e.to==='glimmervein');
  ok(crack.length > 0, 'the Undercroft has a way west', crack.length+' tiles');
  ok(crack.every(e=>e.x===0), 'and it is on the west wall',
     crack.map(e=>e.x).join(','));

  // The landing is built around the shaft: the cage comes down in the middle
  // and the two ways on lead off it left and right. The lift has been moved
  // once already, and both exits' arrival coordinates are derived from it, so
  // this checks the SHAPE rather than any particular number.
  const mid = { x:u.w/2, y:u.h/2 };
  const lx = u.lift.reduce((s2,q)=>s2+q[0],0)/u.lift.length;
  const ly = u.lift.reduce((s2,q)=>s2+q[1],0)/u.lift.length;
  ok(Math.abs(lx-mid.x) < 3 && Math.abs(ly-mid.y) < 3,
     'the lift is in the middle of the chamber',
     lx.toFixed(1)+','+ly.toFixed(1)+' of '+mid.x+','+mid.y);
  ok(crack.every(e=>e.x < lx), 'the Glimmervein is west of it', String(lx));

  // and a sealed way east, for a zone that does not exist yet
  let seal = null;
  for(let y=0;y<u.h && !seal;y++) for(let x=0;x<u.w;x++)
    if(u.map[y*u.w+x]===X.TILES.SEAL){ seal = {x,y}; break; }
  ok(!!seal, 'there is a sealed door');
  ok(seal && seal.x > lx, 'and it is east of the lift', seal && String(seal.x));
  ok(u.doorSeal === true, 'flagged, so F at it explains rather than promises');
  ok(!u.exits.some(e=>e.x > lx), 'and nothing east actually goes anywhere yet',
     u.exits.map(e=>e.to+'@'+e.x).join(','));

  const a = X.AREAS.glimmervein;
  ok(a.exits.some(e=>e.to==='undercroft'), 'and the cave has a way back');
  // both directions, against whatever the landing looks like today
  for(const ex of a.exits.filter(e=>e.to==='undercroft')){
    const tx=(ex.tx/16)|0, ty=(ex.ty/16)|0;
    ok(!X.SOLID[u.map[ty*u.w+tx]], 'and coming back does not land in rock',
       tx+','+ty);
  }
  for(const e of crack)
    ok(!X.SOLID[a.map[((e.ty/16)|0)*a.w + ((e.tx/16)|0)]],
       'you do not arrive inside a wall', ((e.tx/16)|0)+','+((e.ty/16)|0));

  // every anchor must be somewhere a pylon can actually stand, or the cave
  // quietly ships with fewer generators than it was designed around
  ok(a.pylonSpots.length >= 6, 'there are enough pylon anchors',
     String(a.pylonSpots.length));
  const bad = a.pylonSpots.filter(([x,y]) => X.SOLID[a.map[y*a.w+x]]);
  ok(bad.length === 0, 'and none of them is inside rock', JSON.stringify(bad));

  // the entrance must reach the rest of the cave — the cavern is carved out
  // of noise, so this is the assertion that noise cannot seal the player in
  const seen = new Uint8Array(a.w*a.h);
  const sx = (a.playerStart.x/16)|0, sy = (a.playerStart.y/16)|0;
  const q = [[sx,sy]]; seen[sy*a.w+sx] = 1; let reach = 1;
  while(q.length){
    const [x,y] = q.pop();
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx, ny=y+dy;
      if(nx<0||ny<0||nx>=a.w||ny>=a.h) continue;
      if(seen[ny*a.w+nx] || X.SOLID[a.map[ny*a.w+nx]]) continue;
      seen[ny*a.w+nx]=1; reach++; q.push([nx,ny]);
    }
  }
  let open=0; for(let i=0;i<a.map.length;i++) if(!X.SOLID[a.map[i]]) open++;
  ok(reach === open, 'every open tile is reachable from the entrance',
     reach+' of '+open);
  const anchorsReached = a.pylonSpots.filter(([x,y])=>seen[y*a.w+x]).length;
  ok(anchorsReached === a.pylonSpots.length, 'including every pylon anchor',
     anchorsReached+' of '+a.pylonSpots.length);
}

// ---------------------------------------------------------------------------
console.log('\n=== THE THREE ARE ONE CREATURE IN THREE COLOURS ===');
{
  const K = ['emberimp','rimeimp','stormimp'];
  for(const k of K){
    const T = X.ENEMY_TYPES[k], L = X.LEARNABLE[k];
    ok(!!T.hurl, k+' can throw its fork');
    ok(T.immune === T.elem, k+' is immune to its own element', T.immune);
    ok(T.weak.length === 2 && T.weak.indexOf(T.elem) < 0,
       'and weak to the other two', T.weak.join('+'));
    ok(!!T.melt, 'and melts rather than falls over');
    ok(!!L && L.kind === 'hurl' && L.elem === T.elem,
       'its Savant ability is its own fork', L && L.elem);
  }
  const names = new Set(K.map(k=>X.LEARNABLE[k].name));
  ok(names.size === 3, 'the three forks are three distinct abilities',
     [...names].join(', '));
  // they cover each other: for any one of them, at least one learned fork is
  // a weakness. Otherwise a Savant could collect all three and still be stuck.
  for(const k of K){
    const T = X.ENEMY_TYPES[k];
    const answer = K.filter(o=>T.weak.indexOf(X.LEARNABLE[o].elem) >= 0);
    ok(answer.length === 2, 'two of the three forks answer '+k,
       answer.join(','));
  }
}

// ---------------------------------------------------------------------------
console.log('\n=== IMMUNITY IS ZERO, NOT "A BIT LESS" ===');
{
  fresh();
  enterCave();
  X.G.enemies.length = 0;
  X.spawnEnemy('emberimp', X.player.x+30, X.player.y);
  const e = X.G.enemies[0];

  e.hp = 500;
  X.withElement('fire', ()=>X.hurtEnemy(e, 100, 0, 0, false, 0));
  ok(e.hp === 500, 'fire does nothing at all to an Ember Imp', String(e.hp));

  e.hp = 500;
  X.withElement(null, ()=>X.hurtEnemy(e, 100, 0, 0, false, 0));
  const neutral = 500 - e.hp;
  ok(neutral === 100, 'a plain sword still works on it', String(neutral));

  e.hp = 500;
  X.withElement('ice', ()=>X.hurtEnemy(e, 100, 0, 0, false, 0));
  const weak = 500 - e.hp;
  ok(weak > neutral * 1.5, 'and ice hits it much harder',
     weak+' vs '+neutral);

  // the status effects have to honour it too, or a fire dragon's breath deals
  // no damage and then sets the fire elemental on fire anyway
  e.burn = 0; X.applyBurn(e, 5);
  ok(e.burn === 0, 'and it cannot be set on fire', String(e.burn));
  const r = X.spawnEnemy('rimeimp', X.player.x+50, X.player.y) || X.G.enemies[1];
  const rim = X.G.enemies.find(q=>q.kind==='rimeimp');
  X.applySlow(rim, 0.5, 3);
  ok(rim.slow === 0, 'and a Rime Imp cannot be chilled', String(rim.slow));
  X.applyBurn(rim, 5);
  ok(rim.burn === 5, 'but it can certainly be burned', String(rim.burn));
}

// ---------------------------------------------------------------------------
console.log('\n=== THE PYLON KEEPS POURING UNTIL YOU BREAK IT ===');
{
  fresh();
  enterCave();
  ok(pylons().length >= 4, 'walking in sets up several pylons',
     String(pylons().length));
  for(let i=0;i<10;i++) tick();
  ok(imps().length === pylons().length, 'each one is pouring a spirit',
     imps().length+' spirits / '+pylons().length+' pylons');
  ok(pylons().every(p=>imps().some(q=>q.pylonId===p.id)),
     'and every spirit is bound to the pylon that made it');

  // Clear the room down to one pylon and park the player out of reach. The
  // first version of this test left five imps on a stationary player, who
  // died about twelve seconds in — and a dead player stops the world, so the
  // respawn timer simply stopped and the test read it as "never came back".
  const p = pylons()[0];
  for(const e of X.G.enemies)
    if(e !== p && e.pylonId !== p.id){ e.dead = true; e.deadT = 0; }
  X.player.x = X.AREAS.glimmervein.playerStart.x;
  X.player.y = X.AREAS.glimmervein.playerStart.y;
  let child = imps().find(q=>q.pylonId===p.id);
  ok(!!child, 'the pylon under test has a spirit');
  const wasKind = child.kind;
  child.hp = 1; X.withElement(null, ()=>X.hurtEnemy(child, 50, 0, 0, false, 0));
  ok(child.dead, 'it can be killed', String(child.dead));
  for(let i=0;i<10*60;i++){ X.player.hp = X.player.maxhp; tick(); }   // ten seconds
  ok(!imps().some(q=>q.pylonId===p.id),
     'ten seconds later it is still gone');
  for(let i=0;i<22*60;i++){ X.player.hp = X.player.maxhp; tick(); }   // past thirty
  const back = imps().find(q=>q.pylonId===p.id);
  ok(!!back, 'thirty seconds later the pylon has poured another');
  ok(back && back.kind === wasKind, 'and it is the same colour as before',
     back && back.kind);

  // break the pylon and the tap is closed for good
  p.hp = 1; X.withElement(null, ()=>X.hurtEnemy(p, 50, 0, 0, false, 0));
  ok(p.dead, 'the pylon can be destroyed');
  const survivor = imps().find(q=>q.pylonId===p.id);
  if(survivor){ survivor.hp=1; X.withElement(null, ()=>X.hurtEnemy(survivor,50,0,0,false,0)); }
  // Its clock is forced to zero rather than waited out. Waiting proves it did
  // not pour within the wait; forcing the timer proves it will not pour even
  // when the timer says it should, which is the actual claim.
  p.spawnT = 0;
  for(let i=0;i<5*60;i++){ X.player.hp = X.player.maxhp; tick(); }
  ok(!imps().some(q=>q.pylonId===p.id),
     'and with its clock run out it still pours nothing');
  ok(X.IMP_RESPAWN === 30, 'the interval is the thirty seconds it claims',
     String(X.IMP_RESPAWN));
}

// ---------------------------------------------------------------------------
console.log('\n=== WHICH ELEMENTS ARE WAITING CHANGES EVERY VISIT ===');
{
  fresh();
  const rolls = [];
  for(let n=0;n<10;n++){
    enterCave();
    rolls.push(pylons().map(p=>p.impKind).sort().join('|'));
  }
  const distinct = new Set(rolls);
  ok(distinct.size > 1, 'two visits are not the same fight',
     distinct.size+' distinct layouts in 10 visits');
  const kinds = new Set();
  for(const r of rolls) for(const k of r.split('|')) kinds.add(k);
  ok(kinds.size === 3, 'and all three colours do turn up', [...kinds].join(','));
}

// ---------------------------------------------------------------------------
console.log('\n=== THE FORK IS A REAL ABILITY ===');
{
  fresh(8, 0);                                   // Savant
  ok(X.cls.id === 'savant', 'savant selected', X.cls.id);
  enterCave();
  X.G.enemies.length = 0;
  X.spawnEnemy('emberimp', X.player.x+24, X.player.y);

  // learn the ember fork off the thing that throws it
  X.assimilate ? X.assimilate() : null;
  X.player.codex.push({ ...X.LEARNABLE.emberimp, kind:'emberimp',
                        akind:X.LEARNABLE.emberimp.kind, source:'Ember Imp' });
  X.G.codexSel = X.CODEX_ORDER.indexOf('emberimp');
  X.equipFromCodex(1);
  ok(X.cls.abilities[1].name === 'Ember Fork', 'it equips into a slot',
     X.cls.abilities[1].name);
  ok(X.cls.abilities[1].elem === 'fire',
     'and the slot remembers what element it is', X.cls.abilities[1].elem);
  // An equipped codex ability used to arrive with kind:'emberimp', which
  // matches no arm of the Savant dispatch, so it fell through to the default
  // one and cast a poison nova. Every ability equipped from the codex page
  // did this. Nothing said so.
  ok(X.cls.abilities[1].kind === 'hurl',
     'and what it actually DOES, not just what it is called',
     X.cls.abilities[1].kind);
  for(const k of ['brasshare','cragram','turbineel']){
    const L = X.LEARNABLE[k];
    X.player.codex.push({ ...L, kind:k, akind:L.kind, source:k });
    X.G.codexSel = X.CODEX_ORDER.indexOf(k);
    X.equipFromCodex(2);
    ok(X.cls.abilities[2].kind === L.kind, k+' equips as itself too',
       X.cls.abilities[2].kind+' vs '+L.kind);
  }
  X.G.codexSel = X.CODEX_ORDER.indexOf('emberimp'); X.equipFromCodex(1);

  // fired at an ember imp it should do nothing; at a rime imp, a great deal
  X.G.enemies.length = 0;
  const target = X.spawnEnemy('rimeimp', X.player.x+40, X.player.y) || X.G.enemies[0];
  const rim = X.G.enemies[0];
  rim.hp = rim.maxhp = 900;
  X.player.inx = 1; X.player.iny = 0; X.updateTarget();
  X.player.cds = [0,0,0,0];
  X.useAbility(1);
  for(let i=0;i<60;i++) tick();
  ok(rim.hp < 900, 'a thrown fork reaches what it was aimed at',
     rim.maxhp-rim.hp+' damage');
}

// ---------------------------------------------------------------------------
console.log('\n=== BULWARK: AEGIS IS EARNED, NOT WAITED FOR ===');
{
  fresh(1, 0);                                   // Bulwark
  X.loadArea('verge', X.AREAS.verge.playerStart.x, X.AREAS.verge.playerStart.y);
  X.G.fade = 0; X.G.enemies.length = 0;

  X.player.aegis = 0;
  X.player.cds = [0,0,0,0];
  X.useAbility(0);
  ok(X.player.bastion === true, 'Bastion is a toggle and it is up');
  for(let i=0;i<8*60;i++) tick();                // eight seconds, empty room
  ok(X.player.aegis === 0, 'eight seconds alone in Bastion builds nothing',
     X.player.aegis.toFixed(1));

  // now give it something to hold the line against
  for(let n=0;n<4;n++) X.spawnEnemy('brasshare', X.player.x+18+n*6, X.player.y+6);
  for(const e of X.G.enemies) e.taunt = 20;
  for(let i=0;i<2*60;i++) tick();
  ok(X.player.aegis > 10, 'four creatures on you builds it fast',
     X.player.aegis.toFixed(1));

  // Drop it off the cap first, or "a hit adds aegis" is unmeasurable — and
  // clear the i-frames from the last creature that hit us, or hurtPlayer
  // returns without doing anything and the test reads it as no gain.
  X.player.aegis = 40;
  X.player.iframe = 0;
  X.G.enemies.length = 0;
  const before = X.player.aegis;
  X.hurtPlayer(6, X.player.x+20, X.player.y);
  ok(X.player.aegis > before, 'and taking a hit builds it too',
     before.toFixed(1)+' -> '+X.player.aegis.toFixed(1));

  ok(X.cls.abilities[1].cd === 2, 'Aegis Break comes round every 2s',
     String(X.cls.abilities[1].cd));
}

console.log(fails ? '\nFAIL ('+fails+')' : '\nPASS');
process.exit(fails ? 1 : 0);
