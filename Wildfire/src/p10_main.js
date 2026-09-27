
// ============================================================================
// AREA LOADING
// ============================================================================
function loadArea(id, tx, ty){
  const a = AREAS[id];
  G.area = a; G.areaId = id;
  // The map draws from this. A floor nobody has set foot on is not on the map
  // at all, so "have I been here" has to be recorded somewhere that survives
  // leaving — the area objects themselves are rebuilt and shared.
  G.visited[id] = true;
  Music.play(Music.forArea(id));
  // and the map follows you down, so opening it after the lift shows the
  // floor you are on rather than the one you left
  {
    const mn = (typeof MAP_BY_ID!=='undefined') && MAP_BY_ID[id];
    if(mn) G.mapFloor = mn.floor;
  }
  // Sized in DEVICE pixels, then scaled so the tile painters keep working in
  // world units. Assigning .width is what clears the buffer, and it also wipes
  // the transform, so artScale has to come after it every time.
  terrainCv.width = a.w*TILE*ART;  terrainCv.height = a.h*TILE*ART;
  overCv.width    = a.w*TILE*ART;  overCv.height    = a.h*TILE*ART;
  artScale(tctx); artScale(octx);

  // EVERY player arrives, not just whichever one the cursor happens to be on.
  //
  // This is the single worst bug two-player produced. Moving only the current
  // player left the other one at their previous coordinates — or at 0,0 on the
  // first load — which meant they were off in a corner of the map where you
  // could not see them, AND the tether instantly failed for every direction,
  // so the player who DID arrive correctly could not move at all. Two
  // completely different-looking symptoms, one line of code.
  const arriving = PLAYERS.length ? PLAYERS : [player];
  arriving.forEach((p,i)=>{
    // fan them out a little so nobody spawns exactly on top of anyone else,
    // and pull back toward the door if that puts someone inside a wall
    let px = tx + (i ? 14 : -2), py = ty + (i ? 6 : 0);
    if(!canStandAt(a, px, py)){ px = tx; py = ty; }
    p.x = px; p.y = py;
    p.dx = 0; p.dy = 1; p.inx = 0; p.iny = 1;
    if(p.dragon){ p.dragon.x = px+16; p.dragon.y = py-14; }
  });
  if(!PLAYERS.length){ dragon.x = tx+16; dragon.y = ty-14; }
  G.particles.length=0; G.floats.length=0; G.hitmarks.length=0;
  G.shots = [];
  G.target = null; G.targetT = 0; G.walls.length = 0;
  populateArea(a);
  spawnNPCs(id);
  refillInTown();
  openSeals && Object.keys(G.locks).forEach(openSeals);   // stay open on re-entry
  { const t=camTarget(); G.cam.x=t.x; G.cam.y=t.y; }   // snap, don't ease, on load
  G.areaNameT = 2.6;
  renderStaticLayers();
}

// Terrain and overlay are static per area, so they're rendered once.
// Anything animated (water shimmer, hearth fire, lamp glow) is re-stamped
// each frame in drawAnimatedTiles().
function renderStaticLayers(){
  const a=G.area;
  tctx.clearRect(0,0,a.w*TILE,a.h*TILE);
  octx.clearRect(0,0,a.w*TILE,a.h*TILE);
  for(let y=0;y<a.h;y++) for(let x=0;x<a.w;x++) drawGround(tctx,a,x,y);
  for(let y=0;y<a.h;y++) for(let x=0;x<a.w;x++) drawGroundEdges(tctx,a,x,y);
  // The crater and the city mass around it are single radial passes rather
  // than per-tile art, so they go down after the ground and before the props.
  if(a.pit){ drawOuterRing(tctx,a.pit); drawPit(tctx,a.pit); }
  for(const b of a.buildings) drawBuilding(tctx,b);
  for(let y=0;y<a.h;y++) for(let x=0;x<a.w;x++) drawPropBase(tctx,a,x,y);
  // Tiles whose overlay moves are skipped here and redrawn live each frame;
  // baking them would freeze a flame mid-flicker into the terrain buffer.
  for(let y=0;y<a.h;y++) for(let x=0;x<a.w;x++){
    const t=a.map[y*a.w+x];
    if(t===T.BRAZIER||t===T.VENT||t===T.SEAL||t===T.LIFTCAGE) continue;
    drawPropOver(octx,a,x,y);
  }
}

// tiles that must animate get redrawn straight to the screen each frame
function drawAnimatedTiles(c){
  const a=G.area;
  const x0=Math.max(0,Math.floor(G.cam.x/TILE)-1), x1=Math.min(a.w,Math.ceil((G.cam.x+VW)/TILE)+1);
  const y0=Math.max(0,Math.floor(G.cam.y/TILE)-1), y1=Math.min(a.h,Math.ceil((G.cam.y+VH)/TILE)+2);
  for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++){
    const t=a.map[y*a.w+x];
    if(t===T.WATER||t===T.SHALLOW||t===T.HEARTH||t===T.SEAL) drawGround(c,a,x,y);
    if(t===T.SEAL) drawPropBase(c,a,x,y);
    if(t===T.HEARTH) drawPropBase(c,a,x,y);
  }
}

// Who leads. With two players the door answers to P1 and nobody else: two
// people standing on two different exits would otherwise race, and whichever
// one the loop reached first would decide where they both ended up.
function checkExits(){
  if(twoPlayer() && PC!==0) return withPlayer(PLAYERS[0], checkExits);
  const a=G.area;
  const cx=Math.floor(player.x/TILE), cy=Math.floor(player.y/TILE);
  for(const ex of a.exits){
    // tile match, or close enough to the doorway's centre to count
    const near = dist(player.x, player.y, ex.x*TILE+8, ex.y*TILE+8) < 10;
    if((ex.x===cx && ex.y===cy) || near){
      if(ex.lock && !G.locks[ex.lock]) return;      // still sealed
      const to=ex.to, tx=ex.tx, ty=ex.ty;
      Sfx.door();
      fadeTo(()=>loadArea(to,tx,ty));
      return;
    }
  }
}

