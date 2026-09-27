
// ============================================================================
// QUESTS
//
// Five postings, all given on the top ring of Ironhaven, and deliberately five
// DIFFERENT SHAPES rather than five instances of one shape with different
// numbers. A quest log where every entry reads "kill 8 of a thing" is a list,
// not a set of reasons to go somewhere.
//
//   bounty    — kill N of one species. The plain one, and it has to exist:
//               it is the shape everything else is measured against.
//   haul      — gather N of one material. Sends you to ONE zone, repeatedly.
//   survey    — one of every material. Sends you to EVERY zone, once. The two
//               together are why materials are zone-exclusive.
//   collector — carry a thing somewhere, plant it, charge it by playing, and
//               carry it home. The only one whose objective is a verb rather
//               than a count.
//   rootcut   — a two-stage: break the sources, then take what grows where
//               they were standing. Stage two does not accept deliveries until
//               stage one is finished, so the order is the point.
//
// A quest's state machine is: undiscovered -> offered -> active -> ready ->
// done. `ready` exists so that finishing the objective and handing it in are
// separate beats; walking back to the person who asked is part of the quest.
// ============================================================================

const QUEST_STATE = { OFFERED:'offered', ACTIVE:'active', READY:'ready', DONE:'done' };

const QUESTS = [
  // --------------------------------------------------------------- BOUNTY
  { id:'hares', giver:'marta', kind:'bounty', title:'Nobody Takes the Quail',
    target:'brasshare', need:8, zone:'verge',
    brief:[
      "Board's been up eleven days and this one's still on it. Brass Hares, the Verge.",
      "They're not dangerous exactly. They're fast, they're low, and they come at your ankles from behind a rock.",
      "Eight of them and the posting comes down. I'd take it myself if I could leave the board."
    ],
    nag:[
      "Still eight? Still some of eight?",
      "They bunch up near the old fence line. That's the tip, and it's free."
    ],
    done:[
      "Eight. Good. I'll pull the posting before somebody's cousin tries it.",
      "Here — Aions, and a spring off one of them that came in with the last lot. Your hatchling might like it."
    ],
    reward:{ marks:120, items:[['trash','spring',3]], part:'coil' } },

  // ----------------------------------------------------------------- HAUL
  { id:'bloom', giver:'vosk', kind:'haul', title:'Light Stuff, and Lots of It',
    mat:'bloomiron', need:10,
    brief:[
      "You're going out anyway. Bring me Bloom Iron — the grey flowers, out in the Verge grass.",
      "Ten of them. Cut low, take the whole head, don't bother with the stalk.",
      "It's the only thing I can't just buy in. It won't travel; it sets hard the second it's off the ground."
    ],
    nag:[
      "Ten. Not eight. Ten.",
      "Low in the grass, out past where the hares are. You'll smell it before you see it."
    ],
    done:[
      "That's the stuff. Look at the grain on it.",
      "Aions, and take the brace plate — I was going to sell it, but you'll get more out of it than my till will."
    ],
    reward:{ marks:160, items:[['trash','plate',2]], aethite:4 } },

  // --------------------------------------------------------------- SURVEY
  { id:'survey', giver:'weal', kind:'survey', title:'One of Each, and Nothing Twice',
    mats:['rustscrap','bloomiron','cragglass','brinesalt','veinshard'],
    brief:[
      "I am writing a book about ground. Everyone finds this funny and everyone is wrong.",
      "One sample from every ground you can reach. Rustfields scrap, Verge bloom, Scarp glass, Shoals salt, and a shard off a living seam in the Glimmervein.",
      "One of each. Not two of anything. The point is the spread, not the weight."
    ],
    nag:[
      "One of EACH. Bringing me six of one does not advance the argument.",
      "The seam shard is the hard one. It is also the one the book is for."
    ],
    done:[
      "All five. On the same day. Do you know how long I have been asking people for this?",
      "Aions — and this. Clouded lens, ground in the Guild Quarter, worth rather more than the errand. Take it before I reconsider."
    ],
    reward:{ marks:240, items:[['trash','lens',2],['mat','veinshard',2]], aethite:6 } },

  // ------------------------------------------------------------ COLLECTOR
  { id:'collector', giver:'ivo', kind:'collector', title:'The Ledger of Small Losses',
    zone:'scarp', zoneName:'The Iron Scarp',
    brief:[
      "Every time a hatchling mends its rider, some of what it spends doesn't go into the rider. It goes into the air.",
      "Nobody has ever measured it because nobody stands still long enough. So: take my collector up to the Scarp and plant it.",
      "Then do what you were going to do anyway. Get hit. Burn Aethite beside it. It drinks the difference. Full mast, bring it back."
    ],
    nag:[
      "It needs you bleeding first and mending second, and it needs you close. That order.",
      "Plant it on open ground. F. Then take a hit, then burn. It'll tell you how it's doing."
    ],
    done:[
      "Full. Actually full. I owe you an apology — I had it at four visits, minimum.",
      "The Guild pays for this one, not me, so it pays properly. And your beast carries more now for having been measured."
    ],
    reward:{ marks:300, aethite:10 } },

  // ------------------------------------------------------------- ROOT CUT
  { id:'rootcut', giver:'halla', kind:'rootcut', title:'Cut It at the Root',
    need:3, mat:'veinshard', matNeed:2,
    brief:[
      "The violet stones come up from the deep cuts and they come up cheap, and I finally know why.",
      "There's something down there pouring little devils out of sockets in the floor. Cutters won't work a seam with those about, so they take what's near the door and run.",
      "Break three of the sockets. Then cut me two shards off a seam with nothing standing over it. I want to see what the stone does when it's left alone."
    ],
    nag:[
      "Sockets first. The stone's no different while they're pouring — that's rather the experiment.",
      "They're the squat iron things with the gem in. Hit the gem."
    ],
    done:[
      "Hm. Hm! Look at the fracture on that. That is not the same stone.",
      "Aions, and keep one of the shards — you earned the pretty one. And take the prong; I've no use for a dragon."
    ],
    reward:{ marks:280, items:[['mat','veinshard',1]], part:'arcprong' } }
];
const QUEST_BY_ID = {}; QUESTS.forEach(q=>QUEST_BY_ID[q.id]=q);
const QUESTS_BY_GIVER = {};
QUESTS.forEach(q=>{ (QUESTS_BY_GIVER[q.giver] = QUESTS_BY_GIVER[q.giver] || []).push(q); });

