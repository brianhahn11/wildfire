
// ============================================================================
// TEXT & PANEL HELPERS
// ============================================================================
// text() now lives in the bitmap font module so glyphs stay crisp when the
// canvas is upscaled. Everything below calls it with the same signature.
function panel(c,x,y,w,h,accent){
  c.fillStyle='rgba(16,11,20,0.94)'; c.fillRect(x,y,w,h);
  c.strokeStyle=accent||C.uiGold; c.lineWidth=1; c.strokeRect(x+.5,y+.5,w-1,h-1);
  c.strokeStyle=C.ui1; c.strokeRect(x+2.5,y+2.5,w-5,h-5);
  // corner studs
  for(const [cx,cy] of [[x+2,y+2],[x+w-4,y+2],[x+2,y+h-4],[x+w-4,y+h-4]])
    { c.fillStyle=accent||C.uiGold; c.fillRect(cx,cy,2,2); }
}
// word-wrap a paragraph to a pixel width
function wrap(s, maxChars){
  const words=s.split(' '); const lines=[]; let cur='';
  for(const w of words){
    if((cur+' '+w).trim().length > maxChars){ lines.push(cur.trim()); cur=w; }
    else cur += ' '+w;
  }
  if(cur.trim()) lines.push(cur.trim());
  return lines;
}

// ============================================================================
// TITLE — key art: the Reaver on the rim of the Pit, hatchling on his shoulder
//
// The composition is deliberately asymmetric: figure hard left, title stack
// right, and the Pit falling away between and behind them. A centred hero
// with the logo on top left nowhere for the shaft to actually descend, and
// the descent is the whole point of the image.
// ============================================================================

// Hard-edged ellipse, filled row by row. Canvas ellipse() would do this, but
// rows of fillRect give the stepped edge pixel art wants and render the same
// everywhere instead of depending on the host's arc rasteriser.
function fillEllipse(c, col, cx, cy, rx, ry){
  c.fillStyle = col;
  for(let dy=-ry; dy<=ry; dy++){
    const w = Math.floor(rx*Math.sqrt(Math.max(0, 1-(dy/ry)*(dy/ry))));
    if(w>0) c.fillRect(Math.round(cx-w), Math.round(cy+dy), w*2, 1);
  }
}

// The Pit: nested ellipses, each smaller, lower and darker than the last, so
// every one leaves a crescent of the one before it showing as a terrace lip.
// Eight of them stacked is all it takes to read as a shaft going down a long
// way — and because each lip is a ring of the city, it reads as an inhabited
// one. Baked once into an offscreen canvas; only the mist and embers move.
// Radii step in hard — an earlier pass used rx 340..59, where the top arcs are
// so flat the rings read as rolling hills instead of a shaft. Curvature is what
// says "you are looking down a hole", and curvature needs a small rx.
const PIT = [
  { cy:172, rx:212, ry:58, wall:'#241d30', lip:'#372d47', light:'#ffb43c', lit:0.95 },
  { cy:185, rx:184, ry:52, wall:'#1e1828', lip:'#2c2439', light:'#ffab3c', lit:0.78 },
  { cy:196, rx:156, ry:46, wall:'#191420', lip:'#231d2e', light:'#f09a34', lit:0.60 },
  { cy:206, rx:128, ry:40, wall:'#14101a', lip:'#1c1725', light:'#d8842c', lit:0.44 },
  { cy:215, rx:101, ry:34, wall:'#100d15', lip:'#16121d', light:'#b86c24', lit:0.30 },
  { cy:223, rx: 76, ry:28, wall:'#0c0a10', lip:'#110e16', light:'#9a561c', lit:0.18 },
  { cy:230, rx: 53, ry:22, wall:'#08070c', lip:'#0c0a11', light:'#7d4416', lit:0.10 },
  { cy:236, rx: 32, ry:17, wall:'#050409', lip:'#08070c', light:'#5e3210', lit:0.05 },
  { cy:241, rx: 15, ry:12, wall:'#030207', lip:'#050409', light:'#4a2810', lit:0.02 }
];
const PIT_CX = 250;

let titleCv = null;
function buildTitleBg(){
  const cv = document.createElement('canvas');
  cv.width = VW; cv.height = VH;
  const c = cv.getContext('2d');
  const rng = makeRng(90210);

  // --- sky, banded rather than gradient so it stays in the palette
  const sky = ['#0b0812','#0e0a15','#120d1a','#160f20','#1a1325','#1f172b','#241b31'];
  for(let i=0;i<sky.length;i++){ c.fillStyle=sky[i]; c.fillRect(0, i*17, VW, 18); }
  for(let i=0;i<80;i++){                                   // stars
    const x=(rng()*VW)|0, y=(rng()*104)|0;
    c.fillStyle = rng()<0.3 ? 'rgba(220,210,255,0.5)' : 'rgba(180,170,210,0.26)';
    c.fillRect(x,y,1,1);
  }

  // --- the far rim: the city on the other side of the hole, hazed by distance.
  // Towers, not hills — a smooth ridgeline here made the whole thing read as
  // countryside.
  for(let x=0; x<VW; x+=4){
    const base = 118;
    const h = 10 + Math.sin(x*0.071)*6 + Math.sin(x*0.023+1.3)*5 + (((x*13)%7<2)?9:0);
    c.fillStyle='#2b2237'; c.fillRect(x, base-h, 4, h+6);
    c.fillStyle='#352a44'; c.fillRect(x, base-h, 4, 1);
    if((x*7)%12 < 3){ c.fillStyle='rgba(255,180,90,0.40)'; c.fillRect(x+1, base-h+3, 1, 1); }
    if((x*5)%17 < 2){ c.fillStyle='rgba(255,150,70,0.28)'; c.fillRect(x+2, base-h+7, 1, 1); }
  }
  c.fillStyle='rgba(120,90,150,0.17)'; c.fillRect(0, 106, VW, 16);   // atmospheric haze

  // --- the shaft
  for(let k=0;k<PIT.length;k++){
    const p = PIT[k];
    fillEllipse(c, p.wall, PIT_CX, p.cy, p.rx, p.ry);
    // terrace lip: a bright rule along the top arc of this ring
    c.fillStyle = p.lip;
    for(let dx=-p.rx; dx<=p.rx; dx++){
      const y = p.cy - Math.floor(p.ry*Math.sqrt(Math.max(0,1-(dx/p.rx)*(dx/p.rx))));
      c.fillRect(PIT_CX+dx, y, 1, 2);
    }
    // buildings crowding the lip, smaller and dimmer the deeper they sit
    const n = 34 - k*3;
    for(let i=0;i<n;i++){
      const t  = -0.96 + (i/(n-1))*1.92;
      const dx = t*p.rx;
      const y  = p.cy - Math.floor(p.ry*Math.sqrt(Math.max(0,1-t*t)));
      const w  = 2 + ((rng()*3)|0), h = Math.max(2, Math.round((7-k*0.7)*(0.6+rng()*0.8)));
      c.fillStyle = p.lip;  c.fillRect(Math.round(PIT_CX+dx), y-h, w, h+1);
      c.fillStyle = p.wall; c.fillRect(Math.round(PIT_CX+dx+w-1), y-h, 1, h+1);
      if(rng() < p.lit){                                   // a lit window
        c.fillStyle = p.light;
        c.fillRect(Math.round(PIT_CX+dx), y-h+1+((rng()*Math.max(1,h-2))|0), 1, 1);
      }
    }
  }

  // --- something still burning at the bottom, too far down to make out
  for(let r=7;r>0;r--)
    fillEllipse(c, 'rgba(255,150,60,'+(0.03+0.02*(7-r))+')', PIT_CX, 242, r*4, r*1.7);
  fillEllipse(c, 'rgba(255,200,110,0.30)', PIT_CX, 242, 9, 4);

  // --- chain bridges spanning the upper rings, catching the light
  const spans = [[52,150,436,164],[120,186,392,178],[168,208,340,204]];
  for(const [x0,y0,x1,y1] of spans){
    for(let x=x0; x<=x1; x++){
      const t=(x-x0)/(x1-x0);
      const y=y0+(y1-y0)*t + Math.sin(t*Math.PI)*13;
      c.fillStyle='#0a0810'; c.fillRect(x, Math.round(y), 1, 2);
      if(x%11===0){ c.fillStyle='rgba(255,170,70,0.25)'; c.fillRect(x, Math.round(y)-1, 1, 1); }
    }
  }

  // --- the near rim, the ledge we're standing on. Dark, unlit, and it has to
  // stay unlit: it's the frame the whole image reads against.
  const rimY = x => 250 + Math.round(Math.sin(x*0.07)*2 + Math.sin(x*0.021)*3);
  for(let x=0; x<VW; x++){
    c.fillStyle='#08060e'; c.fillRect(x, rimY(x), 1, VH);
    c.fillStyle='#17131f'; c.fillRect(x, rimY(x), 1, 2);
  }
  // the promontory the figure stands on, jutting out over the drop
  for(let x=0; x<150; x++){
    const y = 246 + Math.round(Math.sin(x*0.05)*2) + (x>112 ? (x-112)*0.7 : 0);
    c.fillStyle='#08060e'; c.fillRect(x, Math.round(y), 1, VH);
    c.fillStyle='#191424'; c.fillRect(x, Math.round(y), 1, 2);
  }
  for(let i=0;i<150;i++){                                  // grit
    const x=(rng()*VW)|0, y=248+((rng()*22)|0);
    c.fillStyle = rng()<0.5 ? '#120f1b' : '#060410';
    c.fillRect(x,y,1+((rng()*2)|0),1);
  }
  return cv;
}

// The hatchling: the only warm light source in the frame, which is why it sits
// on the shoulder facing the drop — it rim-lights the figure from the side the
// pit doesn't.
//
// Read order matters more than accuracy at thirty pixels. Two shapes carry it:
// a folded wing arcing above the back, and a long snouted head on a curved
// neck. Earlier passes had a short neck and small wings, and it came out as a
// squirrel; generating the wing from a sin sweep produced a shapeless blob, so
// the wing is a hand-authored column table instead.
const WING = [[-15,-12,11],[-13,-17,15],[-11,-21,18],[-9,-23,20],
              [-7,-23,20],[-5,-21,18],[-3,-17,14]];
function drawTitleDragon(c, x, y, t){
  const D = { d:'#5c4610', a:'#8a6a12', b:'#e8c422', c:'#fff58a', belly:'#fffbd0' };
  const flap = Math.round(Math.sin(t*2.6)*2), bob = Math.round(Math.sin(t*2.2));
  y += bob;
  for(let r=22;r>2;r-=2)
    { c.fillStyle='rgba(232,196,34,'+(0.026*(1-r/22)+0.008)+')';
      c.fillRect(x-r, y-r+2, r*2, r*2); }

  // far wing first, then the body over it, then the near wing — the overlap is
  // what gives a flat sprite any depth
  for(const [dx,dy,h] of WING){
    c.fillStyle='#3d2e0a'; c.fillRect(x+dx+4, y+dy+flap+3, 2, h);
  }
  // tail, hooked back and down over the shoulder
  for(let i=0;i<11;i++){
    const a=2.4+i*0.12+Math.sin(t*2+i*0.4)*0.05, d=8+i*2.0;
    c.fillStyle = i>7?D.b:D.a;
    c.fillRect(Math.round(x+Math.cos(a)*d), Math.round(y+Math.sin(a)*d*0.8), i>7?2:3, 2);
  }
  // near wing
  for(const [dx,dy,h] of WING){
    c.fillStyle=D.d; c.fillRect(x+dx, y+dy+flap, 2, h);
    c.fillStyle=D.a; c.fillRect(x+dx, y+dy+flap, 2, 3);        // lit leading edge
  }

  c.fillStyle=D.d;     c.fillRect(x-9, y-7, 18, 14);           // body
  c.fillStyle=D.a;     c.fillRect(x-8, y-6, 16, 12);
  c.fillStyle=D.b;     c.fillRect(x-7, y-5, 14,  9);
  c.fillStyle=D.c;     c.fillRect(x-7, y-5, 11,  2);
  c.fillStyle=D.belly; c.fillRect(x-5, y+2, 10,  4);

  c.fillStyle=D.d;     c.fillRect(x+3, y-13, 8, 10);           // neck, curving up
  c.fillStyle=D.a;     c.fillRect(x+4, y-12, 6,  9);
  c.fillStyle=D.b;     c.fillRect(x+5, y-11, 4,  7);

  c.fillStyle=D.d;     c.fillRect(x+7,  y-19, 15, 9);          // head
  c.fillStyle=D.a;     c.fillRect(x+8,  y-18, 13, 7);
  c.fillStyle=D.b;     c.fillRect(x+8,  y-18, 11, 5);
  c.fillStyle=D.c;     c.fillRect(x+8,  y-18,  8, 2);
  c.fillStyle=D.a;     c.fillRect(x+20, y-16,  6, 4);          // snout
  c.fillStyle=D.d;     c.fillRect(x+20, y-13,  6, 1);          // jaw line
  c.fillStyle=D.belly; c.fillRect(x+24, y-16,  2, 1);
  c.fillStyle='#2a1a06'; c.fillRect(x+13, y-17, 2, 2);         // eye
  c.fillStyle=D.c;       c.fillRect(x+15, y-17, 1, 1);
  c.fillStyle=D.d;     c.fillRect(x+10, y-24, 2, 6);           // horns, swept back
  c.fillStyle=D.d;     c.fillRect(x+9,  y-25, 2, 2);
  c.fillStyle=D.d;     c.fillRect(x+15, y-23, 2, 5);
  c.fillStyle=D.d;     c.fillRect(x-4, y+6, 4, 3);             // claws on the mantle
  c.fillStyle=D.d;     c.fillRect(x+3, y+6, 4, 3);
  c.fillStyle=D.b;     c.fillRect(x-4, y+6, 4, 1);
  c.fillStyle=D.b;     c.fillRect(x+3, y+6, 4, 1);
  for(let k=0;k<4;k++){                                        // lightning
    const a=t*3.4+k*1.7;
    if(Math.sin(a*2.7)>0.5){
      c.fillStyle='#fff58a';
      c.fillRect(Math.round(x+Math.cos(a)*18), Math.round(y+Math.sin(a)*15), 1, 3);
    }
  }
}

// The Reaver at roughly five times sprite scale, seen from behind. Back view
// because the cloak is the design and from behind it's the entire silhouette,
// and because a figure facing away sells "overlooking" without needing a face.
//
// Built from a contour rather than stacked rectangles. Three earlier passes
// assembled him out of a head box on a collar box on a mantle box, and the
// result had no anatomy: no neck, no shoulder slope, no waist, so it read as a
// monolith however it was lit. The contour gives the silhouette a shape first,
// and the rim light then follows that shape instead of running down the side
// as a straight bar — which is what turned the last attempt into a gold pole.
const HERO_CONTOUR = [
  // y0,  y1,  half-width at y0, at y1
  [122, 128,  7, 10],   // crown
  [128, 148, 11, 11],   // head
  [148, 154, 11,  8],   // jaw
  [154, 161,  8,  9],   // neck — the notch that makes the head read as a head
  [161, 168, 13, 25],   // shoulder slope
  [168, 192, 25, 26],   // mantle
  [192, 208, 25, 22],   // waist, pulled in
  [208, 214, 22, 24]    // start of the flare
];
function heroHalfWidth(y){
  for(const [y0,y1,a,b] of HERO_CONTOUR)
    if(y>=y0 && y<y1) return a + (b-a)*((y-y0)/(y1-y0));
  return null;
}

