# Wildfire

A top-down pixel-art action RPG set in Aethermere. The shipping target is Godot 4;
this repo holds the **vertical slice** — a single-file HTML/canvas prototype used to
find the combat feel before any of it is rewritten in GDScript.

Open `wildfire-slice.html` in a browser. No server, no build step, no dependencies.

## What's in the slice

Nine classes, each with a bespoke class mechanic rather than a reskinned ability bar
(Momentum, Aegis, Runic Charge, Attunement, Tempo, Focus, Shadow, Eidolons, Assimilation),
six dragon hatchlings with their own element and two skills, and seven areas — the
cottage interior, the clearing with Hayla and her rustquail problem, the road to the
Ironhaven gate, the Cogway beyond it, and three hunting grounds out through the ring's
north, east and west gates.

Inside the walls nothing fights back — the Rustfields and the city are for learning the
controls. Outside them everything hunts.

### The Cogway

Ironhaven's upper ring: a circular street around the crater the city was dug out of,
with twelve shopkeepers and citizens along it. It is generated from a radius test
rather than hand-placed, so the street is a true circle, and three numbers define the
whole area — see `buildCogway()` in `src/p4_areas.js`.

The street is seven tiles wide, and that number is load-bearing. The viewport is 30x17
tiles, so the camera reaches 8.5 tiles above and below you; any wider and you could
stand at the outer kerb with the crater off the bottom of the screen. The camera also
leans 52px toward the hole, because centred on the player it spends half the frame
looking at the street behind you. `tests/suite_cogway.js` asserts the crater is in
frame from every point on the street, which is the brief stated as a test.

The city is grey stone and iron. Colour arrives only as accent, from one table of six
aethite stones keyed to the six hatchlings (`ACCENTS` in `src/p1_core.js`) — inlaid
paving, stall awnings, crystal outcrops and the lit windows down the crater walls all
pull from it, so the accents can never drift out of agreement with the dragons. Note
this supersedes the GDD, which describes the hub as warm amber and brass.

### Beyond the walls

Three zones, one per gate: **the Verge** (grassland, north), **the Iron Scarp**
(mountains, east) and **the Rivet Shoals** (beach, west). Thirteen creatures across
the world, all built on one rule — an ordinary animal that has grown metal. Aethite
in the soil and the water does it: the hare's ears came in as hammered brass, the
boar's tail wound itself into a spring. That shared rule is what keeps nine species
from three biomes reading as one bestiary rather than three unrelated ones. In the
sprites the metal is always an *addition* to a recognisable animal silhouette and
always uses the cold `col.metal` ramp against the warm body, so it looks bolted on
rather than painted on.

Every outer creature is hostile and works the same small state machine: chase, wind
up, strike, recover. The wind-up is the important number. A telegraphed beat before
every hit is the difference between difficulty and unfairness, and it is what gives
the dodge something to be for — `tests/suite_wilds.js` asserts that damage never
arrives without one.

### The codex

`TAB` opens the field journal; `→` from there is the monster codex. Two tiers,
deliberately: **damaging a creature, or being damaged by one, records it** — portrait,
habitat, stats, field note. Only a **Savant scanning a live one learns it**, which
unlocks the ability. So the codex fills in and is worth opening for every class, but
it means something different in Savant hands, where `↑ ↓ →` assign a learned ability
to one of the three free slots. Slot 1 stays Codex Strike: the Analyzed mark it
applies is what makes everything else worth using.

Unrecorded entries show as silhouettes. The silhouette is the real sprite drawn
through a colour override rather than a second set of art, so it can never drift out
of date with what you actually meet in the field.

### Aethite

One pool does two jobs: it mends you, and it is the key to every lock in the world.
That is the whole design — spending it to survive is spending the thing that opens
the next gate.

`R` burns Aethite: teal steam comes off you and health climbs while the store drains.
Only out of combat, which means no hostile within 150px and nothing having hit you in
the last three seconds. Walking into Ironhaven refills you on arrival — but *only* on
arrival, not continuously, or every lock inside the city would be free.

