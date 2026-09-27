
// ============================================================================
// PARTICLES, EFFECTS, SPRITES
// ============================================================================

function spark(x,y,col,s){
  if(G.particles.length>360) return;
  G.particles.push({ x, y, vx:(Math.random()-0.5)*70, vy:-24-Math.random()*50,
    life:0.22+Math.random()*0.26, max:0.5, kind:'spark', col, s:s||1 });
}
function floatText(x,y,txt,col,big){
  G.floats.push({ x, y, txt, col, life:0.85, max:0.85, big:!!big, vy:-26 });
}

function updateParticles(dt){
  for(let i=G.particles.length-1;i>=0;i--){
    const p=G.particles[i];
    p.life-=dt;
    if(p.life<=0){ G.particles.splice(i,1); continue; }
    if(p.kind==='flame'){ p.vy -= 26*dt; p.vx *= 0.94; }
    else if(p.kind==='wisp'){ p.vy -= 10*dt; p.vx *= 0.96; }
    else if(p.kind==='frost'){ p.vy += 30*dt; }
    else if(p.kind==='debris'){ p.vy += 210*dt; }
    else { p.vy += 150*dt; }
    p.x += p.vx*dt; p.y += p.vy*dt;
  }
  for(let i=G.floats.length-1;i>=0;i--){
    const f=G.floats[i]; f.life-=dt; f.y += f.vy*dt; f.vy *= 0.90;
    if(f.life<=0) G.floats.splice(i,1);
  }
  for(let i=G.hitmarks.length-1;i>=0;i--){
    const h=G.hitmarks[i]; h.life-=dt; if(h.life<=0) G.hitmarks.splice(i,1);
  }
}

function drawParticles(c){
  for(const p of G.particles){
    const a = p.life/p.max;
    const X=Math.round(p.x), Y=Math.round(p.y);
    let col = p.col;
    if(p.kind==='flame') col = a>0.66?'#fff0c0':(a>0.33?p.col:'#a8341a');
    else if(p.kind==='spark') col = a>0.5?p.col:'#8a5a2a';
    const sz = Math.max(1, Math.round((p.kind==='debris'?2:1.6)*p.s));
    c.fillStyle = col;
    c.fillRect(X,Y,sz,sz);
  }
}

function drawFloats(c){
  for(const f of G.floats){
    const a = Math.min(1, f.life*2.2);
    c.globalAlpha = a;
    const size = f.big?9:7;
    c.font = size+'px ui-monospace, "Courier New", monospace';
    c.textAlign='center'; c.textBaseline='top';
    c.fillStyle='#14100f';
    c.fillText(f.txt, Math.round(f.x)+1, Math.round(f.y)+1);
    c.fillStyle=f.col;
    c.fillText(f.txt, Math.round(f.x), Math.round(f.y));
  }
  c.globalAlpha=1; c.textAlign='left';
}

