
// ============================================================================
// TILE RENDERING — the graphics overhaul.
// Three things separate this from the v1 look:
//   1. every material has a 4-5 step ramp instead of base + noise
//   2. ground tiles auto-edge against their neighbours, so grass meets path
//      with a real transition rather than a hard seam
//   3. tall props split across two buffers: trunks/walls in the ground layer,
//      canopies/roofs in an overlay drawn *after* actors, so you can walk
//      behind a tree and be occluded by it
// ============================================================================

// Tiles use the same authored-unit scheme as sprites — see ART_UNIT in
// p8_sprites.js. A tile painter that has been redrawn for the new density
// declares it with withArt(ART) and then writes device-resolution
// coordinates; everything else is untouched.
function tpx(c,col,x,y,w,h){
  c.fillStyle=col;
  if(ART_UNIT === 1){ c.fillRect(x|0,y|0,(w||1)|0,(h||1)|0); return; }
  const k = 1/ART_UNIT;
  c.fillRect((x|0)*k, (y|0)*k, ((w||1)|0)*k, ((h||1)|0)*k);
}

// ---------------------------------------------------------------------------
// GROUND PATCHES
// The organic clumping in grass and dry brush is per-pixel noise. Evaluating it
// live cost ~230,000 fillRect calls to build one area, which is a visible hitch
// on area load. Instead it is baked once into a 64x64 tile that repeats
// seamlessly (both noise frequencies divide 64), then blitted per tile.
// ---------------------------------------------------------------------------
let PATCH = null;
function buildGroundPatches(){
  // Four value steps rather than three, and the noise runs at device density
  // so the grain is fine enough to read as texture instead of as blocks. Both
  // frequencies still divide the patch, so it tiles seamlessly.
  const S = 4*TILE*ART;                    // 4x4 tiles of ground, in device units
  // `soft` narrows the bands and drops the two extreme steps. Sand and cave
  // floor need it: a wide range turns a smooth surface into gravel, and the
  // eye reads gravel as something it could trip on rather than as a floor.
  const make = (base, light, dark, extra, soft) => {
    const cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    const XL = lit(light), XD = deep(dark);
    g.fillStyle = base; g.fillRect(0,0,S,S);
    for(let y=0;y<S;y++) for(let x=0;x<S;x++){
      // Three octaves at an eighth, a sixteenth and one unit of a tile. Keeping
      // the old proportions (half- and quarter-tile) would have doubled the
      // block size along with everything else and produced camouflage.
      const a1 = hash2(((x>>3)&15), ((y>>3)&15));           // 8-unit clumps
      const a2 = hash2((((x>>2)&31)+11), (((y>>2)&31)+7));  // 4-unit
      const a3 = hash2((x&127)+29, (y&127)+17);             // per-unit grain
      const n  = a1*0.42 + a2*0.34 + a3*0.24;
      // Narrow bands. Wide ones turned the ground into camouflage — the eye
      // reads high-contrast blotches as objects, and a floor has to stay a
      // floor or every actor standing on it is competing with it.
      let col = null;
      if(soft){
        if(n > 0.74)      col = light;
        else if(n < 0.24) col = dark;
        else if(extra && a3 > 0.97) col = extra;
      } else {
        if(n > 0.86)      col = XL;
        else if(n > 0.66) col = light;
        else if(n < 0.13) col = XD;
        else if(n < 0.30) col = dark;
        else if(extra && a3 > 0.95) col = extra;
      }
      if(col){ g.fillStyle = col; g.fillRect(x,y,1,1); }
    }
    return cv;
  };
  PATCH = {
    grass:  make(C.grass2,   C.grass3,    C.grass1,    C.grass4),
    dry:    make(C.dryGrass2,C.dryGrass3, C.dryGrass1, null),
    sand:   make(C.shore2,   C.shore3,    mixHex(C.shore1,C.shore2,0.45), C.shore4, true),
    scree:  make(C.crag2,    C.crag3,     C.crag1,     C.crag4),
    cave:   make(C.cave2,    C.cave3,     C.cave1,     null, true),
    cobble: make(C.cstone2,  C.cstone3,   C.cstone1,   null)
  };
}
// Blit the one-tile slice of the patch that lines up with this tile's world
// position, so neighbouring tiles continue each other's grain.
//
// SOURCE coordinates are device pixels, because that is what the patch is.
// DESTINATION coordinates are WORLD units, because the context is already
// scaled by ART — withArt() governs tpx() and px() and nothing else. Passing
// device coordinates here put every tile at four times its offset and left
// most of the ground black, which is worth knowing about before converting
// any other painter that reaches past the two primitives.
function blitPatch(c, which, cx, cy, X, Y){
  if(!PATCH) buildGroundPatches();
  const AT = TILE*ART;
  c.drawImage(PATCH[which], (cx&3)*AT, (cy&3)*AT, AT, AT, X, Y, TILE, TILE);
}

// ===========================================================================
// THE LIGHT
//
// One rule, followed by every converted painter in the game: light comes from
// the UPPER LEFT. A form is lightest on its top and left faces, darkest on its
// bottom and right, and the boundary between a form and what is behind it gets
// a one-unit rim — light on the lit side, occlusion on the shaded side.
//
// This is what separates a 16-bit tileset from a higher-resolution 8-bit one.
// Detail alone reads as noise; detail that all agrees about where the sun is
// reads as form. A thousand painters cannot agree by accident, so the rule is
// written down here and these helpers are the sanctioned way to derive a
// shade from a base colour.
// ===========================================================================
function lit (hex){ return shade(hex, 1.24); }   // top / left face
function dim (hex){ return shade(hex, 0.80); }   // bottom / right face
function deep(hex){ return shade(hex, 0.60); }   // occlusion, crevices
function glow(hex){ return shade(hex, 1.48); }   // specular nick, used sparingly

// ---------------------------------------------------------------------------
// GROUND TRANSITIONS
//
// Every ground family declares a RANK. Where two families meet, the higher
// rank overhangs the lower — turf curls over dirt, dirt washes over stone,
// sand drifts across everything it touches. The fringe is painted by the LOWER
// tile, inside its own bounds, so a tile never paints outside itself and the
// order the grid is walked in cannot matter.
//
// Nine of the twelve families had no transition at all before this: they met
// their neighbours on a hard tile boundary, and a hard boundary between two
// textures is the loudest tell that something is a tilemap.
//
// `style` decides the shape of the fringe:
//   turf    irregular, deep, with blades poking over — grass, dry grass
//   drift   soft scatter that thins with distance — sand, scree, cave dust
//   wash    a smooth two-step rim — dirt, path, wet sand
//   hard    one crisp unit, for worked stone that was cut to a line
//   shore   bright waterline, painted on the WATER side
// ---------------------------------------------------------------------------
const FAM = {
  1:  { rank:80, name:'grass',   style:'turf',  a:()=>C.grass1,    b:()=>C.grass3,  depth:5 },
  2:  { rank:78, name:'dry',     style:'turf',  a:()=>C.dryGrass1, b:()=>C.dryGrass3, depth:4 },
  10: { rank:74, name:'sand',    style:'drift', a:()=>C.shore2,    b:()=>C.shore4,  depth:5 },
  11: { rank:60, name:'wetsand', style:'wash',  a:()=>C.wet1,      b:()=>C.wet2,    depth:3 },
  3:  { rank:56, name:'dirt',    style:'wash',  a:()=>C.path1,     b:()=>C.path3,   depth:3 },
  9:  { rank:52, name:'scree',   style:'drift', a:()=>C.crag1,     b:()=>C.crag3,   depth:4 },
  12: { rank:44, name:'cave',    style:'drift', a:()=>C.cave1,     b:()=>C.cave3,   depth:3 },
  5:  { rank:34, name:'stone',   style:'hard',  a:()=>C.stone1,    b:()=>C.stone3,  depth:2 },
  7:  { rank:30, name:'cobble',  style:'hard',  a:()=>C.cstone1,   b:()=>C.cstone3, depth:2 },
  8:  { rank:28, name:'iron',    style:'hard',  a:()=>C.iron1,     b:()=>C.iron3,   depth:2 },
  6:  { rank:26, name:'wood',    style:'hard',  a:()=>C.wood1,     b:()=>C.wood3,   depth:2 },
  4:  { rank:10, name:'water',   style:'shore', a:()=>C.water5,    b:()=>C.water4,  depth:2 }
};

// --- ground families, used to decide where transitions are drawn
const GROUND_FAM = {};
GROUND_FAM[T.GRASS]=1; GROUND_FAM[T.GRASS_TUFT]=1; GROUND_FAM[T.FLOWERS]=1;
GROUND_FAM[T.DRY]=2;
GROUND_FAM[T.DIRT]=3; GROUND_FAM[T.PATH]=3; GROUND_FAM[T.GRAVEL]=3;
GROUND_FAM[T.WATER]=4; GROUND_FAM[T.SHALLOW]=4;
GROUND_FAM[T.STONE]=5;
GROUND_FAM[T.FLOOR_WOOD]=6; GROUND_FAM[T.RUG]=6;
GROUND_FAM[T.COBBLE]=7; GROUND_FAM[T.INLAY]=7;
GROUND_FAM[T.IRONPLATE]=8; GROUND_FAM[T.VENT]=8; GROUND_FAM[T.LIFT]=8;
GROUND_FAM[T.SCREE]=9;
GROUND_FAM[T.SAND]=10; GROUND_FAM[T.DUNEGRASS]=10;
GROUND_FAM[T.WETSAND]=11; GROUND_FAM[T.SURF]=4;      // surf edges against water
GROUND_FAM[T.TALLGRASS]=1; GROUND_FAM[T.REEDS]=1;
// The Glimmervein. The props that stand ON cave floor have to share its
// family, or the ground beneath them falls through drawGround's default arm —
// which is grass, and put a lawn under every wall in the cave.
GROUND_FAM[T.CAVEFLOOR]=12; GROUND_FAM[T.GEMVEIN]=12;
GROUND_FAM[T.CAVEWALL]=12;  GROUND_FAM[T.GEMCLUSTER]=12; GROUND_FAM[T.FLOWSTONE]=12;

function tileAt(area,x,y){
  if(x<0||y<0||x>=area.w||y>=area.h) return T.VOID;
  return area.map[y*area.w+x];
}