const TOWER_CHARGE_RANGE = 52;     // how close a burn has to be to register
const TOWER_PER_BURN     = 25;     // percent per qualifying burn

// --- state ------------------------------------------------------------------
function questState(id){
  const q = G.quests[id];
  return q ? q.state : null;
}
function questRec(id){
  if(!G.quests[id]) G.quests[id] = { state:QUEST_STATE.OFFERED, n:0, stage:0 };
  return G.quests[id];
}
function questActive(id){
  const st = questState(id);
  return st===QUEST_STATE.ACTIVE || st===QUEST_STATE.READY;
}
function activeQuests(){
  return QUESTS.filter(q=>{
    const st = questState(q.id);
    return st && st!==QUEST_STATE.DONE;
  });
}

// What the log line for a quest should say right now. One function, because
// the journal page and the toast that fires on progress must never disagree
// about how far along you are.
function questProgress(q){
  const r = G.quests[q.id];
  if(!r) return { text:'', done:false };
  switch(q.kind){
    case 'bounty':
      return { text:r.n+' / '+q.need+' '+ENEMY_TYPES[q.target].name,
               done:r.n>=q.need };
    case 'haul': {
      const have = countItem('mat', q.mat);
      return { text:Math.min(have,q.need)+' / '+q.need+' '+MAT_BY_ID[q.mat].name,
               done:have>=q.need };
    }
    case 'survey': {
      const got = q.mats.filter(m=>countItem('mat',m)>0);
      return { text:got.length+' / '+q.mats.length+' grounds sampled',
               done:got.length===q.mats.length };
    }
    case 'collector': {
      const t = G.towers[q.zone];
      if(!t)            return { text:'not yet planted in '+q.zoneName, done:false };
      if(!t.collected)  return { text:Math.round(t.charge)+'% charged', done:false };
      return { text:'full — take it back to Ivo', done:true };
    }
    case 'rootcut': {
      if(r.n < q.need)
        return { text:r.n+' / '+q.need+' pylons broken', done:false };
      const have = r.cutAfter|0;
      return { text:Math.min(have,q.matNeed)+' / '+q.matNeed+' shards from a quiet seam',
               done:have>=q.matNeed };
    }
  }
  return { text:'', done:false };
}

