
// ============================================================================
// THE NINE CLASSES (GDD §8)
// Each carries its own Class Mechanic, not just a different ability list.
// Gauge hooks: init / onHit / onDamaged / update / value(0..1) / label
// ============================================================================

const GAUGE = { PIPS:'pips', BAR:'bar', MODES:'modes' };

const CLASSES = [
{
  id:'ironclad', primaryReach:34, lockRange:80, grid:['IRONCLAD'], name:'Ironclad', role:'Melee DPS / Frontline',
  quote:'The front line holds because I hold it.',
  weapon:'Greatsword', mech:'Momentum',
  mechDesc:'Consecutive hits stack Momentum to 5. At max, abilities are empowered. Taking a hit wipes it.',
  hp:130, spd:60, atk:1.10, reach:28,
  gauge:GAUGE.PIPS, gaugeMax:5, gaugeLabel:'MOMENTUM', gaugeCol:C.brass4,
  col:{ prim:'#8a8a92', primD:'#5e5e68', primL:'#b4b4bd', accent:C.copper3, accentL:C.copper4, trim:C.brass3 },
  abilities:[
    { name:'Forge Cleave',      cd:4.0, cast:0.16, desc:'180° slash. At max Momentum: 270°.' },
    { name:'Iron Tempest',      cd:9.0, cast:0.22, desc:'Spin. Consumes Momentum for bonus damage.' },
    { name:'Unyielding Charge', cd:6.0, cast:0.10, desc:'Dash through enemies. +2 Momentum on hit.' },
    { name:'Earthsplitter',     cd:8.0, cast:0.26, desc:'Shockwave + Stagger. At max: splits 3 ways.' }
  ]
},
{
  id:'bulwark', primaryReach:34, lockRange:74, grid:['BULWARK'], name:'Bulwark', role:'Tank / Party Protector',
  quote:'Behind my shield, you are safe. Behind my shield, I am dangerous.',
  weapon:'Tower Shield + Mace', mech:'Aegis Gauge',
  mechDesc:'Enemy attention is your resource. Taunted and nearby foes fill the Aegis. Three tiers unlock stronger counters.',
  hp:180, spd:52, atk:0.85, reach:24,
  gauge:GAUGE.BAR, gaugeMax:100, gaugeLabel:'AEGIS', gaugeCol:'#4f9ae8',
  col:{ prim:'#4a5668', primD:'#2f3644', primL:'#6f7e94', accent:'#2f6fd0', accentL:'#6fa8f0', trim:C.iron4 },
  abilities:[
    { name:'Bastion Stance', cd:0.8, cast:0.0,  desc:'TOGGLE: 70% damage reduction, half speed, builds Aegis.' },
    { name:'Aegis Break',    cd:2.0, cast:0.22, desc:'Shield slam. Damage scales with Aegis tier.' },
    { name:'Magnetize',      cd:9.0, cast:0.14, desc:'Taunt everything nearby. Your main Aegis builder.' },
    { name:'Shatterguard',   cd:12.0,cast:0.26, desc:'Guardian tier: shockwave, Shatters all taunted foes.' }
  ]
},
{
  id:'runebreaker', primaryReach:26, lockRange:56, grid:['RUNE','BREAKER'], name:'Runebreaker', role:'Melee Burst / Off-Healer',
  quote:"I don't cast spells from afar. I carve them into your bones.",
  weapon:'Rune Gauntlets', mech:'Runic Charge',
  mechDesc:'Melee hits inscribe runes on enemies, up to 5 each. Detonations consume every rune at once.',
  hp:110, spd:64, atk:0.95, reach:24,
  gauge:GAUGE.BAR, gaugeMax:20, gaugeLabel:'RUNES', gaugeCol:C.aether4,
  col:{ prim:'#3d2f52', primD:'#271c38', primL:'#5d4a78', accent:C.aether3, accentL:C.aether4, trim:C.brass3 },
  abilities:[
    { name:'Rune Strike',         cd:1.4, cast:0.10, desc:'3-hit combo. Each hit inscribes a rune.' },
    { name:'Detonation: Flare',   cd:7.0, cast:0.20, desc:'Every rune erupts as fire. Splash damage.' },
    { name:'Detonation: Shock',   cd:8.0, cast:0.20, desc:'Runes arc as chain lightning between foes.' },
    { name:'Arcane Warp',         cd:5.0, cast:0.06, desc:'Blink forward, inscribing 2 runes on the way.' }
  ]
},
{
  id:'aethermancer', primaryReach:150, lockRange:150, grid:['AETHER','MANCER'], name:'Aethermancer', role:'Ranged DPS / Elementalist',
  quote:"The old magic isn't gone. It just needed someone worthy to listen.",
  weapon:'Aethite Staff', mech:'Attunement',
  mechDesc:'Every spell has a Focus form and a Spread form. Convergence toggles modes. Rift Step replaces your dodge.',
  hp:95, spd:58, atk:0.9, reach:70,
  gauge:GAUGE.MODES, gaugeMax:2, gaugeLabel:'ATTUNE', gaugeCol:C.aether4,
  col:{ prim:'#2f3a6b', primD:'#1c2447', primL:'#4a5a9c', accent:C.aether3, accentL:C.aether5, trim:C.amber3 },
  abilities:[
    { name:'Searing Lance',  cd:2.6, cast:0.26, desc:'FOCUS: piercing bolt + burn. SPREAD: wide flame arc.' },
    { name:'Glacial Spike',  cd:4.2, cast:0.30, desc:'FOCUS: shard + root. SPREAD: frost ring, 40% slow.' },
    { name:'Arc Bolt',       cd:3.4, cast:0.22, desc:'FOCUS: lock-on bolt. SPREAD: lightning cage.' },
    { name:'Convergence',    cd:0.35,cast:0.0,  desc:'Toggle FOCUS / SPREAD. No cooldown to speak of.' }
  ]
},
{
  id:'reaver', primaryReach:26, lockRange:94, grid:['REAVER'], name:'Reaver', role:'Close-Mid DPS / Mobility',
  quote:'Two blades, two barrels. Fast and final.',
  weapon:'Dual Gunblades', mech:'Tempo',
  mechDesc:'Alternate Blade and Gun to build Tempo to 6. Repeating a type drops it. Finishers spend it all, and hit hardest at 6.',
  hp:105, spd:70, atk:1.0, reach:26,
  gauge:GAUGE.PIPS, gaugeMax:6, gaugeLabel:'TEMPO', gaugeCol:'#e8663c',
  // Black leathers, red accents, mistcloak. Note these aren't literally black:
  // #0a090e is reserved for the outline, and the cloth sits a few steps up in
  // dark blue-grey. Painting the costume in true black makes a featureless
  // slab — the eye needs an internal value range to find the form in.
  col:{ prim:'#242431', primD:'#12121a', primL:'#403f52', accent:'#c8452b', accentL:'#e8663c', trim:'#8a1f18' },
  abilities:[
    { name:'Lacerate',       cd:1.0, cast:0.08, kind:'blade', desc:'BLADE: 3 slashes. +3 Tempo.' },
    { name:'Snapfire',       cd:1.0, cast:0.06, kind:'gun',   desc:'GUN: quick shot. At Tempo 4+, 3 rounds.' },
    { name:'Shadow Lunge',   cd:6.0, cast:0.06, kind:'blade', desc:'BLADE FINISHER: one strike per Tempo on a single target.' },
    { name:'Bullet Rain',    cd:8.0, cast:0.18, kind:'gun',   desc:'GUN FINISHER: one volley per Tempo. Spends it all.' }
  ]
},
{
  id:'longshot', primaryReach:156, lockRange:156, grid:['LONGSHOT'], name:'Longshot', role:'Long-Range DPS / Recon',
  quote:'I see everything. I miss nothing.',
  weapon:'Aethite Rifle', mech:'Focus',
  mechDesc:'Standing still builds Focus and tightens your aim; moving resets it. Killzone roots you and turns WASD into target selection.',
  hp:100, spd:56, atk:1.0, reach:110,
  gauge:GAUGE.BAR, gaugeMax:100, gaugeLabel:'FOCUS', gaugeCol:'#7ddc6a',
  col:{ prim:'#3a4634', primD:'#232c20', primL:'#586a4e', accent:'#7d9a52', accentL:'#a8c473', trim:C.brass3 },
  abilities:[
    { name:'Charged Shot',      cd:2.0, cast:0.14, desc:'Damage scales with Focus. 100% = guaranteed crit.' },
    { name:'Piercing Round',    cd:2.0, cast:0.22, desc:'Needs 50% Focus. Punches through walls and everything behind them.' },
    { name:'Recon Flare',       cd:8.0, cast:0.12, desc:'Marks all nearby foes. Fires on the move.' },
    { name:'Killzone',          cd:0.8, cast:0.20, desc:'TOGGLE. Rooted, Focus 3x, and WASD steers the reticle.' }
  ]
},
{
  id:'phantom', primaryReach:34, lockRange:112, grid:['PHANTOM'], name:'Phantom', role:'Stealth DPS / Assassin',
  quote:'They never saw me. That’s the point.',
  weapon:'Twin Daggers', mech:'Shadow Gauge',
  mechDesc:'Backstabs and time spent stealthed fill the Shadow Gauge. Thresholds at 30, 60 and 100 unlock everything.',
  hp:95, spd:72, atk:0.95, reach:22,
  gauge:GAUGE.BAR, gaugeMax:100, gaugeLabel:'SHADOW', gaugeCol:'#9a6fd0',
  col:{ prim:'#26212f', primD:'#14111c', primL:'#3e3650', accent:'#6b4a9c', accentL:'#9a6fd0', trim:'#c9c5bd' },
  abilities:[
    { name:'Backstab',        cd:1.0, cast:0.08, desc:'From behind: 2.5x, guaranteed crit, +25% gauge.' },
    { name:'Vanish',          cd:9.0, cast:0.10, desc:'Stealth. Next strike crits for +50%. Costs 20%.' },
    { name:'Smoke Bomb',      cd:11.0,cast:0.14, desc:'Blinds foes, stealths you. No gauge cost.' },
    { name:'Shadowstep Chain',cd:12.0,cast:0.10, desc:'60% gauge: teleport-strike up to 3 foes.' }
  ]
},
{
  id:'eidolon', primaryReach:124, lockRange:124, grid:['EIDOLON'], name:'Eidolon', role:'Summon DPS / Utility',
  quote:"I don't fight alone. I never fight alone.",
  weapon:'Channelling Rod', mech:'Eidolons',
  mechDesc:'Hold up to two constructs at once. They fight on their own AI; pressing a summon key again commands its special move.',
  hp:100, spd:58, atk:0.75, reach:56,
  gauge:GAUGE.PIPS, gaugeMax:2, gaugeLabel:'EIDOLONS', gaugeCol:'#57d0c4',
  col:{ prim:'#2b4a4a', primD:'#1a2f30', primL:'#436e6e', accent:'#2f9c92', accentL:'#57d0c4', trim:C.brass3 },
  abilities:[
    { name:'Forge Golem',    cd:12.0, cast:0.30, desc:'Summon a tanky construct. Press again: Bulwark Wall.' },
    { name:'Storm Sprite',   cd:10.0, cast:0.26, desc:'Summon a lightning spirit. Press again: Rapid Fire.' },
    { name:'Shadow Hound',   cd:9.0,  cast:0.24, desc:'Summon a fast beast. Press again: Rending Howl.' },
    { name:'Eidolon Fusion', cd:20.0, cast:0.34, desc:'Fuse both summons. Press again: Detonation (5s).' }
  ]
},
{
  id:'savant', primaryReach:26, lockRange:52, grid:['SAVANT'], name:'Savant', role:'Adaptive / Blue Mage',
  quote:'Every enemy is a teacher. Every battle, a lesson.',
  weapon:'Tome & Monocle-Scanner', mech:'Assimilation',
  mechDesc:'You start weak on purpose. UP scans anything you have not met and marks anything you have; your other slots fill with what you steal.',
  hp:100, spd:58, atk:0.55, reach:22,
  gauge:GAUGE.BAR, gaugeMax:8, gaugeLabel:'CODEX', gaugeCol:'#e0c060',
  col:{ prim:'#3a3550', primD:'#232037', primL:'#585073', accent:'#c9a83c', accentL:'#e8cc6a', trim:'#d8d2c0' },
  abilities:[
    // Slot 0 is the Savant's whole loop on one button: it learns what you
    // have not met and marks what you have. Scanning used to be on SPACE,
    // which cost the class its dodge — the one thing every other class has.
    { name:'Scan', cd:0.7, cast:0.12, kind:'scan',
      desc:'New creature: learn it. Known creature: mark it Analyzed for +40% from everything.' },
    { name:'— Empty —', cd:0, cast:0, desc:'Scan a new creature with UP to fill this slot.' },
    { name:'— Empty —', cd:0, cast:0, desc:'Scan a new creature with UP to fill this slot.' },
    { name:'— Empty —', cd:0, cast:0, desc:'Scan a new creature with UP to fill this slot.' }
  ]
}
];
const CLASS_BY_ID = {}; for(const c of CLASSES) CLASS_BY_ID[c.id]=c;

