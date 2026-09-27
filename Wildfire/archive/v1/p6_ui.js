
// ============================================================================
// EXPEDITION FLOW — waves, mutation drops, the Refinery, HUD, screens, loop.
// ============================================================================

const inventory = ['power_crystal','tiny_goggles','fae_wings'];   // starting kit

// Which mutations drop, roughly in the order that teaches the system best
const DROP_TABLE = [
  'frost_shard','twin_heart','claw_gauntlets','hydra_crest','storm_cell',
  'wyrm_scale','serpent_tail','resonance_crystal','void_fragment','mini_shield',
  'vitality_crystal','haste_crystal','clockwork_scarf','ward_crystal','bell_collar'
];
let dropCursor = 0;

const WAVES = [
  { rat:4, drone:0, golem:0 },
  { rat:4, drone:3, golem:0 },
  { rat:3, drone:3, golem:1 },
  { rat:5, drone:4, golem:2 }
];

function spawnWave(n){
  const comp = WAVES[clamp(n-1,0,WAVES.length-1)];
  for(const kind in comp){
    for(let i=0;i<comp[kind];i++){
      // spawn away from the player so nothing materialises on top of them
      for(let a=0;a<200;a++){
        const x = 2+Math.floor(G.rng()*(MAP_W-4)), y = 2+Math.floor(G.rng()*(MAP_H-4));
        if(!walkableTile(x,y)) continue;
        const wx=x*TILE+8, wy=y*TILE+8;
        if(dist(wx,wy,player.x,player.y) < 90) continue;
        spawnEnemy(kind, wx, wy);
        for(let k=0;k<8;k++) spark(wx, wy, PAL.rust, 1);
        break;
      }
    }
  }
  toast('WAVE '+n+' OF '+G.maxWave);
}

function dropMutation(x,y){
  if(dropCursor >= DROP_TABLE.length) return;
  const id = DROP_TABLE[dropCursor++];
  G.pickups.push({ id, x, y, phase:Math.random()*6, life:9999 });
}

function updatePickups(dt){
  for(let i=G.pickups.length-1;i>=0;i--){
    const p=G.pickups[i];
    if(dist(p.x,p.y,player.x,player.y) < 12){
      inventory.push(p.id);
      G.pickups.splice(i,1);
      const mu = MUT_BY_ID[p.id];
      toast('FOUND: '+mu.name.toUpperCase()+' — TAB TO SLOT IT');
      floatText(player.x, player.y-32, mu.name, '#ffd98a', true);
      Sfx.pickup();
      for(let k=0;k<16;k++) spark(p.x, p.y, '#ffd98a', 1.3);
    }
  }
}

function updateWaves(dt){
  const alive = G.enemies.filter(e=>!e.dead).length;
  if(G.betweenWaves>0){
    G.betweenWaves -= dt;
    if(G.betweenWaves<=0){
      G.wave++;
      if(G.wave > G.maxWave){ G.state=ST.CLEAR; Sfx.clear(); return; }
      spawnWave(G.wave);
    }
    return;
  }
  if(alive===0 && G.enemies.length===0){
    if(G.wave >= G.maxWave){ G.state=ST.CLEAR; Sfx.clear(); return; }
    G.betweenWaves = 3.0;
    dropMutation(player.x + 26, player.y);
    toast('SECTOR CLEAR — SALVAGE RECOVERED');
  }
}

// ============================================================================
// THE AETHITE REFINERY — slot and unslot mutations. GDD §10: free swapping,
// no permanent commitment, so the player is encouraged to experiment.
// ============================================================================

const refinery = { cursor:0, pane:0 };   // pane 0 = slots, 1 = inventory

function openRefinery(){
  G.state = ST.REFINERY;
  refinery.pane = 1; refinery.cursor = 0;
  Sfx.ui();
}
function closeRefinery(){ G.state = ST.PLAY; Sfx.ui(); }

function refineryMove(d){
  if(refinery.pane===0){
    refinery.cursor = clamp(refinery.cursor + d, 0, SLOTS-1);
  } else {
    refinery.cursor = clamp(refinery.cursor + d, 0, Math.max(0, inventory.length-1));
  }
  Sfx.ui();
}
function refineryConfirm(){
  if(refinery.pane===0){
    // unslot back to inventory
    const id = dragon.slots[refinery.cursor];
    if(id){
      dragon.slots[refinery.cursor] = null;
      inventory.push(id);
      refreshMods();
      Sfx.slot();
      toast('UNSLOTTED: '+MUT_BY_ID[id].name.toUpperCase());
    }
  } else {
    if(!inventory.length) return;
    const id = inventory[refinery.cursor];
    const free = dragon.slots.indexOf(null);
    if(free === -1){ toast('ALL 5 SLOTS FULL — UNSLOT ONE FIRST'); Sfx.ui(); return; }
    dragon.slots[free] = id;
    inventory.splice(refinery.cursor,1);
    refinery.cursor = clamp(refinery.cursor, 0, Math.max(0,inventory.length-1));
    refreshMods();
    Sfx.slot();
    toast('SLOTTED: '+MUT_BY_ID[id].name.toUpperCase()+' — '+dragonFormName().toUpperCase());
  }
}

