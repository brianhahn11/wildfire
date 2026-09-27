// Compare two contact sheets, allowing for an integer upscale.
//
// The point of stage 0 is that the frame does not change — it is the same
// image at twice the size. So the comparison nearest-neighbour upscales the
// older sheet by the ratio of their dimensions and asks for an exact match.
// Anything that moved shows up as a nonzero pixel count, not as a judgement
// call about a screenshot.
//
// Usage: node tools/sheet_diff.js <refdir> <newdir> [diffdir]
const fs=require('fs'), path=require('path'), zlib=require('zlib');

function readPNG(file){
  const b=fs.readFileSync(file);
  let p=8, w=0, h=0, bitDepth=0, colour=0; const idat=[];
  while(p<b.length){
    const len=b.readUInt32BE(p), type=b.toString('ascii',p+4,p+8);
    const data=b.slice(p+8,p+8+len);
    if(type==='IHDR'){ w=data.readUInt32BE(0); h=data.readUInt32BE(4);
                       bitDepth=data[8]; colour=data[9]; }
    if(type==='IDAT') idat.push(data);
    if(type==='IEND') break;
    p += 12+len;
  }
  // The shim writes colour type 2 (RGB, no alpha). Handle both that and RGBA
  // so this tool also works on anything a browser produced.
  if(bitDepth!==8 || (colour!==2 && colour!==6))
    throw new Error(file+': expected 8-bit RGB or RGBA, got depth '+bitDepth+' type '+colour);
  const CH = colour===6 ? 4 : 3;
  const raw=zlib.inflateSync(Buffer.concat(idat));
  const px=Buffer.alloc(w*h*CH);
  const stride=w*CH;
  let prev=Buffer.alloc(stride);
  for(let y=0;y<h;y++){
    const f=raw[y*(stride+1)];
    const line=raw.slice(y*(stride+1)+1, y*(stride+1)+1+stride);
    const cur=Buffer.alloc(stride);
    for(let i=0;i<stride;i++){
      const a=i>=CH?cur[i-CH]:0, bb=prev[i], c=i>=CH?prev[i-CH]:0, x=line[i];
      let v;
      switch(f){
        case 0: v=x; break;
        case 1: v=x+a; break;
        case 2: v=x+bb; break;
        case 3: v=x+((a+bb)>>1); break;
        case 4: { const pp=a+bb-c, pa=Math.abs(pp-a), pb=Math.abs(pp-bb), pc=Math.abs(pp-c);
                  v=x+(pa<=pb&&pa<=pc?a:pb<=pc?bb:c); break; }
        default: throw new Error('bad filter '+f);
      }
      cur[i]=v&255;
    }
    cur.copy(px, y*stride); prev=cur;
  }
  return {w,h,px,ch:CH};
}

if(require.main !== module) { module.exports = { readPNG }; return; }
const REF=process.argv[2], NEW=process.argv[3], DIFF=process.argv[4];
const names=fs.readdirSync(REF).filter(f=>f.endsWith('.png')).map(f=>f.slice(0,-4)).sort();
let worst=0, bad=0;
console.log('scene'.padEnd(16)+'ref'.padEnd(11)+'new'.padEnd(11)+'scale  differing px');
for(const n of names){
  const f2=path.join(NEW,n+'.png');
  if(!fs.existsSync(f2)){ console.log('  '+n.padEnd(14)+'   MISSING in new sheet'); bad++; continue; }
  const A=readPNG(path.join(REF,n+'.png')), B=readPNG(f2);
  const k=B.w/A.w;
  if(k!==Math.round(k) || B.h/A.h!==k){
    console.log('  '+n.padEnd(14)+(A.w+'x'+A.h).padEnd(11)+(B.w+'x'+B.h).padEnd(11)+'NOT AN INTEGER SCALE');
    bad++; continue;
  }
  let diff=0;
  for(let y=0;y<B.h;y++) for(let x=0;x<B.w;x++){
    const ai=((y/k|0)*A.w + (x/k|0))*A.ch, bi=(y*B.w+x)*B.ch;
    const n=Math.min(A.ch,B.ch);
    for(let ch=0;ch<n;ch++) if(A.px[ai+ch]!==B.px[bi+ch]){ diff++; ch=n; }
  }
  const pct=(100*diff/(B.w*B.h));
  worst=Math.max(worst,pct);
  if(diff) bad++;
  console.log('  '+n.padEnd(14)+(A.w+'x'+A.h).padEnd(11)+(B.w+'x'+B.h).padEnd(11)+
              (k+'x').padEnd(7)+(diff?diff+'  ('+pct.toFixed(3)+'%)':'identical'));
}
console.log('\n'+(bad?bad+' scene(s) differ, worst '+worst.toFixed(3)+'%':'every scene is an exact '+
  'upscale of the reference'));
process.exit(bad?1:0);

module.exports = { readPNG };