// Abilities the Savant can steal, one per creature type (GDD §8.9)
// What a Savant takes from each creature, and what the codex shows everyone
// else. `lore` is the field-note line; it is the only place in the build that
// explains why the wildlife has metal in it, so it carries some weight.
const LEARNABLE = {
  rustquail:  { name:'Flutter Rush', cd:4.0, kind:'dash',
                desc:'Short forward dash that knocks foes aside.',
                lore:'Ground-nesting fowl. Grows a brass plate over each wing joint, which it cannot fly with and will not stop preening.' },
  gearrat:    { name:'Iron Fist', cd:3.0, kind:'arc',
                desc:'Heavy punch with knockback.',
                lore:'Scavenger. Teeth have gone to hardened steel, so it gnaws through cable and sleeps in the warm wreck it caused.' },
  drone:      { name:'Scalding Jet', cd:5.0, kind:'cone',
                desc:'Cone of pressurised steam.',
                lore:'Not an animal at all — a survey unit that outlived its survey. It still files reports. Nobody is receiving them.' },
  sporeling:  { name:'Spore Burst', cd:6.0, kind:'nova',
                desc:'Poison cloud around you.',
                lore:'Fungal body around a scrap-iron core it grew in place of a stone. The core is always a tool. Always someone\u2019s.' },

  brasshare:  { name:'Spring Step', cd:5.0, kind:'leap',
                desc:'Leap to the marked target and strike on landing.',
                lore:'Hare with hammered-brass ears it uses to dump heat. The hind legs have wound themselves into leaf springs.' },
  tickboar:   { name:'Gore Charge', cd:7.0, kind:'slam',
                desc:'Heavy forward slam. Staggers everything it catches.',
                lore:'Boar with an iron plate fused across the snout from rooting in tailings. The tail is a coiled spring and it is always wound.' },
  pollenmoth: { name:'Chaff Cloud', cd:8.0, kind:'blind',
                desc:'Cone of metal chaff. Blinds foes so they cannot find you.',
                lore:'Wings came in as verdigris copper leaf. It navigates by magnetism and the city ruins it utterly.' },

  cragram:    { name:'Ram Slam', cd:6.0, kind:'slam',
                desc:'Bone-shaking charge that staggers and knocks back hard.',
                lore:'Bighorn whose horns mineralised into banded iron. They ring when it heads a rival and you hear it for miles.' },
  slagbear:   { name:'Slag Hide', cd:12.0, kind:'guard',
                desc:'Molten plating: 60% less damage for six seconds, and it burns whatever touches you.',
                lore:'Bear that dens in cooling slag and wears what sticks. The plates never fully set, so the hide bleeds heat all winter.' },
  pylonhawk:  { name:'Rod Strike', cd:7.0, kind:'chain',
                desc:'Lightning arcs from you through everything nearby.',
                lore:'Raptor with copper pinions and a tail like an earthing rod. It hunts storms and brings the storm down onto what it hunts.' },

  anvilcrab:  { name:'Piston Claw', cd:5.0, kind:'shatter',
                desc:'Armour-breaking punch. Shattered foes take more from everything.',
                lore:'Shore crab under a shell of forge slag. One claw has become a hydraulic press and it can no longer swim.' },
  turbineel:  { name:'Impeller Burst', cd:7.0, kind:'slowfield',
                desc:'Ring of driven water that slows everything it touches.',
                lore:'Eel with an impeller collar it drives itself. In the shallows you hear them before the surf.' },
  // --- THE GLIMMERVEIN, below: one spirit in three colours -----------------
  // The same ability three times over, which is the point: what you take off
  // an imp is its fork, and the only thing that differs is what the fork is
  // made of. Learn all three and you can answer any of them.
  emberimp:  { name:'Ember Fork', cd:4.0, kind:'hurl', elem:'fire',
               desc:'Hurl a burning fork. Pierces. Fire does nothing to its own kind.',
               lore:'Not an animal and not quite alive. A pint of fire in the shape of something with opinions, poured out of a socket in the floor. Kill it and it melts; the socket pours another.' },
  rimeimp:   { name:'Rime Fork', cd:4.2, kind:'hurl', elem:'ice',
               desc:'Hurl a frozen fork. Pierces. Ice does nothing to its own kind.',
               lore:'The same spirit run cold. It does not scorch the floor it stands on, it frosts it, and that frost is the only warning you get that one is around the corner.' },
  stormimp:  { name:'Arc Fork', cd:3.8, kind:'hurl', elem:'lightning',
               desc:'Hurl a charged fork. Pierces. Lightning does nothing to its own kind.',
               lore:'The fastest of the three and the least patient. It throws first and closes afterward, which is backwards for everything else in this bestiary.' },
  pylon:     { name:'Overflow', cd:9.0, kind:'nova', elem:'nature',
               desc:'Erupt in a ring of raw Aethite.',
               lore:'The generator. Cold iron, one gem and an appetite. Whatever is inside does not run out on any timescale that helps you \u2014 you have to break it.' },

  gullwright:{ name:'Dive Bomb', cd:6.0, kind:'leap',
                desc:'Dive onto the marked target. Heavy damage on the drop.',
                lore:'Gull with riveted wings and a beak worn into a spanner. Steals fastenings. The Shoals lighthouse is held together with rope now.' }
};