// ---------------------------------------------------------------- text helper
function text(c, s, x, y, col, size, align){
  c.font = (size||7)+'px ui-monospace, "Courier New", monospace';
  c.textAlign = align||'left'; c.textBaseline='top';
  c.fillStyle = '#100c14';
  c.fillText(s, x+1, y+1);
  c.fillStyle = col;
  c.fillText(s, x, y);
}
function panel(c,x,y,w,h,accent){
  c.fillStyle='rgba(14,10,18,.93)'; c.fillRect(x,y,w,h);
  c.strokeStyle=accent||'#c8a13c'; c.lineWidth=1; c.strokeRect(x+.5,y+.5,w-1,h-1);
  c.strokeStyle='#4a3a1a'; c.strokeRect(x+2.5,y+2.5,w-5,h-5);
}

// ============================================================================
// HUD (GDD §16)
// ============================================================================
function drawHUD(c){
  // ---- top-left: dragon portrait, bond, form name
  c.fillStyle='rgba(14,10,18,.72)'; c.fillRect(2,2,96,26);
  c.strokeStyle='#4a3a1a'; c.lineWidth=1; c.strokeRect(2.5,2.5,95,25);
  drawDragonPortrait(c, 12, 14);
  text(c, dragonFormName().toUpperCase(), 23, 4, '#ffd98a', 7);
  text(c, 'BOND '+dragon.bond, 23, 13, '#c9a2ff', 7);
  // bond progress bar sits on its own row so nothing collides
  c.fillStyle='#2a1f2c'; c.fillRect(23,21,50,4);
  c.fillStyle='#8b52c4'; c.fillRect(23,21,Math.round(50*(dragon.bondXp/10)),4);
  c.fillStyle='#c9a2ff'; c.fillRect(23,21,Math.round(50*(dragon.bondXp/10)),1);

  // element pips, right of the bond bar
  for(let i=0;i<MODS.elements.length;i++){
    const el=EL_COL[MODS.elements[i]];
    c.fillStyle=el.b; c.fillRect(77+i*5, 21, 4, 4);
    c.fillStyle=el.c; c.fillRect(77+i*5, 21, 2, 1);
  }

  // ---- top-right: minimap
  const MM_W=58, MM_H=36, mmx=VW-MM_W-3, mmy=3;
  c.fillStyle='rgba(14,10,18,.8)'; c.fillRect(mmx,mmy,MM_W,MM_H);
  c.strokeStyle='#4a3a1a'; c.strokeRect(mmx+.5,mmy+.5,MM_W-1,MM_H-1);
  const sx = MM_W/WORLD_W, sy = MM_H/WORLD_H;
  // solid tiles
  c.fillStyle='#463a30';
  for(let y=0;y<MAP_H;y+=1) for(let x=0;x<MAP_W;x+=1)
    if(SOLID[G.map[idx(x,y)]]) c.fillRect(mmx+x*TILE*sx, mmy+y*TILE*sy, 1.6, 1.6);
  for(const e of G.enemies){ if(e.dead) continue;
    c.fillStyle='#d8443c'; c.fillRect(mmx+e.x*sx-1, mmy+e.y*sy-1, 2, 2); }
  for(const p of G.pickups){ c.fillStyle='#ffd24a'; c.fillRect(mmx+p.x*sx-1, mmy+p.y*sy-1, 2, 2); }
  c.fillStyle='#8fd6ff'; c.fillRect(mmx+player.x*sx-1, mmy+player.y*sy-1, 3, 3);

  // wave + lives under the minimap
  text(c, 'WAVE '+Math.min(G.wave,G.maxWave)+'/'+G.maxWave, VW-3, mmy+MM_H+2, '#ffd98a', 7, 'right');
  text(c, 'LIVES '+G.lives, VW-3, mmy+MM_H+11, G.lives>2?'#7ddc6a':'#ff6a5a', 7, 'right');

  // ---- bottom-left: HP + Momentum
  const hy = VH-30;
  text(c,'HP',4,hy-9,'#ff9a90',7);
  c.fillStyle='#3a1614'; c.fillRect(4,hy,74,7);
  const hpf = player.hp/player.maxhp;
  c.fillStyle = hpf>0.5?'#d8443c':(hpf>0.25?'#e07a2a':'#ff3c3c');
  c.fillRect(5,hy+1,Math.round(72*hpf),5);
  c.fillStyle='rgba(255,255,255,.35)'; c.fillRect(5,hy+1,Math.round(72*hpf),1);
  c.strokeStyle='#8a5a2a'; c.lineWidth=1; c.strokeRect(3.5,hy-0.5,75,8);
  text(c, player.hp+'/'+player.maxhp, 82, hy, '#ffd0c0', 7);

  // Momentum pips — the Ironclad's class gauge
  text(c,'MOMENTUM',4,hy+11,'#c8a13c',7);
  for(let i=0;i<MAX_MOMENTUM;i++){
    const px0 = 56+i*9, py0 = hy+11;
    const on = i < player.momentum;
    const full = player.momentum>=MAX_MOMENTUM;
    c.fillStyle = on ? (full?'#ffd98a':'#c8a13c') : '#3a2f1a';
    c.fillRect(px0,py0,7,7);
    if(on){ c.fillStyle = full?'#fff4d0':'#e8c866'; c.fillRect(px0,py0,7,2); }
    c.strokeStyle='#6a5520'; c.strokeRect(px0+.5,py0+.5,6,6);
  }
  if(isEmpowered()){
    // sits above the ability bar, clear of the momentum pips
    const pulse = 0.55+0.45*Math.sin(G.time*10);
    c.globalAlpha=pulse;
    text(c,'◆ EMPOWERED ◆', 236, VH-34, '#ffd98a', 8, 'center');
    c.globalAlpha=1;
  }

  // ---- bottom-centre: abilities
  const bx = 150, by = VH-22;
  for(let i=0;i<4;i++){
    const x = bx + i*26;
    const cd = player.cds[i], A = ABILITIES[i];
    const ready = cd<=0;
    c.fillStyle = ready ? '#2a2038' : '#181420';
    c.fillRect(x,by,22,18);
    c.strokeStyle = ready ? (isEmpowered() && (i===0||i===3) ? '#ffd98a' : '#8a7730') : '#3a3040';
    c.lineWidth=1; c.strokeRect(x+.5,by+.5,21,17);
    drawAbilityGlyph(c, i, x+11, by+8, ready);
    text(c, A.key, x+2, by+11, ready?'#ffd98a':'#6a6070', 7);
    if(!ready){
      const f = cd / (A.cd*MODS.cdrMul);
      c.fillStyle='rgba(10,8,14,.72)';
      c.fillRect(x+1, by+1, 20, Math.round(16*f));
      text(c, cd.toFixed(1), x+11, by+5, '#c0b8d0', 7, 'center');
    }
  }
  // dragon ability
  const qx = bx + 4*26 + 6;
  const qReady = dragon.breathCd<=0;
  c.fillStyle = qReady ? '#3a2028' : '#1c1418';
  c.fillRect(qx,by,22,18);
  c.strokeStyle = qReady ? '#ff9a3c' : '#4a3038'; c.strokeRect(qx+.5,by+.5,21,17);
  // tiny flame glyph
  c.fillStyle = qReady ? elemColor() : '#5a4048';
  c.fillRect(qx+9,by+5,4,8); c.fillRect(qx+10,by+3,2,3);
  text(c,'Q', qx+2, by+11, qReady?'#ffd98a':'#6a6070', 7);
  if(!qReady){
    const f = dragon.breathCd/(5.0*MODS.cdrMul);
    c.fillStyle='rgba(10,8,14,.72)'; c.fillRect(qx+1,by+1,20,Math.round(16*f));
    text(c, dragon.breathCd.toFixed(1), qx+11, by+5, '#c0b8d0', 7, 'center');
  }

  // slot pips (how full the dragon's 5 slots are) — label and pips on one row
  const spx = qx+28;
  text(c,'SLOTS',spx,by+1,'#8a7fa0',7);
  for(let i=0;i<SLOTS;i++){
    const filled = !!dragon.slots[i];
    c.fillStyle = filled ? '#c9a2ff' : '#2a2038';
    c.fillRect(spx+i*7, by+10, 5, 7);
    c.strokeStyle='#4a3a5a'; c.lineWidth=1; c.strokeRect(spx+i*7+.5, by+10.5, 4, 6);
  }
  text(c,'TAB', spx+38, by+1, '#6a6070', 7);

  // ---- toast
  if(G.toastT>0){
    const a = Math.min(1, G.toastT*1.6);
    c.globalAlpha=a;
    const w = G.toast.length*4.4+14;
    c.fillStyle='rgba(14,10,18,.9)'; c.fillRect(VW/2-w/2, 40, w, 13);
    c.strokeStyle='#c8a13c'; c.strokeRect(VW/2-w/2+.5, 40.5, w-1, 12);
    text(c, G.toast, VW/2, 43, '#ffd98a', 7, 'center');
    c.globalAlpha=1;
  }
}

