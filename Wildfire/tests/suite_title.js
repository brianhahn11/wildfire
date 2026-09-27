// Title key art + the Reaver's redesigned sprite.
//
// Rendering has no assertions you can write from the code alone — the only way
// to know a pixel-art pass worked is to look at it. What CAN be pinned down is
// the stuff that silently broke over and over while building this: the figure
// vanishing into the background, strips collapsing into a solid sheet, the red
// disappearing entirely, and the whole thing throwing under strict argument
// validation. Those are what this suite guards.
const {X} = require('./harness.js');
const S   = require('./strict.js');
const {Canvas} = S;

let fails = 0;
const ok = (cond, label, extra) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + label + (extra ? '  — ' + extra : ''));
  if(!cond) fails++;
};
// pull a pixel back out of the shim's float RGBA buffer as #rrggbb
const pick = (cv, x, y) => {
  const k = (y*cv.width + x)*4, d = cv.data;
  return '#' + [0,1,2].map(i => Math.round(d[k+i]*d[k+3]).toString(16).padStart(2,'0')).join('');
};
const lum = hex => {
  const n = parseInt(hex.slice(1),16);
  return 0.2126*((n>>16)&255) + 0.7152*((n>>8)&255) + 0.0722*(n&255);
};

console.log('=== TITLE RENDERS CLEAN ACROSS TIME ===');
// strict.js enforces the argument validation a real browser performs, so a
// non-finite coordinate out of one of the sin-driven sways throws here rather
// than silently painting nothing in the browser.
let threw = null;
const cv = new Canvas(480,270), c = cv.getContext('2d');
for(let i=0;i<48;i++){
  X.G.time = i*0.37;
  try { X.drawTitle(c); } catch(e){ threw = e; break; }
}
ok(!threw, '48 frames of drawTitle, no throw', threw ? threw.message : '');

console.log('\n=== THE ART IS NOT A BLACK RECTANGLE ===');
// Every failed pass of this screen looked the same: a near-black frame. Sample
// the whole canvas and insist on a real spread of brightness.
X.G.time = 2.4; X.drawTitle(c);
let lo = 999, hi = -1, sum = 0, n = 0;
for(let y=0; y<270; y+=3) for(let x=0; x<480; x+=3){
  const L = lum(pick(cv,x,y)); lo = Math.min(lo,L); hi = Math.max(hi,L); sum += L; n++;
}
ok(hi > 180, 'has genuine highlights', 'brightest ' + hi.toFixed(0));
ok(lo < 20,  'has genuine darks',      'darkest ' + lo.toFixed(0));
ok(sum/n > 14 && sum/n < 90, 'mean stays in the moody-but-visible band',
   'mean ' + (sum/n).toFixed(1));

console.log('\n=== THE PIT RECEDES ===');
// Each ring is drawn darker than the one above it. Sample down the centre
// line and require the lower samples to be darker than the upper ones —
// an early pass had the radii so flat the rings read as rolling hills.
const upper = lum(pick(cv, 250, 150)), lower = lum(pick(cv, 250, 232));
ok(upper > lower, 'upper terraces lighter than the depths',
   upper.toFixed(1) + ' vs ' + lower.toFixed(1));

console.log('\n=== THE FIGURE READS AGAINST THE BACKGROUND ===');
// A black figure on a black ledge was the single most persistent failure. The
// contrast between the hero's column and the empty ledge beside him is the
// thing that has to hold.
let heroMax = 0, ledgeMax = 0;
for(let y=124; y<250; y++){
  for(let x=62; x<132; x++) heroMax  = Math.max(heroMax,  lum(pick(cv,x,y)));
  for(let x=8;  x<48;  x++) ledgeMax = Math.max(ledgeMax, lum(pick(cv,x,y)));
}
ok(heroMax - ledgeMax > 40, 'hero column clearly brighter than bare ledge',
   heroMax.toFixed(0) + ' vs ' + ledgeMax.toFixed(0));

console.log('\n=== THE HATCHLING IS THE WARM ACCENT ===');
let gold = 0;
for(let y=130; y<180; y++) for(let x=105; x<155; x++){
  const h = pick(cv,x,y), n2 = parseInt(h.slice(1),16);
  const r=(n2>>16)&255, g=(n2>>8)&255, b=n2&255;
  if(r>150 && g>110 && b<110) gold++;
}
ok(gold > 120, 'a substantial block of dragon-yellow on the shoulder', gold + ' px');

console.log('\n=== SPRITE: THE MISTCLOAK HAS BOTH COLOURS, AND GAPS ===');
// Two separate bugs lived here. Drawing each strip's outline immediately
// before its fill let every strip paint over its neighbour's second pixel, so
// the reds vanished; and a 2px strip on a 2px pitch tiles edge to edge, so the
// cloak silently became a solid sheet.
// The sprite is authored at device density now, so the scratch canvas has to
// be a device canvas with the render scale applied — the same as the game's.
// Sampled at 1x it drew at half size and the row this reads missed the cloak
// entirely, which looked like the strips had vanished again.
const R = X.CLASSES.find(k => k.id === 'reaver');
const sv = new Canvas(40*X.ART, 34*X.ART), sc = sv.getContext('2d');
sc.setTransform(X.ART,0,0,X.ART,0,0);
sc.fillStyle = '#000000'; sc.fillRect(0,0,40,34);
X.G.time = 0;
X.drawClassSprite(sc, 20, 31, 1, 0, false, R, {});     // back view = full curtain
const CY2 = 25*X.ART;
const row = []; for(let x=8*X.ART; x<=32*X.ART; x++) row.push(pick(sv,x,CY2));
const reds  = row.filter(h => h==='#9c2418' || h==='#e8663c').length;
const darks = row.filter(h => h==='#1c1b26' || h==='#3a3848').length;
const gaps  = row.filter(h => h==='#0a090e').length;
ok(reds  >= 2, 'red strips present',   reds + ' px');
ok(darks >= 2, 'black strips present', darks + ' px');
ok(gaps  >= 3, 'gaps between strips',  gaps + ' px');

console.log('\n=== SPRITE: THE GUNBLADE IS NOT A DAGGER ===');
// The read depends entirely on the outline widening at the grip. Measure it:
// the receiver row must be meaningfully wider than the blade row.
const gv = new Canvas(30,30), gc2 = gv.getContext('2d');
gc2.fillStyle = '#000000'; gc2.fillRect(0,0,30,30);
X.drawGunblade(gc2, 15, 10, Math.PI/2, 10, 1);
const widthAt = y => {
  let w = 0;
  for(let x=0; x<30; x++) if(pick(gv,x,y) !== '#000000') w++;
  return w;
};
const receiver = Math.max(widthAt(9), widthAt(10), widthAt(11));
const blade    = Math.max(widthAt(16), widthAt(17));
ok(receiver >= blade + 2, 'silhouette widens at the receiver',
   receiver + 'px grip vs ' + blade + 'px blade');

console.log(fails ? '\nFAIL (' + fails + ')' : '\nPASS');
process.exit(fails ? 1 : 0);