// ============================================================================
// THE SIX HATCHLINGS (GDD §10)
// ============================================================================
const DRAGONS = [
  { id:'pyraling',  name:'Pyraling',  el:'Fire',      lean:'Attack Power, Crit Damage',
    a:'#c4391c', b:'#f0742a', c:'#ffc25c', belly:'#ffdf9a', eye:'#fff0c0',
    ab1:{name:'Ember Breath', desc:'Cone of fire that leaves foes burning.'},
    ab2:{name:'Flame Dash',   desc:'Streaks forward, igniting everything it passes.'} },
  { id:'frostling', name:'Frostling', el:'Ice',       lean:'Defense, HP',
    a:'#2a6aa8', b:'#54a8e0', c:'#b8e8ff', belly:'#e4f6ff', eye:'#ffffff',
    ab1:{name:'Rime Breath', desc:'Freezing cone. Slows everything it touches.'},
    ab2:{name:'Glacial Ward',desc:'Ice barrier that absorbs the next blows.'} },
  { id:'voltling',  name:'Voltling',  el:'Lightning', lean:'Speed, Cooldown Reduction',
    a:'#8a6a12', b:'#e8c422', c:'#fff58a', belly:'#fffbd0', eye:'#ffffff',
    ab1:{name:'Arc Breath',  desc:'Chains between nearby enemies.'},
    ab2:{name:'Volt Surge',  desc:'Overcharges you: +40% move speed briefly.'} },
  { id:'verdling',  name:'Verdling',  el:'Nature',    lean:'HP Regen, Status Resist',
    a:'#2f6b2a', b:'#5aa845', c:'#a8d86a', belly:'#dcf0b0', eye:'#fff4c0',
    ab1:{name:'Spore Breath',desc:'Poison cloud that lingers and ticks.'},
    ab2:{name:'Healing Roots',desc:'Roots erupt underfoot and mend you.'} },
  { id:'voidling',  name:'Voidling',  el:'Dark',      lean:'Ability Power, Lifesteal',
    a:'#3a2158', b:'#6b3fa0', c:'#b088e0', belly:'#d8c0f0', eye:'#ff9adc',
    ab1:{name:'Umbral Breath',desc:'Drains life from everything it hits.'},
    ab2:{name:'Shadow Veil', desc:'Cloaks you both for a few seconds.'} },
  { id:'luminling', name:'Luminling', el:'Light',     lean:'Support Power, Party Buffs',
    a:'#a88a2a', b:'#f0d878', c:'#fffad8', belly:'#ffffff', eye:'#ffe8a0',
    ab1:{name:'Radiant Breath',desc:'Sears foes and mends you in the same beam.'},
    ab2:{name:'Benediction', desc:'Blessing: +25% damage for a short while.'} }
];
const DRAGON_BY_ID = {}; for(const d of DRAGONS) DRAGON_BY_ID[d.id]=d;