// Is the player standing at an unopened Aethite lock? Returns true if the
// press was consumed, so F at a sealed gate addresses the gate rather than
// falling through to whoever happens to be standing nearby.
function tryLockHere(){
  if(G.channel) return true;
  const a = G.area;
  if(a.doorSeal){
    // The Undercroft's far door is not an Aethite lock — there is nothing
    // behind it yet, and offering to channel into it would promise a zone
    // that does not exist.
    for(let y=0;y<a.h;y++) for(let x=0;x<a.w;x++){
      if(a.map[y*a.w+x]!==T.SEAL) continue;
      if(dist(player.x,player.y,x*TILE+8,y*TILE+8) > 26) continue;
      startDialogue('The Sealed Door', [
        'The seal is cold. Not dormant — refusing.',
        'It does not want store, or rank, or a name. It simply has not been asked by the right thing yet.',
        'The way down is not open.'
      ]);
      return true;
    }
  }
  if(!a.seals) return false;
  for(const id in a.seals){
    if(G.locks[id]) continue;
    for(const [tx,ty] of a.seals[id]){
      if(dist(player.x, player.y, tx*TILE+8, ty*TILE+8) > 26) continue;
      channelInto(id);
      return true;
    }
  }
  return false;
}

// Standing on the lift deck? Power it if it isn't powered, ride it if it is.
function tryLift(){
  const a = G.area;
  if(!a.lift) return false;
  const near = a.lift.some(([x,y]) => dist(player.x,player.y, x*TILE+8, y*TILE+8) < 14);
  if(!near) return false;

  if(G.areaId==='undercroft'){
    rideLift('cogway', -1);
    return true;
  }
  if(!G.locks.elevator){
    channelInto('elevator', ()=>{ toast('THE CHAIN TAKES UP — F TO RIDE'); });
    return true;
  }
  rideLift('undercroft', 1);
  return true;
}

// The descent. Nothing about this is interactive — it is four seconds of
// falling, and the point of it is to make the crater feel deep by spending
// real time on the way down rather than cutting straight there.
function rideLift(to, dir){
  if(G.liftRide) return;
  const dest = to==='undercroft'
    ? { x:AREAS.undercroft.playerStart.x, y:AREAS.undercroft.playerStart.y }
    : (()=>{ const p = AREAS.cogway.lift[4]; return { x:p[0]*TILE+8, y:p[1]*TILE+8 }; })();
  G.liftRide = { t:0, dur:3.4, dir, to, dest, done:false };
  Sfx.door();
  toast(dir>0 ? 'DESCENDING' : 'ASCENDING');
}

function updateLift(dt){
  const r = G.liftRide; if(!r) return;
  r.t += dt;
  // the cage shudders, and dust falls past you the whole way
  G.shake = Math.max(G.shake, r.t<0.4 ? 5 : 1.6);
  if(Math.random() < dt*30)
    G.particles.push({ x:player.x+(Math.random()-0.5)*40, y:player.y-40-Math.random()*30,
                       vx:0, vy:(r.dir>0?150:-150)+Math.random()*60,
                       life:0.5, max:0.5, kind:'mote', col:'#6a6458', s:1 });
  if(!r.done && r.t > r.dur*0.5){
    r.done = true;
    fadeTo(()=>loadArea(r.to, r.dest.x, r.dest.y));
  }
  if(r.t >= r.dur){
    G.liftRide = null;
    if(r.to==='undercroft')
      startDialogue('The Undercroft', [
        'The cage settles. Somewhere below, water is moving.',
        'The landing is lit and swept and entirely empty, and the door at the far end has a seal on it older than the one upstairs.',
        'Whatever the next ring of Ironhaven is, it is not open yet.'
      ]);
  }
}

// ---------------------------------------------------------------------------
// 777
//
// A test switch, not a secret: 999 of store and a bond of 99, so a late-game
// lock or a high-bond ability can be reached without playing to it first.
// Typed on the options page, where nothing else reads digits, and it says
// loudly on the page that it is on — a cheat you can leave on by accident and
// then wonder why the balance feels wrong is worse than no cheat.
// ---------------------------------------------------------------------------
const GOD_CODE = '777';
function godKey(k){
  if('0123456789'.indexOf(k) < 0 || k.length !== 1){ G.godBuf = ''; return false; }
  G.godBuf = ((G.godBuf||'') + k).slice(-GOD_CODE.length);
  if(G.godBuf !== GOD_CODE) return true;     // digits are ours either way
  G.godBuf = '';
  G.godMode = true;
  for(const p of (PLAYERS.length ? PLAYERS : [player])){
    p.aethiteMax = 999;
    p.aethite    = 999;
    if(p.dragon){ p.dragon.bond = 99; p.dragon.bondXp = 0; }
  }
  toast('GOD MODE \u2014 999 AETHITE, BOND 99');
  Sfx.quest();
  return true;
}

// ============================================================================
// REBINDING
//
// Opened from the options page, at the title or in the TAB menu. It is modal
// at BOTH entry points (see the guard at the top of handleKey), which is the
// only way TAB and ESC can be bound at all: a guard inside the options page
// cannot stop TAB from closing the menu, and TAB is exactly what somebody
// will try to rebind first.
// ============================================================================
function remapKey(k){
  const R = G.remap;
  if(R.capturing){
    if(k==='escape'){ R.capturing=false; R.msg=''; Sfx.ui(); return; }
    const b = BINDINGS[R.sel];
    const res = bindApply(R.player|0, b.id, k);
    if(res==='clash'){
      R.msg = keyName(k)+' IS PLAYER '+(2-(R.player|0))+"'S KEY";
      R.msgCol = '#ff6a5a'; Sfx.ui(); return;                 // stays capturing
    }
    R.capturing = false;
    if(res==='ok'){ R.msg = b.label+'  \u2192  '+keyName(k); R.msgCol = '#7ddc6a'; }
    else { R.msg = 'SWAPPED WITH '+res; R.msgCol = C.amber4; }
    Sfx.confirm();
    return;
  }
  const N = BINDINGS.length, PERCOL = Math.ceil(N/2);
  if(k==='w'||k==='arrowup'){   R.sel=(R.sel+N-1)%N; R.msg=''; Sfx.ui(); return; }
  if(k==='s'||k==='arrowdown'){ R.sel=(R.sel+1)%N;   R.msg=''; Sfx.ui(); return; }
  if(k==='a'||k==='arrowleft'||k==='d'||k==='arrowright'){
    // One column each way would be the obvious reading of A/D here, but with
    // two players there are two whole maps to edit and no other free pair of
    // keys to reach the second one with. W/S already walks both columns.
    R.player = 1-(R.player|0); R.msg=''; Sfx.ui(); return;
  }
  if(k==='enter'||k===' '){ R.capturing=true; R.msg=''; Sfx.ui(); return; }
  if(k==='backspace'){ bindReset(R.player|0); R.msg='DEFAULTS RESTORED'; R.msgCol=C.amber4; Sfx.confirm(); return; }
  if(k==='tab'||k==='escape'||k==='p'){ G.remap=null; Sfx.ui(); return; }
}

