const zlib=require('zlib');
// ---- 5x7 bitmap font (uppercase, digits, punctuation) ----
const F={};
const RAW={
A:"01110 10001 10001 11111 10001 10001 10001",B:"11110 10001 10001 11110 10001 10001 11110",
C:"01111 10000 10000 10000 10000 10000 01111",D:"11110 10001 10001 10001 10001 10001 11110",
E:"11111 10000 10000 11110 10000 10000 11111",F:"11111 10000 10000 11110 10000 10000 10000",
G:"01111 10000 10000 10111 10001 10001 01111",H:"10001 10001 10001 11111 10001 10001 10001",
I:"11111 00100 00100 00100 00100 00100 11111",J:"00111 00010 00010 00010 00010 10010 01100",
K:"10001 10010 10100 11000 10100 10010 10001",L:"10000 10000 10000 10000 10000 10000 11111",
M:"10001 11011 10101 10101 10001 10001 10001",N:"10001 11001 10101 10011 10001 10001 10001",
O:"01110 10001 10001 10001 10001 10001 01110",P:"11110 10001 10001 11110 10000 10000 10000",
Q:"01110 10001 10001 10001 10101 10010 01101",R:"11110 10001 10001 11110 10100 10010 10001",
S:"01111 10000 10000 01110 00001 00001 11110",T:"11111 00100 00100 00100 00100 00100 00100",
U:"10001 10001 10001 10001 10001 10001 01110",V:"10001 10001 10001 10001 10001 01010 00100",
W:"10001 10001 10001 10101 10101 11011 10001",X:"10001 01010 00100 00100 00100 01010 10001",
Y:"10001 01010 00100 00100 00100 00100 00100",Z:"11111 00010 00100 01000 10000 10000 11111",
"0":"01110 10001 10011 10101 11001 10001 01110","1":"00100 01100 00100 00100 00100 00100 01110",
"2":"01110 10001 00001 00010 00100 01000 11111","3":"11111 00010 00100 00010 00001 10001 01110",
"4":"00010 00110 01010 10010 11111 00010 00010","5":"11111 10000 11110 00001 00001 10001 01110",
"6":"00110 01000 10000 11110 10001 10001 01110","7":"11111 00001 00010 00100 01000 01000 01000",
"8":"01110 10001 10001 01110 10001 10001 01110","9":"01110 10001 10001 01111 00001 00010 01100",
"/":"00001 00010 00010 00100 01000 01000 10000","-":"00000 00000 00000 11111 00000 00000 00000",
"+":"00000 00100 00100 11111 00100 00100 00000","%":"11001 11010 00010 00100 01000 01011 10011",
".":"00000 00000 00000 00000 00000 01100 01100",":":"00000 01100 01100 00000 01100 01100 00000",
"!":"00100 00100 00100 00100 00100 00000 00100","?":"01110 10001 00001 00010 00100 00000 00100",
"(":"00010 00100 01000 01000 01000 00100 00010",")":"01000 00100 00010 00010 00010 00100 01000",
"[":"01110 01000 01000 01000 01000 01000 01110","]":"01110 00010 00010 00010 00010 00010 01110",
"<":"00010 00100 01000 10000 01000 00100 00010",">":"01000 00100 00010 00001 00010 00100 01000",
"*":"00000 10101 01110 11111 01110 10101 00000","#":"01010 01010 11111 01010 11111 01010 01010",
",":"00000 00000 00000 00000 01100 01100 01000","'":"00100 00100 00000 00000 00000 00000 00000",
"|":"00100 00100 00100 00100 00100 00100 00100",
"\u2191":"00100 01110 10101 00100 00100 00100 00100",
"\u2193":"00100 00100 00100 00100 10101 01110 00100",
"\u2190":"00000 00100 01000 11111 01000 00100 00000",
"\u2192":"00000 00100 00010 11111 00010 00100 00000",
"\u25b8":"01000 01100 01110 01111 01110 01100 01000",
"\u25be":"00000 11111 01110 01110 00100 00100 00000",
"\u25c6":"00100 01110 11111 11111 11111 01110 00100",
"\u25c8":"00100 01110 11011 10001 11011 01110 00100",
"\u2014":"00000 00000 00000 11111 00000 00000 00000",
"\u00b7":"00000 00000 00000 01100 01100 00000 00000",
"\u00d7":"00000 10001 01010 00100 01010 10001 00000",
"\u00b0":"01110 01010 01110 00000 00000 00000 00000",
'\"':"01010 01010 00000 00000 00000 00000 00000",
" ":"00000 00000 00000 00000 00000 00000 00000",
"▶":"01000 01100 01110 01111 01110 01100 01000","▼":"00000 11111 01110 01110 00100 00100 00000",
"▲":"00000 00100 00100 01110 01110 11111 00000","◀":"00010 00110 01110 11110 01110 00110 00010",
};
for(const k in RAW) F[k]=RAW[k].split(' ').map(r=>r.split('').map(Number));