// Re-check whether a quest's objective is met. Called after anything that
// could possibly have moved one along — cheap, and far safer than trying to
// enumerate which events can affect which quest.
function questRefresh(){
  for(const q of QUESTS){
    const r = G.quests[q.id];
    if(!r || r.state===QUEST_STATE.DONE || r.state===QUEST_STATE.OFFERED) continue;
    const p = questProgress(q);
    const was = r.state;
    r.state = p.done ? QUEST_STATE.READY : QUEST_STATE.ACTIVE;
    if(r.state===QUEST_STATE.READY && was!==QUEST_STATE.READY){
      toast('QUEST READY — '+q.title.toUpperCase());
      Sfx.quest();
    }
  }
}

// --- progress hooks ---------------------------------------------------------
function questKilled(kind){
  for(const q of QUESTS){
    if(!questActive(q.id)) continue;
    const r = G.quests[q.id];
    if(q.kind==='bounty' && kind===q.target && r.n < q.need){
      r.n++;
      floatText(player.x, player.y-34, q.title.split(' ')[0].toUpperCase()+' '+r.n+'/'+q.need,
                C.amber4, r.n>=q.need);
      if(r.n < q.need) Sfx.pickup();
    }
    if(q.kind==='rootcut' && kind==='pylon' && r.n < q.need){
      r.n++;
      toast('SOCKET BROKEN — '+r.n+' / '+q.need);
      Sfx.pickup();
    }
  }
  questRefresh();
}

function questGathered(matId, n){
  for(const q of QUESTS){
    if(!questActive(q.id)) continue;
    const r = G.quests[q.id];
    // The root-cut's second stage counts only what you cut AFTER the sockets
    // are broken. Counting the bag instead would let you bring shards you
    // already had, which is the one thing the person asking has ruled out.
    if(q.kind==='rootcut' && matId===q.mat && r.n>=q.need && !anyPylonStanding())
      r.cutAfter = (r.cutAfter|0) + n;
  }
  questRefresh();
}

function anyPylonStanding(){
  return G.enemies.some(e=>!e.dead && e.kind==='pylon');
}

// --- the collector ----------------------------------------------------------
// Planted with F on open ground in the right zone; charged by being hurt and
// then mending yourself beside it; collected with F once it is full.
function towerHere(){
  const q = QUEST_BY_ID.collector;
  if(!questActive(q.id)) return false;
  const t = G.towers[q.zone];

  if(t && G.areaId===q.zone && dist(player.x,player.y,t.x,t.y) < 30){
    if(t.charge >= 100 && !t.collected){
      t.collected = true;
      toast('COLLECTOR FULL — TAKE IT TO DEEP-MARSHAL IVO');
      for(let i=0;i<26;i++) spark(t.x, t.y-10, C.aether4, 1.5);
      Sfx.quest();
      questRefresh();
      return true;
    }
    startDialogue('Aethite Collector', [
      t.collected ? 'Capped and quiet. Ivo is waiting for it.'
                  : 'The mast is at '+Math.round(t.charge)+'%. It wants residue, not Aethite — '+
                    'take a hit, then burn beside it.'
    ]);
    return true;
  }
  if(t) return false;

  // not planted yet
  if(G.areaId!==q.zone) return false;
  if(!canStand(player.x, player.y+18)) return false;
  G.towers[q.zone] = { x:player.x, y:player.y+14, charge:0, collected:false, t:0 };
  toast('COLLECTOR PLANTED — GET HIT, THEN BURN BESIDE IT');
  for(let i=0;i<20;i++) spark(player.x, player.y, C.aether4, 1.3);
  Sfx.learn();
  questRefresh();
  return true;
}

