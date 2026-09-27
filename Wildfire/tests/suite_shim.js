// The shim's own transform handling.
//
// Every visual check in this project goes through tests/shim.js, so a lie in
// the shim is a lie in every render test at once. setTransform used to ignore
// its arguments and reset to identity, and drawImage's five-argument form fell
// through to the three-argument branch and came out at double size — neither
// mattered until the render scale started using both.
const {Canvas}=require('./shim.js');
function px(cv,x,y){ const k=(y*cv.width+x)*4; return [cv.data[k],cv.data[k+1],cv.data[k+2],cv.data[k+3]]; }
let fails=0;
const ok=(c,l,e)=>{ console.log('  '+(c?'ok  ':'FAIL')+'  '+l+(e?'  — '+e:'')); if(!c) fails++; };

// 1. setTransform(2,0,0,2,0,0) then a 1x1 fill should paint a 2x2 block
{
  const cv=new Canvas(8,8), c=cv.getContext('2d');
  c.setTransform(2,0,0,2,0,0);
  c.fillStyle='#ffffff'; c.fillRect(1,1,1,1);
  const lit=[]; for(let y=0;y<8;y++) for(let x=0;x<8;x++) if(px(cv,x,y)[3]>0) lit.push(x+','+y);
  ok(lit.length===4, 'a 1x1 fill at scale 2 covers 4 device pixels', lit.join(' '));
  ok(lit.join(' ')==='2,2 3,2 2,3 3,3', 'in the right place', lit.join(' '));
}
// 2. a fractional fill, which is what converted art will emit
{
  const cv=new Canvas(8,8), c=cv.getContext('2d');
  c.setTransform(2,0,0,2,0,0);
  c.fillStyle='#ffffff'; c.fillRect(1, 1, 0.5, 0.5);
  const lit=[]; for(let y=0;y<8;y++) for(let x=0;x<8;x++) if(px(cv,x,y)[3]>0) lit.push(x+','+y);
  ok(lit.length===1 && lit[0]==='2,2', 'half a world unit is exactly one device pixel', lit.join(' '));
}
// 3. save/restore must carry the transform
{
  const cv=new Canvas(8,8), c=cv.getContext('2d');
  c.setTransform(2,0,0,2,0,0);
  c.save(); c.translate(1,1); c.fillStyle='#ffffff'; c.fillRect(0,0,1,1); c.restore();
  c.fillStyle='#ff0000'; c.fillRect(0,0,1,1);
  ok(px(cv,2,2)[3]>0, 'translate composes with the scale');
  ok(px(cv,0,0)[0]===255 && px(cv,0,0)[1]===0, 'and restore puts the scale back');
}
// 4. drawImage with an explicit destination size, which is how the terrain blits
{
  const src=new Canvas(4,4), sc=src.getContext('2d');
  sc.fillStyle='#00ff00'; sc.fillRect(0,0,4,4);
  const cv=new Canvas(8,8), c=cv.getContext('2d');
  c.setTransform(2,0,0,2,0,0);
  c.drawImage(src, 0, 0, 2, 2);          // 4px source into 2 world units
  let n=0; for(let y=0;y<8;y++) for(let x=0;x<8;x++) if(px(cv,x,y)[3]>0) n++;
  ok(n===16, 'a 4px image drawn into 2 world units covers 4x4 device px', String(n));
}
// 5. and the skew guard
{
  const c=new Canvas(4,4).getContext('2d');
  let threw=false; try{ c.setTransform(1,0.5,0,1,0,0); }catch(e){ threw=true; }
  ok(threw, 'skew is refused rather than silently dropped');
}
// 6. a gradient's coordinates are in the user space it was created in
{
  // The screen vignette is created at (VW/2, VH/2) with a radius in WORLD
  // units under a scaled context. Evaluated as device pixels it lands on the
  // top-left quadrant at half size, which reads as a game bug.
  const cv=new Canvas(16,16), c=cv.getContext('2d');
  c.setTransform(2,0,0,2,0,0);
  const g=c.createRadialGradient(4,4,0,4,4,4);   // centre world(4,4) = device(8,8)
  g.addColorStop(0,'rgba(255,255,255,1)');
  g.addColorStop(1,'rgba(0,0,0,1)');
  c.fillStyle=g; c.fillRect(0,0,8,8);
  const at=(x,y)=>px(cv,x,y)[0];
  ok(at(8,8) > 200, 'the gradient centre lands where the transform puts it',
     'device(8,8) = '+at(8,8).toFixed(0));
  ok(at(0,0) < 80, 'and its edge reaches the far corner', 'device(0,0) = '+at(0,0).toFixed(0));
  ok(at(8,8) > at(4,4) && at(4,4) > at(0,0), 'falling off monotonically',
     [at(8,8),at(4,4),at(0,0)].map(v=>v.toFixed(0)).join(' > '));
}

console.log(fails?'\nFAIL ('+fails+')':'\nPASS');
process.exit(fails?1:0);
