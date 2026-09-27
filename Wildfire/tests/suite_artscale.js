// The render scale.
//
// Stage 0 of the art migration separates two things that used to be one
// number: WORLD units, which every gameplay value is expressed in, and DEVICE
// pixels, which the art is drawn at. The whole migration rests on that split
// holding, and the ways it can fail are quiet ones — a buffer that loses its
// transform draws its whole area into a quarter of itself, and a gameplay
// constant that follows the render scale changes how the game plays without
// changing how it looks.
//
// This file guards the split itself. What the frame LOOKS like is checked by
// tools/contact_sheet.js + tools/sheet_diff.js, which compare renders rather
// than assert about them.
const {X, tick} = require('./harness.js');
require('./strict.js');

let fails = 0;
const ok = (c,l,e) => { console.log('  '+(c?'ok  ':'FAIL')+'  '+l+(e?'  — '+e:'')); if(!c) fails++; };

// ---------------------------------------------------------------------------
console.log('=== THE WORLD DID NOT MOVE ===');
{
  // TILE is the load-bearing one. Roughly 1,300 numbers in this game are
  // expressed in world pixels — speeds, ranges, aggro radii, knockback, the
  // tether, every dist() comparison. Redefining it would rescale all of them
  // against the world, silently, which is the one thing an art pass must not
  // do. If this ever fails, the migration has taken a wrong turn.
  ok(X.TILE === 16, 'a tile is still 16 world units', String(X.TILE));
  ok(X.VW === 480 && X.VH === 270, 'the viewport is still 480x270 WORLD units',
     X.VW+'x'+X.VH);
  ok(X.VW/X.TILE === 30 && X.VH/X.TILE === 16.875,
     'so you still see the same 30 tiles across', (X.VW/X.TILE)+' x '+(X.VH/X.TILE));

  // spot-check a few gameplay numbers that would betray a rescale
  // A fingerprint over every pixel-valued class and creature constant, rather
  // than a handful of numbers typed by hand. Any rescale of any of them —
  // which is what redefining TILE would do — moves this total. Typed
  // expectations only catch the ones somebody remembered to type, and the
  // first draft of this test asserted a reach of 34 for a class whose reach
  // has always been 26.
  let fp = 0, n = 0;
  for(const c of X.CLASSES)
    for(const k of ['primaryReach','lockRange','hp','spd','reach'])
      if(typeof c[k] === 'number'){ fp += c[k]; n++; }
  for(const id in X.ENEMY_TYPES){
    const t = X.ENEMY_TYPES[id];
    for(const k of ['hp','spd','r','atkRange','aggro','lungeSpd','shotSpd','atk'])
      if(typeof t[k] === 'number'){ fp += t[k]; n++; }
  }
  ok(n === 138, 'the fingerprint covers every value it is supposed to', n+' values');
  ok(fp === 9593, 'and no pixel-valued constant has moved since b27',
     fp+' (b27: 9593)');
}

// ---------------------------------------------------------------------------
console.log('\n=== AND THE CANVAS IS THE WORLD TIMES ART ===');
{
  ok(X.ART >= 1 && X.ART === Math.round(X.ART),
     'ART is a whole number of device pixels per world pixel', String(X.ART));
  ok(X.CW === X.VW*X.ART && X.CH_ === X.VH*X.ART,
     'the canvas is exactly that much bigger', X.CW+'x'+X.CH_);
  // non-integer would put the art on half pixels, which is the one thing
  // pixel art cannot survive
  ok(Number.isInteger(X.CW) && Number.isInteger(X.CH_),
     'and lands on whole device pixels');
}

// ---------------------------------------------------------------------------
console.log('\n=== TERRAIN BUFFERS ARE DEVICE-SIZED AND KEEP THEIR SCALE ===');
{
  // Assigning .width clears a canvas AND resets its transform. A buffer that
  // loses the scale paints the whole area into the top-left quarter of
  // itself — which looks like an art bug and is a state bug.
  for(const id of ['cogway','verge','glimmervein','house']){
    const a = X.AREAS[id];
    X.loadArea(id, a.playerStart.x, a.playerStart.y);
    ok(X.terrainCv.width === a.w*X.TILE*X.ART && X.terrainCv.height === a.h*X.TILE*X.ART,
       id+': terrain buffer is the area at device resolution',
       X.terrainCv.width+'x'+X.terrainCv.height);
    ok(X.overCv.width === X.terrainCv.width && X.overCv.height === X.terrainCv.height,
       'and the overlay buffer matches it');
    const t = X.terrainCv.getContext('2d').getTransform();
    ok(t.a === X.ART && t.d === X.ART, 'and it is still scaled after being resized',
       'scale '+t.a+','+t.d);
  }
}

// ---------------------------------------------------------------------------
console.log('\n=== THE FRAME IS DRAWN THROUGH THE SCALE ===');
{
  const a = X.AREAS.verge;
  X.loadArea('verge', a.playerStart.x, a.playerStart.y);
  X.G.fade = 0;
  for(let i=0;i<3;i++) tick();
  const t = X.gc ? null : null;   // the harness canvas, checked below
  ok(true, 'a frame rendered without throwing');

  // the whole canvas must be painted — a frame that only fills the top-left
  // quarter is the signature of a lost transform
  const cv = require('./harness.js').gc;
  let painted = 0;
  for(let i=3;i<cv.data.length;i+=4) if(cv.data[i] > 0) painted++;
  const total = cv.width*cv.height;
  ok(painted === total, 'and covered every device pixel of the canvas',
     painted+' of '+total);
  ok(cv.width === X.CW && cv.height === X.CH_,
     'at the device size', cv.width+'x'+cv.height);
}

// ---------------------------------------------------------------------------
console.log('\n=== AUTHORED UNITS ===');
{
  // The migration converts ~1,480 painters one at a time. Unconverted art must
  // keep drawing exactly as it always has while converted art draws finer, or
  // the game is broken for however many weeks the conversion takes.
  const {Canvas} = require('./strict.js');
  function paint(unit){
    const cv = new Canvas(8,8), c = cv.getContext('2d');
    c.setTransform(X.ART,0,0,X.ART,0,0);
    c.fillStyle = '#000000'; c.fillRect(0,0,8,8);
    X.withArt(unit, ()=>X.px(c, '#ffffff', 2, 2, 1, 1));
    let n = 0;
    for(let i=0;i<cv.data.length;i+=4) if(cv.data[i] > 200) n++;
    return n;
  }
  ok(X.ART_UNIT === 1, 'old art is the default', String(X.ART_UNIT));
  ok(paint(1) === X.ART*X.ART,
     'an unconverted 1x1 covers ART^2 device pixels, as it always did',
     paint(1)+' for ART='+X.ART);
  ok(paint(X.ART) === 1,
     'a converted 1x1 covers exactly one device pixel', String(paint(X.ART)));

  // and the switch has to restore, or one converted painter silently
  // reformats every painter drawn after it in the same frame
  X.withArt(2, ()=>{});
  ok(X.ART_UNIT === 1, 'withArt puts it back');
  try { X.withArt(2, ()=>{ throw new Error('boom'); }); } catch(e){}
  ok(X.ART_UNIT === 1, 'even when the painter throws');
}

console.log(fails ? '\nFAIL ('+fails+')' : '\nPASS');
process.exit(fails ? 1 : 0);
