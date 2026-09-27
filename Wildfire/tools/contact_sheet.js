// A fixed set of scenes, rendered deterministically, written as PNGs.
//
// This is the instrument for the whole art migration: run it before a change
// and after it, and diff. "Preserve the layout" is a claim that can only be
// checked by looking at the same frame twice, so the scenes must be identical
// runs — same picks, same area, same tick count, no randomness that matters.
//
// Usage: node tools/contact_sheet.js <outdir>
const fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..');
const H=require(path.join(ROOT,'tests','harness.js'));
const {X,press,tick}=H;
const OUT=process.argv[2]||'/tmp/sheet';
fs.mkdirSync(OUT,{recursive:true});

// Deterministic: the harness seeds Math.random, and every scene ticks a fixed
// number of times from a fresh beginGame so animation phase is reproducible.
function scene(name, fn){
  X.G.nPlayers=1; X.G.picks=[{cls:4,drg:0}];
  X.G.state=X.ST.PLAY; X.beginGame();
  for(let i=0;i<10;i++) tick();
  fn();
  for(let i=0;i<3;i++) tick();
  const cv=H.gc;
  fs.writeFileSync(path.join(OUT,name+'.png'), cv.toPNG(1));
  return name+' '+cv.width+'x'+cv.height;
}
const quiet=()=>{ X.G.fade=0; X.G.areaNameT=0; X.G.toastT=0; };
const go=id=>{ X.loadArea(id, X.AREAS[id].playerStart.x, X.AREAS[id].playerStart.y); quiet(); };

const done=[];
done.push(scene('world-cogway',  ()=>{ go('cogway'); }));
done.push(scene('world-verge',   ()=>{ go('verge'); }));
done.push(scene('world-shoals',  ()=>{ go('shoals'); }));
done.push(scene('world-cave',    ()=>{ X.G.locks.elevator=true; go('glimmervein'); }));
done.push(scene('world-clearing',()=>{ go('clearing'); }));
done.push(scene('world-house',   ()=>{ go('house'); }));
done.push(scene('title',         ()=>{ X.G.state=X.ST.TITLE; }));
done.push(scene('select-class',  ()=>{ X.G.state=X.ST.SELECT_CLASS; }));
done.push(scene('menu-codex',    ()=>{ go('cogway');
  for(const k of X.CODEX_ORDER) X.G.seen[k]=true;
  X.G.state=X.ST.JOURNAL; X.G.codexPage=X.TABS.findIndex(t=>t.id==='codex');
  X.G.codexSel=X.CODEX_ORDER.indexOf('brasshare'); }));
done.push(scene('menu-map',      ()=>{ go('cogway');
  X.G.state=X.ST.JOURNAL; X.G.codexPage=X.TABS.findIndex(t=>t.id==='map'); }));
done.push(scene('combat',        ()=>{ go('verge'); X.G.enemies.length=0;
  X.spawnEnemy('brasshare', X.player.x+40, X.player.y);
  X.spawnEnemy('tickboar',  X.player.x-46, X.player.y+18);
  X.updateTarget(); }));
console.log(done.join('\n'));
console.log('\n'+done.length+' scenes -> '+OUT);