// Called by toggleBurn when a burn STARTS. The tower wants the residue of a
// mend, so it only counts if there was damage to mend — `residueT` is set when
// you are hit and runs out, which is what stops you charging it by standing in
// an empty field burning off a full store.
function towerBurn(){
  const q = QUEST_BY_ID.collector;
  if(!questActive(q.id)) return;
  const t = G.towers[q.zone];
  if(!t || G.areaId!==q.zone || t.collected) return;
  if(dist(player.x,player.y,t.x,t.y) > TOWER_CHARGE_RANGE){
    floatText(t.x, t.y-26, 'TOO FAR', C.ui2);
    return;
  }
  if(!(player.residueT > 0)){
    floatText(t.x, t.y-26, 'NO RESIDUE — TAKE A HIT FIRST', C.ui2);
    return;
  }
  player.residueT = 0;
  t.charge = Math.min(100, t.charge + TOWER_PER_BURN);
  t.t = 1.2;
  floatText(t.x, t.y-30, '+'+TOWER_PER_BURN+'%  ('+Math.round(t.charge)+'%)', C.aether4, true);
  for(let i=0;i<18;i++) spark(t.x, t.y-8, C.aether4, 1.4);
  Sfx.learn();
  if(t.charge>=100) toast('COLLECTOR FULL — PRESS F TO TAKE IT');
  questRefresh();
}

function updateTowers(dt){
  for(const id in G.towers){
    const t = G.towers[id];
    if(t.t>0) t.t -= dt;
  }
  for(const p of PLAYERS) if(p.residueT > 0) p.residueT -= dt;
}

function drawTower(c){
  const q = QUEST_BY_ID.collector;
  const t = G.towers[q.zone];
  if(!t || G.areaId!==q.zone) return;
  const X = Math.round(t.x), Y = Math.round(t.y);
  const pct = t.charge/100;
  px(c, C.shadowHard, X-7, Y-2, 14, 3);
  px(c, '#2a2438', X-6, Y-6, 12, 6);              // foot
  px(c, C.iron4,   X-5, Y-7, 10, 4);
  px(c, '#1a1620', X-2, Y-30, 4, 24);             // mast
  px(c, C.iron4,   X-2, Y-30, 2, 24);
  // the phial, filling from the bottom
  px(c, '#120f18', X-4, Y-28, 8, 18);
  const h = Math.max(0, Math.round(16*pct));
  if(h){
    px(c, C.aether2, X-3, Y-11-h, 6, h);
    px(c, C.aether4, X-3, Y-11-h, 6, Math.min(2,h));
  }
  px(c, C.brass4,  X-4, Y-29, 8, 2);
  px(c, C.brass4,  X-4, Y-11, 8, 2);
  // three vanes that spin faster the fuller it is
  const ph = G.time*(1.4+pct*4) ;
  for(let k=0;k<3;k++){
    const a = ph + k*Math.PI*2/3;
    px(c, C.iron5, X+Math.round(Math.cos(a)*6)-1, Y-34+Math.round(Math.sin(a)*2), 2, 2);
  }
  if(t.t>0 || t.charge>=100){
    c.globalAlpha = t.charge>=100 ? 0.22+0.10*Math.sin(G.time*4) : 0.28*t.t;
    c.fillStyle = C.aether4;
    c.beginPath(); c.arc(X, Y-18, 26, 0, Math.PI*2); c.fill();
    c.globalAlpha = 1;
  }
  if(t.collected) text(c,'CAPPED', X, Y-42, C.aether4, 7, 'center');
  else text(c, Math.round(t.charge)+'%', X, Y-42, pct>=1?C.aether4:C.ui2, 7, 'center');
}

