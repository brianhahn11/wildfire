// Two players.
//
// `player`, `cls`, `drg` and `dragon` are now a CURSOR into PLAYERS rather
// than singletons. That was the cheapest way to add a second character to a
// codebase where every system reads those globals — but it means the failure
// mode is no longer "it crashes", it's "it silently acted on the wrong
// character". Most of this file is about that: P2's ability crediting P1's
// gauge, P2's drops landing in P1's cooldowns, deferred work resolving
// against whoever happens to be current when the timer expires.
//
// The other half is that ONE player must still behave exactly as before.
const {X, press, rel, tick} = require('./harness.js');
require('./strict.js');

let fails = 0;
const ok = (c,l,e) => { console.log('  '+(c?'ok  ':'FAIL')+'  '+l+(e?'  — '+e:'')); if(!c) fails++; };

console.log('=== ONE PLAYER IS STILL ONE PLAYER ===');
{
  X.G.picks = []; X.G.nPlayers = 1;
  X.G.selClass = 0; X.G.selDragon = 0;
  press('Enter'); X.beginGame();
  for(let i=0;i<20;i++) tick();
  ok(X.PLAYERS.length===1, 'a solo run has one roster entry', X.PLAYERS.length+'');
  ok(!X.twoPlayer(), 'and does not think it is co-op');
  ok(X.player === X.PLAYERS[0], 'the cursor points at them');
  ok(X.otherPlayer()===null, 'and there is no partner');
  // death is still death, not a downed state with nobody to help
  X.loadArea('verge', X.AREAS.verge.playerStart.x, X.AREAS.verge.playerStart.y);
  X.G.enemies.length = 0;
  X.player.iframe = 0; X.player.hp = 5;
  X.hurtPlayer(99, X.player.x, X.player.y);
  ok(X.G.state === X.ST.DEAD, 'and a lone player who dies is dead', 'state '+X.G.state);
  ok(!X.player.down, 'not downed');
}

console.log('\n=== TWO PLAYERS ARE TWO SEPARATE CHARACTERS ===');
{
  X.G.nPlayers = 2;
  X.G.picks = [{cls:4, drg:0}, {cls:8, drg:2}];   // Reaver + Savant
  X.G.state = X.ST.PLAY;
  X.beginGame();
  for(let i=0;i<20;i++) tick();
  const [a,b] = X.PLAYERS;
  ok(X.PLAYERS.length===2, 'two roster entries');
  ok(a.cls.id==='reaver' && b.cls.id==='savant', 'each got the class they picked',
     a.cls.id+' / '+b.cls.id);
  ok(a.drg !== b.drg, 'and a different hatchling each');
  ok(a.cls !== b.cls, 'with their own class object, not a shared one');
  ok(a.dragon !== b.dragon, 'and their own dragon state');
  ok(a.col.id==='1P' && b.col.id==='2P', 'tagged 1P and 2P');
  ok(a.keys.up==='w' && b.keys.up==='i', 'and different key maps');

  // The Savant WRITES to cls.abilities when it learns. Two players sharing a
  // class object would share a loadout; worse, two Savants would overwrite
  // each other. This is why the roster deep-copies the class.
  b.cls.abilities[1] = { name:'TEST SLOT', cd:1, cast:0, desc:'' };
  ok(X.CLASSES[8].abilities[1].name !== 'TEST SLOT',
     'writing to one player’s class does not touch the template');
}