Capacity comes **only** from milestones (`MILESTONES` in `src/p5_player.js`): bonding,
Hayla's hunt, first blood in each of the three zones, and two codex tiers. Nothing
grindable. The consequence is that the ladder has to actually reach every lock, and
worse, a lock's requirement must be reachable *without passing that lock* — a circular
dependency would end a run with nothing on screen to say so. `tests/suite_aethite.js`
proves both by reasoning over the tables rather than by playing through.

Two locks so far: the **Scarp Gate** (the mountains are sealed until your dragon can
hold enough — Gate-Warden Thorne at the east gate explains, and says something
different once you qualify) and the **Cogway Lift** down into the crater. The lift
descends for real and lands in the Undercroft, a lit stub with a sealed door where
the next ring plugs in.

### The TAB menu

Six pages behind one key: **Journal, Codex, Dragon, Inventory, Map, Options**. The tab
strip cycles with **Q/E**, not the arrows or A/D — every page underneath wants those for
its own navigation, and sharing them would make each page fight the menu it lives in.
Q/E are the shoulder buttons on a pad, which is where tab-cycling belongs anyway.

### Items and the dragon

Two kinds of item and the distinction is the whole inventory: **salvage** exists to be
sold (talk to any Cogway trader and they clear it as part of the conversation), and
**parts** exist to be bolted onto your dragon.

Every part is made from the creature that dropped it — the Anvil Crab's claw really is
the claw you watched it swing. That keeps the bestiary and the dragon customisation as
one system rather than two, and it means the visible change on your dragon is always
sourced from something you fought. Parts are drawn in *their creature's* colours, not
the dragon's, so they read as hardware bolted on.

Three slots, and each reaches a different system:

| Slot | Modifies |
|---|---|
| head | your dragon's **Q** (its breath) |
| wing | your dragon's **E** (its second skill) |
| body | **you** — attack, cooldowns, health, speed, Aethite regen |

Only fire's E deals damage; the other five hatchlings get buffs. So a wing part's
damage bonus lengthens the buff where there's no damage to raise, or five of the six
dragons would have a dead upgrade slot.

`tests/suite_gear.js` pins the rule no screenshot can catch: a part belongs to exactly
one slot and exists in exactly one place — bag or fitted, never both. Every plausible
bug in this system is a duplication bug.

### Two players

`1 PLAYER` / `2 PLAYERS` on the title screen. Each player picks their own class and
hatchling in turn — the select screen shows whose turn it is and marks what the other
already took — and they're tagged **1P red** and **2P blue** by a ring at their feet
and a small badge, rather than by recolouring the costume (the Reaver is already red
before anyone assigns it a player).

Both share quests, inventory, money and the codex. Each has their **own** health,
class gauge, dragon and **Aethite store** — burning yours never costs your partner
theirs, though capacity grows for both at the same shared milestones.

The camera frames the midpoint and the viewport edge is a soft wall: you slide along
it rather than being stopped, warned or snapped. Nobody is ever dragged.

A player at zero health goes **down** instead of ending the run; their partner revives
them by standing close for a couple of seconds, no button. Only a full wipe is a game
over. In a solo run PLAYERS has one entry and death is death, exactly as before.

| | P1 | P2 |
|---|---|---|
| move | `WASD` | `IJKL` |
| abilities | `↑ ← ↓ →` | `7 8 9 0` |
| dodge | `SPACE` | `N` |
| dragon | `Q` `E` | `U` `O` |
| burn Aethite | `R` | `Y` |
| interact | `F` | `H` |

**How it's built.** `player`, `cls`, `drg` and `dragon` are a *cursor* into a `PLAYERS`
array, not singletons — `withPlayer(p, fn)` points them at one player for the duration
of a call. Every system in the game already read those globals, so threading a player
argument through all of them would have been a rewrite; this way existing code works
unchanged and simply operates on whoever is current.

The hazard that creates is deferred work: a callback P1 scheduled would otherwise
resolve against whoever the cursor happened to be on when the timer expired, so P1's
Lacerate would credit P2's Tempo. `setDelayed` captures its owner and restores it.
The roster also deep-copies each class, because the Savant *writes* to `cls.abilities`
when it learns something and two players sharing one object would share a loadout.

### Easy attacks