// Shared by the title screen and the TAB page so the mockup behaves the same
// in both places.
function optionsKey(k){
  if(godKey(k)) return;
  const N = OPTION_ROWS.length;
  if(k==='w'||k==='arrowup')   { G.optSel=(G.optSel+N-1)%N; Sfx.ui(); return; }
  if(k==='s'||k==='arrowdown') { G.optSel=(G.optSel+1)%N;   Sfx.ui(); return; }
  const row = OPTION_ROWS[G.optSel];
  if(row.kind==='input'){
    const D = INPUT_DEVICES.length;
    if(k==='a'||k==='arrowleft'){  G.inputP1=(G.inputP1+D-1)%D; Sfx.ui(); }
    if(k==='d'||k==='arrowright'){ G.inputP1=(G.inputP1+1)%D;   Sfx.ui(); }
  } else if(row.kind==='remap'){
    if(k==='enter'||k===' '||k==='d'||k==='arrowright'){
      G.remap = { player:0, sel:0, capturing:false, msg:'', msgCol:null };
      Sfx.ui();
    }
  } else if(row.kind==='easy'){
    if(k==='a'||k==='arrowleft'||k==='d'||k==='arrowright'||k==='enter'||k===' '){
      G.easyAttack = !G.easyAttack;
      toast('EASY ATTACKS '+(G.easyAttack?'ON':'OFF'));
      Sfx.ui();
    }
  }
}

// ============================================================================
// DOWNED AND REVIVAL
//
// At zero health a player goes down rather than ending the run. Their partner
// brings them back by standing close — no button, just presence, because in a
// fight you want the mechanic to be "get to them", not "get to them and then
// find the right key".
// ============================================================================
const REVIVE_RANGE = 26, REVIVE_TIME = 2.2;

function downPlayer(p){
  if(p.down) return;
  p.down = true; p.downT = 0; p.reviveT = 0; p.hp = 0;
  player.burning = false;
  toast(p.col.id+' IS DOWN');
  Sfx.die();
}

function updateRevive(dt){
  if(!PLAYERS.length) return;
  const up = PLAYERS.filter(p=>!p.down);
  // everyone down is a wipe; with one player that is just the old death
  if(!up.length){ G.state = ST.DEAD; return; }

  for(const p of PLAYERS){
    if(!p.down) continue;
    p.downT += dt;
    const helper = up.find(q => dist(q.x,q.y,p.x,p.y) < REVIVE_RANGE);
    if(helper){
      p.reviveT += dt;
      if(Math.random() < dt*26)
        G.particles.push({ x:p.x+(Math.random()-0.5)*14, y:p.y-2,
          vx:0, vy:-26, life:0.5, max:0.6, kind:'steam', col:'#8af0e4', s:1 });
      if(p.reviveT >= REVIVE_TIME){
        p.down = false; p.reviveT = 0;
        p.hp = Math.max(1, Math.round(p.maxhp*0.4));
        p.iframe = 1.4;
        toast(p.col.id+' IS BACK UP');
        for(let i=0;i<24;i++) spark(p.x, p.y-8, '#8af0e4', 1.4);
        Sfx.quest();
      }
    } else {
      p.reviveT = Math.max(0, p.reviveT - dt*0.6);   // progress decays, slowly
    }
  }
}

// Open the tab menu on behalf of a player.
function openMenu(who){
  G.menuOwner = PLAYERS.length>who ? who : 0;
  G.state = ST.JOURNAL;
  Sfx.ui();
}
// Menu input always runs with the cursor on the menu's owner, so every page
// reads and writes that player's own state.
function menuKey(k){
  const owner = PLAYERS[G.menuOwner|0] || player;
  withPlayer(owner, ()=>menuKeyInner(k));
}

