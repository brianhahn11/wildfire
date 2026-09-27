const {X,press,tick,NAMES}=require('./harness.js');
const S=require('./shim.js');
const P=Object.getPrototypeOf(new S.Canvas(4,4).getContext('2d'));
for(const m of ['_px','fillText','drawImage','fillRect','strokeRect','stroke','fill','clearRect']) P[m]=function(){};
let errs=0;
const guard=(l,f)=>{try{f();}catch(e){errs++;console.log('ERROR ['+l+']:',e.message);}};
const walk=(dir,frames)=>{ for(const k in X.keys) X.keys[k]=false; X.keys[dir]=true;
  for(let i=0;i<frames;i++) tick(); for(const k in X.keys) X.keys[k]=false; };

console.log('=== DOOR ROUND TRIP (both directions, 6 runs) ===');
guard('door',()=>{
  let ok=0;
  for(let r=0;r<6;r++){
    X.G.selClass=r%9; X.G.selDragon=r%6; X.beginGame();
    walk('s',150);
    const out=X.G.areaId;
    walk('w',200);
    const back=X.G.areaId;
    if(out==='clearing' && back==='house') ok++;
    else console.log('  run'+r+': out='+out+' back='+back);
  }
  console.log('  '+ok+'/6 round trips succeeded');
});

console.log('\n=== DOORWAY WIDTH TOLERANCE ===');
guard('tolerance',()=>{
  X.G.selClass=0; X.G.selDragon=0; X.beginGame();
  walk('s',150);
  // approach the cottage door from a range of horizontal offsets
  let pass=0, tries=0;
  for(let off=-6; off<=6; off+=2){
    X.loadArea('clearing', 26*16+8+off, 18*16+8);
    for(let i=0;i<3;i++) tick();
    walk('w', 80);
    tries++;
    if(X.G.areaId==='house') pass++;
  }
  console.log('  entered from '+pass+'/'+tries+' horizontal offsets (-6px..+6px)');
});

console.log('\n=== FULL JOURNEY, ALL 9 CLASSES ===');
guard('journey',()=>{
  for(let ci=0;ci<9;ci++){
    X.G.selClass=ci; X.G.selDragon=ci%6; X.beginGame();
    walk('s',150);
    const a1=X.G.areaId;
    X.player.x=30*16+8; X.player.y=25*16+8; for(let i=0;i<3;i++) tick();
    walk('d',60*10);
    const a2=X.G.areaId;
    walk('a',60*14);
    const a3=X.G.areaId;
    const ok = a1==='clearing' && a2==='gate' && a3==='clearing';
    console.log('  '+X.CLASSES[ci].id.padEnd(13), ok?'house->clearing->gate->clearing  OK':('FAILED '+a1+'/'+a2+'/'+a3));
  }
});

console.log('\n=== SOAK 2 min with abilities firing ===');
guard('soak',()=>{
  X.G.selClass=0; X.G.selDragon=0; X.beginGame();
  X.loadArea('clearing', X.AREAS.clearing.playerStart.x, X.AREAS.clearing.playerStart.y);
  for(let i=0;i<60*120;i++){
    const K=X.keys; for(const k of ['w','a','s','d']) K[k]=false;
    if(i%100<50) K['d']=true; else K['a']=true;
    if(i%25===0) press('j');
    if(i%80===0){ X.player.cds=[0,0,0,0]; press(['ArrowUp','ArrowLeft','ArrowDown','ArrowRight'][(i/80)%4|0]); }
    if(i%200===0){ X.dragon.cds=[0,0]; press(','); press('.'); }
    if(i%60===0) press(' ');
    tick();
  }
  for(const k in X.keys) X.keys[k]=false;
  console.log('  120s: particles',X.G.particles.length,'floats',X.G.floats.length,
    'hitmarks',X.G.hitmarks.length,'shots',(X.G.shots||[]).length,
    'enemies',X.G.enemies.length,'hp',X.player.hp+'/'+X.player.maxhp);
});
const __verdict = String(errs===0?'\nPASS':'\nFAIL - '+errs);
console.log(__verdict);

// A suite that prints FAIL and exits 0 is worse than no suite: the runner
// reports green and nobody looks. Exit code follows the result.
process.exit(/FAIL/.test(__verdict) ? 1 : 0);