console.log('\n=== EVERYONE ARRIVES WHEN THE AREA CHANGES ===');
{
  // loadArea used to move only the player the cursor was on. The other was
  // left at their previous coordinates — or 0,0 on the very first load — so
  // they were invisible somewhere off the map AND the tether failed in every
  // direction, freezing the player who HAD arrived. Two unrelated-looking
  // symptoms from one line.
  //
  // Note that every other test in this file used to set p2.x by hand right
  // after loadArea, which quietly worked around this instead of catching it.
  const [a,b] = X.PLAYERS;
  b.x = -9999; b.y = -9999;                       // somewhere impossible
  X.loadArea('verge', X.AREAS.verge.playerStart.x, X.AREAS.verge.playerStart.y);
  const tx = X.AREAS.verge.playerStart.x, ty = X.AREAS.verge.playerStart.y;
  ok(Math.hypot(a.x-tx, a.y-ty) < 40, 'P1 lands at the destination',
     Math.round(a.x)+','+Math.round(a.y));
  ok(Math.hypot(b.x-tx, b.y-ty) < 40, 'and so does P2',
     Math.round(b.x)+','+Math.round(b.y));
  const gap = Math.hypot(a.x-b.x, a.y-b.y);
  ok(gap > 2 && gap < 40, 'close together but not stacked exactly', Math.round(gap)+'px');

  // both must be inside the camera frame the moment the area loads
  const cam = X.camTarget();
  const inside = p => p.x>cam.x && p.x<cam.x+480 && p.y>cam.y && p.y<cam.y+270;
  ok(inside(a) && inside(b), 'and both are on screen immediately');

  // and P1 can move without anyone repositioning P2 first
  X.G.enemies.length = 0;
  for(const k in X.keys) X.keys[k] = false;
  const sx = a.x;
  press('d'); for(let i=0;i<30;i++) tick(); rel('d');
  ok(Math.abs(a.x-sx) > 10, 'P1 can move the instant they arrive',
     (a.x-sx).toFixed(1)+'px');

  // dragons come too, rather than being left in the previous area
  ok(Math.hypot(a.dragon.x-a.x, a.dragon.y-a.y) < 120, "P1's dragon arrives too");
  ok(Math.hypot(b.dragon.x-b.x, b.dragon.y-b.y) < 120, "and P2's");
}

console.log('\n=== THE TETHER CANNOT TRAP ANYONE ===');
{
  // Whatever puts two players too far apart — a bad spawn, a blink, a lift —
  // closing the gap has to stay legal, or the pair lock solid with no way out.
  const [a,b] = X.PLAYERS;
  X.loadArea('verge', 30*16, 30*16);
  a.x = 30*16; a.y = 30*16;
  b.x = a.x + 2000; b.y = a.y + 2000;            // absurdly far
  const toward = X.withPlayer(b, ()=>X.tetherOk(b.x-8, b.y-8));
  const away   = X.withPlayer(b, ()=>X.tetherOk(b.x+8, b.y+8));
  ok(toward, 'moving back toward your partner is always allowed');
  ok(!away,  'moving further away is not');
}

console.log('\n=== AN ACTION CREDITS THE PLAYER WHO TOOK IT ===');
{
  const [a,b] = X.PLAYERS;
  X.loadArea('verge', X.AREAS.verge.playerStart.x, X.AREAS.verge.playerStart.y);
  X.G.enemies.length = 0;
  b.x = a.x + 30; b.y = a.y;
  a.cds = [0,0,0,0]; b.cds = [0,0,0,0];

  // P2 presses their own ability key; only P2's cooldown may move
  press('7');
  ok(b.cds[0] > 0, "P2's key started P2's cooldown", b.cds[0].toFixed(2));
  ok(a.cds[0] === 0, "and left P1's alone", a.cds[0].toFixed(2));

  // and the reverse
  a.cds = [0,0,0,0]; b.cds = [0,0,0,0];
  press('arrowup');
  ok(a.cds[0] > 0, "P1's key started P1's cooldown");
  ok(b.cds[0] === 0, "and left P2's alone");
}

console.log('\n=== DEFERRED WORK RESOLVES AGAINST ITS OWNER ===');
{
  // The Reaver's Lacerate resolves three slashes on a timer. If those fire
  // against whoever the cursor is on when the timer expires rather than
  // against the Reaver, P1's Tempo lands on P2 — and every multi-hit ability
  // in the game misattributes.
  const [a,b] = X.PLAYERS;
  X.loadArea('verge', X.AREAS.verge.playerStart.x, X.AREAS.verge.playerStart.y);
  X.G.enemies.length = 0;
  X.spawnEnemy('brasshare', a.x + 18, a.y);
  const t = X.G.enemies[0]; t.hp = 9999; t.maxhp = 9999;
  a.tempo = 0; b.tempo = 0;
  a.cds = [0,0,0,0];
  X.withPlayer(a, ()=>{ a.inx = 1; a.iny = 0; X.updateTarget(); X.useAbility(0); });
  for(let i=0;i<40;i++) tick();
  ok(a.tempo > 0, "the Reaver's own Tempo moved", a.tempo+'');
  ok(!b.tempo, "and the Savant's did not", (b.tempo||0)+'');
}