// The menu's own key handling, always invoked with the cursor on the menu
// owner (see menuKey).
function menuKeyInner(k){

      // Close on escape, or on whichever key opened it. P2 should not be
      // able to shut P1 out of their own menu, and vice versa.
      // ---- ASSIGNING AN ABILITY IS MODAL
      //
      // ENTER on a creature in the codex starts it and the next arrow chooses
      // the slot. While it is running this swallows EVERY key — including the
      // one that closes the menu and the ones that cycle tabs. It has to sit
      // above both of those: with the guard inside the codex page's own
      // handler, TAB closed the menu with the prompt still on screen, and the
      // direction you pressed next went to the world and made you dodge.
      if(G.assignFrom){
        const aslot = k==='arrowleft' ? 1 : k==='arrowdown' ? 2 : k==='arrowright' ? 3 : -1;
        if(aslot>0){
          G.codexSel = CODEX_ORDER.indexOf(G.assignFrom);
          equipFromCodex(aslot);
          G.assignFrom = null;
          return;
        }
        if(k==='escape' || k==='enter' || k==='backspace'){
          G.assignFrom = null; Sfx.ui();
        }
        return;
      }

      // In one-player both keys open the same menu, so either one shuts it.
      const mine = twoPlayer() ? (G.menuOwner ? 'p' : 'tab') : (k==='p' ? 'p' : 'tab');
      if(k==='escape' || k===mine){
        G.assignFrom = null;
        G.state=ST.PLAY; Sfx.ui(); return;
      }
      // Q/E cycle tabs. Every page below wants WASD and the arrows for its own
      // navigation, so the strip gets its own pair of keys rather than
      // fighting the page it contains.
      if(k==='q'){ G.codexPage=(G.codexPage+TABS.length-1)%TABS.length; Sfx.ui(); return; }
      if(k==='e'){ G.codexPage=(G.codexPage+1)%TABS.length; Sfx.ui(); return; }

      switch(TABS[G.codexPage].id){
        case 'codex': {
          const N = CODEX_ORDER.length, COLS = CODEX_COLS;

          if(k==='a'||k==='arrowleft'){ G.codexSel=Math.max(0,G.codexSel-1); Sfx.ui(); return; }
          if(k==='d'||k==='arrowright'){ G.codexSel=Math.min(N-1,G.codexSel+1); Sfx.ui(); return; }
          if(k==='w'||k==='arrowup'){ G.codexSel=Math.max(0,G.codexSel-COLS); Sfx.ui(); return; }
          if(k==='s'||k==='arrowdown'){ G.codexSel=Math.min(N-1,G.codexSel+COLS); Sfx.ui(); return; }
          if(k==='enter'||k===' '){
            const kind = CODEX_ORDER[G.codexSel];
            if(cls.id!=='savant'){ toast('SAVANT ONLY'); Sfx.ui(); return; }
            if(!codexLearned(kind)){ toast('NOT LEARNED — SCAN A LIVE ONE'); Sfx.ui(); return; }
            G.assignFrom = kind;
            Sfx.confirm();
            return;
          }
          return;
        }
        case 'dragon': {
          if(k==='a'||k==='arrowleft'){  G.dragSel=(G.dragSel+2)%3; Sfx.ui(); return; }
          if(k==='d'||k==='arrowright'){ G.dragSel=(G.dragSel+1)%3; Sfx.ui(); return; }
          if(k==='x'||k==='backspace'){  unfitPart(SLOTS[G.dragSel|0]); return; }
          const n = '1234'.indexOf(k);
          if(n>=0){
            const slot = SLOTS[G.dragSel|0];
            const owned = G.inv.filter(i=>i.kind==='part' && PARTS_BY_ID[i.id].slot===slot);
            if(owned[n]) fitPart(owned[n].id); else Sfx.ui();
          }
          return;
        }
        case 'inventory': {
          const N = G.inv.length;
          if(!N) return;
          if(k==='w'||k==='arrowup')   { G.invSel=(G.invSel+N-1)%N; Sfx.ui(); return; }
          if(k==='s'||k==='arrowdown') { G.invSel=(G.invSel+1)%N;   Sfx.ui(); return; }
          if(k==='enter'||k==='f'){
            const it = G.inv[Math.min(G.invSel,N-1)];
            if(it && it.kind==='part') fitPart(it.id); else Sfx.ui();
            G.invSel = Math.min(G.invSel, Math.max(0,G.inv.length-1));
          }
          return;
        }
        case 'map': {
          // W and S walk the stack of floors. Only the ones you have been to
          // are in the list, so this can never land on a floor the page
          // would refuse to draw.
          const open = seenFloors();
          if(open.length < 2) return;
          let i = open.findIndex(f=>f.n===G.mapFloor);
          if(i < 0) i = 0;
          if(k==='w'||k==='arrowup'){   G.mapFloor = open[Math.max(0,i-1)].n; Sfx.ui(); return; }
          if(k==='s'||k==='arrowdown'){ G.mapFloor = open[Math.min(open.length-1,i+1)].n; Sfx.ui(); return; }
          return;
        }
        case 'quests': {
          const open = QUESTS.filter(q=>questState(q.id) && questState(q.id)!==QUEST_STATE.DONE);
          if(!open.length) return;
          if(k==='w'||k==='arrowup')  { G.questSel=(G.questSel+open.length-1)%open.length; Sfx.ui(); return; }
          if(k==='s'||k==='arrowdown'){ G.questSel=(G.questSel+1)%open.length; Sfx.ui(); return; }
          return;
        }
        case 'options': optionsKey(k); return;
        default: return;                       // the journal is read-only
      }
}

function interact(){
  // An Aethite lock you're standing at takes priority over anything else:
  // walking up to a sealed gate and pressing F should try the gate.
  if(tryLockHere()) return;
  if(tryLift()) return;
  if(towerHere()) return;
  if(harvestHere()) return;
  const n = nearestNPC();
  if(n){
    // Anyone carrying their own lines speaks them. Only the quest-givers need
    // bespoke handlers, and a city of a dozen people shouldn't need twelve.
    // Quest business comes before small talk: walking up to someone holding
    // a finished job and getting a line about the weather is maddening.
    if(talkQuest(n)) return;
    if(n.id==='hayla') talkToHayla();
    // Lines may be a function, so an NPC can answer differently depending on
    // what the world looks like — the gate warden says something else once
    // your store is big enough, and again once the seal is down.
    else if(n.lines){
      const lines = (typeof n.lines==='function' ? n.lines() : n.lines).slice();
      // A trader clears your salvage as part of the conversation.
      if(n.buys){
        const v = trashValue();
        if(v>0){
          sellAllTrash();
          lines.push('Let\u2019s see what you\u2019re carrying. Scrap, scrap, more scrap \u2014 '+v+
                     ' Aions, and I\u2019m being generous.');
        } else {
          lines.push('Bring me salvage and I\u2019ll weigh it. Right now you\u2019re carrying nothing I want.');
        }
      }
      startDialogue(n.name, lines);
    }
    else talkToGuard(n);
    return;
  }
  // step through a door you're standing on
  checkExits();
}