// Memoised. The same few dozen palette strings are parsed millions of times
// in a run, and at device resolution "millions" became "tens of millions".
const COLCACHE = new Map();
function parseCol(s){
  const hit = COLCACHE.get(s);
  if(hit !== undefined) return hit;
  const v = parseColRaw(s);
  if(typeof s === 'string' && COLCACHE.size < 4096) COLCACHE.set(s, v);
  return v;
}
function parseColRaw(s){
  if(typeof s!=='string') return [255,0,255,1];
  s=s.trim();
  if(s[0]==='#'){
    if(s.length===4) return [parseInt(s[1]+s[1],16),parseInt(s[2]+s[2],16),parseInt(s[3]+s[3],16),1];
    return [parseInt(s.slice(1,3),16),parseInt(s.slice(3,5),16),parseInt(s.slice(5,7),16),1];
  }
  const m=s.match(/rgba?\(([^)]+)\)/);
  if(m){ const p=m[1].split(',').map(v=>parseFloat(v)); return [p[0]|0,p[1]|0,p[2]|0,p.length>3?p[3]:1]; }
  return [255,0,255,1];
}

// A gradient's coordinates are in USER space, but `at()` is asked about DEVICE
// pixels. Browsers do this mapping; the shim did not, so a gradient created
// under a scaled context was evaluated as though its centre and radii were
// device pixels. The screen vignette, created at (VW/2, VH/2) r=280 in world
// units, rendered centred on the top-left quadrant at half its intended size —
// and looked exactly like a game bug.
//
// The transform is captured at CREATION. The spec says a gradient is resolved
// against the transform in force when it is PAINTED; this codebase always
// creates and uses one under the same transform, so the two agree here. If a
// gradient is ever built under one transform and filled under another, this
// will be wrong and the difference will be silent.
class Grad{
  constructor(x0,y0,r0,x1,y1,r1,tf){
    this.x0=x0;this.y0=y0;this.r0=r0;this.x1=x1;this.y1=y1;this.r1=r1;this.stops=[];
    this.tf = tf || { sx:1, sy:1, tx:0, ty:0 };
  }
  addColorStop(t,c){ this.stops.push([t,parseCol(c)]); this.stops.sort((a,b)=>a[0]-b[0]); this._ramp=null; }
  // Resolved once per fill rather than per pixel: which pair of stops applies
  // and the deltas between them. Interpolation itself stays exact — a lookup
  // table was tried and quantised the vignette by a colour step, which showed
  // up as a 10% pixel difference against the reference and would have had to
  // be explained away on every future comparison.
  ramp(){
    if(this._ramp) return this._ramp;
    const st=this.stops;
    return (this._ramp = st.map((sp,i)=>{
      const nx = st[i+1] || sp;
      return { t0:sp[0], t1:nx[0], c:sp[1], d:[0,1,2,3].map(k=>nx[1][k]-sp[1][k]) };
    }));
  }
  at(X,Y){
    // device -> the user space this gradient was created in
    const M=this.tf;
    const x=(X-M.tx)/(M.sx||1), y=(Y-M.ty)/(M.sy||1);
    const d=Math.hypot(x-this.x1,y-this.y1);
    let t=(d-this.r0)/(this.r1-this.r0); t=Math.max(0,Math.min(1,t));
    const st=this.stops; if(!st.length) return [0,0,0,0];
    let a=st[0],b=st[st.length-1];
    for(let i=0;i<st.length-1;i++) if(t>=st[i][0]&&t<=st[i+1][0]){a=st[i];b=st[i+1];break;}
    const span=(b[0]-a[0])||1, k=(t-a[0])/span;
    return [0,1,2,3].map(i=>a[1][i]+(b[1][i]-a[1][i])*k);
  }
}

