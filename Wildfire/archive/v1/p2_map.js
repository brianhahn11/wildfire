
// ============================================================================
// THE RUSTFIELDS — rolling plains dotted with rusted machinery and abandoned
// mining rigs. Assembled from hand-placed props on a noise-driven ground bed,
// which is the cheap stand-in for the GDD's hand-crafted room tiles.
// ============================================================================

function idx(cx,cy){ return cy*MAP_W+cx; }
function inBounds(cx,cy){ return cx>=0 && cy>=0 && cx<MAP_W && cy<MAP_H; }

function valueNoise(rng,w,h,scale){
  const gw=Math.ceil(w/scale)+2, gh=Math.ceil(h/scale)+2, g=new Float32Array(gw*gh);
  for(let i=0;i<g.length;i++) g[i]=rng();
  const out=new Float32Array(w*h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const fx=x/scale, fy=y/scale, x0=Math.floor(fx), y0=Math.floor(fy);
    const tx=fx-x0, ty=fy-y0, sx=tx*tx*(3-2*tx), sy=ty*ty*(3-2*ty);
    const a=g[y0*gw+x0], b=g[y0*gw+x0+1], c=g[(y0+1)*gw+x0], d=g[(y0+1)*gw+x0+1];
    out[y*w+x]=lerp(lerp(a,b,sx),lerp(c,d,sx),sy);
  }
  return out;
}

function generateArena(seed){
  const rng = makeRng(seed);
  G.rng = rng;
  const map = new Uint8Array(MAP_W*MAP_H);
  const n1 = valueNoise(rng, MAP_W, MAP_H, 7.0);
  const n2 = valueNoise(rng, MAP_W, MAP_H, 2.8);

  for(let y=0;y<MAP_H;y++) for(let x=0;x<MAP_W;x++){
    const v = n1[y*MAP_W+x]*0.7 + n2[y*MAP_W+x]*0.3;
    let t;
    if(v < 0.36) t = T.DIRT;
    else if(v < 0.44) t = T.GRAVEL;
    else if(v < 0.62) t = T.GRASS;
    else t = T.DRY;
    map[idx(x,y)] = t;
  }

  // worn plating where the old haul road ran
  const roadY = 8 + Math.floor(rng()*8);
  for(let x=0;x<MAP_W;x++){
    const wob = Math.round(Math.sin(x*0.22)*2 + Math.sin(x*0.07)*2);
    for(let y=roadY+wob-1; y<=roadY+wob+1; y++)
      if(inBounds(x,y)) map[idx(x,y)] = rng()<0.22 ? T.GRAVEL : T.PLATE;
  }

  // solid arena border so nothing walks off the map
  for(let x=0;x<MAP_W;x++){ map[idx(x,0)]=T.RUBBLE; map[idx(x,MAP_H-1)]=T.RUBBLE; }
  for(let y=0;y<MAP_H;y++){ map[idx(0,y)]=T.RUBBLE; map[idx(MAP_W-1,y)]=T.RUBBLE; }

  G.map = map;
  G.props = [];

  // --- abandoned mining rigs: multi-tile landmark props
  const rigCount = 2 + Math.floor(rng()*2);
  for(let r=0;r<rigCount;r++){
    for(let a=0;a<80;a++){
      const x = 4+Math.floor(rng()*(MAP_W-10)), y = 4+Math.floor(rng()*(MAP_H-10));
      if(nearSpawn(x,y,7)) continue;
      if(G.props.some(p=>Math.abs(p.x-x)<9 && Math.abs(p.y-y)<7)) continue;
      G.props.push({ kind:'rig', x, y, w:4, h:3 });
      for(let oy=0;oy<3;oy++) for(let ox=0;ox<4;ox++)
        if(inBounds(x+ox,y+oy)) map[idx(x+ox,y+oy)] = T.RIG;
      break;
    }
  }

  // --- pipe runs: short walls that shape the fighting space
  for(let p=0;p<5;p++){
    for(let a=0;a<60;a++){
      const horiz = rng()<0.5, len = 3+Math.floor(rng()*4);
      const x = 3+Math.floor(rng()*(MAP_W-8)), y = 3+Math.floor(rng()*(MAP_H-8));
      if(nearSpawn(x,y,6)) continue;
      let ok=true;
      for(let i=0;i<len;i++){
        const cx=x+(horiz?i:0), cy=y+(horiz?0:i);
        if(!inBounds(cx,cy) || SOLID[map[idx(cx,cy)]]) { ok=false; break; }
      }
      if(!ok) continue;
      for(let i=0;i<len;i++){
        const cx=x+(horiz?i:0), cy=y+(horiz?0:i);
        map[idx(cx,cy)] = T.PIPE;
      }
      G.props.push({ kind:'pipe', x, y, horiz, len });
      break;
    }
  }

  // --- scattered crates and rubble for cover
  for(let k=0;k<26;k++){
    const x = 2+Math.floor(rng()*(MAP_W-4)), y = 2+Math.floor(rng()*(MAP_H-4));
    if(nearSpawn(x,y,5) || SOLID[map[idx(x,y)]]) continue;
    map[idx(x,y)] = rng()<0.45 ? T.CRATE : T.RUBBLE;
  }

  G.dirty = true;
  renderTerrain();
  return map;
}