function drawTitleHero(c, HX, HY, t){
  const BODY='#0e0c16', DEEP='#07060c', RED='#5a1310', REDL='#9c2418';
  const pulse = 0.82 + Math.sin(t*2.6)*0.14;
  const warm = a => 'rgba(255,186,96,'+Math.min(1,a*pulse)+')';
  const cool = a => 'rgba(132,114,168,'+a+')';
  const SPLIT = 214, TOP = 122;

  // ---- solid mass + contour-following rim -----------------------------------
  for(let y=TOP; y<SPLIT; y++){
    const hw = heroHalfWidth(y); if(hw===null) continue;
    const w = Math.round(hw);
    c.fillStyle=DEEP; c.fillRect(HX-w-1, y, w*2+2, 1);
    c.fillStyle=BODY; c.fillRect(HX-w,   y, w*2,   1);
    // Warm rim on the right (hatchling + pit), cold sliver on the left (sky).
    // Thinned or dropped where the contour runs diagonally: a fixed-width rim
    // on a steep slope smears into a wide band, which is what turned the
    // shoulder into a tan sash on the previous pass.
    const prev = heroHalfWidth(y-1);
    const slope = prev===null ? 0 : Math.abs(hw-prev);
    const rw = slope>1.4 ? 0 : slope>0.6 ? 1 : 2;
    if(rw){
      const lit = y<161 ? 0.34 : y<192 ? 0.60 : 0.44;
      c.fillStyle=warm(lit);      c.fillRect(HX+w-rw, y, rw, 1);
      c.fillStyle=cool(lit*0.45); c.fillRect(HX-w,    y, rw, 1);
    }
  }
  // shoulder top catches the light square-on
  c.fillStyle=warm(0.46); c.fillRect(HX+8, 163, 17, 2);
  c.fillStyle=warm(0.34); c.fillRect(HX+3, 122, 7, 2);         // crown

  // ---- the detail that survives at this value range ---------------------------
  c.fillStyle=RED;  c.fillRect(HX-26, 190, 52, 3);             // mantle seam
  c.fillStyle=REDL; c.fillRect(HX-26, 190, 52, 1);
  c.fillStyle=RED;  c.fillRect(HX-24, 204, 48, 5);             // belt
  c.fillStyle=REDL; c.fillRect(HX-24, 204, 48, 1);
  c.fillStyle='#6b5220'; c.fillRect(HX-4, 203, 9, 7);          // buckle
  c.fillStyle='#a8801f'; c.fillRect(HX-4, 203, 9, 2);
  c.fillStyle=REDL; c.fillRect(HX-10, 154, 20, 1);             // collar edge
  for(let i=0;i<7;i++)                                          // hair strands
    { c.fillStyle=DEEP; c.fillRect(HX-9+i*3, 126+((i*5)%7), 1, 18); }

  // ---- legs and boots, seen through the fringe --------------------------------
  c.fillStyle=DEEP; c.fillRect(HX-15, 214, 12, 40); c.fillRect(HX+3, 214, 12, 40);
  c.fillStyle=BODY; c.fillRect(HX-14, 214, 10, 34); c.fillRect(HX+4, 214, 10, 34);
  c.fillStyle='#1a1410'; c.fillRect(HX-16, 244, 14, 10); c.fillRect(HX+2, 244, 14, 10);
  c.fillStyle=warm(0.20); c.fillRect(HX+13, 244, 3, 10);

  // ---- gunblades ---------------------------------------------------------------
  for(const s of [-1,1]){
    const gx=HX+s*27, gy=204, ang=Math.PI/2 - s*0.46;
    const ca=Math.cos(ang), sa=Math.sin(ang), nx=-sa*s, ny=ca*s;
    for(let d=8; d<36; d++){                                   // blade
      const x=gx+ca*d, y=gy+sa*d;
      c.fillStyle=DEEP;      c.fillRect(Math.round(x-nx*2), Math.round(y-ny*2), 3, 3);
      c.fillStyle = d>32?'#f4f6fb':'#9aa0b4';
      c.fillRect(Math.round(x), Math.round(y), 2, 2);
      c.fillStyle='#3c4052'; c.fillRect(Math.round(x+nx*2), Math.round(y+ny*2), 2, 2);
    }
    for(let d=6; d<21; d++){                                   // barrel, short of the tip
      c.fillStyle='#2e2d3a';
      c.fillRect(Math.round(gx+ca*d+nx*4), Math.round(gy+sa*d+ny*4), 2, 2);
    }
    c.fillStyle=DEEP; c.fillRect(Math.round(gx+ca*21+nx*4)-1, Math.round(gy+sa*21+ny*4)-1, 4, 4);
    c.fillStyle=DEEP;      c.fillRect(gx-8, gy-8, 17, 17);     // receiver
    c.fillStyle='#1d1c26'; c.fillRect(gx-6, gy-6, 13, 13);
    c.fillStyle='#3a3948'; c.fillRect(gx-6, gy-6, 13, 2);
    c.fillStyle='#6b5220'; c.fillRect(gx-4, gy-2, 8, 8);       // cylinder
    c.fillStyle='#a8801f'; c.fillRect(gx-4, gy-2, 3, 3);
    c.fillStyle=REDL;      c.fillRect(gx+1, gy+3, 2, 2);
    c.fillStyle=DEEP;      c.fillRect(gx-6, gy+9, 12, 5);      // trigger guard
    c.fillStyle='#1d1c26'; c.fillRect(gx-4, gy+9, 7, 2);
  }

  // ---- THE CLOAK FRINGE ---------------------------------------------------------
  // Solid above the waist (the contour above), splitting into strips only below
  // it. Split the whole way down and the gaps show background between every
  // strip, which turns the figure into a set of red stilts.
  //
  // The strips lean left as they fall: the updraft out of the shaft catches the
  // cloak, and the diagonal is what keeps the lower half from reading as a row
  // of vertical bars.
  const strips=[];
  for(let i=0;i<11;i++){
    const sx = -30 + i*6;                  // 5px strips on a 6px pitch
    const ph = t*1.5 + i*0.7;
    strips.push({
      x:    HX + sx + Math.sin(ph)*2.0,
      lean: -4 - Math.sin(ph*0.7)*2,
      len:  30 + (i%3)*7 + Math.sin(ph*0.8)*5 - Math.abs(sx)*0.18,
      red:  (i%3)===1                      // every third, not every other — at
    });                                    // 1-in-2 it came out a red curtain
  }
  for(let pass=0; pass<2; pass++)
    for(const s of strips){
      const h = Math.round(s.len);
      for(let d=0; d<h; d++){
        const x = Math.round(s.x + s.lean*(d/h)*(d/h));
        if(pass===0){ c.fillStyle=DEEP; c.fillRect(x-1, SPLIT+d, 7, 1); continue; }
        c.fillStyle = d>h-4 ? (s.red?REDL:'#2a2836') : (s.red?RED:BODY);
        c.fillRect(x, SPLIT+d, 5, 1);
        c.fillStyle = s.red?'#400d0b':'#08070d'; c.fillRect(x+3, SPLIT+d, 2, 1);
        if(d>h-3){ c.fillStyle=warm(0.34); c.fillRect(x, SPLIT+d, 5, 1); }
      }
    }
}

function drawTitle(c){
  if(!titleCv) titleCv = buildTitleBg();
  c.drawImage(titleCv, 0, 0);
  const t = G.time;

  // --- mist, drifting across the rings at different speeds. Three bands is
  // enough to imply the shaft is full of it without hiding the terraces.
  for(let i=0;i<4;i++){
    const p = PIT[1+i*2], off = (t*(6+i*3.5))%VW;
    for(let k=0;k<2;k++){
      const x = -VW + off + k*VW;
      c.fillStyle='rgba(158,138,190,'+(0.085-i*0.014)+')';
      c.fillRect(Math.round(x), p.cy-p.ry+3, VW, 9);
      c.fillStyle='rgba(124,104,156,'+(0.070-i*0.012)+')';
      c.fillRect(Math.round(x)+40, p.cy-p.ry+11, VW, 5);
    }
  }
  // standing haze in the bottom third: the deeper rings should be losing
  // definition, or the shaft reads as shallow
  for(let i=0;i<5;i++){
    const p = PIT[4+i];
    c.fillStyle='rgba(110,92,140,0.05)';
    c.fillRect(PIT_CX-p.rx, p.cy-p.ry, p.rx*2, p.ry+8);
  }

  // --- embers rising out of the pit
  for(let i=0;i<54;i++){
    const life=(t*0.17 + i*0.1851)%1;
    const spread=(i*97.3)%300 - 150;
    const x = PIT_CX + spread*(0.45+life*0.85) + Math.sin(t*1.2+i)*7;
    const y = 250 - life*185;
    if(y<96) continue;
    c.fillStyle = i%3 ? 'rgba(255,150,60,'+(0.5*(1-life))+')'
                      : 'rgba(255,214,120,'+(0.42*(1-life))+')';
    c.fillRect(Math.round(x), Math.round(y), 1, 2);
  }

  // A pool of warm light on the rim behind him. Without it he is a black shape
  // on a black ledge in front of a black shaft: the rim light alone cannot
  // carry a figure this size. Drawn as stacked ellipses rather than a radial
  // gradient to stay consistent with the rest of the art.
  for(let r=9;r>0;r--)
    fillEllipse(c, 'rgba(255,150,60,'+(0.020+0.010*(9-r))+')', 104, 246, r*10, r*4.4);
  for(let r=6;r>0;r--)
    fillEllipse(c, 'rgba(255,196,110,'+(0.016+0.009*(6-r))+')', 112, 240, r*7, r*6.2);

  drawTitleHero(c, 96, 250, t);
  drawTitleDragon(c, 124, 156, t);

  // --- scrims. Per-row alpha, not one repeated rectangle: a flat rect over
  // part of the frame leaves a visible vertical seam down the middle of the
  // art, which is exactly what the first attempt did.
  for(let y=0; y<66; y++){
    c.fillStyle='rgba(8,6,14,'+(0.62*(1-y/66))+')'; c.fillRect(0, y, VW, 1);
  }
  // Kept light, and started low. At 0.72 reaching up to y=214 it swallowed the
  // figure's whole lower half along with the glow pooled on the ledge.
  for(let y=226; y<VH; y++){
    c.fillStyle='rgba(8,6,14,'+(0.42*((y-226)/(VH-226)))+')'; c.fillRect(0, y, VW, 1);
  }

  const LOGO='WILDFIRE', TX=240, lw=LOGO.length*FONT_ADV*5-5, lx=Math.round(TX-lw/2);
  drawGlyphs(c, LOGO, lx+4, 20, '#6b1f0c', 5);
  drawGlyphs(c, LOGO, lx+2, 18, '#d8531c', 5);
  drawGlyphs(c, LOGO, lx,   16, '#ffab3c', 5);

  text(c,'A E T H E R M E R E', TX, 62, C.aether4, 8, 'center');
  text(c,'Steam, scrap, and the last of the dragons', TX, 80, C.uiDim, 7, 'center');

  // sits over the deepest part of the shaft, which is the darkest area in the
  // frame and therefore where white type has the most contrast to work with
  if(G.titleOpts){
    // the options panel takes over the lower right of the key art
    c.fillStyle='rgba(8,10,16,0.90)'; c.fillRect(168, 104, VW-180, 140);
    c.strokeStyle=C.uiGold; c.lineWidth=1; c.strokeRect(168.5, 104.5, VW-181, 139);
    const oy = drawOptionsPanel(c, 180, 114, VW-204, G.optSel|0);
    text(c,'W/S SELECT   A/D CHANGE', 180, oy, C.ui2, 7);
    text(c,'ESC  BACK', VW-24, oy, C.ui2, 7, 'right');
  } else {
    const items = ['1 PLAYER','2 PLAYERS','OPTIONS'];
    items.forEach((it,i)=>{
      const on = (G.titleSel|0)===i;
      const y = 180 + i*19;
      if(on){
        c.fillStyle='rgba(217,180,90,0.14)'; c.fillRect(212, y-4, 152, 16);
        c.strokeStyle=C.uiGold; c.lineWidth=1; c.strokeRect(212.5, y-3.5, 151, 15);
        if(Math.sin(t*5)>-0.4) text(c,'▸', 220, y, C.amber4, 10);
      }
      text(c, it, 292, y, on?C.uiText:C.uiDim, 10, 'center');
    });
  }

  // ---- the control hints, on the bottom edge and nowhere near the menu.
  // Both lines used to sit just under OPTIONS, where the first of them was
  // close enough to read as a fourth menu item and the second collided with
  // the build tag. They are reference, not choices, so they belong at the
  // foot of the screen with the rest of the small print.
  if(!G.titleOpts){
    text(c,'W/S  SELECT   ·   ENTER  CONFIRM', 240, VH-22, C.ui2, 7, 'center');
    text(c,'WASD MOVE · SPACE DODGE · ARROWS ABILITIES · R BURN AETHITE',
         240, VH-12, C.ui1, 7, 'center');
  }
  text(c, BUILD_TAG, VW-6, 6, C.ui1, 7, 'right');
}