// ---------------------------------------------------------------- hit effects
function drawHitmarks(c){
  for(const h of G.hitmarks){
    const t = 1 - h.life/h.max;
    switch(h.kind){
      case 'slash': {
        // fast crescent sweeping through the arc
        const sweep = h.ang - h.arc/2 + h.arc*t;
        c.strokeStyle = h.heavy ? '#ffe6a8' : '#e8e2d4';
        c.lineWidth = h.heavy ? 3 : 2;
        c.beginPath();
        c.arc(Math.round(h.x), Math.round(h.y)-6, h.range*0.82, sweep-0.5, sweep+0.5);
        c.stroke();
        break;
      }
      case 'cleave': {
        c.strokeStyle = h.emp ? '#ffb43c' : '#ffe6a8';
        c.lineWidth = h.emp ? 4 : 3;
        c.globalAlpha = 1-t;
        c.beginPath();
        c.arc(Math.round(h.x), Math.round(h.y)-6, h.range*(0.6+t*0.5), h.ang-h.arc/2, h.ang+h.arc/2);
        c.stroke();
        if(h.emp){
          c.strokeStyle='#fff0c8'; c.lineWidth=1;
          c.beginPath();
          c.arc(Math.round(h.x), Math.round(h.y)-6, h.range*(0.6+t*0.5)+4, h.ang-h.arc/2, h.ang+h.arc/2);
          c.stroke();
        }
        c.globalAlpha=1;
        break;
      }
      case 'quake': {
        // shockwave racing outward along a line, throwing up dirt
        const reach = h.len*t;
        const cx=Math.cos(h.ang), cy=Math.sin(h.ang);
        for(let d=0; d<reach; d+=5){
          const w = 5 + d*0.14;
          const px2 = h.x+cx*d, py2 = h.y+cy*d-4;
          c.fillStyle = d>reach-14 ? '#ffb43c' : 'rgba(150,110,60,'+(0.55*(1-t))+')';
          c.fillRect(Math.round(px2-w/2), Math.round(py2-2), Math.round(w), 4);
        }
        break;
      }
      case 'breath': {
        const a=1-t;
        c.globalAlpha = a*0.8;
        c.fillStyle = h.col;
        const cx=Math.cos(h.ang), cy=Math.sin(h.ang);
        for(let d=6; d<58; d+=4){
          const w = 3 + d*0.30;
          c.fillRect(Math.round(h.x+cx*d-w/2), Math.round(h.y+cy*d-w/2), Math.round(w), Math.round(w));
        }
        c.globalAlpha=1;
        break;
      }
      case 'pound': {
        c.strokeStyle = 'rgba(255,120,60,'+(1-t)+')';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(Math.round(h.x), Math.round(h.y), h.r*t, 0, Math.PI*2);
        c.stroke();
        break;
      }
      case 'lunge': {
        c.strokeStyle = 'rgba(255,90,60,'+(1-t)+')';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(Math.round(h.x), Math.round(h.y)-4);
        c.lineTo(Math.round(h.x+Math.cos(h.ang)*h.range), Math.round(h.y+Math.sin(h.ang)*h.range)-4);
        c.stroke();
        break;
      }
      case 'chain': {
        c.strokeStyle = '#ffe14a'; c.lineWidth=1;
        c.globalAlpha = 1-t;
        c.beginPath();
        // jagged arc between the two targets
        const steps=4;
        c.moveTo(Math.round(h.ax), Math.round(h.ay));
        for(let i=1;i<=steps;i++){
          const q=i/steps;
          c.lineTo(Math.round(lerp(h.ax,h.bx,q)+(Math.random()-0.5)*6),
                   Math.round(lerp(h.ay,h.by,q)+(Math.random()-0.5)*6));
        }
        c.stroke(); c.globalAlpha=1;
        break;
      }
    }
  }
}

// ---------------------------------------------------------------- telegraphs
function drawTelegraph(c, e){
  const T0 = ENEMY_TYPES[e.kind];
  if(e.state!=='wind') return;
  const t = e.stateT / T0.windup;
  const pulse = 0.35 + 0.65*t;
  if(e.kind==='golem'){
    c.strokeStyle = 'rgba(255,60,40,'+pulse+')';
    c.lineWidth = 1;
    c.beginPath(); c.arc(Math.round(e.x), Math.round(e.y), T0.range+8, 0, Math.PI*2); c.stroke();
    c.fillStyle = 'rgba(255,60,40,'+(0.10+0.16*t)+')';
    c.beginPath(); c.arc(Math.round(e.x), Math.round(e.y), (T0.range+8)*t, 0, Math.PI*2); c.fill();
  } else {
    const a = Math.atan2(player.y-e.y, player.x-e.x);
    c.strokeStyle = 'rgba(255,80,50,'+pulse+')';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(Math.round(e.x), Math.round(e.y)-4);
    c.lineTo(Math.round(e.x+Math.cos(a)*T0.range*t), Math.round(e.y+Math.sin(a)*T0.range*t)-4);
    c.stroke();
  }
}

// ============================================================================
// THE IRONCLAD SPRITE — 16x24. Heavy plate, brass shoulder gears, greatsword.
// Warm steel and copper with amber accents; wide shoulders so the silhouette
// reads as "raw power" at this size (Concept Art Prompts, Ironclad).
// ============================================================================

const IC = {
  plate:'#8a8a92', plateD:'#5e5e68', plateL:'#b4b4bd',
  copper:'#b5703a', copperD:'#8a4f25', copperL:'#d59a5e',
  brass:'#c8a13c', brassL:'#e8c866', brassD:'#98771f',
  cloth:'#5a3a52', clothD:'#3f2839',
  skin:'#f0c39a', skinD:'#c98f68',
  blade:'#d8dee9', bladeD:'#9aa3b0', bladeL:'#f2f6ff',
  amber:'#ffb43c', amberL:'#ffe08a'
};