function drawAbilityGlyph(c, i, cx, cy, ready){
  const col = ready ? '#e8c866' : '#5a5060';
  if(i===0){        // Forge Cleave — arc
    c.strokeStyle=col; c.lineWidth=1.5;
    c.beginPath(); c.arc(cx+2, cy, 5, -1.3, 1.3); c.stroke();
  } else if(i===1){ // Iron Tempest — full ring
    c.strokeStyle=col; c.lineWidth=1.5;
    c.beginPath(); c.arc(cx+2, cy, 5, 0, Math.PI*2); c.stroke();
  } else if(i===2){ // Unyielding Charge — arrow
    c.fillStyle=col;
    c.fillRect(cx-2, cy-1, 8, 2);
    c.fillRect(cx+4, cy-3, 2, 2); c.fillRect(cx+4, cy+1, 2, 2);
  } else {          // Earthsplitter — shockwave bars
    c.fillStyle=col;
    c.fillRect(cx-1, cy-4, 2, 8);
    c.fillRect(cx+2, cy-3, 2, 6);
    c.fillRect(cx+5, cy-2, 2, 4);
  }
}

function drawDragonPortrait(c, cx, cy){
  const P = dragonPalette();
  c.fillStyle='#1a1218'; c.fillRect(cx-8, cy-9, 16, 18);
  c.fillStyle=P.a; c.fillRect(cx-5, cy-4, 10, 9);
  c.fillStyle=P.b; c.fillRect(cx-4, cy-3, 8, 7);
  const heads = MODS.heads;
  for(let h=0; h<heads; h++){
    const hx = cx + (heads>1 ? (h===0?-3:3) : 0);
    c.fillStyle=P.a; c.fillRect(hx-3, cy-8, 6, 6);
    c.fillStyle=P.b; c.fillRect(hx-2, cy-7, 4, 4);
    c.fillStyle='#2a1520'; c.fillRect(hx+(h===0?-1:1), cy-6, 1, 1);
  }
  if(MODS.goggles){ c.fillStyle='#4a3a2a'; c.fillRect(cx-3, cy-7, 6, 2); c.fillStyle='#8fd6ff'; c.fillRect(cx, cy-7, 2, 2); }
  if(MODS.twins){ c.fillStyle=P.a; c.fillRect(cx+4, cy+2, 5, 5); c.fillStyle=P.b; c.fillRect(cx+5, cy+3, 3, 3); }
}