console.log('\n=== EACH PLAYER HAS THEIR OWN AETHITE ===');
{
  const [a,b] = X.PLAYERS;
  ok(a.aethiteMax === b.aethiteMax, 'shared milestones give equal capacity',
     a.aethiteMax+' / '+b.aethiteMax);
  X.loadArea('verge', X.AREAS.verge.playerStart.x, X.AREAS.verge.playerStart.y);
  X.G.enemies.length = 0;
  b.x = a.x + 30; b.y = a.y;
  a.hp = 20; b.hp = 20;
  a.aethite = a.aethiteMax; b.aethite = b.aethiteMax;
  X.withPlayer(a, ()=>X.toggleBurn());
  for(let i=0;i<30;i++) tick();
  ok(a.burning, 'P1 is burning');
  ok(!b.burning, 'P2 is not');
  ok(a.aethite < b.aethite, "and only P1's store drained",
     Math.round(a.aethite)+' vs '+Math.round(b.aethite));
  ok(b.hp === 20, "P2 got no healing from P1's burn");
  X.withPlayer(a, ()=>{ a.burning=false; });
}

console.log('\n=== THE TETHER IS A WALL, NOT A LEASH ===');
{
  const [a,b] = X.PLAYERS;
  X.loadArea('verge', 30*16, 30*16);
  a.x = 30*16; a.y = 30*16; b.x = a.x+20; b.y = a.y;

  // Probe the predicate directly. Walking a player until they stop proves
  // nothing — the first run of this test "passed" because P2 hit a tree at
  // 74px, which says everything about the scenery and nothing about the
  // tether.
  const probeX = d => X.withPlayer(b, ()=>X.tetherOk(a.x+d, a.y));
  const probeY = d => X.withPlayer(b, ()=>X.tetherOk(a.x, a.y+d));
  let maxGap = 0;
  for(let d=20; d<600; d+=2){ if(!probeX(d)) break; maxGap = d; }
  ok(maxGap > 200, 'the tether allows a real working distance', maxGap+'px');
  ok(maxGap < 470, 'but never more than the screen', maxGap+'px');
  ok(!probeX(maxGap+40), 'and refuses beyond it');
  ok(probeX(40), 'while allowing normal play');

  // vertical too, which is the tighter axis
  let maxV = 0;
  for(let d=10; d<400; d+=2){ if(!probeY(d)) break; maxV = d; }
  ok(maxV > 90 && maxV < 260, 'vertical separation is bounded by the shorter axis', maxV+'px');

  // It has to behave as a WALL and not a box: at the limit the blocked axis
  // is refused while the free one is still allowed, which is what lets you
  // slide along the screen edge instead of sticking to it.
  //
  // Asserted on the predicate, not by walking. Two earlier versions of this
  // check walked a player until they stopped and then credited the tether —
  // once it was a tree in the Verge, once a cliff in the Undercroft. What
  // the movement code does with scenery is a different question.
  b.x = a.x + maxGap; b.y = a.y;
  const atWall = d => X.withPlayer(b, ()=>X.tetherOk(b.x+d, b.y));
  const sideways = d => X.withPlayer(b, ()=>X.tetherOk(b.x, b.y+d));
  ok(!atWall(6), 'at the limit, further out is refused');
  ok(atWall(-6), 'coming back is allowed');
  ok(sideways(6) && sideways(-6), 'and moving along the wall is allowed');
  // moveBy must honour that per axis rather than refusing the whole step
  const bx = b.x;
  X.withPlayer(b, ()=>X.moveBy(6,0));
  ok(Math.abs(b.x-bx) < 1, 'pushing straight into it does not move you',
     'drift '+(b.x-bx).toFixed(1));

  // nobody is ever dragged
  b.x = a.x + 30;
  const ax = a.x;
  for(let i=0;i<60;i++) tick();
  ok(Math.abs(a.x-ax) < 2, 'the tether never drags a player', 'moved '+Math.abs(a.x-ax).toFixed(1));
}