// ============================================================================
// CHARACTER SELECT
// ============================================================================
function drawClassSelect(c){
  c.fillStyle='#16101c'; c.fillRect(0,0,VW,VH);
  for(let i=0;i<40;i++){
    const t=(G.time*0.12 + i*0.21)%1;
    c.fillStyle='rgba(180,140,255,'+(0.13*(1-t))+')';
    c.fillRect((i*97)%VW, VH-t*VH, 1, 2);
  }
  const who = P_COL[G.pickWho|0] || P_COL[0];
  text(c,'CHOOSE YOUR FORGEBOUND', VW/2, 8, C.uiGold, 10, 'center');
  if((G.nPlayers|0) > 1){
    // Whose turn it is has to be unmissable, because both players are looking
    // at the same screen and only one of them is driving.
    const tag = who.id+'  CHOOSING';
    const w = textWidth(tag,8)+14;
    c.fillStyle=who.dark; c.fillRect(VW/2-w/2, 20, w, 13);
    c.strokeStyle=who.main; c.lineWidth=1; c.strokeRect(VW/2-w/2+.5, 20.5, w-1, 12);
    text(c, tag, VW/2, 23, who.lite, 8, 'center');
    // and what the other one already took
    if(G.picks[0] && (G.pickWho|0)===1)
      text(c, P_COL[0].id+' took '+CLASSES[G.picks[0].cls].name, VW/2, 37, P_COL[0].lite, 7, 'center');
    // P2's keys, spelled out on the screen where P2 is sitting. Without this
    // they are undiscoverable: nothing else in the running game mentions them.
    if((G.pickWho|0)===1)
      text(c,'2P PLAYS ON:  IJKL MOVE  \u00b7  7890 ABILITIES  \u00b7  U/O DRAGON  \u00b7  N DODGE  \u00b7  Y BURN  \u00b7  H TALK',
           VW/2, VH-10, P_COL[1].lite, 7, 'center');
  } else {
    text(c,'Nine disciplines. Each fights in a way nothing else can.', VW/2, 22, C.uiDim, 7, 'center');
  }

  // --- 3x3 grid of portraits. Cells are sized to the longest class name
  // ("AETHERMANCER", 12 chars) so nothing spills into its neighbour.
  const gx=8, gy=34, cw=52, ch=54;
  for(let i=0;i<9;i++){
    const col=i%3, row=(i/3)|0;
    const x=gx+col*(cw+2), y=gy+row*(ch+3);
    const sel = i===G.selClass;
    const taken = (G.nPlayers|0)>1 && G.picks[0] && (G.pickWho|0)===1 && G.picks[0].cls===i;
    c.fillStyle = sel ? '#33263f' : taken ? '#2a1a20' : '#1e1726';
    c.fillRect(x,y,cw,ch);
    c.strokeStyle = sel ? who.main : taken ? P_COL[0].main : C.ui1; c.lineWidth=1;
    c.strokeRect(x+.5,y+.5,cw-1,ch-1);
    if(taken){ c.fillStyle=P_COL[0].main; c.fillRect(x+cw-11, y+2, 9, 7);
               text(c, P_COL[0].id, x+cw-10, y+2, '#12101a', 7); }
    // portrait sits above the nameplate
    const K=CLASSES[i];
    const savedCls=cls, savedMode=player.mode, savedFocus=player.focus;
    cls=K; player.mode=0; player.focus=0;
    c.save();
    c.beginPath(); c.rect(x+1,y+1,cw-2,ch-19); c.clip();
    c.translate(x+cw/2, y+ch-21);
    drawClassSprite(c, 0, 0, 0, 0, false, K, {});
    c.restore();
    cls=savedCls; player.mode=savedMode; player.focus=savedFocus;
    // nameplate along the bottom; long names wrap to two lines so nothing
    // spills into the neighbouring cell
    const lines = K.grid || [K.name.toUpperCase()];
    c.fillStyle = sel ? 'rgba(217,180,90,0.16)' : 'rgba(0,0,0,0.35)';
    c.fillRect(x+1, y+ch-18, cw-2, 17);
    lines.forEach((ln,li)=>
      text(c, ln, x+cw/2, y+ch-17+li*9, sel?C.uiText:C.uiDim, 7, 'center'));
    if(sel){
      const fl=Math.round(Math.sin(G.time*6));
      text(c,'▸', x+2, y+3+fl, C.uiGold, 7);
    }
  }

  // --- detail panel
  const K=CLASSES[G.selClass];
  const px0=170, py0=38, pw=VW-px0-12, ph=182;
  panel(c, px0, py0, pw, ph);
  text(c, K.name.toUpperCase(), px0+10, py0+8, C.uiGold, 10);
  text(c, K.role, px0+10, py0+22, C.aether4, 7);
  const q = wrap('"'+K.quote+'"', 44);
  q.forEach((l,i)=> text(c, l, px0+10, py0+34+i*9, C.uiDim, 7));

  let yy = py0+34+q.length*9+6;
  text(c,'WEAPON', px0+10, yy, C.ui2, 7); text(c, K.weapon, px0+62, yy, C.uiText, 7);
  yy+=10;
  text(c,'MECHANIC', px0+10, yy, C.ui2, 7); text(c, K.mech, px0+62, yy, C.amber4, 7);
  yy+=10;
  wrap(K.mechDesc, 44).forEach((l,i)=> text(c, l, px0+10, yy+i*9, C.uiText, 7));
  yy += wrap(K.mechDesc,44).length*9 + 6;

  // stat bars
  const stats=[['HP',K.hp/180],['SPEED',(K.spd-50)/25],['POWER',K.atk/1.2],['REACH',K.reach/110]];
  stats.forEach((s,i)=>{
    const sx=px0+10+ (i%2)*100, sy=yy+((i/2)|0)*11;
    text(c,s[0],sx,sy,C.ui2,7);
    c.fillStyle='#241c30'; c.fillRect(sx+44,sy+1,44,5);
    c.fillStyle=C.uiGold; c.fillRect(sx+44,sy+1,Math.round(44*clamp(s[1],0.05,1)),5);
    c.fillStyle='#f0d890'; c.fillRect(sx+44,sy+1,Math.round(44*clamp(s[1],0.05,1)),1);
  });
  yy += 24;

  text(c,'ABILITIES', px0+10, yy, C.ui2, 7);
  const arrows=['↑','←','↓','→'];
  K.abilities.forEach((a,i)=>{
    text(c, arrows[i], px0+10, yy+11+i*10, C.amber4, 7);
    text(c, a.name, px0+22, yy+11+i*10, C.uiText, 7);
  });

  text(c,'W/S · A/D  SELECT      ENTER  CONFIRM', VW/2, VH-16, C.uiDim, 7, 'center');
}

// ============================================================================
// DRAGON SELECT
// ============================================================================
function drawDragonSelect(c){
  c.fillStyle='#16101c'; c.fillRect(0,0,VW,VH);
  text(c,'BOND WITH A HATCHLING', VW/2, 10, C.uiGold, 10, 'center');
  text(c,'They found their way up out of the mines. One of them chose you.',
       VW/2, 24, C.uiDim, 7, 'center');

  const bw=72, bh=76, gx=(VW-bw*6-20)/2;
  for(let i=0;i<6;i++){
    const D=DRAGONS[i];
    const x=gx+i*(bw+4), y=46;
    const sel=i===G.selDragon;
    c.fillStyle = sel?'#2f2340':'#1e1726';
    c.fillRect(x,y,bw,bh);
    c.strokeStyle = sel?C.uiGold:C.ui1; c.lineWidth=1;
    c.strokeRect(x+.5,y+.5,bw-1,bh-1);

    // draw each hatchling at 2x by swapping the active palette
    const saved=drg, sx0=dragon.x, sy0=dragon.y, sdx=player.dx;
    drg=D; player.dx=1;
    c.save(); c.translate(x+bw/2, y+46); c.scale(2,2);
    dragon.x=0; dragon.y=0;
    drawDragon(c);
    c.restore();
    drg=saved; dragon.x=sx0; dragon.y=sy0; player.dx=sdx;

    text(c, D.name.toUpperCase(), x+bw/2, y+54, sel?C.uiText:C.uiDim, 7, 'center');
    text(c, D.el.toUpperCase(),   x+bw/2, y+64, D.c, 7, 'center');
  }

  const D=DRAGONS[G.selDragon];
  panel(c, 30, 134, VW-60, 82);
  text(c, D.name.toUpperCase()+'  —  '+D.el.toUpperCase(), 42, 142, C.uiGold, 8);
  text(c,'STAT LEAN', 42, 156, C.ui2, 7);
  text(c, D.lean, 100, 156, C.uiText, 7);
  text(c,'Q', 42, 172, C.amber4, 7);
  text(c, D.ab1.name, 54, 172, C.uiText, 7);
  text(c, D.ab1.desc, 42, 182, C.uiDim, 7);
  text(c,'E', 42, 194, C.amber4, 7);
  text(c, D.ab2.name, 54, 194, C.uiText, 7);
  text(c, D.ab2.desc, 42, 204, C.uiDim, 7);

  text(c,'A/D SELECT      ENTER CONFIRM      BACKSPACE BACK', VW/2, VH-16, C.uiDim, 7, 'center');
}

// ============================================================================
// STORY SPLASH
// ============================================================================
const STORY_PAGES = [
  "Centuries ago the Great Dragons ruled Aethermere, and their breath forged the " +
  "shape of the land itself. Then came the Dimming. They did not die so much as " +
  "stop — all at once, everywhere, without a word left behind.",

  "What they left was Aethite: dragon-essence crystallised in the rock, and the " +
  "richest fuel anyone has ever burned. Ironhaven rose around the largest seam " +
  "ever found, a city of brass and pressure and permanent smoke, built in rings " +
  "descending into the crater it eats from.",

  "But the deeper the shafts go, the more the old magic stirs. Creatures come up " +
  "wrong. Rifts open where no rift should. And in the last year, small confused " +
  "dragon hatchlings have begun climbing out of the dark, looking for someone to " +
  "bond with.",

  "You are Forgebound — licensed by the Guild, bonded to a hatchling, and sent " +
  "out to the settlements that feed the mines. Your first posting is Millbrook: " +
  "a clearing, a handful of cottages, and the long road east to the gate.\n\n" +
  "It is early. Someone downstairs is already awake."
];

function drawStory(c){
  c.fillStyle='#0f0b13'; c.fillRect(0,0,VW,VH);
  // slow ember drift to keep the page alive
  for(let i=0;i<30;i++){
    const t=(G.time*0.10 + i*0.31)%1;
    c.fillStyle='rgba(255,160,70,'+(0.14*(1-t))+')';
    c.fillRect((i*113)%VW, VH-t*VH, 1, 2);
  }
  panel(c, 26, 30, VW-52, VH-84);
  text(c,'AETHERMERE', VW/2, 40, C.uiGold, 10, 'center');
  const bar = Math.round((VW-120)/1);
  c.fillStyle=C.ui1; c.fillRect(60, 54, VW-120, 1);

  const page = STORY_PAGES[G.storyPage] || '';
  const paras = page.split('\n\n');
  let yy = 66;
  const shown = Math.floor(G.storyT*52);     // typewriter
  let budget = shown;
  for(const p of paras){
    const lines = wrap(p, 62);
    for(const l of lines){
      if(budget<=0) break;
      const s = l.length<=budget ? l : l.slice(0,budget);
      budget -= l.length;
      text(c, s, 44, yy, C.uiText, 7);
      yy += 11;
    }
    yy += 6;
  }

  // page pips
  for(let i=0;i<STORY_PAGES.length;i++){
    c.fillStyle = i===G.storyPage ? C.uiGold : C.ui1;
    c.fillRect(VW/2-16+i*9, VH-46, 6, 3);
  }
  if(budget>0 && Math.sin(G.time*4)>-0.3)
    text(c, G.storyPage<STORY_PAGES.length-1 ? 'ENTER ▸' : 'ENTER  —  BEGIN',
         VW/2, VH-34, C.uiText, 8, 'center');
  else if(budget<=0)
    text(c,'ENTER TO SKIP', VW/2, VH-34, C.uiDim, 7, 'center');
}

// ============================================================================
// DIALOGUE
// ============================================================================
function startDialogue(name, lines, onEnd){
  G.dialogue = { name, lines, onEnd };
  G.dialogueLine = 0; G.dialogueChar = 0;
  G.state = ST.DIALOGUE;
  Sfx.talk();
}
function advanceDialogue(){
  const d=G.dialogue; if(!d) return;
  const full = d.lines[G.dialogueLine];
  if(G.dialogueChar < full.length){ G.dialogueChar = full.length; return; }
  G.dialogueLine++;
  G.dialogueChar=0;
  if(G.dialogueLine >= d.lines.length){
    const cb=d.onEnd; G.dialogue=null; G.state=ST.PLAY;
    if(cb) cb();
  } else Sfx.talk();
}
function updateDialogue(dt){
  const d=G.dialogue; if(!d) return;
  const full=d.lines[G.dialogueLine];
  if(G.dialogueChar < full.length){
    const before=G.dialogueChar;
    G.dialogueChar = Math.min(full.length, G.dialogueChar + dt*46);
    if(Math.floor(G.dialogueChar)>Math.floor(before) && Math.random()<0.35) Sfx.talk();
  }
}
function drawDialogue(c){
  const d=G.dialogue; if(!d) return;
  const bh=62, by=VH-bh-6;
  panel(c, 10, by, VW-20, bh);
  // name plate
  c.fillStyle='rgba(16,11,20,0.96)';
  const npw = textWidth(d.name, 8) + 12;
  c.fillRect(18, by-12, npw, 14);
  c.strokeStyle=C.uiGold; c.lineWidth=1; c.strokeRect(18.5, by-11.5, npw-1, 13);
  text(c, d.name, 24, by-8, C.uiGold, 8);

  const full=d.lines[G.dialogueLine];
  const shown=full.slice(0, Math.floor(G.dialogueChar));
  wrap(shown, 66).forEach((l,i)=> text(c, l, 22, by+12+i*11, C.uiText, 7));

  if(G.dialogueChar>=full.length && Math.sin(G.time*6)>-0.2)
    text(c,'▾', VW-28, by+bh-16, C.uiGold, 8);
  text(c,'F / ENTER', VW-70, by+bh-12, C.ui2, 7);
}

// ============================================================================
// HAYLA'S SCRIPT
// ============================================================================
function talkToHayla(){
  const q=G.quest;
  if(q.state==='none'){
    startDialogue('Hayla', [
      "Oh — you're up. I was starting to think you'd sleep through your own posting.",
      "Listen, I'll not dress it up. The pot's half empty and the Gate Warden's coming down the road at sundown expecting to be fed.",
      "There's a flock of rustquail out past the fence, down in the low field. Plump ones, this time of year. Brass in the wing and good meat everywhere else.",
      "Bring me ten and I'll put together something worth sitting down for. Your dragon can help. That's what it's for, isn't it?"
    ], ()=>{
      G.quest.state='active'; G.quest.kills=0;
      toast('QUEST: HUNT 10 RUSTQUAIL');
      Sfx.quest();
    });
  } else if(q.state==='active'){
    const left=q.need-q.kills;
    startDialogue('Hayla', [
      left>=q.need ? "Low field, past the fence. You can't miss them — they're the round ones that don't run fast enough."
        : "You're at "+q.kills+" of "+q.need+". "+(left<=3?"Nearly there.":"Keep at it."),
      "And mind the drones out east. They don't bother anyone, but they'll put a dent in you if you walk into one."
    ]);
  } else if(q.state==='done'){
    startDialogue('Hayla', [
      "Ten on the nose. Look at them.",
      "That'll feed the whole table and there'll be some left for you when you come back through.",
      "Here — take this. It was my mother's. Kept her warm on the road to Ironhaven and back twice over.",
      "Go on. The Warden's waiting at the gate, and he's not a patient man."
    ], ()=>{
      G.quest.state='complete';
      grantMilestone('hayla');
      player.maxhp += 20; player.hp = player.maxhp;
      if(PLAYERS.length) eachPlayer(()=>{ gainBond(12); gainXp(12); });
      else { gainBond(12); gainXp(12); }
      toast("RECEIVED: HAYLA'S SHAWL  (+20 MAX HP)");
      Sfx.quest();
    });
  } else {
    startDialogue('Hayla', [
      "Smells good, doesn't it? Don't let it go cold on my account.",
      "The road east runs to the gate. Ironhaven's through there — all noise and smoke and people in a hurry.",
      "You'll like it. Or you won't. Either way, go and see."
    ]);
  }
}
function talkToGuard(n){
  startDialogue('Gate Warden', [
    G.quest.state==='complete'
      ? "Hayla fed you, did she? Then you're better off than I am."
      : "Hold there, Forgebound. Gate's sealed while the vents are cycling.",
    "Ironhaven's four rings deep and every one of them is louder than the last. The Guild Hall's on the third if you're looking for work.",
    "Come back when the slice is finished. There's a city behind me that isn't built yet."
  ]);
}