// ============================================================================
// REFINERY SCREEN
// ============================================================================
function drawRefinery(c){
  c.fillStyle='rgba(8,6,12,.86)'; c.fillRect(0,0,VW,VH);
  panel(c, 6, 4, VW-12, VH-8);

  text(c,'THE AETHITE REFINERY', VW/2, 10, '#ffd98a', 9, 'center');
  text(c,'IRONHAVEN · FORGEWORKS', VW/2, 21, '#8a7fa0', 7, 'center');

  // --- live dragon preview
  const pvL = 14, pvT = 34, pvW = 94, pvH = 82;
  const pvx = pvL + pvW/2;
  c.fillStyle='#1a1420'; c.fillRect(pvL, pvT, pvW, pvH);
  c.strokeStyle='#4a3a5a'; c.lineWidth=1; c.strokeRect(pvL+.5, pvT+.5, pvW-1, pvH-1);
  text(c,'CURRENT FORM', pvx, pvT+4, '#8a7fa0', 7, 'center');
  // draw the dragon into the box, clipped so nothing bleeds past the frame
  c.save();
  c.beginPath(); c.rect(pvL+1, pvT+13, pvW-2, pvH-15); c.clip();
  c.translate(pvx, pvT+48);
  c.scale(2.2, 2.2);
  const sx=dragon.x, sy=dragon.y, sx2=dragon.x2, sy2=dragon.y2, sdx=player.dx;
  dragon.x=4; dragon.y=0; dragon.x2=-11; dragon.y2=5; player.dx=1;
  drawDragon(c);
  dragon.x=sx; dragon.y=sy; dragon.x2=sx2; dragon.y2=sy2; player.dx=sdx;
  c.restore();
  text(c, dragonFormName().toUpperCase(), pvx, pvT+pvH+4, '#ffd98a', 7, 'center');
  const elNames = MODS.elements.map(e=>EL_COL[e].name).join(' / ');
  text(c, elNames, pvx, pvT+pvH+13, '#c9a2ff', 7, 'center');

  // --- slots column
  const slx = 118, sly = 40;
  text(c,'MUTATION SLOTS', slx, sly-11, refinery.pane===0?'#ffd98a':'#8a7fa0', 7);
  for(let i=0;i<SLOTS;i++){
    const y = sly + i*20;
    const sel = refinery.pane===0 && refinery.cursor===i;
    c.fillStyle = sel ? '#3a2c1a' : '#1e1826';
    c.fillRect(slx, y, 108, 17);
    c.strokeStyle = sel ? '#ffd98a' : '#4a3a5a'; c.lineWidth=1;
    c.strokeRect(slx+.5, y+.5, 107, 16);
    const id = dragon.slots[i];
    if(id){
      const mu = MUT_BY_ID[id];
      catSwatch(c, slx+3, y+4, mu.cat);
      text(c, mu.name.toUpperCase(), slx+14, y+2, '#ffffff', 7);
      text(c, mu.cat.toUpperCase(), slx+14, y+10, '#8a7fa0', 7);
    } else {
      text(c,'— EMPTY —', slx+14, y+6, '#4a4058', 7);
    }
  }

  // --- inventory column
  const ivx = 236, ivy = 40, ivw = VW-ivx-14;
  text(c,'SALVAGE  ('+inventory.length+')', ivx, ivy-11, refinery.pane===1?'#ffd98a':'#8a7fa0', 7);
  const rows = 5;
  const start = clamp(refinery.cursor - 2, 0, Math.max(0, inventory.length-rows));
  for(let r=0;r<rows;r++){
    const i = start+r;
    const y = ivy + r*20;
    if(i >= inventory.length){
      c.fillStyle='#16121c'; c.fillRect(ivx, y, ivw, 17);
      continue;
    }
    const mu = MUT_BY_ID[inventory[i]];
    const sel = refinery.pane===1 && refinery.cursor===i;
    c.fillStyle = sel ? '#3a2c1a' : '#1e1826';
    c.fillRect(ivx, y, ivw, 17);
    c.strokeStyle = sel ? '#ffd98a' : '#4a3a5a';
    c.strokeRect(ivx+.5, y+.5, ivw-1, 16);
    catSwatch(c, ivx+3, y+4, mu.cat);
    text(c, mu.name.toUpperCase(), ivx+14, y+2, '#ffffff', 7);
    text(c, mu.cat.toUpperCase(), ivx+14, y+10, '#8a7fa0', 7);
  }
  if(!inventory.length) text(c,'NO SALVAGE — CLEAR WAVES TO FIND MORE', ivx+4, ivy+6, '#4a4058', 7);

  // --- live stat readout: what the current loadout is actually doing
  const sty = 144;
  c.fillStyle='#16121c'; c.fillRect(14, sty, VW-28, 46);
  c.strokeStyle='#4a3a5a'; c.strokeRect(14.5, sty+.5, VW-29, 45);
  text(c,'ACTIVE LOADOUT', 20, sty+3, '#8a7fa0', 7);

  const stats = [
    ['ATTACK',     Math.round(MODS.atkMul*100)+'%',              MODS.atkMul!==1],
    ['DEFENCE',    Math.round((2-MODS.defMul)*100)+'%',          MODS.defMul!==1],
    ['MAX HP',     String(player.maxhp),                          MODS.hpBonus!==0],
    ['CRIT',       Math.round((0.08+MODS.critBonus)*100)+'%',     MODS.critBonus!==0],
    ['COOLDOWNS',  Math.round(MODS.cdrMul*100)+'%',               MODS.cdrMul!==1],
    ['MOVE SPEED', Math.round(MODS.moveMul*100)+'%',              MODS.moveMul!==1],
    ['DRAGON DMG', Math.round(MODS.dragonDmgMul*100)+'%',         MODS.dragonDmgMul!==1],
    ['DRAGONS',    String(MODS.dragonCount)+' × '+MODS.heads+'H', MODS.twins||MODS.heads>1]
  ];
  stats.forEach((s,i)=>{
    const col = i%4, row = (i/4)|0;
    const x = 22 + col*112, y = sty+14 + row*13;
    text(c, s[0], x, y, '#6a6070', 7);
    text(c, s[1], x+92, y, s[2] ? '#7ddc6a' : '#c0b8d0', 7, 'right');
  });

  // special effects that aren't plain numbers
  const fx = [];
  if(MODS.slowOnHit) fx.push('SLOW');
  if(MODS.chain)     fx.push('CHAIN');
  if(MODS.lifesteal) fx.push('LIFESTEAL');
  if(MODS.burnBonus) fx.push('LONG BURN');
  if(MODS.claws)     fx.push('AUTO-CLAW');
  if(MODS.tail)      fx.push('COUNTER');
  if(MODS.shield)    fx.push('BLOCK');
  if(MODS.bell)      fx.push('BOND+');
  if(fx.length) text(c, fx.join('  ·  '), 20, sty+37, '#ffd98a', 7);
  else          text(c,'No special effects active.', 20, sty+37, '#4a4058', 7);

  // --- description of whatever is highlighted
  let hov = null;
  if(refinery.pane===0) hov = dragon.slots[refinery.cursor];
  else if(inventory.length) hov = inventory[refinery.cursor];
  const dy = 196;
  c.fillStyle='#16121c'; c.fillRect(14, dy, VW-28, 24);
  c.strokeStyle='#4a3a5a'; c.strokeRect(14.5, dy+.5, VW-29, 23);
  if(hov){
    const mu = MUT_BY_ID[hov];
    text(c, mu.desc, 20, dy+3, '#e0d8f0', 7);
    text(c, 'VISUAL: '+mu.vis, 20, dy+13, '#8a7fa0', 7);
  } else {
    text(c,'Select a mutation to see what it does.', 20, dy+8, '#4a4058', 7);
  }

  // --- controls
  text(c,'W/S SELECT    A/D SWITCH PANE    ENTER SLOT/UNSLOT    TAB CLOSE',
       VW/2, 228, '#8a7fa0', 7, 'center');
  text(c,'Mutations swap freely — nothing here is permanent.',
       VW/2, 240, '#4a4058', 7, 'center');
}

