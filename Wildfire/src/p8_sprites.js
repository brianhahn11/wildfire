
// ============================================================================
// SPRITES — 16x24 humanoids, 12x12 dragons, creatures.
// Everything is built from a shared humanoid base plus per-class overlays, so
// nine silhouettes stay consistent in proportion while reading differently.
// ============================================================================

// When set, every sprite pixel is drawn in this colour instead of its own.
// The codex uses it to render unrecorded creatures as silhouettes, which means
// the silhouette is always exactly the real sprite and there is no second set
// of art to keep in sync. Drawing the sprite and then covering it with a dark
// rectangle — the obvious approach — just paints a dark rectangle.
let SILHOUETTE = null;

function px(c,col,x,y,w,h){
  c.fillStyle = SILHOUETTE || col;
  if(ART_UNIT === 1){ c.fillRect(Math.round(x),Math.round(y),w||1,h||1); return; }
  const k = 1/ART_UNIT;
  c.fillRect(Math.round(x)*k, Math.round(y)*k, (w||1)*k, (h||1)*k);
}

// Mirrored rect: draws a `w`-wide block starting `inset` out from X on side
// `sd`. Canvas quietly normalises a negative width, so `px(c,col,X+sd*3,y,sd*7,h)`
// looks like it works — until it is rendered anywhere that doesn't, and a
// creature's wings silently disappear. Compute the left edge instead.
function pxm(c,col,X,sd,inset,y,w,h){
  px(c, col, sd>0 ? X+inset : X-inset-w, y, w, h);
}

// ---------------------------------------------------------------------------
// HUMANOID BASE
// look: { prim, primD, primL, accent, accentL, trim, skin, skinD, hair, hairD }
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// THE HUMANOID
//
// Authored at device density: 28 wide by 48 tall, origin at the feet. The
// anchors it returns are in WORLD units, because the nine class overlays are
// still authored in world units and position themselves off them — that
// contract is what lets the base be redrawn without touching any of them.
//
// Light from the upper left, per the rule in p3_tiles.js: lit edge down the
// left of every limb and across every top face, shadow down the right, and an
// occlusion line where one form sits in front of another.
//
// WALK: eight frames. sw is the leg swing, in device units, and the sequence
// gives each leg a contact, a low, a pass and a high. The old four had two
// identical entries and was really three poses.
// IDLE: four frames of breathing. There was none at all before — stop moving
// and the character froze, which on the thing you look at every second of the
// game was the most visible gap in it.
// ---------------------------------------------------------------------------
const WALK_LEG  = [0, 3, 5, 3, 0, -3, -5, -3];   // device units, fore/aft
const WALK_BOB  = [0, -1, -2, -1, 0, -1, -2, -1];
const WALK_ARM  = [0, -2, -3, -2, 0, 2, 3, 2];
const IDLE_BOB  = [0, -1, 0, 0];
const IDLE_ARM  = [0, 0, 1, 0];

function drawHumanoid(c, X, Yb, dir, frame, moving, look, opts){
  opts = opts||{};
  const f8 = frame|0;
  const idle = (player && player.idleFr!==undefined ? player.idleFr : 0) & 3;
  const bobA = moving ? WALK_BOB[f8 & 7] : IDLE_BOB[idle];
  const swA  = moving ? WALK_LEG[f8 & 7] : 0;
  const armA = moving ? WALK_ARM[f8 & 7] : IDLE_ARM[idle];

  const side = dir===2 ? -1 : 1;
  const back = dir===1;
  // world-unit anchors for the overlays, unchanged in meaning
  const top  = Yb - 23 + Math.round(bobA/2);

  withArt(ART, ()=>{
    // Device space. 48 tall from the feet, and deliberately NARROW: the first
    // pass was 26 wide against 48 tall and read as a barrel. A figure this
    // size wants roughly a 1:3 shoulder-to-height ratio or it looks squat at
    // any amount of detail.
    //
    //   head+hair  T0+0  .. T0+15    torso  T0+15 .. T0+27
    //   legs       T0+26 .. T0+42    boots  T0+42 .. T0+46
    //
    // Legs are a third of the height. The first pass gave them a quarter and
    // the figure read as a toddler in a long coat.
    const AX = X*ART, AB = Yb*ART, T0 = AB - 46 + bobA;
    const P  = look.prim, PD = look.primD, PL = look.primL;

    // ---- the shadow it stands in
    px(c, 'rgba(0,0,0,0.32)', AX-9, AB-4, 18, 5);
    px(c, 'rgba(0,0,0,0.20)', AX-11, AB-3, 22, 3);

    // ---- legs. Rear leg first and darker so the two read as one in front of
    //      the other rather than as a pair of posts.
    for(const [sw, col, ord] of [[-swA, deep(PD), -1], [swA, PD, 1]]){
      const lx = AX - 6 + (ord>0 ? 6 : 0);
      const lift = sw>2 ? 2 : 0;
      px(c, deep(col), lx,   T0+26, 6, 16-lift);
      px(c, col,       lx,   T0+26, 5, 16-lift);
      px(c, lit(col),  lx,   T0+26, 2, 15-lift);
      px(c, deep(C.wood1), lx-1, AB-4-lift, 8, 4);
      px(c, C.wood1,       lx-1, AB-5-lift, 8, 4);
      px(c, C.wood2,       lx-1, AB-5-lift, 6, 1);
    }

    // ---- torso
    px(c, deep(PD), AX-8, T0+14, 16, 13);
    px(c, PD,       AX-8, T0+14, 15, 12);
    px(c, P,        AX-7, T0+15, 13, 10);
    px(c, PL,       AX-7, T0+15, 12, 2);              // lit top
    px(c, PL,       AX-7, T0+15, 2,  9);             // lit left
    px(c, deep(P),  AX+4, T0+16, 2,  9);             // shaded right
    px(c, lit(PL),  AX-7, T0+15, 2,  1);

    // ---- belt
    px(c, deep(look.accent), AX-8, T0+25, 16, 3);
    px(c, look.accent,       AX-8, T0+24, 16, 3);
    px(c, look.accentL,      AX-8, T0+24, 14, 1);
    px(c, look.trim,         AX-2,  T0+24, 4,  3);
    px(c, glow(look.trim),   AX-2,  T0+24, 3,  1);

    // ---- arms, outside the torso so the silhouette has a waist
    for(const sd of [-1, 1]){
      const swing = sd>0 ? armA : -armA;
      const ax = sd>0 ? AX+7 : AX-12;
      px(c, deep(PD), ax, T0+15+swing, 5, 12);
      px(c, PD,       ax, T0+15+swing, 4, 11);
      px(c, sd<0?PL:P, ax, T0+15+swing, 2, 10);
      px(c, look.skinD, ax-1, T0+25+swing, 6, 5);
      px(c, look.skin,  ax-1, T0+25+swing, 5, 4);
      px(c, lit(look.skin), ax-1, T0+25+swing, 2, 2);
    }

    // ---- head
    if(!opts.noHead){
      px(c, deep(look.skinD), AX-7, T0+2, 14, 13);
      px(c, look.skinD,       AX-7, T0+2, 13, 12);
      px(c, look.skin,        AX-6, T0+3, 11, 10);
      px(c, lit(look.skin),   AX-6, T0+4, 3,  7);
      px(c, C.skin4,          AX-5, T0+3, 8,  2);
      px(c, look.skinD,       AX-5, T0+11, 10, 2);
      px(c, deep(look.skinD), AX-7, T0+13, 14, 2);
      if(!back){
        const ex = dir===2 ? AX-5 : dir===3 ? AX+1 : AX-4;
        px(c,'#2a1a20', ex, T0+7, 3, 3);
        px(c, glow(look.skin), ex, T0+7, 1, 1);
        if(dir===0){
          px(c,'#2a1a20', AX+2, T0+7, 3, 3);
          px(c, glow(look.skin), AX+2, T0+7, 1, 1);
          px(c, look.skinD, AX-2, T0+11, 4, 1);
        } else {
          px(c, look.skinD, ex+(dir===3?2:0), T0+11, 3, 1);
        }
      }
      // ---- hair: hugs the skull rather than sitting on it as a slab
      px(c, deep(look.hairD), AX-8, T0+1, 16, 7);
      px(c, look.hairD,       AX-7, T0+1, 14, 6);
      px(c, look.hair,        AX-7, T0+2, 13, 4);
      px(c, lit(look.hair),   AX-6, T0+2, 8,  2);
      px(c, glow(look.hair),  AX-6, T0+2, 3,  1);
      if(back){
        px(c, look.hair,  AX-7, T0+5, 14, 8);
        px(c, look.hairD, AX-7, T0+12, 14, 2);
        px(c, lit(look.hair), AX-7, T0+5, 3, 7);
      } else {
        px(c, look.hairD, AX-8, T0+4, 3, 6);
        px(c, look.hairD, AX+5, T0+4, 3, 6);
        px(c, look.hair,  AX-8, T0+4, 2, 4);
        for(let k=0;k<4;k++)
          px(c, look.hairD, AX-6+k*4, T0+5, 2, 1+((k*5)%3));
      }
    }
  });

  return { top, side, back, armSwing: Math.round(armA/2) };
}