// ============================================================================
// EFFECT RENDERING
// ============================================================================
function drawHitmarks(c){
  for(const h of G.hitmarks){
    const t=1-h.life/h.max;
    switch(h.kind){
      case 'slash': {
        const sweep=h.ang-h.arc/2+h.arc*t;
        c.strokeStyle=h.col||'#efe6d8'; c.lineWidth=h.heavy?3:2;
        c.beginPath(); c.arc(h.x,h.y-8,h.range*0.82,sweep-0.5,sweep+0.5); c.stroke();
        break;
      }
      case 'cleave': {
        c.strokeStyle=h.col||C.amber3; c.lineWidth=h.emp?4:3; c.globalAlpha=1-t;
        c.beginPath(); c.arc(h.x,h.y-8,h.range*(0.6+t*0.5),h.ang-h.arc/2,h.ang+h.arc/2); c.stroke();
        c.globalAlpha=1; break;
      }
      case 'quake': {
        const reach=h.len*t, ca=Math.cos(h.ang), sa=Math.sin(h.ang);
        for(let d=0;d<reach;d+=5){
          const w=5+d*0.14;
          c.fillStyle = d>reach-14 ? C.amber3 : 'rgba(150,110,60,'+(0.5*(1-t))+')';
          c.fillRect(Math.round(h.x+ca*d-w/2), Math.round(h.y+sa*d-6), Math.round(w), 4);
        }
        break;
      }
      case 'burst': {
        c.strokeStyle=h.col||C.amber3; c.lineWidth=2; c.globalAlpha=1-t;
        c.beginPath(); c.arc(h.x,h.y-6,h.r*t,0,Math.PI*2); c.stroke();
        c.globalAlpha=1; break;
      }
      case 'cone': {
        c.globalAlpha=(1-t)*0.75; c.fillStyle=h.col;
        const ca=Math.cos(h.ang), sa=Math.sin(h.ang);
        for(let d=6;d<h.range;d+=4){
          const w=3+d*Math.tan(h.spread)*0.9;
          c.fillRect(Math.round(h.x+ca*d-w/2),Math.round(h.y+sa*d-w/2),Math.round(w),Math.round(w));
        }
        c.globalAlpha=1; break;
      }
      case 'breath': {
        c.globalAlpha=(1-t)*0.8; c.fillStyle=h.col;
        const ca=Math.cos(h.ang), sa=Math.sin(h.ang);
        for(let d=6;d<58;d+=4){
          const w=3+d*0.30;
          c.fillRect(Math.round(h.x+ca*d-w/2),Math.round(h.y+sa*d-w/2),Math.round(w),Math.round(w));
        }
        c.globalAlpha=1; break;
      }
      case 'chain': {
        c.strokeStyle=C.brass5; c.lineWidth=1; c.globalAlpha=1-t;
        c.beginPath(); c.moveTo(h.ax,h.ay);
        for(let i=1;i<=4;i++){
          const q=i/4;
          c.lineTo(lerp(h.ax,h.bx,q)+(Math.random()-0.5)*6, lerp(h.ay,h.by,q)+(Math.random()-0.5)*6);
        }
        c.stroke(); c.globalAlpha=1; break;
      }
      case 'warp': {
        c.strokeStyle=C.aether4; c.lineWidth=2; c.globalAlpha=1-t;
        c.beginPath(); c.moveTo(h.ax,h.ay-8); c.lineTo(h.bx,h.by-8); c.stroke();
        c.globalAlpha=1; break;
      }
      case 'beam': {
        c.globalAlpha=1-t; c.strokeStyle=h.col; c.lineWidth=3;
        c.beginPath(); c.moveTo(h.x,h.y); c.lineTo(h.x+Math.cos(h.ang)*h.len, h.y+Math.sin(h.ang)*h.len);
        c.stroke();
        c.strokeStyle='#ffffff'; c.lineWidth=1; c.stroke();
        c.globalAlpha=1; break;
      }
      case 'strike': {
        c.globalAlpha=1-t; c.fillStyle=C.brass5;
        c.fillRect(h.x-1, h.y-40, 2, 40);
        c.fillStyle=C.amber5; c.fillRect(h.x-4,h.y-3,8,4);
        c.globalAlpha=1; break;
      }
      case 'echo': {
        const col = h.el==='ice'?C.water4 : h.el==='lightning'?C.brass4 : C.amber3;
        c.globalAlpha=0.5*(1-t); c.strokeStyle=col; c.lineWidth=2;
        c.beginPath(); c.arc(h.x,h.y-8,6+16*t,0,Math.PI*2); c.stroke();
        c.globalAlpha=1; break;
      }
      case 'smoke': {
        c.globalAlpha=0.32*(1-t*0.6); c.fillStyle='#4a4258';
        c.beginPath(); c.arc(h.x,h.y-6,h.r,0,Math.PI*2); c.fill();
        c.globalAlpha=1; break;
      }
      case 'roots': {
        c.globalAlpha=1-t;
        for(let k=0;k<7;k++){
          const a=k/7*Math.PI*2;
          c.fillStyle=C.leaf3;
          c.fillRect(h.x+Math.cos(a)*(8+t*10), h.y+Math.sin(a)*(5+t*6), 2, 5);
        }
        c.globalAlpha=1; break;
      }
    }
  }
}

function drawShots(c){
  for(const s of (G.shots||[])){
    const col=shotColor(s.style);
    if(s.style==='bullet'){
      c.fillStyle=col;
      c.fillRect(s.x-2,s.y-1,5,2);
      c.fillStyle='#fff6d0'; c.fillRect(s.x,s.y-1,2,2);
    } else if(s.style==='ice'){
      c.fillStyle=C.water3; c.fillRect(s.x-3,s.y-3,6,6);
      c.fillStyle=col; c.fillRect(s.x-2,s.y-2,4,4);
      c.fillStyle='#ffffff'; c.fillRect(s.x-1,s.y-1,2,2);
    } else {
      c.fillStyle=col; c.fillRect(s.x-3,s.y-3,6,6);
      c.fillStyle='#fff6d0'; c.fillRect(s.x-1,s.y-1,2,2);
    }
    if(Math.random()<0.5)
      G.particles.push({x:s.x,y:s.y,vx:-s.vx*0.08,vy:-s.vy*0.08,life:0.16,max:0.2,
        kind:'spark',col,s:1});
  }
}

function drawParticles(c){
  for(const p of G.particles){
    const a=p.life/p.max;
    let col=p.col;
    if(p.kind==='flame') col = a>0.66?'#fff0c0':(a>0.33?p.col:'#a8341a');
    else if(p.kind==='spark') col = a>0.5?p.col:shade(p.col,0.6);
    if(p.kind==='steam') col = a>0.6 ? '#b8f0e8' : (a>0.3 ? p.col : '#2f7d76');
    c.globalAlpha = p.kind==='mote' ? a*0.6 : p.kind==='steam' ? a*0.7 : 1;
    c.fillStyle=col;
    const sz=Math.max(1,Math.round(1.6*p.s));
    c.fillRect(Math.round(p.x),Math.round(p.y),sz,sz);
  }
  c.globalAlpha=1;
}
function drawFloats(c){
  for(const f of G.floats){
    c.globalAlpha=Math.min(1,f.life*2.2);
    text(c, f.txt, Math.round(f.x), Math.round(f.y), f.col, f.big?10:7, 'center');
  }
  c.globalAlpha=1;
}

// ============================================================================
// RENDER
// ============================================================================
// How far the camera leans toward the crater in a ring area, in pixels.
const PIT_CAM_BIAS = 52;

// The point the camera wants centred. With two players that is the midpoint
// between them, not either one.
function camFocus(){
  if(PLAYERS.length<2) return { x:player.x, y:player.y };
  const a=PLAYERS[0], b=PLAYERS[1];
  return { x:(a.x+b.x)/2, y:(a.y+b.y)/2 };
}

function camTarget(){
  const a=G.area;
  const foc = camFocus();
  let fx = foc.x, fy = foc.y;
  // In a ring area the camera leans toward the hole. Centred on the player it
  // spends half the frame looking at the street behind you, and the crater —
  // the entire point of the city — ends up as a sliver behind the HUD. The
  // lean is small enough not to feel like a loss of control and it means the
  // drop is always properly in shot.
  if(a.pit){
    const cx=a.pit.cx*TILE+8, cy=a.pit.cy*TILE+8;
    const d = Math.hypot(cx-foc.x, cy-foc.y);
    if(d > 1){
      fx += (cx-foc.x)/d * PIT_CAM_BIAS;
      fy += (cy-foc.y)/d * PIT_CAM_BIAS;
    }
  }
  return { x: clamp(fx-VW/2, 0, Math.max(0,a.w*TILE-VW)),
           y: clamp(fy-VH/2, 0, Math.max(0,a.h*TILE-VH)) };
}

