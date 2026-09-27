// Rebinding keys.
//
// The thing this has to prove is not that the menu draws. It is that a key
// bound in the menu actually moves the player, and that the game is left in a
// state where every action still has exactly one key and no key has two
// actions. A remap screen that looks right and leaves a player unable to
// dodge is worse than no remap screen.
const {X, press, rel, tick} = require('./harness.js');
require('./strict.js');

let fails = 0;
const ok = (c,l,e) => { console.log('  '+(c?'ok  ':'FAIL')+'  '+l+(e?'  — '+e:'')); if(!c) fails++; };

function start(n){
  X.G.nPlayers=n; X.G.picks = n===2 ? [{cls:0,drg:0},{cls:4,drg:1}] : [{cls:0,drg:0}];
  X.G.state=X.ST.PLAY; X.beginGame();
  X.G.fade=0; for(let i=0;i<3;i++) tick();
}
// open TAB -> options -> rebind
function openRemap(){
  press('tab');
  X.G.codexPage = X.TABS.findIndex(t=>t.id==='options');
  X.G.optSel = X.OPTION_ROWS.findIndex(r=>r.kind==='remap');
  press('enter');
}

// ---------------------------------------------------------------------------
console.log('=== THE MENU OPENS AND CLOSES ===');
{
  start(1);
  ok(!X.G.remap, 'nothing is open to begin with');
  openRemap();
  ok(!!X.G.remap, 'ENTER on the rebind row opens it');
  ok(X.G.remap.sel===0 && !X.G.remap.capturing, 'on the first row, not capturing');
  press('tab');
  ok(!X.G.remap, 'TAB backs out');
  ok(X.G.state===X.ST.JOURNAL, 'and leaves you on the options page, not in the world',
     String(X.G.state));
}

// ---------------------------------------------------------------------------
console.log('\n=== IT IS MODAL WHILE IT IS WAITING FOR A KEY ===');
{
  start(1);
  openRemap();
  X.G.remap.sel = X.BINDINGS.findIndex(b=>b.id==='dodge');
  press('enter');
  ok(X.G.remap.capturing, 'ENTER starts capturing');

  // TAB is the one that matters: it closes the menu everywhere else in the
  // game, and it is the first key anyone will try to bind.
  press('tab');
  ok(!!X.G.remap && X.G.state===X.ST.JOURNAL,
     'TAB binds instead of closing the menu');
  ok(X.KEYMAPS[0].dodge==='tab', 'and dodge is now on TAB', String(X.KEYMAPS[0].dodge));
  ok(!X.G.remap.capturing, 'capturing ended');

  // escape out of a capture leaves the binding alone
  X.G.remap.sel = X.BINDINGS.findIndex(b=>b.id==='act');
  const before = X.KEYMAPS[0].act;
  press('enter'); press('escape');
  ok(X.KEYMAPS[0].act===before, 'ESC cancels without binding', X.KEYMAPS[0].act);
  ok(!X.G.remap.capturing && !!X.G.remap, 'and stays on the page');
}

// ---------------------------------------------------------------------------
console.log('\n=== A REBOUND KEY ACTUALLY DOES THE THING ===');
{
  start(1);
  X.bindReset(0); X.bindReset(1);
  openRemap();
  X.G.remap.sel = X.BINDINGS.findIndex(b=>b.id==='up');
  press('enter'); press('t');          // move up is now T
  press('tab');                        // leave the rebind page
  press('tab');                        // close the menu
  ok(X.G.state===X.ST.PLAY, 'back in the world', String(X.G.state));

  const y0 = X.player.y;
  press('t'); for(let i=0;i<8;i++) tick(); rel('t');
  ok(X.player.y < y0 - 2, 'holding T walks the player up', y0.toFixed(1)+' -> '+X.player.y.toFixed(1));

  const y1 = X.player.y;
  press('w'); for(let i=0;i<8;i++) tick(); rel('w');
  ok(Math.abs(X.player.y - y1) < 0.6, 'and W no longer does anything',
     y1.toFixed(1)+' -> '+X.player.y.toFixed(1));
}

