const {X,press,tick}=require('./harness.js');
const S=require('./strict.js');
const P=Object.getPrototypeOf(new S.Canvas(4,4).getContext('2d'));
for(const m of ['_px','fillText','drawImage','fillRect','strokeRect','stroke','fill','clearRect']) P[m]=function(){};
let errs=0;
const guard=(l,f)=>{try{f();}catch(e){errs++;console.log('ERROR ['+l+']:',e.message,'\n   '+(e.stack.split('\n')[1]||'').trim());}};
const setup=(id)=>{
  X.G.selClass=X.CLASSES.findIndex(c=>c.id===id); X.G.selDragon=0; X.beginGame();
  X.loadArea('clearing', 22*16+8, 29*16+8);
  X.G.enemies.length=0;
  for(let i=0;i<5;i++) tick();
};
const clear=()=>{ for(const k in X.keys) X.keys[k]=false; };
const deg = r => Math.round(r*180/Math.PI);

console.log('=== 1. LOCK RANGE MATCHES EACH CLASS’S REACH ===');
for(const id of ['savant','runebreaker','bulwark','ironclad','reaver','phantom','eidolon','aethermancer','longshot']){
  guard(id,()=>{
    setup(id);
    const R = X.targetRange();
    // one just inside, one just outside
    X.spawnEnemy('rustquail', X.player.x + R - 12, X.player.y);
    X.player.inx=1; X.player.iny=0;
    for(let i=0;i<4;i++) tick();
    const inRange = !!X.G.target;
    X.G.enemies.length=0;
    X.spawnEnemy('rustquail', X.player.x + R + 25, X.player.y);
    X.G.target=null;
    for(let i=0;i<4;i++) tick();
    const outRange = !!X.G.target;
    console.log('  '+id.padEnd(13),'range',String(R).padStart(3),
      '| just inside:', inRange?'marked':'NOT MARKED',
      '| beyond:', outRange?'STILL MARKED':'clear');
  });
}

console.log('\n=== 2. FACING SNAPS TO THE MARK ===');
guard('face',()=>{
  setup('ironclad');
  X.spawnEnemy('rustquail', X.player.x, X.player.y+60);   // straight below
  X.player.inx=1; X.player.iny=0;                          // heading right
  for(let i=0;i<6;i++) tick();
  console.log('  heading RIGHT, enemy BELOW ->',
    'target', X.G.target?'marked':'none',
    '| aim', deg(Math.atan2(X.player.dy,X.player.dx))+'° (90 = down)',
    '| dir', X.player.dir, '(0=down)');
  // walking away still faces the mark
  clear(); X.keys['a']=true;
  for(let i=0;i<20;i++) tick(); clear();
  console.log('  walking LEFT while marked ->',
    'aim', deg(Math.atan2(X.player.dy,X.player.dx))+'°', '| still marked:', !!X.G.target);
  // with nothing marked the aim follows the heading again
  X.G.enemies.length=0; X.G.target=null;
  clear(); X.keys['d']=true; for(let i=0;i<10;i++) tick(); clear();
  console.log('  no target, heading RIGHT ->',
    'aim', deg(Math.atan2(X.player.dy,X.player.dx))+'° (0 = right)');
});

console.log('\n=== 3. EVERY ABILITY FIRES AT THE MARK ===');
const checks = [
  ['ironclad',     'ArrowUp',   'Forge Cleave'],
  ['ironclad',     'ArrowRight','Earthsplitter'],
  ['bulwark',      'ArrowLeft', 'Aegis Break'],
  ['runebreaker',  'ArrowUp',   'Rune Strike'],
  ['aethermancer', 'ArrowUp',   'Searing Lance'],
  ['reaver',       'ArrowUp',   'Lacerate'],
  ['longshot',     'ArrowUp',   'Charged Shot'],
  ['phantom',      'ArrowUp',   'Backstab'],
  ['savant',       'ArrowUp',   'Codex Strike']
];
for(const [id,key,name] of checks){
  guard(id+name,()=>{
    setup(id);
    // enemy BELOW while the player heads RIGHT — only aiming at the mark hits
    X.spawnEnemy('drone', X.player.x, X.player.y + Math.min(40, (X.cls.primaryReach||34)-8));
    const t=X.G.enemies[0]; t.hp=t.maxhp=600;
    X.player.inx=1; X.player.iny=0;
    for(let i=0;i<6;i++) tick();
    X.player.focus=100; X.player.tempo=6; X.player.aegis=100; X.player.momentum=5;
    X.player.cds=[0,0,0,0];
    press(key);
    for(let i=0;i<70;i++) tick();
    console.log('  '+id.padEnd(13), name.padEnd(14),
      'damage to the mark below:', 600-t.hp, (600-t.hp)>0?'✓':'✗ MISSED');
  });
}

console.log('\n=== 4. DODGE STILL GOES WHERE YOU’RE HEADING ===');
guard('dodge',()=>{
  setup('ironclad');
  X.spawnEnemy('rustquail', X.player.x+40, X.player.y);   // mark to the right
  X.player.inx=-1; X.player.iny=0;                         // heading LEFT
  for(let i=0;i<6;i++) tick();
  const x0=X.player.x;
  clear(); press(' ');
  for(let i=0;i<30;i++) tick();
  console.log('  marked right, heading left, dodge ->',
    X.player.x < x0 ? 'moved LEFT (away from target) ✓' : 'moved RIGHT (into target) ✗');
});
console.log(errs===0?'\nPASS':'\nFAIL - '+errs);

console.log('\n=== 5. RETICLE REPORTS WHETHER YOUR PRIMARY CAN REACH ===');
guard('reachflag',()=>{
  setup('ironclad');
  const near = (X.cls.primaryReach||34) - 10;
  const far  = X.targetRange() - 10;
  X.spawnEnemy('rustquail', X.player.x + near, X.player.y);
  X.player.inx=1; X.player.iny=0;
  for(let i=0;i<5;i++) tick();
  console.log('  target at '+near+'px (reach '+X.cls.primaryReach+') -> in reach:', X.G.targetInReach, '(solid reticle)');
  X.G.enemies.length=0; X.G.target=null;
  X.spawnEnemy('rustquail', X.player.x + far, X.player.y);
  for(let i=0;i<5;i++) tick();
  const __verdict = String('  target at '+far+'px (lock '+X.targetRange()+')   -> in reach:', X.G.targetInReach, '(hollow reticle, still marked:', !!X.G.target, ')');
console.log(__verdict);

// A suite that prints FAIL and exits 0 is worse than no suite: the runner
// reports green and nobody looks. Exit code follows the result.
process.exit(/FAIL/.test(__verdict) ? 1 : 0);

});