// ---------------------------------------------------------------------------
// CLASS OVERLAYS
// ---------------------------------------------------------------------------
function drawClassSprite(c, X, Yb, dir, frame, moving, clsDef, stateOpts){
  const L = {
    prim:clsDef.col.prim, primD:clsDef.col.primD, primL:clsDef.col.primL,
    accent:clsDef.col.accent, accentL:clsDef.col.accentL, trim:clsDef.col.trim,
    skin:C.skin3, skinD:C.skin2, hair:'#4a2f1c', hairD:'#2f1d10'
  };
  const id = clsDef.id;
  if(id==='reaver'){ L.hair='#1b1118'; L.hairD='#0b070c'; }   // black, under the cloak hood
  const hooded = (id==='phantom'||id==='runebreaker'||id==='eidolon');
  const base = drawHumanoid(c, X, Yb, dir, frame, moving, L, { noHead:false });
  const top = base.top, side = base.side, back = base.back;

  // Device-space anchors for the overlays. `top` and `X` stay world units
  // because that is the contract drawHumanoid returns them in; every overlay
  // below works in AX/AT0 and is authored at the new density.
  const AX = X*ART, AT0 = top*ART, AYB = Yb*ART;

  switch(id){
    case 'ironclad': {
      withArt(ART, ()=>{
        // Wide pauldrons with exposed brass gears. The pauldron is a dome now
        // rather than a box: three stepped courses with a lit top edge, which
        // is what makes armour read as armour at this size.
        for(const sd of [-1,1]){
          const sx = AX + sd*14;
          px(c,deep(C.copper1), sx-7, AT0+9, 14, 15);
          px(c,C.copper1,       sx-7, AT0+9, 13, 14);
          px(c,C.copper2,       sx-6, AT0+10, 11, 11);
          px(c,lit(C.copper4),  sx-6, AT0+10, 10, 2);
          px(c,lit(C.copper4),  sx-6, AT0+10, 2, 10);
          px(c,deep(C.copper1), sx+5, AT0+12, 2, 11);
          // the gear, with teeth
          px(c,C.brass1,  sx-4, AT0+14, 8, 8);
          px(c,C.brass3,  sx-3, AT0+15, 6, 6);
          px(c,C.brass5,  sx-3, AT0+15, 3, 2);
          for(let k=0;k<4;k++){
            const ga = G.time*1.4 + k*Math.PI/2;
            px(c,C.brass2, sx-1+Math.round(Math.cos(ga)*5), AT0+17+Math.round(Math.sin(ga)*5), 2, 2);
          }
        }
        // helm
        px(c,deep(L.primD), AX-11, AT0-3, 22, 10);
        px(c,L.primD,       AX-10, AT0-3, 20, 9);
        px(c,L.prim,        AX-10, AT0-2, 19, 7);
        px(c,lit(L.primL),  AX-10, AT0-2, 18, 2);
        px(c,glow(L.primL), AX-10, AT0-2, 5, 1);
        px(c,C.copper3,     AX-11, AT0+5, 22, 2);
        px(c,lit(C.copper4),AX-11, AT0+5, 20, 1);
        px(c,C.amber3, AX+(dir===2?-9:5), AT0+1, 4, 2);   // visor light
        px(c,glow(C.amber4), AX+(dir===2?-9:5), AT0+1, 2, 1);
        // chest crystal
        px(c,deep(C.amber2), AX-3, AT0+19, 6, 7);
        px(c,C.amber2,       AX-3, AT0+19, 5, 6);
        px(c,C.amber4,       AX-3, AT0+19, 3, 3);
        px(c,glow(C.amber5), AX-3, AT0+19, 2, 1);
      });
      drawWeaponSword(c,X,top,dir,side,stateOpts);
      break;
    }
    case 'bulwark': {
      withArt(ART, ()=>{
        // full helm with a visor slit
        px(c,deep(L.primD), AX-9, AT0-2, 18, 17);
        px(c,L.primD,       AX-8, AT0-2, 16, 16);
        px(c,L.prim,        AX-7, AT0,   13, 13);
        px(c,lit(L.primL),  AX-7,  AT0,   12, 2);
        px(c,lit(L.primL),  AX-7,  AT0,   2, 12);
        px(c,deep(L.prim),  AX+5,  AT0+2, 1, 11);
        px(c,'#0d1420',     AX-6,  AT0+6, 12, 4);       // slit
        px(c,'#6fa8f0',     AX-5,  AT0+7, 5, 2);
        px(c,glow('#a8d0ff'), AX-5, AT0+7, 2, 1);
        px(c,C.iron4,       AX-11, AT0+15, 22, 4);
        px(c,lit(C.iron4),  AX-11, AT0+15, 20, 1);
        // the pack that powers the shield
        px(c,deep(C.iron1), AX-6, AT0+16, 12, 7);
        px(c,C.iron1,       AX-5, AT0+16, 10, 6);
        px(c,C.iron3,       AX-5, AT0+16, 10, 2);
        px(c,'#2f6fd0',     AX-3, AT0+18, 5, 4);
        px(c,glow('#8fd6ff'), AX-3, AT0+18, 2, 1);
        // Tower shield on the forward arm. Pushed OUT and cut down: at full
        // width it covered the helm, the pack and half the torso, and the
        // class read as a shield with legs.
        const shx = AX + side*20;
        px(c,deep(C.iron1), shx-6, AT0+14, 13, 26);
        px(c,C.iron1,       shx-5, AT0+14, 11, 25);
        px(c,C.iron3,       shx-4, AT0+16, 9, 21);
        px(c,lit(C.iron4),  shx-4, AT0+16, 8, 2);
        px(c,lit(C.iron4),  shx-4, AT0+16, 2, 19);
        px(c,deep(C.iron1), shx+4, AT0+18, 1, 19);
        px(c,'#1a3a6a',     shx-3, AT0+22, 7, 10);      // boss
        px(c,'#4f9ae8',     shx-3, AT0+23, 7, 5);
        px(c,'#a8d0ff',     shx-2, AT0+24, 4, 2);
        px(c,glow('#d8ecff'), shx-2, AT0+24, 2, 1);
      });
      if(player.bastion){
        c.strokeStyle='rgba(111,168,240,.55)'; c.lineWidth=1;
        c.beginPath(); c.arc(X,Yb-11,16,0,Math.PI*2); c.stroke();
      }
      break;
    }
    case 'runebreaker': {
      drawHood(c,X,top,dir,L,'#3d2f52','#271c38');
      withArt(ART, ()=>{
        // gauntlets that carry the charge
        for(const sd of [-1,1]){
          const hx = AX + sd*13;
          px(c,deep(C.aether1), hx-5, AT0+27, 11, 11);
          px(c,C.aether1,       hx-4, AT0+27, 9, 10);
          px(c,C.aether3,       hx-3, AT0+29, 7, 7);
          px(c,C.aether5,       hx-3, AT0+29, 4, 2);
          px(c,glow(C.aether5), hx-3, AT0+29, 2, 1);
        }
      });
      // rune motes orbiting — world units, they are effects not costume
      for(let k=0;k<3;k++){
        const ar=G.time*2.4+k*2.1;
        px(c,C.aether4, X+Math.cos(ar)*10, top+11+Math.sin(ar)*4, 1, 1);
      }
      break;
    }
    case 'aethermancer': {
      withArt(ART, ()=>{
        // a long robe in place of legs: wider at the hem, with folds
        px(c,deep(L.primD), AX-13, AT0+28, 27, 19);
        px(c,L.primD,       AX-12, AT0+28, 25, 18);
        px(c,L.prim,        AX-11, AT0+28, 22, 17);
        px(c,L.primL,       AX-11, AT0+28, 4, 17);
        for(let k=0;k<4;k++)                            // folds
          px(c,deep(L.primD), AX-8+k*6, AT0+34, 1, 11);
        px(c,C.aether3,     AX-11, AT0+43, 22, 3);      // hem band
        px(c,lit(C.aether4),AX-11, AT0+43, 20, 1);
        // high collar
        px(c,deep(L.primD), AX-11, AT0+13, 23, 7);
        px(c,L.primD,       AX-10, AT0+13, 21, 6);
        px(c,C.aether3,     AX-10, AT0+13, 21, 2);
        px(c,C.aether4,     AX-4,  AT0+15, 8, 2);
        px(c,glow(C.aether5),AX-4, AT0+15, 3, 1);
        // staff
        const stx = AX + side*17;
        px(c,deep(C.wood1), stx-2, AT0+4, 5, 41);
        px(c,C.wood2,       stx-2, AT0+4, 4, 40);
        px(c,lit(C.wood4),  stx-2, AT0+4, 1, 40);
        const fl = Math.round(Math.sin(G.time*3)*2);
        px(c,deep(C.aether1), stx-7, AT0-5+fl, 14, 14);
        px(c,C.aether1,       stx-6, AT0-5+fl, 12, 13);
        px(c,C.aether3,       stx-5, AT0-3+fl, 9, 9);
        px(c,C.aether5,       stx-5, AT0-3+fl, 5, 4);
        px(c,glow(C.aether5), stx-5, AT0-3+fl, 2, 2);
        if(player.mode===0){
          px(c,C.amber4, stx-2, AT0+fl, 4, 4);
          px(c,glow(C.amber5), stx-2, AT0+fl, 2, 2);
        }
      });
      if(player.mode!==0) for(let k=0;k<3;k++){
        const ar=G.time*3+k*2.1;
        const stx = X + side*8;
        px(c,C.aether4, stx+Math.cos(ar)*6, top+1+Math.sin(ar)*4, 1, 1);
      }
      break;
    }
    case 'reaver': {
      // --- MISTCLOAK ------------------------------------------------------
      // A cloak cut into hanging strips, growing out of a solid shoulder
      // mantle — loose strips with nothing to hang from read as planks
      // floating beside the character. Each drifts on its own phase, which is
      // what sells cloth; a solid cape reads as a painted-on triangle.
      //
      // Fanning them sideways blows the silhouette out and breaks scale
      // against the tiles. The room is VERTICAL: the strips get the lower half
      // of the sprite as ragged fringe at mixed lengths, and the legs showing
      // through the gaps is what stops it reading as a skirt.
      const OUT='#0a090e';
      withArt(ART, ()=>{
        // shoulder mantle — thin and low, so the face stays visible
        px(c,OUT,        AX-13, AT0+16, 27, 9);
        px(c,L.prim,     AX-11, AT0+18, 23, 5);
        px(c,L.primL,    AX-11, AT0+18, 23, 2);
        px(c,glow(L.primL), AX-13, AT0+18, 6, 1);
        px(c,'#8a1f18',  AX-13, AT0+23, 27, 2);        // the seam it hangs from
        px(c,'#c8452b',  AX-13, AT0+23, 24, 1);
        // torso
        px(c,OUT,        AX-13, AT0+25, 27, 9);
        px(c,L.prim,     AX-11, AT0+25, 23, 7);
        px(c,L.primL,    AX-11, AT0+25, 3, 7);
        px(c,deep(L.prim), AX+9, AT0+25, 2, 7);
        px(c,'#c8452b',  AX-11, AT0+31, 23, 2);        // belt
        px(c,'#e8663c',  AX-11, AT0+31, 20, 1);
        px(c,'#e2bc5e',  AX-3,  AT0+31, 5, 2);         // buckle
        px(c,glow('#fff3cc'), AX-3, AT0+31, 3, 1);

        // the strips. Step 6 at this density: at 4 they tile edge to edge and
        // the cloak goes back to being a sheet. The gap IS the effect.
        const y0 = (back ? AT0+25 : AT0+33);
        const strips = [];
        for(let i=0, sx=-15; sx<=13; sx+=6, i++){
          const ph = G.time*2.4 + sx*0.45;
          strips.push({
            x:   AX + sx + Math.round(Math.sin(ph)*2),
            len: (back?19:13) + ((i*5)%3)*2 + Math.round(Math.sin(ph*0.7)*3),
            red: (i%2)===1
          });
        }
        // Two passes. Drawn strip by strip, each outline painted over its left
        // neighbour and strips vanished entirely.
        for(const st of strips) px(c, OUT, st.x-1, y0, 5, st.len+2);
        for(const st of strips){
          px(c, st.red?'#9c2418':'#1c1b26', st.x, y0, 3, st.len);
          px(c, st.red?'#c8452b':'#2a2836', st.x, y0, 1, st.len);       // lit edge
          px(c, st.red?'#e8663c':'#3a3848', st.x, y0+st.len-2, 3, 2);   // lit hem
        }
      });
      // Hung at the hips, blade-down and splayed outward: blade-down puts the
      // receiver at the belt where the eye already is, and splaying the tips
      // keeps them off the legs where parallel blades read as sticks.
      drawGunblade(c, X-7, top+13,  Math.PI/2+0.42, 11, -1);
      drawGunblade(c, X+7, top+13,  Math.PI/2-0.42, 11,  1);
      break;
    }
    case 'longshot': {
      withArt(ART, ()=>{
        // duster coat, split at the front so the legs read through it
        px(c,deep(L.primD), AX-13, AT0+30, 27, 17);
        px(c,L.primD,       AX-12, AT0+30, 25, 16);
        px(c,L.prim,        AX-11, AT0+30, 22, 15);
        px(c,L.primL,       AX-11, AT0+30, 4, 15);
        px(c,deep(L.primD), AX-1,  AT0+36, 2, 11);      // the split
        px(c,deep(L.primD), AX-12, AT0+45, 25, 2);
        // cap with goggles pushed up on it
        px(c,deep(L.primD), AX-11, AT0-3, 22, 9);
        px(c,L.primD,       AX-10, AT0-3, 20, 8);
        px(c,L.prim,        AX-10, AT0-2, 19, 6);
        px(c,lit(L.primL),  AX-10, AT0-2, 18, 2);
        px(c,C.brass2,      AX-11, AT0+4, 22, 5);
        px(c,'#8fd6ff',     AX-7,  AT0+5, 6, 3);
        px(c,'#8fd6ff',     AX+2,  AT0+5, 6, 3);
        px(c,glow('#d8f0ff'),AX-7, AT0+5, 2, 1);
        px(c,glow('#d8f0ff'),AX+2, AT0+5, 2, 1);
        px(c,C.brass4,      AX-11, AT0+4, 20, 1);
        // rifle carried across the body
        const rx = AX + side*8;
        px(c,deep(C.wood1), rx-3, AT0+16, 7, 13);
        px(c,C.wood2,       rx-3, AT0+16, 6, 12);
        px(c,lit(C.wood4),  rx-3, AT0+16, 2, 12);
        px(c,deep(C.iron1), rx-3, AT0+27, 7, 21);
        px(c,C.iron1,       rx-3, AT0+27, 6, 20);
        px(c,C.iron3,       rx-3, AT0+27, 2, 20);
        px(c,C.brass3,      rx-5, AT0+23, 11, 4);
        px(c,lit(C.brass5), rx-5, AT0+23, 9, 1);
      });
      if(player.focus>5){
        const f=player.focus/100, r=12-8*f;
        c.strokeStyle='rgba(125,220,106,'+(0.3+0.5*f)+')'; c.lineWidth=1;
        c.beginPath(); c.arc(X,top+11,r,0,Math.PI*2); c.stroke();
      }
      break;
    }
    case 'phantom': {
      drawHood(c,X,top,dir,L,'#26212f','#14111c');
      withArt(ART, ()=>{
        const sway = Math.round(Math.sin(G.time*2.6)*2);
        // Cloak. Narrower than the first pass, which was a featureless slab
        // the width of the sprite — folds catching the light down its length,
        // a ragged hem, and the legs showing beneath it.
        px(c,'#1a1622', AX-12, AT0+18, 25, 21+sway);
        px(c,'#26212f', AX-11, AT0+18, 23, 20+sway);
        px(c,'#3e3650', AX-11, AT0+18, 3, 20+sway);
        for(let k=0;k<4;k++){                       // folds
          const fx = AX-7+k*5 + (k%2?sway:0);
          px(c,'#1a1622', fx, AT0+22, 1, 15+sway);
          px(c,'#3e3650', fx+1, AT0+22, 1, 13+sway);
        }
        for(let k=0;k<6;k++){
          const nh = 2 + ((hash2(k*7, 3)*4)|0);
          px(c,'#1a1622', AX-11+k*4, AT0+37+sway, 4, nh);
        }
        // daggers
        for(const sd of [-1,1]){
          const dx2 = AX + sd*15;
          px(c,deep('#4a3a2a'), dx2-2, AT0+38, 5, 5);   // grip
          px(c,'#4a3a2a',       dx2-2, AT0+38, 4, 5);
          px(c,'#c9c5bd',       dx2-2, AT0+27, 4, 12);
          px(c,'#f0ece2',       dx2-2, AT0+27, 2, 9);
          px(c,glow('#ffffff'), dx2-2, AT0+27, 1, 3);
        }
      });
      break;
    }
    case 'eidolon': {
      drawHood(c,X,top,dir,L,'#2b4a4a','#1a2f30');
      withArt(ART, ()=>{
        // shoulder mantle
        px(c,deep('#1a2f30'), AX-15, AT0+13, 31, 10);
        px(c,'#1a2f30',       AX-14, AT0+13, 29, 9);
        px(c,'#2f9c92',       AX-14, AT0+13, 29, 5);
        px(c,'#57d0c4',       AX-13, AT0+13, 27, 2);
        px(c,glow('#8af0e4'), AX-13, AT0+13, 6, 1);
        // robe
        px(c,deep(L.primD), AX-13, AT0+30, 27, 17);
        px(c,L.primD,       AX-12, AT0+30, 25, 16);
        px(c,L.prim,        AX-11, AT0+30, 22, 15);
        px(c,L.primL,       AX-11, AT0+30, 3, 15);
        for(let k=0;k<3;k++) px(c,deep(L.primD), AX-7+k*7, AT0+36, 1, 11);
        // channelling rod
        const rx = AX + side*17;
        px(c,deep(C.wood1), rx-2, AT0+8, 5, 37);
        px(c,C.wood2,       rx-2, AT0+8, 4, 36);
        px(c,lit(C.wood4),  rx-2, AT0+8, 1, 36);
        px(c,deep('#1a2f30'), rx-5, AT0+1, 10, 9);
        px(c,'#2f9c92',       rx-4, AT0+1, 8, 8);
        px(c,'#57d0c4',       rx-4, AT0+1, 6, 4);
        px(c,glow('#8af0e4'), rx-4, AT0+1, 3, 2);
      });
      for(let k=0;k<G.summons.length;k++){
        const ar=G.time*2+k*3.1;
        px(c,'#57d0c4', X+Math.cos(ar)*11, top+9+Math.sin(ar)*5, 2, 2);
      }
      break;
    }
    case 'savant': {
      withArt(ART, ()=>{
        // scholar's long coat
        px(c,deep(L.primD), AX-13, AT0+28, 27, 19);
        px(c,L.primD,       AX-12, AT0+28, 25, 18);
        px(c,L.prim,        AX-11, AT0+28, 22, 17);
        px(c,C.brass3,      AX-11, AT0+28, 22, 2);      // piping
        px(c,lit(C.brass5), AX-11, AT0+28, 20, 1);
        px(c,L.primL,       AX-11, AT0+28, 4, 17);
        px(c,deep(L.primD), AX-1,  AT0+34, 2, 13);
        // monocle scanner
        if(!back){
          const mx = AX+(dir===2?-7:2);
          px(c,deep(C.brass2), mx-3, AT0+5, 9, 9);
          px(c,C.brass2,       mx-2, AT0+5, 8, 8);
          px(c,'#8fd6ff',      mx-1, AT0+7, 5, 4);
          px(c,glow('#d8f0ff'),mx-1, AT0+7, 2, 1);
          px(c,C.brass4,       mx-2, AT0+5, 7, 1);
          px(c,C.brass2,       mx+6, AT0+7, 4, 2);      // the arm of it
        }
        // tome under the arm
        const bx = AX + side*14;
        px(c,deep('#5a2128'), bx-5, AT0+24, 11, 15);
        px(c,'#5a2128',       bx-4, AT0+24, 10, 14);
        px(c,'#7d3038',       bx-3, AT0+25, 7, 13);
        px(c,C.brass3,        bx-5, AT0+28, 11, 2);     // clasp
        px(c,lit(C.brass5),   bx-5, AT0+28, 9, 1);
        px(c,'#e8e0cc',       bx+(side>0?4:-5), AT0+25, 2, 13);   // page block
        px(c,'#ffffff',       bx+(side>0?4:-5), AT0+25, 1, 12);
      });
      // The scanning beam is NOT drawn here. It reaches from the sprite to a
      // point in the WORLD, and this function also draws the HUD portrait and
      // the class-select portrait under their own transforms — so the beam
      // shot from a menu panel to a world coordinate, off one side of the
      // screen and back in somewhere else. It lives in drawScanBeam(), which
      // only runs in the world pass.
      break;
    }
  }

  // stealth shimmer
  if(player.stealthT>0){
    c.fillStyle='rgba(60,40,90,0.35)';
    c.fillRect(X-8, top-2, 16, 26);
  }
}