Off by default; `OPTIONS` → `EASY ATTACKS`. Puts the whole rotation on the **first**
ability key. Most classes here are a builder/spender loop — stack the gauge, then dump
it — so "rotation" isn't a fixed cycle but a decision: spend if the gauge is ready and
a spender is off cooldown, otherwise build. Classes with no such shape cycle whatever
is usable, in order. The HUD shows what the next press will do.

Only the first key is rerouted; the other three still fire their own slots, so turning
this on adds an option without taking the manual one away — a player who switches it
on mid-fight shouldn't find their other three buttons have stopped working.

### Options

`OPTIONS` on the title screen, and `→` twice from `TAB`. Player 1 input device and a
few settings. **This is a mockup** — the rows move, nothing behind them is wired.
It exists to settle the shape of the screen before any Gamepad API work.

| Key | |
|---|---|
| `WASD` | move |
| `SPACE` | dodge / rift step / assimilate |
| `↑ ← ↓ →` | abilities 1–4 |
| `Q` `E` | dragon skills |
| `R` | burn Aethite (out of combat, 1s recast) |
| `F` | talk, doors, channel into locks, ride the lift |
| `\u2191` (Savant) | scan a new creature, or mark a known one Analyzed |
| `TAB` | menu — journal, codex, dragon, inventory, map, options. Pauses the game. |
| `Q` `E` | cycle menu tabs (while the menu is open) |
| `M` | mute |

In two-player, `TAB` is P1's menu and `P` is P2's. Whoever opened it is who it
belongs to: the dragon page fits parts to *their* dragon, the codex equips
*their* Savant, and the other player cannot close it. In one player both keys
open the same menu.

## Gathering

Every zone has one material and it is found nowhere else — Rust Scrap in the
Rustfields, Bloom Iron in the Verge, Crag Glass on the Scarp, Brine Salt in the
Shoals, Vein Shard in the Glimmervein. `F` at a node works it; it grows back
after 45 seconds. Creatures carry a little of the ground they live on, at a
much worse rate.

That exclusivity is what makes "bring me one of each" a reason to travel rather
than a reason to stand in one field.

## Quests

Five postings, all given on the top ring, deliberately five different shapes
rather than five instances of one shape with different numbers:

| Giver | Posting | Shape |
|---|---|---|
| Marta Quill | Nobody Takes the Quail | kill eight of one species |
| Vosk | Light Stuff, and Lots of It | gather ten of one material |
| Archivist Weal | One of Each, and Nothing Twice | one material from every zone |
| Deep-Marshal Ivo | The Ledger of Small Losses | plant a collector, charge it by being hurt and then mending beside it, carry it home |
| Halla Pike | Cut It at the Root | break three spirit pylons, then cut two shards from a seam with nothing standing over it |

They pay in Aions, salvage, dragon parts, and Aethite capacity. The QUESTS tab
in the menu tracks them, and a marker floats over anyone with business:

| Marker | Means |
|---|---|
| blue `!` | something to give you |
| green `?` | something finished, waiting to be handed back |
| grey `?` | in progress — come back when you have it |

## Music

Four voices, no assets, same as the sound effects: two square channels (lead
and harmony), a triangle bass and a noise channel for the kit. Notes are
scheduled against the audio clock with a look-ahead, never off `setTimeout` —
a timer being 30ms late then costs nothing, because the notes were already
booked.

Seven tracks. The title is 154bpm with a full kit; every zone gets something
quieter, and each voice loops at its own length so a sixteen-step bassline
under a sixty-four-step melody is written once.

| Where | Track |
|---|---|
| cottage, clearing, outer gate | Millbrook — warm, unhurried |
| Ironhaven | stately, mechanical |
| The Verge | open, airy |
| The Iron Scarp | cold, sparse, slow |
| The Rivet Shoals | rolling, a hat like surf |
| Undercroft, Glimmervein | dark, two voices, long gaps |

Every track is levelled from its own notes: the module sums the energy of one
long window, takes the RMS and scales to a common target, so all seven sit at
one loudness and editing a pattern keeps them there. `M` mutes everything.

