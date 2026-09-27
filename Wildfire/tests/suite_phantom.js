// The Phantom's dodge.
//
// Space does something different for four of the nine classes now — a roll for
// most, a blink for the Aethermancer, a scan for the Savant, and this. The
// risk with a bespoke one is not that it looks wrong; it is that a teleport
// dressed up as flair quietly becomes the strongest movement ability in the
// game by putting you somewhere the level was built to keep you out of.
//
// So most of this file is about the boundaries: it never ends inside geometry,
// never travels further than it says, never overlaps itself, and never leaves
// the player in a state the rest of the game does not understand.
const {X, press, tick} = require('./harness.js');
require('./strict.js');

let fails = 0;
const ok = (c,l,e) => { console.log('  '+(c?'ok  ':'FAIL')+'  '+l+(e?'  — '+e:'')); if(!c) fails++; };
const PHANTOM = X.CLASSES.findIndex(c=>c.id==='phantom');

function asPhantom(area){
  X.G.nPlayers = 1; X.G.picks = [{cls:PHANTOM, drg:4}];
  X.G.state = X.ST.PLAY; X.beginGame();
  for(let i=0;i<10;i++) tick();
  const id = area || 'verge';
  X.loadArea(id, X.AREAS[id].playerStart.x, X.AREAS[id].playerStart.y);
  X.G.fade = 0; X.G.areaNameT = 0; X.G.enemies.length = 0;
  return X.player;
}
function runMelt(p){
  const seen = [];
  let guard = 0;
  while(p.melting && guard++ < 200){
    seen.push(X.meltPhase().at);
    X.withPlayer(p, ()=>X.updateMelt(1/60));
  }
  return seen;
}

// ---------------------------------------------------------------------------
console.log('=== SPACE MEANS SOMETHING DIFFERENT FOR THE PHANTOM ===');
{
  const p = asPhantom();
  p.inx = 1; p.iny = 0;
  X.dodgeAction();
  ok(p.melting === true, 'the Phantom melts', String(p.melting));
  ok(p.dodgeT === 0, 'and does not also roll', String(p.dodgeT));
  runMelt(p);

  // and nobody else does
  for(const c of X.CLASSES){
    if(c.id==='phantom') continue;
    X.G.picks = [{cls:X.CLASSES.indexOf(c), drg:0}];
    X.beginGame(); for(let i=0;i<8;i++) tick();
    X.loadArea('verge', X.AREAS.verge.playerStart.x, X.AREAS.verge.playerStart.y);
    X.G.enemies.length = 0;
    X.player.inx = 1; X.player.iny = 0;
    X.dodgeAction();
    ok(!X.player.melting, c.id+' does not melt', String(!!X.player.melting));
  }
}

// ---------------------------------------------------------------------------
console.log('\n=== IT PLAYS OUT IN THREE BEATS AND THEN IT IS OVER ===');
{
  const p = asPhantom();
  p.inx = 1; p.iny = 0;
  X.dodgeAction();
  const seen = runMelt(p);

  ok(seen.length > 0, 'the move takes time', seen.length+' frames');
  ok(!p.melting, 'and it ends', String(p.melting));
  ok(p.meltT === 0, 'with the clock cleared', String(p.meltT));

  // the beats have to be in order and all three have to happen
  const order = seen.filter((v,i)=>v!==seen[i-1]);
  ok(order.join(',') === 'collapse,slide,rise',
     'collapse, then slide, then rise', order.join(','));
  const count = k => seen.filter(v=>v===k).length;
  ok(count('collapse') > 2 && count('slide') > 2 && count('rise') > 2,
     'and none of them is a single frame',
     'c'+count('collapse')+' s'+count('slide')+' r'+count('rise'));

  const frames = Math.round(X.MELT_DUR*60);
  ok(Math.abs(seen.length - frames) <= 2, 'it lasts what it says it does',
     seen.length+' frames vs '+frames);
}

// ---------------------------------------------------------------------------
console.log('\n=== IT ENDS WHERE IT SAID, AND NEVER INSIDE A WALL ===');
{
  const p = asPhantom();
  p.inx = 1; p.iny = 0;
  X.dodgeAction();
  const want = { x:p.meltNx, y:p.meltNy };
  const from = { x:p.meltOx, y:p.meltOy };
  const trail = [];
  while(p.melting){ trail.push({x:p.x,y:p.y}); X.withPlayer(p, ()=>X.updateMelt(1/60)); }
  ok(Math.abs(p.x-want.x) < 0.01 && Math.abs(p.y-want.y) < 0.01,
     'the player ends exactly at the destination',
     p.x.toFixed(1)+','+p.y.toFixed(1)+' vs '+want.x.toFixed(1)+','+want.y.toFixed(1));

  const travelled = Math.hypot(want.x-from.x, want.y-from.y);
  ok(travelled > 0, 'and it actually went somewhere', travelled.toFixed(0)+'px');
  ok(travelled <= X.MELT.reach + 0.01, 'but no further than its stated reach',
     travelled.toFixed(0)+' of '+X.MELT.reach);

  // every intermediate position has to be standable too — a puddle that
  // slides THROUGH a wall is a different ability from one that stops at it
  const inside = trail.filter(q=>!X.canStand(q.x,q.y));
  ok(inside.length === 0, 'and nothing on the way was inside geometry',
     inside.length+' of '+trail.length);
}

