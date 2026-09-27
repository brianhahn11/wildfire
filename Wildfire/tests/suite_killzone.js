const {X,press,tick,NAMES}=require('./harness.js');
const S=require('./strict.js');
const P=Object.getPrototypeOf(new S.Canvas(4,4).getContext('2d'));
for(const m of ['_px','fillText','drawImage','fillRect','strokeRect','stroke','fill','clearRect']) P[m]=function(){};
let errs=0;
const guard=(l,f)=>{try{f();}catch(e){errs++;console.log('ERROR ['+l+']:',e.message,'\n   '+(e.stack.split('\n')[1]||'').trim());}};
const setup=(id)=>{
  X.G.selClass=X.CLASSES.findIndex(c=>c.id===id); X.G.selDragon=0; X.beginGame();
  X.loadArea('clearing', X.AREAS.clearing.playerStart.x, X.AREAS.clearing.playerStart.y);
  X.G.enemies.length=0;
  for(let i=0;i<5;i++) tick();
};
const clearKeys=()=>{ for(const k in X.keys) X.keys[k]=false; };

console.log('=== KILLZONE TOGGLE ===');
guard('toggle',()=>{
  setup('longshot');
  // a spread of targets around the player
  X.spawnEnemy('rustquail', X.player.x+60, X.player.y);       // right
  X.spawnEnemy('rustquail', X.player.x-60, X.player.y);       // left
  X.spawnEnemy('rustquail', X.player.x,    X.player.y-60);    // up
  X.spawnEnemy('rustquail', X.player.x,    X.player.y+60);    // down
  for(let i=0;i<5;i++) tick();
  console.log('  killzone off. target range:', X.targetRange());
  X.player.cds=[0,0,0,0]; press('ArrowRight'); for(let i=0;i<20;i++) tick();
  console.log('  after → : killzone', X.player.killzone, '| range', X.targetRange());

  // WASD should now steer the mark, not the player
  const px0=X.player.x, py0=X.player.y;
  const dirName=t=>{ if(!t) return 'none';
    const dx=Math.round(t.x-px0), dy=Math.round(t.y-py0);
    return Math.abs(dx)>Math.abs(dy) ? (dx>0?'RIGHT':'LEFT') : (dy>0?'DOWN':'UP'); };
  for(const [key,want] of [['d','RIGHT'],['w','UP'],['a','LEFT'],['s','DOWN']]){
    clearKeys(); X.keys[key]=true;
    for(let i=0;i<20;i++) tick();
    clearKeys();
    console.log('   press '+key+' -> mark moves', dirName(X.G.target).padEnd(6),
                '(wanted '+want+')');
    for(let i=0;i<14;i++) tick();   // let the repeat delay lapse
  }
  console.log('  player stayed put:', Math.round(X.player.x)===Math.round(px0) &&
                                       Math.round(X.player.y)===Math.round(py0));

  // toggle off, movement returns
  X.player.cds=[0,0,0,0]; press('ArrowRight'); for(let i=0;i<20;i++) tick();
  console.log('  after → again: killzone', X.player.killzone);
  clearKeys(); X.keys['d']=true; for(let i=0;i<40;i++) tick(); clearKeys();
  console.log('  player can walk again:', X.player.x > px0);
});

console.log('\n=== KILLZONE: abilities fire at the mark, not the facing ===');
guard('aim',()=>{
  setup('longshot');
  X.spawnEnemy('rustquail', X.player.x, X.player.y-70);   // straight up
  for(let i=0;i<5;i++) tick();
  X.player.dx=1; X.player.dy=0;                            // facing right
  X.player.cds=[0,0,0,0]; press('ArrowRight'); for(let i=0;i<20;i++) tick();  // killzone on
  const tgt=X.G.target;
  console.log('  facing set to the mark:', Math.round(X.player.dy*100)/100, '(negative = up)');
  const hp0=tgt.hp;
  X.player.focus=100; X.player.cds=[0,0,0,0];
  press('ArrowUp'); for(let i=0;i<50;i++) tick();
  console.log('  Charged Shot hit the mark above:', hp0, '->', tgt.hp);
});