// keep the player's landing zone clear
function nearSpawn(x,y,r){ return Math.abs(x-SPAWN_TX) < r && Math.abs(y-SPAWN_TY) < r; }
const SPAWN_TX = 6, SPAWN_TY = 12;

function walkableTile(cx,cy){
  if(!inBounds(cx,cy)) return false;
  return !SOLID[G.map[idx(cx,cy)]];
}
// 10x8 body box, feet-anchored
function canStand(px,py){
  return walkableTile(Math.floor((px-5)/TILE), Math.floor((py-3)/TILE))
      && walkableTile(Math.floor((px+5)/TILE), Math.floor((py-3)/TILE))
      && walkableTile(Math.floor((px-5)/TILE), Math.floor((py+4)/TILE))
      && walkableTile(Math.floor((px+5)/TILE), Math.floor((py+4)/TILE));
}

// ---------------------------------------------------------------- tile art
function tp(c,x,y,w,h){ tctx.fillStyle=c; tctx.fillRect(x,y,w||1,h||1); }

function drawTile(cx,cy){
  const t=G.map[idx(cx,cy)], X=cx*TILE, Y=cy*TILE;
  const h=hash2(cx,cy), h2=hash2(cx+53,cy+91), h3=hash2(cx*7,cy*3);
  switch(t){
    case T.GRASS: {
      tp(PAL.grass,X,Y,16,16);
      for(let k=0;k<8;k++){
        const gx=(hash2(cx*13+k,cy*7)*15)|0, gy=(hash2(cx*5,cy*17+k)*14)|0;
        tp(k%3?PAL.grassD:PAL.grassL,X+gx,Y+gy,1,2);
      }
      break;
    }
    case T.DRY: {
      tp(PAL.grassDry,X,Y,16,16);
      for(let k=0;k<6;k++){
        const gx=(hash2(cx*11+k,cy*19)*15)|0, gy=(hash2(cx*3,cy*23+k)*14)|0;
        tp(k%2?PAL.grassL:PAL.grass,X+gx,Y+gy,2,1);
      }
      if(h>0.86){ tp(PAL.grassD,X+5,Y+6,1,5); tp(PAL.grassD,X+8,Y+4,1,7); } // dead stalks
      break;
    }
    case T.DIRT: {
      tp(PAL.dirt,X,Y,16,16);
      for(let k=0;k<7;k++){
        const gx=(hash2(cx*3+k,cy*11)*15)|0, gy=(hash2(cx+k,cy*3)*15)|0;
        tp(k%2?PAL.dirtD:PAL.dirtL,X+gx,Y+gy,2,1);
      }
      break;
    }
    case T.GRAVEL: {
      tp(PAL.dirtD,X,Y,16,16);
      for(let k=0;k<10;k++){
        const gx=(hash2(cx*17+k,cy*5)*15)|0, gy=(hash2(cx*9,cy*13+k)*15)|0;
        tp(k%3===0?PAL.stoneL:PAL.stone,X+gx,Y+gy,2,2);
      }
      break;
    }
    case T.PLATE: {
      // riveted haul-road plating, rusting through
      tp(PAL.iron,X,Y,16,16);
      tp(PAL.ironD,X,Y,16,1); tp(PAL.ironD,X,Y,1,16);
      tp(PAL.ironL,X,Y+15,16,1); tp(PAL.ironL,X+15,Y,1,16);
      tp(PAL.ironD,X+2,Y+2,1,1); tp(PAL.ironD,X+13,Y+2,1,1);
      tp(PAL.ironD,X+2,Y+13,1,1); tp(PAL.ironD,X+13,Y+13,1,1);
      if(h>0.55){ tp(PAL.rust,X+4+((h2*6)|0),Y+5+((h*6)|0),4,3); tp(PAL.rustD,X+5+((h2*6)|0),Y+6+((h*6)|0),2,1); }
      break;
    }
    case T.RUBBLE: {
      tp(PAL.dirtD,X,Y,16,16);
      const R=[[3,4,9],[4,2,12],[5,2,12],[6,1,14],[7,1,14],[8,2,12],[9,3,10],[10,4,8],[11,5,6]];
      for(const r of R) tp(PAL.stoneD,X+r[1],Y+r[0],r[2],1);
      for(const r of R) if(r[2]>7) tp(PAL.stone,X+r[1]+1,Y+r[0],r[2]-3,1);
      tp(PAL.stoneL,X+4,Y+4,3,1); tp(PAL.stoneL,X+3,Y+5,2,1);
      if(h>0.7){ tp(PAL.rust,X+9,Y+8,3,4); tp(PAL.rustD,X+9,Y+8,1,4); }   // rebar
      break;
    }
    case T.CRATE: {
      tp(PAL.dirt,X,Y,16,16);
      tp('rgba(20,12,8,.3)',X+1,Y+12,14,3);
      tp(PAL.rustD,X+2,Y+3,12,11);
      tp(PAL.rust, X+3,Y+4,10,9);
      tp(PAL.rustL,X+3,Y+4,10,1);
      tp(PAL.rustD,X+3,Y+8,10,1);                 // banding
      tp(PAL.brass,X+7,Y+7,2,3);                  // latch
      tp(PAL.brassL,X+7,Y+7,2,1);
      break;
    }
    case T.PIPE: {
      tp(PAL.dirt,X,Y,16,16);
      tp('rgba(20,12,8,.3)',X,Y+12,16,3);
      tp(PAL.ironD,X,Y+4,16,9);
      tp(PAL.iron, X,Y+5,16,7);
      tp(PAL.ironL,X,Y+5,16,1);
      tp(PAL.rust, X+((h*8)|0),Y+7,4,4);
      tp(PAL.brassD,X+6,Y+3,4,11); tp(PAL.brass,X+6,Y+3,4,1);  // coupling collar
      break;
    }
    case T.RIG: {
      // drawn as a whole in drawProps(); ground bed only here
      tp(PAL.dirtD,X,Y,16,16);
      for(let k=0;k<6;k++){
        const gx=(hash2(cx*7+k,cy*3)*15)|0, gy=(hash2(cx,cy*9+k)*15)|0;
        tp(PAL.stoneD,X+gx,Y+gy,2,1);
      }
      break;
    }
  }
}