function drawPlayer(c){
  const X = Math.round(player.x), Yb = Math.round(player.y);
  // blink out on i-frames so damage state is readable
  if(player.iframe>0 && player.hurtFlash<=0 && Math.floor(player.iframe*20)%2) return;

  const rolling = player.dodgeT>0;
  const bob = player.moving && !rolling ? (player.frame===1?-1:player.frame===3?1:0) : 0;
  const top = Yb - 22 + bob;
  const dir = player.dir;                       // 0 down, 1 up, 2 left, 3 right
  const side = dir===2 ? -1 : 1;

  px(c,'rgba(20,12,8,.34)', X-6, Yb-1, 12, 4);   // ground shadow

  if(rolling){ drawIroncladRoll(c, X, Yb, top); return; }

  // --- legs
  const sw = player.moving ? (player.frame%2 ? 2 : -2) : 0;
  px(c,IC.plateD, X-4+(sw>0?1:0), top+16, 3, 6);
  px(c,IC.plateD, X+1-(sw<0?1:0), top+16, 3, 6);
  px(c,IC.copperD, X-4, top+21, 4, 2);
  px(c,IC.copperD, X+1, top+21, 4, 2);

  // --- torso / cuirass
  px(c,IC.plateD, X-5, top+8, 11, 9);
  px(c,IC.plate,  X-4, top+8, 9, 8);
  px(c,IC.plateL, X-4, top+8, 9, 1);
  px(c,IC.copper, X-4, top+13, 9, 2);            // copper belt band
  px(c,IC.copperL,X-4, top+13, 9, 1);
  px(c,IC.amber,  X-1, top+10, 2, 2);            // chest aethite
  px(c,IC.amberL, X-1, top+10, 1, 1);

  // --- pauldrons with exposed brass gears. These are the class's silhouette
  // tell: wide shoulders reading as raw power even at 16px wide.
  for(const s of [-1, 1]){
    const sx = X + s*7;
    px(c,IC.copperD, sx-3, top+5, 6, 7);          // outer shell
    px(c,IC.copper,  sx-2, top+6, 5, 5);
    px(c,IC.copperL, sx-2, top+5, 5, 1);
    px(c,IC.copperD, sx-3, top+11, 6, 1);         // underplate lip
    px(c,IC.brassD,  sx-2, top+7, 4, 4);          // exposed gear
    px(c,IC.brass,   sx-1, top+8, 2, 2);
    px(c,IC.brassL,  sx-1, top+8, 1, 1);
    px(c,IC.brassD,  sx-2, top+7, 1, 1);          // gear teeth
    px(c,IC.brassD,  sx+1, top+10, 1, 1);
  }
  // steam vent puffs from the shoulders when moving hard
  if(player.moving && Math.random()<0.08)
    G.particles.push({x:X+(Math.random()<0.5?-6:6), y:top+5, vx:(Math.random()-0.5)*8, vy:-16,
      life:0.32, max:0.4, kind:'wisp', col:'#d8dee9', s:1});

  // --- head + helmet
  if(dir===1){                                    // facing away
    px(c,IC.plateD, X-3, top+1, 7, 7);
    px(c,IC.plate,  X-3, top+1, 6, 6);
    px(c,IC.copper, X-3, top+1, 6, 2);
  } else {
    px(c,IC.skinD, X-3, top+2, 6, 6);
    px(c,IC.skin,  X-3, top+2, 6, 5);
    px(c,IC.plateD,X-4, top,   8, 4);             // helm
    px(c,IC.plate, X-4, top,   8, 3);
    px(c,IC.plateL,X-4, top,   8, 1);
    px(c,IC.copper,X-4, top+3, 8, 1);             // brow band
    px(c,IC.amber, X+(dir===2?-4:2), top+1, 2, 1);// helm crystal
    // eyes
    px(c,'#2a1d17', dir===2 ? X-2 : X+1, top+5, 1, 1);
    if(dir===0) px(c,'#2a1d17', X-2, top+5, 1, 1);
  }

  drawGreatsword(c, X, top, dir, side);
}