function updateCamera(dt){
  const t = camTarget();
  G.cam.x=lerp(G.cam.x,t.x,Math.min(1,dt*7));
  G.cam.y=lerp(G.cam.y,t.y,Math.min(1,dt*7));
}

function render(){
  const c=ctx;
  c.fillStyle='#0c0810'; c.fillRect(0,0,VW,VH);

  if(G.state===ST.TITLE){ drawTitle(c); return; }
  if(G.state===ST.SELECT_CLASS){ drawClassSelect(c); return; }
  if(G.state===ST.SELECT_DRAGON){ drawDragonSelect(c); return; }
  if(G.state===ST.STORY){ drawStory(c); return; }

  const a0=G.area;
  let ox=-Math.round(G.cam.x), oy=-Math.round(G.cam.y);
  if(G.shake>0.2){ ox+=Math.round((Math.random()-0.5)*G.shake); oy+=Math.round((Math.random()-0.5)*G.shake); }

  c.save(); c.translate(ox,oy);

  // Destination size given explicitly: the buffer is in device pixels and the
  // context is already scaled, so the default (natural size) would paint it at
  // ART times too big.
  c.drawImage(terrainCv, 0, 0, a0.w*TILE, a0.h*TILE);
  drawAnimatedTiles(c);

  // depth-sorted actors
  const actors=[];
  for(const e of G.enemies) actors.push({y:e.y, d:()=>drawEnemy(c,e)});
  for(const s of G.summons) actors.push({y:s.y, d:()=>drawSummon(c,s)});
  for(const n of G.npcs)    actors.push({y:n.y, d:()=>drawNPC(c,n)});
  {
    // the collector sorts with everything else, so you can stand behind it
    const tq = QUEST_BY_ID.collector, tw = G.towers[tq.zone];
    if(tw && G.areaId===tq.zone) actors.push({ y:tw.y, d:()=>drawTower(c) });
  }
  const roster = PLAYERS.length ? PLAYERS : [player];
  for(const p of roster){
    actors.push({ y:p.y, d:()=>withPlayer(p, ()=>drawPlayerFigure(c, p)) });
    actors.push({ y:p.dragon.y+40, d:()=>withPlayer(p, ()=>drawDragon(c)) });
  }
  actors.sort((a,b)=>a.y-b.y);
  for(const a of actors) a.d();

  drawWalls(c);
  drawScanBeam(c);
  drawRuneMarks(c);
  drawReticle(c);
  drawShots(c);
  drawHitmarks(c);
  drawParticles(c);

  // overlay layer: canopies, roofs, lamp glow — drawn above actors
  c.drawImage(overCv, 0, 0, a0.w*TILE, a0.h*TILE);
  // animated overlay bits
  const a=G.area;
  const x0=Math.max(0,Math.floor(G.cam.x/TILE)-1), x1=Math.min(a.w,Math.ceil((G.cam.x+VW)/TILE)+1);
  const y0=Math.max(0,Math.floor(G.cam.y/TILE)-1), y1=Math.min(a.h,Math.ceil((G.cam.y+VH)/TILE)+2);
  for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++){
    const t=a.map[y*a.w+x];
    if(t===T.LAMP||t===T.BANNER||t===T.HEARTH||t===T.BRAZIER||t===T.VENT||t===T.SEAL||t===T.LIFTCAGE)
      drawPropOver(c,a,x,y);
  }

  drawFloats(c);
  c.restore();

  // ---- full-screen colour grade
  if(G.area.tint){ c.fillStyle=G.area.tint; c.fillRect(0,0,VW,VH); }
  if(player.hurtFlash>0){ c.fillStyle='rgba(200,30,20,'+(player.hurtFlash*0.45)+')'; c.fillRect(0,0,VW,VH); }
  if(G.flash>0){ c.fillStyle='rgba(255,220,180,'+Math.min(0.4,G.flash*0.5)+')'; c.fillRect(0,0,VW,VH); }
  const gr=c.createRadialGradient(VW/2,VH/2,80,VW/2,VH/2,280);
  gr.addColorStop(0,'rgba(0,0,0,0)'); gr.addColorStop(1,'rgba(0,0,0,0.40)');
  c.fillStyle=gr; c.fillRect(0,0,VW,VH);

  drawHUD(c);

  if(G.state===ST.DIALOGUE) drawDialogue(c);
  else if(G.state===ST.JOURNAL){
    const owner = PLAYERS[G.menuOwner|0] || player;
    withPlayer(owner, ()=>drawJournal(c));
  }
  else if(G.state===ST.PAUSE) drawPause(c);
  else if(G.state===ST.DEAD) drawDead(c);

  if(G.fade>0){ c.fillStyle='rgba(8,6,12,'+G.fade+')'; c.fillRect(0,0,VW,VH); }
}

// ============================================================================
// MAIN LOOP
// ============================================================================
let last = performance.now();

// The loop never dies. If a frame throws, the error is captured, drawn on
// screen, and the next frame is still scheduled.
function frame(now){
  // One place. Every draw below this — world, UI, menus, the error panel —
  // keeps its existing world coordinates and comes out at ART times the size.
  artScale(ctx);
  try{ stepFrame(now); }
  catch(err){ reportError(err, 'frame'); try{ drawErrorPanel(ctx); }catch(e){} }
  requestAnimationFrame(frame);
}

function drawErrorPanel(c){
  c.fillStyle='rgba(20,6,10,0.94)'; c.fillRect(0,0,VW,VH);
  c.strokeStyle='#ff6a5a'; c.lineWidth=1; c.strokeRect(8.5,8.5,VW-17,VH-17);
  text(c,'SOMETHING BROKE', VW/2, 22, '#ff6a5a', 11, 'center');
  text(c,'The game kept running so you can read this.', VW/2, 40, C.uiDim, 7, 'center');
  const e=G.error||{where:'?',msg:'unknown',stack:[]};
  text(c,'WHERE', 20, 62, C.ui2, 7);
  text(c, e.where, 70, 62, C.uiText, 7);
  text(c,'ERROR', 20, 76, C.ui2, 7);
  wrap(e.msg, 52).slice(0,3).forEach((l,i)=> text(c, l, 70, 76+i*10, '#ffb9b9', 7));
  text(c,'STACK', 20, 116, C.ui2, 7);
  (e.stack||[]).slice(0,4).forEach((l,i)=>
    text(c, l.trim().slice(0,58), 20, 128+i*10, C.uiDim, 7));
  text(c,'Screenshot this and send it over — it names the exact line.',
       VW/2, VH-42, C.uiGold, 7, 'center');
  text(c,'R  RESTART FROM THE TITLE', VW/2, VH-26, C.uiText, 8, 'center');
}