console.log('\n=== DOWN, REVIVE, AND WIPE ===');
{
  const [a,b] = X.PLAYERS;
  X.G.state = X.ST.PLAY;
  X.loadArea('verge', 30*16, 30*16);
  X.G.enemies.length = 0;
  a.x = 30*16; a.y = 30*16; b.x = a.x+16; b.y = a.y;
  a.hp = a.maxhp; b.hp = 5; b.down = false; b.iframe = 0;

  X.withPlayer(b, ()=>X.hurtPlayer(99, b.x, b.y));
  ok(b.down, 'a player at zero goes down');
  ok(X.G.state === X.ST.PLAY, 'and the run continues', 'state '+X.G.state);

  // standing close brings them back
  for(let i=0;i<200 && b.down;i++) tick();
  ok(!b.down, 'a partner standing close revives them');
  ok(b.hp > 0, 'with health to spare', b.hp+'');

  // out of range, progress decays instead of completing
  b.hp = 5; b.iframe = 0;
  X.withPlayer(b, ()=>X.hurtPlayer(99, b.x, b.y));
  a.x = b.x + 300;
  for(let i=0;i<200;i++) tick();
  ok(b.down, 'nobody nearby means nobody gets up');

  // and both down is a wipe
  a.hp = 5; a.iframe = 0;
  X.withPlayer(a, ()=>X.hurtPlayer(99, a.x, a.y));
  for(let i=0;i<4;i++) tick();
  ok(X.G.state === X.ST.DEAD, 'both down ends the run', 'state '+X.G.state);
}

console.log('\n=== THE KEY MAPS DO NOT COLLIDE ===');
{
  const [m1, m2] = X.KEYMAPS;
  const all = m => [m.up,m.down,m.left,m.right,m.dodge,m.burn,m.act].concat(m.ab, m.dragon);
  const s1 = all(m1), s2 = all(m2);
  const clash = s1.filter(k => s2.indexOf(k) >= 0);
  ok(clash.length===0, 'no key does two jobs', clash.join(','));
  ok(new Set(s1).size===s1.length, 'P1 has no internal duplicate');
  ok(new Set(s2).size===s2.length, 'P2 has no internal duplicate');
  // and neither map steals a menu key
  const menu = ['tab','escape','p','m'];
  ok(s1.concat(s2).filter(k=>menu.indexOf(k)>=0).length===0, 'and neither takes a menu key');
}

console.log('\n=== P2 DRIVES THEIR OWN DRAGON ===');
{
  const [a,b] = X.PLAYERS;
  X.G.state = X.ST.PLAY;
  X.loadArea('verge', X.AREAS.verge.playerStart.x, X.AREAS.verge.playerStart.y);
  X.G.enemies.length = 0;
  a.down = false; b.down = false;
  b.x = a.x + 30; b.y = a.y;
  a.dragon.cds = [0,0]; b.dragon.cds = [0,0];
  ok(a.dragon !== b.dragon, 'the two dragons are separate objects');

  press('u');
  ok(b.dragon.cds[0] > 0, "P2's dragon key fired P2's breath", b.dragon.cds[0].toFixed(1));
  ok(a.dragon.cds[0] === 0, "and not P1's");
  press('o');
  ok(b.dragon.cds[1] > 0, "P2's second dragon key works too");

  a.dragon.cds = [0,0]; b.dragon.cds = [0,0];
  press('q');
  ok(a.dragon.cds[0] > 0, "P1's dragon key fires P1's");
  ok(b.dragon.cds[0] === 0, 'and leaves P2 alone');

  // and the keys are actually reachable: every P2 action must be a real key
  const K = b.keys;
  const all = [K.up,K.down,K.left,K.right,K.dodge,K.burn,K.act].concat(K.ab, K.dragon);
  ok(all.every(k => typeof k === 'string' && k.length >= 1), 'every P2 binding is a real key');
  ok(K.dragon.length === 2, 'and P2 has two dragon keys', K.dragon.join('/'));
}