// ============================================================================
// HUD
// ============================================================================
const ARROWS = ['↑','←','↓','→'];

// ============================================================================
// HUD
//
// One panel per player. With two of them the panels have to shrink, so the
// layout is written once against a width and a colour and drawn twice —
// rather than a P1 layout with a P2 variant bolted beside it, which is how
// these things drift apart.
// ============================================================================
// One panel per player, laid out as four explicit rows that cannot collide.
// The previous version stacked the compact gauge label at the same y as the
// health figure and painted the player badge straight over the class crest,
// which produced two pieces of text on top of each other and an unreadable
// portrait — so the rows are now named and spaced rather than nudged.
// ============================================================================
// THE HUD SCALE
//
// Every HUD block is authored at full size in its own coordinate space and
// then drawn through ONE scale, so the layout inside a block never has to
// know how big the block ends up on screen. Changing HUD_S moves the whole
// HUD; nothing inside any of these functions changes.
//
// HUD_S = 0.5 was asked for, and it happens to be the best possible value:
// ART is 2, so half a world unit is exactly one device pixel. The 7px font
// and every one-pixel panel border land on whole device pixels rather than
// being resampled, which is why the HUD gets SHARPER as it gets smaller.
// ============================================================================
const HUD_S = 0.5;
function hudBlock(c, x, y, fn){
  c.save(); c.translate(x, y); c.scale(HUD_S, HUD_S);
  try { fn(); } finally { c.restore(); }
}
// on-screen size of something `n` authored units across
function hudPx(n){ return Math.round(n*HUD_S); }

function drawPlayerPanel(c, p, X, Y, W, compact){
  let PH = 0;
  hudBlock(c, X, Y, ()=>{ PH = panelBody(c, p, 0, 0, W, compact); });
  return hudPx(PH);
}
function panelBody(c, p, X, Y, W, compact){
  const col = p.col || P_COL[0];
  const pc  = p.cls || cls;
  const PH  = 46;
  const R_NAME = Y+4, R_HP = Y+14, R_GAUGE = Y+25, R_AE = Y+36;

  c.fillStyle='rgba(16,11,20,0.82)'; c.fillRect(X,Y,W,PH);
  c.strokeStyle = twoPlayer() ? col.dark : C.ui1; c.lineWidth=1;
  c.strokeRect(X+.5,Y+.5,W-1,PH-1);

  // crest, with nothing drawn over it
  c.fillStyle=pc.col.primD; c.fillRect(X+3,Y+3,22,28);
  c.fillStyle=pc.col.prim;  c.fillRect(X+4,Y+4,20,26);
  c.fillStyle=pc.col.accent;c.fillRect(X+4,Y+4,20,2);
  c.save(); c.translate(X+14, Y+30); c.scale(0.95,0.95);
  withPlayer(p, ()=>drawClassSprite(c, 0, 0, 0, 0, false, pc, {}));
  c.restore();

  const LX = X+29, RX = X+W-5;
  // badge sits at the end of the name row, not on the portrait
  let nameW = W-29-6;
  if(twoPlayer()){
    c.fillStyle=col.main; c.fillRect(RX-15, R_NAME-1, 15, 9);
    text(c, col.id, RX-13, R_NAME, '#12101a', 7);
    nameW -= 18;
  }
  // The level rides at the right-hand end of the name row. It is the one
  // number on this panel that only ever goes up, so it gets its own colour
  // and the name yields the width rather than the other way round.
  const lvl = 'LVL '+(p.level||1);
  const lvlW = textWidth(lvl,7)+4;
  text(c, lvl, RX-(twoPlayer()?18:0), R_NAME, C.amber4, 7, 'right');
  nameW -= lvlW;
  text(c, fitText(pc.name.toUpperCase(), nameW), LX, R_NAME, col.main, 7);

  // ---- health
  const BW = RX-LX;
  const hpf = Math.max(0, p.hp/p.maxhp);
  c.fillStyle=C.hpDark; c.fillRect(LX,R_HP,BW,8);
  c.fillStyle = p.down ? '#4a3038' : hpf>0.5?C.hpRed:hpf>0.25?'#e07a2a':'#ff3c3c';
  c.fillRect(LX+1,R_HP+1,Math.round((BW-2)*hpf),6);
  c.fillStyle='rgba(255,255,255,0.32)'; c.fillRect(LX+1,R_HP+1,Math.round((BW-2)*hpf),1);
  c.strokeStyle='#5a2a26'; c.strokeRect(LX-.5,R_HP-.5,BW+1,9);
  text(c, p.down ? 'DOWN '+Math.round(100*Math.min(1,p.reviveT/2.2))+'%'
                 : Math.ceil(p.hp)+'/'+p.maxhp,
       LX+3, R_HP+1, p.down?col.lite:'#ffd8cc', 7);

  // ---- class gauge: label on the left, bar filling the rest of the row
  // The Savant's "gauge" is a count of what is in their codex, which is a
  // menu fact rather than a combat one — it does not move in a fight and it
  // is on the codex page anyway. Their panel is health and Aethite, and the
  // Aethite bar moves up into the space.
  const noGauge = pc.id === 'savant';
  const gv = noGauge ? 0 : withPlayer(p, ()=>gaugeValue());
  const gt = withPlayer(p, ()=>gaugeText());
  const GL = fitText(pc.gaugeLabel, 44);
  const gx0 = LX + 46, gw = RX - gx0;
  if(noGauge){
    // nothing on this row
  } else if(text(c, GL, LX, R_GAUGE, C.ui2, 7), pc.gauge===GAUGE.PIPS){
    const n=pc.gaugeMax, pw=Math.max(3,Math.floor((gw+1)/n)-1);
    for(let i2=0;i2<n;i2++){
      const on = gv*n > i2+0.001;
      c.fillStyle = on ? (gv>=0.999?shade(pc.gaugeCol,1.3):pc.gaugeCol) : '#2e2636';
      c.fillRect(gx0+i2*(pw+1), R_GAUGE, pw, 7);
      c.strokeStyle='#4a3f54'; c.strokeRect(gx0+i2*(pw+1)+.5, R_GAUGE+.5, pw-1, 6);
    }
  } else if(pc.gauge===GAUGE.MODES){
    text(c, gt, gx0, R_GAUGE, gv?C.amber4:C.aether4, 7);
  } else {
    c.fillStyle='#2e2636'; c.fillRect(gx0,R_GAUGE+1,gw,6);
    c.fillStyle=pc.gaugeCol; c.fillRect(gx0,R_GAUGE+1,Math.round(gw*gv),6);
    c.fillStyle='rgba(255,255,255,0.32)'; c.fillRect(gx0,R_GAUGE+1,Math.round(gw*gv),1);
    if(!compact) text(c, gt, RX, R_GAUGE, C.uiDim, 7, 'right');
  }

  // ---- this player's Aethite store, in their own panel
  let albl = 'AETHITE', acol = '#2f7d76';
  if(p.burning){ albl='BURNING'; acol='#8af0e4'; }
  else if(!inTown() && !withPlayer(p, ()=>outOfCombat())){ albl='COMBAT'; acol='#a06a6a'; }
  const AER = noGauge ? R_GAUGE + 3 : R_AE;
  text(c, albl, X+4, AER, acol, 7);
  const sx2 = X+48, sw = RX-30-sx2;
  const af = p.aethiteMax>0 ? p.aethite/p.aethiteMax : 0;
  c.fillStyle='#10262a'; c.fillRect(sx2,AER-1,sw,8);
  c.fillStyle = p.burning ? '#8af0e4' : '#3fb5a8';
  c.fillRect(sx2+1,AER,Math.round((sw-2)*af),6);
  c.fillStyle='rgba(255,255,255,0.35)'; c.fillRect(sx2+1,AER,Math.round((sw-2)*af),1);
  c.strokeStyle='#235c58'; c.strokeRect(sx2-.5,AER-1.5,sw+1,9);
  text(c, Math.floor(p.aethite)+'/'+p.aethiteMax, RX, AER, '#6fd8cc', 7, 'right');
  return PH;
}

// Clip a string to a pixel width rather than a character count, so a long
// class name shortens at a sensible place instead of being cut mid-word.
function fitText(str, w){
  if(textWidth(str,7) <= w) return str;
  let out = str;
  while(out.length>3 && textWidth(out+'.',7) > w) out = out.slice(0,-1);
  return out+'.';
}

function drawAbilityStrip(c, p, AX0, AY0){
  const K = p.keys || KEYMAPS[1];
  withPlayer(p, ()=>{ hudBlock(c, AX0, AY0, ()=>{
    const X = 0, Y = 0;
    for(let i=0;i<4;i++){
      const x=X+i*30, A=p.cls.abilities[i], cd=p.cds[i];
      const empty = !A || A.name.indexOf('Empty')>=0;
      const ready = cd<=0 && !empty;
      c.fillStyle = ready?'#2b2438':'#1a1522';
      c.fillRect(x,Y,26,22);
      c.strokeStyle = ready ? p.col.main : '#3a3246';
      c.lineWidth=1; c.strokeRect(x+.5,Y+.5,25,21);
      drawAbilityGlyph(c, i, x+13, Y+9, ready, empty);
      text(c, K.ab[i].toUpperCase(), x+2, Y+13, ready?p.col.lite:'#5a5266', 7);
      if(!empty && cd>0){
        const f = cd / (A.cd||1);
        c.fillStyle='rgba(10,8,14,0.74)'; c.fillRect(x+1,Y+1,24,Math.round(20*f));
        text(c, cd.toFixed(1), x+13, Y+6, '#c0b8d0', 7, 'center');
      }
      if(empty) text(c,'—', x+13, Y+7, '#4a4256', 8, 'center');
    }
    text(c, p.col.id, X-14, Y+7, p.col.main, 7);
  }); });
}