function drawIroncladRoll(c, X, Yb, top){
  // tuck into a ball of plate — reads instantly as "I am invulnerable right now"
  const t = 1 - player.dodgeT/0.34;
  const spin = Math.floor(t*4)%4;
  const cy = Yb-9 + Math.round(Math.sin(t*Math.PI)*-3);
  px(c,IC.plateD, X-6, cy-6, 12, 12);
  px(c,IC.plate,  X-5, cy-5, 10, 10);
  px(c,IC.copper, X-5, cy-5+spin*2, 10, 2);
  px(c,IC.brass,  X-2+((spin%2)?2:-2), cy-1, 3, 3);
  px(c,IC.amber,  X-1, cy-1, 1, 1);
  if(player.iframe>0){
    c.strokeStyle='rgba(255,224,138,.5)'; c.lineWidth=1;
    c.beginPath(); c.arc(X, cy, 9, 0, Math.PI*2); c.stroke();
  }
}

function drawGreatsword(c, X, top, dir, side){
  // Swing angle is driven by attack progress so the blade actually travels
  // through the arc the hitbox uses.
  let ang = null, len = 17, cock = false;
  const baseAng = Math.atan2(player.dy, player.dx);

  if(player.atkState==='wind'){
    cock = true;
    ang = baseAng - 1.5*(player.comboStep===2 ? 1.25 : 1);
  } else if(player.atkState==='active'){
    const C = COMBO[player.comboStep];
    const t = clamp(player.atkT / C.active, 0, 1);
    ang = baseAng - C.arc/2 + C.arc*t;
    len = 19;
  } else if(player.atkState==='recover'){
    const C = COMBO[player.comboStep];
    ang = baseAng + C.arc/2;
    len = 17;
  } else if(player.tempestT>0){
    ang = (0.52 - player.tempestT) * 26;          // whirling
    len = 21;
  } else if(player.castT>0 && player.castKind===0){
    ang = baseAng - 2.0; cock = true; len = 19;   // Forge Cleave wind-up
  } else if(player.castT>0 && player.castKind===3){
    ang = -Math.PI/2; cock = true; len = 20;      // Earthsplitter raised overhead
  }

  const ox = X, oy = top + 12;

  if(ang===null){
    // resting: slung across the back / held at the side
    const rx = ox + side*7;
    px(c,IC.bladeD, rx-1, top+2, 3, 15);
    px(c,IC.blade,  rx-1, top+2, 2, 14);
    px(c,IC.bladeL, rx-1, top+2, 1, 6);
    px(c,IC.copperD,rx-2, top+15, 5, 3);          // crossguard
    px(c,IC.brass,  rx-1, top+17, 2, 4);          // grip
    px(c,IC.amber,  rx-1, top+13, 2, 2);          // aethite in the blade
    return;
  }

  const cosA=Math.cos(ang), sinA=Math.sin(ang);
  // hilt sits just off the body, blade extends outward
  const hx = ox + cosA*5, hy = oy + sinA*4;
  for(let d=0; d<len; d++){
    const bx = hx + cosA*d, by = hy + sinA*d*0.72;   // squash vertically for the tilted camera
    const w = d<2 ? 3 : (d>len-4 ? 2 : 3);
    px(c, d>len-5 ? IC.bladeL : (d%3===0?IC.bladeL:IC.blade), bx-w/2, by-1, w, 2);
  }
  // crossguard + aethite core
  px(c,IC.copperD, hx-2, hy-2, 4, 4);
  px(c,IC.copper,  hx-2, hy-2, 3, 3);
  px(c,IC.amber,   hx + cosA*7 - 1, hy + sinA*5 - 1, 2, 2);

  // motion trail on the active frames
  if(player.atkState==='active' || player.tempestT>0){
    c.strokeStyle = player.comboStep===2 ? 'rgba(255,224,138,.55)' : 'rgba(230,230,220,.40)';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(Math.round(ox), Math.round(oy), len*0.9, ang-0.55, ang+0.06);
    c.stroke();
  }
  if(cock){
    // charge glow while winding up a heavy
    c.strokeStyle='rgba(255,180,60,.35)'; c.lineWidth=1;
    c.beginPath(); c.arc(Math.round(ox), Math.round(oy), len*0.85, ang-0.3, ang+0.3); c.stroke();
  }
}

// ============================================================================
// ENEMY SPRITES
// ============================================================================

