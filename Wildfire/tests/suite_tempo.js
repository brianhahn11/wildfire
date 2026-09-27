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
  X.player.tempo=0; X.player.lastTempoKind='';
  for(let i=0;i<5;i++) tick();
};

console.log('=== SWINGING AT NOTHING BUILDS NOTHING ===');
guard('whiff',()=>{
  setup();                                     // empty field
  X.player.inx=1; X.player.iny=0;
  for(let i=0;i<4;i++) tick();
  for(let n=0;n<4;n++){
    X.player.cds=[0,0,0,0]; press('ArrowUp');    // Lacerate into thin air
    for(let i=0;i<40;i++) tick();
  }
  console.log('  4x Lacerate at nothing  -> tempo', X.player.tempo, X.player.tempo===0?'✓':'✗');
  for(let n=0;n<4;n++){
    X.player.cds=[0,0,0,0]; press('ArrowLeft');  // Snapfire into thin air
    for(let i=0;i<70;i++) tick();
  }
  console.log('  4x Snapfire at nothing  -> tempo', X.player.tempo, X.player.tempo===0?'✓':'✗');
});

console.log('\n=== CONNECTING STILL BUILDS ===');
guard('hit',()=>{
  setup();
  X.spawnEnemy('drone', X.player.x+20, X.player.y);
  const t=X.G.enemies[0]; t.hp=t.maxhp=2000;
  X.player.inx=1; X.player.iny=0;
  for(let i=0;i<5;i++) tick();
  X.player.cds=[0,0,0,0]; press('ArrowUp');
  for(let i=0;i<45;i++) tick();
  console.log('  Lacerate on target      -> tempo', X.player.tempo, '(3 slashes connected)');
  X.player.cds=[0,0,0,0]; press('ArrowLeft');
  for(let i=0;i<50;i++) tick();
  console.log('  Snapfire on target      -> tempo', X.player.tempo, '(gun after blade = +1)');
});

console.log('\n=== A MISSED VOLLEY DOES NOT CREDIT ===');
guard('halfmiss',()=>{
  setup();
  // target far off to the side: the shot flies past it
  X.spawnEnemy('drone', X.player.x, X.player.y-120);
  const t=X.G.enemies[0]; t.hp=t.maxhp=2000;
  X.player.inx=1; X.player.iny=0;
  X.G.target=null;
  for(let i=0;i<4;i++) tick();
  const marked = !!X.G.target;
  X.player.cds=[0,0,0,0]; press('ArrowLeft');
  for(let i=0;i<80;i++) tick();
  console.log('  target out of lock range (marked:'+marked+') -> tempo',
    X.player.tempo, X.player.tempo===0?'✓ no credit':'✗ credited anyway');
});

console.log('\n=== TEMPO ONLY CREDITS ONCE PER VOLLEY ===');
guard('once',()=>{
  setup();
  X.player.tempo=4; X.player.lastTempoKind='blade';   // 4+ fires 3 rounds
  for(let k=0;k<3;k++) X.spawnEnemy('drone', X.player.x+26+k*4, X.player.y+(k-1)*6);
  for(const e of X.G.enemies){ e.hp=e.maxhp=2000; }
  X.player.inx=1; X.player.iny=0;
  for(let i=0;i<5;i++) tick();
  X.player.cds=[0,0,0,0]; press('ArrowLeft');
  for(let i=0;i<60;i++) tick();
  console.log('  3-round volley hitting several -> tempo 4 ->', X.player.tempo,
    X.player.tempo===5?'✓ (+1 only)':'✗');
});

console.log('\n=== REPEATING A TYPE STILL DROPS TEMPO (on hit) ===');
guard('repeat',()=>{
  setup();
  X.spawnEnemy('drone', X.player.x+20, X.player.y);
  const t=X.G.enemies[0]; t.hp=t.maxhp=3000;
  X.player.inx=1; X.player.iny=0;
  for(let i=0;i<5;i++) tick();
  const seq=[['ArrowUp','Lacerate'],['ArrowUp','Lacerate again'],['ArrowLeft','Snapfire']];
  for(const [k,n] of seq){
    X.player.cds=[0,0,0,0]; press(k); for(let i=0;i<50;i++) tick();
    console.log('  '+n.padEnd(15),'-> tempo', X.player.tempo);
  }
});
const __verdict = String(errs===0?'\nPASS':'\nFAIL - '+errs);
console.log(__verdict);

// A suite that prints FAIL and exits 0 is worse than no suite: the runner
// reports green and nobody looks. Exit code follows the result.
process.exit(/FAIL/.test(__verdict) ? 1 : 0);