function drawProps(){
  for(const p of G.props){
    if(p.kind!=='rig') continue;
    const X=p.x*TILE, Y=p.y*TILE, W=p.w*TILE, H=p.h*TILE;   // 64 x 48
    const MX = X + W/2;
    tp('rgba(20,12,8,.38)', X+4, Y+H-7, W-8, 7);

    // --- spoil heap at the foot of the rig
    tp(PAL.dirtD, X+2,  Y+H-9, 14, 9);
    tp(PAL.dirt,  X+4,  Y+H-8, 10, 8);
    tp(PAL.stoneD,X+6,  Y+H-6, 4, 3);

    // --- headframe: two legs that taper inward toward the sheave wheel
    // drawn as stepped diagonals so it reads as a truss, not a wall
    for(let i=0;i<11;i++){
      const ly = Y + 7 + i*3;                       // down the leg
      const spreadT = i/10;
      const off = Math.round(7 + spreadT*17);       // narrow at top, wide at base
      tp(PAL.ironD, MX-off-2, ly, 3, 3);
      tp(PAL.iron,  MX-off-2, ly, 1, 3);
      tp(PAL.ironD, MX+off-1, ly, 3, 3);
      tp(PAL.iron,  MX+off-1, ly, 1, 3);
      // X-bracing between the legs every other step
      if(i%2===0 && i>0){
        const offPrev = Math.round(7 + ((i-1)/10)*17);
        for(let s=0;s<=6;s++){
          const q=s/6;
          tp(PAL.ironL, Math.round(lerp(MX-off, MX+offPrev, q)), Math.round(lerp(ly, ly-3, q)), 1, 1);
          tp(PAL.ironL, Math.round(lerp(MX+off, MX-offPrev, q)), Math.round(lerp(ly, ly-3, q)), 1, 1);
        }
      }
    }

    // --- sheave wheel at the apex, brass with an amber aethite core
    tp(PAL.brassD, MX-7, Y+1, 14, 10);
    tp(PAL.brass,  MX-6, Y+2, 12, 8);
    tp(PAL.brassD, MX-6, Y+5, 12, 2);               // rim groove
    tp(PAL.brassL, MX-5, Y+3, 4, 2);
    tp(PAL.amberD, MX-3, Y+4, 6, 4);
    tp(PAL.amber,  MX-2, Y+5, 4, 2);
    tp(PAL.amberL, MX-2, Y+5, 2, 1);
    // hoist cable dropping into the shaft
    tp(PAL.ironL, MX-1, Y+11, 1, H-20);
    tp(PAL.ironD, MX+1, Y+11, 1, H-22);

    // --- winch house at the base, corrugated with a lit window
    const hw = 22, hx = X+3, hy = Y+H-20;
    tp(PAL.ironD, hx, hy, hw, 18);
    tp(PAL.iron,  hx+1, hy+1, hw-2, 16);
    for(let i=0;i<5;i++) tp(PAL.ironD, hx+1, hy+2+i*3, hw-2, 1);   // corrugation
    tp(PAL.rustD, hx+2, hy+9, 9, 7); tp(PAL.rust, hx+2, hy+9, 9, 6);
    tp(PAL.amberD, hx+hw-9, hy+4, 6, 5);
    tp(PAL.amber,  hx+hw-8, hy+5, 4, 3);            // window glow

    // --- vent stack, still smoking after all these years
    const vx = X+W-13;
    tp(PAL.ironD, vx, Y+H-24, 7, 24);
    tp(PAL.iron,  vx+1, Y+H-23, 5, 23);
    tp(PAL.brassD,vx-1, Y+H-26, 9, 3);
    tp(PAL.brass, vx-1, Y+H-26, 9, 1);
    tp(PAL.rust,  vx+1, Y+H-12, 5, 4);
  }
}

function renderTerrain(){
  for(let y=0;y<MAP_H;y++) for(let x=0;x<MAP_W;x++) drawTile(x,y);
  drawProps();
  G.dirty=false;
}
