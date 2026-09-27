---
title: "Wildfire - Project Context & Session Notes"
tags: [game-design, personal-project, context, session-notes]
created: 2026-09-01
status: active
---

# Wildfire - Project Context

Use this document to resume work on this project in future sessions. Share this file (or the key decisions below) with Devin to pick up where you left off.

---

## Project Summary

**Wildfire** is a top-down pixel-art action RPG for 1-4 players. Steampunk sci-fi fantasy setting. Inspired by Final Fantasy and Phantasy Star Online. You have a tiny dragon companion that follows you around and is central to your build.

## Key Documents

All files are in your Obsidian vault under `Personal/Wildfire/`:

| Document | Description |
|---|---|
| [[Wildfire - Game Design Document]] | Full GDD (v2.0) -- all systems, classes, lore, mechanics |
| [[Concept Art Prompts]] | Leonardo.ai prompts for all 9 classes (male + female) and 6 dragons |
| [[Project Context]] | This file -- resume context for future sessions |

## Finalized Design Decisions

These were decided through Q&A and should not be re-asked:

| Decision | Choice |
|---|---|
| **Game title** | Wildfire |
| **Art style** | Top-down (Zelda-style), 16x16 tiles, 16x24 characters, 480x270 native res |
| **Combat** | Real-time action (hack-and-slash, dodge rolling, abilities) |
| **Multiplayer** | 2-4 player co-op, P2P networking, friends-only |
| **Engine** | Godot 4 (GDScript) |
| **Platform** | PC only |
| **Monetization** | Free -- just for friends, no monetization |
| **Dev scope** | Solo dev passion project |
| **Story structure** | Main throughline + self-contained episodic regions |
| **Narrative choices** | Light choices (affect dialogue/side content, not main plot) |
| **Overworld** | Mission-gated (PSO style -- select mission from hub, load into zone) |
| **Player housing** | None -- skipped to keep scope focused |
| **Cosmetics** | Moderate -- gear has visual variety, dye station, no full transmog |
| **Rating/tone** | E10+ -- lighthearted, adventurous, world worth saving |
| **Playtime** | 20-30 hours main story |
| **Endgame** | Repeatable loop (nightmare expeditions, raids, dragon ascension) -- no NG+ |
| **Cross-play** | PC-only at launch, no cross-play needed |

## Class System (9 Classes + Hybridization)

| # | Class | Role | Weapon | Unique Mechanic |
|---|---|---|---|---|
| 1 | Ironclad | Warrior / Melee DPS | Greatswords, Axes, Hammers | Momentum (combo stacking) |
| 2 | Bulwark | Tank | Tower Shield + One-hand | Aegis Gauge (block-to-counter) |
| 3 | Runebreaker | Melee Spellcaster | Rune Gauntlets | Runic Charge (inscribe + detonate) |
| 4 | Aethermancer | Ranged Spellcaster | Staves, Orbs | Attunement (Fire/Ice/Lightning cycling) |
| 5 | Reaver | Dual Wield Short-Range | Pistol+Blade / Dual Pistols | Tempo (alternate melee/ranged) |
| 6 | Longshot | Sniper | Rifles, Railguns | Focus (stand still to power up) |
| 7 | Phantom | Stealth Melee | Daggers, Short Swords | Shadow Gauge (stealth + backstab) |
| 8 | Eidolon | Summoner | Totems, Channeling Rods | 2 simultaneous AI summons |
| 9 | Savant | Blue Mage / Scholar | Tomes, Monocle-Scanners | Assimilation (scan ALL enemies to learn abilities) |

**Hybridization:** At level 30, pick a secondary class. Gain 2 of its abilities + a passive trait. Do NOT gain its class mechanic. Permanent per character.

## Dragon System

- **One dragon per character** -- permanent bond, your best friend
- **6 base types:** Pyraling (Fire), Frostling (Ice), Voltling (Lightning), Verdling (Nature), Voidling (Dark), Luminling (Light)
- **Bond Level 1-100** -- unlocks ability slots and mutation slots
- **Mutation System (slotted, swappable):** Up to 5 mutation slots. Items found in missions. Freely swap at the Aethite Refinery in Ironhaven. Categories:
  - Elemental Aspects (add/blend elements, create dual-element dragons)
  - Physical Mutations (Twin Heart = two dragons, Hydra Crest = two heads, Serpent Tail, Wyrm Scale, Fae Wings, Claw Gauntlets)
  - Stat Infusions (Power, Ward, Haste, Vitality, Affinity, Resonance crystals)
  - Accessories (Tiny Goggles, Clockwork Scarf, Mini Shield, Bell Collar)
