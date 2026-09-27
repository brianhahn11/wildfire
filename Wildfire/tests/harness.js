const {Canvas}=require('./shim.js'); const fs=require('fs');
// The device-resolution frame buffer: VW*ART x VH*ART. Kept as a literal
// rather than read from the build, because the harness has to exist before
// the build is evaluated.
const gc=new Canvas(960,540);
global.document={ getElementById:i=>i==='game'?gc:null,
  createElement:t=>t==='canvas'?new Canvas(16,16):{style:{}}, addEventListener(){} };
const L={}; global.window={ addEventListener:(k,f)=>{(L[k]=L[k]||[]).push(f);} };
global.navigator={maxTouchPoints:0};
// Deterministic randomness. Combat rolls crits and hit variance, so a suite
// that asserts "by press N the Reaver has built enough Tempo to spend" passes
// or fails on the dice. A fixed seed makes a failure mean something; a test
// that only fails one run in four is worse than no test.
let _s = 0x9e3779b9;
Math.random = () => {
  _s ^= _s<<13; _s>>>=0; _s ^= _s>>17; _s ^= _s<<5; _s>>>=0;
  return _s / 4294967296;
};
let T=0; global.performance={now:()=>T}; let raf=null;
global.requestAnimationFrame=cb=>{raf=cb;return 1;};
const src=fs.readFileSync(require('path').join(__dirname,'..','build','game.js'),'utf8');
// Wrapped, because a failure anywhere in here — including a name in the
// export list below that no longer exists — otherwise surfaces as
// "X is not defined" on the module.exports line, which points at the one
// place that is definitely not the problem.
try {
eval(src+`
global.X={G,ST,keys,Music,Sfx,ART,ART_UNIT_get:()=>ART_UNIT,withArt,px,tpx,CW,CH_,TILE,CLASSES,DRAGONS,AREAS,
  get player(){return player}, get dragon(){return dragon},
  get cls(){return cls}, get drg(){return drg}, get ART_UNIT(){return ART_UNIT},
  setupPlayer,loadArea,beginGame,useAbility,dragonAbility,dodgeAction,updateTarget,lockTarget,summonSpecial,SPECIAL_CD,meltDodge,meltPhase,updateMelt,MELT,MELT_DUR,drawMelt,wallBlocks,cycleTarget,targetRange,aimAngle,dragonAim,dragonTarget,faceTarget,
  interact,hurtPlayer,hurtEnemy,spawnEnemy,nearestEnemy,gaugeValue,gaugeText,
  talkToHayla,STORY_PAGES,ENEMY_TYPES,SUMMON_TYPES,setCls:(i,j)=>setupPlayer(i,j),terrainCv,overCv,renderStaticLayers,drawGround,drawPropOver,drawPropBase,tileAt,
  drawClassSprite,drawPlayerFigure,drawHumanoid,drawGunblade,drawDragon,COGWAY_FOLK,NPC_PAL,drawNPC,npcQuestMark,drawQuestMark,QUESTS_BY_GIVER,ringPx,SOLID,TALL,COG,camTarget,canStand,walkableAt,terrainCv,overCv,drawEnemy,spawnEnemy,LEARNABLE,withElement,elemMul,elemImmune,applyBurn,applySlow,applyPoison,IMP_KINDS,IMP_RESPAWN,assimilate,killEnemy,MILESTONES,AETHITE_LOCKS,grantMilestone,channelInto,toggleBurn,outOfCombat,inTown,tryLift,tryLockHere,rideLift,OPTION_ROWS,INPUT_DEVICES,BINDINGS,KEYMAP_DEFAULTS,gainXp,gainBond,awardKill,killEnemy,attackPower,COGWAY_FOLK,bondNeed,levelNeed,LEVEL_HP,LEVEL_ATK,COG,ringSpot,drawRuneMarks,inscribeRune,bindGet,bindSet,bindApply,bindReset,keyName,remapKey,drawRemapPanel,HUD_S,hudPx,TABS,PARTS,TRASH,PARTS_BY_ID,TRASH_BY_ID,SLOTS,addItem,fitPart,unfitPart,fittedPart,fittedSet,partEff,trashValue,sellAllTrash,rollDrops,itemDef,applyPartStats,PART_BY_BEAST,TILES:T,C,hash2,GROUND_FAM,FAM,fringe,CODEX_ORDER,CODEX_COLS,ELEM_COL,QUESTS,QUEST_BY_ID,QUEST_STATE,questState,questProgress,questGathered,questKilled,questRefresh,questRec,talkQuest,finishQuest,activeQuests,towerHere,towerBurn,drawTower,MATERIALS,MAT_BY_ID,MAT_BY_ZONE,NODE_RESPAWN,harvestHere,nodeHere,nodeReady,updateNodes,countItem,takeItems,drawQuestPage,QUEST_GIVER_NAME,drawJournal,attackPower,PLAYERS,withPlayer,eachPlayer,twoPlayer,otherPlayer,makeRoster,KEYMAPS,P_COL,downPlayer,updateRevive,tetherOk,camFocus,drawHUD,moveBy,updateTarget,easyNextAbility,easyNextName,EASY_ROTATION,abilityUsable,gaugeValue,optionsKey,equipFromCodex,MAP_NODES,MAP_FLOORS,MAP_BY_ID,MAP_SHAFTS,MAP_LINKS,seenFloors,floorSeen,mapFloorNodes,drawMapPage,drawTitle,drawTitleHero,drawTitleDragon,buildTitleBg,fillEllipse,drawClassSelect,text,VW,VH};
`);
} catch(err){
  console.error('\n!! harness failed to load the game:\n   ' + (err && err.stack || err) + '\n');
  process.exit(1);
}
const press=k=>(L['keydown']||[]).forEach(f=>f({key:k,preventDefault(){}}));
const rel  =k=>(L['keyup']||[]).forEach(f=>f({key:k}));
const tick =()=>{T+=16.7;const c=raf;raf=null;c(T);};
const NAMES={0:'TITLE',1:'SELECT_CLASS',2:'SELECT_DRAGON',3:'STORY',4:'PLAY',5:'DIALOGUE',6:'PAUSE',7:'DEAD',8:'JOURNAL'};
module.exports={X,press,rel,tick,NAMES,gc,L};