// ---------------------------------------------------------------------------
// GROUND
// ---------------------------------------------------------------------------
function drawGround(c, area, cx, cy, tOverride){
  // A gathering node is a prop that can stand on any ground in the game, so
  // it cannot own a ground case of its own. It borrows the one its area is
  // built out of instead — otherwise the default arm paints grass, and a
  // salt crust on a beach comes with its own lawn.
  const t = tOverride!==undefined ? tOverride : tileAt(area,cx,cy);
  if(t===T.NODE) return drawGround(c, area, cx, cy, area.nodeGround || area.baseGround);
  const X=cx*TILE, Y=cy*TILE;
  // Device-space origin and tile size, for arms that have been redrawn at the
  // new density. An arm is converted by wrapping its body in withArt(ART) and
  // working in AX/AY/AT instead of X/Y/16.
  const AX=X*ART, AY=Y*ART, AT=TILE*ART;
  const h1=hash2(cx,cy), h2=hash2(cx+71,cy+13), h3=hash2(cx*3,cy*7);

  switch(t){
    case T.GRASS:
    case T.GRASS_TUFT:
    case T.FLOWERS: {
      withArt(ART, ()=>{
        // the clumping, from the baked patch — it ignores tile boundaries
        blitPatch(c,'grass',cx,cy,X,Y);
        // Blades. At this density a blade is a real object: two or three units
        // tall, dark at the root, catching the light at the tip. Sixteen of
        // them per tile, which at 16px would have been solid noise.
        for(let k=0;k<16;k++){
          const gx=(hash2(cx*13+k,cy*7)*(AT-2))|0, gy=(hash2(cx*5,cy*17+k)*(AT-4))|0;
          const v=hash2(cx*29+k,cy*11);
          const bh=2+((v*3)|0);
          tpx(c, C.grass1, AX+gx, AY+gy, 1, bh);
          tpx(c, v>0.6?C.grass4:C.grass3, AX+gx, AY+gy, 1, 1);
          if(v>0.86) tpx(c, C.grass5, AX+gx, AY+gy, 1, 1);
        }
        if(t===T.GRASS_TUFT){
          // a clump of taller grass, with the shadow it casts to its lower right
          const bx=AX+6+((h1*14)|0), by=AY+8+((h2*12)|0);
          tpx(c,C.shadow,bx+1,by+10,12,3);
          for(let k=0;k<10;k++){
            const bh=6+((hash2(cx+k,cy*3)*7)|0);
            const lean=Math.round((k-4.5)*0.4);
            tpx(c,C.grass1,bx+k,by+10-bh,1,bh);
            tpx(c,k<5?C.grass4:C.grass2,bx+k+lean,by+10-bh,1,2);
            if(k%3===0) tpx(c,C.grass5,bx+k+lean,by+10-bh,1,1);
          }
        }
        if(t===T.FLOWERS){
          const cols=[C.flowerR,C.flowerY,C.flowerB,C.flowerP,C.flowerW];
          for(let k=0;k<4;k++){
            const fx=AX+5+((hash2(cx*7+k,cy*5)*22)|0), fy=AY+7+((hash2(cx*3,cy*9+k)*20)|0);
            const col=cols[(hash2(cx+k,cy+k)*cols.length)|0];
            tpx(c,C.grass1,fx+2,fy+3,1,6);                 // stem
            tpx(c,C.grass3,fx+2,fy+3,1,2);
            tpx(c,dim(col),fx,fy,5,4);                     // petals, shaded right
            tpx(c,col,fx,fy,4,3);
            tpx(c,lit(col),fx+1,fy,2,1);                   // lit from upper left
            tpx(c,'#fff6d0',fx+2,fy+1,1,1);                // pollen
          }
        }
      });
      break;
    }
    case T.DRY: {
      withArt(ART, ()=>{
        blitPatch(c,'dry',cx,cy,X,Y);
        // dead stalks, bent the same way, catching light at the tip
        for(let k=0;k<18;k++){
          const gx=(hash2(cx*11+k,cy*19)*(AT-2))|0, gy=(hash2(cx*3,cy*23+k)*(AT-5))|0;
          const bh=2+((hash2(cx*7+k,cy)*4)|0);
          tpx(c, C.dryGrass1, AX+gx, AY+gy, 1, bh);
          tpx(c, C.dryGrass3, AX+gx, AY+gy, 1, 1);
        }
        if(h2>0.85){
          for(const [ox,hh] of [[12,12],[18,16],[22,9]]){
            tpx(c,C.dryGrass1, AX+ox, AY+AT-hh, 1, hh);
            tpx(c,lit(C.dryGrass3), AX+ox, AY+AT-hh, 1, 2);
          }
        }
      });
      break;
    }
    case T.DIRT: {
      withArt(ART, ()=>{
        // Turned earth: clods with a lit top face and a shadow under each,
        // rather than a flat fill with specks on it. The clods are what stop
        // a large dirt area reading as a brown rectangle.
        tpx(c,C.dirt2,AX,AY,AT,AT);
        if(h1>0.5) tpx(c,C.dirt3,AX,AY,AT,AT);
        for(let k=0;k<22;k++){
          const gx=(hash2(cx*3+k,cy*11)*(AT-3))|0, gy=(hash2(cx+k,cy*3)*(AT-3))|0;
          const v=hash2(cx*41+k,cy*7);
          const w=1+((v*3)|0);
          tpx(c,dim(C.dirt1), AX+gx, AY+gy+1, w, 1);     // its own shadow
          tpx(c,v>0.66?C.dirt4:C.dirt1, AX+gx, AY+gy, w, 1);
          if(v>0.86) tpx(c,lit(C.dirt4), AX+gx, AY+gy, 1, 1);
        }
      });
      break;
    }
    case T.PATH: {
      withArt(ART, ()=>{
        // Packed earth road. Two things make it read as a road rather than a
        // brown stripe: wheel ruts running along it, and embedded stones that
        // are lit on top and shadowed beneath. The ruts are continuous across
        // tiles because their position is seeded off the world row.
        tpx(c,C.path2,AX,AY,AT,AT);
        if(h1>0.5) tpx(c,C.path3,AX,AY,AT,AT);
        for(let k=0;k<3;k++){
          const ry = ((hash2(cy*13+k, 7)*AT)|0);
          tpx(c, dim(C.path1), AX, AY+ry, AT, 1);
          tpx(c, C.path3,      AX, AY+ry+1, AT, 1);
        }
        for(let k=0;k<14;k++){
          const gx=(hash2(cx*17+k,cy*5)*(AT-4))|0, gy=(hash2(cx*9,cy*13+k)*(AT-4))|0;
          const v=hash2(cx*31+k,cy*3);
          if(v>0.62){
            const w=2+((v*3)|0), hgt=1+((v*2)|0);
            tpx(c,'rgba(0,0,0,0.25)', AX+gx, AY+gy+hgt, w, 1);   // shadow under
            tpx(c,C.stone3, AX+gx, AY+gy, w, hgt);
            tpx(c,C.stone4, AX+gx, AY+gy, w-1, 1);               // lit top
            tpx(c,C.stone5, AX+gx, AY+gy, 1, 1);
          } else {
            tpx(c,C.path1, AX+gx, AY+gy, 2+((v*3)|0), 1);
          }
        }
      });
      break;
    }
    case T.GRAVEL: {
      withArt(ART, ()=>{
        tpx(c,C.dirt1,AX,AY,AT,AT);
        // every chip is a little solid with a top and a shadow
        for(let k=0;k<30;k++){
          const gx=(hash2(cx*17+k,cy*5)*(AT-3))|0, gy=(hash2(cx*9,cy*13+k)*(AT-3))|0;
          const v=hash2(cx*7+k,cy*23);
          const base = v>0.7?C.stone4 : v>0.4?C.stone3 : C.stone2;
          tpx(c, deep(base), AX+gx, AY+gy+1, 2, 2);
          tpx(c, base,       AX+gx, AY+gy,   2, 2);
          tpx(c, lit(base),  AX+gx, AY+gy,   1, 1);
        }
      });
      break;
    }
    case T.STONE: {
      withArt(ART, ()=>{
        // Cut flagstones, laid in a running bond. Each course gets a lit top
        // edge, a shaded bottom and a dark joint, so the floor has relief
        // rather than being a grid of rectangles.
        tpx(c,C.stone2,AX,AY,AT,AT);
        const off = (cy%2) ? AT/2 : 0;
        for(let r=0;r<2;r++){
          const y0 = AY + r*(AT/2) + 1, hh = AT/2 - 2;
          const x0 = AX + 1 - (r? off : 0);
          tpx(c,deep(C.stone2), x0, y0+hh, AT-2, 1);      // joint below
          tpx(c,C.stone3,       x0, y0,    AT-2, hh);
          tpx(c,lit(C.stone4),  x0, y0,    AT-3, 1);      // lit top
          tpx(c,lit(C.stone4),  x0, y0,    1,    hh-1);   // lit left
          tpx(c,dim(C.stone3),  x0+AT-3, y0+1, 1, hh-1);  // shaded right
        }
        if(h1>0.8){                                        // a chip out of one
          tpx(c,C.stone1, AX+8+((h2*12)|0), AY+6, 4, 2);
          tpx(c,deep(C.stone1), AX+8+((h2*12)|0), AY+8, 4, 1);
        }
      });
      break;
    }
    // --- THE IRON SCARP -----------------------------------------------------
    case T.SCREE: {
      withArt(ART, ()=>{
        // Broken rock: bigger, flatter chips than gravel, and warmer — the
        // mountains are brown-grey where the city is blue-grey, which keeps a
        // screenful of stone from reading as more Ironhaven. Every chip now
        // has a lit top edge and throws a shadow, so the slope has tooth.
        blitPatch(c,'scree',cx,cy,X,Y);
        for(let k=0;k<26;k++){
          const gx=(hash2(cx*17+k,cy*5)*(AT-5))|0, gy=(hash2(cx*9,cy*13+k)*(AT-5))|0;
          const v=hash2(cx*7+k,cy*23);
          const w=2+((v*4)|0), hh=2+((v*2)|0);
          const base = v>0.74?C.crag4 : v>0.42?C.crag3 : C.crag1;
          tpx(c,'rgba(0,0,0,0.28)', gx+AX+1, gy+AY+hh, w, 1);
          tpx(c, base,      AX+gx, AY+gy, w, hh);
          tpx(c, lit(base), AX+gx, AY+gy, w-1, 1);
          tpx(c, dim(base), AX+gx+w-1, AY+gy+1, 1, hh-1);
          if(v>0.9) tpx(c,C.crag5, AX+gx, AY+gy, 1, 1);
        }
      });
      break;
    }
    // --- THE RIVET SHOALS ---------------------------------------------------
    case T.SAND:
    case T.DUNEGRASS: {
      withArt(ART, ()=>{
        // Wind ripples, all running one way and continuous across tiles,
        // because the wind does not stop at a tile boundary. Each ripple has
        // a lit windward face and a shadow in its lee.
        blitPatch(c,'sand',cx,cy,X,Y);
        // Long, shallow ripples. Short high-contrast ones read as scattered
        // debris; sand is a smooth surface with a slow corrugation in it.
        for(let k=0;k<5;k++){
          const ry=(hash2(5, cy*11+k)*(AT-2))|0;
          const rx=(hash2(cx*3+k, cy*7)*AT)|0;
          const len=14+((hash2(cx*5+k,cy)*20)|0);
          tpx(c, C.shore3, AX+rx-len, AY+ry,   len, 1);
          tpx(c, mixHex(C.shore1,C.shore2,0.5), AX+rx-len, AY+ry+1, len, 1);
        }
        if(h2>0.86){                                  // a shell
          const sx=AX+10+((h1*12)|0), sy=AY+14;
          tpx(c,C.shore1,sx,sy+3,5,1);
          tpx(c,'#efe6d2',sx,sy,5,3);
          tpx(c,'#ffffff',sx+1,sy,2,1);
          tpx(c,C.shore1,sx+1,sy+1,3,1);
        }
        if(t===T.DUNEGRASS){
          // A clump, not a solid square — the old one was a block of flat
          // green and read as a tile rather than as plants in sand.
          const bx=AX+6+((h1*16)|0), by=AY+10+((h2*12)|0);
          tpx(c,'rgba(0,0,0,0.20)', bx-1, by+10, 14, 3);
          for(let k=0;k<12;k++){
            const bh=7+((hash2(cx+k,cy*3)*11)|0);
            const lean=Math.round((k-5.5)*0.55);
            tpx(c,'#5c6b3a', bx+k, by+10-bh, 1, bh);
            tpx(c,k%2?'#7d8a52':'#a8b473', bx+k+lean, by+10-bh, 1, 3);
          }
        }
      });
      break;
    }
    case T.WETSAND: {
      withArt(ART, ()=>{
        tpx(c,C.wet2,AX,AY,AT,AT);
        if(h1>0.45) tpx(c,C.wet1,AX,AY,AT,AT);
        for(let k=0;k<14;k++){
          const gx=(hash2(cx*13+k,cy*7)*(AT-4))|0, gy=(hash2(cx*5,cy*17+k)*(AT-1))|0;
          tpx(c, k%2?C.shore1:'#5a4c30', AX+gx, AY+gy, 2+((hash2(cx+k,cy)*3)|0), 1);
        }
        // The sheen of water still draining out of it — a broad wet band with
        // a bright leading edge, which is what makes it read as wet rather
        // than as a different colour of sand.
        const wy = AY+((h1*20)|0);
        tpx(c,'rgba(200,225,235,0.16)', AX, wy, AT, 6);
        tpx(c,'rgba(232,244,248,0.30)', AX, wy, AT, 1);
      });
      break;
    }
    case T.SURF: {
      // the break itself: water with foam that actually moves up the beach
      tpx(c,C.water3,X,Y,16,16);
      tpx(c,C.water2,X,Y+((h1*8)|0),16,4);
      const t2=(G.time*0.7 + cx*0.04)%1;
      const fy=Math.round(t2*14);
      tpx(c,C.foam, X, Y+fy, 16, 2);
      tpx(c,'rgba(232,244,248,0.45)', X, Y+fy+2, 16, 2);
      for(let k=0;k<4;k++)
        if(hash2(cx*3+k,cy+((t2*4)|0))>0.6) tpx(c,C.foam, X+k*4, Y+fy-1, 2, 1);
      break;
    }
    // --- THE VERGE ----------------------------------------------------------
    case T.TALLGRASS: {
      blitPatch(c,'grass',cx,cy,X,Y);
      for(let k=0;k<14;k++){
        const gx=(hash2(cx*13+k,cy*7)*15)|0;
        const bh=6+((hash2(cx*5,cy*17+k)*7)|0);
        const sway=Math.round(Math.sin(G.time*1.4+cx*0.5+k)*1);
        tpx(c,C.grass1, X+gx, Y+15-bh, 1, bh);
        tpx(c,k%3?C.grass4:C.grass5, X+gx+sway, Y+15-bh, 1, 2);
      }
      break;
    }
    case T.REEDS: {
      tpx(c,C.water2,X,Y,16,16);
      tpx(c,C.water1,X,Y+8,16,8);
      for(let k=0;k<7;k++){
        const gx=(hash2(cx*11+k,cy*3)*14)|0;
        const bh=9+((hash2(cx,cy*7+k)*6)|0);
        const sway=Math.round(Math.sin(G.time*1.1+k)*1);
        tpx(c,'#3f5a2a', X+gx, Y+15-bh, 1, bh);
        tpx(c,'#7d8a3c', X+gx+sway, Y+15-bh, 1, 3);
        if(k%3===0) tpx(c,'#6b4a2a', X+gx+sway, Y+13-bh, 2, 3);   // seed head
      }
      break;
    }
    case T.VOID: {
      // Unreachable ground outside an area's shape. It needs a case of its
      // own: the default arm below falls back to grass, which put a green
      // field around the outside of a city built in a crater.
      tpx(c,'#0b0910',X,Y,16,16);
      if(h1>0.88) tpx(c,'#141119',X+((h2*12)|0),Y+((h1*12)|0),3,2);
      break;
    }
    // --- THE GLIMMERVEIN ----------------------------------------------------
    case T.CAVEWALL:
    case T.GEMCLUSTER:
    case T.FLOWSTONE:
    case T.CAVEFLOOR: {
      withArt(ART, ()=>{
        // Dry, dark and uneven. Almost black, so anything glowing on it is
        // the only thing the eye has to look at — but with enough grain that
        // it is a floor rather than a void.
        blitPatch(c,'cave',cx,cy,X,Y);
        for(let k=0;k<7;k++){
          const gx=(hash2(cx*13+k,cy*7)*(AT-4))|0, gy=(hash2(cx*5,cy*17+k)*(AT-3))|0;
          const v=hash2(cx*23+k,cy*3);
          if(v<0.45) continue;
          tpx(c, C.cave1, AX+gx, AY+gy+1, 2+((v*4)|0), 1);   // crack shadow
          tpx(c, C.cave4, AX+gx, AY+gy,   2+((v*4)|0), 1);
        }
      });
      break;
    }
    case T.GEMVEIN: {
      // A thin seam threading through the floor. It is drawn as ONE broken
      // line rather than as bars filling the tile: four fat stripes per tile
      // tiled out into a floor of coloured rectangles, which is what a floor
      // of coloured rectangles looks like.
      const A = accentAt(cx,cy);
      const ph = G.time*1.6 + (cx*0.7+cy*1.3);
      tpx(c,C.cave1,X,Y,16,16);
      tpx(c,C.cave2,X,Y+1,16,15);
      if(h3>0.6) tpx(c,C.cave3, X+((h1*10)|0), Y+((h2*12)|0), 4, 2);
      // the seam wanders across the tile, one or two pixels thick
      let sy2 = 3 + ((h1*10)|0);
      for(let k=0;k<16;k+=2){
        sy2 = clamp(sy2 + (hash2(cx*17+k, cy*11) > 0.5 ? 1 : -1), 2, 13);
        tpx(c,A.a, X+k,   sy2+Y,   2, 2);
        tpx(c,A.b, X+k,   sy2+Y,   2, 1);
        if(hash2(cx+k,cy)>0.66) tpx(c,A.c, X+k, sy2+Y, 1, 1);
      }
      c.globalAlpha=0.10+0.06*Math.sin(ph);
      c.fillStyle=A.c;
      c.beginPath(); c.arc(X+8,Y+8,11,0,Math.PI*2); c.fill();
      c.globalAlpha=1;
      break;
    }

    // --- IRONHAVEN GROUND ---------------------------------------------------
    case T.COBBLE:
    case T.INLAY: {
      withArt(ART, ()=>{
        // Irregular setts. At this density each one is a real cut stone: a
        // rounded top face, a shadowed mortar gap on its lower-right, and a
        // catch of light on the upper-left corner. Eight across a tile rather
        // than four, so a street reads as paving instead of as a grid.
        tpx(c,C.cstone1,AX,AY,AT,AT);
        const N = 8, S = AT/N;                 // 8 setts of 4 units
        for(let j=0;j<N;j++) for(let i=0;i<N;i++){
          const n  = hash2(cx*N+i, cy*N+j);
          const ox = (hash2(cx*N+i+31, cy*N+j)*2)|0;
          const oy = (hash2(cx*N+i, cy*N+j+17)*2)|0;
          const col = n>0.78 ? C.cstone5 : n>0.46 ? C.cstone4 : n>0.18 ? C.cstone3 : C.cstone2;
          const x0 = AX+i*S+ox, y0 = AY+j*S+oy, w = S-1, hh = S-1;
          tpx(c, deep(col), x0, y0+1, w, hh);          // mortar shadow beneath
          tpx(c, col,       x0, y0,   w, hh);
          tpx(c, lit(col),  x0, y0,   w-1, 1);         // lit top face
          tpx(c, lit(col),  x0, y0,   1, hh-1);        // lit left face
          tpx(c, dim(col),  x0+w-1, y0+1, 1, hh-1);    // shaded right
          if(n>0.9) tpx(c, C.cstone6, x0, y0, 1, 1);
        }
        if(t===T.INLAY){
          // One sett replaced with cut aethite — the whole colour budget of
          // the street, and now with a bevel so it reads as set into the road.
          const A = accentAt(cx,cy);
          const i=(h1*(N-1))|0, j=(h2*(N-1))|0;
          const x0=AX+i*S, y0=AY+j*S, w=S*2-1;
          tpx(c,deep(A.d), x0, y0+1, w, w);
          tpx(c,A.d, x0, y0, w, w);
          tpx(c,A.b, x0+1, y0+1, w-2, w-2);
          tpx(c,A.c, x0+1, y0+1, w-3, 1);
          tpx(c,A.c, x0+1, y0+1, 1, w-3);
          tpx(c,glow(A.c), x0+1, y0+1, 1, 1);
          tpx(c,A.a, x0+w-2, y0+2, 1, w-4);
        }
      });
      break;
    }
    case T.LIFT:
    case T.IRONPLATE:
    case T.VENT: {
      withArt(ART, ()=>{
        // Riveted plate. The seams and the rivets do the work: a lit edge on
        // the top-left of every plate, a dark seam on the bottom-right, and a
        // rivet with its own highlight at each corner.
        tpx(c,C.iron2,AX,AY,AT,AT);
        const S2 = AT/2;
        for(let j=0;j<2;j++) for(let i=0;i<2;i++){
          const x0=AX+i*S2, y0=AY+j*S2;
          const v=hash2(cx*2+i, cy*2+j);
          const base = v>0.7 ? C.iron3 : C.iron2;
          tpx(c, base,      x0, y0, S2-1, S2-1);
          tpx(c, lit(base), x0, y0, S2-2, 1);
          tpx(c, lit(base), x0, y0, 1, S2-2);
          tpx(c, deep(C.iron1), x0+S2-1, y0, 1, S2);
          tpx(c, deep(C.iron1), x0, y0+S2-1, S2, 1);
          for(const [rx,ry] of [[2,2],[S2-4,2],[2,S2-4],[S2-4,S2-4]]){
            tpx(c, C.iron1, x0+rx, y0+ry, 2, 2);
            tpx(c, C.iron4, x0+rx, y0+ry, 1, 1);
          }
        }
        if(h1>0.9) tpx(c,C.rust3, AX+((h2*20)|0), AY+((h3*20)|0), 3, 2);
      });
      break;
    }
    case T.WATER: {
      withArt(ART, ()=>{
        // Depth first, then movement on top of it. The old tile was one flat
        // blue with a band across it; water reads as water when there is
        // something UNDER the surface as well as on it.
        tpx(c,C.water2,AX,AY,AT,AT);
        for(let k=0;k<4;k++){                      // slow dark swells
          const wy=(hash2(cx*3+k, cy*7)*AT)|0;
          tpx(c,C.water1, AX, AY+wy, AT, 2+((hash2(cx,cy+k)*3)|0));
        }
        // Shimmer: short bright dashes that drift, phase seeded off world
        // position so the whole lake does not blink in unison.
        for(let k=0;k<5;k++){
          const ph = G.time*1.3 + (cx*0.6+cy*0.35) + k*1.7;
          const s2 = Math.sin(ph);
          if(s2 < 0.1) continue;
          const sy=(hash2(cx*11+k, cy*5)*(AT-2))|0;
          const sx2=((hash2(cx*7, cy*13+k)*AT) + Math.sin(ph*0.7)*4)|0;
          const len=3+((s2*7)|0);
          tpx(c,C.water4, AX+sx2, AY+sy, len, 1);
          if(s2>0.8) tpx(c,C.water5, AX+sx2+1, AY+sy, Math.max(1,len-2), 1);
        }
      });
      break;
    }
    case T.SHALLOW: {
      withArt(ART, ()=>{
        // You can see the bottom: sand showing through, and the light on the
        // surface broken up by it.
        tpx(c,C.water3,AX,AY,AT,AT);
        for(let k=0;k<9;k++){
          const gx=(hash2(cx*13+k,cy*3)*(AT-4))|0, gy=(hash2(cx,cy+k)*(AT-2))|0;
          tpx(c, k%2?C.sand2:C.sand1, AX+gx, AY+gy, 2+((hash2(cx+k,cy)*4)|0), 1);
        }
        tpx(c,'rgba(168,224,242,0.25)', AX, AY, AT, 2);
        const sh = Math.sin(G.time*2.2 + cx*0.8);
        if(sh>0){
          const sx2=AX+4+((h1*18)|0), sy=AY+8+((h2*10)|0);
          tpx(c,C.water5, sx2, sy, 5+((sh*5)|0), 1);
          tpx(c,C.foam,   sx2+1, sy, 2, 1);
        }
      });
      break;
    }
    case T.FLOOR_WOOD: {
      withArt(ART, ()=>{
        // Planks running horizontally with staggered joints. Each board gets a
        // lit upper edge and a dark shadow line under it, so the floor has
        // thickness — flat bands of two browns read as wallpaper.
        tpx(c,C.wood3,AX,AY,AT,AT);
        const PH2 = 8;                               // a board, in device units
        for(let r=0;r*PH2<AT;r++){
          const y0=AY+r*PH2;
          const base = (r%2) ? C.wood3 : C.wood4;
          tpx(c, base,           AX, y0,      AT, PH2);
          tpx(c, lit(base),      AX, y0,      AT, 1);
          tpx(c, deep(C.wood2),  AX, y0+PH2-1,AT, 1);
          // grain: a couple of long faint strokes along the board
          for(let k=0;k<2;k++){
            const gy=y0+2+((hash2(cx*7+r*3+k, cy*11)*4)|0);
            const gx=(hash2(cx*5+k, cy*13+r)*AT)|0;
            tpx(c, dim(base), AX+gx-10, gy, 10+((hash2(cx+k,cy+r)*12)|0), 1);
          }
        }
        // the butt joint between boards, offset row to row
        const jx = (cy%2) ? 9 : 22;
        tpx(c, deep(C.wood1), AX+jx, AY, 1, AT);
        tpx(c, lit(C.wood4),  AX+jx+1, AY, 1, AT);
        if(h1>0.7){                                   // a knot
          const kx=AX+4+((h2*20)|0), ky=AY+3+((h1*22)|0);
          tpx(c,C.wood2, kx, ky, 3, 2);
          tpx(c,C.wood1, kx+1, ky, 1, 1);
        }
      });
      break;
    }
    case T.RUG: {
      withArt(ART, ()=>{
        // A woven rug rather than four squares inside each other: a fringe on
        // the short edges, a border, and a repeating figure in the field.
        tpx(c,C.wood3,AX,AY,AT,AT);
        tpx(c,'#6b2438',AX,AY,AT,AT);
        tpx(c,'#8a3550',AX+1,AY+1,AT-2,AT-2);
        tpx(c,'#5a1c2c',AX+1,AY+AT-3,AT-2,2);        // shadow along the lower edge
        // border
        tpx(c,'#d9b45a',AX+3,AY+3,AT-6,1);
        tpx(c,'#d9b45a',AX+3,AY+AT-4,AT-6,1);
        tpx(c,'#d9b45a',AX+3,AY+3,1,AT-6);
        tpx(c,'#d9b45a',AX+AT-4,AY+3,1,AT-6);
        // the figure, four to a tile so it is a pattern and not a target
        for(let j=0;j<2;j++) for(let i=0;i<2;i++){
          const x0=AX+7+i*11, y0=AY+7+j*11;
          tpx(c,'#b04a6a',x0,y0,6,6);
          tpx(c,'#d9b45a',x0+1,y0+1,4,4);
          tpx(c,'#8a3550',x0+2,y0+2,2,2);
        }
        // the woven nap, a light direction across the whole rug
        for(let k=0;k<10;k++){
          const gy=(hash2(cx*3+k,cy*7)*AT)|0;
          tpx(c,'rgba(255,255,255,0.05)',AX+1,AY+gy,AT-2,1);
        }
      });
      break;
    }
    default: {
      // anything else sits on whatever ground its area uses. A prop with no
      // ground case of its own — a boulder, say — otherwise lands on grass,
      // which is right in three zones and put a lawn under every rock in a
      // cave four hundred feet underground.
      if(area.baseGround===T.CAVEWALL){
        tpx(c,C.cave1,X,Y,16,16);
        tpx(c,C.cave2,X+((h1*4)|0),Y+((h2*4)|0),16-((h1*4)|0),16-((h2*4)|0));
        if(h3>0.72) tpx(c,C.cave3, X+2+((h1*8)|0), Y+3+((h2*8)|0), 3+((h3*4)|0), 2);
        break;
      }
      tpx(c, area.baseGround===T.FLOOR_WOOD ? C.wood3 : C.grass2, X,Y,16,16);
      if(area.baseGround===T.FLOOR_WOOD){
        tpx(c,C.wood4,X,Y,16,4); tpx(c,C.wood4,X,Y+8,16,4);
        tpx(c,C.wood2,X,Y+3,16,1); tpx(c,C.wood2,X,Y+7,16,1);
        tpx(c,C.wood2,X,Y+11,16,1); tpx(c,C.wood2,X,Y+15,16,1);
      } else {
        for(let k=0;k<8;k++){
          const gx=(hash2(cx*13+k,cy*7)*15)|0, gy=(hash2(cx*5,cy*17+k)*15)|0;
          tpx(c, k%3?C.grass4:C.grass1, X+gx, Y+gy, 1, 1);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// EDGE TRANSITIONS — soften the seam wherever two ground families meet
// ---------------------------------------------------------------------------
function drawGroundEdges(c, area, cx, cy){
  const here = GROUND_FAM[tileAt(area,cx,cy)];
  if(!here || !FAM[here]) return;
  const AX=cx*TILE*ART, AY=cy*TILE*ART, AT=TILE*ART;

  // the eight neighbours, as families
  const f = (dx,dy)=>GROUND_FAM[tileAt(area,cx+dx,cy+dy)] || 0;
  const N=f(0,-1), S=f(0,1), W=f(-1,0), E=f(1,0);
  const NW=f(-1,-1), NE=f(1,-1), SW=f(-1,1), SE=f(1,1);

  withArt(ART, ()=>{
    // --- water is the exception: the bright line belongs to the water, not
    // to the shore. Painted first so a drift or turf fringe can lie over it.
    if(here===4){
      const mine=FAM[4];
      if(N && N!==4) tpx(c,mine.a(),AX,AY,AT,2);
      if(S && S!==4) tpx(c,mine.b(),AX,AY+AT-2,AT,2);
      if(W && W!==4) tpx(c,mine.a(),AX,AY,2,AT);
      if(E && E!==4) tpx(c,mine.b(),AX+AT-2,AY,2,AT);
      // and a wet darkening just inside, so the line is not a stripe on flat blue
      if(N && N!==4) tpx(c,dim(C.water2),AX,AY+2,AT,1);
      if(S && S!==4) tpx(c,dim(C.water2),AX,AY+AT-3,AT,1);
    }

    // --- everything else: the higher-ranked neighbour spills onto me
    const mine = FAM[here];
    const edge = (nf, side) => {
      if(!nf || nf===here) return;
      const o = FAM[nf];
      if(!o || o.rank <= mine.rank) return;
      fringe(c, o, AX, AY, AT, side, cx, cy);
    };
    edge(N,'n'); edge(S,'s'); edge(W,'w'); edge(E,'e');

    // --- corners. Without these a transition reads as a cross: the four
    // sides fringe and the corners stay bare, which is the most tilemap-
    // looking thing a tilemap can do.
    const corner = (nf, dx, dy) => {
      if(!nf || nf===here) return;
      const o = FAM[nf];
      if(!o || o.rank <= mine.rank) return;
      cornerFringe(c, o, AX, AY, AT, dx, dy, cx, cy);
    };
    corner(NW,-1,-1); corner(NE,1,-1); corner(SW,-1,1); corner(SE,1,1);
  });
}

// One edge of one tile, fringed with the material that overhangs it. All
// coordinates are device units — this is only ever called from inside a
// withArt(ART) block.
function fringe(c, o, AX, AY, AT, side, cx, cy){
  const d = o.depth, A = o.a(), B = o.b();
  const horiz = side==='n' || side==='s';
  const at = (i, k) => {                       // i along the edge, k into the tile
    if(side==='n') return [AX+i, AY+k];
    if(side==='s') return [AX+i, AY+AT-1-k];
    if(side==='w') return [AX+k, AY+i];
    return [AX+AT-1-k, AY+i];
  };
  for(let i=0;i<AT;i++){
    // a stable per-unit depth, seeded off world position so two tiles sharing
    // an edge agree about where the bumps are
    const seed = horiz ? hash2(cx*31+i, cy*17+(side==='n'?0:9))
                       : hash2(cx*13+(side==='w'?0:9), cy*29+i);
    let run;
    switch(o.style){
      case 'turf':  run = 2 + ((seed*d)|0); break;
      case 'drift': run = (seed>0.34) ? 1+((seed*(d-1))|0) : 0; break;
      case 'wash':  run = (seed>0.2) ? 1+((seed*2)|0) : 1; break;
      default:      run = 1; break;            // 'hard'
    }
    // Outermost unit first, against the neighbour: that is the lip and it
    // catches the light. Everything behind it is the body of the material,
    // and the last unit is the shadow it throws onto the tile it overhangs.
    for(let k=0;k<run;k++){
      const [px2,py2] = at(i,k);
      tpx(c, k===0 ? B : A, px2, py2, 1, 1);
    }
    if(run>0 && o.style!=='hard'){
      const [sx2,sy2] = at(i,run);
      tpx(c, 'rgba(0,0,0,0.22)', sx2, sy2, 1, 1);
    }
    // turf throws the odd blade a unit past its own shadow
    if(o.style==='turf' && run>1 && seed>0.66){
      const [px2,py2] = at(i,run+1);
      tpx(c, A, px2, py2, 1, 1);
    }
  }
}

// The little wedge in a corner, for when a diagonal neighbour overhangs but
// neither of the two sides beside it does.
function cornerFringe(c, o, AX, AY, AT, dx, dy, cx, cy){
  const d = Math.max(2, o.depth-1), A = o.a(), B = o.b();
  for(let j=0;j<d;j++) for(let i=0;i<d-j;i++){
    if(hash2(cx*7+i, cy*11+j) < 0.28) continue;
    const px2 = dx<0 ? AX+i : AX+AT-1-i;
    const py2 = dy<0 ? AY+j : AY+AT-1-j;
    tpx(c, (i+j)===0 ? B : A, px2, py2, 1, 1);
  }
}

// ---------------------------------------------------------------------------
// PROPS
// ---------------------------------------------------------------------------
// Stage 3 of the art migration. Every prop below is authored at ART density —
// a 16-world-unit tile is 32 authored units — inside withArt(ART). The two
// functions set AX/AY once and the arms work in authored units from there, so
// an arm reads the same as it did at 1x except that every number is twice as
// large and there is room between them for detail that would not fit before.
//
// Three things are deliberately NOT in authored units:
//   * c.arc / c.fillRect glow pools, which go through the context transform
//     and are therefore already in world units. They stay in X,Y.
//   * G.time phases, which are seconds.
//   * hash2 seeds, which are tile coordinates.
//
// The shared painters come first. Before this pass every prop open-coded its
// own wood, iron and stone, which is why no two crates in the game were lit
// from the same direction. Now a plank is a plank everywhere.
// ---------------------------------------------------------------------------

// A contact shadow. A filled rectangle under a prop is the loudest 8-bit tell
// in a frame — nothing in the world casts a rectangle. This is an ellipse,
// drawn as horizontal runs so it stays pixel art, and it fades at the rim.
function propShadow(c, x0, y0, w, h){
  const rx = w/2, ry = h/2, mx = x0+rx;
  for(let j=0;j<h;j++){
    const dy = (j+0.5-ry)/ry, s = 1-dy*dy;
    if(s<=0) continue;
    const half = Math.round(rx*Math.sqrt(s));
    if(half<1) continue;
    const a = 0.30*(0.40+0.60*s);
    tpx(c,'rgba(14,9,18,'+a.toFixed(3)+')', Math.round(mx-half), y0+j, half*2, 1);
  }
}

// Wood. Five-value ramp, lit along the top and the left, with grain lines
// that are seeded by position so the same crate always has the same grain.
function woodBody(c, x, y, w, h, seed, pal){
  const P = pal || [C.wood1,C.wood2,C.wood3,C.wood4,C.wood5];
  tpx(c,P[0], x,   y,   w,   h);
  tpx(c,P[1], x,   y,   w-1, h-1);
  tpx(c,P[2], x+1, y+1, w-3, h-3);
  tpx(c,P[3], x+1, y+1, w-3, 2);
  tpx(c,P[4], x+1, y+1, Math.max(2,(w/3)|0), 1);
  const lines = Math.max(1, (h/7)|0);
  for(let g=0; g<lines; g++){
    const gy = y+4+g*6+((hash2(seed+g, g*3)*3)|0);
    if(gy > y+h-3) break;
    tpx(c,P[1], x+2+((hash2(seed,g)*4)|0), gy,
        Math.max(3, w-5-((hash2(g,seed)*5)|0)), 1);
  }
}

// Iron. Cold, near-black, with one bright edge. Deliberately less textured
// than wood: the contrast between the two is what sells either of them.
function ironBody(c, x, y, w, h){
  tpx(c,C.iron1, x,   y,   w,   h);
  tpx(c,C.iron2, x,   y,   w-1, h-1);
  tpx(c,C.iron3, x+1, y+1, Math.max(1,(w*0.45)|0), h-3);
  tpx(c,C.iron4, x+1, y+1, Math.max(1,(w*0.22)|0), Math.max(1,h-4));
}

// A row of rivets. Two units each, with the light nick in the upper left,
// which is the whole reason they read as domed rather than as dots.
function rivets(c, x, y, w, n){
  for(let k=0;k<n;k++){
    const rx = x + Math.round(k*(w-2)/Math.max(1,n-1));
    tpx(c,C.iron1, rx, y, 2, 2);
    tpx(c,C.iron4, rx, y, 1, 1);
  }
}

// Coursed masonry: blocks of uneven width, a one-unit joint between them,
// each block lit on its top and left faces. p = [joint, body, top, left].
// The variation is positional, so a wall doesn't shimmer as the camera moves.
function masonry(c, x, y, w, h, p, seed, course){
  const ch = course || 7;
  tpx(c,p[0], x, y, w, h);
  for(let row=0; row*ch < h; row++){
    const ry = y+row*ch, rh = Math.min(ch-1, h-row*ch);
    if(rh < 2) break;
    let bx = x - ((hash2(seed+row, row*3)*11)|0);
    while(bx < x+w){
      const bw = 9+((hash2(bx*3+seed, row*5)*8)|0);
      const x0 = Math.max(x, bx), x1 = Math.min(x+w, bx+bw-1);
      if(x1 > x0){
        tpx(c,p[1], x0, ry, x1-x0, rh-1);
        tpx(c,p[2], x0, ry, x1-x0, 1);
        tpx(c,p[3], x0, ry, 1, rh-1);
      }
      bx += bw;
    }
  }
}

// A leafy mass. Returns nothing and paints four passes: silhouette, body,
// mid-tone, and a sunlit crown in the upper left, plus a few clumps hung off
// the outline so the shape doesn't read as an oval.
function canopy(c, mx, top, rw, rh, seed, pal){
  const P = pal || [C.leaf1,C.leaf2,C.leaf3,C.leaf4,C.leaf5];
  const rows = [];
  for(let j=0;j<rh;j++){
    const t = (j+0.5)/rh;
    const s = Math.sin(Math.pow(t,0.70)*Math.PI);
    let half = Math.round(rw*0.5*s);
    half += ((hash2(seed+j, j*5)*3)|0) - 1;          // a lumpy outline
    if(half < 1) continue;
    rows.push([j, half]);
  }
  for(const [j,half] of rows) tpx(c,P[0], mx-half,   top+j, half*2,   1);
  for(const [j,half] of rows) if(half>3) tpx(c,P[1], mx-half+1, top+j, half*2-2, 1);
  for(const [j,half] of rows)
    if(j < rh*0.62 && half>5) tpx(c,P[2], mx-half+2, top+j, half*2-6, 1);
  // the crown, upper-left, where the light is
  for(const [j,half] of rows){
    if(j > rh*0.42 || half < 5) continue;
    const w = Math.max(2, half-3);
    tpx(c,P[3], mx-half+2, top+j, w, 1);
  }
  tpx(c,P[4], mx-Math.round(rw*0.22), top+Math.round(rh*0.16), 3, 2);
  // clumps breaking the silhouette
  for(let k=0;k<4;k++){
    const a = hash2(seed*3+k, k*7), b = hash2(k*5, seed+k);
    const j = 2+((b*(rh-4))|0);
    const row = rows.find(r=>r[0]===j);
    if(!row) continue;
    const side = a>0.5 ? 1 : -1;
    tpx(c,P[a>0.5?0:1], mx+side*row[1]-(side>0?0:3), top+j, 4, 3);
  }
}

// ---------------------------------------------------------------------------
// PROPS — ground layer (trunks, bases, bodies)
// ---------------------------------------------------------------------------
function drawPropBase(c, area, cx, cy){
  const t = tileAt(area,cx,cy), X=cx*TILE, Y=cy*TILE;
  const h1=hash2(cx,cy), h2=hash2(cx+41,cy+17);
  const AX = X*ART, AY = Y*ART, S = ART*TILE;   // S: a tile in authored units

  withArt(ART, () => {
  switch(t){
    case T.TREE: {
      propShadow(c, AX+2, AY+22, 28, 10);
      // A trunk with a root flare and bark running up it. It is kept short
      // and thick: a long thin trunk with a ball on top is a lollipop, which
      // is exactly what the 1x art read as.
      tpx(c,C.bark1, AX+10, AY+2,  13, 30);
      tpx(c,C.bark2, AX+11, AY+2,  10, 30);
      tpx(c,C.bark3, AX+11, AY+2,   6, 30);
      tpx(c,C.bark4, AX+11, AY+2,   3, 30);
      for(let k=0;k<6;k++){
        const gy = AY+6+k*4;
        tpx(c,C.bark1, AX+12+((hash2(cx+k,cy)*7)|0), gy, 2, 3);
      }
      tpx(c,C.bark2, AX+8,  AY+26, 17, 6);          // root flare
      tpx(c,C.bark1, AX+8,  AY+29,  4, 3);
      tpx(c,C.bark1, AX+21, AY+29,  4, 3);
      tpx(c,C.bark3, AX+9,  AY+26,  6, 2);
      break;
    }
    case T.STUMP: {
      propShadow(c, AX+3, AY+23, 26, 9);
      tpx(c,C.bark1, AX+5,  AY+8,  23, 22);         // the side, in shadow
      tpx(c,C.bark2, AX+6,  AY+8,  21, 22);
      for(let k=0;k<5;k++)                          // bark ridges
        tpx(c,C.bark1, AX+7+k*4, AY+12, 2, 18);
      tpx(c,C.bark3, AX+5,  AY+6,  23, 8);          // the cut face, seen flat
      tpx(c,C.bark4, AX+7,  AY+6,  19, 6);
      tpx(c,C.bark3, AX+11, AY+7,  11, 4);          // growth rings
      tpx(c,C.bark2, AX+14, AY+8,   5, 2);
      tpx(c,C.leaf1, AX+4,  AY+22,  6, 5);          // moss on the shaded side
      tpx(c,C.leaf2, AX+4,  AY+22,  5, 3);
      break;
    }
    case T.BUSH: {
      propShadow(c, AX+2, AY+23, 28, 8);
      // Three overlapping masses rather than one, so it reads as a shrub and
      // not as a green egg. The two behind are darker and are drawn first.
      canopy(c, AX+9,  AY+13, 18, 15, cx*5+cy*3, [C.leaf1,C.leaf1,C.leaf2,C.leaf2,C.leaf3]);
      canopy(c, AX+24, AY+15, 16, 14, cx+cy*7,   [C.leaf1,C.leaf1,C.leaf2,C.leaf2,C.leaf3]);
      canopy(c, AX+16, AY+9,  26, 21, cx*3+cy);
      if(h1>0.6){
        tpx(c,C.flowerR, AX+18, AY+16, 3, 3);
        tpx(c,C.flowerR, AX+10, AY+22, 3, 3);
        tpx(c,C.flowerW, AX+21, AY+23, 2, 2);
      }
      break;
    }
    case T.ROCK: {
      propShadow(c, AX+1, AY+21, 30, 10);
      // a boulder built from runs: silhouette, body, lit cap, then a crack
      const R=[];
      for(let j=0;j<22;j++){
        const t2=(j+0.5)/22, s=Math.sin(Math.pow(t2,0.55)*Math.PI*0.92+0.16);
        R.push([j, Math.max(2, Math.round(14*s) + ((hash2(cx+j,cy)*3)|0) - 1)]);
      }
      for(const [j,half] of R) tpx(c,C.stone1, AX+16-half, AY+8+j, half*2, 1);
      for(const [j,half] of R) if(half>4) tpx(c,C.stone2, AX+16-half+2, AY+8+j, half*2-4, 1);
      for(const [j,half] of R) if(j<9 && half>6) tpx(c,C.stone3, AX+16-half+3, AY+8+j, half*2-9, 1);
      tpx(c,C.stone4, AX+8,  AY+10, 7, 2);
      tpx(c,C.stone4, AX+10, AY+9,  4, 1);
      tpx(c,C.stone1, AX+18, AY+16, 8, 3);          // a shaded fold
      tpx(c,C.stone1, AX+13, AY+20, 3, 8);          // the crack
      if(h2>0.6){ tpx(c,C.grass3, AX+3, AY+25, 6, 2); tpx(c,C.grass4, AX+22, AY+25, 6, 2); }
      break;
    }
    case T.FENCE: {
      propShadow(c, AX+1, AY+25, 30, 7);
      for(const px2 of [AX+2, AX+24]){             // posts
        woodBody(c, px2, AY+8, 6, 22, cx+px2);
        tpx(c,C.wood1, px2, AY+8, 6, 1);
      }
      for(const ry of [AY+12, AY+20]){             // rails, all the way across
        tpx(c,C.wood1, AX, ry+4, S, 1);
        tpx(c,C.wood2, AX, ry,   S, 4);
        tpx(c,C.wood4, AX, ry,   S, 1);
        tpx(c,C.wood3, AX+2+((h1*8)|0), ry+2, 9, 1);
      }
      break;
    }
    case T.CRATE: {
      propShadow(c, AX+1, AY+24, 30, 8);
      woodBody(c, AX+2, AY+6, 28, 24, cx*5+cy);
      tpx(c,C.wood1, AX+2,  AY+17, 28, 2);          // mid rail
      tpx(c,C.wood4, AX+2,  AY+17, 28, 1);
      tpx(c,C.wood1, AX+15, AY+8,  2, 22);          // upright
      tpx(c,C.wood4, AX+15, AY+8,  1, 22);
      tpx(c,C.brass2, AX+12, AY+14, 8, 6);          // stencilled brass plate
      tpx(c,C.brass4, AX+12, AY+14, 8, 1);
      tpx(c,C.brass1, AX+14, AY+16, 4, 2);
      break;
    }
    case T.BARREL: {
      propShadow(c, AX+3, AY+25, 26, 7);
      // staves: a cylinder is sold by the vertical ramp across its width
      tpx(c,C.wood1, AX+5,  AY+4, 22, 27);
      tpx(c,C.wood2, AX+6,  AY+5, 20, 25);
      tpx(c,C.wood3, AX+8,  AY+5, 13, 25);
      tpx(c,C.wood4, AX+9,  AY+5,  6, 25);
      tpx(c,C.wood5, AX+10, AY+5,  2, 25);
      for(let k=0;k<5;k++) tpx(c,C.wood1, AX+8+k*4, AY+5, 1, 25);
      for(const by of [AY+9, AY+23]){               // hoops
        tpx(c,C.iron1, AX+5, by,   22, 4);
        tpx(c,C.iron3, AX+5, by,   22, 2);
        tpx(c,C.iron4, AX+5, by,   22, 1);
      }
      tpx(c,C.wood5, AX+7,  AY+3, 18, 4);           // the lid, seen from above
      tpx(c,C.wood4, AX+9,  AY+3, 12, 2);
      tpx(c,C.wood1, AX+7,  AY+3, 18, 1);
      break;
    }
    case T.PIPE: {
      propShadow(c, AX, AY+25, S, 7);
      // a cylinder lying across the tile: the ramp runs top to bottom
      tpx(c,C.iron1, AX, AY+6,  S, 21);
      tpx(c,C.iron2, AX, AY+8,  S, 17);
      tpx(c,C.iron3, AX, AY+9,  S, 9);
      tpx(c,C.iron4, AX, AY+10, S, 4);
      tpx(c,'#9b9ba6', AX, AY+11, S, 1);            // specular line
      tpx(c,C.rust2, AX+((h1*16)|0), AY+15, 10, 8);
      tpx(c,C.rust1, AX+((h1*16)|0), AY+21, 10, 2);
      // a flanged joint, with bolts
      tpx(c,C.brass2, AX+10, AY+4,  10, 25);
      tpx(c,C.brass3, AX+11, AY+8,  8,  11);
      tpx(c,C.brass4, AX+10, AY+4,  10, 2);
      for(let k=0;k<4;k++) tpx(c,C.brass1, AX+11, AY+7+k*6, 8, 1);
      break;
    }
    case T.PLANTER: {
      propShadow(c, AX+1, AY+25, 30, 7);
      woodBody(c, AX+2, AY+16, 28, 14, cx+cy*3);
      tpx(c,C.wood1, AX+2, AY+16, 28, 2);
      tpx(c,C.dirt1, AX+4, AY+12, 24, 6);           // soil
      tpx(c,C.dirt2, AX+5, AY+12, 22, 2);
      for(let k=0;k<5;k++){
        const fx = AX+7+k*5, fy = AY+6+((hash2(cx+k,cy)*6)|0);
        tpx(c,C.leaf1, fx,   fy+2, 2, 9);
        tpx(c,C.leaf3, fx,   fy+2, 1, 9);
        tpx(c,C.leaf2, fx-2, fy+6, 3, 2);           // a leaf off the stem
        const fc = [C.flowerR,C.flowerY,C.flowerP,C.flowerB,C.flowerW][k];
        tpx(c,shade(fc,0.70), fx-2, fy-2, 6, 5);
        tpx(c,fc,             fx-2, fy-2, 5, 4);
        tpx(c,shade(fc,1.35), fx-1, fy-1, 2, 1);
      }
      break;
    }
    case T.WELL: {
      propShadow(c, AX, AY+23, S, 9);
      masonry(c, AX+2, AY+12, 28, 19,
              [C.stone1,C.stone2,C.stone4,C.stone3], cx*7+cy, 7);
      tpx(c,C.stone1, AX+2, AY+12, 28, 2);          // coping
      tpx(c,C.stone4, AX+2, AY+11, 28, 2);
      tpx(c,C.stone5, AX+3, AY+11, 26, 1);
      tpx(c,'#0b1420', AX+8, AY+14, 16, 9);         // the shaft
      tpx(c,C.water1, AX+9, AY+16, 14, 6);
      tpx(c,C.water2, AX+10, AY+17, 12, 4);
      tpx(c,C.water4, AX+12, AY+18, 6, 1);
      tpx(c,C.water5, AX+13, AY+18, 2, 1);
      break;
    }
    case T.CART: {
      propShadow(c, AX, AY+24, S, 8);
      woodBody(c, AX+2, AY+8, 28, 16, cx*3+cy*5);
      tpx(c,C.wood1, AX+2, AY+8, 28, 1);
      for(const wx of [AX+4, AX+20]){               // wheels, spoked
        tpx(c,C.iron1, wx,   AY+22, 9, 9);
        tpx(c,C.iron2, wx+1, AY+23, 7, 7);
        tpx(c,C.iron3, wx+2, AY+24, 5, 5);
        tpx(c,C.iron1, wx+4, AY+23, 1, 7);
        tpx(c,C.iron1, wx+1, AY+26, 7, 1);
        tpx(c,C.brass3, wx+4, AY+26, 2, 2);
      }
      tpx(c,C.dryGrass1, AX+7, AY+2,  18, 7);       // the load
      tpx(c,C.dryGrass2, AX+8, AY+2,  16, 5);
      tpx(c,C.dryGrass3, AX+10,AY+2,  10, 2);
      for(let k=0;k<5;k++) tpx(c,C.dryGrass1, AX+8+k*4, AY+3, 1, 5);
      break;
    }
    case T.TABLE: {
      propShadow(c, AX+1, AY+25, 30, 7);
      tpx(c,C.wood1, AX+5,  AY+22, 6, 9);           // legs
      tpx(c,C.wood2, AX+5,  AY+22, 5, 9);
      tpx(c,C.wood1, AX+22, AY+22, 6, 9);
      tpx(c,C.wood2, AX+22, AY+22, 5, 9);
      woodBody(c, AX, AY+10, S, 13, cx+cy);         // the top
      tpx(c,C.wood1, AX, AY+22, S, 2);              // the edge, in shadow
      if(h1>0.5){
        tpx(c,C.plaster1, AX+6,  AY+6, 11, 7);      // a bowl
        tpx(c,C.plaster3, AX+7,  AY+6,  9, 5);
        tpx(c,C.plaster4, AX+8,  AY+6,  5, 2);
        tpx(c,C.plaster2, AX+6,  AY+11, 11, 2);
        tpx(c,C.brass2,   AX+20, AY+4,  7, 10);     // a mug
        tpx(c,C.brass3,   AX+21, AY+5,  5, 8);
        tpx(c,C.brass4,   AX+21, AY+5,  2, 8);
        tpx(c,C.brass2,   AX+26, AY+7,  3, 4);      // its handle
      }
      break;
    }
    case T.BED: {
      propShadow(c, AX+1, AY+27, 30, 5);
      tpx(c,C.wood1, AX+2, AY+4, 28, 27);           // frame
      tpx(c,C.wood2, AX+3, AY+5, 26, 25);
      tpx(c,C.wood4, AX+2, AY+4, 28, 2);
      tpx(c,'#c2c5d4', AX+5, AY+6, 22, 10);         // pillow
      tpx(c,'#d8dae6', AX+5, AY+6, 21, 8);
      tpx(c,'#f0f2fa', AX+6, AY+6, 18, 4);
      tpx(c,'#2b4576', AX+4, AY+15, 24, 15);        // blanket
      tpx(c,'#3a5f9c', AX+4, AY+15, 24, 13);
      tpx(c,'#4f7cc4', AX+4, AY+15, 24, 3);
      for(let k=0;k<4;k++) tpx(c,'#31518a', AX+5, AY+19+k*3, 22, 1);
      tpx(c,'#2b4576', AX+4, AY+27, 24, 2);
      break;
    }
    case T.HEARTH: {
      masonry(c, AX, AY+4, S, 28,
              [C.stone1,C.stone2,C.stone4,C.stone3], cx*11+cy, 8);
      tpx(c,'#120a06', AX+6, AY+14, 20, 18);        // firebox
      tpx(c,'#1f120a', AX+7, AY+15, 18, 16);
      // live fire: three tongues on their own phase
      const f = G.time*9 + cx;
      for(let k=0;k<4;k++){
        const fx = AX+8+k*5+Math.round(Math.sin(f+k*2)*2);
        const fh = 9+Math.round(Math.sin(f*1.4+k)*4);
        tpx(c,C.rust3,  fx,   AY+31-fh, 4, fh);
        tpx(c,C.amber2, fx,   AY+32-fh, 4, fh-1);
        tpx(c,C.amber3, fx+1, AY+34-fh, 2, fh-3);
        if(k%2) tpx(c,C.amber5, fx+1, AY+36-fh, 1, 2);
      }
      tpx(c,C.amber1, AX+7, AY+28, 18, 3);          // coals
      tpx(c,C.amber2, AX+9, AY+29, 12, 2);
      tpx(c,C.stone1, AX, AY+1, S, 5);              // mantel
      tpx(c,C.stone4, AX, AY+1, S, 3);
      tpx(c,C.stone5, AX, AY+1, S, 1);
      break;
    }
    case T.SHELF: {
      propShadow(c, AX+1, AY+27, 30, 5);
      tpx(c,C.wood1, AX+2, AY+2, 28, 29);
      tpx(c,C.wood2, AX+3, AY+3, 26, 27);
      tpx(c,C.wood4, AX+2, AY+2, 28, 1);
      for(const sy of [AY+13, AY+23]){              // shelf boards
        tpx(c,C.wood1, AX+3, sy+2, 26, 1);
        tpx(c,C.wood3, AX+3, sy,   26, 2);
        tpx(c,C.wood5, AX+3, sy,   26, 1);
      }
      const books=[C.roof3,C.leaf3,C.aether3,C.brass3,C.water3];
      for(let k=0;k<7;k++){                          // leaning books
        const bh = 7+((hash2(cx+k,cy)*3)|0), bx = AX+4+k*3;
        tpx(c,shade(books[k%5],0.7), bx, AY+13-bh, 3, bh);
        tpx(c,books[k%5],            bx, AY+13-bh, 2, bh);
        tpx(c,C.brass4,              bx, AY+11-bh+3, 2, 1);
      }
      for(let k=0;k<5;k++){
        const bh = 6+((hash2(cx,cy+k)*4)|0), bx = AX+4+k*3;
        tpx(c,shade(books[(k+2)%5],0.7), bx, AY+23-bh, 3, bh);
        tpx(c,books[(k+2)%5],            bx, AY+23-bh, 2, bh);
      }
      tpx(c,C.plaster1, AX+21, AY+17, 7, 6);         // a jar
      tpx(c,C.plaster3, AX+22, AY+17, 5, 5);
      tpx(c,C.plaster4, AX+22, AY+17, 2, 2);
      break;
    }
    case T.DOOR: {
      tpx(c,C.wood1, AX+2, AY+4, 28, 28);            // frame
      tpx(c,C.wood2, AX+4, AY+6, 24, 26);
      tpx(c,C.wood3, AX+5, AY+7, 22, 24);
      // two recessed panels, lit from the upper left
      for(const py2 of [AY+9, AY+21]){
        tpx(c,C.wood1, AX+8,  py2,   16, 9);
        tpx(c,C.wood4, AX+9,  py2+1, 14, 7);
        tpx(c,C.wood5, AX+9,  py2+1, 14, 1);
        tpx(c,C.wood2, AX+9,  py2+7, 14, 1);
      }
      tpx(c,C.iron1, AX+4, AY+11, 24, 3);            // strap hinges
      tpx(c,C.iron3, AX+4, AY+11, 24, 1);
      tpx(c,C.iron1, AX+4, AY+27, 24, 3);
      tpx(c,C.iron3, AX+4, AY+27, 24, 1);
      tpx(c,C.brass2, AX+22, AY+18, 5, 5);           // handle
      tpx(c,C.brass4, AX+22, AY+18, 3, 3);
      tpx(c,C.brass5, AX+23, AY+19, 1, 1);
      break;
    }
    case T.WALL: {
      tpx(c,C.plaster1, AX, AY, S, S);
      tpx(c,C.plaster2, AX, AY, S, S-4);
      tpx(c,C.plaster3, AX, AY, S, 6);
      // a rough limewash: patches, not noise
      for(let k=0;k<5;k++){
        const px2=AX+((hash2(cx*3+k,cy)*26)|0), py2=AY+4+((hash2(cx,cy*3+k)*20)|0);
        tpx(c,C.plaster1, px2, py2, 4+((hash2(k,cx)*5)|0), 2);
      }
      tpx(c,C.wood1, AX, AY+28, S, 4);               // skirting
      tpx(c,C.wood3, AX, AY+28, S, 2);
      tpx(c,C.wood5, AX, AY+28, S, 1);
      if(h1>0.75){                                   // a structural beam
        tpx(c,C.wood1, AX+4, AY+4, 24, 5);
        tpx(c,C.wood2, AX+4, AY+4, 24, 4);
        tpx(c,C.wood4, AX+4, AY+4, 24, 1);
      }
      break;
    }
    case T.WALL_TOP: {
      tpx(c,C.wood1, AX, AY,   S, S);
      tpx(c,C.wood2, AX, AY+8, S, 24);
      tpx(c,C.wood3, AX, AY+8, S, 3);
      for(let k=0;k<3;k++) tpx(c,C.wood1, AX, AY+14+k*6, S, 1);
      break;
    }
    case T.RAMPART: {
      // Ironhaven curtain wall: riveted iron plate over stone
      masonry(c, AX, AY, S, S, [C.stone1,C.stone2,C.stone4,C.stone3], cx*5+cy, 8);
      tpx(c,C.iron1, AX, AY+12, S, 12);
      tpx(c,C.iron2, AX, AY+12, S, 11);
      tpx(c,C.iron3, AX, AY+13, S, 6);
      tpx(c,C.iron4, AX, AY+13, S, 2);
      rivets(c, AX+3, AY+15, 26, 5);
      rivets(c, AX+3, AY+21, 26, 5);
      if(h1>0.6){ tpx(c,C.rust1, AX+((h2*20)|0), AY+24, 10, 7);
                  tpx(c,C.rust2, AX+((h2*20)|0), AY+24, 9,  5); }
      break;
    }
    case T.GATE: {
      tpx(c,C.iron1, AX, AY, S, S);
      tpx(c,C.iron2, AX+2, AY, S-4, S);
      for(let k=0;k<5;k++){                          // bars
        const bx = AX+2+k*6;
        tpx(c,C.iron1, bx,   AY, 3, S);
        tpx(c,C.iron3, bx+3, AY, 2, S);
        tpx(c,C.iron4, bx+3, AY, 1, S);
      }
      for(const by of [AY+6, AY+22]){                // brass bands
        tpx(c,C.brass1, AX, by,   S, 6);
        tpx(c,C.brass2, AX, by,   S, 5);
        tpx(c,C.brass4, AX, by,   S, 2);
        rivets(c, AX+3, by+2, 26, 5);
      }
      break;
    }
    case T.LAMP: {
      propShadow(c, AX+8, AY+25, 16, 7);
      tpx(c,C.iron1, AX+14, AY+8, 5, 22);            // post
      tpx(c,C.iron3, AX+14, AY+8, 2, 22);
      tpx(c,C.iron4, AX+14, AY+8, 1, 22);
      for(let k=0;k<3;k++) tpx(c,C.iron1, AX+13, AY+13+k*6, 7, 1);
      tpx(c,C.iron1, AX+9,  AY+28, 15, 4);           // foot
      tpx(c,C.iron2, AX+10, AY+28, 13, 2);
      break;
    }
    case T.SIGN: {
      propShadow(c, AX+9, AY+26, 14, 6);
      tpx(c,C.wood1, AX+14, AY+14, 5, 17);
      tpx(c,C.wood3, AX+14, AY+14, 3, 17);
      tpx(c,C.wood5, AX+14, AY+14, 1, 17);
      break;
    }
    case T.BANNER: {
      // hangs from above; the base tile is just ground
      break;
    }
    case T.BUILDING: {
      // drawBuilding() already painted this footprint — draw nothing here or
      // we'd stamp interior wall art over the exterior.
      break;
    }
    case T.PIT: {
      // Same reasoning as BUILDING: drawPit() paints the whole crater in one
      // pass. Drawing it per tile could only produce a ring of squares.
      break;
    }

    case T.LIFTCAGE: {
      propShadow(c, AX, AY+24, S, 8);
      for(const px2 of [AX, AX+26]){                 // corner posts
        tpx(c,C.iron1, px2,   AY+4, 6, 28);
        tpx(c,C.iron3, px2,   AY+4, 2, 28);
        tpx(c,C.iron4, px2,   AY+4, 1, 28);
      }
      tpx(c,C.iron1, AX, AY+26, S, 6);               // deck
      tpx(c,C.iron2, AX+2, AY+26, S-4, 3);
      for(let k=0;k<4;k++) tpx(c,C.iron1, AX+3, AY+27+k*1, 26, 1);
      for(let k=0;k<3;k++){                          // cross-bracing
        tpx(c,C.iron2, AX+6, AY+8+k*8, 20, 2);
        tpx(c,C.iron4, AX+6, AY+8+k*8, 20, 1);
      }
      tpx(c,C.brass1, AX+12, AY+16, 9, 9);           // the call plate
      tpx(c,C.brass2, AX+12, AY+16, 8, 8);
      tpx(c,C.brass4, AX+12, AY+16, 8, 2);
      tpx(c,C.iron1,  AX+15, AY+19, 3, 3);
      break;
    }
    case T.SEAL: {
      // An Aethite lock. Stone jambs with a curtain of driven light between
      // them: it must read as something you can address rather than a wall,
      // so the frame is masonry and only the barrier itself glows.
      masonry(c, AX, AY, S, S, [C.cstone1,C.cstone2,C.cstone4,C.cstone3], cx+cy*3, 8);
      tpx(c,C.cstone1, AX,    AY, 5, S);
      tpx(c,C.cstone3, AX+1,  AY, 3, S);
      tpx(c,C.cstone1, AX+27, AY, 5, S);
      tpx(c,C.cstone2, AX+28, AY, 3, S);
      const ph = G.time*1.6 + cx*0.7 + cy*0.4;
      for(let i=0;i<8;i++){
        const a = 0.30 + 0.22*Math.sin(ph + i*0.7);
        tpx(c,'rgba(63,181,168,'+a.toFixed(3)+')', AX+4+i*3, AY, 3, S);
      }
      tpx(c,'rgba(138,240,228,'+(0.40+0.20*Math.sin(ph*1.7)).toFixed(3)+')',
          AX+4, AY+14, 24, 4);
      tpx(c,'rgba(200,255,248,'+(0.30+0.16*Math.sin(ph*2.3)).toFixed(3)+')',
          AX+4, AY+15, 24, 1);
      break;
    }

    // --- OUTER ZONE PROPS ---------------------------------------------------
    case T.CLIFF: {
      tpx(c,C.crag1, AX, AY,   S, S);
      tpx(c,C.crag2, AX, AY+4, S, S-4);
      for(let k=0;k<6;k++){                          // strata
        const fy = AY+5+k*5, fw = 16+((hash2(cx,cy+k)*14)|0);
        tpx(c,C.crag3, AX+((hash2(cx+k,cy)*11)|0), fy,   fw, 4);
        tpx(c,C.crag2, AX+((hash2(cx+k,cy)*11)|0), fy+3, fw, 1);
        tpx(c,C.crag1, AX, fy+4, S, 2);
      }
      tpx(c,C.crag4, AX, AY+4, S, 2);
      tpx(c,C.crag5, AX+((h1*20)|0), AY+4, 8, 1);
      break;
    }
    case T.ORE: {
      // aethite still in the rock. Same six colours as the city's paving,
      // because this is where the city's paving came from.
      const A = accentAt(cx,cy);
      tpx(c,C.crag1, AX,   AY+4, S,  S-4);
      tpx(c,C.crag2, AX+2, AY+6, 28, 24);
      tpx(c,C.crag3, AX+2, AY+6, 28, 4);
      // Six pockets on a jittered lattice, so they spread across the face
      // instead of piling into one corner the way pure hashing did.
      for(let k=0;k<6;k++){
        const gx = 4 + (k%3)*9 + ((hash2(cx*7+k,cy)*4)|0);
        const gy = 8 + ((k/3)|0)*10 + ((hash2(cx,cy*5+k)*5)|0);
        const w  = 5 + ((hash2(k,cx+cy)*3)|0);
        tpx(c,shade(A.d,0.5), AX+gx-1, AY+gy-1, w+2, w+2);
        tpx(c,A.d, AX+gx, AY+gy, w,   w);
        tpx(c,A.a, AX+gx, AY+gy, w-1, w-1);
        tpx(c,A.b, AX+gx, AY+gy, w-3, w-3);
        tpx(c,A.c, AX+gx, AY+gy, 1, 1);
      }
      break;
    }
    case T.PINE: {
      propShadow(c, AX+5, AY+23, 22, 9);
      tpx(c,C.bark1, AX+12, AY+12, 9, 20);
      tpx(c,C.bark2, AX+13, AY+12, 6, 20);
      tpx(c,C.bark3, AX+13, AY+12, 3, 20);
      for(let k=0;k<4;k++) tpx(c,C.bark1, AX+14, AY+15+k*5, 5, 1);
      break;
    }
    case T.MENHIR: {
      // standing stone, iron-veined. The Verge is full of them and nobody in
      // Ironhaven will say who put them there.
      propShadow(c, AX+3, AY+23, 26, 9);
      tpx(c,C.crag1, AX+6,  AY+2,  21, 30);
      tpx(c,C.crag2, AX+7,  AY+3,  19, 29);
      tpx(c,C.crag3, AX+8,  AY+4,  13, 28);
      tpx(c,C.crag4, AX+8,  AY+4,   6, 28);
      tpx(c,C.crag5, AX+8,  AY+4,   2, 24);
      tpx(c,C.crag1, AX+22, AY+4,   4, 28);
      for(let k=0;k<4;k++){                          // iron veins, broken
        const vx = AX+9+((hash2(cx+k,cy)*4)|0), vw = 8+((hash2(cx,cy+k)*6)|0);
        tpx(c,C.iron2, vx, AY+8+k*7, vw, 1);
        tpx(c,C.iron4, vx, AY+7+k*7, Math.max(2,vw-4), 1);
      }
      tpx(c,C.crag1, AX+15, AY+12, 3, 16);           // a chip out of the face
      break;
    }
    case T.PYLON: {
      // a survey mast, still upright, still humming
      propShadow(c, AX+7, AY+26, 18, 6);
      tpx(c,C.iron1, AX+12, AY+4,  9, 28);
      tpx(c,C.iron3, AX+13, AY+4,  4, 28);
      tpx(c,C.iron4, AX+13, AY+4,  2, 28);
      tpx(c,C.iron1, AX+6,  AY+28, 21, 4);
      tpx(c,C.iron2, AX+7,  AY+28, 19, 2);
      for(let k=0;k<3;k++){
        tpx(c,C.iron2, AX+8, AY+10+k*8, 17, 2);
        tpx(c,C.iron4, AX+8, AY+10+k*8, 17, 1);
      }
      break;
    }
    case T.PALM: {
      propShadow(c, AX+7, AY+24, 19, 8);
      // A leaning trunk, built as stacked segments. It runs the full height
      // of the tile so the crown in the overlay has something to sit on.
      for(let k=0;k<11;k++){
        const ty = AY+29-k*3, tx = AX+12+Math.round(Math.sin(k*0.34)*3);
        tpx(c,C.bark1, tx,   ty,   9, 3);
        tpx(c,C.bark2, tx,   ty,   8, 3);
        tpx(c,C.bark4, tx+1, ty,   3, 2);
        tpx(c,C.bark1, tx,   ty+2, 8, 1);
      }
      break;
    }
    case T.DRIFTWOOD: {
      propShadow(c, AX+1, AY+24, 30, 7);
      // A log lying at a slight angle, bleached by salt. Drawn as segments
      // along a slope so it has a length rather than being a bar.
      for(let k=0;k<11;k++){
        const lx = AX+k*3, ly = AY+22-Math.round(k*0.9);
        tpx(c,'#5c544a', lx, ly,   4, 11);
        tpx(c,'#8a8070', lx, ly,   4, 9);
        tpx(c,'#b0a695', lx, ly+2, 4, 4);
        if(k%3===0) tpx(c,'#6b6255', lx, ly+1, 2, 8);   // grain splits
      }
      tpx(c,'#cfc5b2', AX+3,  AY+24, 9, 1);
      tpx(c,'#3f3a33', AX,    AY+22, 3, 10);            // the sawn end
      tpx(c,'#5c544a', AX+1,  AY+23, 2, 8);
      tpx(c,'#6b6255', AX+22, AY+6,  5, 10);            // a branch stub
      tpx(c,'#8a8070', AX+22, AY+6,  4, 10);
      tpx(c,'#b0a695', AX+23, AY+7,  2, 8);
      break;
    }
    case T.WRECK: {
      // a hull rib sticking out of the sand, riveted and rusted through
      propShadow(c, AX+1, AY+24, 30, 8);
      tpx(c,C.rust1, AX+4,  AY+6, 24, 26);
      tpx(c,C.rust2, AX+6,  AY+8, 20, 24);
      tpx(c,C.rust3, AX+6,  AY+8,  7, 24);
      tpx(c,C.rust4, AX+6,  AY+8,  3, 20);
      for(let k=0;k<4;k++) rivets(c, AX+8, AY+10+k*6, 16, 4);
      tpx(c,'#1a1410', AX+12, AY+16, 9, 9);          // a hole clean through
      tpx(c,C.rust1,   AX+12, AY+16, 9, 2);
      tpx(c,C.rust3,   AX+12, AY+24, 9, 1);
      break;
    }

    // --- IRONHAVEN PROPS --------------------------------------------------
    case T.RAILING: {
      propShadow(c, AX, AY+25, S, 7);
      tpx(c,C.cstone1, AX, AY+22, S, 10);            // kerb
      tpx(c,C.cstone3, AX, AY+22, S, 5);
      tpx(c,C.cstone5, AX, AY+22, S, 1);
      for(let k=0;k<2;k++) tpx(c,C.cstone1, AX+((k*16)+13), AY+22, 1, 10);
      tpx(c,C.iron1, AX, AY+18, S, 4);               // bottom rail
      tpx(c,C.iron3, AX, AY+18, S, 2);
      tpx(c,C.iron4, AX, AY+18, S, 1);
      for(let i=0;i<4;i++){                          // balusters
        tpx(c,C.iron1, AX+2+i*8, AY+4, 4, 16);
        tpx(c,C.iron3, AX+2+i*8, AY+4, 2, 16);
        tpx(c,C.iron4, AX+2+i*8, AY+4, 1, 16);
      }
      break;
    }
    case T.PILLAR: {
      propShadow(c, AX+1, AY+24, 30, 8);
      tpx(c,C.cstone1, AX+4,  AY+4, 24, 28);
      tpx(c,C.cstone3, AX+6,  AY+4, 20, 28);
      tpx(c,C.cstone5, AX+6,  AY+4,  6, 28);         // lit face
      tpx(c,C.cstone6, AX+6,  AY+4,  2, 28);
      tpx(c,C.cstone2, AX+22, AY+4,  4, 28);
      for(let k=0;k<4;k++){                          // courses
        tpx(c,C.cstone1, AX+6, AY+10+k*7, 20, 1);
        tpx(c,C.cstone4, AX+6, AY+11+k*7, 20, 1);
      }
      tpx(c,C.iron1, AX+2, AY+22, 28, 6);            // iron band
      tpx(c,C.iron3, AX+2, AY+22, 28, 3);
      tpx(c,C.iron4, AX+2, AY+22, 28, 1);
      rivets(c, AX+5, AY+24, 22, 4);
      break;
    }
    case T.CRYSTAL: {
      // Aethite pushing up through the paving. The one place the accent
      // colour is allowed to be the brightest thing in frame.
      const A = accentAt(cx,cy);
      propShadow(c, AX+2, AY+24, 28, 8);
      tpx(c,C.cstone1, AX+4, AY+22, 24, 10);
      tpx(c,C.cstone3, AX+5, AY+22, 22, 3);
      // Three shards. Each one TAPERS to a point: a crystal drawn as a
      // rectangle is a gold bar, which is what the 1x art looked like.
      const sh = [[10,9,13,21],[4,7,8,14],[20,8,15,16]];
      for(const [ox,w,oy,hgt] of sh){
        const tipRows = Math.round(hgt*0.42);
        for(let j=0;j<hgt;j++){
          // full width at the base, narrowing over the top tipRows to 1
          const k = j < hgt-tipRows ? 1 : (hgt-j)/tipRows;
          const ww = Math.max(1, Math.round(w*k));
          const bx = AX+ox+((w-ww)>>1), by = AY+oy+j;
          tpx(c,shade(A.d,0.58), bx,   by, ww,   1);
          if(ww>1) tpx(c,A.d,    bx,   by, ww-1, 1);
          if(ww>3) tpx(c,A.a,    bx+1, by, ww-3, 1);
          if(ww>5) tpx(c,A.b,    bx+1, by, ww-5, 1);
        }
        tpx(c,A.c,       AX+ox+((w/2)|0)-1, AY+oy+2, 1, Math.max(2,(hgt/2)|0));
        tpx(c,'#ffffff', AX+ox+((w/2)|0)-1, AY+oy,   1, 3);
      }
      break;
    }
    case T.BENCH: {
      propShadow(c, AX+1, AY+25, 30, 7);
      tpx(c,C.iron1, AX+4,  AY+20, 5, 11);           // legs
      tpx(c,C.iron3, AX+4,  AY+20, 2, 11);
      tpx(c,C.iron1, AX+24, AY+20, 5, 11);
      tpx(c,C.iron3, AX+24, AY+20, 2, 11);
      for(let k=0;k<3;k++){                          // slatted seat
        const sy = AY+16+k*3;
        tpx(c,C.wood1, AX, sy+2, S, 1);
        tpx(c,C.wood2, AX, sy,   S, 2);
        tpx(c,C.wood4, AX, sy,   S, 1);
      }
      tpx(c,C.iron1, AX+2,  AY+6, 3, 12);            // back frame
      tpx(c,C.iron1, AX+28, AY+6, 3, 12);
      tpx(c,C.iron1, AX+2,  AY+6, 29, 4);
      tpx(c,C.iron3, AX+2,  AY+6, 29, 2);
      for(let k=0;k<5;k++) tpx(c,C.iron2, AX+6+k*5, AY+10, 2, 8);
      break;
    }
    case T.GEARWHEEL: {
      // A drive wheel left standing in the street — the city is a machine and
      // parts of it are just lying about in the open.
      propShadow(c, AX+2, AY+26, 28, 6);
      // rim, built as runs so it is round rather than square
      for(let j=0;j<28;j++){
        const dy=(j+0.5-14)/14, s=1-dy*dy;
        if(s<=0) continue;
        const half = Math.round(14*Math.sqrt(s));
        tpx(c,C.iron1, AX+16-half, AY+2+j, half*2, 1);
        if(half>3) tpx(c,C.iron2, AX+16-half+1, AY+2+j, half*2-2, 1);
        if(j<13 && half>5) tpx(c,C.iron3, AX+16-half+3, AY+2+j, half*2-8, 1);
      }
      tpx(c,C.iron4, AX+8, AY+5, 7, 2);              // a highlight up-left
      // the web: four spokes and a hub
      tpx(c,C.iron1, AX+14, AY+4, 4, 24);
      tpx(c,C.iron1, AX+4,  AY+14, 24, 4);
      tpx(c,C.iron3, AX+14, AY+4, 2, 24);
      tpx(c,C.iron3, AX+4,  AY+14, 24, 2);
      tpx(c,C.iron1, AX+11, AY+11, 10, 10);
      tpx(c,C.iron2, AX+12, AY+12,  8, 8);
      tpx(c,C.brass2, AX+13, AY+13, 6, 6);
      tpx(c,C.brass4, AX+13, AY+13, 6, 2);
      tpx(c,C.brass1, AX+15, AY+15, 2, 2);
      // teeth around the rim
      for(let k=0;k<12;k++){
        const a = k*(Math.PI*2/12) - Math.PI/2;
        const tx2 = Math.round(AX+16+Math.cos(a)*14)-2;
        const ty2 = Math.round(AY+16+Math.sin(a)*14)-2;
        tpx(c,C.iron1, tx2, ty2, 4, 4);
        tpx(c,C.iron4, tx2, ty2, 2, 1);
      }
      tpx(c,C.rust2, AX+7, AY+20, 6, 4);
      break;
    }
    case T.STALL: {
      // vendor stall: counter, goods on top, posts. The awning is in the
      // overlay so the shopkeeper behind it isn't painted over.
      const A = accentAt(cx,cy);
      propShadow(c, AX, AY+25, S, 7);
      woodBody(c, AX, AY+14, S, 17, cx*7+cy);        // counter
      tpx(c,C.wood1, AX+8,  AY+18, 2, 13);           // front boards
      tpx(c,C.wood1, AX+21, AY+18, 2, 13);
      tpx(c,shade(A.a,0.7), AX, AY+28, S, 4);        // painted trim
      tpx(c,A.a,            AX, AY+28, S, 3);
      tpx(c,shade(A.a,1.3), AX, AY+28, S, 1);
      // goods on the counter
      if(h1>0.55){
        tpx(c,C.brass1, AX+4, AY+7, 10, 9);
        tpx(c,C.brass2, AX+4, AY+7,  9, 8);
        tpx(c,C.brass4, AX+4, AY+7,  9, 2);
        tpx(c,C.brass5, AX+5, AY+8,  3, 1);
      }
      if(h2>0.5){
        tpx(c,shade(A.d,0.6), AX+17, AY+5, 11, 11);
        tpx(c,A.d,            AX+17, AY+5, 10, 10);
        tpx(c,A.b,            AX+19, AY+7,  6, 6);
        tpx(c,A.c,            AX+19, AY+7,  2, 2);
      }
      if(h1<0.3) woodBody(c, AX+14, AY+7, 13, 9, cx+cy*3);
      break;
    }
    case T.BRAZIER: {
      propShadow(c, AX+5, AY+26, 22, 6);
      tpx(c,C.iron1, AX+13, AY+18, 6, 13);           // stem
      tpx(c,C.iron3, AX+13, AY+18, 3, 13);
      tpx(c,C.iron1, AX+6,  AY+28, 20, 4);           // foot
      tpx(c,C.iron2, AX+8,  AY+28, 16, 2);
      tpx(c,C.iron4, AX+9,  AY+28,  6, 1);
      // the bowl: a flared ring, wider at the lip
      for(let j=0;j<11;j++){
        const w = 26 - Math.round(j*0.9);
        tpx(c,C.iron1, AX+16-(w>>1), AY+10+j, w, 1);
        if(j>0) tpx(c,C.iron2, AX+17-(w>>1), AY+10+j, w-2, 1);
        if(j>1 && j<7) tpx(c,C.iron3, AX+18-(w>>1), AY+10+j, (w>>1)-2, 1);
      }
      tpx(c,C.iron4, AX+3, AY+10, 26, 1);            // the lip catches light
      tpx(c,C.rust2, AX+8, AY+16, 6, 2);
      break;                                         // flame is in the overlay
    }
  }
  });
}

// ---------------------------------------------------------------------------
// PROPS — overlay layer, drawn AFTER actors so you can stand behind them
// ---------------------------------------------------------------------------
function drawPropOver(c, area, cx, cy){
  const t = tileAt(area,cx,cy), X=cx*TILE, Y=cy*TILE;
  const h1=hash2(cx,cy), h2=hash2(cx+41,cy+17);
  const AX = X*ART, AY = Y*ART, S = ART*TILE;

  // Glow pools go through the context transform, so they are in WORLD units
  // and are drawn outside the authored-unit block, below.
  withArt(ART, () => {
  switch(t){
    case T.TREE: {
      // canopy rises a full tile above the trunk and overhangs the trunk
      // The canopy sits DOWN over the trunk rather than balancing on it, and
      // it is wider than the tile: a tree that fits inside its own tile reads
      // as a bush on a stick.
      const big = h1>0.5;
      const rw = big?40:32, rh = big?36:28;
      canopy(c, AX+16, AY - (big?26:18), rw, rh, cx*13+cy*7);
      break;
    }
    case T.LAMP: {
      // brass gas lamp: a lantern head on a bracket
      tpx(c,C.brass1, AX+9,  AY-9, 15, 13);          // housing
      tpx(c,C.brass2, AX+10, AY-8, 13, 11);
      tpx(c,C.brass3, AX+11, AY-7, 11, 9);
      tpx(c,C.amber2, AX+12, AY-7,  9, 8);           // the glass
      tpx(c,C.amber3, AX+12, AY-6,  8, 6);
      tpx(c,C.amber4, AX+13, AY-5,  5, 4);
      tpx(c,C.amber5, AX+14, AY-4,  3, 2);
      tpx(c,C.brass1, AX+11, AY-7,  1, 9);           // glazing bars
      tpx(c,C.brass1, AX+17, AY-7,  1, 9);
      tpx(c,C.brass2, AX+7,  AY-12, 19, 4);          // the cap
      tpx(c,C.brass4, AX+7,  AY-12, 19, 2);
      tpx(c,C.brass5, AX+9,  AY-12, 6,  1);
      tpx(c,C.brass1, AX+14, AY-15, 4,  4);          // the finial
      tpx(c,C.brass3, AX+14, AY-15, 2,  4);
      break;
    }
    case T.SIGN: {
      tpx(c,C.wood1, AX+2,  AY-5, 28, 19);
      tpx(c,C.wood2, AX+3,  AY-4, 26, 17);
      tpx(c,C.wood4, AX+4,  AY-3, 24, 15);
      tpx(c,C.wood5, AX+4,  AY-3, 24, 1);
      tpx(c,C.wood2, AX+6,  AY+1, 20, 2);            // lettering, illegible
      tpx(c,C.wood2, AX+6,  AY+5, 14, 2);
      tpx(c,C.wood2, AX+6,  AY+9, 17, 2);
      tpx(c,C.brass2, AX+4, AY-3, 2, 15);            // brass edging
      tpx(c,C.brass4, AX+4, AY-3, 1, 15);
      tpx(c,C.brass2, AX+26,AY-3, 2, 15);
      break;
    }
    case T.BANNER: {
      tpx(c,C.iron1, AX+2, AY-16, 28, 4);            // the rod
      tpx(c,C.iron3, AX+2, AY-16, 28, 2);
      const sway = Math.round(Math.sin(G.time*1.5+cx)*2);
      // the cloth, with a fold running down it that follows the sway
      tpx(c,C.roof1, AX+6+sway,  AY-12, 20, 28);
      tpx(c,C.roof2, AX+7+sway,  AY-12, 18, 26);
      tpx(c,C.roof3, AX+8+sway,  AY-12, 12, 24);
      tpx(c,C.roof4, AX+9+sway,  AY-12,  3, 22);
      tpx(c,C.roof1, AX+16+sway, AY-12,  2, 26);
      tpx(c,C.brass2, AX+12+sway, AY-4, 9, 9);       // the device on it
      tpx(c,C.brass3, AX+13+sway, AY-3, 7, 7);
      tpx(c,C.brass5, AX+14+sway, AY-2, 3, 3);
      tpx(c,C.roof1, AX+6+sway,  AY+14, 20, 4);      // the hem
      for(let k=0;k<4;k++) tpx(c,C.roof1, AX+7+sway+k*5, AY+18, 3, 2);
      break;
    }
    case T.WALL_TOP: {
      tpx(c,C.wood1, AX, AY-12, S, 14);
      tpx(c,C.wood2, AX, AY-10, S, 12);
      tpx(c,C.wood3, AX, AY-10, S, 3);
      tpx(c,C.wood5, AX, AY-10, S, 1);
      for(let k=0;k<3;k++) tpx(c,C.wood1, AX, AY-6+k*5, S, 1);
      break;
    }
    case T.RAMPART: {
      // crenellations along the top of the wall
      masonry(c, AX, AY-20, S, 22,
              [C.stone1,C.stone2,C.stone4,C.stone3], cx*5+cy, 8);
      for(const [mx,mw] of [[0,10],[12,10],[24,8]]){
        tpx(c,C.stone1, AX+mx, AY-26, mw, 7);
        tpx(c,C.stone2, AX+mx, AY-26, mw-1, 6);
        tpx(c,C.stone4, AX+mx, AY-26, mw-1, 2);
        tpx(c,C.stone5, AX+mx, AY-26, 3, 1);
      }
      tpx(c,C.iron1, AX, AY-8, S, 6);                // the walkway band
      tpx(c,C.iron2, AX, AY-8, S, 5);
      tpx(c,C.iron3, AX, AY-8, S, 2);
      rivets(c, AX+3, AY-6, 26, 5);
      break;
    }
    case T.GATE: {
      tpx(c,C.iron1, AX, AY-28, S, 28);
      tpx(c,C.iron2, AX+2, AY-28, S-4, 28);
      for(let k=0;k<5;k++){
        const bx = AX+2+k*6;
        tpx(c,C.iron1, bx,   AY-28, 3, 28);
        tpx(c,C.iron3, bx+3, AY-28, 2, 28);
        tpx(c,C.iron4, bx+3, AY-28, 1, 28);
      }
      for(const by of [AY-24, AY-10]){
        tpx(c,C.brass1, AX, by, S, 6);
        tpx(c,C.brass2, AX, by, S, 5);
        tpx(c,C.brass4, AX, by, S, 2);
        rivets(c, AX+3, by+2, 26, 5);
      }
      break;
    }
    case T.HEARTH: {
      // chimney breast above the firebox
      masonry(c, AX+2, AY-20, 28, 22,
              [C.stone1,C.stone2,C.stone4,C.stone3], cx*11+cy, 8);
      tpx(c,C.stone1, AX, AY-23, S, 5);
      tpx(c,C.stone4, AX, AY-23, S, 3);
      tpx(c,C.stone5, AX, AY-23, S, 1);
      break;
    }
    case T.SHELF: {
      tpx(c,C.wood1, AX+2, AY-12, 28, 14);
      tpx(c,C.wood2, AX+3, AY-11, 26, 12);
      tpx(c,C.wood4, AX+3, AY-11, 26, 1);
      const books=[C.roof3,C.leaf3,C.aether3,C.brass3,C.water3];
      for(let k=0;k<7;k++){
        const bh = 7+((hash2(cx+k,cy*3)*3)|0), bx = AX+4+k*3;
        tpx(c,shade(books[(k+1)%5],0.7), bx, AY-2-bh, 3, bh);
        tpx(c,books[(k+1)%5],            bx, AY-2-bh, 2, bh);
      }
      break;
    }

    case T.LIFTCAGE: {
      for(const px2 of [AX, AX+26]){
        tpx(c,C.iron1, px2, AY-44, 6, 46);
        tpx(c,C.iron3, px2, AY-44, 2, 46);
        tpx(c,C.iron4, px2, AY-44, 1, 46);
      }
      tpx(c,C.iron1, AX, AY-48, S, 6);               // head frame
      tpx(c,C.iron2, AX, AY-48, S, 5);
      tpx(c,C.iron3, AX, AY-48, S, 2);
      rivets(c, AX+3, AY-46, 26, 5);
      for(let k=0;k<4;k++){
        tpx(c,C.iron2, AX+6, AY-40+k*10, 20, 2);
        tpx(c,C.iron4, AX+6, AY-40+k*10, 20, 1);
      }
      // the chain, running up out of frame — links, not a dashed line
      for(let d=0; d<14; d++){
        const ly = AY-76+d*4;
        if(d%2){ tpx(c,C.iron1, AX+14, ly, 5, 4); tpx(c,C.iron3, AX+15, ly+1, 3, 2); }
        else   { tpx(c,C.iron1, AX+15, ly, 3, 4); tpx(c,C.iron4, AX+15, ly, 1, 4); }
      }
      const on = !!(G.locks && G.locks.elevator);
      tpx(c,C.iron1, AX+11, AY-56, 11, 7);           // the lock lamp housing
      tpx(c, on?'#8af0e4':'#2f4a48', AX+12, AY-55, 9, 5);
      if(on) tpx(c,'#d8fffa', AX+13, AY-54, 3, 2);
      break;
    }
    case T.SEAL: {
      masonry(c, AX, AY-28, S, 30,
              [C.cstone1,C.cstone2,C.cstone4,C.cstone3], cx+cy*3, 8);
      tpx(c,C.cstone1, AX,    AY-28, 5, 30);
      tpx(c,C.cstone3, AX+1,  AY-28, 3, 30);
      tpx(c,C.cstone1, AX+27, AY-28, 5, 30);
      tpx(c,C.cstone2, AX+28, AY-28, 3, 30);
      tpx(c,C.cstone1, AX, AY-33, S, 6);             // the lintel
      tpx(c,C.cstone4, AX, AY-33, S, 3);
      tpx(c,C.cstone5, AX, AY-33, S, 1);
      const ph = G.time*1.6 + cx*0.7;
      for(let i=0;i<8;i++){
        const a = 0.26 + 0.20*Math.sin(ph + i*0.7);
        tpx(c,'rgba(63,181,168,'+a.toFixed(3)+')', AX+4+i*3, AY-27, 3, 28);
      }
      break;
    }

    // --- THE GLIMMERVEIN -------------------------------------------------
    case T.GEMCLUSTER: {
      // A fist of crystal growing out of the floor at an angle, lit from
      // inside. Six colours, picked by position, so a cavern reads as
      // mineral rather than as a colour scheme.
      const A = accentAt(cx,cy);
      // five shards of different heights, leaning apart
      const sh = [[4,36,8,-2],[13,52,10,0],[22,28,8,2],[0,22,6,-3],[26,18,5,3]];
      for(let k=0;k<5;k++){
        const [ox,hgt,w,lean] = sh[k];
        const bx = AX+ox+lean, by = AY+4-hgt;
        tpx(c,shade(A.d,0.55), bx,   by,   w,   hgt);
        tpx(c,A.d,             bx,   by,   w-1, hgt-1);
        tpx(c,A.a,             bx+1, by+3, w-3, hgt-4);
        tpx(c,A.b,             bx+1, by+5, Math.max(1,w-5), Math.max(1,hgt-12));
        tpx(c,A.c,             bx+2, by+4, 1,   Math.max(2,(hgt/2)|0));
        tpx(c,'#ffffff',       bx+2, by+3, 2,   3);
        // the facet break, a third of the way up
        tpx(c,shade(A.d,0.70), bx, by+((hgt*0.62)|0), w-1, 2);
      }
      tpx(c,C.cave2, AX+1, AY+2, 30, 7);             // the rock it sits in
      tpx(c,C.cave3, AX+2, AY+2, 28, 4);
      tpx(c,C.cave4, AX+4, AY+2, 12, 2);
      break;
    }
    case T.NODE: {
      // One tile, five looks. A gathering node has no art of its own: it is
      // drawn out of whatever material the AREA is seeded with, so adding a
      // sixth zone with a sixth material needs no new art and cannot forget
      // to add any. A worked node draws as its own stump until it grows back.
      const M = (area.nodeMat && MAT_BY_ID[area.nodeMat]) || MATERIALS[0];
      const worked = G.nodesDone && G.nodesDone[area.id+':'+cx+','+cy] > 0;
      const mc = M.col;
      tpx(c, shade(mc.a,0.7), AX+1, AY-7, 30, 11);   // the spoil it sits in
      tpx(c, mc.a,            AX+2, AY-6, 28, 9);
      tpx(c, mc.b,            AX+4, AY-6, 24, 5);
      if(worked){
        tpx(c, C.stone1, AX+8,  AY-13, 16, 10);
        tpx(c, C.stone2, AX+9,  AY-13, 14, 8);
        tpx(c, C.stone3, AX+10, AY-13, 10, 3);
        break;
      }
      // Five materials, five silhouettes. Colour alone is not enough on a
      // busy tile: at a glance across a field you should be able to tell a
      // salt crust from an iron bloom without reading the colour, because
      // half the zones are already the colour of their own material.
      if(M.shape==='bloom'){
        // soft round heads on short stalks, like a clump of flowers
        for(const [ox,hh,r] of [[6,10,7],[14,19,9],[24,13,6]]){
          tpx(c, shade(mc.a,0.7), AX+ox+2, AY-2-hh, 3, hh);       // stalk
          tpx(c, mc.a, AX+ox+2, AY-2-hh, 2, hh);
          tpx(c, shade(mc.a,0.6), AX+ox-1, AY-4-hh, r+3, r+1);    // head
          tpx(c, mc.a, AX+ox,   AY-4-hh, r+2, r);
          tpx(c, mc.b, AX+ox,   AY-4-hh, r,   r-2);
          tpx(c, mc.c, AX+ox+1, AY-3-hh, Math.max(1,r-3), 2);
          tpx(c, mc.lit, AX+ox+1, AY-3-hh, 2, 1);
        }
      } else if(M.shape==='crust'){
        // flat overlapping slabs, wide and low
        for(const [ox,oy,w,h] of [[2,-9,19,9],[12,-15,17,8],[6,-19,13,7]]){
          tpx(c, shade(mc.a,0.6), AX+ox-1, AY+oy, w+2, h+1);
          tpx(c, mc.a,   AX+ox,   AY+oy,   w,   h);
          tpx(c, mc.b,   AX+ox,   AY+oy,   w-2, h-2);
          tpx(c, mc.c,   AX+ox,   AY+oy,   w-4, 2);
          tpx(c, mc.lit, AX+ox+2, AY+oy,   4,   1);
        }
      } else if(M.shape==='shard'){
        // thin angular blades leaning apart
        for(const [ox,hh,lean] of [[6,21,-2],[14,29,0],[23,19,2]]){
          tpx(c, shade(mc.a,0.6), AX+ox+lean-1, AY-2-hh, 8, hh+1);
          tpx(c, mc.a,   AX+ox+lean, AY-2-hh, 6, hh);
          tpx(c, mc.b,   AX+ox+lean, AY-2-hh, 4, hh-2);
          tpx(c, mc.c,   AX+ox+lean, AY+1-hh, 2, Math.max(1,hh-8));
          tpx(c, mc.lit, AX+ox+lean, AY-2-hh, 2, 4);
        }
      } else if(M.shape==='spire'){
        // tall narrow crystals, the tallest off-centre
        for(const [ox,hh,w] of [[6,19,6],[14,33,8],[25,15,5]]){
          tpx(c, shade(mc.a,0.6), AX+ox-1, AY-2-hh, w+2, hh+1);
          tpx(c, mc.a,   AX+ox, AY-2-hh, w,   hh);
          tpx(c, mc.b,   AX+ox, AY-2-hh, w-2, hh-2);
          tpx(c, mc.c,   AX+ox, AY+4-hh, Math.max(1,w-4), Math.max(1,hh-10));
          tpx(c, mc.lit, AX+ox, AY-2-hh, 2, 6);
        }
      } else {
        // scrap: irregular chunks, no two the same height
        for(const [ox,oy,w,h] of [[2,-13,13,13],[14,-19,15,17],[21,-9,11,9]]){
          tpx(c, shade(mc.a,0.6), AX+ox-1, AY+oy-1, w+2, h+2);
          tpx(c, mc.a, AX+ox,   AY+oy,   w,   h);
          tpx(c, mc.b, AX+ox,   AY+oy,   w-2, h-2);
          tpx(c, mc.c, AX+ox,   AY+oy,   Math.max(1,w-6), 4);
          tpx(c,'#c9c5bd', AX+ox+2, AY+oy, 4, 2);
        }
      }
      break;
    }
    case T.CAVEWALL: {
      // Not a cliff face — rock the cavern was hollowed out of. Nearly black,
      // because the gems are supposed to be the only light down here and a
      // lit wall would drown them.
      tpx(c,C.cave1, AX, AY-28, S, 30);
      tpx(c,C.cave2, AX, AY-24, S, 26);
      for(let k=0;k<5;k++){
        const by = AY-23+k*6, bx = AX+((hash2(cx+k,cy)*12)|0);
        tpx(c,C.cave3, bx, by,   14+((hash2(cx,cy+k)*12)|0), 4);
        tpx(c,C.cave2, bx, by+3, 14+((hash2(cx,cy+k)*12)|0), 1);
      }
      tpx(c,C.cave3, AX, AY-28, S, 2);
      tpx(c,C.cave4, AX, AY-28, 12, 1);
      // a seam of gem showing through, now and then
      if(hash2(cx*5,cy*3)>0.80){
        const A = accentAt(cx,cy);
        const gx = AX+4+((hash2(cx,cy)*16)|0);
        tpx(c,shade(A.a,0.6), gx-1, AY-19, 8, 10);
        tpx(c,A.a, gx,   AY-18, 6, 8);
        tpx(c,A.b, gx+1, AY-17, 3, 5);
        tpx(c,A.c, gx+1, AY-16, 1, 3);
      }
      break;
    }
    case T.FLOWSTONE: {
      // A column where a drip has been landing for a very long time. The
      // lobes down its length are what make it stone rather than a pipe.
      // The column flares as it comes down — forty years of drip does not
      // build a cabinet — and the lobes are lit on top and dark underneath.
      for(let j=0;j<48;j++){
        const t2 = j/47;
        const w = Math.round(9 + t2*t2*15) + ((hash2(cx, cy+((j/6)|0))*3)|0);
        const y2 = AY-44+j, x0 = AX+16-w;
        tpx(c,C.cave1, x0,   y2, w*2,   1);
        tpx(c,C.cave3, x0+1, y2, w*2-2, 1);
        tpx(c,C.cave4, x0+2, y2, w,     1);
        tpx(c,C.cave5, x0+3, y2, Math.max(1,(w*0.55)|0), 1);
        tpx(c,'#5d4f78', x0+3, y2, Math.max(1,(w*0.20)|0), 1);
      }
      for(let k=0;k<6;k++){                          // drip lobes
        const ly = AY-38+k*8, lw = 18+k*2+((hash2(cx,cy+k)*8)|0);
        tpx(c,C.cave5, AX+16-(lw>>1), ly,   lw,   1);   // lit crest
        tpx(c,C.cave1, AX+16-(lw>>1), ly+1, lw,   2);   // shadow under it
      }
      tpx(c,C.cave2, AX,   AY-2, S, 6);              // the flowstone floor
      tpx(c,C.cave3, AX+1, AY-2, 30, 4);
      tpx(c,C.cave4, AX+3, AY-2, 14, 1);
      break;
    }

    // --- OUTER ZONES -----------------------------------------------------
    case T.CLIFF: {
      // the face carries on up out of the tile, so it reads as height
      tpx(c,C.crag1, AX, AY-32, S, 34);
      tpx(c,C.crag2, AX, AY-30, S, 32);
      for(let k=0;k<7;k++){
        const fy = AY-28+k*5, fx = AX+((hash2(cx+k,cy)*10)|0);
        const fw = 18+((hash2(cx,cy+k)*12)|0);
        tpx(c,C.crag3, fx, fy,   fw, 5);
        tpx(c,C.crag2, fx, fy+4, fw, 1);
        tpx(c,C.crag1, AX, fy+5, S,  1);
      }
      tpx(c,C.crag4, AX, AY-32, S, 3);
      tpx(c,C.crag5, AX+((h1*18)|0), AY-32, 9, 2);
      break;
    }
    case T.PINE: {
      // A hard-edged conifer: stacked tiers, not a round canopy. The lowest
      // tier reaches down past the top of the trunk — at 1x there was a gap
      // between the two and the tree read as a hat on a pole.
      for(let k=0;k<5;k++){
        const w = 30-k*5, ty = AY+2-k*11, x0 = AX+16-(w>>1);
        // each tier: a shadowed underside, a body, and a lit upper edge
        tpx(c,C.pine1, x0,   ty,    w,   14);
        tpx(c,C.pine1, x0,   ty+11, w,   3);
        tpx(c,C.pine2, x0+2, ty,    w-4, 10);
        tpx(c,C.pine3, x0+2, ty,    w-8, 4);
        tpx(c,C.pine4, x0+3, ty,    Math.max(2,(w/4)|0), 1);
        // needles breaking the tier's edge
        for(let n=0;n<4;n++){
          const nx = x0+2+n*((w-4)/4|0);
          tpx(c,C.pine1, nx, ty+12, 3, 3);
        }
      }
      tpx(c,C.pine2, AX+14, AY-52, 4, 7);            // the leader
      tpx(c,C.pine4, AX+14, AY-52, 2, 5);
      break;
    }
    case T.PALM: {
      // Seven fronds hung off a crown that sits ON the top of the trunk. Each
      // one is a spine that arcs up and then droops, with leaflets combed off
      // both sides — the droop is what makes it a palm and not a firework.
      const crownX = AX+16+Math.round(Math.sin(10*0.34)*3), crownY = AY-6;
      for(let k=0;k<7;k++){
        const a = -Math.PI*0.95 + k*(Math.PI*0.9/6) + Math.sin(G.time*0.8+cx)*0.05;
        const ca = Math.cos(a), sa = Math.sin(a);
        for(let d=2; d<22; d++){
          const droop = d*d*0.055;                   // the frond falls away
          const fx = Math.round(crownX+ca*d*1.5);
          const fy = Math.round(crownY+sa*d*0.85+droop);
          tpx(c, d>15?'#2b6431':(d>8?'#3d8740':'#4f9a4c'), fx, fy, 3, 3);
          if(d>4 && d%2){                            // leaflets, both sides
            tpx(c,'#1d4426', fx-Math.round(sa*4), fy+Math.round(ca*4), 2, 3);
            tpx(c,'#3d8740', fx+Math.round(sa*4), fy-Math.round(ca*4), 2, 3);
          }
        }
      }
      tpx(c,'#3f2a17', crownX-4, crownY-2, 11, 8);   // the crown itself
      tpx(c,'#5a3c22', crownX-3, crownY-2,  9, 6);
      tpx(c,'#5a3c22', crownX-6, crownY+4,  6, 6);   // coconuts
      tpx(c,'#6b4a2a', crownX-6, crownY+4,  5, 5);
      tpx(c,'#8a6238', crownX-5, crownY+5,  2, 2);
      tpx(c,'#5a3c22', crownX+3, crownY+5,  6, 6);
      tpx(c,'#6b4a2a', crownX+3, crownY+5,  5, 5);
      break;
    }
    case T.MENHIR: {
      // The stone narrows and goes ragged towards the top. A parallel-sided
      // slab with a lit square on it looks like a vending machine, which is
      // precisely what the first pass of this looked like.
      for(let j=0;j<28;j++){
        const y2 = AY-26+j;
        const inset = Math.round((1-j/27)*4) + ((hash2(cx, cy+j)*2)|0);
        const x0 = AX+6+inset, w = 21-inset*2;
        tpx(c,C.crag1, x0,   y2, w,   1);
        tpx(c,C.crag2, x0+1, y2, w-2, 1);
        if(w>5) tpx(c,C.crag3, x0+2, y2, Math.max(1,(w*0.6)|0), 1);
        if(w>7) tpx(c,C.crag4, x0+2, y2, Math.max(1,(w*0.3)|0), 1);
        if(w>9 && j>4) tpx(c,C.crag5, x0+2, y2, 2, 1);
      }
      const A = accentAt(cx,cy);
      tpx(c,shade(A.d,0.6), AX+11, AY-19, 10, 10);   // the set stone
      tpx(c,A.d, AX+12, AY-18, 8, 8);
      tpx(c,A.b, AX+13, AY-17, 5, 5);
      tpx(c,A.c, AX+13, AY-17, 2, 2);
      break;
    }
    case T.PYLON: {
      tpx(c,C.iron1, AX+12, AY-40, 9, 42);
      tpx(c,C.iron3, AX+13, AY-40, 4, 42);
      tpx(c,C.iron4, AX+13, AY-40, 2, 42);
      tpx(c,C.iron1, AX+4,  AY-44, 24, 5);           // the cross-head
      tpx(c,C.iron2, AX+5,  AY-44, 22, 4);
      tpx(c,C.iron4, AX+5,  AY-44, 22, 1);
      for(let k=0;k<4;k++){
        tpx(c,C.iron2, AX+7, AY-36+k*10, 19, 2);
        tpx(c,C.iron4, AX+7, AY-36+k*10, 19, 1);
      }
      const on = Math.sin(G.time*2.2+cx)>0.3;
      tpx(c,C.iron1, AX+13, AY-51, 6, 7);
      tpx(c, on?'#8fd6ff':'#2f4a5a', AX+14, AY-50, 4, 6);
      if(on) tpx(c,'#dff2ff', AX+15, AY-49, 2, 2);
      break;
    }
    case T.WRECK: {
      // The rib carries on up out of the tile and leans, so it reads as a
      // wreck rather than as a second box stacked on the first.
      tpx(c,C.rust1, AX+4, AY-24, 24, 30);
      tpx(c,C.rust2, AX+6, AY-23, 20, 29);
      tpx(c,C.rust3, AX+6, AY-23,  7, 29);
      tpx(c,C.rust4, AX+6, AY-23,  3, 22);
      tpx(c,C.rust1, AX+4, AY-28,  9, 6);            // the torn top edge
      tpx(c,C.rust2, AX+5, AY-27,  7, 5);
      tpx(c,C.rust1, AX+18,AY-27,  8, 5);
      for(let k=0;k<3;k++) rivets(c, AX+8, AY-20+k*8, 16, 4);
      tpx(c,'#1a1410', AX+14, AY-14, 7, 7);          // another hole
      tpx(c,C.rust3,   AX+14, AY-8,  7, 1);
      break;
    }

    // --- IRONHAVEN -------------------------------------------------------
    case T.RAILING: {
      tpx(c,C.iron1, AX, AY-2, S, 6);                // top rail
      tpx(c,C.iron2, AX, AY-2, S, 5);
      tpx(c,C.iron3, AX, AY-2, S, 2);
      tpx(c,C.iron4, AX, AY-2, 9, 1);
      if((cx+cy)%5===0){                             // finial every few posts
        tpx(c,C.iron1, AX+12, AY-11, 7, 11);
        tpx(c,C.iron3, AX+13, AY-11, 3, 11);
        const A = accentAt(cx,cy);
        tpx(c,shade(A.d,0.6), AX+10, AY-18, 11, 9);
        tpx(c,A.d, AX+11, AY-17, 9, 8);
        tpx(c,A.b, AX+12, AY-16, 5, 5);
        tpx(c,A.c, AX+12, AY-16, 2, 2);
      }
      break;
    }
    case T.PILLAR: {
      tpx(c,C.cstone1, AX+4,  AY-24, 24, 26);        // shaft continuing up
      tpx(c,C.cstone3, AX+6,  AY-24, 20, 26);
      tpx(c,C.cstone5, AX+6,  AY-24,  6, 26);
      tpx(c,C.cstone6, AX+6,  AY-24,  2, 26);
      tpx(c,C.cstone2, AX+22, AY-24,  4, 26);
      for(let k=0;k<3;k++){
        tpx(c,C.cstone1, AX+6, AY-20+k*7, 20, 1);
        tpx(c,C.cstone4, AX+6, AY-19+k*7, 20, 1);
      }
      tpx(c,C.cstone1, AX,   AY-32, S, 10);          // capital
      tpx(c,C.cstone3, AX+1, AY-31, 30, 8);
      tpx(c,C.cstone5, AX+1, AY-31, 10, 8);
      tpx(c,C.cstone4, AX,   AY-32, S, 2);
      tpx(c,C.cstone6, AX+1, AY-32, 12, 1);
      tpx(c,C.iron1, AX+2, AY-16, 28, 4);
      tpx(c,C.iron3, AX+2, AY-16, 28, 2);
      rivets(c, AX+5, AY-15, 22, 4);
      break;
    }
    case T.STALL: {
      // Awning in the overlay, so a shopkeeper standing behind the counter is
      // occluded by it rather than floating in front.
      const A = accentAt(cx,cy);
      for(const px2 of [AX, AX+28]){                 // posts
        tpx(c,C.wood1, px2,   AY-8, 4, 22);
        tpx(c,C.wood3, px2,   AY-8, 2, 22);
        tpx(c,C.wood5, px2,   AY-8, 1, 22);
      }
      tpx(c,C.iron1, AX-2, AY-32, 36, 6);            // awning bar
      tpx(c,C.iron3, AX-2, AY-32, 36, 3);
      // striped canopy: grey and one accent, which is the city's whole rule
      for(let i=0;i<32;i+=8){
        tpx(c,C.cstone2, AX+i,   AY-28, 4, 20);
        tpx(c,C.cstone4, AX+i,   AY-28, 4, 2);
        tpx(c,A.a,       AX+i+4, AY-28, 4, 20);
        tpx(c,shade(A.a,1.3), AX+i+4, AY-28, 4, 2);
      }
      tpx(c,C.cstone1, AX, AY-9, S, 2);              // the shadow under the hem
      tpx(c,C.iron1, AX-2, AY-10, 36, 4);
      for(let i=0;i<32;i+=8){                        // scalloped hem
        tpx(c,C.cstone3, AX+i,   AY-7, 4, 3);
        tpx(c,A.b,       AX+i+4, AY-7, 4, 3);
      }
      break;
    }
    case T.BRAZIER: {
      // coals and flame. The city has no sun in frame, so these and the lamps
      // are what keep the street from going flat.
      const f = G.time*7 + cx*2.1 + cy*1.3;
      tpx(c,C.rust3,  AX+6, AY+5, 20, 5);            // coals
      tpx(c,C.amber1, AX+7, AY+5, 18, 4);
      tpx(c,C.amber2, AX+9, AY+5, 12, 2);
      for(let k=0;k<5;k++){
        const w   = 5 + Math.round(Math.sin(f+k*1.7)*2);
        const hgt = 10 + Math.round(Math.sin(f*0.8+k*2.3)*6);
        const fx  = AX+5+k*5;
        tpx(c,C.amber1, fx,   AY+8-hgt,  w,   hgt);
        tpx(c,C.amber2, fx,   AY+9-hgt,  w-1, hgt-1);
        tpx(c,C.amber3, fx+1, AY+11-hgt, Math.max(1,w-3), Math.max(1,hgt-4));
        if(k%2) tpx(c,C.amber5, fx+1, AY+13-hgt, 1, 3);
      }
      break;
    }
    case T.VENT: {
      // steam, rising and thinning. Drifts sideways so the street feels like
      // it has moving air in it. Drawn as blocks, not circles — a soft round
      // gradient here would be the one non-pixel thing on screen.
      const ph = G.time*1.5 + cx*1.7 + cy*0.9;
      for(let k=0;k<6;k++){
        const t2 = ((ph + k*0.17) % 1);
        const a = 0.22*(1-t2);
        if(a<0.012) continue;
        const r = 3 + t2*13;
        const sx = Math.round(AX+16-r+Math.sin(ph*1.6+k)*8);
        const sy = Math.round(AY+12-t2*44);
        tpx(c,'rgba(206,214,230,'+a.toFixed(3)+')', sx, sy, Math.round(r*2), Math.round(r*1.4));
        tpx(c,'rgba(232,240,250,'+(a*0.7).toFixed(3)+')', sx+2, sy, Math.round(r*1.2), Math.round(r*0.6));
      }
      break;
    }
  }
  });

  // --- glow pools, in WORLD units --------------------------------------
  // These go through the context transform rather than through tpx, so they
  // must stay outside the authored-unit block or they would be drawn at half
  // size in the top-left corner of where they belong.
  switch(t){
    case T.LAMP: {
      const gl = 0.20 + 0.06*Math.sin(G.time*3 + cx);
      c.fillStyle = 'rgba(255,190,90,'+gl.toFixed(3)+')';
      c.beginPath(); c.arc(X+8, Y-2, 24, 0, Math.PI*2); c.fill();
      break;
    }
    case T.HEARTH: {
      const gl = 0.16 + 0.07*Math.sin(G.time*4);
      c.fillStyle='rgba(255,170,70,'+gl.toFixed(3)+')';
      c.beginPath(); c.arc(X+8, Y+10, 30, 0, Math.PI*2); c.fill();
      break;
    }
    case T.LIFTCAGE: {
      if(G.locks && G.locks.elevator){
        c.fillStyle='rgba(63,181,168,'+(0.10+0.05*Math.sin(G.time*3)).toFixed(3)+')';
        c.beginPath(); c.arc(X+8, Y-14, 24, 0, Math.PI*2); c.fill();
      }
      break;
    }
    case T.SEAL: {
      const gl = 0.10 + 0.05*Math.sin(G.time*3+cx);
      c.fillStyle='rgba(63,181,168,'+gl.toFixed(3)+')';
      c.beginPath(); c.arc(X+8, Y-6, 26, 0, Math.PI*2); c.fill();
      break;
    }
    case T.GEMCLUSTER: {
      const A = accentAt(cx,cy);
      const gl = 0.30+0.16*Math.sin(G.time*2.0 + (cx*1.1+cy*0.6));
      c.globalAlpha = gl; c.fillStyle = A.c;
      c.beginPath(); c.arc(X+8, Y-4, 20, 0, Math.PI*2); c.fill();
      c.globalAlpha = 1;
      break;
    }
    case T.NODE: {
      const M = (area.nodeMat && MAT_BY_ID[area.nodeMat]) || MATERIALS[0];
      if(G.nodesDone && G.nodesDone[area.id+':'+cx+','+cy] > 0) break;
      const gl = 0.16+0.10*Math.sin(G.time*2.2 + cx*0.9 + cy*0.5);
      c.globalAlpha = gl; c.fillStyle = M.col.lit;
      c.beginPath(); c.arc(X+8, Y-6, 14, 0, Math.PI*2); c.fill();
      c.globalAlpha = 1;
      break;
    }
    case T.PYLON: {
      if(Math.sin(G.time*2.2+cx)>0.3){
        c.fillStyle='rgba(143,214,255,0.10)';
        c.beginPath(); c.arc(X+8, Y-23, 20, 0, Math.PI*2); c.fill();
      }
      break;
    }
    case T.BRAZIER: {
      const gl = 0.15 + 0.06*Math.sin(G.time*5+cx);
      c.fillStyle='rgba(255,170,70,'+gl.toFixed(3)+')';
      c.beginPath(); c.arc(X+8, Y+4, 34, 0, Math.PI*2); c.fill();
      break;
    }
  }
}