// ============================================================================
// ITEMS
//
// Two kinds, and the distinction is the whole inventory: TRASH exists to be
// sold, and PARTS exist to be bolted onto your dragon. Nothing else.
//
// Every part is made from the creature that dropped it — the Anvil Crab's
// claw really is the claw you saw it swing. That keeps the bestiary and the
// dragon customisation as one system rather than two, and it means the
// visible change on your dragon is always sourced from something you fought.
//
// `slot` is fixed per part. Numbers here are deliberately round and will want
// balancing; what matters now is that each slot reaches a different system:
//   head -> the dragon's Q      wing -> the dragon's E      body -> YOU
// ============================================================================
const TRASH = [
  { id:'gear',   name:'Cracked Gear',      value:6,  desc:'Teeth sheared clean off. Someone will melt it.' },
  { id:'flake',  name:'Rust Flake',        value:2,  desc:'A palmful of scale off something that used to be a machine.' },
  { id:'rivet',  name:'Bent Rivet',        value:3,  desc:'Pulled, not cut. Whatever pulled it was strong.' },
  { id:'shard',  name:'Chipped Aethite',   value:14, desc:'Too small to channel. Still worth more than the rest of this.' },
  { id:'spring', name:'Fatigued Spring',   value:5,  desc:'Wound one time too many and it stayed wound.' },
  { id:'plate',  name:'Scored Plating',    value:9,  desc:'Deep parallel gouges. Three of them, evenly spaced.' },
  { id:'wire',   name:'Tangled Filament',  value:4,  desc:'Copper, hair-fine, and still faintly warm.' },
  { id:'lens',   name:'Clouded Lens',      value:11, desc:'Ground glass gone milky. It was looking at something.' }
];
const TRASH_BY_ID = {}; TRASH.forEach(t=>TRASH_BY_ID[t.id]=t);

