// The dragon aims itself.
//
// The hatchling flies an orbit around you, so it is almost never standing
// where you are. Its abilities used to be fired along the PLAYER's bearing to
// the mark while being emitted from the DRAGON's position — which is correct
// only in the one case where the two happen to be lined up, and is worst
// exactly when the dragon has drifted furthest round its orbit.
//
// The test that matters is therefore not "does the breath hit something".
// It is "does the breath hit something that the rider's own bearing would
// have missed", because that is the only case where the two implementations
// differ, and the case a casual playtest never isolates.
const {X, tick} = require('./harness.js');
require('./strict.js');

let fails = 0;
const ok = (c,l,e) => { console.log('  '+(c?'ok  ':'FAIL')+'  '+l+(e?'  — '+e:'')); if(!c) fails++; };
const BREATH_HALF_ANGLE = 0.52;      // must match dragonAbility's cone

function field(){
  X.G.nPlayers = 1; X.G.picks = [{cls:4, drg:0}];
  X.G.state = X.ST.PLAY; X.beginGame();
  for(let i=0;i<10;i++) tick();
  X.loadArea('verge', X.AREAS.verge.playerStart.x, X.AREAS.verge.playerStart.y);
  X.G.fade = 0; X.G.areaNameT = 0; X.G.enemies.length = 0;
}
const angDiff = (a,b) => { let d=(a-b)%(Math.PI*2); if(d>Math.PI)d-=Math.PI*2; if(d<-Math.PI)d+=Math.PI*2; return d; };

// ---------------------------------------------------------------------------
console.log('=== THE BREATH LEAVES FROM WHERE THE DRAGON IS ===');
{
  field();
  // Rider at the origin, dragon 60px to the right, creature 40px ABOVE the
  // dragon. From the rider that is a shallow diagonal; from the dragon it is
  // straight up. The gap between the two is wider than the cone.
  const px0 = X.player.x, py0 = X.player.y;
  X.dragon.x = px0 + 60; X.dragon.y = py0;
  const e = X.spawnEnemy('brasshare', px0 + 60, py0 - 40) || X.G.enemies[0];
  const foe = X.G.enemies[0];
  foe.hp = foe.maxhp = 9999;

  X.updateTarget();
  ok(X.G.target === foe, 'the rider has it marked');

  const riderBearing  = Math.atan2((foe.y-4)-(X.player.y-8), foe.x-X.player.x);
  const dragonBearing = X.dragonAim();
  const trueBearing   = Math.atan2((foe.y-4)-X.dragon.y, foe.x-X.dragon.x);

  ok(Math.abs(angDiff(dragonBearing, trueBearing)) < 0.02,
     'the dragon aims at the creature from its own position',
     dragonBearing.toFixed(3)+' vs '+trueBearing.toFixed(3));
  ok(Math.abs(angDiff(riderBearing, trueBearing)) > BREATH_HALF_ANGLE,
     'and the rider’s bearing would have missed it entirely',
     Math.abs(angDiff(riderBearing,trueBearing)).toFixed(3)+' rad outside a '+
     BREATH_HALF_ANGLE+' cone');

  X.dragon.cds = [0,0];
  const before = foe.hp;
  X.dragonAbility(0);
  ok(foe.hp < before, 'so the breath connects', (before-foe.hp)+' damage');
}

// ---------------------------------------------------------------------------
console.log('\n=== IT PICKS ITS OWN TARGET WHEN THE RIDER HAS NONE ===');
{
  field();
  const px0 = X.player.x, py0 = X.player.y;
  // out past the rider's marking range, but beside the dragon
  X.dragon.x = px0 + 60; X.dragon.y = py0 - 20;
  X.G.target = null;
  const foe = X.spawnEnemy('brasshare', px0 + 78, py0 - 20) || X.G.enemies[0];
  const f = X.G.enemies[0];
  f.hp = f.maxhp = 9999;

  const aim = X.dragonAim();
  const truth = Math.atan2((f.y-4)-X.dragon.y, f.x-X.dragon.x);
  ok(Math.abs(angDiff(aim, truth)) < 0.02,
     'with nothing marked it finds something itself', aim.toFixed(3));

  X.dragon.cds = [0,0];
  const before = f.hp;
  X.dragonAbility(0);
  ok(f.hp < before, 'and breathes on it', (before-f.hp)+' damage');
}

// ---------------------------------------------------------------------------
console.log('\n=== AN EMPTY FIELD FALLS BACK TO THE RIDER ===');
{
  field();
  X.G.target = null;
  X.player.dx = 0; X.player.dy = -1;      // facing up
  X.dragon.x = X.player.x + 20; X.dragon.y = X.player.y;
  const aim = X.dragonAim();
  ok(Math.abs(angDiff(aim, X.aimAngle())) < 0.001,
     'nothing about: it follows your heading', aim.toFixed(3));
}

// ---------------------------------------------------------------------------
console.log('\n=== AND IT TURNS TO LOOK AT WHAT IT IS SHOOTING ===');
{
  field();
  const px0 = X.player.x, py0 = X.player.y;
  X.dragon.x = px0; X.dragon.y = py0;
  X.spawnEnemy('brasshare', px0 - 70, py0);
  for(let i=0;i<4;i++) tick();
  ok(X.dragon.face === -1, 'a creature to the left turns it left',
     String(X.dragon.face));

  X.G.enemies.length = 0; X.G.target = null;
  X.spawnEnemy('brasshare', px0 + 70, py0);
  for(let i=0;i<4;i++) tick();
  ok(X.dragon.face === 1, 'and one to the right turns it right',
     String(X.dragon.face));
}

// ---------------------------------------------------------------------------
console.log('\n=== BOTH HATCHLINGS AIM FOR THEIR OWN RIDER ===');
{
  X.G.nPlayers = 2; X.G.picks = [{cls:4,drg:0},{cls:1,drg:2}];
  X.G.state = X.ST.PLAY; X.beginGame();
  for(let i=0;i<10;i++) tick();
  X.loadArea('verge', X.AREAS.verge.playerStart.x, X.AREAS.verge.playerStart.y);
  X.G.fade = 0; X.G.enemies.length = 0;

  const a = X.PLAYERS[0], b = X.PLAYERS[1];
  a.x = X.AREAS.verge.playerStart.x;      a.y = X.AREAS.verge.playerStart.y;
  b.x = a.x + 120;                        b.y = a.y;
  a.dragon.x = a.x; a.dragon.y = a.y;
  b.dragon.x = b.x; b.dragon.y = b.y;

  const near = X.spawnEnemy('brasshare', a.x - 50, a.y) || X.G.enemies[0];
  const far  = X.spawnEnemy('brasshare', b.x + 50, b.y) || X.G.enemies[1];
  const e1 = X.G.enemies[0], e2 = X.G.enemies[1];

  const aimA = X.withPlayer(a, ()=>X.dragonAim());
  const aimB = X.withPlayer(b, ()=>X.dragonAim());
  ok(Math.cos(aimA) < 0, "P1's hatchling looks at the creature beside P1",
     aimA.toFixed(3));
  ok(Math.cos(aimB) > 0, "and P2's at the one beside P2", aimB.toFixed(3));
}

console.log(fails ? '\nFAIL ('+fails+')' : '\nPASS');
process.exit(fails ? 1 : 0);