function catSwatch(c,x,y,cat){
  const col = cat==='Elemental' ? '#ff9a3c'
            : cat==='Physical'  ? '#7ddc6a'
            : cat==='Stat'      ? '#c9a2ff' : '#8fd6ff';
  c.fillStyle=col; c.fillRect(x,y,8,8);
  c.fillStyle='rgba(255,255,255,.4)'; c.fillRect(x,y,8,2);
}

// ============================================================================
// SCREENS
// ============================================================================
function drawTitle(c){
  c.fillStyle='#14101a'; c.fillRect(0,0,VW,VH);
  // ember drift
  for(let i=0;i<50;i++){
    const t=(G.time*0.28 + i*0.173)%1;
    const x=(i*97.3)%VW, y=VH - t*VH;
    c.fillStyle = i%3 ? 'rgba(255,140,50,'+(0.45*(1-t))+')' : 'rgba(255,214,120,'+(0.4*(1-t))+')';
    c.fillRect(Math.round(x+Math.sin(G.time*1.6+i)*7), Math.round(y), 1, 2);
  }
  // rusted skyline
  c.fillStyle='#241820';
  for(let x=0;x<VW;x+=3){ const h=20+Math.sin(x*0.06)*8+Math.sin(x*0.017)*12; c.fillRect(x,VH-h,3,h); }

  c.textAlign='center'; c.textBaseline='top';
  c.font='bold 30px ui-monospace, "Courier New", monospace';
  c.fillStyle='#7a2410'; c.fillText('WILDFIRE', VW/2+2, 36);
  c.fillStyle='#ff8a3c'; c.fillText('WILDFIRE', VW/2, 34);
  c.fillStyle='#ffd98a'; c.font='bold 30px ui-monospace, "Courier New", monospace';
  c.fillText('WILDFIRE', VW/2, 33);
  c.textAlign='left';

  text(c,'V E R T I C A L   S L I C E', VW/2, 70, '#c9a2ff', 7, 'center');
  text(c,'IRONCLAD  ·  PYRALING  ·  THE RUSTFIELDS', VW/2, 81, '#8a7fa0', 7, 'center');

  panel(c, 64, 96, VW-128, 108);
  const rows = [
    ['WASD','MOVE (8-DIR)'],
    ['J / LMB','GREATSWORD COMBO'],
    ['SPACE','DODGE ROLL (I-FRAMES)'],
    ['1 2 3 4','ABILITIES'],
    ['Q','EMBER BREATH'],
    ['TAB','AETHITE REFINERY'],
    ['P / M','PAUSE / MUTE']
  ];
  rows.forEach((r,i)=>{
    text(c, r[0], 78, 104+i*13, '#8fd6ff', 7);
    text(c, r[1], 142, 104+i*13, '#e0d8f0', 7);
  });

  if(Math.sin(G.time*4) > -0.3)
    text(c,'PRESS ENTER TO DEPLOY', VW/2, 216, '#ffffff', 9, 'center');
  text(c,'Build Momentum to 5 — it empowers Forge Cleave and Earthsplitter',
       VW/2, 238, '#6a6070', 7, 'center');
  text(c,'Mutations drop between waves. Slot them at the Refinery.',
       VW/2, 250, '#6a6070', 7, 'center');
}

