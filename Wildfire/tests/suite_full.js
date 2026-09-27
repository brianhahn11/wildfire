const {X,press,rel,tick,NAMES}=require('./harness.js');
const S=require('./shim.js');
const P=Object.getPrototypeOf(new S.Canvas(4,4).getContext('2d'));
for(const m of ['_px','fillText','drawImage','fillRect','strokeRect','stroke','fill','clearRect']) P[m]=function(){};
let errs=0;
const guard=(l,f)=>{try{f();}catch(e){errs++;console.log('ERROR ['+l+']:',e.message,
  '\n   '+(e.stack.split('\n')[1]||'').trim());}};

function start(ci,di){
  X.G.selClass=ci; X.G.selDragon=di; X.beginGame();
  for(let i=0;i<5;i++) tick();
}

console.log('=== ALL 9 CLASSES: abilities, dodge, attack, dragon ===');
for(let ci=0; ci<9; ci++){
  guard(X.CLASSES[ci].id, ()=>{
    start(ci, ci%6);
    // move outdoors so there are creatures to hit
    X.loadArea('clearing', X.AREAS.clearing.playerStart.x, X.AREAS.clearing.playerStart.y);
    for(let i=0;i<10;i++) tick();
    // park a few creatures in front of the player
    X.G.enemies.length=0;
    for(let k=0;k<4;k++) X.spawnEnemy('rustquail', X.player.x+24+k*13, X.player.y+(k%2?6:-6));
    X.player.dx=1; X.player.dy=0; X.player.dir=3;
    for(let i=0;i<6;i++) tick();

    // basic attack x4
    for(let n=0;n<4;n++){ press('j'); for(let i=0;i<12;i++) tick(); }
    // dodge / rift step / assimilate
    press(' '); for(let i=0;i<24;i++) tick();
    // every ability, twice (second pass exercises gauge-gated branches)
    for(let pass=0; pass<2; pass++){
      for(const k of ['ArrowUp','ArrowLeft','ArrowDown','ArrowRight']){
        // pre-charge the gauges so gated abilities actually fire
        X.player.momentum=5; X.player.aegis=100; X.player.shadow=100;
        X.player.focus=100; X.player.tempo=6; X.player.cds=[0,0,0,0];
        press(k); for(let i=0;i<26;i++) tick();
        rel(k);
      }
    }
    // dragon skills
    X.dragon.cds=[0,0];
    press(','); for(let i=0;i<18;i++) tick();
    press('.'); for(let i=0;i<18;i++) tick();
    const C=X.cls;
    console.log('  '+C.id.padEnd(13),
      'gauge', X.gaugeText().padEnd(11),
      '| enemies left', X.G.enemies.filter(e=>!e.dead).length,
      '| summons', X.G.summons.length,
      '| shots', (X.G.shots||[]).length,
      '| hp', X.player.hp+'/'+X.player.maxhp);
  });
}

console.log('\n=== PASSIVE CREATURES: nothing should ever attack ===');
guard('passivity', ()=>{
  start(0,0);
  X.loadArea('clearing', X.AREAS.clearing.playerStart.x, X.AREAS.clearing.playerStart.y);
  const hp0=X.player.hp;
  // stand in the middle of the flock and do nothing for 60s
  const e0=X.G.enemies[0];
  if(e0){ X.player.x=e0.x; X.player.y=e0.y; }
  for(let i=0;i<60*60;i++) tick();
  console.log('  60s standing in the flock: hp', hp0, '->', X.player.hp,
    '| creatures', X.G.enemies.filter(e=>!e.dead).length);
});