Sound effects are not all one volume — a footstep should not land like a
detonation — but the range is compressed to about twelve decibels, with the
things that fire often near the middle of it. There is no audio device in the test environment, so
`tools/render_music.js` synthesises each track to a WAV and
`tools/piano_roll.js` draws the score as a picture — those are the only way to
check the writing here:

```
node tools/render_music.js music-preview 12
node tools/piano_roll.js music-preview/piano-roll.png 8
```

## Testing

`777` typed on the OPTIONS page grants 999 Aethite store and takes both
dragons to bond 99, so a late-game lock or a high-bond ability can be reached
without playing to it. The options page says GOD MODE while it is on.

```
node tools/sfx_levels.js        # how loud is every sound effect, really
node tools/render_music.js music-preview 12
node tools/piano_roll.js music-preview/piano-roll.png 8
```

## The map

Aethermere is a shaft with a city built round the lip of it, so the map is a
stack of floors rather than one sheet. `W` and `S` move between them.

A floor you have never stood on does not appear at all — not greyed, not
`???`, absent — because the whole point of the crater is that you do not know
how far down it goes. Once you have been to a floor, everything on it is
drawn, and the parts you have not reached read `???`. Those are two different
kinds of unknown and the map says so.

## The Phantom's dodge

`SPACE` does something different for four of the nine classes. Most roll; the
Aethermancer blinks; the Savant scans; the Phantom loses cohesion — the figure
collapses into a puddle, the puddle runs along the ground, and it stands back
up somewhere else. The destination is probed outwards the way Rift Step probes
its blink, so it can put you against a wall but never inside or through one.

## Elements

Damage carries an element, or none. Neutral damage — most weapon swings — is
never resisted. A creature can be immune to exactly one element and weak to
others; immunity is zero, not a reduction, and the number says IMMUNE rather
than not appearing.

Your elemental damage comes from your dragon's breath and from any creature
ability a Savant has learned. The Glimmervein, below the Undercroft, is built
around this: three colours of the same spirit, each immune to its own element
and taking nearly double from the other two.

## Layout

```
src/            eleven ordered parts, concatenated into one script
tools/          build.sh, test.sh
tests/          headless Canvas2D shim + regression suites
archive/v1/     an earlier prototype, built from the wrong brief; kept for reference
*.md            the GDD, project context, and concept art prompts
```

`src/` is deliberately not a module system. The ship artefact has to be one
double-clickable file, so the parts share a single scope and **order matters**:
`p0` defines the bitmap font `p9`'s HUD draws with, `p1` defines the palette and
global state everything reads, and so on. `tools/build.sh` owns that order.

## Build and test

```sh
./tools/build.sh          # -> build/game.js, wildfire-slice.html
./tools/test.sh           # build, then run every suite
./tools/test.sh tests/suite_cogway.js   # or just one
```

`wildfire-slice.html` is generated but committed, so a fresh clone is playable
without a shell. Rebuild it after any change to `src/`.

## About the tests

There is no browser available here, so `tests/shim.js` is a hand-rolled Canvas2D
implementation that composites RGBA and can write a PNG — enough to assert on what
actually got drawn. `tests/strict.js` layers on the argument validation a real
browser performs: non-finite coordinates, negative arc radii, zero-size `drawImage`
sources, exponential-ramp rules, and read-only `AudioParam`s.

That last one is why the strict layer exists. A plain `bp.Q = 0.9` assignment —
`Q` is a read-only accessor — threw in strict mode inside the first sound effect
played on the title screen, which killed `requestAnimationFrame` before the game
ever started. The symptom was a blank page with no console. Two defences came out
of it: the strict mock, and a `try`/`catch` around every frame in `p10_main.js`
that paints the error on screen and always re-schedules the loop, so a throw
degrades into a readable panel instead of a black rectangle.

A note for anyone reading a failing suite: several apparent bugs have turned out
to be stale test setup. Melee reaches are 26–34px, not 40; targeting is driven by
`player.inx/iny` (the WASD heading), not `dx/dy` (the aim vector, which snaps to
the marked enemy); and knockback can legitimately push a target out of reach
between two hits, which reads as a miss because it is one.

## Not yet ported from the v1 prototype

The mutation/refinery system. Everything else in `archive/v1` was built against a
misread of the brief and is kept only as a reference for the rendering approach.
