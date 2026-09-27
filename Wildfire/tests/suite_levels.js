// Two ladders: the player's level and the dragon's bond.
//
// The thing worth pinning down here is not that a counter increments. It is
// that the ladders start where they are supposed to, that the player's runs
// AHEAD of the dragon's off the same events, that a level actually changes
// how hard you hit, and that a co-op partner is not left behind.
const {X, press, tick} = require('./harness.js');
require('./strict.js');

let fails = 0;
const ok = (c,l,e) => { console.log('  '+(c?'ok  ':'FAIL')+'  '+l+(e?'  — '+e:'')); if(!c) fails++; };

function start(n){
  X.G.nPlayers=n;
  X.G.picks = n===2 ? [{cls:0,drg:0},{cls:4,drg:1}] : [{cls:0,drg:0}];
  X.G.state=X.ST.PLAY; X.beginGame(); X.G.fade=0;
  for(let i=0;i<3;i++) tick();
}

// ---------------------------------------------------------------------------
console.log('=== BOTH LADDERS START AT ONE ===');
{
  start(1);
  ok(X.dragon.bond === 1, 'the dragon begins at bond 1', String(X.dragon.bond));
  ok(X.dragon.bondXp === 0, 'with nothing banked', String(X.dragon.bondXp));
  ok(X.player.level === 1, 'and the player at level 1', String(X.player.level));
  ok((X.player.xp||0) === 0, 'with nothing banked either', String(X.player.xp));
  // The old build handed you a bond of 12 at character creation, which made
  // the number on the dragon pane a decoration rather than a record.
  ok(X.dragon.bond < 2, 'nothing is granted up front');
}

// ---------------------------------------------------------------------------
console.log('\n=== THE CURVES WIDEN, AND THE PLAYER CLIMBS FASTER ===');
{
  ok(X.levelNeed(1) < X.bondNeed(1), 'level 2 costs less than bond 2',
     X.levelNeed(1)+' vs '+X.bondNeed(1));
  ok(X.levelNeed(5) < X.bondNeed(5), 'and still does at 5',
     X.levelNeed(5)+' vs '+X.bondNeed(5));
  ok(X.bondNeed(6) > X.bondNeed(1) && X.levelNeed(6) > X.levelNeed(1),
     'both get more expensive as they go up');

  // the same experience, spent on both ladders, must leave the player ahead
  start(1);
  for(let i=0;i<40;i++){ X.gainXp(3); X.gainBond(3); }
  ok(X.player.level > X.dragon.bond, 'after the same 120, the player is ahead',
     'level '+X.player.level+' vs bond '+X.dragon.bond);
}

// ---------------------------------------------------------------------------
console.log('\n=== A LEVEL IS WORTH SOMETHING ===');
{
  start(1);
  const hp0 = X.player.maxhp, atk0 = X.attackPower();
  X.gainXp(X.levelNeed(1));
  ok(X.player.level === 2, 'exactly the requirement levels you once',
     String(X.player.level));
  ok(X.player.maxhp === hp0 + X.LEVEL_HP, '+'+X.LEVEL_HP+' max health',
     hp0+' -> '+X.player.maxhp);
  const atk1 = X.attackPower();
  ok(Math.abs(atk1/atk0 - (1+X.LEVEL_ATK)) < 1e-9,
     '+'+Math.round(X.LEVEL_ATK*100)+'% attack power', atk0.toFixed(3)+' -> '+atk1.toFixed(3));

  // maxhp is added to, never recomputed. Other things in this game write to
  // it — Hayla's shawl is +20 — and a recompute from the level would throw
  // those away the next time you levelled.
  X.player.maxhp += 20;
  const hp2 = X.player.maxhp;
  X.gainXp(X.levelNeed(2));
  ok(X.player.maxhp === hp2 + X.LEVEL_HP, 'and it keeps what other things gave you',
     hp2+' -> '+X.player.maxhp);
}