// ---------------------------------------------------------------------------
console.log('\n=== IT CANNOT PUT YOU SOMEWHERE THE LEVEL KEEPS YOU OUT OF ===');
{
  // The city is the hardest case: a ring of walkable stone wrapped around a
  // hole, with railings, stalls and the crater itself all within one dodge of
  // the street. Probe every direction from a lot of places on it.
  const p = asPhantom('cogway');
  let tried = 0, bad = 0, crater = 0;
  const starts = [];
  const a = X.G.area;
  for(let y=2;y<a.h-2;y+=3) for(let x=2;x<a.w-2;x+=3){
    if(!X.SOLID[a.map[y*a.w+x]]) starts.push([x*16+8, y*16+8]);
  }
  for(const [sx,sy] of starts){
    if(!X.canStand(sx,sy)) continue;
    for(let k=0;k<12;k++){
      const ang = k*Math.PI/6;
      p.x = sx; p.y = sy;
      p.melting = false; p.meltT = 0; p.dodgeCd = 0;
      p.inx = Math.cos(ang); p.iny = Math.sin(ang);
      X.dodgeAction();
      if(!p.melting) continue;
      while(p.melting) X.withPlayer(p, ()=>X.updateMelt(1/60));
      tried++;
      if(!X.canStand(p.x, p.y)) bad++;
      // the crater is VOID — landing in it would be a fall, not a dodge
      const tx = (p.x/16)|0, ty = (p.y/16)|0;
      if(a.map[ty*a.w+tx] === X.TILES.VOID || a.map[ty*a.w+tx] === X.TILES.PIT) crater++;
    }
  }
  ok(tried > 400, 'a lot of dodges, from all over the ring', tried+' of them');
  ok(bad === 0, 'not one of them ended inside geometry', bad+' bad landings');
  ok(crater === 0, 'and not one of them ended down the hole', crater+' in the crater');
}

// ---------------------------------------------------------------------------
console.log('\n=== IT DOES NOT OVERLAP ITSELF, AND IT COSTS A COOLDOWN ===');
{
  const p = asPhantom();
  p.inx = 1; p.iny = 0;
  X.dodgeAction();
  const dest = p.meltNx;
  // hammer it mid-move
  for(let n=0;n<8;n++) X.dodgeAction();
  ok(p.meltNx === dest, 'pressing again mid-move starts nothing new',
     p.meltNx.toFixed(0)+' vs '+dest.toFixed(0));
  runMelt(p);
  ok(p.dodgeCd > 0, 'and it leaves a cooldown behind', p.dodgeCd.toFixed(2)+'s');

  const at = { x:p.x, y:p.y };
  X.dodgeAction();
  ok(!p.melting, 'which refuses a second one immediately after');
  ok(p.x===at.x && p.y===at.y, 'and moves you nowhere');
  for(let i=0;i<60;i++) tick();
  X.player.inx = 1; X.player.iny = 0;
  X.dodgeAction();
  ok(X.player.melting, 'a second later it works again');
}

// ---------------------------------------------------------------------------
console.log('\n=== YOU CANNOT BE HIT WHILE YOU ARE A PUDDLE ===');
{
  const p = asPhantom();
  p.inx = 1; p.iny = 0;
  p.hp = p.maxhp;
  X.dodgeAction();
  let hurt = 0;
  while(p.melting){
    p.iframe = Math.max(0, p.iframe);          // do not top it up; just try
    const before = p.hp;
    X.hurtPlayer(20, p.x+30, p.y);
    if(p.hp < before) hurt++;
    X.withPlayer(p, ()=>X.updateMelt(1/60));
  }
  ok(hurt === 0, 'nothing landed during the whole move', hurt+' hits got through');
  ok(p.hp === p.maxhp, 'and the health bar never moved', p.hp+'/'+p.maxhp);
}

// ---------------------------------------------------------------------------
console.log('\n=== IT DRAWS, AT EVERY POINT OF THE MOVE ===');
{
  const {Canvas} = require('./strict.js');
  const cv = new Canvas(480,270), c = cv.getContext('2d');
  const p = asPhantom();
  p.inx = 1; p.iny = 0;
  X.dodgeAction();
  let threw = null, drawn = 0;
  while(p.melting){
    try { X.withPlayer(p, ()=>X.drawPlayerFigure(c, p)); drawn++; }
    catch(err){ threw = X.meltPhase().at+': '+err.message; break; }
    X.withPlayer(p, ()=>X.updateMelt(1/60));
  }
  ok(!threw, 'every frame renders under strict argument validation', threw||'');
  ok(drawn > 10, 'and there were frames to render', String(drawn));
}

// ---------------------------------------------------------------------------
console.log('\n=== ONE PLAYER MELTING DOES NOT MOVE THE OTHER ===');
{
  X.G.nPlayers = 2;
  X.G.picks = [{cls:1, drg:0}, {cls:PHANTOM, drg:4}];   // Bulwark, Phantom
  X.G.state = X.ST.PLAY; X.beginGame();
  for(let i=0;i<10;i++) tick();
  X.loadArea('verge', X.AREAS.verge.playerStart.x, X.AREAS.verge.playerStart.y);
  X.G.fade = 0; X.G.enemies.length = 0;

  const a = X.PLAYERS[0], b = X.PLAYERS[1];
  const anchor = { x:a.x, y:a.y };
  X.withPlayer(b, ()=>{ b.inx = 1; b.iny = 0; X.dodgeAction(); });
  ok(b.melting, 'P2 melts');
  ok(!a.melting, 'and P1 does not', String(!!a.melting));
  while(b.melting) X.withPlayer(b, ()=>X.updateMelt(1/60));
  ok(a.x===anchor.x && a.y===anchor.y, 'P1 has not moved',
     a.x.toFixed(0)+','+a.y.toFixed(0));
  ok(X.dragon === X.PLAYERS[0].dragon, 'and the cursor came back to P1');
}

console.log(fails ? '\nFAIL ('+fails+')' : '\nPASS');
process.exit(fails ? 1 : 0);