function drawEndScreen(c, win){
  c.fillStyle = win ? 'rgba(6,26,12,.62)' : 'rgba(40,6,6,.62)';
  c.fillRect(0,0,VW,VH);
  panel(c, 84, 62, VW-168, 150, win?'#7ddc6a':'#d8443c');
  text(c, win?'EXPEDITION COMPLETE':'PARTY WIPED', VW/2, 74, win?'#7ddc6a':'#ff6a5a', 12, 'center');

  const rows = [
    ['ENEMIES FELLED', String(G.kills)],
    ['DAMAGE DEALT',  String(Math.round(G.dmgDealt))],
    ['DAMAGE TAKEN',  String(Math.round(G.dmgTaken))],
    ['LIVES LEFT',    String(Math.max(0,G.lives))],
    ['DRAGON BOND',   String(dragon.bond)],
    ['FINAL FORM',    dragonFormName().toUpperCase()],
    ['TIME',          G.runTime.toFixed(1)+'S']
  ];
  rows.forEach((r,i)=>{
    text(c, r[0], 100, 98+i*13, '#8a7fa0', 7);
    text(c, r[1], VW-100, 98+i*13, '#ffd98a', 7, 'right');
  });

  if(Math.sin(G.time*5) > -0.3)
    text(c,'PRESS R TO REDEPLOY', VW/2, 192, '#ffffff', 8, 'center');
}