function drawEnemy(c, e){
  const T0 = ENEMY_TYPES[e.kind];
  const X = Math.round(e.x), Y = Math.round(e.y);
  const col = T0.col;
  const hurt = e.flash>0;
  const tele = e.state==='wind';
  const dying = e.dead;

  if(dying){
    const t = 1 - e.deadT/0.4;
    c.globalAlpha = 1-t;
    px(c, PAL.ironD, X-e.r, Y-e.r, e.r*2, e.r*2);
    c.globalAlpha = 1;
    return;
  }

  px(c,'rgba(20,12,8,.30)', X-e.r, Y+e.r-3, e.r*2, 3);

  const body  = hurt ? '#ffffff' : (tele ? shade(col.body, 1.25) : col.body);
  const bodyD = hurt ? '#ffd0d0' : col.bodyD;
  const bob = Math.round(Math.sin(e.bob)*1.2);

  if(e.kind==='rat'){
    // low, long-bodied scavenger — pointed snout, scrap plate on its back,
    // coiled wire tail. Silhouette has to read at a glance next to a drone.
    const f = e.facing, B = Y+bob;
    const step = Math.floor(e.anim)%2 ? 1 : 0;
    // hind + fore legs
    px(c,'#2f2318', X-4*f, B+2, 2, 4);
    px(c,'#2f2318', X+2*f, B+2, 2, 4);
    px(c,'#2f2318', X-1*f, B+3, 2, 3-step);
    // body: low slung, tapering to the head
    px(c,bodyD, X-5, B-3, 11, 6);
    px(c,body,  X-4, B-2, 9,  4);
    // riveted scrap plate hunched over the spine
    px(c,col.metal,  X-4, B-4, 8, 2);
    px(c,'#c9c5bd',  X-4, B-4, 8, 1);
    px(c,'#3a3630',  X-2, B-4, 1, 2);
    px(c,'#3a3630',  X+1, B-4, 1, 2);
    // head: wedge-shaped snout thrust forward
    px(c,bodyD, X+4*f-(f>0?0:3), B-3, 4, 5);
    px(c,body,  X+4*f-(f>0?0:2), B-2, 3, 3);
    px(c,bodyD, X+7*f-(f>0?0:2), B-1, 3, 2);            // snout
    px(c,'#d8d4cc', X+9*f-(f>0?0:1), B, 1, 1);          // incisor glint
    px(c,col.eye,   X+5*f-(f>0?0:1), B-2, 1, 1);
    px(c,col.metal, X+3*f, B-6, 1, 3);                  // ear / antenna
    // coiled wire tail
    px(c,col.metal, X-6*f-(f>0?0:1), B-1, 3, 1);
    px(c,col.metal, X-8*f-(f>0?0:1), B-2, 2, 1);
    px(c,col.metal, X-9*f-(f>0?0:1), B-4, 1, 3);
  }
  else if(e.kind==='drone'){
    const hover = Math.round(Math.sin(e.bob*1.6)*2);
    // rotor
    const spin = Math.floor(e.anim*3)%2;
    px(c,col.metal, X-(spin?7:3), Y-9+hover, spin?14:6, 1);
    px(c,col.bodyD, X-1, Y-9+hover, 2, 3);
    // chassis
    px(c,bodyD, X-5, Y-6+hover, 10, 8);
    px(c,body,  X-4, Y-5+hover, 8, 6);
    px(c,col.metal, X-4, Y-5+hover, 8, 1);
    px(c,col.metal, X-5, Y-1+hover, 10, 1);
    px(c,'#2a2320', X-3, Y-4+hover, 6, 3);          // eye housing
    px(c,col.eye,  X-1+(e.facing>0?1:-1), Y-4+hover, 2, 2);
    px(c,'#1a1418', X-4, Y+2+hover, 3, 2);          // grabber claws
    px(c,'#1a1418', X+2, Y+2+hover, 3, 2);
  }
  else if(e.kind==='golem'){
    // hunched brute welded out of hauler scrap: small sunken head, huge
    // fists that hang past its knees, amber furnace burning in the chest
    const B = Y+bob, f = e.facing;
    const wind = e.state==='wind' ? Math.round(e.stateT*8) : 0;   // rears up to pound

    // legs — short and planted
    px(c,'#3a2216', X-7, B+1, 6, 6);
    px(c,'#3a2216', X+1, B+1, 6, 6);
    px(c,col.metal, X-7, B+6, 6, 2);
    px(c,col.metal, X+1, B+6, 6, 2);

    // torso — broad at the shoulders, narrowing to the waist
    px(c,bodyD, X-9, B-13-wind, 18, 11);
    px(c,body,  X-8, B-12-wind, 16, 9);
    px(c,bodyD, X-6, B-3-wind,  12, 4);                  // waist
    px(c,body,  X-5, B-3-wind,  10, 3);
    // riveted shoulder yoke
    px(c,col.metal, X-9, B-14-wind, 18, 3);
    px(c,'#a8a49c', X-9, B-14-wind, 18, 1);
    px(c,'#3a3630', X-6, B-13-wind, 1, 2);
    px(c,'#3a3630', X+5, B-13-wind, 1, 2);

    // furnace core
    px(c,'#2a1810', X-4, B-10-wind, 8, 6);
    px(c,col.eye,   X-3, B-9-wind,  6, 4);
    px(c,'#fff0c0', X-3, B-9-wind,  3, 1);
    px(c,'#ff7b2e', X-1, B-8-wind,  2, 2);
    if(Math.random()<0.10)
      G.particles.push({x:X+(Math.random()-0.5)*6, y:B-10-wind, vx:(Math.random()-0.5)*8,
        vy:-18, life:0.34, max:0.45, kind:'flame', col:'#ffa43c', s:1});

    // small sunken head with a single optic
    px(c,bodyD, X-3, B-19-wind, 6, 6);
    px(c,body,  X-2, B-18-wind, 4, 4);
    px(c,'#2a1810', X-2, B-17-wind, 4, 2);
    px(c,col.eye,   X+(f>0?0:-1), B-17-wind, 2, 2);
    px(c,col.metal, X-4, B-20-wind, 8, 2);               // brow plate

    // arms — long, ending in oversized fists
    for(const s of [-1, 1]){
      const ax = X + s*12;
      px(c,bodyD, ax-3, B-12-wind, 6, 9);                // upper arm
      px(c,body,  ax-2, B-11-wind, 4, 7);
      px(c,bodyD, ax-4, B-4-wind,  8, 7);                // fist
      px(c,body,  ax-3, B-3-wind,  6, 5);
      px(c,col.metal, ax-4, B-4-wind, 8, 2);
      px(c,'#3a3630', ax-1, B-2-wind, 1, 3);             // knuckle seam
    }
  }

  // status icons above the head
  let iy = Y - e.r - 12;
  if(e.burn>0){ px(c,'#ff9a3c', X-6, iy, 2, 2); px(c,'#ffd24a', X-6, iy-2, 2, 2); }
  if(e.slow>0){ px(c,'#8fd6ff', X-2, iy, 3, 3); px(c,'#d8f4ff', X-2, iy, 1, 1); }
  if(e.stagger>0){
    const s = Math.sin(G.time*14);
    px(c,'#c9a2ff', X+3+Math.round(s*2), iy-1, 2, 2);
    px(c,'#ffffff', X+6-Math.round(s*2), iy+1, 2, 2);
  }

  // HP pip bar for anything that isn't at full health
  if(e.hp < e.maxhp){
    const w = e.r*2+4;
    px(c,'#2a1614', X-w/2, Y-e.r-8, w, 3);
    px(c,'#d8443c', X-w/2, Y-e.r-8, Math.max(1, Math.round(w*(e.hp/e.maxhp))), 3);
    px(c,'#ff9a90', X-w/2, Y-e.r-8, Math.max(1, Math.round(w*(e.hp/e.maxhp))), 1);
  }
}

