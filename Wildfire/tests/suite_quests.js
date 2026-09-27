// The five postings, and the gathering they are built on.
//
// A quest can fail in two directions and only one of them is visible. It can
// refuse to complete, which the player notices immediately; or it can complete
// when it should not, which the player never reports because it felt
// generous. So every quest here is driven to its end the long way — kill the
// creatures, cut the ore, plant the mast — and then separately checked for the
// ways it could have been finished cheaply.
const {X, press, tick} = require('./harness.js');
require('./strict.js');

let fails = 0;
const ok = (c,l,e) => { console.log('  '+(c?'ok  ':'FAIL')+'  '+l+(e?'  — '+e:'')); if(!c) fails++; };

function fresh(cls){
  X.G.nPlayers = 1; X.G.picks = [{cls:cls===undefined?4:cls, drg:0}];
  X.G.state = X.ST.PLAY; X.beginGame();
  for(let i=0;i<10;i++) tick();
}
function go(id){
  X.loadArea(id, X.AREAS[id].playerStart.x, X.AREAS[id].playerStart.y);
  X.G.fade = 0; X.G.areaNameT = 0;
}
function accept(id){
  const q = X.QUEST_BY_ID[id];
  go('cogway');
  const npc = X.G.npcs.find(n=>n.id===q.giver);
  X.talkQuest(npc);
  X.G.state = X.ST.PLAY;
  return q;
}
function handIn(id){
  const q = X.QUEST_BY_ID[id];
  go('cogway');
  const npc = X.G.npcs.find(n=>n.id===q.giver);
  X.talkQuest(npc);
  X.G.state = X.ST.PLAY;
}
// Walk onto a node and work it, without depending on being able to path there.
function harvestAt(i){
  const a = X.G.area, [x,y] = a.nodes[i];
  X.player.x = x*16+8; X.player.y = y*16+22;
  return X.harvestHere();
}