function drawPause(c){
  c.fillStyle='rgba(0,0,0,.6)'; c.fillRect(0,0,VW,VH);
  panel(c, 160, 110, 160, 50);
  text(c,'PAUSED', VW/2, 122, '#ffd98a', 11, 'center');
  text(c,'PRESS P TO RESUME', VW/2, 142, '#c0b8d0', 7, 'center');
}

// ============================================================================
// CAMERA + RENDER
// ============================================================================
function updateCamera(dt){
  const tx = clamp(player.x - VW/2, 0, WORLD_W-VW);
  const ty = clamp(player.y - VH/2, 0, WORLD_H-VH);
  G.cam.x = lerp(G.cam.x, tx, Math.min(1, dt*6));
  G.cam.y = lerp(G.cam.y, ty, Math.min(1, dt*6));
}

function render(){
  const c = ctx;
  c.fillStyle='#14101a'; c.fillRect(0,0,VW,VH);

  if(G.state===ST.TITLE){ drawTitle(c); return; }

  let ox = -Math.round(G.cam.x), oy = -Math.round(G.cam.y);
  if(G.shake>0.2){
    ox += Math.round((Math.random()-0.5)*G.shake);
    oy += Math.round((Math.random()-0.5)*G.shake);
  }

  c.save();
  c.translate(ox, oy);

  c.drawImage(terrainCv, 0, 0);

  for(const p of G.pickups) drawPickup(c, p);

  // telegraphs sit under the actors so they never hide an incoming attack
  for(const e of G.enemies) if(!e.dead) drawTelegraph(c, e);

  // depth-sort everything that stands on the ground
  const actors = [];
  for(const e of G.enemies) actors.push({ y:e.y, kind:'e', ref:e });
  actors.push({ y:player.y, kind:'p' });
  for(const b of dragonBodies()) actors.push({ y:b.y+40, kind:'d' });  // dragon flies, draw late
  actors.sort((a,b)=>a.y-b.y);
  let dragonDrawn = false;
  for(const a of actors){
    if(a.kind==='e') drawEnemy(c, a.ref);
    else if(a.kind==='p') drawPlayer(c);
    else if(!dragonDrawn){ drawDragon(c); dragonDrawn = true; }
  }

  drawHitmarks(c);
  drawParticles(c);
  drawFloats(c);

  c.restore();

  // heat / damage vignette
  if(player.hurtFlash>0){
    c.fillStyle='rgba(200,30,20,'+(player.hurtFlash*0.5)+')';
    c.fillRect(0,0,VW,VH);
  }
  if(G.flash>0){ c.fillStyle='rgba(255,220,180,'+Math.min(0.4,G.flash*0.5)+')'; c.fillRect(0,0,VW,VH); }

  const gr=c.createRadialGradient(VW/2,VH/2,90,VW/2,VH/2,290);
  gr.addColorStop(0,'rgba(0,0,0,0)'); gr.addColorStop(1,'rgba(0,0,0,.42)');
  c.fillStyle=gr; c.fillRect(0,0,VW,VH);

  drawHUD(c);

  if(G.state===ST.REFINERY) drawRefinery(c);
  else if(G.state===ST.PAUSE) drawPause(c);
  else if(G.state===ST.WIPE) drawEndScreen(c, false);
  else if(G.state===ST.CLEAR) drawEndScreen(c, true);
}

// ============================================================================
// MAIN LOOP
// ============================================================================
let last = performance.now();

function frame(now){
  let dt = (now-last)/1000; last = now;
  dt = Math.min(dt, 0.05);
  G.time += dt;

  if(G.state===ST.PLAY){
    // hitlag: freeze the sim briefly so heavy hits land with weight
    if(G.hitlag>0){ G.hitlag -= dt; }
    else {
      G.runTime += dt;
      updatePending(dt);
      updatePlayer(dt);
      updateDragon(dt);
      updateEnemies(dt);
      updatePickups(dt);
      updateWaves(dt);
    }
    updateParticles(dt);
    updateCamera(dt);
    G.shake = Math.max(0, G.shake - dt*16);
    G.flash = Math.max(0, G.flash - dt*2.4);
    G.toastT = Math.max(0, G.toastT - dt);
  } else if(G.state===ST.REFINERY || G.state===ST.PAUSE){
    updateParticles(dt*0.25);
    G.toastT = Math.max(0, G.toastT - dt);
  } else {
    updateParticles(dt);
  }

  render();
  requestAnimationFrame(frame);
}