- **Evolution at Bond 50** -- visual upgrade based on element + mutations
- **Ascension at Bond 100** -- final form, ultimate ability, unique visual per mutation loadout

## Other Key Systems

- **Death/Difficulty:** Easy (checkpoint respawn, fail on full wipe), Medium (5 shared lives), Hard (3 shared lives + exclusive loot)
- **Professions:** Alchemy, Dragon Feeding, Tinkering. All available to everyone. Easy, impactful, not required. Long-lasting buffs (5 min = whole mission). Materials drop naturally.
- **Savant:** Can learn from ALL enemies (80-100+ abilities). Equip 4 at a time.
- **6 Regions:** Rustfields, Verdant Vents, Shattered Reach, Cinderdeep, Frozen Abyss, Void Scar (endgame)
- **Hub city:** Ironhaven -- 4 concentric ring districts (Cogway, Forgeworks, Guild Quarter, Undercroft)

## Art Pipeline Status

- **Pixel art skill:** Beginner (no prior experience)
- **Budget:** Zero / free only
- **AI tool:** Leonardo.ai (free tier)
- **Concept art prompts:** Written for all 9 classes (male + female = 18 prompts) + all 6 dragons + bonus group shots + mutation concepts
- **Next step:** Run prompts in Leonardo.ai to generate reference art, then begin learning pixel art (LibreSprite/Aseprite) starting with the Ironclad

## What Has Been Done

- [x] Full GDD v2.0 with all game systems
- [x] Leonardo.ai concept art prompts for all 9 classes + 6 dragons
- [x] Godot 4 project scaffolded (`~/projects/wildfire/`)
  - Player controller (8-dir movement, dodge, basic attack, Momentum mechanic)
  - Dragon companion (orbital follow, bob, element abilities)
  - Base enemy + slime test prefab
  - HUD (HP bar, momentum pips, lives, dragon bond)
  - GameManager + CombatManager autoloads
  - Test room with 3 slimes
  - Input mapping: WASD, mouse attack, space dodge, Q dragon, 1-4 abilities
- [x] Expanded skill design for all 9 classes (8 skills each, pick 4)
  - Bulwark reworked: Aegis Gauge is aggro-as-resource with 3 tiers
  - Aethermancer reworked: Focus/Spread mode toggle via Convergence (locked slot 4), Rift Step replaces dodge, 6 dual-mode elemental spells (pick 3)
  - Runebreaker: added Runic Bond for heal-through-violence group support
  - Reaver: weapon changed to dual gunblades, basic attack (tap=blade, hold=gun) is the Tempo engine
  - Savant: stripped to 3 innate tools (Codex Strike, Mend, Assimilate) + all 4 slots from learned abilities, Codex progression milestones

## What Has NOT Been Done Yet

- [ ] Generate actual concept art from the prompts
- [ ] Design specific NPC characters for Ironhaven
- [ ] Write dialogue or story scripts
- [ ] Write the story outline (episode-by-episode for all 6 regions)
- [ ] Design specific mission layouts / room tiles
- [ ] Create the full Savant learnable ability list (80-100+ abilities)
- [ ] Design the Mastery Board post-level-cap
- [ ] Compose or source music/audio
- [ ] Create pixel art sprites
- [ ] Build tileset for Ironhaven or any region
- [ ] Implement multiplayer networking
- [ ] Add sprites/SpriteFrames to the Godot project (currently placeholder)

## Suggested Next Session Topics

1. **Generate concept art** -- Take the prompts to Leonardo.ai and generate reference images
2. **Design Ironhaven NPCs** -- Name and personality for key NPCs (Commander Voss, shopkeepers, etc.)
3. **Write the story outline** -- Episode-by-episode plot summary for all 6 regions
4. **Full Savant ability list** -- Design all 80-100+ learnable abilities mapped to specific enemies
5. **Enemy design** -- Define enemy types per region with their learnable abilities
6. **Pixel art practice** -- Start with the Ironclad sprite using the concept art as reference

---

*Last session: 2026-09-01*
*Session summary: Renamed project to Wildfire. Set up Godot 4 project. Designed expanded skill sets for all 9 classes (8 skills each, pick 4). Major reworks: Bulwark aggro-as-resource, Aethermancer Focus/Spread dual-mode, Reaver dual gunblades, Savant stripped to learned-only.*