console.log('\n=== EASY ATTACKS ===');
{
  ok(X.G.easyAttack === false || X.G.easyAttack === undefined,
     'off unless switched on', String(X.G.easyAttack));

  // every class must have a rotation that can actually produce a slot
  const noRot = X.CLASSES.filter(c2 => !X.EASY_ROTATION[c2.id]).map(c2=>c2.id);
  ok(noRot.length === 0, 'every class has a rotation defined', noRot.join(','));
  const bad = [];
  for(const id in X.EASY_ROTATION){
    const R = X.EASY_ROTATION[id];
    const idx = (R.order || []).concat(R.build||[], R.spend||[]);
    if(!idx.length) bad.push(id+': empty');
    if(idx.some(i => i<0 || i>3)) bad.push(id+': slot out of range');
    if(R.build && !R.spend) bad.push(id+': builders with nothing to spend on');
  }
  ok(bad.length === 0, 'and every rotation is well formed', bad.join('; '));

  // the builder/spender classes must actually build before they spend
  X.G.nPlayers = 1; X.G.picks = [{cls:4, drg:0}];   // Reaver
  X.G.state = X.ST.PLAY; X.beginGame();
  for(let i=0;i<20;i++) tick();
  X.G.easyAttack = true;
  X.loadArea('verge', X.AREAS.verge.playerStart.x, X.AREAS.verge.playerStart.y);
  X.G.enemies.length = 0;
  X.spawnEnemy('brasshare', X.player.x+20, X.player.y);
  const t = X.G.enemies[0]; t.hp = 99999; t.maxhp = 99999;

  // Mash the button at a human rate — about three presses a second. Both
  // extremes measure something other than the rotation: a long gap lets Tempo
  // decay as fast as the builders raise it, so a spender is never reached,
  // and no gap at all keeps the builders permanently on cooldown, so the
  // rotation falls through to its "take a spender rather than stand there"
  // arm on every press.
  const fired = [];
  for(let n=0;n<12;n++){
    X.player.inx = 1; X.player.iny = 0; X.updateTarget();
    const nx = X.easyNextAbility();
    if(nx >= 0){ fired.push({ name:X.cls.abilities[nx].name, tempo:X.player.tempo }); X.useAbility(nx); }
    for(let i=0;i<20;i++) tick();
  }
  const finishers = fired.filter(f => f.name==='Shadow Lunge' || f.name==='Bullet Rain');
  ok(fired.length >= 8, 'the button keeps producing an ability', fired.length+' presses');
  ok(finishers.length > 0, 'and reaches the finishers',
     fired.map(f=>f.name+':'+f.tempo).join(' '));
  ok(finishers.every(f => f.tempo > 0), 'and never dumps one on an empty gauge',
     finishers.map(f=>f.tempo).join(','));
  const builders = fired.filter(f => f.name==='Lacerate' || f.name==='Snapfire');
  ok(builders.length > finishers.length, 'and spends most presses building',
     builders.length+' builders / '+finishers.length+' finishers');

  // a class with no builder/spender shape cycles instead of repeating
  X.G.picks = [{cls:3, drg:0}];                     // Aethermancer
  X.beginGame(); for(let i=0;i<20;i++) tick();
  X.G.easyAttack = true;
  X.loadArea('verge', X.AREAS.verge.playerStart.x, X.AREAS.verge.playerStart.y);
  X.G.enemies.length = 0;
  const seen2 = new Set();
  for(let n=0;n<8;n++){
    const nx = X.easyNextAbility();
    if(nx>=0){ seen2.add(nx); X.useAbility(nx); }
    for(let i=0;i<40;i++) tick();
  }
  ok(seen2.size >= 2, 'a cycling class uses more than one slot', [...seen2].join(','));

  X.G.easyAttack = false;
}