// --- talking to a giver -----------------------------------------------------
// Returns true if the NPC had quest business, so the ordinary small talk in
// interact() only runs when they didn't.
function talkQuest(npc){
  const mine = QUESTS_BY_GIVER[npc.id];
  if(!mine) return false;

  // hand in anything that is ready before offering anything new — walking up
  // with a finished job and being offered a second one first is maddening
  for(const q of mine){
    if(questState(q.id)!==QUEST_STATE.READY) continue;
    finishQuest(q);
    return true;
  }
  for(const q of mine){
    const st = questState(q.id);
    if(!st){
      questRec(q.id);
      G.quests[q.id].state = QUEST_STATE.ACTIVE;
      startDialogue(npc.name, q.brief.concat(['[ ACCEPTED — '+q.title.toUpperCase()+' ]']));
      Sfx.quest();
      questRefresh();
      return true;
    }
    if(st===QUEST_STATE.ACTIVE){
      const p = questProgress(q);
      startDialogue(npc.name, q.nag.concat([p.text.toUpperCase()]));
      return true;
    }
  }
  return false;                       // all done; let them make small talk
}

function finishQuest(q){
  const r = questRec(q.id);
  const rw = q.reward || {};
  const lines = q.done.slice();

  // take the goods back off you where the job was to deliver goods
  if(q.kind==='haul')   takeItems('mat', q.mat, q.need);
  if(q.kind==='survey') for(const m of q.mats) takeItems('mat', m, 1);
  if(q.kind==='rootcut') takeItems('mat', q.mat, q.matNeed);
  if(q.kind==='collector'){
    delete G.towers[q.zone];
    lines.push('[ COLLECTOR RETURNED ]');
  }

  if(rw.marks){ G.marks += rw.marks; lines.push('[ +'+rw.marks+' AIONS ]'); }
  for(const [kind,id,n] of (rw.items||[])){
    addItem(kind, id, n);
    const d = kind==='mat' ? MAT_BY_ID[id] : kind==='part' ? PARTS_BY_ID[id] : TRASH_BY_ID[id];
    lines.push('[ +'+n+' '+d.name.toUpperCase()+' ]');
  }
  if(rw.part){
    addItem('part', rw.part);
    lines.push('[ +'+PARTS_BY_ID[rw.part].name.toUpperCase()+' — FITS YOUR DRAGON ]');
  }
  if(rw.aethite){
    grantQuestAethite(q.id, rw.aethite);
    lines.push('[ AETHITE STORE +'+rw.aethite+' ]');
  }
  // Quests are the other half of the levelling ladder. A job is worth a good
  // few creatures, because the point of taking one is that it is worth more
  // than the time spent grinding instead.
  const xp = rw.xp || 12;
  if(PLAYERS.length) eachPlayer(()=>{ gainBond(xp); gainXp(xp); });
  else { gainBond(xp); gainXp(xp); }
  lines.push('[ +'+xp+' EXPERIENCE  \u00b7  +'+xp+' BOND ]');

  r.state = QUEST_STATE.DONE;
  startDialogue(QUEST_GIVER_NAME[q.giver] || 'Ironhaven', lines);
  Sfx.quest();
  questRefresh();
}

// Quest capacity is granted through the same milestone ledger the rest of the
// game uses, so it cannot be claimed twice and shows up in the same place.
function grantQuestAethite(id, n){
  G.milestones['quest:'+id] = true;
  for(const p of PLAYERS){
    p.aethiteMax = (p.aethiteMax|0) + n;
    p.aethite = Math.min(p.aethiteMax, p.aethite + n);
  }
}

const QUEST_GIVER_NAME = {
  marta:'Marta Quill', vosk:'Vosk', weal:'Archivist Weal',
  ivo:'Deep-Marshal Ivo', halla:'Halla Pike'
};