function drawHUD(c){
  const two = twoPlayer();
  const roster = PLAYERS.length ? PLAYERS : [player];

  // Panel widths are AUTHORED units; hudPx() says how wide that is on screen.
  if(two){
    drawPlayerPanel(c, roster[0], 3,                  3, 152, true);
    drawPlayerPanel(c, roster[1], VW-3-hudPx(152),    3, 152, true);
  } else {
    drawPlayerPanel(c, roster[0], 3, 3, 164, false);
  }

  // ---- a channel in progress
  if(G.channel){
    const ch=G.channel, f=Math.min(1,ch.t/ch.dur);
    const BW=120, BX=VW/2-BW/2, BY=VH-58;
    c.fillStyle='rgba(8,18,20,0.85)'; c.fillRect(BX-4,BY-12,BW+8,26);
    c.strokeStyle='#3fb5a8'; c.strokeRect(BX-3.5,BY-11.5,BW+7,25);
    text(c,'CHANNELLING  '+AETHITE_LOCKS[ch.id].name.toUpperCase(), VW/2, BY-9, '#8af0e4', 7, 'center');
    c.fillStyle='#10262a'; c.fillRect(BX,BY+2,BW,7);
    c.fillStyle='#8af0e4'; c.fillRect(BX,BY+2,Math.round(BW*f),7);
    c.fillStyle='rgba(255,255,255,0.4)'; c.fillRect(BX,BY+2,Math.round(BW*f),2);
  }

  // ---- dragons. One panel each, tucked under their owner's side, because
  // with two players the top-right corner belongs to P2's health.
  const DW = hudPx(75);
  roster.forEach((p,i)=>{
    const ax = two ? (i===0 ? 3 : VW-3-DW) : VW-3-DW;
    const ay = two ? 3+hudPx(46)+2 : 3;
    withPlayer(p, ()=>{ hudBlock(c, ax, ay, ()=>{
      const dxp = 0, dyp = 0;
      c.fillStyle='rgba(16,11,20,0.80)'; c.fillRect(dxp,dyp,75,27);
      c.strokeStyle = two ? p.col.dark : C.ui1; c.strokeRect(dxp+.5,dyp+.5,74,26);
      const sx0=dragon.x, sy0=dragon.y, sdx=player.dx;
      dragon.x=0; dragon.y=0; player.dx=1;
      c.save(); c.translate(dxp+13, dyp+16); c.scale(0.9,0.9); drawDragon(c); c.restore();
      dragon.x=sx0; dragon.y=sy0; player.dx=sdx;
      text(c, fitText(drg.name.toUpperCase(), 50), dxp+24, dyp+2, drg.c, 7);
      c.fillStyle='#2a1f2c'; c.fillRect(dxp+25,dyp+21,46,3);
      c.fillStyle=C.aether3;
      c.fillRect(dxp+25,dyp+21,
        Math.round(46*Math.min(1, dragon.bondXp/bondNeed(dragon.bond))),3);
      text(c,'L'+dragon.bond, dxp+3, dyp+19, C.aether4, 7);
      // The dragon's two skills, as actual buttons with their own key and
      // cooldown. They had no on-screen presence at all before, which in two
      // player made P2's dragon look like it simply didn't have any.
      const K = p.keys || KEYMAPS[0];
      for(let d=0; d<2; d++){
        const bx2 = dxp+25+d*24, by2 = dyp+10, cd = dragon.cds[d];
        const rdy = cd<=0;
        c.fillStyle = rdy ? '#2b2438' : '#1a1522';
        c.fillRect(bx2, by2, 21, 10);
        c.strokeStyle = rdy ? drg.b : '#3a3246'; c.lineWidth=1;
        c.strokeRect(bx2+.5, by2+.5, 20, 9);
        // Twenty-one pixels holds a key and a number, and nothing else. An
        // earlier pass also printed BRTH/SKIL in here and they ran straight
        // out of the button and over each other.
        if(rdy){
          text(c, K.dragon[d].toUpperCase(), bx2+8, by2+2, drg.c, 7);
        } else {
          c.fillStyle='rgba(10,8,14,0.72)';
          c.fillRect(bx2+1, by2+1, 19, Math.round(8*Math.min(1,cd/(d===0?5:11))));
          text(c, Math.ceil(cd)+'', bx2+8, by2+2, '#c0b8d0', 7);
        }
      }
    }); });
  });

  // ---- quest tracker
  if(G.quest.state==='active' || G.quest.state==='done'){
    const qw=116, qx=VW-qw-3, qy=two?3+hudPx(46)+hudPx(27)+6:3+hudPx(27)+4;
    c.fillStyle='rgba(16,11,20,0.78)'; c.fillRect(qx,qy,qw,26);
    c.strokeStyle=C.ui1; c.strokeRect(qx+.5,qy+.5,qw-1,25);
    text(c,"WARDEN'S DINNER", qx+5, qy+4, C.uiGold, 7);
    const done = G.quest.state==='done';
    text(c, done?'Return to Hayla':'Rustquail  '+G.quest.kills+' / '+G.quest.need,
         qx+5, qy+14, done?'#7ddc6a':C.uiText, 7);
  }

  // with easy attacks on, say what the button will actually do next
  if(G.easyAttack){
    const nm = withPlayer(roster[0], ()=>easyNextName());
    if(nm) text(c,'AUTO \u2192 '+nm, two?VW/2-86:VW/2-hudPx(180)/2, VH-4-hudPx(22)-19, C.brass4, 7);
  }

  // ---- ability bar. P1 keeps the centre; P2 gets a matching strip beside it
  // so neither player has to look across the screen for their own cooldowns.
  // P1's block is 180 authored units wide: four ability buttons, a gap, then
  // the two dragon buttons.
  const anchorX = two ? VW/2-86 : VW/2-hudPx(180)/2;
  const anchorY = VH-4-hudPx(22);
  if(two) drawAbilityStrip(c, roster[1], VW/2+22, anchorY);
  hudBlock(c, anchorX, anchorY, ()=>{
  const bx=0, by=0;
  for(let i=0;i<4;i++){
    const x=bx+i*30, A=cls.abilities[i], cd=player.cds[i];
    const empty = !A || A.name.indexOf('Empty')>=0;
    const ready = cd<=0 && !empty;
    c.fillStyle = ready?'#2b2438':'#1a1522';
    c.fillRect(x,by,26,22);
    c.strokeStyle = ready ? (isEmpowered()?C.amber4:cls.col.accentL) : '#3a3246';
    c.lineWidth=1; c.strokeRect(x+.5,by+.5,25,21);
    drawAbilityGlyph(c, i, x+13, by+9, ready, empty);
    text(c, ARROWS[i], x+2, by+13, ready?C.amber4:'#5a5266', 7);
    // Eidolon: a lit pip means this key commands the construct instead of summoning it
    if(cls.id==='eidolon'){
      const kind=['golem','sprite','hound','mega'][i];
      if(G.summons.some(s2=>s2.kind===kind)){
        c.fillStyle = ready ? '#57d0c4' : '#2f5a56';
        c.fillRect(x+20, by+3, 4, 4);
        c.fillStyle = ready ? '#b8fff6' : '#3d6e6a';
        c.fillRect(x+20, by+3, 2, 2);
      }
    }
    if(cls.id==='bulwark' && i===0)
      text(c, player.bastion?'ON':'OFF', x+9, by+13,
           player.bastion?'#8fd6ff':(ready?C.uiDim:'#4a4256'), 7);
    if(G.easyAttack && i===0){
      c.fillStyle=C.brass4; c.fillRect(x+19, by+2, 5, 5);
      c.fillStyle=C.brass5; c.fillRect(x+19, by+2, 2, 2);
    }
    if(!empty && cd>0){
      const f = cd / (A.cd||1);
      c.fillStyle='rgba(10,8,14,0.74)'; c.fillRect(x+1,by+1,24,Math.round(20*f));
      text(c, cd.toFixed(1), x+13, by+6, '#c0b8d0', 7, 'center');
    }
    if(empty) text(c,'—', x+13, by+7, '#4a4256', 8, 'center');
  }
  // dragon abilities
  for(let k=0;k<2;k++){
    const x=bx+124+k*30, cd=dragon.cds[k], ready=cd<=0;
    c.fillStyle = ready?'#33222c':'#1c1418';
    c.fillRect(x,by,26,22);
    c.strokeStyle = ready?drg.b:'#3a2c34'; c.strokeRect(x+.5,by+.5,25,21);
    // small flame/orb glyph tinted by element
    c.fillStyle = ready?drg.b:'#5a4048';
    c.fillRect(x+11,by+8,5,9); c.fillRect(x+12,by+5,3,4);
    c.fillStyle = ready?drg.c:'#6a5058'; c.fillRect(x+12,by+10,2,4);
    text(c, k===0?'Q':'E', x+2, by+13, ready?C.amber4:'#5a5266', 7);
    if(cd>0){
      c.fillStyle='rgba(10,8,14,0.74)'; c.fillRect(x+1,by+1,24,Math.round(20*(cd/(k?11:5))));
      text(c, cd.toFixed(1), x+13, by+6, '#c0b8d0', 7, 'center');
    }
  }
  });

  // ---- contextual hint strip
  let hint = '';
  if(cls.id==='longshot' && player.killzone) hint = 'KILLZONE \u2014 WASD SELECTS TARGET   ·   \u2192 TO EXIT';
  else if(cls.id==='aethermancer') hint = 'SPACE: RIFT STEP   ·   '+(player.mode?'SPREAD':'FOCUS')+' MODE';
  else if(cls.id==='savant')  hint = 'SPACE: ASSIMILATE (scan a creature)';
  else if(cls.id==='bulwark') hint = player.bastion ? 'BASTION HOLDING — ↑ TO DROP IT'
                                                     : 'SPACE: DODGE   ·   ↑ TOGGLES BASTION';
  else hint = 'SPACE: DODGE   ·   ARROWS: ABILITIES';
  // The hint sits just above the bar. It used to be nine pixels clear of a
  // 22-pixel-tall bar; with the bar at half height that gap was most of the
  // bottom of the screen and the two stopped reading as one strip.
  text(c, hint, VW/2, VH-4-hudPx(22)-9, C.ui2, 7, 'center');

  // active buffs
  let bxo = 4;
  for(const k in player.buffs){
    const lbl = k.toUpperCase().slice(0,9);
    text(c, lbl+' '+player.buffs[k].toFixed(0), bxo, VH-4-hudPx(22)-19, '#7ddc6a', 7);
    bxo += textWidth(lbl,7) + 32;
  }
  if(player.stealthT>0) text(c,'STEALTH '+player.stealthT.toFixed(0), bxo, VH-4-hudPx(22)-19, C.aether4, 7);

  // ---- toast
  if(G.toastT>0){
    const a=Math.min(1,G.toastT*1.6);
    c.globalAlpha=a;
    const w=textWidth(G.toast,7)+16;
    c.fillStyle='rgba(16,11,20,0.92)'; c.fillRect(VW/2-w/2, 46, w, 14);
    c.strokeStyle=C.uiGold; c.strokeRect(VW/2-w/2+.5, 46.5, w-1, 13);
    text(c, G.toast, VW/2, 50, C.uiGold, 7, 'center');
    c.globalAlpha=1;
  }

  // ---- area name on entry
  if(G.areaNameT>0){
    const a=Math.min(1,G.areaNameT);
    c.globalAlpha=a;
    text(c, G.area.name, VW/2, 70, C.uiText, 10, 'center');
    c.globalAlpha=1;
  }
}

function drawAbilityGlyph(c, i, cx, cy, ready, empty){
  if(empty) return;
  const col = ready ? cls.col.accentL : '#544c60';
  c.strokeStyle=col; c.fillStyle=col; c.lineWidth=1.5;
  const id=cls.id;
  if(id==='aethermancer' && i===3){                       // Convergence
    c.beginPath(); c.arc(cx+1,cy,5,0,Math.PI*2); c.stroke();
    c.fillRect(cx,cy-1,2,2); return;
  }
  switch(i){
    case 0: c.beginPath(); c.arc(cx+1,cy,5,-1.3,1.3); c.stroke(); break;
    case 1: c.beginPath(); c.arc(cx+1,cy,5,0,Math.PI*2); c.stroke(); break;
    case 2: c.fillRect(cx-3,cy-1,8,2); c.fillRect(cx+3,cy-3,2,2); c.fillRect(cx+3,cy+1,2,2); break;
    case 3: c.fillRect(cx-2,cy-4,2,8); c.fillRect(cx+1,cy-3,2,6); c.fillRect(cx+4,cy-2,2,4); break;
  }
}

// ============================================================================
// JOURNAL (pause / reference)
// ============================================================================
// ============================================================================
// THE CODEX
//
// Two tiers, deliberately. Damaging a creature RECORDS it: portrait, name,
// habitat, field note. Only a Savant scanning it LEARNS it, which unlocks the
// ability for use. So the codex fills in for every class and is worth opening
// for every class, but it means something different in Savant hands.
// ============================================================================
const CODEX_COLS = 9;
const CODEX_ORDER = ['rustquail','gearrat','drone','sporeling',
                     'brasshare','tickboar','pollenmoth',
                     'cragram','slagbear','pylonhawk',
                     'anvilcrab','turbineel','gullwright',
                     'emberimp','rimeimp','stormimp','pylon'];
const ZONE_NAME = { rustfields:'The Rustfields', verge:'The Verge',
                    clearing:'The Rustfields', cogway:'Ironhaven',
                    undercroft:'The Undercroft',
                    scarp:'The Iron Scarp', shoals:'The Rivet Shoals',
                    glimmervein:'The Glimmervein' };

function codexLearned(kind){ return player.codex.some(a=>a.kind===kind); }

// A creature drawn small and still, for the grid and the portrait plate. It
// borrows the live renderer rather than duplicating thirteen sprites, so the
// codex can never drift out of date with what you actually meet in the field.
function drawCodexBeast(c, kind, x, y, silhouette){
  const stash = G.enemies;
  G.enemies = [];
  spawnEnemy(kind, x, y);
  const e = G.enemies[0];
  e.anim = 1.3; e.bob = 0.6; e.facing = 1; e.hp = e.maxhp;
  if(silhouette) SILHOUETTE = '#2a2438';
  try { drawEnemy(c, e); }
  finally { SILHOUETTE = null; G.enemies = stash; }
}

function drawCodex(c){
  c.fillStyle='rgba(8,6,12,0.92)'; c.fillRect(0,0,VW,VH);
  drawTabStrip(c);

  const found = CODEX_ORDER.filter(k=>G.seen[k]).length;
  text(c,'MONSTER CODEX', 14, 24, C.uiGold, 10);
  text(c, found+' / '+CODEX_ORDER.length+' RECORDED', VW-14, 27, C.uiDim, 7, 'right');

  // ---- grid of portraits, 7 across
  // Nine across rather than seven. Seven fitted thirteen creatures in two
  // rows; seventeen needed a third, and the third row ran straight through
  // the detail plate below it. Smaller cells keep it at two.
  const COLS=CODEX_COLS, CW=34, CH=36, GX=22, GY=42;
  const ROWS = Math.ceil(CODEX_ORDER.length/COLS);
  CODEX_ORDER.forEach((kind,i)=>{
    const x = GX + (i%COLS)*CW, y = GY + ((i/COLS)|0)*CH;
    const sel = i===G.codexSel, know = !!G.seen[kind];
    c.fillStyle = sel ? '#33263f' : '#1a1522';
    c.fillRect(x, y, CW-4, CH-5);
    c.strokeStyle = sel ? C.uiGold : C.ui1; c.lineWidth=1;
    c.strokeRect(x+.5, y+.5, CW-5, CH-6);
    c.save();
    c.beginPath(); c.rect(x+1, y+1, CW-6, CH-7); c.clip();
    drawCodexBeast(c, kind, x+(CW-4)/2, y+CH-8, !know);
    c.restore();
    if(know && codexLearned(kind)){                  // a Savant has this one
      c.fillStyle=C.brass4; c.fillRect(x+CW-11, y+3, 5, 5);
      c.fillStyle=C.brass5; c.fillRect(x+CW-11, y+3, 2, 2);
    }
  });

  // ---- detail plate for the selection
  const kind = CODEX_ORDER[G.codexSel];
  const T0 = ENEMY_TYPES[kind], L = LEARNABLE[kind];
  const know = !!G.seen[kind], learned = codexLearned(kind);
  const DX = 24, DY = GY + ROWS*CH + 10;
  c.strokeStyle=C.ui1; c.lineWidth=1;
  c.beginPath(); c.moveTo(DX, DY-6.5); c.lineTo(VW-24, DY-6.5); c.stroke();

  // Portrait plate, right-hand side. The grid thumbnails are too small to
  // show a creature properly, so the selection gets a real one.
  const PW=72, PX=VW-24-PW, PY=DY-4;
  c.fillStyle='#16121e'; c.fillRect(PX, PY, PW, 56);
  c.strokeStyle=know?C.uiGold:C.ui1; c.lineWidth=1; c.strokeRect(PX+.5, PY+.5, PW-1, 55);
  c.save();
  c.beginPath(); c.rect(PX+1, PY+1, PW-2, 54); c.clip();
  drawCodexBeast(c, kind, PX+PW/2, PY+48, !know);
  c.restore();
  const TW = 54;                                   // text column, clear of the plate

  if(!know){
    text(c,'???', DX, DY+2, C.ui2, 10);
    text(c,'Not yet recorded. The codex fills in when', DX, DY+18, C.uiDim, 7);
    text(c,'you fight something, not when you walk', DX, DY+28, C.uiDim, 7);
    text(c,'past it.', DX, DY+38, C.uiDim, 7);
  } else {
    text(c, T0.name.toUpperCase(), DX, DY, C.uiText, 10);
    text(c, ZONE_NAME[T0.zone]||'', DX + textWidth(T0.name,10) + 14, DY+3, C.aether4, 7);
    text(c, T0.hostile?'HOSTILE':'PASSIVE', PX-10, DY+3, T0.hostile?'#ff6a5a':'#7ddc6a', 7, 'right');
    let y = DY + 16;
    wrap(L.lore, TW).forEach(l=>{ text(c, l, DX, y, C.uiDim, 7); y += 9; });
    y += 4;
    text(c,'HP '+T0.hp, DX, y, C.ui2, 7);
    text(c,'SPD '+T0.spd, DX+54, y, C.ui2, 7);
    if(T0.hostile) text(c,'DMG '+T0.atk, DX+110, y, C.ui2, 7);
    y += 11;

    // Resistances, where there are any. This is the one stat on the page the
    // player has to act on rather than just note, so it gets its own line
    // and the elements are named in their own colours.
    if(T0.immune || T0.weak){
      let ex = DX;
      if(T0.immune){
        text(c,'IMMUNE', ex, y, C.ui2, 7); ex += textWidth('IMMUNE',7)+6;
        text(c, T0.immune.toUpperCase(), ex, y, ELEM_COL[T0.immune]||C.uiText, 7);
        ex += textWidth(T0.immune,7)+12;
      }
      if(T0.weak && T0.weak.length){
        text(c,'WEAK', ex, y, C.ui2, 7); ex += textWidth('WEAK',7)+6;
        T0.weak.forEach((w,i)=>{
          text(c, w.toUpperCase()+(i<T0.weak.length-1?' ':''), ex, y,
               ELEM_COL[w]||C.uiText, 7);
          ex += textWidth(w+(i<T0.weak.length-1?' ':''),7)+4;
        });
      }
      y += 11;
    }
    y += 2;

    // ---- the Savant line, for Savants only
    //
    // Eight of the nine classes can never learn a creature ability, so telling
    // them what they would have learned is a page full of something they
    // cannot use. The codex is a field journal for everyone; the loadout half
    // of it belongs to the one class it is for.
    const isSavant = cls.id==='savant';
    if(isSavant){
      text(c,'SAVANT', DX, y, C.ui2, 7);
      text(c, L.name, DX+46, y, learned?C.brass4:C.ui2, 7);
      if(!learned) text(c,'— LOCKED (SCAN WITH SPACE)', DX+46+textWidth(L.name,7)+8, y, C.ui2, 7);
      y += 10;
      wrap(L.desc, TW-2).forEach(l=>{ text(c, l, DX+8, y, learned?C.uiDim:C.ui1, 7); y += 9; });
    }

    if(isSavant && learned){
      y += 4;
      text(c,'SLOTS', DX, y, C.uiGold, 7);
      for(let sl=1; sl<4; sl++){
        const bx = DX + 44 + (sl-1)*62;
        const cur = cls.abilities[sl];
        const here = cur && cur.name===L.name;
        c.fillStyle = here ? 'rgba(217,180,90,0.22)' : 'rgba(0,0,0,0.35)';
        c.fillRect(bx, y-2, 60, 12);
        c.strokeStyle = here ? C.uiGold : C.ui1; c.lineWidth=1;
        c.strokeRect(bx+.5, y-1.5, 59, 11);
        text(c, ARROWS[sl], bx+4, y, C.amber4, 7);
        text(c, (here ? L.name : (cur.name.indexOf('Empty')>=0 ? 'empty' : cur.name)).slice(0,7),
             bx+14, y, here?C.uiText:C.uiDim, 7);
      }
      if(!G.assignFrom)
        text(c,'ENTER TO ASSIGN', DX, y+13, C.ui2, 7);
    } else if(isSavant){
      y += 4;
      text(c,'Scan a live one to learn it.', DX, y, C.ui2, 7);
    }
  }

  text(c, cls.id==='savant'
        ? 'WASD SELECT    ENTER ASSIGN    Q/E TABS    '+closeKeyName()+' CLOSE'
        : 'WASD SELECT    Q/E TABS    '+closeKeyName()+' CLOSE',
       VW/2, VH-20, C.ui2, 7, 'center');

  // ---- the assign prompt
  //
  // Modal on purpose. It swallows every key while it is up, including the one
  // that closes the menu: the old page listed three arrow glyphs in a corner
  // and expected you to work out that they were the control, and pressing a
  // direction with no prompt up did nothing at all.
  if(G.assignFrom){
    const L2 = LEARNABLE[G.assignFrom];
    c.fillStyle='rgba(6,4,10,0.72)'; c.fillRect(0,0,VW,VH);
    const w=280, h=86, bx=(VW-w)/2, by=(VH-h)/2;
    c.fillStyle='#16121e'; c.fillRect(bx,by,w,h);
    c.strokeStyle=C.uiGold; c.lineWidth=1; c.strokeRect(bx+.5,by+.5,w-1,h-1);
    text(c,'ASSIGN', bx+12, by+10, C.uiGold, 10);
    text(c, L2.name.toUpperCase(), bx+12+textWidth('ASSIGN',10)+12, by+13, C.brass4, 7);
    text(c,'Press the direction you want it on.', bx+12, by+30, C.uiDim, 7);
    for(let sl=1; sl<4; sl++){
      const cur = cls.abilities[sl];
      const x0 = bx+12+(sl-1)*88;
      c.fillStyle='rgba(0,0,0,0.4)'; c.fillRect(x0, by+44, 82, 24);
      c.strokeStyle=C.ui1; c.strokeRect(x0+.5, by+44.5, 81, 23);
      text(c, ARROWS[sl], x0+6, by+50, C.amber4, 10);
      text(c, cur.name.indexOf('Empty')>=0 ? 'empty' : cur.name.slice(0,10),
           x0+22, by+48, cur.name.indexOf('Empty')>=0 ? C.ui2 : C.uiText, 7);
      text(c, cur.name.indexOf('Empty')>=0 ? '' : 'will be replaced',
           x0+22, by+58, C.ui1, 7);
    }
    text(c,'ESC  CANCEL', bx+w-12, by+10, C.ui2, 7, 'right');
  }
}