// ---------------------------------------------------------------------------
// The menu belongs to whoever opened it
// ---------------------------------------------------------------------------
{
  console.log('\n=== THE MENU BELONGS TO WHOEVER OPENED IT ===');
  X.G.nPlayers = 2;
  X.G.picks = [{cls:1, drg:0}, {cls:4, drg:3}];     // Bulwark/Pyraling, Reaver/Verdling
  X.G.state = X.ST.PLAY; X.beginGame(); for(let i=0;i<20;i++) tick();
  X.loadArea('verge', X.AREAS.verge.playerStart.x, X.AREAS.verge.playerStart.y);
  X.G.enemies.length = 0;

  press('tab');
  ok(X.G.state===X.ST.JOURNAL && X.G.menuOwner===0, 'TAB opens P1 menu',
     'state '+X.G.state+' owner '+X.G.menuOwner);
  press('p');
  ok(X.G.state===X.ST.JOURNAL && X.G.menuOwner===0,
     "P2's key does not close P1's menu", 'state '+X.G.state);
  press('tab');
  ok(X.G.state===X.ST.PLAY, 'P1 closes with TAB', 'state '+X.G.state);

  press('p');
  ok(X.G.state===X.ST.JOURNAL && X.G.menuOwner===1, 'P opens P2 menu',
     'state '+X.G.state+' owner '+X.G.menuOwner);

  // the whole point of ownership: the part lands on the opener's dragon
  X.addItem('part','horns');
  // Find the page by ID. Pinning it to an index meant that inserting a tab
  // anywhere left of it silently pointed this test at a different page, where
  // pressing 1 does nothing and the failure reads as "parts are broken".
  X.G.codexPage = X.TABS.findIndex(t=>t.id==='dragon'); X.G.dragSel = 0;
  press('1');
  const p1h = X.PLAYERS[0].fitted && X.PLAYERS[0].fitted.head;
  const p2h = X.PLAYERS[1].fitted && X.PLAYERS[1].fitted.head;
  ok(p2h==='horns', "P2's menu fits the part to P2's dragon", String(p2h));
  ok(!p1h, "and leaves P1's dragon alone", String(p1h));

  // and the page it draws is the opener's, not the cursor's
  let drawn = null;
  X.withPlayer(X.PLAYERS[1], ()=>{ drawn = X.drg.name; });
  ok(drawn === X.DRAGONS[3].name, 'the owner cursor resolves to their dragon', drawn);

  press('p');
  ok(X.G.state===X.ST.PLAY, 'P2 closes with P', 'state '+X.G.state);

  // one player: both keys are the same menu, so either one shuts it
  X.G.nPlayers = 1; X.G.picks = [{cls:1, drg:0}];
  X.beginGame(); for(let i=0;i<10;i++) tick();
  press('p');   ok(X.G.state===X.ST.JOURNAL, '1P: P opens the menu', 'state '+X.G.state);
  press('p');   ok(X.G.state===X.ST.PLAY,    '1P: P closes it',      'state '+X.G.state);
  press('tab'); press('p');
  ok(X.G.state===X.ST.PLAY, '1P: P closes a TAB-opened menu', 'state '+X.G.state);
}

// ---------------------------------------------------------------------------
// Bastion Stance toggles
// ---------------------------------------------------------------------------
{
  console.log('\n=== BASTION STANCE IS A TOGGLE ===');
  X.G.nPlayers = 1; X.G.picks = [{cls:1, drg:0}];
  X.G.state = X.ST.PLAY; X.beginGame(); for(let i=0;i<20;i++) tick();
  X.loadArea('verge', X.AREAS.verge.playerStart.x, X.AREAS.verge.playerStart.y);
  X.G.enemies.length = 0;

  ok(X.cls.abilities[1].cd === 2, 'Aegis Break cooldown is 2s', String(X.cls.abilities[1].cd));
  ok(!X.player.bastion, 'starts down', String(!!X.player.bastion));
  X.player.cds=[0,0,0,0]; X.useAbility(0);
  ok(X.player.bastion === true, 'one press raises it', String(X.player.bastion));
  for(let i=0;i<120;i++) tick();                    // ~2s with no key held
  ok(X.player.bastion === true, 'and it stays up with nothing held',
     String(X.player.bastion));
  X.player.cds=[0,0,0,0]; X.useAbility(0);
  ok(X.player.bastion === false, 'a second press drops it', String(X.player.bastion));
}

// ---------------------------------------------------------------------------
console.log('\n=== THE CURSOR INCLUDES THE DRAGON ===');
{
  // `dragon` was declared as its own object and makeRoster never moved it, so
  // at the top level — outside any withPlayer — `dragon` and
  // PLAYERS[0].dragon were two different objects. Everything the game does
  // runs inside withPlayer, so the game never noticed. Anything reading the
  // cursor from outside one, including every test in this file, got a phantom
  // that nothing would ever update.
  X.G.nPlayers = 2; X.G.picks = [{cls:1,drg:0},{cls:4,drg:3}];
  X.G.state = X.ST.PLAY; X.beginGame(); for(let i=0;i<10;i++) tick();
  ok(X.dragon === X.PLAYERS[0].dragon, 'the bare cursor points at P1’s dragon');
  ok(X.player === X.PLAYERS[0], 'as it does for the player');
  ok(X.cls === X.PLAYERS[0].cls && X.drg === X.PLAYERS[0].drg,
     'and for the class and the breed');
  X.withPlayer(X.PLAYERS[1], ()=>{
    ok(X.dragon === X.PLAYERS[1].dragon, 'and it moves with withPlayer');
  });
  ok(X.dragon === X.PLAYERS[0].dragon, 'and comes back afterwards');
}

console.log(fails ? '\nFAIL ('+fails+')' : '\nPASS');
process.exit(fails ? 1 : 0);