// ============================================================================
// INPUT
// ============================================================================
const keys = Object.create(null);

function startRun(){
  G.wave=1; G.lives=5; G.kills=0; G.dmgDealt=0; G.dmgTaken=0; G.runTime=0;
  G.enemies.length=0; G.particles.length=0; G.floats.length=0;
  G.pickups.length=0; G.hitmarks.length=0; pending.length=0;
  G.betweenWaves=0; G.hitlag=0; G.shake=0;
  generateArena(0x51f + Math.floor(Math.random()*9999));
  player.x=SPAWN_TX*TILE+8; player.y=SPAWN_TY*TILE+8;
  player.hp=player.maxhp; player.momentum=0; player.iframe=1.0;
  player.atkState=''; player.dodgeT=0; player.chargeT=0; player.tempestT=0; player.castT=0;
  player.cds=[0,0,0,0];
  dragon.x=player.x+16; dragon.y=player.y-12;
  dragon.x2=player.x-16; dragon.y2=player.y-12;
  dragon.breathCd=0; dragon.shieldCd=0;
  G.cam.x = clamp(player.x-VW/2, 0, WORLD_W-VW);
  G.cam.y = clamp(player.y-VH/2, 0, WORLD_H-VH);
  G.state=ST.PLAY;
  spawnWave(1);
}

window.addEventListener('keydown', e=>{
  const k = e.key.toLowerCase();
  if(!keys[k]) keys[k+'_pressed'] = true;
  keys[k]=true;
  if([' ','arrowup','arrowdown','arrowleft','arrowright','tab'].includes(k)) e.preventDefault();
  Sfx.resume();

  if(k==='m'){ Sfx.toggle(); toast(Sfx.isMuted()?'MUTED':'UNMUTED'); return; }

  if(G.state===ST.TITLE){ if(k==='enter'||k===' ') startRun(); return; }
  if(G.state===ST.WIPE || G.state===ST.CLEAR){ if(k==='r') startRun(); return; }

  if(G.state===ST.REFINERY){
    if(k==='tab'||k==='escape') closeRefinery();
    else if(k==='w'||k==='arrowup')    refineryMove(-1);
    else if(k==='s'||k==='arrowdown')  refineryMove(1);
    else if(k==='a'||k==='arrowleft'){ refinery.pane=0; refinery.cursor=clamp(refinery.cursor,0,SLOTS-1); Sfx.ui(); }
    else if(k==='d'||k==='arrowright'){ refinery.pane=1; refinery.cursor=clamp(refinery.cursor,0,Math.max(0,inventory.length-1)); Sfx.ui(); }
    else if(k==='enter'||k===' ')      refineryConfirm();
    return;
  }

  if(G.state===ST.PAUSE){ if(k==='p') G.state=ST.PLAY; return; }

  if(G.state===ST.PLAY){
    if(k==='p'){ G.state=ST.PAUSE; return; }
    if(k==='tab'){ openRefinery(); return; }
    if(k===' ') startDodge();
    else if(k==='j') startAttack();
    else if(k==='q') emberBreath();
    else if(k>='1' && k<='4') useAbility(parseInt(k)-1);
    else if(k==='r') startRun();
  }
});
window.addEventListener('keyup', e=>{ keys[e.key.toLowerCase()]=false; });
window.addEventListener('blur', ()=>{
  for(const k in keys) keys[k]=false;
  if(G.state===ST.PLAY) G.state=ST.PAUSE;
});
canvas.addEventListener('mousedown', e=>{
  Sfx.resume();
  if(G.state===ST.TITLE) startRun();
  else if(G.state===ST.PLAY) startAttack();
  else if(G.state===ST.WIPE || G.state===ST.CLEAR) startRun();
});
canvas.addEventListener('contextmenu', e=>e.preventDefault());

// ============================================================================
// BOOT
// ============================================================================
refreshMods();
generateArena(0x51f);
dragon.x = player.x+16; dragon.y = player.y-12;
dragon.x2 = player.x-16; dragon.y2 = player.y-12;
G.cam.x = clamp(player.x-VW/2, 0, WORLD_W-VW);
G.cam.y = clamp(player.y-VH/2, 0, WORLD_H-VH);
G.state = ST.TITLE;
requestAnimationFrame(frame);
console.log('WILDFIRE slice booted —', VW+'x'+VH, '| arena', MAP_W+'x'+MAP_H,
            '| mutations', MUTATIONS.length);