// ============================================================================
// OPTIONS — a mockup
//
// The rows are real and selectable; nothing behind them is wired. It is here
// to settle the shape of the screen before any of the Gamepad API work, and
// it is labelled as a mockup on screen so nobody mistakes it for a setting
// that does something.
// ============================================================================
const INPUT_DEVICES = [
  { name:'Keyboard',        sub:'WASD · Arrows · Space · R' },
  { name:'Gamepad 1',       sub:'not detected' },
  { name:'Gamepad 2',       sub:'not detected' },
  { name:'Switch Pro Pad',  sub:'not detected' }
];
const OPTION_ROWS = [
  // The one row here that is actually wired to anything.
  { label:'EASY ATTACKS',    kind:'easy' },
  { label:'PLAYER 1 INPUT',  kind:'input' },
  { label:'REBIND CONTROLS', kind:'remap' },
  { label:'RUMBLE',          kind:'flag',   value:'ON' },
  { label:'STICK DEADZONE',  kind:'value',  value:'0.18' },
  { label:'HOLD TO BURN',    kind:'flag',   value:'TOGGLE' },
  { label:'SCREEN SHAKE',    kind:'value',  value:'100%' }
];

function drawOptionsPanel(c, x, y, w, sel){
  text(c,'OPTIONS', x, y, C.uiGold, 10);
  text(c,'MOCKUP', x+textWidth('OPTIONS',10)+12, y+3, '#a06a6a', 7);
  // A cheat you can leave on by accident and then wonder why the balance
  // feels wrong is worse than no cheat, so it says so wherever it is on.
  if(G.godMode)
    text(c,'GOD MODE', x+w, y+3, Math.sin(G.time*5)>0 ? '#ff6a5a' : C.amber3, 7, 'right');

  // Every row is one line and the same height. An earlier version gave the
  // input row a second line for the device caption, which pushed the rows out
  // of step and collided with the footer.
  const ROW = 17;
  let ry = y + 20;
  OPTION_ROWS.forEach((row,i)=>{
    const on = i===sel;
    c.fillStyle = on ? 'rgba(217,180,90,0.14)' : 'rgba(0,0,0,0.25)';
    c.fillRect(x, ry-3, w, ROW-3);
    if(on){ c.strokeStyle=C.uiGold; c.lineWidth=1; c.strokeRect(x+.5, ry-2.5, w-1, ROW-4); }
    text(c, row.label, x+8, ry, on?C.uiText:C.uiDim, 7);
    const val = row.kind==='input' ? '< '+INPUT_DEVICES[G.inputP1].name+' >'
              : row.kind==='easy'  ? '< '+(G.easyAttack?'ON':'OFF')+' >'
              : row.kind==='remap' ? 'ENTER \u2192'
              : row.value;
    text(c, val, x+w-10, ry,
         row.kind==='easy' && G.easyAttack ? C.brass4 : on?C.amber4:C.ui2, 7, 'right');
    ry += ROW;
  });
  // a caption for the selected row, so each one explains itself
  const sel2 = OPTION_ROWS[sel];
  const cap = sel2.kind==='easy'
    ? 'One button walks your rotation \u2014 builds, then spends. Off by default.'
    : sel2.kind==='remap'
    ? 'Rebind any key, for either player. Lasts until the page is reloaded.'
    : 'P1 \u2014 '+INPUT_DEVICES[G.inputP1].sub;
  text(c, cap, x+2, ry+5, C.ui2, 7);
  return ry + 16;
}

function drawOptions(c){
  c.fillStyle='rgba(8,6,12,0.92)'; c.fillRect(0,0,VW,VH);
  drawTabStrip(c);
  if(G.remap){ drawRemapPanel(c, 30, 32, VW-60); return; }
  drawOptionsPanel(c, 30, 32, VW-60, G.optSel|0);
  text(c,'W/S SELECT    A/D CHANGE    Q/E TABS    '+closeKeyName()+' CLOSE',
       VW/2, VH-12, C.ui2, 7, 'center');
}

// ============================================================================
// REBINDING
//
// Two columns, because thirteen actions in one column runs off the bottom of
// a 270-unit screen once the footer is on it. Every row shows the key it is
// currently on, read live out of KEYMAPS — there is no copy of the bindings
// held anywhere in here, so what this page shows is always what the game will
// actually do.
// ============================================================================
function drawRemapPanel(c, x, y, w){
  const R = G.remap, pi = R.player|0, map = KEYMAPS[pi];
  text(c,'REBIND CONTROLS', x, y, C.uiGold, 10);
  const pcol = (P_COL[pi] && P_COL[pi].main) || C.uiText;
  text(c, twoPlayer() ? 'PLAYER '+(pi+1) : 'KEYBOARD', x+w, y+3, pcol, 7, 'right');

  const PERCOL = Math.ceil(BINDINGS.length/2);
  const COLW = (w-10)/2, ROW = 14;
  BINDINGS.forEach((b,i)=>{
    const col = i<PERCOL ? 0 : 1;
    const cx2 = x + col*(COLW+10), ry = y+20 + (i - col*PERCOL)*ROW;
    const on  = i===R.sel;
    c.fillStyle = on ? 'rgba(217,180,90,0.16)' : 'rgba(0,0,0,0.25)';
    c.fillRect(cx2, ry-3, COLW, ROW-3);
    if(on){ c.strokeStyle=C.uiGold; c.lineWidth=1; c.strokeRect(cx2+.5, ry-2.5, COLW-1, ROW-4); }
    text(c, b.label, cx2+7, ry, on?C.uiText:C.uiDim, 7);
    if(on && R.capturing){
      // Blink, so a row waiting for input can never be mistaken for a row
      // whose key happens to be called PRESS A KEY.
      if(Math.sin(G.time*9)>0) text(c,'PRESS A KEY', cx2+COLW-7, ry, C.amber4, 7, 'right');
    } else {
      const k = bindGet(map, b.id);
      const kw = textWidth(keyName(k),7)+8;
      c.fillStyle = on ? '#3a3020' : '#221d2c';
      c.fillRect(cx2+COLW-kw-5, ry-2, kw, 11);
      c.strokeStyle = on ? C.uiGold : '#3a3246';
      c.strokeRect(cx2+COLW-kw-4.5, ry-1.5, kw-1, 10);
      text(c, keyName(k), cx2+COLW-9, ry+1, on?C.amber4:C.ui2, 7, 'right');
    }
  });

  // Two lines. One ran off the right-hand edge of a 480-unit screen and lost
  // TAB BACK, which is the only way off this page.
  const fy = y+20+PERCOL*ROW+6;
  if(R.capturing){
    text(c,'ANY KEY BINDS IT   \u00b7   ESC CANCELS', x, fy, C.amber4, 7);
  } else {
    text(c,'W/S MOVE   \u00b7   ENTER REBIND   \u00b7   TAB BACK', x, fy, C.ui2, 7);
    text(c, (twoPlayer()?'A/D SWAPS PLAYER   \u00b7   ':'')+'BKSP RESTORES DEFAULTS',
         x, fy+10, C.ui2, 7);
  }
  if(R.msg) text(c, R.msg, x, fy+21, R.msgCol||'#a06a6a', 7);
}

// ============================================================================
// THE TAB MENU
//
// Six pages behind one key. The tab strip is cycled with Q/E rather than the
// arrows or A/D, because every page underneath wants those for its own
// navigation — the codex grid, the inventory list and the dragon's slots all
// use WASD, and sharing them with the tab strip would make each page fight
// the menu it lives in. Q/E are also the shoulder buttons on a pad, which is
// where tab-cycling belongs anyway.
// ============================================================================
const TABS = [
  { id:'journal',  name:'JOURNAL'   },
  { id:'quests',   name:'QUESTS'    },
  { id:'codex',    name:'CODEX'     },
  { id:'dragon',   name:'DRAGON'    },
  { id:'inventory',name:'INVENTORY' },
  { id:'map',      name:'MAP'       },
  { id:'options',  name:'OPTIONS'   }
];

function closeKeyName(){ return (twoPlayer() && G.menuOwner) ? 'P' : 'TAB'; }
function drawTabStrip(c){
  c.fillStyle='rgba(12,9,18,0.92)'; c.fillRect(0,0,VW,18);
  c.strokeStyle=C.ui1; c.lineWidth=1;
  c.beginPath(); c.moveTo(0,18.5); c.lineTo(VW,18.5); c.stroke();
  let x = 10;
  TABS.forEach((t,i)=>{
    const w = textWidth(t.name,7) + 14;
    const on = i===G.codexPage;
    if(on){
      c.fillStyle='rgba(217,180,90,0.18)'; c.fillRect(x-2, 2, w, 15);
      c.strokeStyle=C.uiGold; c.strokeRect(x-1.5, 2.5, w-1, 14);
      c.fillStyle=C.uiGold; c.fillRect(x-2, 17, w, 2);
    }
    text(c, t.name, x+5, 6, on?C.uiText:C.ui2, 7);
    x += w + 3;
  });
  if(twoPlayer()){
    // Both players can have opened this, and everything in it applies to
    // whoever did, so say so plainly.
    const who = P_COL[G.menuOwner|0];
    c.fillStyle=who.main; c.fillRect(VW-78, 3, 15, 12);
    text(c, who.id, VW-75, 6, '#12101a', 7);
    text(c,'Q/E TABS', VW-8, 6, C.ui2, 7, 'right');
  } else {
    text(c,'Q/E  TABS', VW-8, 6, C.ui2, 7, 'right');
  }
}