function drawHood(c,X,top,dir,L,hoodA,hoodB){
  px(c,hoodB, X-6, top-1, 12, 10);
  px(c,hoodA, X-5, top,   10, 8);
  px(c,shade(hoodA,1.35), X-5, top, 10, 1);
  // shaded face opening
  if(dir!==1){
    px(c,'#0d0a12', X-3, top+3, 6, 5);
    const ex = dir===2 ? X-2 : dir===3 ? X+1 : X-2;
    px(c,'#c9a2ff', ex, top+5, 1, 1);
    if(dir===0) px(c,'#c9a2ff', X+1, top+5, 1, 1);
  }
  px(c,hoodB, X-6, top+7, 3, 4);
  px(c,hoodB, X+3, top+7, 3, 4);
}

// ---------------------------------------------------------------------------
// GUNBLADE — a revolver bolted into the guard of a short sword.
//
// At sixteen pixels wide there is no room to render a gun and a blade as two
// separate objects, so the read has to come from silhouette. Four cues, in the
// order they carry:
//   1. the outline WIDENS hard at the grip. A dagger is one constant width all
//      the way down; this is 2px of blade sitting on a 5px block. That step is
//      what the eye catches first and it is doing most of the work.
//   2. a brass cylinder — the only warm colour on a cold weapon, so it reads as
//      a mechanism rather than a pommel.
//   3. a barrel running up alongside the blade and STOPPING well short of the
//      tip. Two parallel lines of unequal length say gun-plus-blade; one line
//      says knife.
//   4. a trigger guard hooking under the receiver.
// Everything else (screws, sights, wrap) turns to mush at this size and is
// deliberately left out.
//
// bx,by = the grip. ang = direction the blade points. len = blade length.
// side = which way the barrel and spine sit off the edge (+1 / -1), so a
// mirrored pair doesn't end up with both barrels pointing inboard.
// ---------------------------------------------------------------------------
function drawGunblade(c, bx, by, ang, len, side){
  const ca=Math.cos(ang), sa=Math.sin(ang);
  const px2=(col,x,y)=>px(c,col,Math.round(x),Math.round(y),1,1);
  // perpendicular, for offsetting the spine and the barrel off the edge
  const s=(side||1), nx=-sa*s, ny=ca*s;

  // blade: outline first, then a bright edge and a dark spine, so it holds
  // up against the near-black cloak it hangs over
  for(let d=2; d<=len; d++){
    const x=bx+ca*d, y=by+sa*d;
    px(c,'#0a090e', Math.round(x-nx), Math.round(y-ny), 1, 1);
    px2(d>len-2 ? '#eef1f8' : '#b8bece', x, y);
    px2('#565b6d', x+nx, y+ny);
  }
  // barrel: parallel to the blade, two off the spine, stopping at 55% of its
  // length. Two parallel lines of UNEQUAL length is the whole gun-plus-blade
  // read; one line is just a knife.
  const bl=Math.max(3,Math.round(len*0.55));
  for(let d=1; d<bl; d++) px2('#3f3e4c', bx+ca*d+nx*2, by+sa*d+ny*2);
  px2('#0a090e', bx+ca*bl+nx*2, by+sa*bl+ny*2);                // muzzle
  // Receiver — the wide part, and the whole point of the design. Seven pixels
  // against a four-pixel blade: at five the step was only one pixel and the
  // weapon still measured, and read, as a dagger.
  px(c,'#0a090e', Math.round(bx-3), Math.round(by-2), 6, 6);
  px(c,'#484758', Math.round(bx-2), Math.round(by-2), 4, 1);
  px(c,'#2b2a35', Math.round(bx-2), Math.round(by-1), 4, 4);
  // cylinder. Small and muted on purpose — bright brass at 3x3 read as a gold
  // pauldron and pulled the eye straight off the blade.
  px(c,'#6b5220', Math.round(bx-2), Math.round(by-1), 3, 3);
  px(c,'#a8801f', Math.round(bx-2), Math.round(by-1), 1, 1);
  px(c,'#c8452b', Math.round(bx),   Math.round(by+1), 1, 1);   // charged chamber
  // trigger guard, hooking under
  px(c,'#0a090e', Math.round(bx-3), Math.round(by+4), 5, 2);
  px(c,'#2b2a35', Math.round(bx-2), Math.round(by+4), 3, 1);
}

// greatsword with a real swing arc
function drawWeaponSword(c,X,top,dir,side,st){
  let ang=null, len=18;
  const baseAng = Math.atan2(player.dy,player.dx);
  if(player.spinT>0){ ang=(0.52-player.spinT)*26; len=22; }
  else if(player.castT>0 && player.castKind===0){ ang=baseAng-2.0; len=20; }
  else if(player.castT>0 && player.castKind===3){ ang=-Math.PI/2; len=21; }

  if(ang===null){
    const rx=X+side*8;
    px(c,C.stone3, rx-1, top+2, 3, 15);
    px(c,C.stone5, rx-1, top+2, 1, 13);
    px(c,C.copper2, rx-2, top+15, 5, 3);
    px(c,C.brass3,  rx-1, top+17, 2, 4);
    px(c,C.amber3,  rx-1, top+12, 2, 2);
    return;
  }
  const ca=Math.cos(ang), sa=Math.sin(ang);
  const hx=X+ca*5, hy=top+12+sa*4;
  for(let d=0; d<len; d++){
    const bx=hx+ca*d, by=hy+sa*d*0.72;
    px(c, d>len-5?C.stone5:(d%3===0?C.stone5:C.stone3), bx-1, by-1, 3, 2);
  }
  px(c,C.copper1, hx-2, hy-2, 4, 4);
  px(c,C.copper3, hx-2, hy-2, 3, 3);
  px(c,C.amber3, hx+ca*7-1, hy+sa*5-1, 2, 2);
  if(player.spinT>0){
    c.strokeStyle = 'rgba(240,235,220,.45)'; c.lineWidth=2;
    c.beginPath(); c.arc(X, top+12, len*0.9, ang-0.55, ang+0.06); c.stroke();
  }
}

// ---------------------------------------------------------------------------
// NPC
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// A PLAYER IN THE WORLD
//
// The class already owns the character's colours, so the player marker can't
// be a recolour of the costume — the Reaver is red before anyone assigns it.
// Instead each player gets a coloured ring at their feet and a small 1P/2P
// tag, which separates them at a glance without fighting class identity.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// THE PHANTOM LOSING COHESION
//
// Three beats: the figure sinks straight down and spreads, the puddle runs,
// and the figure rises back out of it. The sprite is not redrawn squashed —
// it is drawn through a vertical scale about the FEET, so the whole costume
// compresses into the ground the way a body would rather than shrinking
// toward its own middle like a sprite being resized.
//
// The puddle is drawn under the figure in both the sinking and rising beats,
// growing as the figure loses height, so there is never a frame where the
// character has simply vanished and something else has appeared.
// ---------------------------------------------------------------------------
function drawMelt(c, p, X, Y){
  const ph = meltPhase();
  const A = cls.col.accent, AL = cls.col.accentL, D = cls.col.primD;

  // how much of the figure is still standing, 1 = upright, 0 = flat
  const stand = ph.at==='collapse' ? 1-ph.f
              : ph.at==='rise'     ? ph.f
              :                      0;
  // and how wide the puddle has spread, which is the inverse
  const pool  = 1-stand;

  // --- the puddle itself. Dark first, colour second: this is ink with a
  // violet sheen on it, not a grape. A saturated fill at this size reads as
  // an object lying on the floor rather than as the character.
  if(pool > 0.02){
    const rw = 4 + 7*pool, rh = 1.2 + 2.6*pool;
    const wob = Math.sin(G.time*22)*0.6*pool;
    const ell = (cx,cy,ax,ay)=>{
      c.beginPath();
      if(c.ellipse) c.ellipse(cx, cy, Math.max(0.6,ax), Math.max(0.6,ay), 0, 0, Math.PI*2);
      else c.arc(cx, cy, Math.max(0.6,ax), 0, Math.PI*2);
      c.fill();
    };
    c.globalAlpha = 0.22*pool; c.fillStyle = A;  ell(X, Y-1, rw+3.5, rh+2);
    c.globalAlpha = 1;
    c.fillStyle = D;                             ell(X, Y-1, rw+wob, rh);
    c.fillStyle = cls.col.primL;                 ell(X, Y-1.5, rw-1.2+wob, rh-0.7);
    c.fillStyle = A;                             ell(X, Y-1.8, rw*0.55+wob, rh*0.45);
    // a highlight that slides across it, so a flat shape still reads as liquid
    px(c, AL, Math.round(X-rw*0.4+Math.sin(G.time*9)*rw*0.3),
              Math.round(Y-2.5), Math.max(1,Math.round(rw*0.4)), 1);
  }

  // --- what is left of the figure, compressed toward the ground
  if(stand > 0.04){
    c.save();
    c.translate(X, Y);
    c.scale(1 + 0.45*(1-stand), Math.max(0.02, stand));
    c.globalAlpha = 0.35 + 0.65*stand;
    drawClassSprite(c, 0, 0, p.dir, p.frame, false, cls, {});
    c.globalAlpha = 1;
    c.restore();
  }

  // --- a thread of ink back to where it left, while it is running
  if(ph.at==='slide'){
    c.globalAlpha = 0.22*(1-ph.f);
    c.strokeStyle = A; c.lineWidth = 2;
    c.beginPath(); c.moveTo(p.meltOx, p.meltOy-1); c.lineTo(X, Y-1); c.stroke();
    c.globalAlpha = 1;
  }
}

function drawPlayerFigure(c, p){
  const X = Math.round(p.x), Y = Math.round(p.y);
  const col = p.col || P_COL[0];

  if(p.down){
    // Face down, dimmed, with the revive ring filling as your partner stands
    // over you. The ring is the only UI a downed player needs.
    c.globalAlpha = 0.55;
    c.save(); c.translate(X, Y); c.rotate(0); c.restore();
    px(c, C.shadowHard, X-8, Y-3, 16, 5);
    px(c, cls.col.primD, X-8, Y-6, 16, 7);
    px(c, cls.col.prim,  X-7, Y-5, 14, 5);
    px(c, col.dark, X-9, Y-7, 18, 1);
    c.globalAlpha = 1;
    const f = Math.min(1, p.reviveT/2.2);
    c.strokeStyle = col.main; c.lineWidth = 2;
    c.beginPath(); c.arc(X, Y-2, 13, -Math.PI/2, -Math.PI/2 + f*Math.PI*2); c.stroke();
    text(c, 'DOWN', X, Y-24, col.lite, 7, 'center');
    return;
  }

  if(p.melting){ drawMelt(c, p, X, Y); return; }

  // the ring goes under the sprite, so feet read as standing on it
  c.strokeStyle = col.main; c.lineWidth = 1;
  c.beginPath(); c.ellipse ? c.ellipse(X, Y-1, 9, 4, 0, 0, Math.PI*2)
                           : c.arc(X, Y-1, 7, 0, Math.PI*2);
  c.stroke();

  drawClassSprite(c, X, Y, p.dir, p.frame, p.moving, cls, {});

  if(twoPlayer()){
    px(c, '#12101a', X-8, Y-40, 11, 9);
    px(c, col.main,  X-7, Y-39, 9, 7);
    text(c, col.id, X-6, Y-38, '#12101a', 7);
  }
}

