const {X,press,tick}=require('./harness.js');
const S=require('./strict.js');
const P=Object.getPrototypeOf(new S.Canvas(4,4).getContext('2d'));
for(const m of ['_px','fillText','drawImage','fillRect','strokeRect','stroke','fill','clearRect']) P[m]=function(){};

X.G.selClass=X.CLASSES.findIndex(c=>c.id==='reaver'); X.G.selDragon=0; X.beginGame();
X.loadArea('clearing', 22*16+8, 29*16+8);
X.G.enemies.length=0;
X.spawnEnemy('drone', X.player.x+18, X.player.y);
const t=X.G.enemies[0]; t.hp=t.maxhp=5000;
X.player.inx=1; X.player.iny=0; X.player.tempo=0; X.player.lastTempoKind='';
for(let i=0;i<5;i++) tick();

// pin the target in place each frame so knockback can't fake a miss
const pin=()=>{ t.x=X.player.x+18; t.y=X.player.y; t.knock=0; };
const swing=(key,label)=>{
  X.player.cds=[0,0,0,0]; press(key);
  for(let i=0;i<50;i++){ pin(); tick(); }
  console.log('  '+label.padEnd(16),'-> tempo', X.player.tempo, '| last', X.player.lastTempoKind);
};
console.log('=== ALTERNATION WITH THE TARGET PINNED IN REACH ===');
swing('ArrowUp','Lacerate');
swing('ArrowUp','Lacerate again');
swing('ArrowLeft','Snapfire');
swing('ArrowLeft','Snapfire again');
swing('ArrowUp','Lacerate');

console.log('\n=== KNOCKBACK CAN LEGITIMATELY CAUSE A WHIFF ===');
X.player.tempo=0; X.player.lastTempoKind='';
t.x = X.player.x+18; t.y = X.player.y; t.knock=0;
X.player.cds=[0,0,0,0]; press('ArrowUp');
for(let i=0;i<50;i++) tick();                       // no pinning this time
console.log('  first Lacerate   -> tempo', X.player.tempo, '| target now', Math.round(t.x-X.player.x)+'px away (reach 26)');
X.player.cds=[0,0,0,0]; press('ArrowUp');
for(let i=0;i<50;i++) tick();
const __verdict = String('  second Lacerate  -> tempo', X.player.tempo,
  Math.round(t.x-X.player.x)>26 ? '(whiffed: knocked out of reach, so no change)' : '(connected)');
console.log(__verdict);

// A suite that prints FAIL and exits 0 is worse than no suite: the runner
// reports green and nobody looks. Exit code follows the result.
process.exit(/FAIL/.test(__verdict) ? 1 : 0);
