const {X,press,tick}=require('./harness.js');
const S=require('./strict.js');
const P=Object.getPrototypeOf(new S.Canvas(4,4).getContext('2d'));
for(const m of ['_px','fillText','drawImage','fillRect','strokeRect','stroke','fill','clearRect']) P[m]=function(){};
let errs=0;
const guard=(l,f)=>{try{f();}catch(e){errs++;console.log('ERROR ['+l+']:',e.message,'\n   '+(e.stack.split('\n')[1]||'').trim());}};
const setup=()=>{
  X.G.selClass=X.CLASSES.findIndex(c=>c.id==='reaver'); X.G.selDragon=0; X.beginGame();
  X.loadArea('clearing', 22*16+8, 29*16+8);
  X.G.enemies.length=0;
  for(let i=0;i<5;i++) tick();
};

console.log('=== COOLDOWNS ===');
const A=X.CLASSES.find(c=>c.id==='reaver').abilities;
A.forEach((a,i)=> console.log('  '+['↑','←','↓','→'][i], a.name.padEnd(14), a.cd+'s'));

console.log('\n=== SHADOW LUNGE: hits scale with Tempo, single target ===');
for(const tempo of [1,3,6]){
  guard('lunge'+tempo,()=>{
    setup();
    X.spawnEnemy('drone', X.player.x+40, X.player.y);        // tanky, survives
    X.spawnEnemy('drone', X.player.x+40, X.player.y+26);     // bystander
    const t=X.G.enemies[0], other=X.G.enemies[1];
    t.hp=t.maxhp=500; other.hp=other.maxhp=500;
    X.player.inx=1; X.player.iny=0;
    for(let i=0;i<5;i++) tick();
    X.player.tempo=tempo;
    X.player.cds=[0,0,0,0];
    press('ArrowDown');
    for(let i=0;i<70;i++) tick();
    console.log('  tempo '+tempo+' -> target took', 500-t.hp,
      '| bystander took', 500-other.hp, '(single target)',
      '| tempo after:', X.player.tempo);
  });
}

console.log('\n=== BULLET RAIN: volleys scale with Tempo ===');
for(const tempo of [1,3,6]){
  guard('rain'+tempo,()=>{
    setup();
    X.spawnEnemy('drone', X.player.x+50, X.player.y);
    const t=X.G.enemies[0]; t.hp=t.maxhp=800;
    X.player.inx=1; X.player.iny=0;
    for(let i=0;i<5;i++) tick();
    X.player.tempo=tempo;
    X.player.cds=[0,0,0,0];
    press('ArrowRight');
    for(let i=0;i<120;i++) tick();
    console.log('  tempo '+tempo+' -> target took', 800-t.hp,
      '| shots still flying:', (X.G.shots||[]).length,
      '| tempo after:', X.player.tempo);
  });
}

console.log('\n=== FINISHERS REFUSE AT ZERO TEMPO ===');
guard('zero',()=>{
  setup();
  X.spawnEnemy('drone', X.player.x+40, X.player.y);
  X.player.inx=1; X.player.iny=0;
  for(let i=0;i<5;i++) tick();
  X.player.tempo=0; X.player.cds=[0,0,0,0];
  press('ArrowDown'); for(let i=0;i<10;i++) tick();
  console.log('  lunge at 0 tempo -> cd used:', X.player.cds[2].toFixed(1), '(0 = refused, no waste)');
  X.player.cds=[0,0,0,0];
  press('ArrowRight'); for(let i=0;i<10;i++) tick();
  console.log('  rain  at 0 tempo -> cd used:', X.player.cds[3].toFixed(1), '(0 = refused)');
});

console.log('\n=== BUILDERS STILL ALTERNATE ===');
guard('build',()=>{
  setup();
  for(let k=0;k<4;k++) X.spawnEnemy('drone', X.player.x+24+k*10, X.player.y);
  for(const e of X.G.enemies){ e.hp=e.maxhp=900; }
  X.player.inx=1; X.player.iny=0;
  for(let i=0;i<5;i++) tick();
  X.player.tempo=0; X.player.lastTempoKind='';
  const seq=[['ArrowUp','Lacerate'],['ArrowLeft','Snapfire'],['ArrowUp','Lacerate'],['ArrowLeft','Snapfire']];
  for(const [k,n] of seq){
    X.player.cds=[0,0,0,0];
    press(k); for(let i=0;i<24;i++) tick();
    console.log('  '+n.padEnd(9), '-> tempo', X.player.tempo);
  }
});
const __verdict = String(errs===0?'\nPASS':'\nFAIL - '+errs);
console.log(__verdict);

// A suite that prints FAIL and exits 0 is worse than no suite: the runner
// reports green and nobody looks. Exit code follows the result.
process.exit(/FAIL/.test(__verdict) ? 1 : 0);