// ---------------------------------------------------------------------------
// NPCs
//
// One humanoid base, nine costumes. A city reads as populated through
// silhouette variety more than through colour, so each build changes the
// outline — a hood, a helm, a pack, a stoop — rather than just recolouring
// the same body.
// ---------------------------------------------------------------------------
function drawNPC(c, n){
  const X=Math.round(n.x), Yb=Math.round(n.y);
  const look=n.look;
  const L = { prim:look.dress, primD:look.dressD, primL:shade(look.dress,1.3),
              accent:look.apronD, accentL:look.apron, trim:C.brass3,
              skin:look.skin, skinD:look.skinD, hair:look.hair, hairD:look.hairD };
  const build = n.build || 'matron';

  // A child is the same rig at three-quarter scale. Cheaper and more reliable
  // than a second set of proportions, and it reads instantly next to adults.
  if(build==='child'){
    c.save();
    c.translate(X, Yb); c.scale(0.72, 0.72); c.translate(-X, -Yb);
  }

  const b = drawHumanoid(c, X, Yb, n.dir, n.frame|0, !!n.moving, L);
  const top=b.top, back=b.back;

  switch(build){
    case 'matron': {
      px(c,L.primD, X-6, top+14, 13, 9);                 // long skirt
      px(c,L.prim,  X-5, top+14, 11, 8);
      px(c,L.primL, X-5, top+14, 2, 8);
      px(c,look.apronD, X-4, top+12, 9, 9);              // apron
      px(c,look.apron,  X-3, top+12, 7, 8);
      px(c,look.apronD, X-3, top+16, 7, 1);
      px(c,look.hairD, X-6, top+2, 3, 8);                // long hair
      px(c,look.hair,  X-6, top+2, 2, 7);
      px(c,look.hairD, X+4, top+2, 3, 8);
      px(c,look.hair,  X+4, top+2, 2, 7);
      break;
    }
    case 'vendor': {
      px(c,look.apronD, X-5, top+9, 11, 12);             // full-length apron
      px(c,look.apron,  X-4, top+10, 9, 10);
      px(c,look.apronD, X-4, top+15, 9, 1);
      px(c,look.apronD, X-2, top+8, 5, 2);               // bib and strap
      px(c,C.brass3, X-5, top+14, 11, 1);
      px(c,look.dressD, X-8, top+9, 3, 4);               // rolled sleeves
      px(c,look.dressD, X+5, top+9, 3, 4);
      break;
    }
    case 'guard': {
      px(c,C.iron1, X-5, top-1, 11, 8);                  // helm
      px(c,C.iron3, X-4, top,   9, 6);
      px(c,C.iron4, X-4, top,   9, 1);
      px(c,'#0d1018', X-3, top+3, 7, 2);                 // visor slit
      if(!back) px(c,C.amber3, X-2, top+3, 2, 1);
      px(c,look.apronD, X-5, top+9, 11, 8);              // tabard
      px(c,look.apron,  X-4, top+9, 9, 7);
      px(c,C.brass2, X-4, top+12, 9, 1);
      for(const sx of [-7,5]){ px(c,C.iron1, sx+X, top+7, 3, 4); px(c,C.iron4, sx+X, top+7, 3, 1); }
      break;
    }
    case 'engineer': {
      px(c,C.iron1, X-5, top-1, 11, 4);                  // flat cap
      px(c,C.iron3, X-5, top-1, 11, 2);
      px(c,C.brass2, X-5, top+2, 11, 2);                 // goggles pushed up
      px(c,'#8fd6ff', X-4, top+2, 3, 2);
      px(c,'#8fd6ff', X+1, top+2, 3, 2);
      px(c,C.brass4, X-5, top+2, 11, 1);
      px(c,look.apronD, X-5, top+10, 11, 8);             // work coat
      px(c,look.apron,  X-4, top+10, 9, 7);
      px(c,C.wood1, X-5, top+14, 11, 3);                 // tool belt
      px(c,C.iron3, X-3, top+15, 2, 4); px(c,C.iron3, X+2, top+15, 2, 3);
      break;
    }
    case 'scholar': {
      drawHood(c,X,top,n.dir,L,look.dress,look.dressD);
      px(c,L.primD, X-6, top+12, 13, 11);                // robe
      px(c,L.prim,  X-5, top+12, 11, 10);
      px(c,L.primL, X-5, top+12, 2, 10);
      px(c,C.brass3, X-5, top+21, 11, 1);
      px(c,C.wood2, X+5, top+11, 4, 6);                  // book under the arm
      px(c,C.plaster3, X+5, top+12, 4, 4);
      px(c,C.roof3, X+5, top+11, 4, 1);
      break;
    }
    case 'elder': {
      // Shawl starts below the chin. Run up at shoulder height it covered the
      // whole lower face and she came out as a grey block on a red block.
      px(c,look.apronD, X-7, top+9, 15, 7);
      px(c,look.apron,  X-6, top+10, 13, 5);
      px(c,look.apronD, X-6, top+14, 13, 1);
      px(c,look.apronD, X-7, top+9, 2, 10);              // it hangs at the sides
      px(c,look.apronD, X+6, top+9, 2, 10);
      px(c,L.primD, X-6, top+16, 13, 7);                 // skirt
      px(c,L.prim,  X-5, top+16, 11, 6);
      px(c,'#8a867e', X-5, top, 10, 4);                  // white hair, pinned up
      px(c,'#c9c5bd', X-5, top, 10, 3);
      px(c,'#efe9df', X-4, top, 6, 1);
      px(c,C.wood2, X+8, top+4, 2, 19);                  // walking stick
      px(c,C.wood4, X+8, top+4, 1, 19);
      break;
    }
    case 'courier': {
      px(c,look.apronD, X-5, top-1, 11, 4);              // soft cap
      px(c,look.apron,  X-5, top-1, 11, 2);
      px(c,look.apronD, X-5, top+2, 7, 1);               // brim
      px(c,L.primD, X-7, top+10, 4, 8);                  // satchel on a strap
      px(c,L.prim,  X-7, top+11, 3, 6);
      px(c,C.brass3, X-7, top+13, 4, 1);
      for(let k=0;k<5;k++) px(c,C.wood2, X-4+k*2, top+9+k, 1, 1);
      break;
    }
    case 'miner': {
      px(c,C.iron1, X-5, top-2, 11, 6);                  // hard helm
      px(c,C.iron3, X-4, top-1, 9, 4);
      px(c,C.iron4, X-4, top-1, 9, 1);
      px(c,C.brass2, X-1, top-4, 3, 3);                  // lamp
      px(c,C.amber4, X, top-3, 1, 1);
      if(!SILHOUETTE){ c.fillStyle='rgba(255,180,90,0.13)';
                       c.beginPath(); c.arc(X, top-3, 16, 0, Math.PI*2); c.fill(); }
      // Overalls, not a slab: the bib is narrow and the straps break it up,
      // or the whole torso reads as one brown rectangle.
      px(c,L.primD, X-5, top+9, 11, 9);
      px(c,L.prim,  X-4, top+10, 9, 8);
      px(c,look.apronD, X-3, top+9, 7, 9);               // bib
      px(c,look.apron,  X-2, top+10, 5, 7);
      px(c,look.apronD, X-4, top+8, 2, 4);               // straps
      px(c,look.apronD, X+2, top+8, 2, 4);
      px(c,C.iron3, X-4, top+14, 9, 1);
      for(let k=0;k<7;k++) px(c,'#8a8270', X-4+((k*7)%9), top+11+((k*5)%7), 1, 1);
      px(c,C.wood2, X+7, top+4, 2, 14);                  // pick over the shoulder
      px(c,C.wood4, X+7, top+4, 1, 14);
      px(c,C.iron1, X+5, top+3, 6, 3); px(c,C.iron4, X+5, top+3, 6, 1);
      break;
    }
    default: {   // 'townsfolk' — plain trousers and a jerkin
      px(c,L.primD, X-5, top+9, 11, 9);
      px(c,L.prim,  X-4, top+10, 9, 7);
      px(c,L.primL, X-4, top+10, 2, 7);
      px(c,look.apronD, X-4, top+13, 9, 2);              // sash
      px(c,look.apron,  X-4, top+13, 9, 1);
      break;
    }
  }

  if(build==='child') c.restore();

  // interaction prompt when you're close
  if(!n.static && dist(n.x,n.y,player.x,player.y) < 30 && G.state===ST.PLAY){
    const fl = Math.round(Math.sin(G.time*4)*1);
    px(c,'#12101a', X-6, Yb-41+fl, 12, 12);
    px(c,C.uiGold, X-5, Yb-40+fl, 10, 10);
    text(c, 'F', X-2, Yb-38+fl, '#12101a', 7);
  }
  // Quest marker, and only over whoever owns a quest. It used to key off
  // `!n.static`, which put a "!" above every citizen in the city.
  drawQuestMark(c, n, X, Yb);
}

// ---------------------------------------------------------------------------
// QUEST MARKERS
//
// One marker, three states, and the same three for everyone who hands out
// work — Hayla in the clearing and the five on the ring. They used to be two
// separate pieces of code, and the ring's five had none at all, so the only
// way to find out who wanted something was to walk the whole circle pressing
// F at people.
//
//   blue  !   something to give you
//   green ?   something finished, waiting to be handed back
//   grey  ?   in progress; come back when you have it
// ---------------------------------------------------------------------------
const QMARK = {
  '!':  { lit:'#6ab4ff', dim:'#2a5f9e' },
  '?':  { lit:'#7ddc6a', dim:'#2f6b2a' },
  '..': { lit:'#6e6a7a', dim:'#3a3744' }
};
function npcQuestMark(n){
  // Hayla's own errand predates the posting board and keeps its own state.
  if(n.quest){
    if(G.quest.state==='none') return '!';
    if(G.quest.state==='done') return '?';
    return '..';
  }
  const mine = (typeof QUESTS_BY_GIVER!=='undefined') && QUESTS_BY_GIVER[n.id];
  if(!mine) return null;
  if(mine.some(q=>questState(q.id)===QUEST_STATE.READY))  return '?';
  if(mine.some(q=>!questState(q.id)))                     return '!';
  if(mine.some(q=>questState(q.id)===QUEST_STATE.ACTIVE)) return '..';
  return null;
}
function drawQuestMark(c, n, X, Yb){
  const mk = npcQuestMark(n);
  if(!mk) return;
  const P = QMARK[mk];
  const fl = Math.round(Math.sin(G.time*3 + X*0.01)*1.5);
  const y  = Yb - 52 + fl;
  // a soft glow, so it is findable across a crowded ring
  c.globalAlpha = mk==='..' ? 0.10 : 0.18 + 0.07*Math.sin(G.time*3);
  c.fillStyle = P.lit;
  c.beginPath(); c.arc(X+1, y+6, 11, 0, Math.PI*2); c.fill();
  c.globalAlpha = 1;

  px(c,'#12101a', X-3, y-1, 7, 14);          // outline
  if(mk==='!'){
    px(c,P.dim, X-2, y,    5, 8);
    px(c,P.lit, X-2, y,    3, 8);
    px(c,'#ffffff', X-2, y, 1, 4);
    px(c,P.dim, X-2, y+10, 5, 3);
    px(c,P.lit, X-2, y+10, 3, 3);
  } else {
    // a question mark: hook over, stem down, dot under
    px(c,P.dim, X-2, y,   5, 3);
    px(c,P.lit, X-2, y,   4, 2);
    px(c,P.dim, X+1, y+2, 3, 3);
    px(c,P.lit, X+1, y+2, 2, 3);
    px(c,P.dim, X-1, y+5, 4, 2);
    px(c,P.lit, X-1, y+5, 3, 2);
    px(c,P.dim, X-1, y+7, 3, 2);
    px(c,P.lit, X-1, y+7, 2, 2);
    px(c,P.dim, X-1, y+11, 3, 3);
    px(c,P.lit, X-1, y+11, 2, 2);
  }
}

// ---------------------------------------------------------------------------
// DRAGON — palette driven by the chosen element
// ---------------------------------------------------------------------------
const DR_BODY = [[-4,-4,8],[-3,-5,10],[-2,-6,11],[-1,-6,11],[0,-6,11],[1,-5,9],[2,-4,7],[3,-3,5]];
const DR_HEAD = [[-8,4,5],[-7,3,7],[-6,3,8],[-5,4,7],[-4,5,4]];
const DR_NECK = [[-5,1,4],[-4,1,5]];
const DR_WING = [[-10,-1,3],[-9,-1,5],[-8,0,6],[-7,1,5],[-6,2,4]];

function rowsDraw(c, rows, X, Y, f, col, inset){
  for(const r of rows){
    const w = Math.max(1, r[2]-(inset?2:0));
    const x0 = r[1]+(inset?1:0);
    px(c, col, f>0 ? X+x0 : X-x0-w, Y+r[0], w, 1);
  }
}

function drawDragon(c){
  const P = drg;
  const bob = Math.round(Math.sin(dragon.bob)*1.4);
  const X = Math.round(dragon.x), Y = Math.round(dragon.y)+bob;
  // The hatchling faces what it is aiming at, falling back to the rider's
  // heading. dragon.face is undefined on the dragon page and on the title,
  // where there is no world to look at, so the fallback has to stay.
  const f = (dragon.face !== undefined ? dragon.face : (player.dx>=0 ? 1 : -1)) >= 0 ? 1 : -1;
  const L = d => f>0 ? X+d : X-d;

  px(c, C.shadow, X-5, Y+10, 10, 3);

  // wing
  const wy = Math.round(Math.sin(dragon.flap)*2);
  for(const r of DR_WING) px(c,P.a, f>0?X-r[1]-r[2]:X+r[1], Y+r[0]+wy, r[2],1);
  for(const r of DR_WING) if(r[2]>=3) px(c,P.b, f>0?X-r[1]-r[2]+1:X+r[1]+1, Y+r[0]+wy, r[2]-2,1);
  px(c,P.c, f>0?X-4:X+2, Y-8+wy, 2,1);

  // tail
  const tail=[[1,-8,3],[0,-10,3],[-1,-11,2],[-2,-12,2]];
  for(const r of tail) px(c,P.a, f>0?X+r[1]:X-r[1]-r[2], Y+r[0], r[2],1);
  px(c,P.c, f>0?X-13:X+11, Y-4, 2,3);

  // body
  rowsDraw(c, DR_BODY, X, Y, f, P.a);
  rowsDraw(c, DR_BODY, X, Y, f, P.b, true);
  px(c,P.belly, X-3, Y+1, 6, 3);
  for(let i=0;i<2;i++) px(c,P.c, f>0?X-5+i*3:X+3-i*3, Y-5, 2, 1);

  // legs
  px(c,P.a, X-3, Y+4, 3, 4);
  px(c,P.a, X+1, Y+4, 3, 4);
  px(c,P.c, X-3, Y+7, 3, 1);
  px(c,P.c, X+1, Y+7, 3, 1);

  // head
  rowsDraw(c, DR_NECK, X, Y, f, P.a);
  rowsDraw(c, DR_HEAD, X, Y, f, P.a);
  rowsDraw(c, DR_HEAD, X, Y, f, P.b, true);
  px(c,P.a, L(f>0?10:-11), Y-6, 2,2);
  px(c,P.c, L(f>0?10:-11), Y-6, 1,1);
  px(c,'#2a1520', L(f>0?11:-11), Y-5, 1,1);
  px(c,'#2a1520', L(f>0?6:-7), Y-7, 2,2);
  px(c,P.eye,     L(f>0?6:-7), Y-7, 1,1);
  px(c,P.c, L(f>0?4:-5), Y-10, 2,2);
  px(c,P.c, L(f>0?3:-4), Y-9,  2,1);
  px(c,P.a, L(f>0?5:-8), Y-4, 5,1);

  drawFittedParts(c, X, Y, f, wy);
}