console.log('\n=== PIERCING ROUND goes through terrain ===');
guard('pierce',()=>{
  setup('longshot');
  // put a target on the far side of a wall of trees
  const a=X.G.area;
  const px0=X.player.x, py0=X.player.y;
  const tx=Math.floor(px0/16)+4, ty=Math.floor(py0/16);
  for(let dy=-2;dy<=2;dy++) a.map[(ty+dy)*a.w + tx] = 12;   // T.TREE wall
  X.spawnEnemy('rustquail', px0+110, py0);
  const e=X.G.enemies[0];
  X.player.dx=1; X.player.dy=0;
  for(let i=0;i<5;i++) tick();
  const hp0=e.hp;
  X.player.focus=100; X.player.cds=[0,0,0,0];
  press('ArrowLeft'); for(let i=0;i<30;i++) tick();
  console.log('  target behind a tree wall:', hp0, '->', e.hp, e.hp<hp0?'(pierced)':'(BLOCKED)');
  console.log('  cooldowns: charged', X.cls.abilities[0].cd+'s, piercing', X.cls.abilities[1].cd+'s');
});

console.log('\n=== SAVANT damage +50% ===');
guard('savant',()=>{
  setup('savant');
  for(let k=0;k<4;k++) X.spawnEnemy('gearrat', X.player.x+24+k*10, X.player.y);
  X.player.dx=1; X.player.dy=0;
  for(let i=0;i<5;i++) tick();
  const e=X.G.enemies[0];
  let hp0=e.hp;
  X.player.cds=[0,0,0,0]; press('ArrowUp'); for(let i=0;i<20;i++) tick();
  console.log('  Codex Strike:', hp0, '->', e.hp, '(was 3 before, expect ~5)');
  // learn Iron Fist off the gear-rat and swing it
  X.player.x=e.x-20; for(let i=0;i<3;i++) tick();
  press(' '); for(let i=0;i<80;i++) tick();
  const learned=X.cls.abilities[1];
  console.log('  learned:', learned.name);
  const e2=X.G.enemies.filter(q=>!q.dead)[1] || X.G.enemies.filter(q=>!q.dead)[0];
  X.player.x=e2.x-20; X.player.y=e2.y; X.player.dx=1; X.player.dy=0;
  for(let i=0;i<3;i++) tick();
  hp0=e2.hp;
  X.player.cds=[0,0,0,0]; press('ArrowLeft'); for(let i=0;i<30;i++) tick();
  console.log('  '+learned.name+':', hp0, '->', e2.hp);
});

console.log('\n=== DRAGON ON Q / E, INTERACT ON F ===');
guard('keys',()=>{
  setup('ironclad');
  X.dragon.cds=[0,0];
  press('q'); for(let i=0;i<10;i++) tick();
  console.log('  Q  -> dragon skill 1 cd:', X.dragon.cds[0].toFixed(1), X.dragon.cds[0]>0?'(fired)':'(nothing)');
  X.dragon.cds=[0,0];
  press('e'); for(let i=0;i<10;i++) tick();
  console.log('  E  -> dragon skill 2 cd:', X.dragon.cds[1].toFixed(1), X.dragon.cds[1]>0?'(fired)':'(nothing)');
  // F talks to Hayla
  const m=X.G.npcs.find(n=>n.id==='hayla');
  X.player.x=m.x; X.player.y=m.y+12; for(let i=0;i<3;i++) tick();
  press('f'); for(let i=0;i<3;i++) tick();
  console.log('  F  -> state:', NAMES[X.G.state], '(expect DIALOGUE)');
});

const __verdict = String(errs===0?'\nPASS':'\nFAIL - '+errs);
console.log(__verdict);

// A suite that prints FAIL and exits 0 is worse than no suite: the runner
// reports green and nobody looks. Exit code follows the result.
process.exit(/FAIL/.test(__verdict) ? 1 : 0);