// ---------------------------------------------------------------------------
console.log('\n=== KILLS PAY BOTH, BY WHAT THE CREATURE IS WORTH ===');
{
  start(1);
  const b0 = X.dragon.bondXp, x0 = X.player.xp||0;
  X.G.enemies.length = 0;
  const quail = X.spawnEnemy('rustquail', X.player.x+40, X.player.y);   // xp 1
  X.killEnemy(quail);
  ok(X.dragon.bondXp === b0+1 && (X.player.xp||0) === x0+1,
     'a rustquail is worth one of each', X.dragon.bondXp+' / '+X.player.xp);

  const bear = X.spawnEnemy('slagbear', X.player.x+40, X.player.y);     // xp 8
  const b1 = X.dragon.bondXp, x1 = X.player.xp||0;
  X.killEnemy(bear);
  ok(X.dragon.bondXp - b1 === 8 && (X.player.xp||0) - x1 === 8,
     'and a slagbear eight', (X.dragon.bondXp-b1)+' / '+((X.player.xp||0)-x1));
}

// ---------------------------------------------------------------------------
console.log('\n=== NOBODY IS LEFT BEHIND IN CO-OP ===');
{
  start(2);
  const before = X.PLAYERS.map(p=>({ lv:p.level, xp:p.xp||0, bond:p.dragon.bond,
                                     bxp:p.dragon.bondXp }));
  X.G.enemies.length = 0;
  // kill it while the cursor is on P1 — P2 must still be paid
  const e = X.spawnEnemy('slagbear', X.PLAYERS[0].x+40, X.PLAYERS[0].y);
  X.withPlayer(X.PLAYERS[0], ()=>X.killEnemy(e));
  X.PLAYERS.forEach((p,i)=>{
    ok((p.xp||0) - before[i].xp === 8 || p.level > before[i].lv,
       'P'+(i+1)+' got the experience', String(p.xp));
    ok(p.dragon.bondXp - before[i].bxp === 8 || p.dragon.bond > before[i].bond,
       "P"+(i+1)+"'s dragon got the bond", String(p.dragon.bondXp));
  });
  // and each dragon is its own: feeding one must not feed the other
  const o0 = X.PLAYERS[1].dragon.bondXp;
  X.withPlayer(X.PLAYERS[0], ()=>X.gainBond(5));
  ok(X.PLAYERS[1].dragon.bondXp === o0, "one player's dragon ability is its own",
     String(X.PLAYERS[1].dragon.bondXp));
}

// ---------------------------------------------------------------------------
console.log('\n=== A FRESH RUN STARTS OVER ===');
{
  start(1);
  X.gainXp(500); X.gainBond(500);
  ok(X.player.level > 5 && X.dragon.bond > 4, 'levelled up a good way',
     'level '+X.player.level+' bond '+X.dragon.bond);
  start(1);
  ok(X.player.level === 1 && (X.player.xp||0) === 0, 'the player resets',
     'level '+X.player.level);
  ok(X.dragon.bond === 1 && X.dragon.bondXp === 0, 'and so does the dragon',
     'bond '+X.dragon.bond);
}

// ---------------------------------------------------------------------------
console.log('\n=== THE CEILINGS HOLD ===');
{
  start(1);
  for(let i=0;i<400;i++){ X.gainXp(60); X.gainBond(60); }
  ok(X.player.level <= 99, 'the player stops at 99', String(X.player.level));
  ok(X.dragon.bond <= 100, 'the dragon stops at 100', String(X.dragon.bond));
  ok(Number.isFinite(X.player.maxhp) && X.player.maxhp < 2000,
     'and health has not run away with itself', String(X.player.maxhp));
}