// ---------------------------------------------------------------------------
// FITTED PARTS
//
// Each part is drawn in the colours of the creature it came off, not the
// dragon's — the whole point is that you can see what you bolted on. Against
// the hatchling's palette that reads as hardware, which is exactly right: it
// IS hardware, cut off something you killed.
// ---------------------------------------------------------------------------
function drawFittedParts(c, X, Y, f, wy){
  const L = d => f>0 ? X+d : X-d;
  const head = fittedPart('head'), wing = fittedPart('wing'), body = fittedPart('body');

  if(wing){
    // Wings sit BEHIND the body and taper outward. Drawn as flat rectangles
    // they covered the dragon's flank and read as cargo rather than a wing,
    // so every row here gets shorter the further out it goes.
    const W = ENEMY_TYPES[wing.from].col;
    const wo = d => f>0 ? X-6-d : X+4+d;      // d = distance out from the body
    switch(wing.id){
      case 'wingplate':                                   // rustquail: brass plate
        for(let i=0;i<3;i++) px(c,W.metal, wo(2+i*2), Y-7+i+wy, 3, 3-i);
        px(c,'#c9c5bd', wo(2), Y-7+wy, 3, 1);
        break;
      case 'leafwing':                                    // moth: copper leaves
        for(let i=0;i<4;i++){
          px(c,W.metal, wo(1+i*2), Y-9+i+wy, 3, 7-i);
          px(c,W.b,     wo(1+i*2), Y-8+i+wy, 2, 5-i);
        }
        px(c,W.accent, wo(4), Y-4+wy, 2, 2);
        break;
      case 'pinions':                                     // hawk: rod pinions
        for(let i=0;i<5;i++) px(c,W.metal, wo(1+i*2), Y-8+i*2+wy, 3, 2);
        for(let i=0;i<3;i++) px(c,W.b,     wo(2+i*2), Y-7+i*2+wy, 2, 1);
        px(c,W.accent, wo(9), Y+1+wy, 2, 3);
        break;
      case 'riveted':                                     // gull: riveted wings
        for(let i=0;i<4;i++){
          px(c,W.b, wo(1+i*2), Y-8+i+wy, 3, 6-i);
          px(c,W.c, wo(1+i*2), Y-8+i+wy, 3, 2);
        }
        px(c,W.a, wo(9), Y-4+wy, 3, 3);                   // black tip
        for(let i=0;i<3;i++) px(c,'#6b6b75', wo(2+i*2), Y-7+i+wy, 1, 1);
        break;
    }
  }

  if(body){
    const B = ENEMY_TYPES[body.from].col;
    switch(body.id){
      case 'sac':                                         // sporeling: spore sac
        px(c,B.a, X-4, Y+1, 8, 5);
        px(c,B.b, X-3, Y+2, 6, 3);
        for(let i=0;i<3;i++) px(c,B.accent, X-3+i*3, Y+2, 1, 1);
        break;
      case 'coil':                                        // tickboar: coiled tail
        for(let i=0;i<5;i++)
          px(c,B.metal, f>0?X-9-i:X+8+i, Y-3+((i%2)?1:0), 3, 1);
        break;
      case 'slag':                                        // slagbear: slag plating
        px(c,B.metal, X-5, Y-3, 10, 4);
        px(c,'#3a2a22', X-5, Y-3, 10, 1);
        px(c,B.accent, X-4, Y,   8, 1);
        px(c,B.metal, X-4, Y+3, 8, 3);
        px(c,B.accent, X-3, Y+5, 6, 1);
        break;
      case 'claw':                                        // anvilcrab: piston claw
        px(c,B.metal, L(f>0?5:-9), Y+2, 5, 5);
        px(c,'#c9c5bd', L(f>0?5:-9), Y+2, 5, 1);
        px(c,B.a,      L(f>0?5:-9), Y+5, 5, 2);
        px(c,B.accent, L(f>0?7:-7), Y+3, 2, 2);
        break;
      case 'impeller':                                    // turbineel: impeller collar
        px(c,B.metal, X-5, Y-6, 10, 3);
        const spin = Math.floor(G.time*7)%3;
        for(let k=0;k<3;k++){
          const a=(spin+k)*2.09;
          px(c,'#c9c5bd', Math.round(X+Math.cos(a)*4), Math.round(Y-5+Math.sin(a)*2), 2, 1);
        }
        px(c,B.accent, X-1, Y-5, 2, 1);
        break;
    }
  }

  if(head){
    const H = ENEMY_TYPES[head.from].col;
    switch(head.id){
      case 'incisors':                                    // gearrat: steel teeth
        px(c,'#d8dce4', L(f>0?9:-11), Y-4, 3, 2);
        px(c,'#9aa0b0', L(f>0?9:-11), Y-3, 3, 1);
        break;
      case 'lens':                                        // drone: survey lens
        px(c,H.metal, L(f>0?5:-9), Y-10, 5, 4);
        px(c,'#8fd6ff', L(f>0?6:-8), Y-9, 3, 2);
        px(c,'#ffffff', L(f>0?6:-8), Y-9, 1, 1);
        break;
      case 'ears':                                        // brasshare: long brass ears
        px(c,H.metal, L(f>0?3:-5), Y-18, 2, 9);
        px(c,H.accent,L(f>0?3:-5), Y-18, 1, 7);
        px(c,H.metal, L(f>0?6:-8), Y-17, 2, 8);
        px(c,H.accent,L(f>0?6:-8), Y-17, 1, 6);
        break;
      case 'horns':                                       // cragram: banded horns
        for(let k=0;k<5;k++){
          const a = -0.9 - k*0.5;
          const hx = X + (f>0?5:-5) + Math.cos(a)*5*f - (f>0?0:2);
          const hy = Y - 9 + Math.sin(a)*4;
          px(c, k%2?H.metal:'#c9c5bd', hx, hy, 3, 3);
        }
        break;
    }
  }
}
// ---------------------------------------------------------------------------
// CREATURES
// ---------------------------------------------------------------------------
// Stage 4 of the art migration. Every body below is authored at ART density
// inside withArt(ART) — an 8-world-unit creature is 16 authored units — and
// reads its pose out of the frame tables rather than off a free-running sine.
//
// The rule from the earlier pass still holds and is the whole design of this
// bestiary: each of these must read as a CREATURE first and a machine second,
// so the metal is always an ADDITION to a recognisable animal silhouette,
// never a replacement for it. The hare is a hare with brass ears, not a brass
// hare. Metal uses the cold col.metal ramp against the warm organic body,
// which is what makes it look bolted on rather than painted on.
// ---------------------------------------------------------------------------

// Six-step walk, two-step breathe, three-step strike. Every quadruped and
// every biped in the game reads from these tables, so a hare and a slagbear
// are animated on the same beat and the bestiary moves like one game.
const E_LEG  = [0, 4, 6, 4, 0, -4];      // near-side leg swing, authored units
const E_BOB  = [0,-2,-3,-2, 0, -1];      // the body rises over the stride
const E_LEAN = [0, 1, 2, 1, 0, -1];      // and pitches forward into it
const E_IDLE = [0, -2];
// Wind-up / strike / recover. The body pulls BACK before it goes forward:
// that recoil is the entire reason a telegraph reads as a telegraph, and it
// is why every hostile in the game now has a distinct wind-up pose.
const E_ATK  = [-6, 9, 3];
const E_ATKY = [-2,  2, 1];

// Four legs on the six-step cycle, diagonal pairs half a cycle apart. A
// quadruped whose legs move together is a hopping toy, which is what the
// two-pose flip made all of these look like.
function quadLegs(c, mx, ground, spread, len, w, fr, moving, colA, colB){
  const ph = [0, 3, 3, 0];
  const xs = [spread-w, spread-w*2-2, -spread, -spread+w+2];
  for(let k=0;k<4;k++){
    const s  = moving ? E_LEG[(fr+ph[k])%6] : 0;
    const x  = mx + xs[k] + Math.round(s*0.5);
    const h  = Math.max(3, len - Math.round(Math.abs(s)*0.3));
    px(c, k<2?colA:colB, x, ground-h, w, h);
    px(c, colB, x-1, ground-2, w+2, 2);          // the foot
  }
}

// A soft elliptical drop shadow, in authored units. Creatures used to sit on
// a filled rectangle, which reads as a sticker rather than as a thing on the
// ground — and at 2x the rectangle got twice as obvious.
function critterShadow(c, mx, gy, w, h){
  const rx=w/2, ry=h/2;
  for(let j=0;j<h;j++){
    const dy=(j+0.5-ry)/ry, s=1-dy*dy;
    if(s<=0) continue;
    const half=Math.round(rx*Math.sqrt(s));
    if(half<1) continue;
    px(c,'rgba(16,10,20,'+(0.34*(0.4+0.6*s)).toFixed(3)+')', mx-half, gy+j, half*2, 1);
  }
}