// ---------------------------------------------------------------------------
// DRAGON
// ---------------------------------------------------------------------------
function drawDragonPage(c){
  c.fillStyle='rgba(8,6,12,0.92)'; c.fillRect(0,0,VW,VH);
  drawTabStrip(c);

  // --- portrait, wearing whatever is fitted
  c.fillStyle='#16121e'; c.fillRect(14,26,86,78);
  c.strokeStyle=C.uiGold; c.lineWidth=1; c.strokeRect(14.5,26.5,85,77);
  c.save();
  c.beginPath(); c.rect(15,27,84,76); c.clip();
  c.translate(57, 78); c.scale(2.6,2.6);
  const sx=dragon.x, sy=dragon.y, sb=dragon.bob, sf=dragon.flap, sdx=player.dx;
  const sfc=dragon.face;
  dragon.x=0; dragon.y=0; dragon.bob=0.6; dragon.flap=1.2; player.dx=1;
  dragon.face=1;                       // the portrait always faces the reader
  drawDragon(c);
  dragon.x=sx; dragon.y=sy; dragon.bob=sb; dragon.flap=sf; player.dx=sdx;
  dragon.face=sfc;
  c.restore();

  text(c, drg.name.toUpperCase(), 108, 28, drg.c, 10);
  text(c, drg.el.toUpperCase(), 108+textWidth(drg.name,10)+12, 31, C.aether4, 7);
  text(c,'BOND LEVEL '+dragon.bond, 108, 44, C.uiGold, 7);
  // bond progress to the next level
  c.fillStyle='#2e2636'; c.fillRect(108,54,110,5);
  c.fillStyle=drg.b;     c.fillRect(108,54,
    Math.round(110*Math.min(1, dragon.bondXp/bondNeed(dragon.bond))), 5);
  text(c, Math.floor(dragon.bondXp)+' / '+bondNeed(dragon.bond), 224, 53, C.ui2, 7);
  text(c, 'LEANS '+drg.lean.toUpperCase(), 108, 64, C.ui2, 7);
  let dy = 74;
  wrap('A '+drg.el.toLowerCase()+' hatchling, bonded to you and growing with you. '
       +'Aethite Store '+player.aethiteMax+'. Every part you bolt on changes what it throws.', 62)
    .forEach(l=>{ text(c,l,108,dy,C.uiDim,7); dy+=9; });
  dy += 2;
  text(c,'Q  '+drg.ab1.name, 108, dy, C.uiText, 7);
  const qd=partEff('qDmg'), qr=partEff('qRange'), qc=partEff('qCd');
  text(c, 'dmg x'+qd.toFixed(2)+'  reach x'+qr.toFixed(2)+'  cd x'+qc.toFixed(2),
       108+textWidth(drg.ab1.name,7)+22, dy, (qd*qr/qc)>1.01?C.brass4:C.ui2, 7);
  dy += 10;
  text(c,'E  '+drg.ab2.name, 108, dy, C.uiText, 7);
  const ed=partEff('eDmg'), ec=partEff('eCd');
  text(c, 'power x'+ed.toFixed(2)+'  cd x'+ec.toFixed(2),
       108+textWidth(drg.ab2.name,7)+22, dy, (ed/ec)>1.01?C.brass4:C.ui2, 7);

  // --- the three slots
  const SY = 128;
  text(c,'FITTED PARTS', 14, SY-12, C.uiGold, 7);
  text(c, SLOT_NOTE[SLOTS[G.dragSel|0]], 14+textWidth('FITTED PARTS',7)+14, SY-12, C.ui2, 7);
  SLOTS.forEach((sl,i)=>{
    const x = 14 + i*152, on = i===(G.dragSel|0);
    const p = fittedPart(sl);
    c.fillStyle = on ? 'rgba(217,180,90,0.14)' : 'rgba(0,0,0,0.30)';
    c.fillRect(x, SY, 146, 53);
    c.strokeStyle = on ? C.uiGold : C.ui1; c.lineWidth=1;
    c.strokeRect(x+.5, SY+.5, 145, 52);
    text(c, sl.toUpperCase(), x+6, SY+5, on?C.amber4:C.ui2, 7);
    if(p){
      text(c, p.name, x+6, SY+16, C.uiText, 7);
      wrap(p.effText, 23).slice(0,2)
        .forEach((l,k)=> text(c, l, x+6, SY+25+k*8, C.brass4, 7));
      text(c, 'from the '+ENEMY_TYPES[p.from].name, x+6, SY+42, C.ui2, 7);
    } else {
      text(c,'— empty —', x+6, SY+18, C.ui2, 7);
      text(c,'fit one from your bag', x+6, SY+30, C.ui1, 7);
    }
  });

  // --- what you could put in the selected slot
  const slot = SLOTS[G.dragSel|0];
  const owned = G.inv.filter(i=>i.kind==='part' && PARTS_BY_ID[i.id].slot===slot);
  text(c,'IN YOUR BAG FOR THIS SLOT', 14, SY+59, C.ui2, 7);
  if(!owned.length){
    text(c,'nothing — parts drop from the creatures they came off', 14, SY+71, C.ui1, 7);
  } else {
    owned.slice(0,4).forEach((it,k)=>{
      const p = PARTS_BY_ID[it.id];
      text(c, (k+1)+'  '+p.name, 14+k*114, SY+71, C.uiText, 7);
      text(c, p.effText.slice(0,18), 14+k*114, SY+80, C.uiDim, 7);
    });
  }
  text(c,'A/D  SLOT    1-4  FIT    X  REMOVE    Q/E  TABS    '+closeKeyName()+'  CLOSE',
       VW/2, VH-12, C.ui2, 7, 'center');
}

// ---------------------------------------------------------------------------
// INVENTORY
// ---------------------------------------------------------------------------
function drawInventory(c){
  c.fillStyle='rgba(8,6,12,0.92)'; c.fillRect(0,0,VW,VH);
  drawTabStrip(c);

  text(c,'INVENTORY', 14, 24, C.uiGold, 10);
  text(c, G.marks+' AIONS', VW-14, 27, C.brass4, 7, 'right');
  const tv = trashValue();
  text(c, tv>0 ? 'SALVAGE WORTH '+tv+' — SELL TO ANY COGWAY TRADER' : 'no salvage to sell',
       14, 40, tv>0?C.uiDim:C.ui1, 7);

  const rows = G.inv.length;
  if(!rows){
    text(c,'Empty. Things fall off the creatures you kill.', 14, 60, C.ui2, 7);
  }
  // The list is unbounded by design, so it scrolls around the selection
  // rather than assuming everything fits.
  const PER = 11, sel = Math.min(G.invSel|0, Math.max(0,rows-1));
  const top = Math.max(0, Math.min(sel-5, rows-PER));
  for(let i=top; i<Math.min(rows, top+PER); i++){
    const it = G.inv[i], d = itemDef(it), y = 54 + (i-top)*15;
    const on = i===sel;
    c.fillStyle = on ? 'rgba(217,180,90,0.14)' : (i%2?'rgba(0,0,0,0.22)':'rgba(0,0,0,0.12)');
    c.fillRect(12, y-3, VW-24, 14);
    if(on){ c.strokeStyle=C.uiGold; c.lineWidth=1; c.strokeRect(12.5,y-2.5,VW-25,13); }
    const isPart = it.kind==='part', isMat = it.kind==='mat';
    // Three kinds of thing in one list, so the swatch and the label both have
    // to distinguish them. Materials were reading as SALVAGE, which is the one
    // thing they are not — a trader will not take them and a quest will.
    const M = isMat ? MAT_BY_ID[it.id] : null;
    c.fillStyle = isPart ? C.brass3 : isMat ? M.col.b : '#5a5545';
    c.fillRect(16, y, 6, 6);
    c.fillStyle = isPart ? C.brass5 : isMat ? M.col.lit : '#8a8270';
    c.fillRect(16, y, 3, 3);
    text(c, d.name + (it.n>1 ? '  x'+it.n : ''), 28, y, on?C.uiText:C.uiDim, 7);
    text(c, isPart ? PARTS_BY_ID[it.id].slot.toUpperCase()
                   : isMat ? 'MATERIAL \u2014 '+ZONE_NAME[M.zone].toUpperCase()
                           : 'SALVAGE',
         250, y, isPart?C.brass4:isMat?M.col.lit:C.ui2, 7);
    text(c, isMat ? '' : (d.value*it.n)+'m', VW-20, y, C.ui2, 7, 'right');
  }
  if(rows > PER) text(c, (top+1)+'-'+Math.min(rows,top+PER)+' of '+rows, VW-14, 44, C.ui1, 7, 'right');

  // --- detail for the selection
  if(rows){
    const it = G.inv[sel], d = itemDef(it);
    const DY = 54 + PER*15 + 6;
    c.strokeStyle=C.ui1; c.lineWidth=1;
    c.beginPath(); c.moveTo(14, DY-5.5); c.lineTo(VW-14, DY-5.5); c.stroke();
    text(c, d.name.toUpperCase(), 14, DY, C.uiText, 7);
    if(it.kind==='mat'){
      const M = MAT_BY_ID[it.id];
      text(c,'gathered from '+M.node+'s in '+ZONE_NAME[M.zone],
           14+textWidth(d.name,7)+14, DY, M.col.lit, 7);
    }
    else if(it.kind==='part'){
      const p = PARTS_BY_ID[it.id];
      text(c, p.effText, 14+textWidth(d.name,7)+14, DY, C.brass4, 7);
      text(c,'ENTER  fit to '+p.slot, VW-14, DY, C.amber4, 7, 'right');
    } else {
      text(c, d.value+' Aions each', 14+textWidth(d.name,7)+14, DY, C.ui2, 7);
    }
    wrap(d.desc, 74).forEach((l,k)=> text(c, l, 14, DY+11+k*9, C.uiDim, 7));
  }
  text(c,'W/S  SELECT    ENTER  FIT PART    Q/E  TABS    '+closeKeyName()+'  CLOSE',
       VW/2, VH-12, C.ui2, 7, 'center');
}

// ---------------------------------------------------------------------------
// MAP
//
// Hand-placed, not derived. The areas are different shapes and sizes and a
// generated layout of them would be a row of mismatched rectangles; what the
// player needs is the shape of the journey — cottage, village, road, ring,
// and the three ways out of it.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// THE MAP
//
// Aethermere is a shaft with a city built round the lip of it, so the map is a
// stack of floors rather than one sheet. W and S move between them.
//
// A floor you have never stood on does not appear at all — not greyed, not
// "???", absent — because the whole point of the crater is that you do not
// know how far down it goes. Once you HAVE been to a floor, everything on it
// is drawn, and the parts of it you have not reached read "???" as before.
// Those are two different kinds of unknown and the map should say so.
// ---------------------------------------------------------------------------
const MAP_FLOORS = [
  { n: 0, name:'THE SURFACE',   sub:'Ironhaven and the roads out of it' },
  { n:-1, name:'THE UNDERCROFT', sub:'first floor down the shaft' }
];
const MAP_NODES = [
  // --- the surface. Laid out with room under the Cogway for the shaft
  //     marker, which is the one thing on this sheet that points off it.
  { id:'house',     name:'Cottage',    floor:0, x: 34, y:128, w:38, h:26 },
  { id:'clearing',  name:'Millbrook',  floor:0, x: 88, y:118, w:58, h:44 },
  { id:'gate',      name:'Outer Gate', floor:0, x:162, y:124, w:48, h:32 },
  { id:'cogway',    name:'The Cogway', floor:0, x:236, y: 98, w:76, h:72, ring:true },
  { id:'verge',     name:'The Verge',  floor:0, x:242, y: 42, w:62, h:40 },
  { id:'scarp',     name:'Iron Scarp', floor:0, x:334, y:112, w:62, h:44, lock:'scarpgate' },
  { id:'shoals',    name:'Rivet Shoals',floor:0,x:242, y:202, w:62, h:36 },
  // --- one floor down. Its own sheet, not squeezed in beside the surface,
  //     because it IS its own sheet.
  { id:'undercroft', name:'Lift Landing', floor:-1, x:262, y:104, w:76, h:44, lock:'elevator' },
  { id:'glimmervein',name:'Glimmervein',  floor:-1, x:128, y: 98, w:84, h:56, lock:'elevator' }
];
const MAP_LINKS = [
  ['house','clearing'], ['clearing','gate'], ['gate','cogway'],
  ['cogway','verge'], ['cogway','scarp'], ['cogway','shoals'],
  ['undercroft','glimmervein']
];
// Links that go DOWN rather than across. Drawn as a stair marker on both
// floors rather than as a line, because a line between two sheets is a lie
// about where those places are.
// Links that go DOWN rather than across. Drawn as a marker on both floors
// rather than as a line, because a line between two sheets is a lie about
// where those places are. Positions are given per node rather than derived,
// because "just below the node" collides with whatever is below the node and
// there are only two of them to place.
const MAP_SHAFTS = [
  { from:'cogway', to:'undercroft', lock:'elevator', label:'THE LIFT',
    at:{ cogway:[274,184], undercroft:[300,166] } }
];
const MAP_BY_ID = {}; MAP_NODES.forEach(n=>MAP_BY_ID[n.id]=n);

function mapFloorNodes(f){ return MAP_NODES.filter(n=>n.floor===f); }
// A floor is discovered once you have stood anywhere on it.
function floorSeen(f){ return mapFloorNodes(f).some(n=>G.visited[n.id]); }
function seenFloors(){ return MAP_FLOORS.filter(fl=>floorSeen(fl.n)); }