// ---------------------------------------------------------------------------
console.log('\n=== RUNES STAY ON THE CREATURE THEY WERE PUT ON ===');
{
  X.G.nPlayers=1; X.G.picks=[{cls:2,drg:0}];      // Runebreaker
  X.G.state=X.ST.PLAY; X.beginGame(); X.G.fade=0;
  for(let i=0;i<3;i++) tick();
  X.G.enemies.length = 0; X.G.runes.length = 0;
  const a = X.spawnEnemy('rustquail', X.player.x+40, X.player.y);
  const b = X.spawnEnemy('rustquail', X.player.x-40, X.player.y);
  X.inscribeRune(a, 3);
  ok(X.G.runes.length===1 && X.G.runes[0].e===a, 'the rune is on the one you hit');

  // change focus — the mark must not follow the reticle
  X.G.target = b; X.updateTarget();
  ok(X.G.runes.length===1 && X.G.runes[0].e===a && X.G.runes[0].n===3,
     'and is still on it after the focus moves',
     X.G.runes.length+' rune(s), n='+(X.G.runes[0]&&X.G.runes[0].n));

  // it is drawn in the world pass, so it survives having no target at all
  const {Canvas} = require('./strict.js');
  const cv = new Canvas(64, 64), c2 = cv.getContext('2d');
  c2.setTransform(X.ART,0,0,X.ART,0,0);
  c2.fillStyle='#000000'; c2.fillRect(0,0,64,64);
  const sx=a.x, sy=a.y; a.x=16; a.y=40;
  X.G.target = null;
  X.drawRuneMarks(c2);
  a.x=sx; a.y=sy;
  let painted = 0;
  for(let i=0;i<cv.data.length;i+=4) if(cv.data[i]>30 || cv.data[i+2]>30) painted++;
  ok(painted > 20, 'and it paints with nothing targeted at all', painted+' px');

  // a dead carrier draws nothing
  a.dead = true;
  const cv2 = new Canvas(64,64), c3 = cv2.getContext('2d');
  c3.setTransform(X.ART,0,0,X.ART,0,0);
  c3.fillStyle='#000000'; c3.fillRect(0,0,64,64);
  X.drawRuneMarks(c3);
  let p2 = 0;
  for(let i=0;i<cv2.data.length;i+=4) if(cv2.data[i]>30 || cv2.data[i+2]>30) p2++;
  ok(p2 === 0, 'a dead carrier draws nothing', p2+' px');
  X.G.runes.length = 0;
}

// ---------------------------------------------------------------------------
console.log('\n=== THE COGWAY HAS A LANE TO WALK IN ===');
{
  const a = X.AREAS.cogway;
  const R = (x,y)=>Math.hypot(x+0.5-X.COG.cx, y+0.5-X.COG.cy);
  // Walk eight spokes out from the crater and find the longest clear run.
  // Every one of them has to be wide enough to pass through.
  let worst = 99, worstK = -1;
  for(let k=0;k<16;k++){
    const ang = k*Math.PI/8;
    let best=0, cur=0;
    for(let r=X.COG.PIT_R+1; r<X.COG.STREET_R; r+=0.1){
      const x=Math.round(X.COG.cx+Math.cos(ang)*r), y=Math.round(X.COG.cy+Math.sin(ang)*r);
      if(!X.SOLID[a.map[y*a.w+x]]){ cur+=0.1; best=Math.max(best,cur); } else cur=0;
    }
    if(best < worst){ worst = best; worstK = k; }
  }
  ok(worst >= 2.2, 'the narrowest spoke still has 2.2 tiles of clear street',
     worst.toFixed(1)+' tiles at spoke '+worstK);

  // and nothing sits in the middle of the band, which is the whole point
  let inLane = 0;
  for(let y=0;y<a.h;y++) for(let x=0;x<a.w;x++){
    const r = R(x,y);
    if(r > X.COG.LANE_IN && r < X.COG.LANE_OUT && X.SOLID[a.map[y*a.w+x]]) inLane++;
  }
  ok(inLane === 0, 'nothing solid is left standing in the lane', inLane+' tiles');

  // every ring-dweller is on one band or the other, never in the way
  const folk = X.COGWAY_FOLK.filter(f=>typeof f.r === 'number');
  const stray = folk.filter(f => f.r > X.COG.LANE_IN && f.r < X.COG.LANE_OUT);
  ok(stray.length === 0, 'and neither is anybody who lives there',
     stray.map(f=>f.name).join(', ') || 'all '+folk.length+' on a band');
}

console.log(fails ? '\nFAIL ('+fails+')' : '\nPASS');
process.exit(fails ? 1 : 0);
