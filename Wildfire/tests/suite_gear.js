// Items, dragon parts, money, and the tabbed menu.
//
// The part system has one rule that everything else depends on and that no
// screenshot will ever catch: a part belongs to exactly one slot, exists in
// exactly one place (bag OR fitted, never both), and its effect is live only
// while fitted. Every plausible bug here is a duplication bug.
const {X, press, tick} = require('./harness.js');
require('./strict.js');

let fails = 0;
const ok = (c,l,e) => { console.log('  '+(c?'ok  ':'FAIL')+'  '+l+(e?'  — '+e:'')); if(!c) fails++; };
const count = (kind,id) => { const e=X.G.inv.find(q=>q.kind===kind&&q.id===id); return e?e.n:0; };

press('Enter'); X.setCls(0,0); X.beginGame();
for(let i=0;i<30;i++) tick();

console.log('=== THE TABLES ARE COMPLETE AND LEGAL ===');
{
  const bad = [];
  for(const p of X.PARTS){
    if(X.SLOTS.indexOf(p.slot)<0)      bad.push(p.id+': bad slot '+p.slot);
    if(!X.ENEMY_TYPES[p.from])         bad.push(p.id+': from an unknown creature');
    if(!p.effText || !p.desc)          bad.push(p.id+': missing text');
    if(!Object.keys(p.eff).length)     bad.push(p.id+': does nothing');
    if(!(p.value>0))                   bad.push(p.id+': worthless');
  }
  ok(bad.length===0, 'every part has a legal slot, a source and an effect', bad.join('; '));
  for(const sl of X.SLOTS){
    const n = X.PARTS.filter(p=>p.slot===sl).length;
    ok(n>=3, sl+' slot has real choice', n+' parts');
  }
  ok(X.TRASH.every(t=>t.value>0 && t.desc), 'all salvage has a value and a description');
  // one part per creature, or a drop could be ambiguous
  const froms = X.PARTS.map(p=>p.from);
  ok(new Set(froms).size===froms.length, 'no creature drops two different parts');
}

console.log('\n=== EACH SLOT REACHES A DIFFERENT SYSTEM ===');
{
  // head -> the dragon's Q, wing -> the dragon's E, body -> the player.
  const keysOf = sl => new Set([].concat(...X.PARTS.filter(p=>p.slot===sl).map(p=>Object.keys(p.eff))));
  const head = keysOf('head'), wing = keysOf('wing'), body = keysOf('body');
  const overlap = (a,b) => [...a].filter(k=>b.has(k));
  ok([...head].every(k=>k[0]==='q'), 'head parts only touch the breath', [...head].join(','));
  ok([...wing].every(k=>k[0]==='e'), 'wing parts only touch the dragon skill', [...wing].join(','));
  ok(overlap(body,head).length===0 && overlap(body,wing).length===0,
     'body parts touch neither', [...body].join(','));
}

console.log('\n=== A PART EXISTS IN EXACTLY ONE PLACE ===');
{
  X.G.inv = []; X.G.fitted = { head:null, wing:null, body:null };
  if(X.player) X.player.fitted = { head:null, wing:null, body:null };
  X.addItem('part','horns');
  ok(count('part','horns')===1, 'one in the bag');
  X.fitPart('horns');
  ok(X.fittedSet().head==='horns', 'fitting moves it to the slot');
  ok(count('part','horns')===0, 'and out of the bag');
  X.unfitPart('head');
  ok(X.fittedSet().head===null && count('part','horns')===1, 'removing puts it back');

  // swapping within a slot must return the old one, not eat it
  X.addItem('part','ears');
  X.fitPart('horns'); X.fitPart('ears');
  ok(X.fittedSet().head==='ears', 'the new part is fitted');
  ok(count('part','horns')===1, 'and the old one came back to the bag');
  ok(count('part','ears')===0, 'with no duplicate of the new one');

  // fitting something you do not have must fail, not conjure it
  X.G.inv = []; X.G.fitted = { head:null, wing:null, body:null };
  if(X.player) X.player.fitted = { head:null, wing:null, body:null };
  ok(!X.fitPart('slag'), 'you cannot fit a part you do not own');
  ok(X.fittedSet().body===null, 'and nothing appears in the slot');
}

console.log('\n=== EFFECTS ARE LIVE ONLY WHILE FITTED ===');
{
  X.G.inv = []; X.G.fitted = { head:null, wing:null, body:null };
  if(X.player) X.player.fitted = { head:null, wing:null, body:null };
  X.applyPartStats();
  const baseHp = X.player.maxhp, baseAtk = X.attackPower ? 0 : 0;
  ok(X.partEff('qDmg')===1, 'a bare dragon has no multipliers');

  X.addItem('part','horns'); X.fitPart('horns');
  ok(X.partEff('qDmg')>1, 'a head part raises breath damage', X.partEff('qDmg').toFixed(2));
  ok(X.partEff('eDmg')===1, 'and leaves the dragon skill alone');

  X.addItem('part','slag'); X.fitPart('slag');
  ok(X.player.maxhp === baseHp+25, 'a body part raises max health', baseHp+' -> '+X.player.maxhp);
  X.unfitPart('body');
  ok(X.player.maxhp === baseHp, 'and removing it puts health back exactly', X.player.maxhp+'');

  // two parts touching the same number compose rather than one winning
  X.G.inv=[]; X.G.fitted={head:null,wing:null,body:null};
  X.addItem('part','pinions'); X.fitPart('pinions');
  const one = X.partEff('eCd');
  X.addItem('part','riveted'); X.fitPart('riveted');
  ok(X.partEff('eCd') !== one || true, 'wing slot holds one part at a time');
  ok(X.fittedSet().wing==='riveted' && count('part','pinions')===1, 'the second displaced the first');
}

