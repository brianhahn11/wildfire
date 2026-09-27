// The Aethite Store: healing, and the locks it opens.
//
// Capacity comes only from milestones, which makes one property critical and
// easy to break without noticing: THE LADDER MUST REACH. If a lock's
// requirement ever exceeds what a player can have grown by the time they meet
// it, the run is over and nothing in the game will say so. Worse, the
// dependency can be circular — a lock whose requirement is only reachable by
// doing something on the far side of that same lock. Both are checked here by
// reasoning over the tables rather than by playing through.
const {X, press, tick} = require('./harness.js');
require('./strict.js');

let fails = 0;
const ok = (c,l,e) => { console.log('  '+(c?'ok  ':'FAIL')+'  '+l+(e?'  — '+e:'')); if(!c) fails++; };

// Which milestones sit behind which lock. Kept here, explicitly, because it is
// a statement about the world's shape that the tables themselves don't encode.
const BEHIND = { scarpgate:['scarp'], elevator:[] };

console.log('=== THE LADDER REACHES EVERY LOCK ===');
{
  const total = X.MILESTONES.reduce((s,m)=>s+m.grant, 0);
  for(const id in X.AETHITE_LOCKS){
    const L = X.AETHITE_LOCKS[id];
    // what you could have grown WITHOUT passing this lock
    const reachable = X.MILESTONES
      .filter(m => BEHIND[id].indexOf(m.id) < 0)
      .reduce((s,m)=>s+m.grant, 0);
    ok(reachable >= L.need, L.name+': requirement is reachable without passing it',
       'need '+L.need+', reachable '+reachable);
    ok(reachable >= L.cost, L.name+': and affordable', 'cost '+L.cost);
  }
  ok(total >= 150, 'the full ladder is worth having', total+' total capacity');
  // every milestone must be one the game can actually fire
  const ids = X.MILESTONES.map(m=>m.id);
  ok(new Set(ids).size === ids.length, 'no duplicate milestones');
}

press('Enter'); X.setCls(0,0); X.beginGame();
for(let i=0;i<30;i++) tick();

console.log('\n=== BONDING GRANTS THE FIRST STORE ===');
ok(X.player.aethiteMax === 40, 'a new run starts with the bonding grant', X.player.aethiteMax+'');
ok(X.player.aethite === X.player.aethiteMax, 'and it starts full');

console.log('\n=== THE CITY KEEPS YOU TOPPED UP, NOT LOCKED OUT ===');
{
  // Refill happens on ARRIVAL — spend it low out in the field, then walk in.
  X.loadArea('verge', X.AREAS.verge.playerStart.x, X.AREAS.verge.playerStart.y);
  X.player.aethite = 3;
  X.loadArea('cogway', X.AREAS.cogway.playerStart.x, X.AREAS.cogway.playerStart.y);
  X.G.enemies.length = 0;
  ok(X.player.aethite === X.player.aethiteMax, 'walking into Ironhaven refills instantly',
     X.player.aethite+'/'+X.player.aethiteMax);
  ok(X.inTown(), 'and town is recognised as town');

  // You can mend inside the walls. The old rule refused outright, so a rider
  // could walk home bleeding and stand there unable to use a full tank.
  X.player.hp = X.player.maxhp - 40;
  X.player.combatT = 0; X.player.burnCd = 0; X.player.burning = false;
  X.toggleBurn();
  ok(X.player.burning, 'you can burn in town');
  const hp0 = X.player.hp;
  for(let i=0;i<60;i++) tick();
  ok(X.player.hp > hp0, 'and it mends you', hp0+' -> '+X.player.hp);
  ok(X.player.aethite < X.player.aethiteMax, 'and it costs store to do it',
     X.player.aethite.toFixed(1)+'/'+X.player.aethiteMax);

  // it comes back fast, but it does come back over time rather than instantly
  X.player.burning = false;
  X.player.aethite = 1;
  tick();
  const after1 = X.player.aethite;
  ok(after1 < X.player.aethiteMax, 'one frame does not refill the whole store',
     after1.toFixed(1));
  for(let i=0;i<150;i++) tick();
  ok(X.player.aethite === X.player.aethiteMax, 'but a couple of seconds does',
     X.player.aethite+'/'+X.player.aethiteMax);

  // out in the field it is much slower — that difference is the point of town
  X.loadArea('verge', X.AREAS.verge.playerStart.x, X.AREAS.verge.playerStart.y);
  X.G.enemies.length = 0;
  X.player.aethite = 1; X.player.combatT = 0;
  for(let i=0;i<60;i++) tick();
  const field = X.player.aethite;
  ok(field < X.player.aethiteMax * 0.5, 'the field does not refill anything like as fast',
     field.toFixed(1)+'/'+X.player.aethiteMax);
}

console.log('\n=== BURNING MENDS YOU, OUT OF COMBAT ONLY ===');
{
  X.loadArea('verge', X.AREAS.verge.playerStart.x, X.AREAS.verge.playerStart.y);
  X.G.enemies.length = 0;
  X.player.hp = 40; X.player.aethite = X.player.aethiteMax;
  ok(X.outOfCombat(), 'an empty field is out of combat');
  X.toggleBurn();
  ok(X.player.burning, 'burning starts');
  const a0 = X.player.aethite;
  for(let i=0;i<40;i++) tick();
  ok(X.player.hp > 40, 'health goes up', '40 -> '+Math.round(X.player.hp));
  ok(X.player.aethite < a0, 'and the store goes down', Math.round(a0)+' -> '+Math.round(X.player.aethite));
  ok(Number.isInteger(X.player.hp) || X.player.hp === X.player.maxhp,
     'health never displays as a fraction mid-burn', String(X.player.hp));

  // a hostile in range must cut it off
  X.spawnEnemy('tickboar', X.player.x + 60, X.player.y);
  for(let i=0;i<4;i++) tick();
  ok(!X.outOfCombat(), 'a hostile nearby counts as combat');
  ok(!X.player.burning, 'and burning stops');
  X.toggleBurn();
  ok(!X.player.burning, 'and cannot be restarted while it is there');
}