class Ctx{
  constructor(cv){ this.cv=cv; this.fillStyle='#000'; this.strokeStyle='#000'; this.lineWidth=1;
    this.font='8px'; this.textAlign='left'; this.textBaseline='alphabetic'; this.globalAlpha=1;
    this.imageSmoothingEnabled=false; this._tx=0; this._ty=0; this._sx=1; this._sy=1;
    this._stack=[]; this._path=[]; }
  save(){ this._stack.push([this._tx,this._ty,this._sx,this._sy,this.globalAlpha]); }
  restore(){ const s=this._stack.pop();
    if(s){ this._tx=s[0]; this._ty=s[1]; this._sx=s[2]; this._sy=s[3]; this.globalAlpha=s[4]; } }
  translate(x,y){ this._tx+=x*this._sx; this._ty+=y*this._sy; }
  scale(sx,sy){ this._sx*=sx; this._sy*=(sy===undefined?sx:sy); }
  rotate(){}
  // Was: ignore the arguments and reset to identity. That is a lie that
  // happens to be harmless only while nothing uses the arguments — and the
  // render scale is about to. Skew (b, c) is still unsupported because this
  // project has never used it; asking for it throws rather than quietly
  // dropping it.
  setTransform(a,b,cc,d,e,f){
    if(a===undefined){ this._tx=0; this._ty=0; this._sx=1; this._sy=1; return; }
    if(b||cc) throw new Error('shim setTransform: skew is not supported (b='+b+', c='+cc+')');
    this._sx=a; this._sy=d; this._tx=e||0; this._ty=f||0;
  }
  getTransform(){ return { a:this._sx, b:0, c:0, d:this._sy, e:this._tx, f:this._ty }; }
  resetTransform(){ this.setTransform(); }
  _X(x){ return this._tx + x*this._sx; }
  _Y(y){ return this._ty + y*this._sy; }
  createRadialGradient(x0,y0,r0,x1,y1,r1){
    return new Grad(x0,y0,r0,x1,y1,r1,
                    { sx:this._sx, sy:this._sy, tx:this._tx, ty:this._ty });
  }
  createLinearGradient(){ return new Grad(0,0,0,0,0,1); }
  _px(x,y,c,a){
    const cv=this.cv; x|=0; y|=0;
    if(x<0||y<0||x>=cv.width||y>=cv.height) return;
    const sa=a*this.globalAlpha; if(sa<=0) return;
    const i=(y*cv.width+x)*4, d=cv.data;
    const da=d[i+3];
    const oa=sa+da*(1-sa);
    if(oa<=0){ d[i+3]=0; return; }
    d[i]  =(c[0]*sa + d[i]  *da*(1-sa))/oa;
    d[i+1]=(c[1]*sa + d[i+1]*da*(1-sa))/oa;
    d[i+2]=(c[2]*sa + d[i+2]*da*(1-sa))/oa;
    d[i+3]=oa;
  }
  fillRect(x,y,w,h){
    const X0=this._X(x), Y0=this._Y(y);
    x=Math.round(X0); y=Math.round(Y0);
    w=Math.round(w*this._sx); h=Math.round(h*this._sy);
    if(w<=0||h<=0) return;
    const g = this.fillStyle instanceof Grad ? this.fillStyle : null;
    const c = g?null:parseCol(this.fillStyle);
    const cv=this.cv, CW=cv.width, CH=cv.height, d=cv.data;
    // Clamp once rather than testing every pixel inside the loop.
    const x0=Math.max(0,x), x1=Math.min(CW,x+w);
    const y0=Math.max(0,y), y1=Math.min(CH,y+h);
    if(x0>=x1||y0>=y1) return;

    // Opaque, ungradiented fills are the overwhelming majority of this
    // project's drawing — every tile, every sprite pixel. Writing them
    // straight into the buffer skips the blend arithmetic and the per-pixel
    // call, which is most of the cost of a render at device resolution.
    if(!g && this.globalAlpha>=1 && c[3]>=1){
      const r=c[0], gg=c[1], b=c[2];
      for(let j=y0;j<y1;j++){
        let k=(j*CW+x0)*4;
        for(let i=x0;i<x1;i++){ d[k]=r; d[k+1]=gg; d[k+2]=b; d[k+3]=1; k+=4; }
      }
      return;
    }
    if(g){
      const R=g.ramp(), M=g.tf;
      const isx=1/(M.sx||1), isy=1/(M.sy||1);
      const r0=g.r0, dr=(g.r1-g.r0)||1;
      const ga=this.globalAlpha;
      const v=[0,0,0,0];
      const nR=R.length;
      for(let j=y0;j<y1;j++){
        const uy=(j-M.ty)*isy - g.y1;
        for(let i=x0;i<x1;i++){
          const ux=(i-M.tx)*isx - g.x1;
          let t=(Math.sqrt(ux*ux+uy*uy)-r0)/dr;
          t = t<0?0 : t>1?1 : t;
          let a=R[nR-1];
          for(let k=0;k<nR-1;k++) if(t>=R[k].t0 && t<=R[k].t1){ a=R[k]; break; }
          const span=(a.t1-a.t0)||1, u=(t-a.t0)/span;
          v[0]=a.c[0]+a.d[0]*u; v[1]=a.c[1]+a.d[1]*u; v[2]=a.c[2]+a.d[2]*u;
          this._px(i,j,v,(a.c[3]+a.d[3]*u)*ga);
        }
      }
      return;
    }
    for(let j=y0;j<y1;j++) for(let i=x0;i<x1;i++) this._px(i,j,c,c[3]);
  }
  strokeRect(x,y,w,h){
    const c=parseCol(this.strokeStyle);
    const X=Math.round(this._X(x)),Y=Math.round(this._Y(y)),
          W=Math.round(w*this._sx),H=Math.round(h*this._sy);
    for(let i=X;i<X+W;i++){ this._px(i,Y,c,c[3]); this._px(i,Y+H-1,c,c[3]); }
    for(let j=Y;j<Y+H;j++){ this._px(X,j,c,c[3]); this._px(X+W-1,j,c,c[3]); }
  }
  clearRect(x,y,w,h){
    const cv=this.cv;
    const X=Math.round(this._X(x)), Y=Math.round(this._Y(y));
    const W=Math.round(w*this._sx), H=Math.round(h*this._sy);
    for(let j=Y;j<Y+H;j++) for(let i=X;i<X+W;i++){
      if(i<0||j<0||i>=cv.width||j>=cv.height) continue;
      const k=(j*cv.width+i)*4;
      cv.data[k]=0; cv.data[k+1]=0; cv.data[k+2]=0; cv.data[k+3]=0;
    }
  }
  beginPath(){ this._path=[]; this._lastArc=null; }
  moveTo(x,y){ this._path.push(['m',x,y]); }
  lineTo(x,y){ this._path.push(['l',x,y]); }
  closePath(){}
  rect(x,y,w,h){ this._path.push(['m',x,y],['l',x+w,y],['l',x+w,y+h],['l',x,y+h],['l',x,y]); }
  // Not implemented. Anything drawn inside a save()/clip()/restore() here
  // renders unclipped, so a rendered PNG can show a sprite spilling out of a
  // panel that a real browser would have cut off. If a thumbnail looks like
  // it is overflowing its cell, check this before chasing it in the layout.
  clip(){}
  arc(x,y,r,a0,a1,ccw){
    this._lastArc={x,y,rx:r*Math.abs(this._sx),ry:r*Math.abs(this._sy),a0,a1};
    let span=a1-a0;
    if(ccw){ while(span>0) span-=Math.PI*2; } else { while(span<0) span+=Math.PI*2; }
    const steps=Math.max(6, Math.min(64, Math.ceil(Math.abs(span)/0.12)));
    for(let i=0;i<=steps;i++){
      const a=a0+span*(i/steps);
      const px=x+Math.cos(a)*r, py=y+Math.sin(a)*r;
      this._path.push([i===0&&this._path.length===0?'m':'l', px, py]);
    }
  }
  // A real ellipse, not a circle of the mean radius. The old approximation
  // made every flat shape in the game — reticles, ground rings, the Phantom's
  // puddle — render as a disc here, so anything shaped like a puddle could
  // not be checked at all without a browser.
  ellipse(x,y,rx,ry,rot,a0,a1,ccw){
    const sx=Math.abs(this._sx), sy=Math.abs(this._sy);
    this._lastArc={x,y,rx:rx*sx,ry:ry*sy,a0,a1};
    let span=(a1===undefined?Math.PI*2:a1-a0);
    if(ccw){ while(span>0) span-=Math.PI*2; } else { while(span<0) span+=Math.PI*2; }
    const steps=Math.max(8, Math.min(72, Math.ceil(Math.abs(span)/0.10)));
    for(let i=0;i<=steps;i++){
      const a=(a0||0)+span*(i/steps);
      this._path.push([i===0&&this._path.length===0?'m':'l',
                       x+Math.cos(a)*rx, y+Math.sin(a)*ry]);
    }
  }
  fill(){
    // only discs and ellipses are ever filled in this project
    const A=this._lastArc; if(!A) return;
    const g=this.fillStyle instanceof Grad?this.fillStyle:null;
    const c=g?null:parseCol(this.fillStyle);
    const rx=Math.max(0.5,A.rx), ry=Math.max(0.5,A.ry);
    const bx=Math.ceil(rx), by=Math.ceil(ry);
    for(let j=-by;j<=by;j++) for(let i=-bx;i<=bx;i++){
      if((i*i)/(rx*rx) + (j*j)/(ry*ry) > 1) continue;
      const X=Math.round(this._X(A.x)+i), Y=Math.round(this._Y(A.y)+j);
      if(g){ const v=g.at(X,Y); this._px(X,Y,v,v[3]); } else this._px(X,Y,c,c[3]);
    }
  }
  stroke(){
    const c=parseCol(this.strokeStyle); let px=0,py=0;
    for(const p of this._path){
      if(p[0]==='m'){ px=p[1]; py=p[2]; continue; }
      let x0=Math.round(this._X(px)),y0=Math.round(this._Y(py)),
          x1=Math.round(this._X(p[1])),y1=Math.round(this._Y(p[2]));
      const dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1; let err=dx+dy;
      for(;;){ this._px(x0,y0,c,c[3]); if(x0===x1&&y0===y1) break; const e2=2*err;
        if(e2>=dy){err+=dy;x0+=sx;} if(e2<=dx){err+=dx;y0+=sy;} }
      px=p[1]; py=p[2];
    }
  }
  _size(){ const m=this.font.match(/(\d+)px/); return m?parseInt(m[1]):8; }
  _scale(){ return Math.max(1, Math.round(this._size()/8)); }
  measureText(t){ const s=this._scale(); return { width: String(t).length*6*s }; }
  fillText(t,x,y){
    t=String(t).toUpperCase(); const s=this._scale();
    let X=this._X(x), Y=this._Y(y);
    const w=t.length*6*s;
    if(this.textAlign==='center') X-=w/2; else if(this.textAlign==='right') X-=w;
    if(this.textBaseline!=='top') Y-=7*s;      // approximate alphabetic baseline
    const c=parseCol(this.fillStyle);
    for(let ci=0;ci<t.length;ci++){
      const g=F[t[ci]]||F['?'];
      for(let r=0;r<7;r++) for(let col=0;col<5;col++){
        if(!g[r][col]) continue;
        for(let sy=0;sy<s;sy++) for(let sx=0;sx<s;sx++)
          this._px(Math.round(X+ci*6*s+col*s+sx), Math.round(Y+r*s+sy), c, c[3]);
      }
    }
  }
  drawImage(img,a,b,cW,dH,eX,fY,gW,hH){
    const s=img._canvas||img;
    // 3-arg: whole image at (a,b).
    // 5-arg: whole image into a destination rect — this is the one the
    //        terrain blit uses, to draw a device-resolution buffer into a
    //        context that is already scaled. It used to fall through to the
    //        3-arg branch and come out at double size.
    // 9-arg: source rect -> dest rect.
    let sx=0, sy=0, sw=s.width, sh=s.height, dx, dy, dw, dh;
    if(arguments.length>=9){ sx=a; sy=b; sw=cW; sh=dH; dx=eX; dy=fY; dw=gW; dh=hH; }
    else if(arguments.length===5){ dx=a; dy=b; dw=cW; dh=dH; }
    else { dx=a; dy=b; dw=sw; dh=sh; }
    dx=Math.round(this._X(dx)); dy=Math.round(this._Y(dy));
    dw=Math.round(dw*this._sx); dh=Math.round(dh*this._sy);

    // The terrain blit is a device-resolution buffer going onto a
    // device-resolution canvas, 1:1, opaque, every frame — half a million
    // pixels through the general path. When nothing is being resampled and
    // nothing is translucent, copy rows.
    if(dw===sw && dh===sh && this.globalAlpha>=1){
      const cv=this.cv, CW=cv.width, CH=cv.height, d=cv.data;
      const i0=Math.max(0,-dx), i1=Math.min(dw, CW-dx);
      const j0=Math.max(0,-dy), j1=Math.min(dh, CH-dy);
      for(let j=j0;j<j1;j++){
        let sk=((sy+j)*s.width+(sx+i0))*4, dk=((dy+j)*CW+(dx+i0))*4;
        for(let i=i0;i<i1;i++){
          const sa=s.data[sk+3];
          if(sa>=1){ d[dk]=s.data[sk]; d[dk+1]=s.data[sk+1]; d[dk+2]=s.data[sk+2]; d[dk+3]=1; }
          else if(sa>0) this._px(dx+i, dy+j, [s.data[sk],s.data[sk+1],s.data[sk+2]], sa);
          sk+=4; dk+=4;
        }
      }
      return;
    }
    for(let j=0;j<dh;j++) for(let i=0;i<dw;i++){
      const px2=sx+Math.floor(i*sw/dw), py2=sy+Math.floor(j*sh/dh);
      if(px2<0||py2<0||px2>=s.width||py2>=s.height) continue;
      const k=(py2*s.width+px2)*4;
      const sa=s.data[k+3];
      if(sa<=0) continue;
      this._px(dx+i,dy+j,[s.data[k],s.data[k+1],s.data[k+2]],sa);
    }
  }
}