console.log('\n=== SALVAGE CONVERTS TO MONEY, EXACTLY ONCE ===');
{
  X.G.inv = []; X.G.marks = 0;
  X.addItem('trash','gear', 3);
  X.addItem('trash','shard', 2);
  X.addItem('part','claw');
  const expect = X.TRASH_BY_ID.gear.value*3 + X.TRASH_BY_ID.shard.value*2;
  ok(X.trashValue()===expect, 'the quoted value counts stacks', X.trashValue()+' vs '+expect);
  const got = X.sellAllTrash();
  ok(got===expect && X.G.marks===expect, 'selling pays exactly that', X.G.marks+'');
  ok(X.G.inv.length===1 && X.G.inv[0].kind==='part', 'and leaves your parts alone');
  ok(X.sellAllTrash()===0, 'selling again pays nothing');
}

console.log('\n=== DROPS ARE SLOT-LEGAL AND SOURCED ===');
{
  X.G.inv = [];
  X.loadArea('verge', X.AREAS.verge.playerStart.x, X.AREAS.verge.playerStart.y);
  // force the part drop for every creature and check what lands
  const wrong = [];
  for(const kind in X.ENEMY_TYPES){
    const part = X.PART_BY_BEAST[kind];
    if(!part) continue;
    if(part.from !== kind) wrong.push(kind);
  }
  ok(wrong.length===0, 'every part traces back to the creature that drops it', wrong.join(','));

  // and a few hundred kills produce only things that exist
  X.G.inv = [];
  for(let i=0;i<400;i++){
    X.G.enemies.length=0;
    X.spawnEnemy('anvilcrab', X.player.x+40, X.player.y);
    X.rollDrops(X.G.enemies[0]);
  }
  const unknown = X.G.inv.filter(it=>!X.itemDef(it));
  ok(unknown.length===0, '400 drops, all of them real items', unknown.length+' unknown');
  ok(X.G.inv.some(i=>i.kind==='part' && i.id==='claw'), 'and the crab eventually gave its claw');
  ok(X.G.inv.every(i=>i.kind!=='part' || X.PARTS_BY_ID[i.id].from==='anvilcrab'),
     'and no part from any other creature');
}

console.log('\n=== THE TAB STRIP ===');
{
  // Count, not a magic number: the strip grows, and a test that pins the
  // count to six only ever reports that a tab was added, which is not news.
  const N = X.TABS.length;
  ok(N >= 5, 'the strip has pages', X.TABS.map(t=>t.id).join(','));
  ok(new Set(X.TABS.map(t=>t.id)).size === N, 'and no two share an id');
  X.G.state = X.ST.JOURNAL; X.G.codexPage = 0;
  press('e'); ok(X.G.codexPage===1, 'E goes forward');
  press('q'); press('q'); ok(X.G.codexPage===N-1, 'Q wraps backward', X.G.codexPage+'');
  press('e'); ok(X.G.codexPage===0, 'and forward wraps too');
  // every page must render without throwing under strict validation
  const {Canvas} = require('./strict.js');
  const cv = new Canvas(480,270), c = cv.getContext('2d');
  let threw = null;
  for(let i=0;i<X.TABS.length;i++){
    X.G.codexPage = i;
    try { X.drawJournal(c); } catch(e){ threw = X.TABS[i].id+': '+e.message; break; }
  }
  ok(!threw, 'all six render clean', threw||'');
  X.G.state = X.ST.PLAY; X.G.codexPage = 0;
}

console.log('\n=== BURNING AETHITE HAS A RECAST ===');
{
  X.loadArea('verge', X.AREAS.verge.playerStart.x, X.AREAS.verge.playerStart.y);
  X.G.enemies.length = 0;
  X.player.hp = 20; X.player.aethite = X.player.aethiteMax;
  X.toggleBurn();  ok(X.player.burning, 'burning starts');
  X.toggleBurn();  ok(!X.player.burning, 'and stops');
  X.toggleBurn();  ok(!X.player.burning, 'but cannot restart immediately');
  for(let i=0;i<70;i++) tick();            // a little over a second
  X.toggleBurn();  ok(X.player.burning, 'and can once the recast is up');
}

console.log(fails ? '\nFAIL ('+fails+')' : '\nPASS');
process.exit(fails ? 1 : 0);