function stepFrame(now){
  let dt=(now-last)/1000; last=now;
  dt=Math.min(dt,0.05);
  G.time+=dt;
  if(G.error){ drawErrorPanel(ctx); return; }
  updateFade(dt);

  if(G.state===ST.STORY) G.storyT += dt;

  if(G.state===ST.PLAY){
    if(G.hitlag>0) G.hitlag-=dt;
    else {
      G.playTime+=dt;
      updateDelayed(dt);
      // Each player, and their dragon, updated with the cursor pointed at
      // them. Everything inside these two functions reads the globals.
      eachPlayer(()=>{ updatePlayer(dt); updateDragon(dt); });
      updateRevive(dt);
      updateEnemies(dt);
      updateSummons(dt);
      updateWalls(dt);
      updateShots(dt);
      updateNPCs(dt);
      eachPlayer(()=>updateAethite(dt));
      updateChannel(dt);
      updateNodes(dt);
      updateTowers(dt);
      updateLift(dt);
      checkMilestones();
      checkExits();
    }
    updateParticles(dt);
    updateCamera(dt);
    G.shake=Math.max(0,G.shake-dt*16);
    G.flash=Math.max(0,G.flash-dt*2.4);
    G.toastT=Math.max(0,G.toastT-dt);
    G.areaNameT=Math.max(0,(G.areaNameT||0)-dt);
  } else if(G.state===ST.DIALOGUE){
    updateDialogue(dt);
    updateParticles(dt*0.4);
    updateDragon(dt*0.5);
    updateCamera(dt);
  } else if(G.state===ST.PAUSE||G.state===ST.JOURNAL){
    updateParticles(dt*0.2);
  } else {
    updateParticles(dt);
  }

  render();
}

// ============================================================================
// INPUT  —  WASD move · SPACE dodge · ARROWS abilities · < > dragon
// ============================================================================
const keys = Object.create(null);

function beginGame(){
  // picks[] is filled by the select screens, one entry per player. The old
  // single-player path (and the tests) call beginGame with none, which falls
  // back to the current selection as a one-player roster.
  const picks = (G.picks && G.picks.length) ? G.picks
              : [{ cls:G.selClass, drg:G.selDragon }];
  makeRoster(picks);
  buildAllAreas();
  // A fresh run: nothing recorded, nothing opened, no capacity but the
  // bonding grant. Resetting these here rather than at declaration means
  // restarting after a death doesn't leave you holding the last run's keys.
  G.seen = {}; G.milestones = {}; G.locks = {};
  for(const q of PLAYERS){ q.aethite=0; q.aethiteMax=0; q.burning=false; q.burnCd=0; }
  G.channel = null;
  G.marks = 0; G.inv = []; G.fitted = { head:null, wing:null, body:null };
  for(const p of PLAYERS) p.fitted = { head:null, wing:null, body:null };
  G.invSel = 0; G.dragSel = 0; G.codexPage = 0;
  G.quests = {}; G.towers = {}; G.nodesDone = {}; G.questSel = 0;
  G.godMode = false; G.godBuf = '';
  G.visited = {}; G.mapFloor = 0;
  grantMilestone('bond');
  loadArea('house', AREAS.house.playerStart.x, AREAS.house.playerStart.y);
  G.quest={ state:'none', kills:0, need:10 };
  G.state=ST.PLAY;
  toast(twoPlayer() ? 'TWO FORGEBOUND \u2014 F TO OPEN THE DOOR' : 'F TO OPEN THE DOOR');
}

// Anything thrown inside an input handler would escape the loop's try/catch,
// so the handler gets its own.
window.addEventListener('keydown', e=>{
  // Autoplay policy keeps the audio context suspended until the page has been
  // interacted with, and the title screen is drawn long before that happens.
  // A keypress counts, so the theme starts on the first thing the player does
  // rather than waiting for them to click the canvas.
  Sfx.resume(); Music.wake();
  try{ handleKey(e); }
  catch(err){ reportError(err, 'keydown "'+e.key+'"'); }
});
// last line of defence: anything thrown anywhere else still gets reported
window.addEventListener('error', ev=>{
  reportError(ev.error || new Error(ev.message||'script error'), 'window');
});

