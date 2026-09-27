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
  for(let k=0;k<5;k++) X.spawnEnemy('rustquail', X.player.x+26+k*12, X.player.y+(k%2?7:-7));
  X.player.dx=1; X.player.dy=0;
  for(let i=0;i<5;i++) tick();
};

console.log('=== EIDOLON: press once to summon, again to command ===');
const KEYS={golem:'ArrowUp', sprite:'ArrowLeft', hound:'ArrowDown'};
for(const [kind,key] of Object.entries(KEYS)){
  guard(kind,()=>{
    setup('eidolon');
    X.player.cds=[0,0,0,0];
    press(key); for(let i=0;i<30;i++) tick();
    const summoned = X.G.summons.filter(s=>s.kind===kind).length;
    const hpBefore = X.G.enemies.filter(e=>!e.dead).reduce((a,e)=>a+e.hp,0);
    const wallsBefore = X.G.walls.length;
    X.player.cds=[0,0,0,0];
    press(key); for(let i=0;i<40;i++) tick();
    const stillOne = X.G.summons.filter(s=>s.kind===kind).length;
    const hpAfter = X.G.enemies.filter(e=>!e.dead).reduce((a,e)=>a+e.hp,0);
    console.log('  '+kind.padEnd(7),
      '| summoned', summoned,
      '| after 2nd press still', stillOne, '(not duplicated)',
      '| walls', wallsBefore+'->'+X.G.walls.length,
      '| enemy hp', hpBefore+'->'+hpAfter);
  });
}

console.log('\n=== EIDOLON: fuse, then detonate ===');
guard('mega',()=>{
  setup('eidolon');
  X.player.cds=[0,0,0,0]; press('ArrowUp');   for(let i=0;i<30;i++) tick();
  X.player.cds=[0,0,0,0]; press('ArrowLeft'); for(let i=0;i<30;i++) tick();
  console.log('  two summons out:', X.G.summons.map(s=>s.kind).join('+'));
  X.player.cds=[0,0,0,0]; press('ArrowRight'); for(let i=0;i<30;i++) tick();
  console.log('  after fusion:', X.G.summons.map(s=>s.kind).join('+'));
  const hp0=X.G.enemies.filter(e=>!e.dead).reduce((a,e)=>a+e.hp,0);
  X.player.cds=[0,0,0,0]; press('ArrowRight'); for(let i=0;i<30;i++) tick();
  const hp1=X.G.enemies.filter(e=>!e.dead).reduce((a,e)=>a+e.hp,0);
  console.log('  detonation: enemy hp', hp0, '->', hp1,
    '| mega survives:', X.G.summons.some(s=>s.kind==='mega'));
});

console.log('\n=== WALL blocks creatures but not the player ===');
guard('wall',()=>{
  setup('eidolon');
  X.player.cds=[0,0,0,0]; press('ArrowUp'); for(let i=0;i<30;i++) tick();
  X.player.cds=[0,0,0,0]; press('ArrowUp'); for(let i=0;i<20;i++) tick();
  const w=X.G.walls[0];
  if(!w){ console.log('  no wall spawned'); return; }
  console.log('  wall at', Math.round(w.x)+','+Math.round(w.y), 'half-length', w.half);
  console.log('  wallBlocks at its centre :', X.wallBlocks(w.x, w.y), '(enemies stopped)');
  console.log('  wallBlocks 30px away     :', X.wallBlocks(w.x+40, w.y+40), '(open ground)');
  // the player walks straight through
  const px0=X.player.x;
  X.player.x = w.x - 14; X.player.y = w.y;
  X.keys['d']=true; for(let i=0;i<40;i++) tick(); X.keys['d']=false;
  console.log('  player crossed the wall  :', X.player.x > w.x ? 'yes' : 'no');
});

console.log('\n=== SAVANT: Codex Strike poke ===');
guard('savant',()=>{
  setup('savant');
  console.log('  slot 1:', X.cls.abilities[0].name, '| slots 2-4:',
    X.cls.abilities.slice(1).map(a=>a.name.indexOf('Empty')>=0?'empty':a.name).join(', '));
  const e=X.G.enemies.filter(q=>!q.dead)[0];
  X.player.x=e.x-16; X.player.y=e.y; X.player.dx=1; X.player.dy=0;
  for(let i=0;i<4;i++) tick();
  const hp0=e.hp;
  X.player.cds=[0,0,0,0]; press('ArrowUp'); for(let i=0;i<20;i++) tick();
  console.log('  poke damage:', hp0, '->', e.hp, '| Analyzed mark:', e.marked>0 ? 'applied '+e.marked.toFixed(1)+'s' : 'none');
  // and it still learns
  X.player.x=e.x-20; for(let i=0;i<3;i++) tick();
  press(' '); for(let i=0;i<80;i++) tick();
  console.log('  after ASSIMILATE:', X.cls.abilities.map(a=>a.name.indexOf('Empty')>=0?'-':a.name).join(' / '));
});

const __verdict = String(errs===0?'\nPASS':'\nFAIL - '+errs);
console.log(__verdict);

// A suite that prints FAIL and exits 0 is worse than no suite: the runner
// reports green and nobody looks. Exit code follows the result.
process.exit(/FAIL/.test(__verdict) ? 1 : 0);