class Canvas{
  constructor(w,h){ this.width=w; this.height=h; this.data=new Float64Array(w*h*4); this._ctx=null; this.style={}; }
  getContext(){ if(!this._ctx) this._ctx=new Ctx(this); return this._ctx; }
  addEventListener(){}
  set width(v){ this._w=v; if(v&&this._h) this.data=new Float64Array(v*this._h*4); }
  get width(){ return this._w; }
  set height(v){ this._h=v; if(v&&this._w) this.data=new Float64Array(this._w*v*4); }
  get height(){ return this._h; }
  toPNG(scale){
    scale=scale||1;
    const W=this.width*scale, H=this.height*scale;
    const raw=Buffer.alloc((W*3+1)*H);
    let p=0;
    for(let y=0;y<H;y++){ raw[p++]=0;
      for(let x=0;x<W;x++){ const k=(((y/scale)|0)*this.width+((x/scale)|0))*4;
        const al=this.data[k+3];
        raw[p++]=Math.max(0,Math.min(255,(this.data[k]  *al)|0));
        raw[p++]=Math.max(0,Math.min(255,(this.data[k+1]*al)|0));
        raw[p++]=Math.max(0,Math.min(255,(this.data[k+2]*al)|0)); } }
    const crcT=[]; for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;crcT[n]=c>>>0;}
    const crc=b=>{let c=0xFFFFFFFF;for(const v of b)c=crcT[(c^v)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;};
    const chunk=(t,d)=>{const len=Buffer.alloc(4);len.writeUInt32BE(d.length);
      const td=Buffer.concat([Buffer.from(t),d]); const cc=Buffer.alloc(4); cc.writeUInt32BE(crc(td));
      return Buffer.concat([len,td,cc]);};
    const ihdr=Buffer.alloc(13); ihdr.writeUInt32BE(W,0); ihdr.writeUInt32BE(H,4);
    ihdr[8]=8; ihdr[9]=2; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;
    return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),
      chunk('IHDR',ihdr), chunk('IDAT',zlib.deflateSync(raw)), chunk('IEND',Buffer.alloc(0))]);
  }
}
module.exports={Canvas};