function drawMapPage(c){
  c.fillStyle='rgba(8,6,12,0.94)'; c.fillRect(0,0,VW,VH);
  drawTabStrip(c);

  const open = seenFloors();
  if(!open.length){
    text(c,'AETHERMERE', 14, 24, C.uiGold, 10);
    text(c,'You have not been anywhere yet.', 14, 52, C.ui2, 7);
    text(c,'Q/E  TABS    '+closeKeyName()+'  CLOSE', VW/2, VH-12, C.ui2, 7, 'center');
    return;
  }
  // keep the shown floor on something that exists, and follow the player down
  let idx = open.findIndex(fl=>fl.n===G.mapFloor);
  if(idx < 0){
    const hereNode = MAP_BY_ID[G.areaId];
    const want = hereNode ? hereNode.floor : 0;
    idx = Math.max(0, open.findIndex(fl=>fl.n===want));
    G.mapFloor = open[idx].n;
  }
  const FL = open[idx];
  const nodes = mapFloorNodes(FL.n);

  text(c,'AETHERMERE', 14, 24, C.uiGold, 10);
  text(c, FL.name, 14+textWidth('AETHERMERE',10)+14, 27, C.aether4, 7);
  text(c, FL.sub, 14, 38, C.ui2, 7);

  // --- the floor indicator, down the right-hand edge ------------------------
  // One rung per DISCOVERED floor. Undiscovered floors leave no gap, because
  // a gap is itself a statement about how many there are.
  const RX = VW-28;
  open.forEach((fl,i)=>{
    const y = 52 + i*16, on = i===idx;
    c.fillStyle = on ? C.uiGold : '#2e2636';
    c.fillRect(RX-4, y, 18, 12);
    c.strokeStyle = on ? C.amber4 : C.ui1; c.lineWidth=1;
    c.strokeRect(RX-3.5, y+.5, 17, 11);
    // "G" for the ground and a depth for everything under it. Signed numbers
    // do not fit a rung at 7px and read as a dash when they are clipped.
    text(c, fl.n===0 ? 'G' : String(-fl.n), RX+5, y+3, on?'#12101a':C.ui2, 7, 'center');
  });
  if(idx > 0)              text(c,'\u2191 W', RX-2, 52-11, C.uiDim, 7, 'right');
  if(idx < open.length-1)  text(c,'\u2193 S', RX-2, 52+open.length*16, C.uiDim, 7, 'right');

  // links first, so nodes sit on top of them
  for(const [a,b] of MAP_LINKS){
    const A=MAP_BY_ID[a], B=MAP_BY_ID[b];
    if(!A || !B || A.floor!==FL.n || B.floor!==FL.n) continue;
    const ax=A.x+A.w/2, ay=A.y+A.h/2, bx=B.x+B.w/2, by=B.y+B.h/2;
    const locked = B.lock && !G.locks[B.lock];
    c.strokeStyle = locked ? '#5a2a30' : C.ui2;
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(ax,ay); c.lineTo(bx,by); c.stroke();
    if(locked){
      // a seal drawn across the middle of the link
      const mx=(ax+bx)/2, my=(ay+by)/2;
      c.fillStyle='#1a1018'; c.fillRect(mx-5,my-5,10,10);
      c.fillStyle='#c8452b'; c.fillRect(mx-4,my-4,8,8);
      c.fillStyle='#1a1018'; c.fillRect(mx-2,my-1,4,2);
    }
  }

  for(const n of nodes){
    const here = n.id===G.areaId;
    const locked = n.lock && !G.locks[n.lock];
    const known = here || G.visited[n.id] || !locked;
    c.fillStyle = here ? '#33263f' : locked ? '#181118' : '#1c1826';
    c.fillRect(n.x, n.y, n.w, n.h);
    c.strokeStyle = here ? C.uiGold : locked ? '#5a2a30' : C.ui1;
    c.lineWidth = 1; c.strokeRect(n.x+.5, n.y+.5, n.w-1, n.h-1);
    if(n.ring){
      // the Cogway gets drawn as what it is
      const cx=n.x+n.w/2, cy=n.y+n.h/2;
      c.strokeStyle=C.cstone4; c.beginPath(); c.arc(cx,cy,n.w*0.36,0,Math.PI*2); c.stroke();
      c.strokeStyle=C.cstone3; c.beginPath(); c.arc(cx,cy,n.w*0.26,0,Math.PI*2); c.stroke();
      c.fillStyle='#0a080e';
      c.beginPath(); c.arc(cx,cy,n.w*0.17,0,Math.PI*2); c.fill();
      c.fillStyle='rgba(255,170,70,0.35)';
      c.beginPath(); c.arc(cx,cy,3,0,Math.PI*2); c.fill();
    }
    text(c, known ? n.name : '???', n.x+n.w/2, n.y+n.h-11,
         here?C.uiText:known?C.uiDim:C.ui1, 7, 'center');
    if(here){
      const fl = Math.sin(G.time*4)>0;
      if(fl){ c.fillStyle=C.amber3; c.fillRect(n.x+n.w/2-2, n.y+4, 4, 4); }
      text(c,'YOU ARE HERE', n.x+n.w/2, n.y-10, C.amber4, 7, 'center');
    }
  }

  // --- the shaft. Drawn on both floors it joins, as a way down or a way up. --
  for(const sh of MAP_SHAFTS){
    const A = MAP_BY_ID[sh.from], B = MAP_BY_ID[sh.to];
    if(!A || !B) continue;
    const mine = A.floor===FL.n ? A : B.floor===FL.n ? B : null;
    if(!mine) continue;
    const down = mine === A;                       // on the upper floor
    if(!floorSeen(down ? B.floor : A.floor)) continue;
    const barred = sh.lock && !G.locks[sh.lock];
    const spot = sh.at[mine.id] || [mine.x+mine.w/2, mine.y+mine.h+14];
    const mx = spot[0], my = spot[1];
    c.fillStyle = '#12101a'; c.fillRect(mx-26, my-6, 52, 15);
    c.strokeStyle = barred ? '#5a2a30' : C.brass4; c.lineWidth=1;
    c.strokeRect(mx-25.5, my-5.5, 51, 14);
    text(c, (down?'\u2193 ':'\u2191 ')+sh.label, mx, my-2,
         barred?'#8a4a44':C.brass4, 7, 'center');
  }

  const onFloor = nodes.length;
  const found = nodes.filter(n=>G.visited[n.id]).length;
  text(c, found+' / '+onFloor+' WALKED', VW-40, 24, C.uiDim, 7, 'right');
  text(c,'W/S  FLOOR    Q/E  TABS    '+closeKeyName()+'  CLOSE',
       VW/2, VH-12, C.ui2, 7, 'center');
}

// ---------------------------------------------------------------------------
// QUESTS
// ---------------------------------------------------------------------------
function drawQuestPage(c){
  c.fillStyle='rgba(8,6,12,0.94)'; c.fillRect(0,0,VW,VH);
  drawTabStrip(c);
  text(c,'POSTINGS', 14, 24, C.uiGold, 10);

  const open = QUESTS.filter(q=>questState(q.id) && questState(q.id)!==QUEST_STATE.DONE);
  const doneN = QUESTS.filter(q=>questState(q.id)===QUEST_STATE.DONE).length;
  text(c, doneN+' / '+QUESTS.length+' SETTLED', VW-14, 27, C.uiDim, 7, 'right');

  if(!open.length){
    text(c, doneN ? 'Nothing outstanding. Ask around the ring.'
                  : 'Nobody has asked you for anything yet. The ring is full of people who will.',
         14, 46, C.ui2, 7);
    text(c,'Q/E  TABS    '+closeKeyName()+'  CLOSE', VW/2, VH-12, C.ui2, 7, 'center');
    return;
  }

  const sel = Math.min(G.questSel|0, open.length-1);
  let y = 42;
  open.forEach((q,i)=>{
    const r = G.quests[q.id], p = questProgress(q);
    const on = i===sel, ready = r.state===QUEST_STATE.READY;
    c.fillStyle = on ? 'rgba(217,180,90,0.14)' : 'rgba(0,0,0,0.30)';
    c.fillRect(14, y, VW-28, 26);
    c.strokeStyle = on ? C.uiGold : ready ? C.brass4 : C.ui1; c.lineWidth=1;
    c.strokeRect(14.5, y+.5, VW-29, 25);
    text(c, q.title, 22, y+4, ready?C.brass4:C.uiText, 7);
    text(c, QUEST_GIVER_NAME[q.giver], 22, y+14, C.ui2, 7);
    text(c, p.text.toUpperCase(), VW-24, y+4, ready?C.brass4:C.uiDim, 7, 'right');
    if(ready) text(c,'READY — GO AND SAY SO', VW-24, y+14, C.brass4, 7, 'right');
    // a progress bar, where progress is countable
    if(!ready && p.frac!==undefined){
      c.fillStyle='#2e2636'; c.fillRect(VW-120, y+16, 96, 3);
      c.fillStyle=C.brass4;  c.fillRect(VW-120, y+16, Math.round(96*p.frac), 3);
    }
    y += 30;
  });

  // ---- the brief for whichever is selected
  const q = open[sel], r = G.quests[q.id];
  const DY = Math.max(y+8, 150);
  c.strokeStyle=C.ui1; c.lineWidth=1;
  c.beginPath(); c.moveTo(14, DY-6.5); c.lineTo(VW-14, DY-6.5); c.stroke();
  text(c, q.title.toUpperCase(), 14, DY, C.uiGold, 10);
  text(c, QUEST_KIND_NAME[q.kind]||'', 14+textWidth(q.title,10)+14, DY+3, C.aether4, 7);
  let ly = DY + 16;
  wrap(q.brief[q.brief.length-1], 74).forEach(l=>{ text(c,l,14,ly,C.uiDim,7); ly+=9; });
  ly += 4;
  text(c,'PAYS', 14, ly, C.ui2, 7);
  text(c, questRewardText(q), 14+34, ly, C.brass4, 7);

  text(c,'W/S  SELECT    Q/E  TABS    '+closeKeyName()+'  CLOSE',
       VW/2, VH-12, C.ui2, 7, 'center');
}
const QUEST_KIND_NAME = {
  bounty:'BOUNTY', haul:'HAULAGE', survey:'SURVEY',
  collector:'FIELDWORK', rootcut:'CONTRACT'
};
function questRewardText(q){
  const rw = q.reward||{}, bits = [];
  if(rw.marks) bits.push(rw.marks+' Aions');
  for(const [kind,id,n] of (rw.items||[])){
    const d = kind==='mat' ? MAT_BY_ID[id] : kind==='part' ? PARTS_BY_ID[id] : TRASH_BY_ID[id];
    bits.push(n+' '+d.name);
  }
  if(rw.part)    bits.push(PARTS_BY_ID[rw.part].name+' (dragon part)');
  if(rw.aethite) bits.push('+'+rw.aethite+' Aethite store');
  return bits.join(', ');
}

function drawJournal(c){
  // Dispatch by the tab's ID, not by its index. This was five index
  // comparisons, and inserting a tab anywhere but the end silently moved
  // every page after it onto the wrong number.
  switch((TABS[G.codexPage]||TABS[0]).id){
    case 'options':   return drawOptions(c);
    case 'map':       return drawMapPage(c);
    case 'inventory': return drawInventory(c);
    case 'dragon':    return drawDragonPage(c);
    case 'codex':     return drawCodex(c);
    case 'quests':    return drawQuestPage(c);
  }
  c.fillStyle='rgba(8,6,12,0.92)'; c.fillRect(0,0,VW,VH);
  drawTabStrip(c);
  text(c,'FIELD JOURNAL', VW/2, 24, C.uiGold, 10, 'center');

  // Two columns with a hard gutter. At 6px per glyph the left column fits
  // 34 characters and the right 33 — anything wider collides.
  const LX = 22, RX = 250, LW = 34, RW = 33;
  c.strokeStyle=C.ui1; c.lineWidth=1;
  c.beginPath(); c.moveTo(242.5, 40); c.lineTo(242.5, VH-22); c.stroke();

  // ---- header spans both columns
  text(c, cls.name.toUpperCase(), LX, 42, C.uiGold, 8);
  text(c, cls.role, LX + textWidth(cls.name,8) + 12, 42, C.aether4, 7);

  // ---- the level ladder, in the right column's header space. What the next
  // level costs is printed rather than implied: the curve widens as you climb
  // and a bar with no number under it just looks like it has stopped moving.
  const LVW = 118, LVX = VW-22-LVW;
  const need = levelNeed(player.level||1);
  text(c,'LEVEL '+(player.level||1), LVX, 40, C.amber4, 8);
  text(c, Math.floor(player.xp||0)+' / '+need, LVX+LVW, 42, C.ui2, 7, 'right');
  c.fillStyle='#2e2636'; c.fillRect(LVX, 52, LVW, 5);
  c.fillStyle=C.amber3;  c.fillRect(LVX, 52, Math.round(LVW*Math.min(1,(player.xp||0)/need)), 5);
  c.fillStyle='rgba(255,255,255,0.32)';
  c.fillRect(LVX, 52, Math.round(LVW*Math.min(1,(player.xp||0)/need)), 1);
  // Kept to what fits in 118 units at 7px. The first draft spelled it out in
  // full and ran off the right-hand edge of the screen.
  text(c,'+'+LEVEL_HP+' HP  +'+Math.round(LEVEL_ATK*100)+'% DMG', LVX, 60, C.ui2, 7);
  text(c,'BOND '+dragon.bond+' · '+Math.floor(dragon.bondXp)+' / '+bondNeed(dragon.bond),
       LVX, 70, C.aether4, 7);

  text(c,'MECHANIC · '+cls.mech, LX, 54, C.amber4, 7);
  let yy = 65;
  // 34 columns, not 68: the level panel owns the right half of this row now,
  // and 34 is what the left column is worth at 6px a glyph.
  wrap(cls.mechDesc, 34).forEach(l=>{ text(c, l, LX, yy, C.uiDim, 7); yy+=9; });
  yy = Math.max(yy, 82);

  // ---- left: abilities
  let ly = yy + 7;
  text(c,'ABILITIES', LX, ly, C.ui2, 7); ly += 12;
  cls.abilities.forEach((a,i)=>{
    text(c, ARROWS[i], LX, ly, C.amber4, 7);
    text(c, a.name, LX+12, ly, C.uiText, 7);
    ly += 10;
    wrap(a.desc, LW-2).forEach(l=>{ text(c, l, LX+12, ly, C.uiDim, 7); ly += 9; });
    ly += 4;
  });

  // ---- right: dragon, then controls
  let ry = yy + 7;
  text(c, drg.name.toUpperCase(), RX, ry, drg.c, 7);
  text(c, drg.el.toUpperCase(), RX + textWidth(drg.name,7) + 10, ry, C.ui2, 7);
  ry += 11;
  text(c,'Q  '+drg.ab1.name, RX, ry, C.uiText, 7); ry += 9;
  wrap(drg.ab1.desc, RW).forEach(l=>{ text(c,l,RX+6,ry,C.uiDim,7); ry+=9; });
  ry += 3;
  text(c,'E  '+drg.ab2.name, RX, ry, C.uiText, 7); ry += 9;
  wrap(drg.ab2.desc, RW).forEach(l=>{ text(c,l,RX+6,ry,C.uiDim,7); ry+=9; });

  ry += 8;
  text(c,'CONTROLS', RX, ry, C.ui2, 7); ry += 11;
  const rows=[['WASD','Move'],
              ['SPACE', cls.id==='aethermancer'?'Rift Step':cls.id==='savant'?'Assimilate':'Dodge'],
              ['↑←↓→','Abilities'],
              ['Q / E','Dragon'],['R','Burn Aethite'],
              ['F','Talk / doors'],
              [twoPlayer()?(G.menuOwner?'P':'TAB'):'TAB / P','Menu']];
  rows.forEach((r,i)=>{ text(c,r[0],RX,ry+i*10,C.amber4,7); text(c,r[1],RX+62,ry+i*10,C.uiText,7); });

  if(player.codex.length){
    text(c,'CODEX', LX, VH-46, C.ui2, 7);
    wrap(player.codex.map(a=>a.name).join(', '), 30).slice(0,2)
      .forEach((l,i)=> text(c, l, LX+40, VH-46+i*9, C.uiText, 7));
  }
  // bottom-left, clear of the right-hand controls column
  text(c, closeKeyName()+' TO CLOSE', LX, VH-26, C.uiDim, 7);
}

function drawPause(c){
  c.fillStyle='rgba(0,0,0,0.62)'; c.fillRect(0,0,VW,VH);
  panel(c, 160, 108, 160, 54);
  // Only the window losing focus gets you here now — the pause key opens
  // the menu instead, because two screens that both stop the game was one
  // screen too many.
  text(c,'PAUSED', VW/2, 120, C.uiGold, 11, 'center');
  text(c,'ANY KEY TO RESUME', VW/2, 142, C.uiDim, 7, 'center');
}
function drawDead(c){
  c.fillStyle='rgba(50,8,8,0.6)'; c.fillRect(0,0,VW,VH);
  panel(c, 120, 96, 240, 80, C.hpRed);
  text(c,'YOU ARE DOWN', VW/2, 108, '#ff6a5a', 12, 'center');
  text(c,'Hayla will not be pleased.', VW/2, 128, C.uiDim, 7, 'center');
  if(Math.sin(G.time*5)>-0.3) text(c,'PRESS R TO GET BACK UP', VW/2, 150, C.uiText, 8, 'center');
}