// ---------------------------------------------------------------------------
console.log('\n=== NO ACTION EVER SHARES A KEY ===');
{
  start(1);
  X.bindReset(0);
  openRemap();
  // bind MOVE UP to the key DODGE already has
  const dodgeKey = X.KEYMAPS[0].dodge;
  X.G.remap.sel = X.BINDINGS.findIndex(b=>b.id==='up');
  const upKey = X.KEYMAPS[0].up;
  press('enter'); press(dodgeKey);
  ok(X.KEYMAPS[0].up===dodgeKey, 'the new binding took', String(X.KEYMAPS[0].up));
  ok(X.KEYMAPS[0].dodge===upKey, 'and the one that held it got the old key instead',
     String(X.KEYMAPS[0].dodge));

  const used = X.BINDINGS.map(b=>X.bindGet(X.KEYMAPS[0], b.id));
  ok(new Set(used).size === used.length,
     'every action still has its own key', used.join(' '));
}

// ---------------------------------------------------------------------------
console.log('\n=== THE OTHER PLAYER\'S KEYS ARE OFF LIMITS, IN TWO PLAYER ONLY ===');
{
  start(2);
  X.bindReset(0); X.bindReset(1);
  const p2up = X.KEYMAPS[1].up;
  openRemap();
  X.G.remap.sel = X.BINDINGS.findIndex(b=>b.id==='up');
  const p1up = X.KEYMAPS[0].up;
  press('enter'); press(p2up);
  ok(X.KEYMAPS[0].up===p1up, 'P1 cannot take a key P2 is using', String(X.KEYMAPS[0].up));
  ok(X.KEYMAPS[1].up===p2up, 'and P2 keeps it');
  ok(X.G.remap.capturing, 'the prompt stays up so you can pick another');
  press('escape');

  // in ONE player, P2's map is inert and must not block anything
  start(1);
  X.bindReset(0); X.bindReset(1);
  const k2 = X.KEYMAPS[1].up;
  openRemap();
  X.G.remap.sel = X.BINDINGS.findIndex(b=>b.id==='up');
  press('enter'); press(k2);
  ok(X.KEYMAPS[0].up===k2, 'in one player the absent P2 blocks nothing', String(X.KEYMAPS[0].up));
}

// ---------------------------------------------------------------------------
console.log('\n=== DEFAULTS COME BACK ===');
{
  start(1);
  openRemap();
  X.G.remap.sel = 0;
  press('enter'); press('z');
  press('backspace');
  const clean = X.BINDINGS.every((b,i)=>
    X.bindGet(X.KEYMAPS[0], b.id) === X.bindGet(X.KEYMAP_DEFAULTS[0], b.id));
  ok(clean, 'BKSP restores every binding at once');
  ok(X.KEYMAPS[0].up==='w' && X.KEYMAPS[0].dodge===' ' && X.KEYMAPS[0].ab[0]==='arrowup',
     'and they are the real defaults');
  // The defaults table must be a copy. If it aliased KEYMAPS, rebinding would
  // silently rewrite the defaults too and this page could never undo anything.
  ok(X.KEYMAP_DEFAULTS[0] !== X.KEYMAPS[0] && X.KEYMAP_DEFAULTS[0].ab !== X.KEYMAPS[0].ab,
     'the defaults are a deep copy, not an alias');
}

// ---------------------------------------------------------------------------
console.log('\n=== IT DRAWS ===');
{
  start(1);
  openRemap();
  X.G.remap.msg = 'SWAPPED WITH DODGE';
  let threw = null;
  try { for(let i=0;i<2;i++) tick(); } catch(e){ threw = e; }
  ok(!threw, 'the rebind page renders', threw && threw.message);
  X.G.remap.capturing = true;
  try { for(let i=0;i<2;i++) tick(); } catch(e){ threw = e; }
  ok(!threw, 'and so does the capturing state', threw && threw.message);
  X.bindReset(0); X.bindReset(1);
}

console.log(fails ? '\nFAIL ('+fails+')' : '\nPASS');
process.exit(fails ? 1 : 0);