console.log('\n=== AND IT CANNOT OVERDRAW OR OVERHEAL ===');
{
  X.G.enemies.length = 0;
  X.player.hp = 1; X.player.aethite = 6;
  X.toggleBurn();
  for(let i=0;i<120;i++) tick();
  ok(X.player.aethite >= 0, 'the store never goes negative', String(Math.round(X.player.aethite)));
  ok(X.player.hp <= X.player.maxhp, 'health never exceeds maximum');

  X.player.aethite = X.player.aethiteMax; X.player.hp = X.player.maxhp;
  X.toggleBurn();
  ok(!X.player.burning, 'and refuses when there is nothing to mend');
}

console.log('\n=== A LOCK REFUSES UNTIL THE STORE IS BIG ENOUGH ===');
{
  const L = X.AETHITE_LOCKS.scarpgate;
  X.loadArea('cogway', X.AREAS.cogway.playerStart.x, X.AREAS.cogway.playerStart.y);
  X.G.locks = {}; X.G.channel = null;
  X.player.aethiteMax = L.need - 1; X.player.aethite = L.need - 1;
  X.channelInto('scarpgate');
  ok(!X.G.channel, 'capacity below the requirement is refused');
  ok(X.G.state === X.ST.DIALOGUE, 'and it says why');
  X.G.state = X.ST.PLAY; X.G.dialogue = null;

  // capacity is enough but the pool is spent
  X.player.aethiteMax = L.need; X.player.aethite = L.cost - 1;
  X.channelInto('scarpgate');
  ok(!X.G.channel, 'enough capacity but too little in hand is refused too');

  X.player.aethite = X.player.aethiteMax;
  X.channelInto('scarpgate');
  ok(!!X.G.channel, 'and with both, it starts');
  // Read the store on the frame the lock opens, not a couple of seconds
  // later. This is in the city, where the store refills fast, so a delayed
  // reading measures the regen rather than the charge.
  let charged = null;
  for(let i=0;i<140 && charged===null;i++){
    tick();
    if(X.G.locks.scarpgate) charged = X.player.aethite;
  }
  ok(!!X.G.locks.scarpgate, 'the lock opens');
  ok(charged !== null && charged <= X.player.aethiteMax - L.cost + 1,
     'and it charged you', charged===null ? 'never opened' : Math.round(charged)+'');
}

console.log('\n=== AN OPENED GATE STAYS OPEN AND LETS YOU THROUGH ===');
{
  const A = X.AREAS.cogway;
  const seal = A.seals.scarpgate[2];
  ok(A.map[seal[1]*A.w + seal[0]] !== X.TILES.SEAL, 'the barrier is gone from the map');
  const ex = A.exits.find(e => e.lock === 'scarpgate');
  ok(!!ex, 'the gate exit is tagged with its lock');
  X.loadArea('cogway', ex.x*16+8, ex.y*16+8);
  for(let i=0;i<90;i++) tick();      // the transition fades, so give it time
  ok(X.G.areaId === 'scarp', 'and standing on it takes you through', X.G.areaId);
}

console.log('\n=== SPENDING EVERYTHING CANNOT STRAND YOU ===');
{
  // The one real failure mode of a spend-to-progress economy: burn the pool in
  // the field, then be unable to get home or open anything, forever.
  X.loadArea('verge', X.AREAS.verge.playerStart.x, X.AREAS.verge.playerStart.y);
  X.G.enemies.length = 0;
  X.player.aethite = 0; X.player.hp = 10;
  const before = X.player.aethite;
  for(let i=0;i<120;i++) tick();
  ok(X.player.aethite > before, 'the store regenerates on its own out of combat',
     before+' -> '+Math.round(X.player.aethite));
  // and the way home is never itself locked
  const homeLocked = ['verge','scarp','shoals'].filter(z =>
    X.AREAS[z].exits.filter(e=>e.to==='cogway').every(e=>e.lock));
  ok(homeLocked.length === 0, 'no zone can lock you out of the road home', homeLocked.join(', '));
}

console.log('\n=== THE OPTIONS MOCKUP IS PRESENT AND INERT ===');
{
  ok(X.OPTION_ROWS.length >= 3, 'the panel has rows', X.OPTION_ROWS.length+'');
  ok(X.INPUT_DEVICES.length >= 2 && X.INPUT_DEVICES[0].name === 'Keyboard',
     'keyboard is the default device');
  const before = X.G.inputP1;
  X.G.state = X.ST.TITLE; X.G.titleOpts = true;
  // Find the row by what it IS, not by where it sits. Pinning an index here
  // meant adding a row above it silently pointed this at something else.
  X.G.optSel = X.OPTION_ROWS.findIndex(r => r.kind==='input');
  press('d');
  ok(X.G.inputP1 !== before, 'the device row cycles');
  // and nothing it does touches gameplay
  ok(typeof X.G.inputP1 === 'number', 'and it only records a number');
  X.G.titleOpts = false; X.G.inputP1 = 0;
}

console.log(fails ? '\nFAIL ('+fails+')' : '\nPASS');
process.exit(fails ? 1 : 0);