console.log('\n=== QUEST FLOW ===');
guard('quest', ()=>{
  start(0,0);
  X.loadArea('clearing', X.AREAS.clearing.playerStart.x, X.AREAS.clearing.playerStart.y);
  for(let i=0;i<5;i++) tick();
  const hayla = X.G.npcs.find(n=>n.id==='hayla');
  console.log('  Hayla present:', !!hayla);
  X.player.x=hayla.x; X.player.y=hayla.y+12;
  for(let i=0;i<3;i++) tick();
  press('f'); for(let i=0;i<3;i++) tick();
  console.log('  after E:', NAMES[X.G.state], '| quest', X.G.quest.state);
  // click through her lines
  for(let i=0;i<40;i++){ press('f'); for(let k=0;k<3;k++) tick(); if(X.G.state===X.ST.PLAY) break; }
  console.log('  after dialogue: quest', X.G.quest.state, '| need', X.G.quest.need);
  // kill ten rustquail
  let killed=0;
  for(const e of X.G.enemies.slice()){
    if(e.kind!=='rustquail'||e.dead) continue;
    X.hurtEnemy(e, 999, 0, 0, false, 0);
    killed++; if(killed>=10) break;
  }
  for(let i=0;i<5;i++) tick();
  console.log('  killed', killed, 'rustquail -> quest', X.G.quest.state,
    '| counter', X.G.quest.kills+'/'+X.G.quest.need);
  // turn in
  X.player.x=hayla.x; X.player.y=hayla.y+12;
  press('f'); for(let i=0;i<3;i++) tick();
  const hpBefore=X.player.maxhp;
  for(let i=0;i<40;i++){ press('f'); for(let k=0;k<3;k++) tick(); if(X.G.state===X.ST.PLAY) break; }
  console.log('  after turn-in: quest', X.G.quest.state, '| maxhp', hpBefore, '->', X.player.maxhp);
});

console.log('\n=== AREA TRANSITIONS ===');
guard('areas', ()=>{
  start(0,0);
  console.log('  start area:', X.G.areaId);
  // walk out of the house through the door
  const hd = X.AREAS.house.exits[0];
  X.player.x = hd.x*16+8; X.player.y = hd.y*16+8;
  for(let i=0;i<40;i++) tick();
  console.log('  through the door ->', X.G.areaId);
  // east road to the gate
  X.loadArea('clearing', (52-2)*16+8, 25*16+8);
  for(let i=0;i<40;i++) tick();
  console.log('  east road ->', X.G.areaId);
  // back west
  X.loadArea('gate', 1*16+8, 17*16+8);
  for(let i=0;i<40;i++) tick();
  console.log('  west road ->', X.G.areaId);
  console.log('  guards at gate:', X.G.npcs.length);
});

console.log('\n=== SOAK: 3 min, every class rotating ===');
guard('soak', ()=>{
  for(let ci=0;ci<9;ci++){
    start(ci, ci%6);
    X.loadArea('clearing', X.AREAS.clearing.playerStart.x, X.AREAS.clearing.playerStart.y);
    for(let i=0;i<60*20;i++){
      const K=X.keys;
      for(const k of ['w','a','s','d']) K[k]=false;
      if(i%90<45) K['d']=true; else K['a']=true;
      if(i%120<60) K['s']=true;
      if(i%20===0) press('j');
      if(i%150===0){ X.player.cds=[0,0,0,0];
        press(['ArrowUp','ArrowLeft','ArrowDown','ArrowRight'][(i/150)%4|0]); }
      if(i%300===0){ X.dragon.cds=[0,0]; press(','); }
      if(i%70===0) press(' ');
      tick();
    }
    for(const k in X.keys) X.keys[k]=false;
  }
  console.log('  9 classes x 20s each, no crash | particles', X.G.particles.length,
    '| floats', X.G.floats.length, '| hitmarks', X.G.hitmarks.length,
    '| shots', (X.G.shots||[]).length, '| delayed ok');
});

const __verdict = String(errs===0?'\nPASS — no runtime errors':'\nFAIL — '+errs+' error(s)');
console.log(__verdict);

// A suite that prints FAIL and exits 0 is worse than no suite: the runner
// reports green and nobody looks. Exit code follows the result.
process.exit(/FAIL/.test(__verdict) ? 1 : 0);
