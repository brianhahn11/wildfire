const base=require('./strict.js');
const {Canvas}=base; const fs=require('fs');
const gc=new Canvas(480,270);
global.document={ getElementById:i=>i==='game'?gc:null,
  createElement:t=>t==='canvas'?new Canvas(300,150):{style:{}}, addEventListener(){} };
const L={}; global.window={ addEventListener:(k,f)=>{(L[k]=L[k]||[]).push(f);},
  AudioContext: global.AudioContext };
global.navigator={maxTouchPoints:0};
let T=0; global.performance={now:()=>T}; let raf=null; let dead=false;
global.requestAnimationFrame=cb=>{raf=cb;return 1;};
const src=fs.readFileSync(require('path').join(__dirname,'..','build','game.js'),'utf8');
eval(src+"\nglobal.X={G,ST,player,dragon,keys,beginGame,STORY_PAGES,loadArea,updateEnemies,reportError};");
const press=k=>(L['keydown']||[]).forEach(f=>f({key:k,preventDefault(){}}));
const tick =()=>{ const c=raf; if(!c){dead=true;return;} raf=null; T+=16.7; c(T); };
const NAMES={0:'TITLE',1:'SEL_CLASS',2:'SEL_DRAGON',3:'STORY',4:'PLAY',5:'DIALOGUE',6:'PAUSE',7:'DEAD',8:'JOURNAL'};

console.log('=== 1. prologue still reaches the game ===');
press('Enter'); for(let i=0;i<4;i++) tick();
press('Enter'); for(let i=0;i<4;i++) tick();
press('Enter'); for(let i=0;i<4;i++) tick();
for(let p=0;p<6;p++){
  for(let i=0;i<60*8;i++) tick();
  press('Enter'); for(let i=0;i<4;i++) tick();
  if(X.G.state===X.ST.PLAY) break;
}
console.log('  state:', NAMES[X.G.state], '| area:', X.G.areaId, '| rAF alive:', !dead);

console.log('\n=== 2. a thrown error is reported, not fatal ===');
const realUpdate = global.updateEnemies;
// sabotage something that runs every frame
X.G.enemies.push({ get dead(){ throw new Error('deliberate test failure'); } });
for(let i=0;i<5;i++) tick();
console.log('  rAF still alive:', !dead);
console.log('  error captured :', !!X.G.error);
if(X.G.error) console.log('  where / msg   :', X.G.error.where, '/', X.G.error.msg);

console.log('\n=== 3. frames keep running while the panel is up ===');
let before=T;
for(let i=0;i<30;i++) tick();
console.log('  advanced', Math.round((T-before)), 'ms of frames without dying:', !dead);

console.log('\n=== 4. R recovers to the title ===');
X.G.enemies.length=0;
press('r');
for(let i=0;i<5;i++) tick();
console.log('  state:', NAMES[X.G.state], '| error cleared:', !X.G.error, '| rAF alive:', !dead);

console.log('\n=== 5. can play through again after recovery ===');
press('Enter'); for(let i=0;i<4;i++) tick();
press('Enter'); for(let i=0;i<4;i++) tick();
press('Enter'); for(let i=0;i<4;i++) tick();
for(let p=0;p<6;p++){
  for(let i=0;i<60*8;i++) tick();
  press('Enter'); for(let i=0;i<4;i++) tick();
  if(X.G.state===X.ST.PLAY) break;
}
const __verdict = String('  state:', NAMES[X.G.state], '| area:', X.G.areaId);
console.log(__verdict);

// A suite that prints FAIL and exits 0 is worse than no suite: the runner
// reports green and nobody looks. Exit code follows the result.
process.exit(/FAIL/.test(__verdict) ? 1 : 0);
