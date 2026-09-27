---
title: "Wildfire - Game Design Document"
tags: [game-design, personal-project, pixel-art, rpg]
created: 2026-09-01
status: draft
---

# Wildfire
## Game Design Document v1.0

---

## Table of Contents
- [[#1. Vision Statement]]
- [[#2. Core Pillars]]
- [[#3. Art Style & Camera]]
- [[#4. The World of Wildfire]]
- [[#5. Ironhaven - The Central City Hub]]
- [[#6. The Overworld]]
- [[#7. Mission System]]
- [[#8. Character Classes]]
- [[#9. Class Hybridization]]
- [[#10. Dragon Companions]]
- [[#11. Combat System]]
- [[#12. Multiplayer]]
- [[#13. Progression Systems]]
- [[#14. Enemy Design]]
- [[#15. Loot & Equipment]]
- [[#16. UI & HUD]]
- [[#17. Audio Direction]]
- [[#18. Profession System]]
- [[#19. Death & Difficulty]]
- [[#20. Technical Considerations]]

---

## 1. Vision Statement

**Wildfire** is a top-down pixel-art action RPG for 1-4 players, blending the deep class customization and narrative weight of *Final Fantasy* with the mission-based co-op loop of *Phantasy Star Online*. Players explore a steampunk world where ancient draconic magic and industrial technology collide, accompanied by small dragon companions that bond with their character and grant unique powers.

**Elevator Pitch:** *"PSO meets Final Fantasy in a steampunk pixel world where your tiny dragon pet IS your build."*

**Scope:** Solo dev passion project built in **Godot 4**. Free to play with friends -- no monetization. PC-only at launch.

**Target Playtime:** 20-30 hours for the main story, with endgame loop content extending well beyond.

**Rating Target:** E10+ -- lighthearted and adventurous. Consequences are shown but the world stays colorful and fun.

---

## 2. Core Pillars

| Pillar | Description |
|---|---|
| **Dragon Bond** | Your dragon companion is central to your identity -- it's not just a pet, it's your build, your progression, your partner |
| **Class Depth** | 9 distinct base classes with a hybridization system that rewards experimentation without punishing specialization |
| **Co-op First** | Every mission, every mechanic, every system is designed to be fun solo and *better* with friends |
| **Loot & Grow** | A satisfying loop of mission > loot > upgrade > harder mission, with meaningful choices at every step |
| **Living Hub** | Ironhaven isn't just a menu -- it's a social space, a story stage, and a home |

---

## 3. Art Style & Camera

### Perspective
- **Top-down (Zelda-style)** with a slight angular tilt (~15 degrees) for depth
- 16x16 base tile grid, characters are 16x24 (slightly taller than a tile for expressiveness)
- Smooth 8-directional movement with pixel-perfect collision

### Visual Palette
- **Ironhaven (Hub):** Warm amber, copper, brass tones. Steam vents, gear motifs, gas lamps, riveted metal plates. Influence: *Steamworld Dig*, *Machinarium*, *FF6's Magitek factory*
- **Overworld Zones:** Each biome has a distinct palette (see [[#6. The Overworld]])
- **Characters:** Expressive 4-frame walk cycles, 3-frame attack animations, distinct silhouettes per class
- **Dragons:** 12x12 pixel sprites, 2-frame idle bob animation, color-coded by element
- **Effects:** Juicy particle effects for abilities -- pixel sparks, elemental bursts, screen shake on crits

### Resolution & Scaling
- Native resolution: **480x270** (16:9 at pixel-perfect scale)
- Scales cleanly to 1920x1080 (4x), 2560x1440 (~5.3x with border), 3840x2160 (8x)
- No sub-pixel rendering -- every pixel snaps to grid

---

## 4. The World of Wildfire

### Lore Overview

Centuries ago, the world of **Aethermere** was ruled by the Great Dragons -- colossal beings whose breath forged the land itself. When the dragons vanished in the event known as **The Dimming**, humanity discovered that draconic essence had crystallized into a substance called **Aethite** -- a fuel source of limitless potential.

The city of **Ironhaven** rose around the largest Aethite deposit ever found. Powered by dragon-essence steam technology, it became the greatest city in the world. But Aethite mining has consequences. The deeper they dig, the more the old magic stirs. Creatures mutate. Rifts tear open. And small, confused dragon hatchlings have begun appearing in the mines -- fragments of the Great Dragons, seeking bonds with mortals.

**The players** are **Forgebound** -- adventurers licensed by the Ironhaven Guild to investigate Aethite anomalies, clear hostile creatures, and protect the settlements that depend on the mines. Each Forgebound bonds with a dragon hatchling, forming a symbiotic partnership that grants supernatural abilities.

### Story Structure
The game follows a **main throughline** (the mystery of the Dimming and the return of dragon fragments) while each region serves as a **self-contained episode** with its own arc, villain, and resolution. This episodic structure means:
- Each region feels complete on its own -- satisfying even if a player stops there
- New episodes/regions can be added post-launch without breaking the existing story
- Co-op players at different story points can still play together on any unlocked episode

Light narrative choices appear at key story moments -- dialogue options and minor decisions that affect NPC reactions, optional side content availability, and flavor text. The main plot follows the same path for everyone, keeping co-op seamless.

### Tone
- **Primary:** Adventurous, wonder-filled, with a sense of discovery
- **Secondary:** Lighthearted undertones of ecological consequence -- mining dragon essence has a cost, but presented with hope rather than despair
- **Not:** Grimdark, edgy, or cynical. This is a world worth saving.

---

## 5. Ironhaven - The Central City Hub

### Overview
Ironhaven is a sprawling steampunk metropolis built into and around a massive crater (the original Aethite mine). The city is structured in concentric rings descending toward the crater's center, connected by steam-powered elevators, gear-driven bridges, and pneumatic tube transit.

### Districts

#### The Cogway (Upper Ring) - Social & Commerce
- **The Brass Market** -- Equipment shops, consumable vendors, crafting material traders
- **The Gilded Gear** -- Dye station and color palette swaps for gear (no full transmog -- gear has visual variety on its own)
- **Steamside Tavern** -- Social hub where players gather, accept bounty boards, and hear rumors (quest hooks)
- **The Gazette Board** -- Daily/weekly challenge postings, leaderboards

#### The Forgeworks (Mid Ring) - Crafting & Upgrading
- **The Anvil** -- Weapon and armor crafting station
- **The Aethite Refinery** -- Dragon companion upgrade facility (feed Aethite crystals to your dragon)
- **Gearwright's Workshop** -- Gadget and accessory crafting
- **The Codex Hall** -- Scholar class ability library, enemy bestiary, lore archive

#### Guild Quarter (Lower Ring) - Missions & Story
- **Guild Hall** -- Mission board, party formation, matchmaking
- **The War Table** -- Raid/high-difficulty mission planning
- **Commander Voss's Office** -- Main story quest NPC
- **The Vault** -- Shared stash, item trading between players

#### The Undercroft (Crater Floor) - Endgame & Mystery
- **The Deep Mines** -- Entrance to endgame dungeon content
- **The Resonance Chamber** -- Dragon evolution/rebirth facility (endgame dragon upgrades)
- **??? -- Sealed Door** -- Unlocked through main story progression, leads to Great Dragon encounters

### Hub Features
- **Persistent multiplayer** -- See other players walking around Ironhaven
- **NPC schedules** -- Key NPCs move around the city based on time of day, offering different dialogue/services
- **Ambient life** -- Steam vents puff, gears turn, conveyor belts move crates, NPCs chat, clockwork birds perch on railings
- **Seasonal events** -- The hub visually transforms for in-game festivals (Forge Day, Dragon's Eve, etc.)

### Ironhaven Visual Map (Conceptual)

```
            ============================
          //    THE COGWAY (Upper)      \\
         ||  [Brass Market] [Tavern]     ||
         ||  [Gilded Gear] [Gazette]     ||
          \\                            //
            ============================
          //   THE FORGEWORKS (Mid)     \\
         ||  [Anvil]  [Refinery]         ||
         ||  [Gearwright] [Codex Hall]   ||
          \\                            //
            ============================
          //   GUILD QUARTER (Lower)    \\
         ||  [Guild Hall]  [War Table]   ||
         ||  [Voss Office] [The Vault]   ||
          \\                            //
            ============================
          //   THE UNDERCROFT (Crater)   \\
         ||  [Deep Mines]                ||
         ||  [Resonance]  [Sealed Door]  ||
          \\                            //
            ============================
```

---

## 6. The Overworld

### Structure
The overworld follows a **mission-gated** structure inspired by PSO. Players do not free-roam -- instead, they select a mission from the **Guild Hall** board, which loads them into the appropriate zone. This keeps the gameplay loop tight and focused:

1. Return to Ironhaven after each mission
2. Spend loot, upgrade gear, feed your dragon
3. Select next mission and deploy

Regions unlock progressively through story advancement. Each region's missions appear on the Guild Hall board once unlocked.

### Regions & Biomes

#### Region 1: The Rustfields (Starter)
- **Biome:** Rolling plains dotted with rusted machinery and abandoned mining rigs
- **Palette:** Golden grass, rust-orange metal, pale blue sky
- **Enemies:** Scrap golems, feral gear-beasts, corrupted automatons
- **Boss:** The Rustmother -- a massive centipede-like machine animated by wild Aethite

#### Region 2: The Verdant Vents
- **Biome:** Lush jungle growing around geothermal steam vents; glowing mushrooms, hanging vines
- **Palette:** Deep greens, bioluminescent blues, steam-white
- **Enemies:** Venomfang lizards, spore walkers, steam serpents, hostile plant-machines
- **Boss:** Chloraxis -- a plant-dragon hybrid corrupted by Aethite runoff

#### Region 3: The Shattered Reach
- **Biome:** Floating islands connected by ancient bridges, high-altitude winds, crystalline formations
- **Palette:** Sky blues, crystal purples, wind-white
- **Enemies:** Storm harpies, crystal sentinels, void drifters, wind elementals
- **Boss:** Zephyrion -- a great wind drake trapped in a loop of rage

#### Region 4: The Cinderdeep
- **Biome:** Volcanic caverns, rivers of magma, obsidian pillars, ancient dragon shrines
- **Palette:** Deep reds, magma orange, obsidian black
- **Enemies:** Magma worms, ember knights, ash wraiths, lava golems
- **Boss:** Pyraclaw -- the first Great Dragon fragment to fully reform, hostile and confused

#### Region 5: The Frozen Abyss
- **Biome:** Glacial wasteland with buried ruins of a pre-Dimming civilization under ice
- **Palette:** Ice blue, snow white, dark teal, frozen amber (preserved Aethite)
- **Enemies:** Frost constructs, ice phantoms, cryogenic drones, frozen soldiers (undead)
- **Boss:** Glacivern -- an ice dragon partially fused with ancient technology

#### Region 6: The Void Scar (Endgame)
- **Biome:** Reality-warped zone where the barrier between worlds is thin; shifting geometry, color inversions
- **Palette:** Shifting -- inverted colors, neon glitch effects, deep black
- **Enemies:** Void mimics, dimensional parasites, echo-selves (dark copies of player classes)
- **Boss:** The Unforged -- an entity from beyond the Dimming that consumed the Great Dragons

### Zone Structure
Each region contains the following mission content:
- **3-4 Expedition maps** (procedurally assembled from hand-crafted tiles, different layout each run)
- **2-3 dungeon instances** (fixed layout, instanced for party, scalable difficulty)
- **1 raid-tier boss arena** (4-player coordinated fight)
- **Secret rooms within missions** containing rare loot, lore fragments, and dragon mutation items

---

## 7. Mission System

### Mission Types

#### Story Missions
- Linear narrative progression, fully voice-acted cutscenes (pixel art cinematics)
- 6 main chapters corresponding to the 6 regions
- Solo-able but designed with co-op in mind (cutscenes play for all party members)

#### Expeditions
- PSO-style instanced missions selected from the Guild Hall board
- **Rank system:** C, B, A, S, SS (difficulty tiers)
- Procedurally assembled from hand-crafted room tiles (randomized layout per run)
- Clear objectives: Exterminate, Rescue, Collect, Escort, Boss Rush
- Timed bonus challenges for extra loot

#### Bounties
- Kill X enemies of a specific type in any zone
- Daily/weekly rotation
- Reward: Bounty Marks (currency for exclusive gear)

#### Dragon Quests
- Special missions unlocked by your dragon's bond level
- Explore your dragon's fragmented memories of the Great Dragon it came from
- Reward: Dragon evolution materials, lore, unique dragon abilities

#### Raids (Endgame)
- 4-player coordinated encounters with multi-phase bosses
- Weekly lockout on top-tier rewards
- Require class coordination and dragon synergy

### Mission Flow
```
Guild Hall -> Select Mission -> Matchmake/Invite -> Gate Terminal
    -> Load into Zone -> Complete Objectives -> Boss/Extraction
    -> Results Screen (Loot, XP, Rank) -> Return to Ironhaven
```

---

## 8. Character Classes

All classes share a common control scheme: **Move, Attack, Dodge, Ability 1-4, Dragon Ability, Item**. Each class has a unique **Class Mechanic** that defines its playstyle.

### The 9 Base Classes

---

#### Skill System Overview

Each class has **8 skills** (unless noted otherwise). Players equip **4 at a time** in ability slots 1-4, choosing their loadout at Ironhaven or save points. Some classes have locked slots or class-specific replacements for dodge/basic attack as noted below.

---

#### 1. Ironclad (Warrior)
> *"The front line holds because I hold it."*

- **Role:** Melee DPS / Frontline
- **Weapon:** Greatswords, Axes, Hammers
- **Class Mechanic -- Momentum:** Each consecutive hit builds Momentum stacks (max 5). At max stacks, the next ability becomes empowered (more damage, wider AoE). Getting hit resets all stacks.
- **Playstyle:** Aggressive melee with a rhythm-game feel -- keep swinging, keep building, unleash big finishers

**Skills (pick 4):**
| # | Skill | Description |
|---|---|---|
| 1 | **Forge Cleave** | Wide 180-degree horizontal slash hitting all enemies in front. At max Momentum, extends to 270 degrees. |
| 2 | **Iron Tempest** | Spinning AoE -- consumes all Momentum stacks for bonus damage per stack. At 5 stacks, devastating. |
| 3 | **Unyielding Charge** | Dash forward, knocking enemies aside. Gains 2 Momentum on hit. Short cooldown gap-closer. |
| 4 | **Molten Edge** | Imbue weapon with Aethite fire for 8 seconds -- attacks deal bonus burn damage and generate Momentum 50% faster. |
| 5 | **Earthsplitter** | Slam weapon into the ground, sending a shockwave in a line. Enemies hit are Staggered (slowed, +bonus damage taken) for 3s. At max Momentum, shockwave splits into 3 directions. |
| 6 | **Relentless** | Passive toggle -- after reaching max Momentum, the next hit doesn't consume stacks. Instead, starts a 4-second window where Momentum can't decay from taking hits. Trades burst for sustain. |
| 7 | **Sunder** | Heavy overhead strike on a single target. Ignores 50% of enemy armor. At max Momentum, fully ignores armor and applies Vulnerable (party bonus damage) for 5s. |
| 8 | **Warcry** | Shout granting the Ironclad and all nearby allies +20% attack speed for 6 seconds. Instantly grants 2 Momentum stacks. |

---

#### 2. Bulwark (Tank)
> *"Behind my shield, you are safe. Behind my shield, I am dangerous."*

- **Role:** Tank / Party Protector
- **Weapon:** Tower Shields + One-hand Maces/Swords
- **Class Mechanic -- Aegis Gauge (Aggro-as-Resource):** The Aegis Gauge fills based on enemy attention. Each enemy currently targeting/aggro'd on the Bulwark generates a steady stream of Aegis charge. Getting hit gives a burst of Aegis. The gauge drains slowly when no enemies are targeting you. More enemies focused on you = faster fill = more power.
- **Aegis Tiers:**
  - **0-33% (Sentinel):** Baseline abilities
  - **34-66% (Guardian):** +10% passive damage reduction, abilities gain bonus effects
  - **67-100% (Aegis):** Full power -- counters hit hardest, party shields strongest, unlocks Citadel
- **Playstyle:** Draw aggro, hold the front, convert enemy attention into devastating counters and party-saving shields

**Skills (pick 4):**
| # | Skill | Description |
|---|---|---|
| 1 | **Bastion Stance** | Raise shield, reducing incoming damage by 70%, move at half speed. Each hit absorbed generates a burst of Aegis. At Guardian+, also reflects 20% of blocked damage. |
| 2 | **Aegis Break** | Slam shield forward. Damage scales with Aegis tier -- at Aegis tier, stuns 1.5s and sends a shockwave. Consumes 50% gauge. |
| 3 | **Iron Curtain** | Plant a barrier wall (3 tiles wide, 5s). At Guardian+, allies behind gain +15% damage. At Aegis tier, the wall pulses damage to enemies that touch it. |
| 4 | **Magnetize** | Taunt all enemies in a large radius for 4 seconds, forcing them to target you. At Aegis tier, also slows taunted enemies by 25%. Bread-and-butter Aegis builder. |
| 5 | **Retribution** | Passive toggle -- while enemies are aggro'd on you, basic attacks deal bonus damage equal to 5% of max HP per enemy targeting you. At 5 enemies, +25% max HP as bonus damage per swing. |
| 6 | **Guardian Leap** | Leap to an ally, granting them a shield (25% of Bulwark's max HP, 4s). All enemies targeting that ally are forced to aggro the Bulwark instead. Instant Aegis spike from transferred aggro. |
| 7 | **Shatterguard** | Release a shockwave (Guardian+ required). All enemies targeting you take burst damage and are Shattered (-20% damage dealt, +15% damage taken) for 6s. Costs 40% Aegis. |
| 8 | **Citadel** | Full Aegis required. Grant all party members a shield (40% of Bulwark's max HP) for 8s. Bulwark can't attack but gains 90% damage reduction and Aegis doesn't drain. When Citadel ends, remaining shields detonate as AoE around each ally. |

---

#### 3. Runebreaker (Melee Spellcaster)
> *"I don't cast spells from afar. I carve them into your bones."*

- **Role:** Melee Hybrid DPS / Burst / Off-Healer
- **Weapon:** Rune Gauntlets (enchanted melee gloves)
- **Class Mechanic -- Runic Charge:** Melee hits inscribe runes on enemies (visible as glowing glyphs, max 5 per enemy). Detonation abilities consume all runes for bonus damage. Different detonations have different effects.
- **Playstyle:** Get in close, mark enemies with melee combos, then detonate for massive burst. With Runic Bond equipped, offensive detonations also heal allies.

**Skills (pick 4):**
| # | Skill | Description |
|---|---|---|
| 1 | **Rune Strike** | Fast 3-hit melee combo -- each hit inscribes a rune on the target (max 5 per enemy). The setup move. |
| 2 | **Detonation: Flare** | Detonate all runes on all marked enemies as fire explosions. Each rune = one explosion. 5 runes on a single target = devastating burst. Splash damage to nearby enemies. |
| 3 | **Detonation: Shock** | Detonate all runes as chain lightning. Lightning arcs from each runed enemy to the nearest other enemy. Great for spreading damage across packs. |
| 4 | **Arcane Warp** | Short-range blink that inscribes 2 runes on every enemy you pass through. Gap-closer and instant setup on clusters. |
| 5 | **Detonation: Shatter** | Detonate runes as ice bursts. Each rune applies a stacking slow -- 3+ runes on a single target freezes them solid for 2s. Crowd control detonation. |
| 6 | **Runic Overflow** | Passive -- when you detonate 8+ runes in a single cast, enter Overflow for 5s: melee attacks inscribe 2 runes per hit, +30% move speed. Rewards big detonations. |
| 7 | **Runic Bond** | Mark up to 3 allies with a Runic Bond glyph (visible orbiting rune, 12s). Whenever you detonate runes on enemies, each detonated rune heals all bonded allies. More runes = bigger heal. Recastable to refresh. Heal through violence. |
| 8 | **Annihilation** | Consume all runes on all enemies -- instead of detonating, each rune fires a homing projectile back to the Runebreaker, healing for a small amount per rune. Self-sustain option. |

---

#### 4. Aethermancer (Ranged Spellcaster)
> *"The old magic isn't gone. It just needed someone worthy to listen."*

- **Role:** Ranged DPS / Elemental Specialist
- **Weapon:** Aethite Staves, Orbs
- **Class Mechanic -- Attunement Mode:** The Aethermancer has two modes: **Focus** (single-target) and **Spread** (multi-target). All 6 elemental spells change behavior based on current mode. Mode is toggled via Convergence (locked in Slot 4).
- **Special -- Rift Step (replaces dodge):** Blink a short distance, leaving an elemental echo at departure point. Echo detonates after 0.5s with the element of last spell cast (fire burns, ice freezes, lightning stuns). 2 charges, 6s recharge.
- **Special -- Convergence (Slot 4, locked):** Instant cast, no cooldown. Toggles between Focus and Spread mode. On swap, a visual burst pulses around the caster (Focus: energy contracts inward, single bright orbiting rune; Spread: energy radiates outward, three orbiting runes).
- **Playstyle:** Pick your element mix, swap modes on the fly. Focus for priority targets, Spread for packs.

**Elemental Skills (pick 3 for Slots 1-3):**
| # | Element | Skill | Focus Mode (Single Target) | Spread Mode (Multi-Target) |
|---|---|---|---|---|
| 1 | Fire | **Searing Lance / Inferno Wave** | Piercing fire bolt, high damage, burn DoT (3s) | Wide 120-degree flame arc, Scorched debuff (+10% damage taken, 4s) |
| 2 | Ice | **Glacial Spike / Blizzard Ring** | Massive ice shard, high damage + root (2s). Bonus shatter on Scorched targets | Frost ring around caster, 40% slow, frozen after full duration |
| 3 | Lightning | **Arc Bolt / Storm Cage** | Lock-on bolt, high damage. Rebounds on kill (chains twice at 75%) | 4 strikes in cage pattern. Enemies Shocked (interrupted 2s). Walls deal damage |
| 4 | Fire | **Pyroclasm / Ember Field** | Delayed-explosion fireball sticks to target, detonates after 1.5s. Instant full-power detonation if target dies first | Mortar creating a burning field (5s). Ticking fire damage, applies Scorched |
| 5 | Ice | **Frostbite / Avalanche** | Encase target's feet in ice -- 60% slow for 4s + cold DoT. Double damage on already rooted/frozen targets | Rolling wave of ice in a wide line. Knockback + slow. Leaves icy ground (3s) |
| 6 | Lightning | **Thunderstrike / Chain Storm** | Single powerful bolt from above after 0.5s delay. Stuns 1s (2s on wet/iced targets) | Rapid random lightning bolts across a large area for 3s. More enemies = more spread, fewer = more concentrated |

---

#### 5. Reaver (Dual Wield Gunblades)
> *"Two blades, two barrels. Fast and final."*

- **Role:** Close-Mid Range DPS / Mobility
- **Weapon:** Dual Gunblades -- one-handed hybrid weapons with a blade edge and integrated barrel. Can slash (melee) or fire (ranged).
- **Class Mechanic -- Tempo:** Alternating between Blade-type and Gun-type actions builds Tempo (max 6). Same type twice in a row drops Tempo by 1. Not attacking for 3 seconds decays Tempo. High Tempo increases attack speed and unlocks combo finishers.
- **Basic Attack:** Tap = quick gunblade slash (Blade), Hold = gunblade shot (Gun). The basic attack is the Tempo engine -- abilities are spenders and specials. Any 4 of 8 skills are functional because basic attack fills gaps.
- **Tempo Visual:** Pulsing aura that intensifies with stacks -- subtle at 1-2, noticeable at 3-4, blazing with afterimages at 5-6.
- **Playstyle:** Alternate slash and shot to build Tempo, spend it on devastating finishers.

**Skills (pick 4):**
| # | Type | Skill | Description |
|---|---|---|---|
| 1 | Blade | **Lacerate** | Fast 3-slash combo. Each slash builds 1 Tempo. At high Tempo (4+), the third slash extends into a 4th spinning hit with wider range. |
| 2 | Gun | **Snapfire** | Quick dual-pistol shot. Builds 1 Tempo. At high Tempo (4+), fires 3 rounds in a spread pattern instead of 1. |
| 3 | Blade | **Shadow Lunge** | Dash to an enemy, slash, dash back to original position. Builds 2 Tempo. Preserves spacing for weaving. |
| 4 | Gun | **Bullet Rain** | Unload a fan of bullets in a short-range cone. Bullet count scales with Tempo (3 base, up to 8 at max). Consumes all Tempo. Ranged spender. |
| 5 | Blade | **Riposte** | Parry window (0.4s). If hit during window, counter with 2x damage slash + instant max Tempo. If not hit, still does a basic slash for 1 Tempo. High risk, high reward. |
| 6 | Gun | **Deadeye** | Mark a target for 4s. All attacks against marked target build double Tempo. When mark expires, a phantom gunshot hits for bonus damage based on total Tempo built during mark. Boss-killer. |
| 7 | Both | **Gunblade Waltz** | Automated 4-hit alternating combo: slash-shot-slash-shot. Builds 4 Tempo. Locked into animation ~1.5s but can steer direction. Guaranteed max Tempo builder from zero. |
| 8 | Both | **Overdrive** | Requires max Tempo (6). Consume all Tempo for a 5-second frenzy: attack speed doubled, every attack counts as both Blade AND Gun, afterimages deal 20% damage to nearby enemies. |

---

#### 6. Longshot (Long-Range Sniper)
> *"I see everything. I miss nothing."*

- **Role:** Long-Range DPS / Recon
- **Weapon:** Aethite Rifles, Railguns
- **Class Mechanic -- Focus:** Standing still builds Focus (visible crosshair tightening). Higher Focus increases damage, critical chance, and unlocks penetrating shots. Moving resets Focus.
- **Playstyle:** Positional -- find a safe vantage, build Focus, deliver devastating single-target damage. Requires awareness and repositioning.

**Skills (pick 4):**
| # | Skill | Description |
|---|---|---|
| 1 | **Charged Shot** | Core shot. Damage scales with Focus level -- at 0% it's a basic shot, at 100% it crits guaranteed for 3x damage. |
| 2 | **Piercing Round** | Shot penetrates through all enemies in a line. Requires 50%+ Focus. 15% damage falloff per enemy (none at 100% Focus). |
| 3 | **Recon Flare** | Fire a flare revealing all enemies in a large radius + applying Marked (15% bonus damage from all party members) for 6s. Low Focus cost, can fire on the move. Team utility. |
| 4 | **Killzone** | Deploy a tripod, becoming immobile. Focus builds 3x faster, fire rate doubled, +20% damage reduction. Lasts 8s or until cancelled. |
| 5 | **Concussion Shot** | Quick-fire shot that knocks target back and stuns 1s. Does NOT require or reset Focus. Defensive peel -- blast threats away and keep shooting. |
| 6 | **Decoy** | Throw a holographic decoy at current position. Roll backward 3 tiles. Decoy draws aggro 4s. On destruction, explodes for AoE damage. Focus preserved during backward roll. |
| 7 | **Dead Reckoning** | Passive -- after standing still 2s (building Focus), your next reposition doesn't reset Focus for 1.5s. Brief window to adjust position without losing charge. |
| 8 | **Annihilator Round** | Requires 100% Focus. Massive railgun shot dealing enormous single-target damage, ignoring all armor, leaving a heavy DoT (5s). Consumes all Focus. 20s cooldown. Boss-phase delete button. |

---

#### 7. Phantom (Stealth Melee)
> *"They never saw me. That's the point."*

- **Role:** Stealth DPS / Assassin
- **Weapon:** Daggers, Short Swords, Wire Garrotes
- **Class Mechanic -- Shadow Gauge (max 100%):** Fills from: backstab hits (25%), being stealthed near enemies (5%/sec), hitting from behind (10%), Marked for Death ally hits (2%/hit). Drains from: taking frontal hits (-10%), being spotted while stealthed (-15%).
- **Gauge Thresholds:** 30% (Shadow Clone), 60% (Shadowstep Chain), 100% (Umbral Execution)
- **Shadow Visual:** Shadow aura around feet that grows darker and more wispy as gauge fills.
- **Playstyle:** Stealthy approach, backstab positioning, burst assassination, disengage and re-stealth

**Skills (pick 4):**
| # | Skill | Description |
|---|---|---|
| 1 | **Backstab** | Stab a target. From behind: 2.5x damage, guaranteed crit, builds 25% Shadow Gauge. From the front: normal damage, builds 5%. Always be behind your target. |
| 2 | **Vanish** | Enter stealth instantly. Invisible, +30% move speed, next attack from stealth is guaranteed crit with +50% bonus damage. Breaks on attack or after 6s. Costs 20% gauge. |
| 3 | **Smoke Bomb** | Throw a smoke cloud (medium radius). Enemies inside are Blinded 3s. Phantom inside is automatically stealthed. Allies inside gain 20% evasion. No gauge cost. |
| 4 | **Shadowstep Chain** | Requires 60%+ gauge. Teleport between up to 3 enemies in rapid succession, striking each for heavy damage. Each hit counts as a backstab regardless of angle. Consumes 60% gauge. |
| 5 | **Garrote** | Grab an enemy from behind, dealing damage over 2s and silencing them. From stealth: 3s duration. Phantom is locked in animation but immune to damage. Builds 15% gauge. |
| 6 | **Shadow Clone** | Requires 30% gauge. Create a shadow duplicate attacking your target for 5s at 40% damage. Clone always positions behind target. Both attacking same enemy = +20% flanking bonus. |
| 7 | **Marked for Death** | Mark an enemy 8s. All damage the target takes from any source builds your Shadow Gauge (2% per ally hit). On expiry/death, burst gauge based on total damage dealt during mark. Co-op synergy skill. |
| 8 | **Umbral Execution** | Requires 100% gauge. Teleport behind target, deliver a single devastating strike. Below 30% HP: instant kill (bosses take 5x damage instead). Consumes all gauge. Long cooldown. |

---

#### 8. Eidolon (Summoner)
> *"I don't fight alone. I never fight alone."*

- **Role:** Summon DPS / Utility
- **Weapon:** Totems, Channeling Rods
- **Class Mechanic -- Eidolons:** Maintain up to 2 summoned Eidolons (spirit constructs) simultaneously. Each fights independently with its own AI. The Summoner directs them with commands (Attack, Defend, Recall). Eidolons have a duration and must be re-summoned.
- **Playstyle:** Indirect combat -- choose your summons, combo their abilities, control the battlefield

**Skills (pick 4 -- mix summons and commands):**
| # | Type | Skill | Description |
|---|---|---|---|
| 1 | Summon | **Forge Golem** | Tanky melee construct (20s). High HP, draws aggro, slow heavy punches. Special: Ground Pound AoE + stagger every 8s. Your frontline. |
| 2 | Summon | **Storm Sprite** | Ranged lightning spirit (18s). Low HP, high damage. Fires chain lightning bouncing between 2 enemies. Special: Zip -- repositions every 5s. Your DPS summon. |
| 3 | Summon | **Shadow Hound** | Fast melee beast (16s). Medium HP, always attacks from behind. Special: Howl -- reduces nearby enemy damage by 15% for 3s every 10s. Synergizes with Phantom allies. |
| 4 | Summon | **Ironbark Treant** | Nature construct (22s). Creates Healing Roots -- small green zones under allies that heal over time. Special: Entangle -- roots nearest enemy 2s every 12s. Support/healer summon. |
| 5 | Summon | **Ember Wisp** | Fire spirit that orbits the Eidolon player (20s). Enhances basic attack with fire damage, releases fire nova every 6s. Buffs the other active summon with +25% damage. Self-buff summon. |
| 6 | Summon | **Void Wraith** | Dark spirit (14s, shortest). Invisible. Doesn't attack. Drains HP from nearest enemy, transfers to lowest-HP ally. On expiry/death, detonates for heavy AoE dark damage. Utility/bomb summon. |
| 7 | Command | **Eidolon Fusion** | Sacrifice both active summons, fusing them into a Mega-Eidolon (10s). Inherits traits from both (e.g., Golem+Sprite = tanky ranged with ground-pound lightning). Massive stats. Ultimate. |
| 8 | Command | **Soul Link** | Toggle -- damage you take is split 50/50 with summons. Damage summons take heals you for 10%. Summons gain +20% damage while linked. Risk/reward: summon death hurts you, but you're hard to kill while they live. |

**Mega-Eidolon Fusion Examples:**
| Summon A | Summon B | Result |
|---|---|---|
| Forge Golem | Storm Sprite | **Thunder Colossus** -- tanky ranged, chain lightning ground pounds |
| Shadow Hound | Ember Wisp | **Inferno Wolf** -- fast melee, fire trail, howl applies burn |
| Ironbark Treant | Void Wraith | **Blight Tree** -- healing roots that drain enemies, detonates on death |
| Forge Golem | Shadow Hound | **Iron Beast** -- tanky fast melee, aggro + backstab, pound + howl |

---

#### 9. Savant (Scholar / Blue Mage)
> *"Every enemy is a teacher. Every battle, a lesson."*

- **Role:** Adaptive DPS / Utility / Wild Card
- **Weapon:** Tomes, Monocle-Scanners
- **Class Mechanic -- Assimilation:** The Savant is intentionally weak at the start. Their identity IS the skills they learn from enemies. All 4 ability slots are filled exclusively from learned enemy abilities.
- **Playstyle:** The collector class -- seek out rare enemies, learn their moves, build a custom loadout. High variety, high game knowledge requirement. Starts weak, becomes the most versatile class in the game.

**Always Available (not ability slots):**
| Tool | Description |
|---|---|
| **Codex Strike** (basic attack) | Weak melee swing with tome. Low damage. Applies Analyzed (max 3 stacks) -- extends enemy scan windows by 0.5s per stack. Intentionally bad -- motivates learning a better attack. |
| **Mend** (innate heal) | Weak self-heal, 15s cooldown. Restores 15% max HP. Only survivability tool until better abilities are learned. |
| **Assimilate** (replaces dodge) | Channel 1.5s while aiming at an enemy performing a special attack. Successful scan learns the ability permanently, adding it to the Codex. Visual: scanning beam + progress circle. Interrupted by damage. |

**Ability Slots 1-4:** Empty at character creation. Filled exclusively with learned abilities. Swappable at Ironhaven's Codex Hall or at save points.

**Codex Progression (passive bonuses for collecting):**
| Abilities Learned | Codex Bonus |
|---|---|
| 10 | **Novice Scholar** -- Codex Strike damage +25% |
| 25 | **Journeyman** -- Mend cooldown reduced to 10s |
| 40 | **Expert** -- Assimilate channel reduced to 1s |
| 60 | **Master** -- Learned abilities deal 15% more damage than original enemy versions |
| 80+ | **Grand Savant** -- Can equip a 5th ability (unique to Savant) |

**Example Learnable Abilities:**
| Source Enemy | Learned Ability |
|---|---|
| Scrap Golem | **Iron Fist** -- powerful melee punch with knockback |
| Steam Serpent | **Scalding Jet** -- cone of steam damage |
| Storm Harpy | **Gale Slash** -- ranged wind blade projectile |
| Magma Worm | **Burrow Strike** -- dive underground, emerge under enemy |
| Crystal Sentinel | **Prism Shield** -- temporary damage reflection barrier |
| Void Mimic | **Form Copy** -- temporarily copy a nearby ally's basic attack |
| Lava Golem | **Magma Armor** -- massive defense buff with fire retaliation |
| Frost Construct | **Cryo Trap** -- place an ice mine that freezes enemies |

**Every enemy in the game has at least one learnable ability.** Estimated at **80-100+ abilities** across all 6 regions. The fun is in discovering and combining them. A Grand Savant with 80+ abilities and a 5th slot is the most flexible character in the game.

---

## 9. Class Hybridization

### The Dual-Class System

At **Level 30** (roughly halfway through the story), players unlock the ability to choose a **Secondary Class**. This is a permanent choice for that character (but players can have multiple characters).

### How It Works
- Your **Primary Class** determines your base stats, weapon, and Class Mechanic
- Your **Secondary Class** grants access to **2 of its 4 abilities** (your choice) and a **passive trait**
- You do NOT get the secondary class's Class Mechanic

### Passive Traits (gained from Secondary Class)
| Secondary Class | Passive Trait |
|---|---|
| Ironclad | **Battle Hardened** -- +15% melee damage |
| Bulwark | **Steadfast** -- 10% damage reduction |
| Runebreaker | **Runic Echo** -- 20% chance abilities trigger twice at half power |
| Aethermancer | **Mana Affinity** -- Ability cooldowns reduced by 15% |
| Reaver | **Fleet Footed** -- +20% movement speed |
| Longshot | **Eagle Eye** -- +10% critical hit chance |
| Phantom | **Ghost Step** -- Dodging grants 1 second of invisibility |
| Eidolon | **Spirit Link** -- Summon a lesser spirit companion (1 extra minion) |
| Savant | **Quick Study** -- 10% bonus XP from all sources |

### Hybrid Examples
| Primary | Secondary | Result |
|---|---|---|
| Ironclad | Runebreaker | Melee powerhouse who can detonate rune combos mid-combo |
| Bulwark | Aethermancer | Tank that can drop elemental AoE fields while holding the line |
| Phantom | Longshot | Stealth sniper -- vanish, reposition, Focus shot from stealth |
| Savant | Eidolon | Summon support with enemy-learned utility abilities |
| Reaver | Phantom | Hyper-mobile melee/ranged assassin with smoke bomb escape |
| Aethermancer | Savant | Spellcaster with access to enemy abilities for maximum variety |

---

## 10. Dragon Companions

### Overview
Every player bonds with a **Dragon Hatchling** early in the story (during the tutorial). This tiny dragon (12x12 pixels) is your **best friend** -- it follows you everywhere, bobs beside your character, reacts to events with chirps and animations, and is the centerpiece of your build customization. You have **one dragon per character**. It's not swappable. It grows with you.

### Starting Dragon Types (Elements)
You choose your dragon's base element at bonding. This determines its starting color, abilities, and stat lean -- but through the **Mutation System**, your dragon can become something entirely unique.

| Type | Element | Color | Starting Stat Lean |
|---|---|---|---|
| Pyraling | Fire | Red/Orange | Attack Power, Crit Damage |
| Frostling | Ice | Blue/White | Defense, HP |
| Voltling | Lightning | Yellow/Purple | Speed, Cooldown Reduction |
| Verdling | Nature | Green/Brown | HP Regen, Status Resistance |
| Voidling | Dark | Black/Purple | Ability Power, Lifesteal |
| Luminling | Light | White/Gold | Support Power, Party Buffs |

### Dragon Bond Level
Your dragon has a **Bond Level** (1-100) that increases as you:
- Complete missions together
- Feed it Aspect Items (found randomly in missions)
- Complete Dragon Quests
- Simply play (passive accumulation over time)

Bond Level unlocks:
| Bond Level | Unlock |
|---|---|
| 1 | Dragon follows you, provides base stat bonus |
| 10 | Dragon Ability Slot 1 + Mutation Slot 1 |
| 25 | Dragon passive aura (party-wide buff in small radius) |
| 30 | Dragon Ability Slot 2 + Mutation Slot 2 |
| 50 | Dragon Evolution (visual upgrade, major stat boost) |
| 60 | Dragon Ability Slot 3 + Mutation Slot 3 |
| 75 | Dragon Synergy (class-specific bonus) + Mutation Slot 4 |
| 100 | Dragon Ascension (ultimate form + Mutation Slot 5) |

### Dragon Abilities (Examples - Pyraling)

| Ability | Bond Req | Description |
|---|---|---|
| Ember Breath | 10 | Dragon breathes a small cone of fire at targeted area |
| Heat Aura | 25 | Passive -- nearby enemies take minor fire damage over time |
| Flame Dash | 30 | Dragon flies to target location, leaving a fire trail |
| Inferno Burst | 60 | Dragon channels a large fire explosion (long cooldown) |
| Phoenix Rebirth | 100 | If the player would die, the dragon sacrifices itself to fully heal the player. Dragon respawns after 60 seconds. |

### The Mutation System
This is the core dragon customization loop. **Mutation Items** are found randomly during missions -- from enemy drops, secret rooms, boss rewards, and crafting. Each item physically and statistically alters your dragon when slotted.

#### Mutation Slots
Your dragon has **up to 5 mutation slots** (unlocked via Bond Level). You can **freely swap** mutation items in and out of slots at the **Aethite Refinery** in Ironhaven. This lets you experiment and adjust your dragon build without permanent commitment.

#### Mutation Categories

**Elemental Aspects** -- Add or blend elements
| Mutation Item | Effect | Visual Change |
|---|---|---|
| Ember Core | Adds Fire aspect (fire DoT on dragon attacks) | Flame particle trail |
| Frost Shard | Adds Ice aspect (slow on dragon attacks) | Icy wing tips, frost breath |
| Storm Cell | Adds Lightning aspect (chain hit chance) | Crackling sparks along body |
| Void Fragment | Adds Dark aspect (lifesteal on dragon attacks) | Shadow wisps, darker palette |

*Dual Element:* Slotting an elemental aspect different from your base element creates a **Dual Element dragon**. The dragon's abilities gain properties of both elements, and its visual design blends both color palettes. Example: Pyraling + Frost Shard = a fire-ice dragon with steam-themed attacks.

**Physical Mutations** -- Alter the dragon's body
| Mutation Item | Effect | Visual Change |
|---|---|---|
| Twin Heart | Dragon splits into **twins** (two small dragons follow you, each at 60% power) | Two tiny dragons! |
| Hydra Crest | Dragon grows a **second head** (+1 dragon ability slot, both heads attack) | Two-headed sprite |
| Serpent Tail | Dragon grows a **second tail** (+defense, tail-swipe counter-attack when you're hit) | Forked tail sprite |
| Wyrm Scale | Dragon grows larger and bulkier (+HP, +defense, slight speed reduction) | 14x14 sprite, armored look |
| Fae Wings | Dragon's wings become oversized and iridescent (+speed, +evasion for the dragon) | Butterfly-style wings |
| Claw Gauntlets | Dragon grows oversized front claws (+melee damage on dragon attacks) | Exaggerated claw sprites |

**Stat Infusions** -- Pure stat modifications
| Mutation Item | Effect |
|---|---|
| Power Crystal | +15% Attack Power bonus to player |
| Ward Crystal | +10% Defense bonus to player |
| Haste Crystal | +10% Cooldown Reduction for player abilities |
| Vitality Crystal | +200 Max HP bonus to player |
| Affinity Crystal | +20% Dragon Bond XP gain (accelerates leveling) |
| Resonance Crystal | +25% Dragon Ability damage |

**Accessories** -- Cosmetic + minor stat items
| Mutation Item | Effect | Visual |
|---|---|---|
| Tiny Goggles | +5% crit chance | Adorable goggles on the dragon's head |
| Clockwork Scarf | +5% movement speed | Tiny scarf fluttering behind |
| Mini Shield | Dragon occasionally blocks a hit for you | Wee shield strapped to its side |
| Bell Collar | Nearby allies gain +3% XP | Tiny bell that jingles |

#### Mutation Strategy
With 5 slots, players face real build decisions:
- **Pure Offense:** Power Crystal + Claw Gauntlets + Ember Core + Resonance Crystal + Hydra Crest
- **Dual Element Tank:** Frost Shard (on a Pyraling) + Ward Crystal + Wyrm Scale + Serpent Tail + Vitality Crystal
- **Speed Twins:** Twin Heart + Haste Crystal + Fae Wings + Storm Cell + Tiny Goggles
- **Support Build:** Bell Collar + Affinity Crystal + Luminling base + Ward Crystal + Mini Shield

The slotted system means you can completely restructure your dragon's role between missions -- preparing for a specific boss, adapting to your party's needs, or just trying something fun.

### Evolution (Bond Level 50)
Your dragon visually evolves based on its base element AND its current mutations:
- A Pyraling with no special mutations -> **Ignisdrake** (classic fire drake)
- A Pyraling with Twin Heart -> **Twin Ignislings** (two evolved mini-drakes)
- A Pyraling with Frost Shard -> **Steamdrake** (hybrid fire-ice evolved form)
- Frostling -> **Glacidrake**, Voltling -> **Fulgudrake**, etc.

Stats increase significantly. New idle animations. New combat reactions. The dragon's evolved form reflects its mutation loadout.

### Ascension (Bond Level 100)
Final evolution. The dragon gains a unique **Ultimate Ability** and a dramatic visual upgrade with persistent particle effects. The dragon grows to 16x16 pixels (still small and cute, but noticeably more powerful-looking). Ascended form incorporates ALL slotted mutations into a unique visual -- no two Ascended dragons should look quite the same.

### Dragon in Multiplayer
- All party members' dragons are visible
- Dragon auras stack (but with diminishing returns to prevent stacking 4 of the same)
- Certain dragon combos create **Resonance Effects** (e.g., Fire + Ice dragon = Steam Cloud AoE)
- Players can see each other's dragon accessories

---

## 11. Combat System

### Core Loop
Real-time action combat with **8-directional movement**, **attack combos**, **dodge rolling** (i-frames), and **4 ability slots + 1 dragon ability**.

### Controls
```
[Stick/WASD]  -- Move (8-directional)
[A / LMB]     -- Basic Attack (combo string)
[B / Space]   -- Dodge Roll (i-frames, directional)
[X / 1-4]     -- Abilities 1-4
[Y / Q]       -- Dragon Ability
[R / E]       -- Item (quick-use consumable)
[LB / Tab]    -- Target Lock (cycles nearest enemies)
[RB / Shift]  -- Class Mechanic Modifier (varies by class)
```

### Combat Feel
- **Responsive** -- Attacks come out frame 1, no long wind-ups on basic attacks
- **Committal** -- Abilities have brief cast times; dodging cancels them (risk/reward)
- **Readable** -- Enemy attacks have clear telegraph patterns (2-3 frames of windup with distinct colors)
- **Impactful** -- Screen shake on heavy hits, hitlag on crits, knockback on finishers, pixel debris on environment destruction

### Status Effects
| Effect | Visual | Gameplay |
|---|---|---|
| Burn | Orange particles | Damage over time |
| Freeze | Blue overlay + ice chunks | Movement slowed, frozen solid at 3 stacks |
| Shock | Yellow sparks | Interrupts current action, chains to nearby enemies |
| Poison | Green bubbles | Damage over time + reduced healing |
| Blind | Dark overlay | Reduced vision radius, attacks can miss |
| Stagger | Stars above head | Briefly unable to act, take bonus damage |
| Marked | Crosshair icon | All allies deal bonus damage to this target |

### Difficulty Scaling
See [[#19. Death & Difficulty]] for the full difficulty and death system.

In multiplayer, enemy HP and damage scale per player:
- 2 players: 1.6x HP, 1.2x damage
- 3 players: 2.2x HP, 1.4x damage
- 4 players: 3.0x HP, 1.6x damage

---

## 12. Multiplayer

### Architecture
- **Hub (Ironhaven):** Shared instance for your friend group (up to 4 players visible)
- **Missions:** Instanced for parties of 1-4
- **Networking:** P2P with host migration (one player hosts). Since this is a friends-only game, no dedicated servers needed.

### Party System
- Invite friends directly via Steam friend list or lobby code
- Party leader selects the mission; all members deploy together
- **Dragon Resonance** -- the game shows you what Resonance bonuses your party's dragon elements would create before deploying

### Communication
- Quick-chat emote system (selectable phrases + pixel character emotes)
- Text chat
- Voice chat (push-to-talk) via Steam voice or external (Discord, etc.)
- Ping system (target a location or enemy with a contextual ping)

### Shared Loot
- **Personal loot** -- each player gets their own drops (no fighting over loot)
- Players can freely trade items with party members
- Rare drops have a **pity system** -- guaranteed after X runs without a drop

---

## 13. Progression Systems

### Character Level (1-60)
- XP from missions, bounties, exploration
- Each level grants: stat points (auto-allocated by class), ability upgrades at milestones
- Level 30: Unlock Hybridization
- Level 60: Soft cap. Endgame progression shifts to gear and dragon

### Equipment Tiers
| Tier | Color | Source |
|---|---|---|
| Common | White | Drops everywhere |
| Uncommon | Green | Zone-specific drops |
| Rare | Blue | Dungeon bosses, crafting |
| Epic | Purple | Raid bosses, high-rank missions |
| Legendary | Orange | Unique quest rewards, ultra-rare drops |
| Forgeborn | Red (glowing) | Crafted from endgame materials + dragon essence |

### Equipment Slots
- Weapon (class-specific)
- Head
- Body
- Hands
- Feet
- Accessory 1
- Accessory 2
- Dragon Accessory

### Endgame Loop (Post-Story)
After completing the main story, there is no New Game+ -- instead, the game opens into a repeatable endgame:
- **Nightmare Expeditions** -- Harder versions of all missions with new enemy variants and exclusive loot tables
- **Raid Bosses** -- 4-player coordinated boss fights with weekly lockouts on top-tier rewards
- **Dragon Ascension** -- Pushing your dragon to Bond Level 100 and finding the rarest mutations
- **Savant Codex Completion** -- Hunting down every learnable ability
- **Forgeborn Crafting** -- Gathering endgame materials to craft the best gear

### Mastery System (Post-Level-Cap)
- After level 60, XP converts to **Mastery Points**
- Spend Mastery Points on small, incremental bonuses in a Mastery Board
- Board has branches for: Combat, Survival, Dragon Bond, Professions, Crafting
- Soft power scaling -- meaningful but not mandatory for content

---

## 14. Enemy Design

### Design Philosophy
- Every enemy should be **readable** -- the player should understand what it does within 2 encounters
- Attack patterns should be **learnable** -- skilled players can no-hit any enemy
- Each region introduces **2-3 new enemy behaviors** to keep combat fresh
- The Savant class should have at least one learnable ability per enemy type

### Enemy Categories

#### Minions (Trash Mobs)
- Low HP, simple patterns, appear in groups
- Examples: Scrap Drones, Feral Gear-Rats, Sporelings

#### Elites (Mini-Bosses)
- Higher HP, 2-3 attack patterns, may have shields or phases
- Guaranteed uncommon+ drop
- Examples: Rust Knight, Venomfang Alpha, Crystal Warden

#### Bosses
- Unique sprites (32x32 or larger), multi-phase fights, arena mechanics
- Guaranteed rare+ drop, chance for epic
- Each boss has a unique learnable ability for Savants

#### Raid Bosses
- Massive sprites (64x64+), 3-4 phases, party coordination required
- Mechanics that require specific class roles or dragon abilities
- Weekly lockout on top-tier loot

### Enemy Behavior AI
- **Aggression tiers:** Passive (only attacks if provoked), Territorial (attacks if you enter their area), Hostile (attacks on sight), Berserker (prioritizes nearest player aggressively)
- **Target priority:** Bulwarks with taunt active > closest player > lowest HP player
- **Pack behavior:** Some enemies buff each other or combo their abilities when in groups

---

## 15. Loot & Equipment

### Loot Philosophy
- Loot should feel **exciting** -- distinct visual and audio cues for higher rarity drops
- Gear should enable **builds**, not just increase numbers
- Set bonuses encourage thematic playstyles

### Equipment Affixes
Rare+ gear rolls random affixes:
| Affix | Effect |
|---|---|
| of the Forge | +% melee damage |
| of the Storm | +% ability power |
| of the Bastion | +% max HP |
| of the Wind | +% movement speed |
| of the Dragon | +% dragon bond XP gain |
| of the Scholar | Ability cooldown reduction |
| of Vampirism | Lifesteal on hit |
| of Thorns | Reflect damage when hit |

### Set Bonuses (Examples)
**Rustborne Set (4 pieces)**
- 2pc: +10% damage to mechanical enemies
- 4pc: Basic attacks have a 15% chance to release a gear-shrapnel burst

**Aethermind Set (4 pieces)**
- 2pc: +15% ability power
- 4pc: Cycling attunements releases a pulse of the previous element

### Crafting
- Gather materials from enemies, gathering nodes, and mission rewards
- Craft at the Forgeworks in Ironhaven
- Crafted gear has **guaranteed affix slots** (choose 1 of 3 options)
- Endgame **Forgeborn** weapons require: Legendary base weapon + Dragon Essence + Boss Material + Rare Ore

---

## 16. UI & HUD

### In-Game HUD Layout
```
[Dragon Icon + Bond]                              [Mini-Map]
[Status Effects]                                   [Party HP]

                    [ GAME VIEW ]

[HP Bar ====------]  [Class Gauge]
[Ability 1] [Ability 2] [Ability 3] [Ability 4]  [Dragon Ability]  [Item]
```

- **HP Bar:** Left side, pixel-art styled health bar with class-colored frame
- **Class Gauge:** Unique per class (Momentum, Aegis, Shadow, Focus, Tempo, etc.)
- **Dragon Icon:** Shows your dragon's face, current element, and bond level
- **Mini-Map:** Top-right, shows nearby terrain, enemies (red dots), allies (blue dots), objectives (yellow star)
- **Party HP:** Small HP bars for party members, top-right under mini-map
- **Ability Icons:** Bottom-center, show cooldown sweep, hotkey labels

### Menu Design
- Steampunk aesthetic -- gear borders, brass buttons, parchment backgrounds
- Inventory uses a grid system with item rarity color borders
- Dragon management screen shows your dragon at large scale with stats, abilities, and accessories
- Codex (Savant library) styled as an actual book with tabbed pages

---

## 17. Audio Direction

### Music
- **Ironhaven Hub:** Warm, brassy steampunk soundtrack. Accordion, mechanical percussion, string sections. Think Parisian cafe meets industrial factory.
- **Overworld Exploration:** Region-specific ambient tracks that evolve as you go deeper into danger. Dynamic layering system -- instruments add as combat approaches.
- **Combat:** Up-tempo, driving tracks with heavy percussion and electric/synth elements. Boss themes are unique compositions with melodic motifs tied to lore.
- **Dragon Themes:** Each dragon element has a musical motif that subtly blends into the background when your dragon activates abilities.

### Sound Design
- **Pixel-crunch** aesthetic -- satisfying retro hits, 16-bit style with modern mastering
- **UI sounds:** Mechanical clicks, gear turns, steam hisses for menu navigation
- **Combat feedback:** Distinct sounds for hits, crits, dodges, blocks, element procs
- **Dragon sounds:** Tiny chirps, growls, purrs for idle; elemental roars for abilities (scaled down to be cute)

---

## 18. Profession System

### Philosophy
Professions are **easy, impactful, and never required**. They're a fun side system that creates useful consumables for you and your dragon. The key design goal: **players should never feel the need to hoard items**. Consumables should be plentiful enough and long-lasting enough that using them feels good, not wasteful.

### How Professions Work
- **Every character can do all professions** -- no specialization or locking
- Materials drop naturally during missions (no dedicated gathering runs needed)
- Crafting is done at the **Forgeworks** in Ironhaven at dedicated stations
- Recipes unlock automatically as you level up and discover new materials
- Crafting is instant -- select recipe, spend materials, get item. No wait timers.

### The Three Professions

#### Alchemy (Player Consumables)
Craft potions and elixirs for direct player use.

| Item | Effect | Duration |
|---|---|---|
| Vitality Tonic | Restores 50% HP instantly | Instant |
| Mana Draught | Restores 50% ability resource | Instant |
| Ironhide Brew | +20% defense | 5 minutes (persists through death) |
| Swiftfoot Elixir | +25% movement speed | 5 minutes |
| Berserker's Draught | +15% attack power, -5% defense | 5 minutes |
| Scholar's Ink | +15% ability power | 5 minutes |
| Cleansing Tincture | Removes all debuffs | Instant |
| Phoenix Philter | Auto-revive once if downed (full HP) | Until triggered or mission ends |

**Design Note:** Buff durations are long (5 minutes = roughly an entire mission). Players should pop a buff at the start of a mission and feel empowered the whole time, not micromanage cooldowns.

#### Dragon Feeding (Dragon Consumables)
Craft treats and tonics specifically for your dragon companion.

| Item | Effect | Duration |
|---|---|---|
| Aethite Snack | +10 Bond XP | Permanent |
| Ember Treat | Dragon attacks gain fire damage | 5 minutes |
| Frost Treat | Dragon attacks gain ice slow | 5 minutes |
| Growth Tonic | Dragon stat bonuses doubled | 5 minutes |
| Bond Elixir | +50% Bond XP gain rate | 10 minutes |
| Dragon Candy | Dragon does a happy dance (cosmetic) + tiny stat boost | 3 minutes |
| Protective Kibble | Dragon blocks 1 lethal hit for you | Until triggered |

**Design Note:** Feeding items are also how you discover some dragon mutations -- certain rare recipes at higher levels produce mutation items directly.

#### Tinkering (Gear Upgrades & Gadgets)
Craft one-time-use gadgets and gear enhancement items.

| Item | Effect |
|---|---|
| Aethite Polish | Upgrade a piece of gear by +1 level (minor stat increase) |
| Affix Reroller | Reroll one random affix on a Rare+ gear piece |
| Signal Flare | Reveals all enemies and secrets on the current mission map |
| Decoy Drone | Deploys a small drone that draws enemy aggro for 15 seconds |
| Repair Kit | Instantly revive a downed party member at 50% HP |
| Overclock Coil | Next ability used has no cooldown (one-time) |

### Profession Leveling
- Professions level from 1-20 passively as you craft
- Higher levels unlock more recipes and improve yield (craft 2 instead of 1 from the same materials)
- No grind required -- natural play provides enough materials to level professions alongside your character

---

## 19. Death & Difficulty

### Difficulty Tiers
Each mission can be played at three difficulty levels, selectable before deployment.

#### Easy
- Enemies deal **reduced damage** (-30%)
- **Checkpoint respawn** -- when you die, you respawn at the last room transition
- Mission only fails if **all party members are dead simultaneously** (in co-op, one player standing keeps the run alive)
- Best for: Story enjoyment, casual play, learning a new class

#### Medium
- Enemies deal **normal damage** with standard attack patterns
- **Shared life pool of 5 lives** -- each player death (or party wipe in solo) consumes a life
- When lives run out, the mission fails and you return to Ironhaven with partial rewards
- Best for: Standard challenge, balanced risk/reward

#### Hard
- Enemies deal **increased damage** (+30%), have new attack patterns, and elite enemies appear more frequently
- **Shared life pool of 3 lives** -- very limited margin for error
- Exclusive loot drops only available on Hard difficulty
- Boss fights gain additional phases and mechanics
- Best for: Endgame players, loot hunters, players who want a real challenge

### Death Flow
```
Player HP hits 0 -> "Downed" state (5 second timer)
    -> In co-op: allies can revive you (3 second channel) 
    -> If timer expires or solo: Consume 1 life, respawn at room entrance
    -> If no lives remain: Mission Failed -> Return to Ironhaven
```

### Failure is Gentle
- You **always keep** XP earned during a failed mission
- You keep **common/uncommon materials** gathered
- You lose **rare+ loot drops** (incentive to succeed, but not punishing to try)
- Dragon Bond XP is still awarded (reduced by 50% on failure)

---

## 20. Technical Considerations

### Target Platform
- **PC only** (distributed to friends directly or via Steam/itch.io)
- No console ports planned -- keeps scope manageable for solo dev

### Engine
**Godot 4** (GDScript)
- Free and open source -- no licensing costs or revenue sharing
- Excellent 2D support with built-in tilemap editor, animation tools, and particle systems
- GDScript is approachable and fast to iterate in
- Active community with growing plugin ecosystem

### Multiplayer Architecture
- **P2P with host migration** via Godot's built-in ENet or Steam Networking Sockets
- One player hosts; others join via lobby code or Steam friend invite
- Client-side prediction with host authority on damage/loot
- Since it's friends-only, anti-cheat is not a priority -- trust the homies

### Performance Targets
- 60 FPS on all platforms
- Max entities on screen: ~100 (enemies, projectiles, effects)
- Target load time: <3 seconds for zone transitions

---

## Appendix A: Development Roadmap (Solo Dev)

A realistic phased approach for a solo developer:

| Phase | Milestone | Content | Focus |
|---|---|---|---|
| **1. Prototype** | Core Loop | 1 class (Ironclad), 1 dragon (Pyraling), 1 tileset, basic combat | Prove the combat feel is fun |
| **2. Vertical Slice** | Playable Demo | 3 classes, dragon mutation system, 1 full region (Rustfields), Ironhaven shell | Prove the full loop works end-to-end |
| **3. Multiplayer** | Co-op Works | P2P networking, 2-player co-op tested, shared missions | Prove multiplayer is stable |
| **4. Content Push** | Half the Game | 5+ classes, 3 regions, hybridization, profession system | Build out content while systems are stable |
| **5. Polish & Complete** | Feature Complete | All 9 classes, all 6 regions, full story, all dragon mutations, all professions | Fill in remaining content |
| **6. Friends Beta** | Playtest | Give it to friends, gather feedback, balance, fix bugs | Iterate based on real play |
| **7. Release** | Done | Share with friends, maybe put on itch.io | Celebrate |

---

## Appendix B: Inspirations & References

| Game | What to Take |
|---|---|
| **Final Fantasy V/VI** | Job system depth, world-building, pixel art storytelling |
| **Phantasy Star Online** | Mission loop, lobby system, co-op feel, loot satisfaction |
| **Secret of Mana** | Real-time top-down co-op combat, ring menu |
| **CrossCode** | Modern pixel-art action RPG feel, puzzle integration |
| **Monster Hunter** | Preparation before missions, meaningful boss fights, material farming |
| **Stardew Valley** | Hub town warmth, NPC relationships, pixel art charm |

---

*Document created: 2026-09-01*
*Last updated: 2026-09-01*
*Status: Draft v2.0 -- Fully detailed with all design decisions finalized*