function shade(hex, mul){
  const p=s=>[parseInt(s.slice(1,3),16),parseInt(s.slice(3,5),16),parseInt(s.slice(5,7),16)];
  const A=p(hex);
  return '#'+A.map(v=>clamp(Math.round(v*mul),0,255).toString(16).padStart(2,'0')).join('');
}

// ---------------------------------------------------------------- pickups
function drawPickup(c, p){
  const X=Math.round(p.x), Y=Math.round(p.y) + Math.round(Math.sin(G.time*3+p.phase)*2);
  const mu = MUT_BY_ID[p.id];
  const col = mu.cat==='Elemental' ? '#ff9a3c'
            : mu.cat==='Physical'  ? '#7ddc6a'
            : mu.cat==='Stat'      ? '#c9a2ff' : '#8fd6ff';
  px(c,'rgba(20,12,8,.3)', X-4, Y+6, 8, 2);
  // glowing aethite shard
  px(c,'#2a1d2c', X-4, Y-5, 8, 10);
  px(c,col,       X-3, Y-4, 6, 8);
  px(c,'#ffffff', X-2, Y-3, 2, 2);
  const pulse = 0.4+0.35*Math.sin(G.time*6+p.phase);
  c.globalAlpha = pulse;
  px(c,col, X-6, Y-7, 12, 14);
  c.globalAlpha = 1;
}