function drawEnemy(c, e){
  const T0=ENEMY_TYPES[e.kind];
  const X=Math.round(e.x), Y=Math.round(e.y), col=T0.col;
  if(e.dead){
    const t=1-e.deadT/0.4;
    if(T0.melt){
      // It does not fall over, it goes out. The body slumps into a puddle of
      // its own colour and the puddle sinks, which is the only death in the
      // game the player is meant to read as "that will be back".
      const h = Math.max(1, Math.round((1-t)*e.r*2));
      const w = Math.round(e.r*2 + t*6);
      c.globalAlpha = 1-t*0.6;
      px(c, col.b, X-w/2, Y+e.r-h, w, h);
      px(c, col.c, X-w/2+1, Y+e.r-h, w-2, Math.max(1,h-2));
      c.globalAlpha = 1;
      if(Math.random()<0.5) G.particles.push({x:X+(Math.random()-0.5)*10, y:Y,
        vx:(Math.random()-0.5)*14, vy:-26, life:0.35, max:0.5, kind:'flame', col:col.c, s:1});
      return;
    }
    c.globalAlpha=1-t;
    px(c,col.a, X-e.r, Y-e.r, e.r*2, e.r*2);
    c.globalAlpha=1;
    return;
  }
  const hurt=e.flash>0;
  const A = hurt?'#ffffff':col.a, B = hurt?'#ffe0e0':col.b, Cc = hurt?'#ffffff':col.c;
  const f=e.facing;

  withArt(ART, () => {
  // Authored-unit origin. AY is the creature's FEET, as for the player.
  const AX = X*ART, AY = Y*ART;
  const fr  = e.frame|0, mv = !!e.moving, af = e.atkFr;
  // The pose. Attack overrides the walk entirely: a thing mid-swing is not
  // also mid-stride.
  const bob  = af>=0 ? E_ATKY[af] : (mv ? E_BOB[fr] : E_IDLE[e.idleFr|0]);
  const lean = (af>=0 ? E_ATK[af] : (mv ? E_LEAN[fr] : 0)) * f;
  const wind = af===0, strike = af===1;
  const BX = AX + lean;                                  // the body's centre
  const hov2 = Math.round(Math.sin(e.bob*1.6)*3);        // for the fliers
  critterShadow(c, AX, AY+10, e.r*ART*1.9 + (af>=0?4:0), 7);

  if(e.kind==='rustquail'){
    // plump clockwork fowl — the quest target
    quadLegs(c, BX, AY+12, 5, 12, 3, fr, mv, '#3a2c1e', '#2f2318');
    px(c,A, BX-12, AY-14+bob, 24, 19);              // body
    px(c,B, BX-10, AY-13+bob, 20, 16);
    px(c,Cc,BX-9,  AY-12+bob, 12,  8);              // lit back
    for(let k=0;k<4;k++)                            // feather scallops
      px(c,A, BX-8+k*5, AY-4+bob, 4, 2);
    px(c,col.metal, BX-11, AY-13+bob, 10, 5);       // brass wing plate
    px(c,'#c9c5bd',  BX-11, AY-13+bob, 10, 2);
    px(c,col.metal, BX-11, AY-9+bob,  10, 1);
    px(c,A, BX+7*f-(f>0?0:7), AY-23+bob, 8, 12);    // neck
    px(c,B, BX+8*f-(f>0?0:6), AY-22+bob, 6,  9);
    px(c,A, BX+5*f-(f>0?0:9), AY-30+bob, 11, 9);    // head
    px(c,B, BX+7*f-(f>0?0:8), AY-29+bob,  7, 7);
    px(c,'#2a1a14', BX+10*f-(f>0?0:4), AY-27+bob, 2, 2);
    px(c,'#ffffff', BX+10*f-(f>0?0:4), AY-27+bob, 1, 1);
    px(c,col.accent, BX+13*f-(f>0?0:5), AY-25+bob, 6, 4);   // beak
    px(c,shade(col.accent,0.7), BX+13*f-(f>0?0:5), AY-23+bob, 6, 2);
    px(c,col.accent, BX+6*f, AY-36+bob, 3, 6);              // crest
    px(c,col.accent, BX+2*f, AY-34+bob, 3, 4);
    px(c,Cc, BX-17, AY-8+bob, 7, 8);                        // tail feathers
    px(c,col.metal, BX-21, AY-10+bob, 7, 4);
    px(c,'#c9c5bd', BX-21, AY-10+bob, 7, 1);
  }
  else if(e.kind==='gearrat'){
    quadLegs(c, BX, AY+12, 5, 11, 3, fr, mv, '#3a2c1e', '#2f2318');
    px(c,A, BX-11, AY-8+bob, 23, 12);
    px(c,B, BX-9,  AY-6+bob, 19,  9);
    px(c,col.metal, BX-9, AY-9+bob, 17, 4);         // the plate down its spine
    px(c,'#c9c5bd', BX-9, AY-9+bob, 17, 2);
    for(let k=0;k<4;k++) px(c,'#57544e', BX-7+k*4, AY-8+bob, 1, 2);
    px(c,A, BX+8*f-(f>0?0:7), AY-9+bob, 9, 11);     // head
    px(c,B, BX+9*f-(f>0?0:6), AY-7+bob, 7,  8);
    px(c,A, BX+14*f-(f>0?0:5), AY-3+bob, 7, 4);     // snout
    px(c,'#e8e4dc', BX+17*f-(f>0?0:3), AY-2+bob, 3, 2);   // incisors
    px(c,col.accent, BX+11*f-(f>0?0:3), AY-6+bob, 2, 2);  // eye
    px(c,A, BX+8*f-(f>0?0:8), AY-14+bob, 5, 5);     // ear
    px(c,B, BX+9*f-(f>0?0:7), AY-13+bob, 3, 3);
    for(let k=0;k<5;k++)                            // the segmented tail
      px(c,col.metal, BX-13*f-k*3*f-(f>0?0:4), AY-5+bob+(k%2?2:0), 4, 4);
  }
  else if(e.kind==='drone'){
    const hov=hov2;
    const spin=Math.floor(e.anim*3)%2;
    px(c,col.metal, BX-(spin?15:6), AY-23+hov, spin?30:12, 2);   // rotor
    px(c,'#c9c5bd', BX-(spin?15:6), AY-23+hov, spin?30:12, 1);
    px(c,A, BX-2, AY-23+hov, 5, 7);                  // mast
    px(c,'#1a1620', BX-12, AY-18+hov, 24, 19);       // hull
    px(c,A, BX-11, AY-17+hov, 22, 17);
    px(c,B, BX-10, AY-16+hov, 20, 14);
    px(c,Cc,BX-10, AY-16+hov, 20, 4);
    px(c,'#c9c5bd', BX-10, AY-16+hov, 9, 2);
    px(c,col.metal, BX-11, AY-7+hov, 22, 3);
    px(c,'#1a1418', BX-7, AY-13+hov, 13, 7);         // the lens housing
    px(c,col.accent, BX-3+(f>0?4:-4), AY-13+hov, 5, 5);
    px(c,'#ffffff',  BX-3+(f>0?4:-4), AY-13+hov, 2, 2);
    for(let k=0;k<3;k++) px(c,'#57544e', BX-8+k*7, AY-6+hov, 2, 2);   // rivets
    px(c,'#1a1418', BX-9, AY-1+hov, 6, 5);           // skids
    px(c,'#1a1418', BX+4, AY-1+hov, 6, 5);
    if(wind){ px(c,col.accent, BX-3, AY-14+hov, 7, 7); px(c,'#ffffff', BX-1, AY-12+hov, 3, 3); }
  }
  else if(e.kind==='brasshare'){
    const hop = mv ? Math.round(Math.abs(Math.sin(e.walk*0.8))*7) : 0;
    const Yb  = AY - hop;
    px(c,'#2f2318', BX-7, Yb-1, 5, 5);                       // hind feet
    px(c,'#2f2318', BX+3, Yb-1, 5, 5);
    px(c,A, BX-12, Yb-15+bob, 24, 17);                       // body
    px(c,B, BX-10, Yb-14+bob, 20, 14);
    px(c,Cc,BX-10, Yb-13+bob, 12,  7);
    px(c,A, BX+6*f-(f>0?0:10), Yb-25+bob, 12, 12);           // head
    px(c,B, BX+8*f-(f>0?0:9),  Yb-23+bob,  8,  9);
    px(c,'#2a1a14', BX+11*f-(f>0?0:4), Yb-21+bob, 2, 2);     // eye
    px(c,'#ffffff', BX+11*f-(f>0?0:4), Yb-21+bob, 1, 1);
    px(c,shade(A,0.8), BX+13*f-(f>0?0:4), Yb-17+bob, 4, 3);  // muzzle
    // brass ears — hammered, ribbed, and far too long
    for(const [ox,hh] of [[4,19],[10,17]]){
      const ex = BX+ox*f-(f>0?0:ox+3);
      px(c,'#57544e',  ex-1, Yb-40+bob, 6, hh+2);
      px(c,col.metal,  ex,   Yb-40+bob, 4, hh);
      px(c,col.accent, ex,   Yb-40+bob, 2, hh-4);
      for(let k=0;k<4;k++) px(c,'#57544e', ex, Yb-36+bob+k*4, 4, 1);
    }
    px(c,col.metal, BX-12*f+(f>0?0:9), Yb-9+bob, 8, 10);     // leaf-spring haunch
    px(c,'#c9c5bd', BX-12*f+(f>0?0:9), Yb-9+bob, 8, 2);
    px(c,'#57544e', BX-12*f+(f>0?0:9), Yb-5+bob, 8, 1);
    px(c,Cc, BX-16*f+(f>0?0:13), Yb-13+bob, 6, 6);           // tail
    px(c,'#ffffff', BX-16*f+(f>0?0:13), Yb-13+bob, 4, 3);
  }
  else if(e.kind==='tickboar'){
    quadLegs(c, BX, AY+13, 12, 15, 5, fr, mv, '#3a3020', '#2a2218');
    px(c,A, BX-19, AY-19+bob, 38, 24);                       // heavy body
    px(c,B, BX-17, AY-17+bob, 34, 21);
    px(c,Cc,BX-15, AY-16+bob, 19,  7);
    for(let k=0;k<9;k++)                                     // bristles
      px(c,A, BX-15+k*4, AY-25+bob-((k%2)?1:0), 2, 8);
    px(c,A, BX+14*f-(f>0?0:24), AY-17+bob, 13, 17);          // head
    px(c,B, BX+16*f-(f>0?0:22), AY-15+bob,  9, 13);
    px(c,col.metal, BX+21*f-(f>0?0:27), AY-11+bob, 9, 9);    // iron snout plate
    px(c,'#c9c5bd', BX+21*f-(f>0?0:27), AY-11+bob, 9, 3);
    for(let k=0;k<3;k++) px(c,'#57544e', BX+22*f-(f>0?0:26)+k*3, AY-5+bob, 1, 2);
    px(c,'#e8e4dc', BX+23*f-(f>0?0:25), AY-17+bob, 4, 7);    // tusks
    px(c,'#ffffff', BX+23*f-(f>0?0:25), AY-17+bob, 2, 4);
    px(c,col.accent, BX+17*f-(f>0?0:20), AY-13+bob, 2, 2);   // eye
    for(let k=0;k<5;k++)                                     // coiled spring tail
      px(c,col.metal, BX-21*f+(f>0?0:17)-(k%2)*2*f, AY-17+k*4+bob, 6, 2);
  }
  else if(e.kind==='pollenmoth'){
    const flap=Math.sin(e.anim*3.2), hov=hov2;
    const wy=Math.round(flap*6), sq=Math.round(Math.abs(flap)*3);
    for(const sd of [-1,1]){
      // Copper-leaf wings, drawn as rows so the leading edge can be straight
      // and the trailing edge scalloped. Rectangles read as cardboard.
      for(let j=0;j<28;j++){
        const t2=(j+0.5)/28;
        const w = Math.round((22-sq) * Math.sin(Math.pow(t2,0.65)*Math.PI*0.98));
        if(w<2) continue;
        const y2 = AY-31+wy+hov+j;
        pxm(c,'#4a3020', BX,sd,3,   y2, w+2, 1);
        pxm(c,col.metal, BX,sd,4,   y2, w,   1);
        if(w>5) pxm(c,B, BX,sd,6,   y2, w-4, 1);
        if(w>9 && j<16) pxm(c,Cc, BX,sd,6, y2, w-8, 1);
      }
      pxm(c,col.metal,  BX,sd,5, AY-17+wy+hov,  15-sq,  2);  // wing vein
      pxm(c,col.metal,  BX,sd,5, AY-24+wy+hov,  11-sq,  1);
      pxm(c,'#1a1214',  BX,sd,10,AY-23+wy+hov,   9,     9);  // eyespot
      pxm(c,col.accent, BX,sd,11,AY-22+wy+hov,   7,     7);
      pxm(c,'#ffffff',  BX,sd,12,AY-21+wy+hov,   3,     3);
    }
    px(c,A, BX-6, AY-23+hov, 13, 24);                        // furred thorax
    px(c,B, BX-4, AY-21+hov,  9, 20);
    px(c,Cc,BX-4, AY-21+hov,  4,  9);
    for(let k=0;k<4;k++) px(c,A, BX-6, AY-12+hov+k*4, 13, 1);   // abdomen bands
    px(c,A, BX-6, AY-31+hov, 13, 10);                        // head
    px(c,B, BX-4, AY-30+hov,  9,  7);
    px(c,col.accent, BX-4, AY-29+hov, 3, 3);                 // compound eyes
    px(c,col.accent, BX+2, AY-29+hov, 3, 3);
    px(c,'#ffffff',  BX-4, AY-29+hov, 1, 1);
    px(c,'#ffffff',  BX+2, AY-29+hov, 1, 1);
    for(const sd of [-1,1]){                                 // feathered antennae
      pxm(c,col.metal, BX,sd,2, AY-40+hov, 3, 10);
      for(let k=0;k<4;k++) pxm(c,col.metal, BX,sd,4, AY-39+hov+k*2, 3, 1);
    }
    if(Math.random()<0.05) G.particles.push({x:X+(Math.random()-0.5)*14,y:Y-8,
      vx:(Math.random()-0.5)*8,vy:8,life:0.9,max:1.0,kind:'mote',col:col.accent,s:1});
  }
  else if(e.kind==='cragram'){
    quadLegs(c, BX, AY+13, 11, 15, 4, fr, mv, '#3a352c', '#2a2620');
    px(c,A, BX-17, AY-21+bob, 34, 24);                       // fleeced body
    px(c,B, BX-15, AY-19+bob, 30, 21);
    for(let k=0;k<7;k++)                                     // fleece curls
      for(let j=0;j<2;j++)
        px(c,Cc, BX-13+k*4, AY-19+bob+j*6, 4, 4);
    px(c,A, BX+12*f-(f>0?0:22), AY-29+bob, 11, 17);          // head
    px(c,B, BX+14*f-(f>0?0:20), AY-27+bob,  7, 13);
    px(c,shade(A,0.8), BX+18*f-(f>0?0:22), AY-19+bob, 5, 5); // muzzle
    px(c,'#1a1614', BX+16*f-(f>0?0:17), AY-25+bob, 2, 2);
    // Banded iron horns curling back on themselves. The spiral shares a
    // centre with the head — drawn on its own centre it read as a separate
    // object floating beside the ram.
    for(let k=0;k<9;k++){
      const a  = -0.9 - k*0.40;
      const hx = BX + 14*f + Math.cos(a)*15*f - (f>0?4:3);
      const hy = AY - 26 + bob + Math.sin(a)*13;
      px(c,'#57544e',               hx-1, hy-1, 9, 9);
      px(c, k%2?col.metal:'#c9c5bd', hx,  hy,   7, 7);
      px(c,'#57544e',               hx,   hy+5, 7, 2);       // banding
    }
  }
  else if(e.kind==='slagbear'){
    quadLegs(c, BX, AY+14, 15, 16, 7, fr, mv, '#2a221a', '#1e1a16');
    px(c,'#1a1310', BX-24, AY-32+bob, 47, 37);               // bulk
    px(c,A, BX-23, AY-31+bob, 45, 35);
    px(c,B, BX-21, AY-29+bob, 41, 31);
    px(c,Cc,BX-19, AY-27+bob, 19, 10);                       // lit shoulder
    px(c,A, BX-21, AY-14+bob, 41,  3);                       // the fold of the hide
    for(let k=0;k<9;k++)                                     // shaggy hem
      px(c,A, BX-21+k*5, AY+1+bob, 4, 5);
    // TWO slag plates, set into the hide and still glowing at the seams. Four
    // of them covered the animal and it read as a brick wall.
    for(const [px2,py2,w2] of [[-17,-26,16],[-12,-10,22]]){
      px(c,'#3a2a22',  BX+px2-1, AY+py2-1+bob, w2+2, 12);
      px(c,col.metal,  BX+px2,   AY+py2+bob,   w2,   10);
      px(c,'#c9c5bd',  BX+px2,   AY+py2+bob,   w2,    2);
      px(c,col.accent, BX+px2+1, AY+py2+8+bob, w2-2,  2);
      for(let k=0;k<3;k++) px(c,'#57544e', BX+px2+2+k*5, AY+py2+2+bob, 2, 2);
    }
    px(c,'#1a1310', BX+17*f-(f>0?0:36), AY-40+bob, 21, 24);  // head
    px(c,A, BX+18*f-(f>0?0:35), AY-39+bob, 19, 22);
    px(c,B, BX+20*f-(f>0?0:33), AY-37+bob, 15, 18);
    px(c,A, BX+27*f-(f>0?0:37), AY-28+bob, 11, 11);          // muzzle
    px(c,'#1a1310', BX+33*f-(f>0?0:37), AY-25+bob, 4, 4);    // nose
    px(c,A, BX+18*f-(f>0?0:26), AY-44+bob, 7, 6);            // ears
    px(c,A, BX+28*f-(f>0?0:34), AY-43+bob, 7, 6);
    px(c,col.accent, BX+23*f-(f>0?0:29), AY-34+bob, 4, 4);   // ember eye
    px(c,'#ffffff',  BX+23*f-(f>0?0:29), AY-34+bob, 2, 2);
    px(c,'#e8e4dc',  BX+29*f-(f>0?0:35), AY-22+bob, 6, 5);   // teeth
    if(wind){                                                // both arms up
      px(c,A, BX+14*f-(f>0?0:22), AY-40+bob, 9, 13);
      px(c,col.metal, BX+16*f-(f>0?0:22), AY-44+bob, 3, 7);
      px(c,col.metal, BX+20*f-(f>0?0:20), AY-44+bob, 3, 7);
    }
    if(!SILHOUETTE){
      const gl=0.10+0.05*Math.sin(G.time*3+e.id);
      c.fillStyle='rgba(255,106,60,'+gl+')';
      // world units: arc goes through the context transform, not through px
      c.beginPath(); c.arc(X, Y-6, 26, 0, Math.PI*2); c.fill();
    }
  }
  else if(e.kind==='pylonhawk'){
    const flap=Math.sin(e.anim*4), hov=hov2;
    for(const sd of [-1,1]){
      // A pinion, not a boomerang: broad and deep where it meets the body,
      // tapering and sweeping BACK along its length. Drawn as columns so the
      // leading edge can stay straight while the trailing edge falls away.
      const lift=Math.round(flap*7*sd);
      for(let k=0;k<11;k++){
        const wx = 6+k*2;
        const wy = AY-21+hov+lift+Math.round(k*k*0.16);
        const wh = Math.max(3, 17-k);
        pxm(c,'#3a2416', BX,sd,wx, wy-1, 3, wh+2);
        pxm(c,col.metal, BX,sd,wx, wy,   3, Math.max(2,(wh*0.45)|0));
        pxm(c,B,         BX,sd,wx, wy+((wh*0.45)|0), 3, Math.max(1,(wh*0.55)|0));
        if(k<4) pxm(c,Cc, BX,sd,wx, wy, 3, 5);
      }
      for(let k=0;k<4;k++)                                   // splayed primaries
        pxm(c,col.metal, BX,sd,26+k*2, AY-6+hov+lift+k*3, 8, 4);
    }
    // body: a bird tapers to the tail, it is not a radiator
    for(let j=0;j<27;j++){
      const w = Math.round(9 - j*0.22);
      px(c,'#141018', BX-w-1, AY-27+hov+j, w*2+2, 1);
      px(c,A,         BX-w,   AY-27+hov+j, w*2,   1);
      if(w>3) px(c,B, BX-w+1, AY-27+hov+j, w*2-3, 1);
      if(w>4 && j<12) px(c,Cc, BX-w+1, AY-27+hov+j, w-1, 1);
    }
    for(let k=0;k<4;k++) px(c,A, BX-6, AY-13+hov+k*3, 12, 1);  // breast barring
    px(c,'#141018', BX+5*f-(f>0?0:13), AY-38+hov, 13, 15);     // head
    px(c,A, BX+6*f-(f>0?0:12), AY-37+hov, 11, 13);
    px(c,B, BX+8*f-(f>0?0:11), AY-35+hov,  7,  9);
    px(c,A, BX+5*f-(f>0?0:10), AY-40+hov, 11,  4);             // the brow
    px(c,col.accent, BX+9*f-(f>0?0:6), AY-34+hov, 4, 4);
    px(c,'#ffffff',  BX+9*f-(f>0?0:6), AY-34+hov, 2, 2);
    px(c,col.metal,  BX+14*f-(f>0?0:8), AY-33+hov, 7, 6);      // hooked beak
    px(c,'#c9c5bd',  BX+14*f-(f>0?0:8), AY-33+hov, 7, 2);
    px(c,col.metal,  BX+18*f-(f>0?0:5), AY-29+hov, 4, 4);
    px(c,col.metal,  BX-10*f+(f>0?0:6), AY-9+hov, 7, 25);      // earthing-rod tail
    px(c,'#c9c5bd',  BX-10*f+(f>0?0:6), AY-9+hov, 2, 25);
    px(c,col.accent, BX-10*f+(f>0?0:6), AY+9+hov, 7, 6);
    if(Math.sin(G.time*7+e.id)>0.75 || wind){
      px(c,'#dff2ff', BX-10*f+(f>0?0:6)+2, AY+13+hov, 3, 8);   // it earths itself
      px(c,'#ffffff', BX-10*f+(f>0?0:6)+1, AY+16+hov, 5, 2);
    }
  }
  else if(e.kind==='anvilcrab'){
    for(let k=0;k<3;k++){                                    // legs, jointed
      const s = mv ? E_LEG[(fr+k*2)%6] : 0;
      px(c,A, BX-20+k*4, AY-4, 4, 10+Math.round(s*0.3));
      px(c,A, BX-21+k*4, AY-1, 6, 3);
      const s2 = mv ? E_LEG[(fr+3+k*2)%6] : 0;
      px(c,A, BX+16-k*4, AY-4, 4, 10+Math.round(s2*0.3));
      px(c,A, BX+15-k*4, AY-1, 6, 3);
    }
    px(c,A, BX-19, AY-21+bob, 38, 23);                       // slag shell
    px(c,B, BX-17, AY-19+bob, 34, 19);
    px(c,col.metal, BX-17, AY-19+bob, 34, 7);                // anvil face
    px(c,'#c9c5bd', BX-17, AY-19+bob, 34, 2);
    px(c,'#57544e', BX-17, AY-13+bob, 34, 1);
    px(c,col.metal, BX-9,  AY-26+bob, 17, 7);                // horn of the anvil
    px(c,'#c9c5bd', BX-9,  AY-26+bob, 17, 2);
    px(c,Cc, BX-13, AY-9+bob, 11, 4);
    px(c,'#1a1210', BX-9, AY-13+bob, 5, 5);                  // eyes on stalks
    px(c,'#1a1210', BX+4, AY-13+bob, 5, 5);
    px(c,col.accent, BX-9, AY-13+bob, 3, 3);
    px(c,col.accent, BX+4, AY-13+bob, 3, 3);
    px(c,'#ffffff',  BX-9, AY-13+bob, 1, 1);
    px(c,'#ffffff',  BX+4, AY-13+bob, 1, 1);
    // one claw has become a hydraulic press — it OPENS on the wind-up
    const gap = wind ? 5 : strike ? 0 : 2;
    const clx = BX+18*f-(f>0?0:30);
    px(c,col.metal, clx, AY-22+bob-gap, 13, 9);              // upper jaw
    px(c,'#c9c5bd', clx, AY-22+bob-gap, 13, 3);
    px(c,A,         clx, AY-10+bob+gap, 13, 5);              // lower jaw
    px(c,'#57544e', clx, AY-10+bob+gap, 13, 2);
    px(c,col.metal, clx-4, AY-17+bob, 5, 11);                // the ram
    px(c,col.accent,clx+5, AY-18+bob-gap, 4, 4);
    px(c,A, BX-23*f+(f>0?0:18), AY-13+bob, 9, 11);           // the small claw
    px(c,B, BX-23*f+(f>0?0:18), AY-13+bob, 9,  4);
  }
  else if(e.kind==='turbineel'){
    const und=Math.sin(e.anim*2.6);
    for(let k=0;k<11;k++){                                   // undulating body
      const sx = BX - 20*f + k*4*f;
      const sy = AY - 13 + Math.round(Math.sin(und*1.2 + k*0.5)*6) + bob;
      const h  = 13 - Math.floor(k/3)*2;
      px(c, '#141018', sx-1, sy-1, 6, h+2);
      px(c, k<3?A:B,   sx,   sy,   5, h);
      px(c, Cc,        sx,   sy,   5, 2);
      if(k%2) px(c, col.metal, sx, sy+h-3, 5, 2);            // fin ribs
    }
    px(c,A, BX+18*f-(f>0?0:30), AY-19+bob, 13, 15);          // head
    px(c,B, BX+20*f-(f>0?0:28), AY-17+bob,  9, 11);
    px(c,col.accent, BX+22*f-(f>0?0:24), AY-15+bob, 3, 3);
    px(c,'#ffffff',  BX+22*f-(f>0?0:24), AY-15+bob, 1, 1);
    px(c,'#e8e4dc',  BX+27*f-(f>0?0:30), AY-10+bob, 5, 4);   // teeth
    // the impeller collar, spinning
    const spin=Math.floor(e.anim*4)%3;
    px(c,'#57544e',  BX+11*f-(f>0?0:19), AY-26+bob, 7, 28);
    px(c,col.metal,  BX+12*f-(f>0?0:18), AY-25+bob, 5, 26);
    for(let k=0;k<3;k++){
      const a=(spin+k)*2.09;
      px(c,'#c9c5bd', Math.round(BX+13*f-(f>0?0:17)+Math.cos(a)*9),
                      Math.round(AY-13+bob+Math.sin(a)*11), 5, 5);
    }
    px(c,col.accent, BX+11*f-(f>0?0:19), AY-14+bob, 7, 5);
    px(c,'#ffffff',  BX+12*f-(f>0?0:18), AY-13+bob, 3, 2);
  }
  else if(e.kind==='gullwright'){
    const flap=Math.sin(e.anim*3.4), hov=hov2;
    for(const sd of [-1,1]){                                 // riveted wings
      const lift=Math.round(flap*6*sd);
      pxm(c,'#3a3a44',  BX,sd,5, AY-26+hov+lift, 22, 12);
      pxm(c,B,          BX,sd,6, AY-25+hov+lift, 20, 10);
      pxm(c,Cc,         BX,sd,6, AY-25+hov+lift, 14,  4);
      pxm(c,col.metal,  BX,sd,6, AY-17+hov+lift, 20,  2);
      pxm(c,A,          BX,sd,19,AY-22+hov+lift,  9,  9);    // black wingtip
      for(let k=0;k<4;k++)
        pxm(c,'#6b6b75', BX,sd,8+k*4, AY-23+hov+lift, 2, 2); // rivets
    }
    px(c,B, BX-8, AY-23+hov, 17, 21);                        // body
    px(c,Cc,BX-6, AY-21+hov, 13, 17);
    px(c,A, BX-8, AY-7+hov,  17,  4);
    px(c,Cc,BX+6*f-(f>0?0:11), AY-33+hov, 11, 13);           // head
    px(c,B, BX+8*f-(f>0?0:10), AY-31+hov,  7,  9);
    px(c,'#1a1a20', BX+9*f-(f>0?0:5), AY-29+hov, 3, 3);
    px(c,'#ffffff', BX+9*f-(f>0?0:5), AY-29+hov, 1, 1);
    px(c,col.accent, BX+13*f-(f>0?0:13), AY-27+hov, 9, 5);   // spanner beak
    px(c,col.metal,  BX+18*f-(f>0?0:15), AY-29+hov, 4, 3);
    px(c,col.metal,  BX+18*f-(f>0?0:15), AY-23+hov, 4, 3);
    px(c,col.accent, BX-5, AY+1+hov, 4, 7);                  // feet
    px(c,col.accent, BX+2, AY+1+hov, 4, 7);
  }
  else if(T0.pylon){
    // A squat iron socket with a gem in it, pouring light up and out. The
    // colour is the imp's, so you can read across the room which one this is
    // going to keep making.
    const ic = ENEMY_TYPES[e.impKind] ? ENEMY_TYPES[e.impKind].col : col;
    const glow = 0.6 + Math.sin(G.time*3 + e.id)*0.4;
    c.globalAlpha = 0.20*glow; px(c, ic.c, AX-26, AY-4, 52, 16); c.globalAlpha = 1;
    px(c, A,        AX-19, AY-5, 38, 15);          // base
    px(c, B,        AX-17, AY-7, 34, 11);
    px(c, col.metal,AX-19, AY-9, 38,  5);
    px(c, '#8a7bb0',AX-19, AY-9, 38,  2);
    for(let k=0;k<5;k++) px(c, '#6e5f90', AX-15+k*8, AY-7, 3, 3);   // bolts
    px(c, A,        AX-9, AY-27, 18, 23);          // column
    px(c, B,        AX-7, AY-25, 14, 19);
    px(c, col.metal,AX-9, AY-19, 18,  3);
    px(c, shade(ic.b,0.6), AX-8, AY-40, 16, 18);   // the gem
    px(c, ic.b,     AX-7, AY-39, 14, 16);
    px(c, ic.c,     AX-5, AY-37, 10, 12);
    c.globalAlpha = glow; px(c, '#ffffff', AX-3, AY-35, 5, 7); c.globalAlpha = 1;
    px(c, col.metal,AX-11, AY-42, 4, 7); px(c, col.metal, AX+7, AY-42, 4, 7);  // prongs
    px(c, ic.c,     AX-11, AY-48, 4, 5); px(c, ic.c,     AX+7, AY-48, 4, 5);
    if(Math.random()<0.30) G.particles.push({x:X+(Math.random()-0.5)*8, y:Y-18,
      vx:(Math.random()-0.5)*8, vy:-28-Math.random()*20,
      life:0.5+Math.random()*0.4, max:0.9, kind:'mote', col:ic.c, s:1});
  }
  else if(T0.hurl && T0.elem){
    // ONE creature drawn three times. A small devil poured out of a socket:
    // no legs, because it was never born — the body tapers into the flame it
    // is standing in. Everything here is identical in all three colours; only
    // `col` changes, which is the point of the encounter.
    //
    // Drawn silhouette-first (hem, tail, arms, torso, head) so the shape
    // reads before any detail goes on. An earlier pass built it as a stack of
    // boxes and it read as a totem pole.
    const lick = Math.round(Math.sin(e.anim*2.6)*2);
    const hov  = Math.round(Math.sin(e.bob*1.8)*3);
    const Yb   = AY + hov;

    // --- the flame it stands in instead of legs
    c.globalAlpha=0.5;
    px(c, B,  BX-12, Yb+2, 24, 8);
    px(c, Cc, BX-8,  Yb+4, 16, 6);
    c.globalAlpha=0.8;
    px(c, Cc, BX-11+lick, Yb+6, 6, 4);
    px(c, Cc, BX+4-lick,  Yb+6, 6, 4);
    c.globalAlpha=1;

    // --- tail, curling away behind
    px(c, A,  BX-14*f-(f>0?0:-4), Yb-4,  6, 4);
    px(c, A,  BX-18*f-(f>0?0:-4), Yb-10, 4, 8);
    px(c, Cc, BX-20*f-(f>0?0:-2), Yb-17, 4, 7);      // barbed tip, lit

    // --- body: a wedge, wide at the shoulders, narrow at the hem
    px(c, A,  BX-6,  Yb-7,  13, 10);                 // hips
    px(c, A,  BX-12, Yb-27, 25, 22);                 // chest
    px(c, B,  BX-10, Yb-25, 21, 20);
    px(c, Cc, BX-9,  Yb-23, 10, 12);                 // lit side
    px(c, shade(col.accent,0.6), BX-5, Yb-20, 10, 8);
    px(c, col.accent, BX-4, Yb-19, 8, 6);            // the ember in the chest
    px(c, '#ffffff',  BX-2, Yb-17, 4, 2);

    // --- arms. The far one is thrown out for balance; the near one grips.
    px(c, A,  BX-16*f-(f>0?0:-4), Yb-23, 7, 7);
    px(c, B,  BX-16*f-(f>0?0:-4), Yb-23, 5, 5);
    px(c, A,  BX+12*f-(f>0?0:7),  Yb-27-(wind?6:0), 9, 7);
    px(c, B,  BX+12*f-(f>0?0:7),  Yb-27-(wind?6:0), 7, 5);

    // --- head: broad skull, narrow jaw
    px(c, A,  BX-11, Yb-43, 21, 17);
    px(c, B,  BX-9,  Yb-41, 17, 13);
    px(c, A,  BX-6,  Yb-29, 13,  4);                 // jaw
    px(c, Cc, BX-7,  Yb-39,  6,  7);                 // lit cheek
    px(c, col.accent, BX-7, Yb-37, 5, 4);            // eyes
    px(c, col.accent, BX+2, Yb-37, 5, 4);
    px(c, '#ffffff',  BX-7, Yb-37, 2, 2);
    px(c, '#ffffff',  BX+2, Yb-37, 2, 2);

    // --- horns, sweeping back and out
    for(const sd of [-1,1]){
      pxm(c, A,  BX, sd, 8,  Yb-49, 7, 8);
      pxm(c, A,  BX, sd, 12, Yb-55, 5, 8);
      pxm(c, Cc, BX, sd, 14, Yb-59, 4, 6);
    }

    // --- the fork: haft, two prongs, and the notch between them
    const hx = BX + 16*f - (f>0?0:2), tilt = wind ? -9 : strike ? 5 : 0;
    px(c, '#2a2028',  hx-3, Yb-33+tilt, 9,  41);          // haft outline
    px(c, col.metal,  hx,   Yb-33+tilt, 4,  39);
    px(c, '#c9c5bd',  hx,   Yb-33+tilt, 2,  39);
    px(c, '#2a2028',  hx-9, Yb-53+tilt, 21, 23);          // head outline
    px(c, Cc,         hx-7, Yb-51+tilt, 4,  19);          // outer prong
    px(c, Cc,         hx+6, Yb-51+tilt, 4,  19);          // inner prong
    px(c, B,          hx,   Yb-43+tilt, 4,  11);          // centre spine
    px(c, col.accent, hx-7, Yb-39+tilt, 17, 4);           // crossbar
    px(c, '#ffffff',  hx-7, Yb-51+tilt, 2,  6);
    px(c, '#ffffff',  hx+8, Yb-51+tilt, 2,  6);
    if(wind){
      // A corona around the fork head, not a block over it — this has to read
      // as "about to throw" without hiding the thing it is telling you about.
      c.globalAlpha=0.30; c.fillStyle=col.accent;
      // world units, so the authored-unit coords are divided back down
      c.beginPath();
      c.arc((hx+2)/ART, (Yb-43+tilt)/ART, 12, 0, Math.PI*2); c.fill();
      c.globalAlpha=1;
      px(c, '#ffffff', hx-7, Yb-55+tilt, 4, 4);
      px(c, '#ffffff', hx+7, Yb-55+tilt, 4, 4);
    }

    if(Math.random()<0.4) G.particles.push({x:X+(Math.random()-0.5)*11, y:Y-8,
      vx:(Math.random()-0.5)*10, vy:-32-Math.random()*18,
      life:0.3+Math.random()*0.3, max:0.6, kind:'flame', col:Cc, s:1});
  }
  else { // sporeling
    const pulse=Math.round(Math.sin(e.bob*1.4)*2);
    px(c,A, BX-10, AY-11+bob, 21, 15);                       // the body
    px(c,B, BX-8,  AY-9+bob,  17, 12);
    px(c,Cc,BX-8,  AY-9+bob,   7,  5);
    for(let k=0;k<3;k++) px(c,A, BX-7+k*6, AY-3+bob, 3, 4);  // little roots
    px(c,shade(A,0.7), BX-13, AY-21-pulse+bob, 27, 16);      // cap
    px(c,A,  BX-12, AY-21-pulse+bob, 25, 14);
    px(c,B,  BX-10, AY-21-pulse+bob, 21, 11);
    px(c,Cc, BX-9,  AY-21-pulse+bob, 13,  5);
    for(let k=0;k<4;k++){                                    // spore pores
      const sx=BX-9+k*7, sy=AY-19-pulse+bob+((k%2)?3:0);
      px(c,shade(col.accent,0.6), sx-1, sy-1, 6, 6);
      px(c,col.accent, sx, sy, 4, 4);
      px(c,'#ffffff',  sx, sy, 2, 2);
    }
    px(c,'#1a2214', BX-5, AY-6+bob, 3, 3);
    px(c,'#1a2214', BX+2, AY-6+bob, 3, 3);
    if(wind){ px(c,col.accent, BX-13, AY-24-pulse+bob, 27, 3); }
    if(Math.random()<0.04) G.particles.push({x:X+(Math.random()-0.5)*10,y:Y-8,
      vx:(Math.random()-0.5)*10,vy:-10,life:0.8,max:0.9,kind:'mote',col:col.accent,s:1});
  }
  });

  // --- status pips and the hp bar, in WORLD units ---------------------------
  // These are UI, not art: they must stay the same size however big the thing
  // under them is, so they do not go through the authored-unit block.
  let iy=Y-e.r-13;
  if(e.burn>0){ px(c,C.amber3,X-7,iy,2,2); px(c,C.amber5,X-7,iy-2,2,2); }
  if(e.poison>0){ px(c,C.leaf5,X-4,iy,2,2); }
  if(e.slow>0){ px(c,C.water5,X-1,iy,3,3); }
  if(e.stagger>0){ const s=Math.sin(G.time*14); px(c,C.aether4,X+3+Math.round(s*2),iy-1,2,2); }
  if(e.marked>0){ px(c,C.leaf5,X+5,iy,1,3); px(c,C.leaf5,X+4,iy+1,3,1); }
  if(e.taunt>0){ px(c,'#ff6a5a',X+7,iy,2,4); }

  if(e.hp<e.maxhp){
    const w=e.r*2+4;
    px(c,'#2a1614', X-w/2, Y-e.r-9, w, 3);
    px(c,C.hpRed,   X-w/2, Y-e.r-9, Math.max(1,Math.round(w*(e.hp/e.maxhp))), 3);
    px(c,'#ff9a90', X-w/2, Y-e.r-9, Math.max(1,Math.round(w*(e.hp/e.maxhp))), 1);
  }
}