function handleKey(e){
  const k=e.key.length===1 ? e.key.toLowerCase() : e.key.toLowerCase();
  keys[k]=true;
  if(['arrowup','arrowdown','arrowleft','arrowright',' ','tab'].includes(k)) e.preventDefault();
  Sfx.resume();

  // an error panel is on screen: R starts over cleanly
  if(G.error){
    if(k==='r'){ G.error=null; G.state=ST.TITLE; G.storyPage=0; G.storyT=0; Music.play('title'); }
    return;
  }

  // ---- REBINDING IS MODAL, AT BOTH ENTRY POINTS
  // It has to sit above the mute key, the menu's close key and the tab
  // cycler, because all three are bindable and all three would otherwise eat
  // the keypress that was meant to bind them.
  if(G.remap && (G.state===ST.JOURNAL || (G.state===ST.TITLE && G.titleOpts))){
    remapKey(k); return;
  }
  if(G.remap) G.remap = null;          // left the options page some other way

  if(k==='m'){ Sfx.toggle(); toast(Sfx.isMuted()?'MUTED':'UNMUTED'); return; }

  switch(G.state){
    case ST.TITLE:
      if(G.titleOpts){
        if(k==='escape'||k==='tab'||k==='backspace'){ G.titleOpts=false; Sfx.ui(); return; }
        optionsKey(k);
        return;
      }
      if(k==='w'||k==='arrowup')   { G.titleSel=(G.titleSel+2)%3; Sfx.ui(); return; }
      if(k==='s'||k==='arrowdown') { G.titleSel=(G.titleSel+1)%3; Sfx.ui(); return; }
      if(k==='enter'||k===' '){
        if(G.titleSel===2){ G.titleOpts=true; G.optSel=0; Sfx.ui(); return; }
        G.nPlayers = G.titleSel===1 ? 2 : 1;
        G.picks = []; G.pickWho = 0;
        G.state=ST.SELECT_CLASS; Sfx.confirm();
      }
      return;

    case ST.SELECT_CLASS: {
      if(k==='a'||k==='arrowleft')  { G.selClass=(G.selClass+8)%9; Sfx.ui(); }
      if(k==='d'||k==='arrowright') { G.selClass=(G.selClass+1)%9; Sfx.ui(); }
      if(k==='w'||k==='arrowup')    { G.selClass=(G.selClass+6)%9; Sfx.ui(); }
      if(k==='s'||k==='arrowdown')  { G.selClass=(G.selClass+3)%9; Sfx.ui(); }
      if(k==='enter'||k===' ')      { G.state=ST.SELECT_DRAGON; Sfx.confirm(); }
      if(k==='backspace'){
        if(G.pickWho>0){ G.pickWho--; G.picks.pop(); Sfx.ui(); }
        else { G.state=ST.TITLE; Music.play('title'); Sfx.ui(); }
      }
      return;
    }
    case ST.SELECT_DRAGON: {
      if(k==='a'||k==='arrowleft')  { G.selDragon=(G.selDragon+5)%6; Sfx.ui(); }
      if(k==='d'||k==='arrowright') { G.selDragon=(G.selDragon+1)%6; Sfx.ui(); }
      if(k==='enter'||k===' '){
        G.picks[G.pickWho] = { cls:G.selClass, drg:G.selDragon };
        if(G.pickWho + 1 < (G.nPlayers||1)){
          // hand the screens to the next player, starting them somewhere
          // other than the class their partner just took
          G.pickWho++;
          G.selClass = (G.selClass+1)%9; G.selDragon = (G.selDragon+1)%6;
          G.state = ST.SELECT_CLASS; Sfx.confirm();
        } else {
          G.state=ST.STORY; G.storyPage=0; G.storyT=0; Sfx.confirm();
        }
      }
      if(k==='backspace')     { G.state=ST.SELECT_CLASS; Sfx.ui(); }
      return;
    }
    case ST.STORY: {
      if(k!=='enter' && k!==' ' && k!=='e') return;
      const pageText = STORY_PAGES[G.storyPage];
      // defensive: if the page index ever runs off the end, go straight in
      // rather than sitting on a page that cannot be drawn
      if(pageText === undefined){ beginGame(); return; }
      const full = pageText.replace(/\n\n/g,' ').length;
      if(G.storyT*52 < full){ G.storyT = full/52 + 1; return; }   // reveal the rest
      if(G.storyPage >= STORY_PAGES.length-1){ beginGame(); return; }
      G.storyPage++;
      G.storyT=0;
      Sfx.ui();
      return;
    }
    case ST.DIALOGUE:
      if(k==='f'||k==='e'||k==='enter'||k===' ') advanceDialogue();
      return;

    case ST.JOURNAL: return menuKey(k);
    case ST.PAUSE:
      // Only reachable by the window losing focus now. Any of the usual
      // keys brings you back.
      if(k==='p'||k==='tab'||k==='escape'||k==='enter'){ G.state=ST.PLAY; Sfx.ui(); }
      return;

    case ST.DEAD:
      if(k==='r'){
        player.hp=player.maxhp; player.iframe=2;
        loadArea('clearing', AREAS.clearing.playerStart.x, AREAS.clearing.playerStart.y);
        G.state=ST.PLAY;
      }
      return;

    case ST.PLAY: {
      // Pause and the field journal are the same thing now. TAB is P1's; in
      // two player P is P2's. Whoever opens it owns it, so the Dragon page
      // fits parts to THEIR hatchling and the Journal shows THEIR class —
      // otherwise P2 would be equipping P1's dragon.
      if(k==='tab'){ openMenu(0); return; }
      if(k==='p'){ openMenu(twoPlayer() ? 1 : 0); return; }
      // Route the press to whichever player owns that key. Both maps are
      // checked every press, so P2 acts regardless of who moved last, and
      // there is exactly one place in the game that knows which key does
      // what — add a gamepad later and it plugs in here.
      const roster = PLAYERS.length ? PLAYERS : [player];
      for(const p of roster){
        const K = p.keys || KEYMAPS[0];
        if(p.down) continue;                        // a downed player cannot act
        if(k===K.act)   { withPlayer(p, interact);    return; }
        if(k===K.burn)  { withPlayer(p, toggleBurn);  return; }
        if(k===K.dodge) { withPlayer(p, dodgeAction); return; }
        const ai = K.ab.indexOf(k);
        if(ai>=0){
          withPlayer(p, ()=>{
            // Easy attacks put the whole rotation on the first key. The other
            // three keep firing their own slots.
            if(G.easyAttack && ai===0){
              const n = easyNextAbility();
              if(n>=0) useAbility(n); else Sfx.ui();
            } else useAbility(ai);
          });
          return;
        }
        const di = K.dragon.indexOf(k);
        if(di>=0)       { withPlayer(p, ()=>dragonAbility(di)); return; }
      }
      if(k==='enter'){ interact(); return; }
      return;
    }
  }
}
window.addEventListener('keyup', e=>{ keys[e.key.toLowerCase()]=false; });
window.addEventListener('blur', ()=>{
  for(const k in keys) keys[k]=false;
  if(G.state===ST.PLAY) G.state=ST.PAUSE;
});
canvas.addEventListener('mousedown', ()=>{
  Sfx.resume(); Music.wake();
  if(G.state===ST.TITLE) { G.state=ST.SELECT_CLASS; Sfx.confirm(); }
  else if(G.state===ST.DIALOGUE) advanceDialogue();
});
canvas.addEventListener('contextmenu', e=>e.preventDefault());

// ============================================================================
// BOOT
// ============================================================================
buildAllAreas();
setupPlayer(0,0);
G.area = AREAS.clearing;         // something valid behind the menus
terrainCv.width=16*ART; terrainCv.height=16*ART;
overCv.width=16*ART; overCv.height=16*ART;
artScale(tctx); artScale(octx);
G.state = ST.TITLE;
Music.play('title');             // queued; it starts on the first keypress
requestAnimationFrame(frame);
console.log('WILDFIRE v2 booted —', VW+'x'+VH,
  '| classes', CLASSES.length, '| dragons', DRAGONS.length,
  '| areas', Object.keys(AREAS).length);