// ---------------------------------------------------------------------------
console.log('=== EVERY ZONE HAS ITS OWN MATERIAL, AND ONLY ITS OWN ===');
{
  fresh();
  const zones = X.MATERIALS.map(m=>m.zone);
  ok(new Set(zones).size === zones.length, 'no two materials share a zone',
     zones.join(','));
  for(const m of X.MATERIALS){
    const a = X.AREAS[m.zone];
    ok(!!a, m.id+' names a real zone', m.zone);
    ok(a && a.nodeMat === m.id, 'and that zone is seeded with it', a && a.nodeMat);
    ok(a && (a.nodes||[]).length >= 5, 'and has enough nodes to bother going',
       a && (a.nodes||[]).length);
  }
  // A node the player cannot reach is worse than no node: the quest that
  // wants it has no way to say so.
  for(const m of X.MATERIALS){
    const a = X.AREAS[m.zone];
    const stranded = (a.nodes||[]).filter(([x,y]) =>
      ![[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => !X.SOLID[a.map[(y+dy)*a.w+(x+dx)]]));
    ok(stranded.length === 0, m.zone+': every node can be stood beside',
       JSON.stringify(stranded));
  }
}

// ---------------------------------------------------------------------------
console.log('\n=== GATHERING, AND GROWING BACK ===');
{
  fresh();
  go('verge');
  const before = X.countItem('mat','bloomiron');
  ok(harvestAt(0), 'a node can be worked');
  const after = X.countItem('mat','bloomiron');
  ok(after > before, 'and it yields the zone material', before+' -> '+after);
  ok(!X.nodeReady(X.G.area.nodes[0][0], X.G.area.nodes[0][1]),
     'the node is spent afterwards');
  const mid = X.countItem('mat','bloomiron');
  harvestAt(0);
  ok(X.countItem('mat','bloomiron') === mid, 'and cannot be worked twice',
     String(X.countItem('mat','bloomiron')));

  for(let i=0;i<(X.NODE_RESPAWN+2)*60;i++) X.updateNodes(1/60);
  ok(X.nodeReady(X.G.area.nodes[0][0], X.G.area.nodes[0][1]),
     'it grows back after '+X.NODE_RESPAWN+'s');
  ok(harvestAt(0), 'and can be worked again');

  // and the wrong zone does not hand out the right material
  go('shoals');
  harvestAt(0);
  ok(X.countItem('mat','bloomiron') === mid+1,
     'the Shoals do not produce Bloom Iron', String(X.countItem('mat','bloomiron')));
  ok(X.countItem('mat','brinesalt') > 0, 'they produce their own',
     String(X.countItem('mat','brinesalt')));
}

// ---------------------------------------------------------------------------
console.log('\n=== BOUNTY: KILL EIGHT BRASS HARES ===');
{
  fresh();
  const q = accept('hares');
  ok(X.questState('hares') === X.QUEST_STATE.ACTIVE, 'accepted from Marta',
     X.questState('hares'));

  go('verge');
  X.G.enemies.length = 0;
  // killing the WRONG thing must not count — the bounty names a species
  X.spawnEnemy('tickboar', X.player.x+30, X.player.y);
  X.killEnemy(X.G.enemies[0]);
  ok(X.G.quests.hares.n === 0, 'a boar is not a hare', String(X.G.quests.hares.n));

  for(let n=0;n<q.need;n++){
    X.G.enemies.length = 0;
    X.spawnEnemy('brasshare', X.player.x+30, X.player.y);
    X.killEnemy(X.G.enemies[0]);
  }
  ok(X.G.quests.hares.n === q.need, 'eight hares counts eight',
     X.G.quests.hares.n+'/'+q.need);
  ok(X.questState('hares') === X.QUEST_STATE.READY, 'and the posting goes ready',
     X.questState('hares'));

  // a ninth does not overflow the count
  X.G.enemies.length = 0;
  X.spawnEnemy('brasshare', X.player.x+30, X.player.y);
  X.killEnemy(X.G.enemies[0]);
  ok(X.G.quests.hares.n === q.need, 'and a ninth does not overshoot',
     String(X.G.quests.hares.n));

  const marks = X.G.marks;
  handIn('hares');
  ok(X.questState('hares') === X.QUEST_STATE.DONE, 'handed in', X.questState('hares'));
  ok(X.G.marks === marks + q.reward.marks, 'and it pays what it said',
     (X.G.marks-marks)+' of '+q.reward.marks);
  ok(X.G.inv.some(i=>i.kind==='part' && i.id===q.reward.part),
     'including the dragon part', q.reward.part);
}

// ---------------------------------------------------------------------------
console.log('\n=== HAULAGE: TEN BLOOM IRON, AND IT IS TAKEN OFF YOU ===');
{
  fresh();
  const q = accept('bloom');
  X.addItem('mat', 'bloomiron', q.need-1);
  X.questRefresh();
  ok(X.questState('bloom') === X.QUEST_STATE.ACTIVE, 'nine is not ten',
     X.questProgress(q).text);
  X.addItem('mat', 'bloomiron', 1);
  X.questRefresh();
  ok(X.questState('bloom') === X.QUEST_STATE.READY, 'ten is', X.questProgress(q).text);

  X.addItem('mat', 'bloomiron', 4);            // carrying spare
  const marks = X.G.marks;
  handIn('bloom');
  ok(X.questState('bloom') === X.QUEST_STATE.DONE, 'handed in');
  ok(X.countItem('mat','bloomiron') === 4, 'it took ten and left the rest',
     String(X.countItem('mat','bloomiron')));
  ok(X.G.marks === marks + q.reward.marks, 'and paid', String(X.G.marks-marks));
}

// ---------------------------------------------------------------------------
console.log('\n=== SURVEY: ONE OF EACH, WHICH IS NOT FIVE OF ONE ===');
{
  fresh();
  const q = accept('survey');
  X.addItem('mat', 'rustscrap', 40);
  X.questRefresh();
  ok(X.questState('survey') === X.QUEST_STATE.ACTIVE,
     'forty of one ground proves nothing', X.questProgress(q).text);

  for(const m of q.mats) if(!X.countItem('mat',m)) X.addItem('mat', m, 1);
  X.questRefresh();
  ok(X.questState('survey') === X.QUEST_STATE.READY, 'one of each does',
     X.questProgress(q).text);

  const marks = X.G.marks;
  handIn('survey');
  ok(X.questState('survey') === X.QUEST_STATE.DONE, 'handed in');
  ok(X.countItem('mat','rustscrap') === 39, 'it took exactly one of each',
     String(X.countItem('mat','rustscrap')));
  ok(X.G.marks === marks + q.reward.marks, 'and paid', String(X.G.marks-marks));
}

// ---------------------------------------------------------------------------
console.log('\n=== FIELDWORK: THE COLLECTOR WANTS RESIDUE, NOT AETHITE ===');
{
  fresh();
  const q = accept('collector');

  // it will not plant anywhere but the zone it was commissioned for
  go('verge');
  ok(!X.towerHere(), 'it will not go in the wrong zone');
  ok(!X.G.towers[q.zone], 'and nothing was planted', JSON.stringify(X.G.towers));

  go('scarp');
  X.G.enemies.length = 0;
  ok(X.towerHere(), 'it plants on the Scarp');
  const t = X.G.towers[q.zone];
  ok(!!t && t.charge === 0, 'empty to start', t && String(t.charge));

  // a burn with no damage behind it gives it nothing
  X.player.x = t.x; X.player.y = t.y - 10;
  X.player.residueT = 0;
  X.player.hp = X.player.maxhp - 30;
  X.player.combatT = 0; X.player.burnCd = 0; X.player.burning = false;
  X.toggleBurn();
  ok(t.charge === 0, 'burning with nothing to mend charges nothing',
     String(t.charge));

  // hit first, then mend beside it
  let guard = 0;
  while(t.charge < 100 && guard++ < 20){
    X.player.burning = false; X.player.burnCd = 0; X.player.iframe = 0;
    X.player.hp = X.player.maxhp;
    X.hurtPlayer(10, t.x+40, t.y);
    if(guard===1) ok(X.player.residueT > 0, 'a hit leaves residue');
    X.player.combatT = 0;
    X.player.aethite = X.player.aethiteMax;
    X.player.burning = false; X.player.burnCd = 0;
    X.toggleBurn();
  }
  ok(t.charge >= 100, 'four mends beside it fill the mast',
     guard+' cycles, '+t.charge+'%');

  // and the same residue cannot be spent twice
  const at = t.charge;
  X.player.burning = false; X.player.burnCd = 0; X.player.hp = X.player.maxhp - 20;
  X.player.combatT = 0; X.toggleBurn();
  ok(t.charge === at, 'one hit buys one charge', String(t.charge));

  ok(X.questState('collector') !== X.QUEST_STATE.READY,
     'a full mast is not the same as a returned one', X.questState('collector'));
  X.towerHere();                                     // F to cap it
  ok(t.collected === true, 'F takes it off the mast');
  ok(X.questState('collector') === X.QUEST_STATE.READY, 'now it is ready',
     X.questState('collector'));

  const cap = X.player.aethiteMax, marks = X.G.marks;
  handIn('collector');
  ok(X.questState('collector') === X.QUEST_STATE.DONE, 'handed in');
  ok(!X.G.towers[q.zone], 'and the mast is gone from the Scarp');
  ok(X.player.aethiteMax === cap + q.reward.aethite, 'the store grew',
     cap+' -> '+X.player.aethiteMax);
  ok(X.G.marks === marks + q.reward.marks, 'and it paid', String(X.G.marks-marks));
}

// ---------------------------------------------------------------------------
console.log('\n=== CONTRACT: BREAK THE SOCKETS, THEN CUT THE SEAM ===');
{
  fresh();
  const q = accept('rootcut');
  go('glimmervein');
  X.G.enemies.length = 0;

  // shards cut while a socket still pours do not count — that IS the experiment
  X.spawnEnemy('pylon', X.player.x+80, X.player.y);
  X.addItem('mat','veinshard', 5);
  X.questGathered('veinshard', 5);
  X.questRefresh();
  ok((X.G.quests.rootcut.cutAfter|0) === 0,
     'stone cut under a working socket does not count',
     String(X.G.quests.rootcut.cutAfter|0));
  ok(X.questState('rootcut') === X.QUEST_STATE.ACTIVE, 'and it stays open');

  X.G.enemies.length = 0;
  for(let n=0;n<q.need;n++){
    const py = X.spawnEnemy('pylon', X.player.x+40, X.player.y);
    X.killEnemy(py || X.G.enemies[X.G.enemies.length-1]);
  }
  ok(X.G.quests.rootcut.n === q.need, 'three sockets broken',
     X.G.quests.rootcut.n+'/'+q.need);
  ok(X.questState('rootcut') === X.QUEST_STATE.ACTIVE,
     'which is not the whole job');

  X.G.enemies.length = 0;                             // nothing left standing
  X.addItem('mat','veinshard', q.matNeed);
  X.questGathered('veinshard', q.matNeed);
  X.questRefresh();
  ok(X.questState('rootcut') === X.QUEST_STATE.READY,
     'two shards off a quiet seam finishes it', X.questProgress(q).text);

  const marks = X.G.marks;
  handIn('rootcut');
  ok(X.questState('rootcut') === X.QUEST_STATE.DONE, 'handed in');
  ok(X.G.marks === marks + q.reward.marks, 'and paid', String(X.G.marks-marks));
  ok(X.G.inv.some(i=>i.kind==='part' && i.id===q.reward.part),
     'with the prong', q.reward.part);
}

// ---------------------------------------------------------------------------
console.log('\n=== THE FIVE ARE FIVE DIFFERENT THINGS ===');
{
  const kinds = QUESTKINDS();
  function QUESTKINDS(){ return X.QUESTS.map(q=>q.kind); }
  ok(new Set(kinds).size === X.QUESTS.length, 'no two share a shape',
     kinds.join(','));
  const givers = X.QUESTS.map(q=>q.giver);
  ok(new Set(givers).size === X.QUESTS.length, 'and no two share a giver',
     givers.join(','));
  for(const q of X.QUESTS){
    ok(!!X.QUEST_GIVER_NAME[q.giver], q.id+' names its giver properly', q.giver);
    ok(q.brief.length >= 2 && q.nag && q.done, q.id+' has all three speeches');
    const rw = q.reward||{};
    ok(rw.marks > 0, q.id+' pays something', String(rw.marks));
    // Every id in a reward must resolve. A reward naming a part that does not
    // exist crashed at the moment of payment, at the end of a playthrough —
    // the worst possible place to find out, and a table check finds it here.
    const bad = [];
    for(const [kind,id] of (rw.items||[])){
      const d = kind==='mat' ? X.MAT_BY_ID[id] : kind==='part' ? X.PARTS_BY_ID[id] : X.TRASH_BY_ID[id];
      if(!d) bad.push(kind+':'+id);
    }
    if(rw.part && !X.PARTS_BY_ID[rw.part]) bad.push('part:'+rw.part);
    ok(bad.length===0, 'and everything it pays with exists', bad.join(','));
  }
  // every giver has to actually exist on the ring, or the quest is unreachable
  const onRing = new Set(X.COGWAY_FOLK.map(f=>f.id));
  const missing = X.QUESTS.filter(q=>!onRing.has(q.giver)).map(q=>q.giver);
  ok(missing.length === 0, 'and every giver stands on the top ring',
     missing.join(','));
}

// ---------------------------------------------------------------------------
console.log('\n=== YOU CAN SEE WHO WANTS SOMETHING ===');
{
  // The only way to find out who had work was to walk the ring pressing F at
  // everybody. Three states, one marker, and the same three for Hayla in the
  // clearing as for the five in the city.
  fresh();
  go('cogway');
  const givers = X.G.npcs.filter(n=>X.QUESTS_BY_GIVER[n.id]);
  ok(givers.length === X.QUESTS.length, 'every giver is standing on the ring',
     givers.map(n=>n.id).join(','));
  ok(givers.every(n=>X.npcQuestMark(n)==='!'),
     'and all five are flagged as having work',
     givers.map(n=>n.id+'='+X.npcQuestMark(n)).join(' '));

  const noise = X.G.npcs.filter(n=>!X.QUESTS_BY_GIVER[n.id] && !n.quest && X.npcQuestMark(n));
  ok(noise.length === 0, 'and nobody else on the ring is flagged',
     noise.map(n=>n.id).join(','));

  // take one: it goes quiet, and the others do not
  const vosk = X.G.npcs.find(n=>n.id==='vosk');
  X.talkQuest(vosk); X.G.state = X.ST.PLAY;
  ok(X.npcQuestMark(vosk) === '..', 'accepting turns the giver to in-progress',
     X.npcQuestMark(vosk));
  ok(X.G.npcs.filter(n=>X.npcQuestMark(n)==='!').length === X.QUESTS.length-1,
     'and leaves the rest alone');

  // finish it: it flips to a hand-in
  X.addItem('mat','bloomiron', X.QUEST_BY_ID.bloom.need);
  X.questRefresh();
  ok(X.npcQuestMark(vosk) === '?', 'a finished job flags the giver for hand-in',
     X.npcQuestMark(vosk));

  // hand it in: nothing left, no marker
  X.talkQuest(vosk); X.G.state = X.ST.PLAY;
  ok(X.npcQuestMark(vosk) === null, 'and a settled giver goes unmarked',
     String(X.npcQuestMark(vosk)));

  // Hayla keeps her own errand and her own marker
  go('clearing');
  const hayla = X.G.npcs.find(n=>n.id==='hayla');
  ok(!!hayla, 'Hayla is where she always was');
  ok(X.npcQuestMark(hayla) !== null, 'and is marked too',
     String(X.npcQuestMark(hayla)));
}

// ---------------------------------------------------------------------------
console.log('\n=== THE MAP IS A STACK OF FLOORS ===');
{
  fresh();
  // Every node has to sit on a floor the page knows about, or it is drawn
  // nowhere and nothing says so.
  const known = new Set(X.MAP_FLOORS.map(f=>f.n));
  const orphan = X.MAP_NODES.filter(n=>!known.has(n.floor)).map(n=>n.id);
  ok(orphan.length === 0, 'every place on the map is on a real floor',
     orphan.join(','));
  // and every AREA has a node, or you can walk somewhere the map cannot show
  const mapped = new Set(X.MAP_NODES.map(n=>n.id));
  const unmapped = Object.keys(X.AREAS).filter(id=>!mapped.has(id));
  ok(unmapped.length === 0, 'and every area you can reach is on the map',
     unmapped.join(','));

  ok(X.seenFloors().length === 1, 'you start knowing of one floor',
     X.seenFloors().map(f=>f.n).join(','));
  ok(X.seenFloors()[0].n === 0, 'and it is the surface');
  ok(!X.floorSeen(-1), 'the floor below does not exist yet as far as you know');

  for(const z of ['clearing','gate','cogway','verge','shoals']) go(z);
  ok(X.seenFloors().length === 1,
     'walking the whole surface does not reveal that there IS a floor below',
     X.seenFloors().map(f=>f.n).join(','));

  X.G.locks.elevator = true;
  go('undercroft');
  ok(X.floorSeen(-1), 'riding the lift down does');
  ok(X.seenFloors().length === 2, 'and now the map has two floors');
  ok(X.G.mapFloor === -1, 'and it opens on the one you are standing on',
     String(X.G.mapFloor));

  // a place on a KNOWN floor that you have not reached is still ??? — those
  // are two different kinds of unknown and the page has to say so
  ok(!X.G.visited.glimmervein, 'the cave is on that floor and unvisited');
  const below = X.mapFloorNodes(-1).map(n=>n.id);
  ok(below.indexOf('glimmervein') >= 0, 'but it IS drawn on it', below.join(','));

  // W and S walk the stack and cannot leave it
  X.G.state = X.ST.JOURNAL;
  X.G.codexPage = X.TABS.findIndex(t=>t.id==='map');
  press('w'); ok(X.G.mapFloor === 0,  'W goes up',   String(X.G.mapFloor));
  press('w'); ok(X.G.mapFloor === 0,  'and stops at the top', String(X.G.mapFloor));
  press('s'); ok(X.G.mapFloor === -1, 'S goes down', String(X.G.mapFloor));
  press('s'); ok(X.G.mapFloor === -1, 'and stops at the bottom', String(X.G.mapFloor));
  X.G.state = X.ST.PLAY;

  // every page still renders under strict validation, on every floor
  const {Canvas} = require('./strict.js');
  const cv = new Canvas(480,270), c2 = cv.getContext('2d');
  let threw = null;
  for(const fl of X.MAP_FLOORS){
    X.G.mapFloor = fl.n;
    try { X.drawMapPage(c2); } catch(err){ threw = fl.n+': '+err.message; }
  }
  ok(!threw, 'and every floor draws without throwing', threw||'');
}

console.log(fails ? '\nFAIL ('+fails+')' : '\nPASS');
process.exit(fails ? 1 : 0);