// ---------------------------------------------------------------------------
// SUMMONED WALLS — a row of stone teeth the Forge Golem slams into the ground
// ---------------------------------------------------------------------------
function drawWalls(c){
  for(const w of G.walls){
    const f = clamp(w.life/w.max, 0, 1);
    const rise = clamp((w.max - w.life)*4, 0, 1);       // erupts on spawn
    const ca = Math.cos(w.ang), sa = Math.sin(w.ang);
    c.globalAlpha = f>0.25 ? 1 : f*4;                    // crumbles at the end
    for(let d=-w.half; d<=w.half; d+=6){
      const bx = Math.round(w.x + ca*d), by = Math.round(w.y + sa*d);
      const h = Math.round((9 + (Math.abs(d)%12===0?3:0)) * rise);
      if(h<=0) continue;
      px(c, C.shadowHard, bx-3, by+1, 7, 3);
      px(c, C.stone1, bx-3, by-h, 7, h+2);
      px(c, C.stone2, bx-2, by-h, 5, h+1);
      px(c, C.stone3, bx-2, by-h, 5, 2);
      px(c, C.stone4, bx-2, by-h, 2, 1);
      if(f<0.4 && Math.random()<0.05)
        G.particles.push({x:bx, y:by-h, vx:(Math.random()-0.5)*20, vy:-10,
          life:0.4, max:0.5, kind:'spark', col:C.stone4, s:1});
    }
    c.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// TARGETING RETICLE
// Four corner brackets that snap inward when a target is first acquired, plus
// a centre tick. Tinted by class so ranged players can read it at a glance.
// ---------------------------------------------------------------------------
// The Savant's scanning beam. World pass only, and it checks that the target
// is still a live enemy in THIS area — the reference survives a zone change,
// and a stale one aims at coordinates on a map you have left.
function drawScanBeam(c){
  for(const p of (PLAYERS.length ? PLAYERS : [player])){
    if(!(p.scanT>0) || !p.scanTarget) continue;
    const t = p.scanTarget;
    if(t.dead || G.enemies.indexOf(t) < 0){ p.scanTarget = null; continue; }
    c.strokeStyle='rgba(143,214,255,'+(0.4+0.4*Math.sin(G.time*20))+')';
    c.lineWidth=1;
    c.beginPath();
    c.moveTo(p.x, p.y-18);
    c.lineTo(t.x, t.y-6);
    c.stroke();
    // a bead running along it, so the beam reads as doing something
    const k=(G.time*2)%1;
    px(c,'#d8f0ff', Math.round(p.x+(t.x-p.x)*k)-1, Math.round((p.y-18)+((t.y-6)-(p.y-18))*k)-1, 2, 2);
  }
}

// ---------------------------------------------------------------------------
// RUNE MARKS (Runebreaker)
//
// A rune used to exist only as a number in the HUD and a puff of float-text
// at the moment it landed. Which creature was carrying what was invisible the
// instant that text drifted away, so the class's whole decision — who to
// detonate — had nothing on screen to support it.
//
// The marks now sit over the head of the creature they were inscribed on and
// stay there for as long as the rune does, whoever the player is looking at.
// They are drawn in the world pass, not the reticle pass, precisely so that
// changing focus cannot take them away.
// ---------------------------------------------------------------------------
function drawRuneMarks(c){
  if(!G.runes || !G.runes.length) return;
  for(const r of G.runes){
    const e = r.e;
    if(!e || e.dead || r.n<=0) continue;
    // The last two seconds blink, because a rune that lapses unspent is the
    // one thing this class must never be surprised by.
    const dying = r.life < 2;
    if(dying && Math.sin(G.time*12) < -0.2) continue;
    const X = Math.round(e.x), Y = Math.round(e.y - e.r - 20);
    const w = r.n*5 - 1, x0 = X - (w>>1);
    px(c, 'rgba(14,9,20,0.80)', x0-2, Y-2, w+4, 8);
    for(let k=0;k<r.n;k++){
      const gx = x0 + k*5;
      // a small lozenge: two units wide at the waist, one at the tips
      px(c, C.aether1, gx+1, Y,   2, 4);
      px(c, C.aether3, gx+1, Y+1, 2, 2);
      px(c, C.aether2, gx,   Y+1, 4, 2);
      px(c, dying ? C.amber4 : C.aether5, gx+1, Y+1, 1, 1);
    }
  }
}

function drawReticle(c){
  const e = G.target;
  if(!e || e.dead || G.state!==ST.PLAY) return;

  const t = clamp(G.targetT||0, 0, 1);
  // frame the creature's visible body, not its hitbox radius, and sit the box
  // slightly high so it reads as "on top of" the target
  const X  = Math.round(e.x);
  const Y  = Math.round(e.y - e.r - 2);
  const hw = e.r + 7 + Math.round(5*(1-t));     // snaps inward on acquire
  const hh = e.r + 9 + Math.round(5*(1-t));
  const len = 5;
  const pulse = 0.78 + 0.22*Math.sin(G.time*7);

  // high-contrast amber over a dark backing so it reads on any terrain
  const draw = (col, ox, oy)=>{
    for(const [sx,sy] of [[-1,-1],[1,-1],[-1,1],[1,1]]){
      const bx = X + sx*hw + ox, by = Y + sy*hh + oy;
      px(c, col, sx<0 ? bx : bx-len+1, by, len, 1);   // horizontal arm
      px(c, col, bx, sy<0 ? by : by-len+1, 1, len);   // vertical arm
    }
  };
  // solid amber when your primary can reach it, dim and hollow when it can't
  const inReach = G.targetInReach;
  c.globalAlpha = inReach ? pulse : pulse*0.55;
  draw('#14100c', 1, 1);                 // drop shadow
  draw(inReach ? C.amber4 : '#8a7f98', 0, 0);
  if(inReach)
    for(const [sx,sy] of [[-1,-1],[1,-1],[-1,1],[1,1]])
      px(c, '#fff3cc', X + sx*hw, Y + sy*hh, 1, 1);

  // centre tick only once it is actually hittable
  if(inReach){
    px(c, '#14100c', X, Y-2, 1, 5);
    px(c, '#14100c', X-2, Y, 5, 1);
    px(c, C.amber5, X, Y-1, 1, 3);
    px(c, C.amber5, X-1, Y, 3, 1);
  }
  c.globalAlpha = 1;

  // name + health pip under the frame once the target is hurt
  if(e.hp < e.maxhp){
    const w = hw*2;
    px(c, 'rgba(16,10,14,0.85)', X-w/2-1, Y+hh+3, w+2, 4);
    px(c, C.hpRed,  X-w/2, Y+hh+4, Math.max(1, Math.round(w*(e.hp/e.maxhp))), 2);
    px(c, '#ff9a90', X-w/2, Y+hh+4, Math.max(1, Math.round(w*(e.hp/e.maxhp))), 1);
  }
}

function drawSummon(c, s){
  const T0=SUMMON_TYPES[s.kind];
  const X=Math.round(s.x), Y=Math.round(s.y)+Math.round(Math.sin(s.bob)*1.5);
  px(c, C.shadow, X-s.r, Y+s.r-2, s.r*2, 3);
  c.globalAlpha = 0.85;
  if(s.kind==='sprite'){
    px(c,T0.col.a, X-4, Y-6, 8, 9);
    px(c,T0.col.b, X-3, Y-5, 6, 7);
    px(c,T0.col.c, X-2, Y-5, 3, 3);
    for(let k=0;k<3;k++){ const a=G.time*6+k*2.1;
      px(c,T0.col.c, X+Math.cos(a)*7, Y-2+Math.sin(a)*5, 1,1); }
  } else if(s.kind==='hound'){
    px(c,T0.col.a, X-6, Y-4, 12, 7);
    px(c,T0.col.b, X-5, Y-3, 10, 5);
    px(c,T0.col.a, X+4, Y-7, 5, 5);
    px(c,T0.col.c, X+6, Y-6, 2, 2);
    px(c,T0.col.a, X-8, Y-6, 3, 3);
  } else {
    const w = s.kind==='mega' ? 9 : 7;
    px(c,T0.col.a, X-w, Y-13, w*2, 14);
    px(c,T0.col.b, X-w+1, Y-12, w*2-2, 12);
    px(c,T0.col.c, X-w+1, Y-12, w*2-2, 2);
    px(c,'#1a1418', X-3, Y-9, 6, 4);
    px(c,T0.col.c, X-2, Y-8, 4, 2);
    px(c,T0.col.a, X-w-3, Y-10, 4, 8);
    px(c,T0.col.a, X+w-1, Y-10, 4, 8);
  }
  c.globalAlpha=1;
  // lifetime ring
  const f = s.life / SUMMON_TYPES[s.kind].life;
  px(c,'#1a2224', X-6, Y+s.r, 12, 2);
  px(c,T0.col.c,  X-6, Y+s.r, Math.round(12*f), 2);
}