// ============================================================================
// MATERIALS — what you gather, as opposed to what you loot
//
// One per zone, found in that zone and nowhere else. That exclusivity is the
// whole point: it is what makes "bring me one of each" a reason to travel
// rather than a reason to stand in one field for twenty minutes. Every
// material names the ground it came out of, so a bag of them reads as an
// itinerary.
//
// `node` is what the thing you harvest it from is called, and `col` is what
// that thing looks like — the node tile has no art of its own, it is drawn
// from whichever material the area is seeded with.
// ============================================================================
const MATERIALS = [
  { id:'rustscrap', zone:'clearing',    name:'Rust Scrap',    node:'Scrap Pile',
    value:8,  shape:'scrap', col:{ a:'#4a2f1c', b:'#8a5a2c', c:'#c98a44', lit:'#ffbe6a' },
    desc:'Torn plate off whatever the Rustfields used to be. Everyone has some.' },
  { id:'bloomiron', zone:'verge',       name:'Bloom Iron',    node:'Iron Bloom',
    value:16, shape:'bloom', col:{ a:'#2f4a2a', b:'#6b8a3c', c:'#a8c45e', lit:'#e2f08a' },
    desc:'Grows up through the grass in soft grey flowers. Cuts like cheese, sets like steel.' },
  { id:'cragglass', zone:'scarp',       name:'Crag Glass',    node:'Glass Seam',
    value:24, shape:'shard', col:{ a:'#2a3344', b:'#4a6280', c:'#8fb4d4', lit:'#d8ecff' },
    desc:'The Scarp gets struck often enough that the rock has learned to be glass.' },
  { id:'brinesalt', zone:'shoals',      name:'Brine Salt',    node:'Salt Crust',
    value:14, shape:'crust', col:{ a:'#4a4536', b:'#9a9276', c:'#d8cfa8', lit:'#fff3cc' },
    desc:'Cut off the tide line in slabs. Half of Ironhaven is preserved in it.' },
  { id:'veinshard', zone:'glimmervein', name:'Vein Shard',    node:'Gem Seam',
    value:40, shape:'spire', col:{ a:'#2a1740', b:'#6b3fa8', c:'#b98cf0', lit:'#e8d4ff' },
    desc:'Broken off a living seam. It keeps growing in your bag, very slowly.' }
];
const MAT_BY_ID = {}; MATERIALS.forEach(m=>MAT_BY_ID[m.id]=m);
const MAT_BY_ZONE = {}; MATERIALS.forEach(m=>MAT_BY_ZONE[m.zone]=m);
const NODE_RESPAWN = 45;      // seconds before a worked node grows back

const PARTS = [
  // --- HEAD: modifies the dragon's breath (Q) ------------------------------
  { id:'incisors', from:'gearrat',   slot:'head', name:'Steel Incisors', value:40,
    desc:'It gnawed through cable with these. Your hatchling will manage worse.',
    eff:{ qDmg:1.25 }, effText:'Breath +25% damage' },
  { id:'lens',     from:'drone',     slot:'head', name:'Survey Lens', value:55,
    desc:'Still filing reports. Now it files them about whatever you point it at.',
    eff:{ qRange:1.45 }, effText:'Breath reaches 45% further' },
  { id:'ears',     from:'brasshare', slot:'head', name:'Hammered Ears', value:45,
    desc:'Hare-thin brass, beaten to dump heat. It dumps a lot of heat.',
    eff:{ qCd:0.65 }, effText:'Breath recharges 35% faster' },
  { id:'horns',    from:'cragram',   slot:'head', name:'Banded Horns', value:70,
    desc:'They ring when they connect. You will hear it from a long way off.',
    eff:{ qDmg:1.5, qCd:1.25 }, effText:'Breath +50% damage, 25% slower to recharge' },

  // --- WING: modifies the dragon's second skill (E) ------------------------
  { id:'wingplate',from:'rustquail', slot:'wing', name:'Brass Wing Plate', value:25,
    desc:'The quail could never fly with it. Something smaller might.',
    eff:{ eCd:0.75 }, effText:'Dragon skill recharges 25% faster' },
  { id:'leafwing', from:'pollenmoth',slot:'wing', name:'Copper Leaf Wings', value:60,
    desc:'Verdigris and wafer-thin. They navigate by magnetism and hate cities.',
    eff:{ eDmg:1.35 }, effText:'Dragon skill +35% damage' },
  { id:'pinions',  from:'pylonhawk', slot:'wing', name:'Rod Pinions', value:80,
    desc:'It hunted storms with these, and brought the storm down on what it hunted.',
    eff:{ eDmg:1.2, eCd:0.8 }, effText:'Dragon skill +20% damage, 20% faster' },
  { id:'riveted',  from:'gullwright',slot:'wing', name:'Riveted Wings', value:50,
    desc:'Held together with fastenings it stole. Every one a different size.',
    eff:{ eCd:0.6 }, effText:'Dragon skill recharges 40% faster' },

  // --- BODY: modifies YOUR abilities, not the dragon's ---------------------
  { id:'sac',      from:'sporeling', slot:'body', name:'Spore Sac', value:30,
    desc:'Grown around a scrap-iron core. The core is always a tool, always someone’s.',
    eff:{ regen:1.6 }, effText:'Aethite regenerates 60% faster' },
  { id:'coil',     from:'tickboar',  slot:'body', name:'Coil Tail', value:45,
    desc:'A spring the length of your arm, and it is always wound.',
    eff:{ spd:1.12 }, effText:'You move 12% faster' },
  { id:'slag',     from:'slagbear',  slot:'body', name:'Slag Plating', value:90,
    desc:'Never fully set. It bleeds heat all winter and will do the same on you.',
    eff:{ maxhp:25, spd:0.94 }, effText:'+25 max health, 6% slower' },
  { id:'claw',     from:'anvilcrab', slot:'body', name:'Piston Claw', value:75,
    desc:'One claw became a press. It could no longer swim. It did not seem to mind.',
    eff:{ atk:1.18 }, effText:'Your attacks hit 18% harder' },
  { id:'impeller', from:'turbineel', slot:'body', name:'Impeller Collar', value:65,
    desc:'It drove this itself. In the shallows you hear them before the surf.',
    eff:{ cdr:0.85 }, effText:'Your cooldowns run 15% shorter' },

  // --- THE GLIMMERVEIN -----------------------------------------------------
  { id:'emberhorn', from:'emberimp', slot:'head', name:'Ember Horn', value:110,
    desc:'Still warm. It will still be warm next year.',
    eff:{ qDmg:1.4, qCd:1.1 }, effText:'Breath +40% damage, 10% slower' },
  { id:'rimehorn',  from:'rimeimp',  slot:'head', name:'Rime Horn', value:110,
    desc:'Frost creeps back over it whenever you look away.',
    eff:{ qDmg:1.2, qRange:1.3 }, effText:'Breath +20% damage, +30% reach' },
  { id:'arcprong',  from:'stormimp', slot:'wing', name:'Arc Prong', value:120,
    desc:'One prong off a thrown fork. It hums when weather is coming.',
    eff:{ eDmg:1.3, eCd:0.75 }, effText:'Dragon skill +30% damage, 25% faster' },
  { id:'veingem',   from:'pylon',    slot:'body', name:'Vein Gem', value:200,
    desc:'Cut out of a spirit pylon. It is still trying to pour.',
    eff:{ maxhp:15, regen:2.0 }, effText:'+15 max health, Aethite regenerates twice as fast' }
];
const PARTS_BY_ID = {};   PARTS.forEach(p=>PARTS_BY_ID[p.id]=p);
const PART_BY_BEAST = {}; PARTS.forEach(p=>PART_BY_BEAST[p.from]=p);
const SLOTS = ['head','wing','body'];
const SLOT_NOTE = {
  head: 'Head parts reshape the breath your dragon throws on Q.',
  wing: 'Wing parts reshape the skill your dragon throws on E.',
  body: 'Body parts work on you, not the dragon.'
};
