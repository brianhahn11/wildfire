# Art migration — 8-bit to 16-bit

Audited at `slice-b27`. This is the plan, not a record of work done.

---

## 1. The finding that reframes the job

**There are no art assets.** No PNGs, no sprite sheets, no tilemap files, no
atlases. Every pixel in Wildfire is a `fillRect` emitted by hand-written code
at runtime. The repo contains exactly one image, and it is a rendered piano
roll used to check the music.

So the brief's step 4 — "refactor or replace the existing sprite sheets and
tile maps" — has nothing to operate on. Its equivalent here is **rewriting the
painters**, of which there are about 1,480:

| Where | What | Count |
|---|---|---|
| `p3_tiles.js` | tile painters, 98 `case T.X:` arms across 3 passes | 609 `tpx()` |
| `p8_sprites.js` | player, creatures, NPCs, dragon, summons, effects | 607 `px()` |
| `p4_areas.js` | the Pit, the outer ring, buildings — painted whole, not per tile | 71 `tpx()` |
| `p9_ui.js` | HUD, menus, title key art | 195 `fillRect()` |
| `p0_font.js` | bitmap font, 104 glyphs on a 5×8 cell | — |

That is the good news and the bad news. Bad: there is no "swap the sheet"
shortcut; every one of those sites has coordinates hand-placed against a 16px
tile and a 14×24 humanoid. Good: ~1,200 of them funnel through **two
primitives**, `px()` and `tpx()`, which is the hook that makes a staged
migration possible at all.

---

## 2. Two decisions to make before any code changes

### 2a. Tile size: agree 32, but not for the reason in the brief

Worth being accurate about the reference points, because it changes what we
spend effort on:

- **Chrono Trigger and FF6** are 16×16 tiles. Their 16-bit look is not grid
  size — it is 15 colours per sprite instead of 3, value ramps on every
  material, and irregular silhouettes.
- **Stardew Valley** is also 16×16, displayed at 4× zoom.
- **Secret of Mana** is 16×16.

None of the target games has 32×32 tiles. **The 16-bit look is palette depth,
shading and animation, not tile dimensions.**

Wildfire is already past NES constraints — a 100+ colour palette, 4–5 step
ramps in places (`C.crag1..crag5`, `C.cave1..cave5`), and 14×24 humanoids.
Its real position is *late 8-bit*, and the gap to the target is detail density
and frame count.

**Recommendation: double to 32 anyway.** Not because 32 is the era-correct
grid, but because the current sprites are at the ceiling of what 16px allows.
A 14×24 humanoid already carries a hood, a gunblade and a pauldron; there is
no room left for the shading ramps and silhouette detail that read as 16-bit.
Doubling gives every existing sprite 4× the pixel budget to spend on exactly
those things. The resolution change is the **enabler**, not the upgrade.

### 2b. Scale the RENDERER, not the world

This is the most important structural decision in the plan.

The naive route is `TILE = 32`. It is a trap. Every gameplay number in this
game is expressed in world pixels — speeds, ability ranges, aggro radii,
knockback, the tether margin, `targetRange()`, every `dist(...) < 40`. There
are roughly 1,300 such numbers across `p5`/`p6`/`p7`/`p10`, plus 94 in the
`ENEMY_TYPES` table alone. Doubling `TILE` silently changes all of them
relative to the world and the game plays differently — which breaks the
brief's one hard requirement, *preserve the feel*.

**Instead: the world stays at 16 units per tile. Only drawing scales.**

```
TILE  = 16      // unchanged. World units. No gameplay constant moves.
ART   = 2       // render scale. New.
VW/VH = 960x540 // was 480x270. Same 30x17 tiles on screen.
```

Consequences:

- Zero gameplay constants change. The tether, ranges, speeds, areas, the
  Cogway's radii, every test's expectations — all untouched.
- The camera gains one `scale(ART, ART)`; terrain buffers become
  `a.w*TILE*ART` (Cogway: 1024² → 2048², ~16 MB per buffer, two buffers —
  fine).
- The player sees exactly the same amount of world. Layout preserved by
  construction rather than by care.
- 960×540 is an exact 2× integer scale on a 1080p display, so it stays crisp.

Static bake cost today is 79 ms for the Cogway under the test shim, which is
10–40× slower than a browser. At 4× the pixels that is still comfortably under
a frame in a real browser, and it happens once per area load.

---

## 3. The hazard, and the mechanism that avoids it

**Mechanically doubling every coordinate produces 16-bit resolution with 8-bit
art** — every pixel becomes a 2×2 block. That is strictly worse than today and
is precisely the "don't mix 8-bit and 16-bit" failure. With ~1,480 sites, there
is no version of this where everything converts at once.

So the doubling must be invisible until each piece is genuinely redrawn.

**The unit-aware primitive.** `px()` and `tpx()` gain a notion of the density
the art was authored at:

```js
let ART_UNIT = 1;                 // 1 = old art, 2 = redrawn art
function px(c, col, x, y, w, h){  // coordinates in AUTHORED units
  const k = ART / ART_UNIT;       // 2 for old art, 1 for new
  c.fillRect(x*k, y*k, w*k, h*k);
}
```

Unconverted art draws through a ×2 multiply and looks exactly as it does today
(identical to the browser upscaling it now). Converted art draws at native
density. A painter is converted by wrapping it in `withArt(2, ...)` and
redrawing its contents at the new density.

This buys the properties that matter over a job this size:

- **The game is playable and visually coherent at every single commit.**
- Categories convert independently, in any order.
- The existing 18 test suites keep passing throughout — they assert world
  coordinates and game state, not pixels.
- If we stop halfway, the result still ships. It looks like today.

---

## 4. Asset categories, and the spec for each

Current → target. "Frames" means distinct poses per cycle.

### Terrain — 98 tile arms, 3 passes
| | Now | Target |
|---|---|---|
| Cell | 16×16 | 32×32 authored |
| Value steps per material | 2–3 flat fills | 4–5 step ramp, lit top-left |
| Edge transitions | 3 of 12 families | all 12, plus inner corners |
| Detail | noise speckle | per-material texture: grain, cracks, tufts, wet sheen |

The `GROUND_FAM` edge system is the single highest-leverage fix: today only
grass, water and path have edge logic, so every other material meets its
neighbour on a hard tile boundary. That reads as "tilemap" more than anything
else in the game.

`buildGroundPatches` already bakes seamless 64×64 noise patches for grass and
dry grass — extend this to every ground family rather than re-rasterising with
live fillRects.

### Player — 1 shared humanoid + 9 class overlays
| | Now | Target |
|---|---|---|
| Body | 14×24 | 28×48 authored |
| Facing | 4 logical, 3 art variants (L/R share art) | 4 true variants; back-facing gets its own silhouette |
| Walk | 4 frames, effectively 3 distinct (0 and 2 identical) | 8 frames, all distinct |
| Idle | **no art at all** — static | 4-frame breathing loop |
| Attack | Ironclad only | per-class 3-frame wind/strike/recover |
| Cast | none | 3-frame |
| Dodge | none | 3-frame roll |

Idle having no art is the most visible single gap. The character is on screen
100% of the time and is motionless whenever the player is not walking.

### Creatures — 14 bodies serving 17 types
| | Now | Target |
|---|---|---|
| Size | 18–24w × 14–22h | double |
| Frames | 2 (steppers) / continuous sine (flyers) | 4–6 walk, 3 attack, 2 idle |
| Facing | 2, arithmetic | 2, with a proper turn frame |
| Wind-up tell | colour flash + one pose (imps only) | every hostile gets a distinct wind-up pose |

The wind-up is the game's core combat read — "a telegraphed beat before every
hit is what makes the difference between difficulty and unfairness" is already
the design rule in `p7_actors.js`. Only the imps currently honour it visually.

### Dragon — 1 body, 6 palettes, 17 parts (4 have no art)
Double; add a 4-frame wing cycle (currently a continuous sine shift); give
`emberhorn`, `rimehorn`, `arcprong` and `veingem` art — **they are equippable
today and render nothing.** That is a bug the audit surfaced, not a style
question.

### NPCs — 9 builds, 15 palettes
**Animation is wired but dead**: `drawNPC` passes `n.frame` and `n.moving`,
and neither is ever assigned anywhere in the codebase. Every NPC in the city
renders as frame 0, standing still, forever. Target: idle 4-frame, plus a
working walk for the ones that should wander.

### UI and font
| | Now | Target |
|---|---|---|
| Font | 5×8 cell, 104 glyphs | 10×16, or keep 5×8 and render at 2× |
| Panels | 195 raw `fillRect` | same, doubled; these bypass `px()` and need their own pass |
| Title key art | bespoke ~5× Reaver, `HERO_CONTOUR` | redraw at native density |

The font is the one place where *not* redrawing is defensible — a crisp 5×8
scaled 2× is a legitimate look and costs nothing.

### Effects and environment — mostly new work
| | Now | Target |
|---|---|---|
| Particles | 5 kinds (flame, mote, steam, spark, +1), combat only | + ambient per-zone emitters: dust, pollen, leaves, ash, drips |
| Parallax | **none — no background layer exists** | 2 layers per outdoor zone |
| Water | animated tile, flat | shimmer + shoreline foam cycle |
| Lighting | 4 radial glows, hand-placed | a light list per area; braziers, gems, pylons all emit |

Parallax is genuinely new machinery: there is no background layer today, and
the camera is a straight translate.

---

## 5. Sequence

Ordered by what a player notices, with the game shippable at every step.

| # | Stage | Why here |
|---|---|---|
| 0 | **DONE (b28)** Scaffold: `ART`, 960×540, unit-aware `px`/`tpx`, camera scale | Everything else depends on it. Game looks identical after this. |
| 1 | **DONE (b29–b30)** Terrain ground + the full edge system | Largest screen area. Biggest single perceived jump. |
| 2 | **DONE (b31)** Player: humanoid, 9 overlays, idle + walk + attack | Always centred, always watched. |
| 3 | **DONE (b32)** Terrain props (42 base arms + 26 over arms) | Removes the last of the flat-fill look. |
| 4 | **DONE (b33)** Creatures, 15 bodies, wind-up poses | Combat readability. |
| 5 | Dragon + the 17 parts (incl. the 4 missing) | Always on screen next to the player. |
| 6 | NPCs + wire up the dead animation | City feels alive. |
| 7 | Ambient particles, lighting list, water | Atmosphere. |
| 8 | Parallax backgrounds | New machinery, highest risk, least essential. |
| 9 | UI, HUD, title art, font decision | Least noticed, most fiddly. |

**Honest scope: 15–20 focused sessions.** Stage 0 is one. Stages 1 and 4 are
three to four each. This is a redraw of the entire game, and the code changes
are the *easy* part of it.

---

## STAGE 0 — DONE (b28)

The world/device split is in. `TILE` is still 16 world units; `ART = 2` is
device pixels per world pixel; the canvas is 960×540 and the frame is drawn
through one `scale(ART)` at the top of `frame()`. Terrain buffers are sized in
device pixels and re-scaled after every resize, because assigning `.width`
clears the transform as well as the buffer.

`ART_UNIT` and `withArt(n, fn)` are in `p1_core.js`. `px()` and `tpx()` divide
by it, so a redrawn painter writes device-resolution coordinates while every
unconverted painter is untouched. Nothing is converted yet — that is stage 1.

**Proof that nothing moved.** With `ART` forced to 1, all eleven contact-sheet
scenes are byte-identical to b27. At `ART = 2` the remaining differences are
3–16% of pixels and are entirely two things:

- the screen vignette, now evaluated at twice the resolution — finer banding,
  ±1 per channel, ~90% of the differing pixels;
- half-pixel stroke coordinates (`strokeRect(x+.5, …)`), which now land as
  crisp one-device-pixel borders instead of two-pixel blocks. Every panel
  outline, button border and ground ring. This is the first actual gain.

Sprite and tile content is unchanged everywhere.

### What stage 0 turned up

Three bugs in the test shim, all of which would have been blamed on the game:

- `setTransform()` ignored its arguments and reset to identity.
- `drawImage()`'s five-argument form fell through to the three-argument branch
  and drew at double size.
- Gradients were evaluated in device space instead of the user space they were
  created in, so the vignette rendered centred on the top-left quadrant at
  half size. This one cost the most: it looked exactly like a broken render
  and was worth 90% of the initial diff.

`tests/suite_shim.js` now covers all three.

The shim was also 7× too slow at device resolution — a frame went from 112ms
to 15ms after fast paths for opaque fills, 1:1 image blits, and resolving
gradient stops once per fill rather than per pixel. A 512-entry lookup table
was tried first and quantised the vignette by a colour step; it was replaced
with exact interpolation, because a permanent 10% difference against the
reference would have had to be explained away on every future comparison.

### The instrument

```
node tools/contact_sheet.js /tmp/before    # on the old build
node tools/contact_sheet.js /tmp/after     # on the new one
node tools/sheet_diff.js /tmp/before /tmp/after
```

Eleven fixed scenes, deterministic, nearest-neighbour upscaled to compare
across a resolution change. This is how every later stage gets checked.

---

## 6. Verification

The existing 18 suites assert world state and geometry, so they should survive
stage 0 untouched — that is itself the test of whether the render/world split
is clean. Add:

- A **before/after contact sheet** per stage: same seed, same camera, each
  area rendered old and new side by side. This is how "preserve the layout"
  gets checked rather than asserted.
- A **density check**: no converted painter may draw a rect smaller than 1
  authored unit, which catches half-converted art.
- A **palette audit**: count distinct colours per sprite, assert every
  converted sprite uses ≥ 6 (the thing that actually makes it read 16-bit).
- The shim's `clip()` is still a no-op and `drawImage` scaling is untested;
  both will matter more at 2×. Fix before stage 1.

---

## 7. Open questions

1. **Sub-pixel motion.** Positions are currently rounded to whole world pixels
   (`Math.round(p.x)`). At 2× we can round to half-world-pixels, which makes
   movement visibly smoother — but it is a change of feel, and the brief says
   preserve feel. Recommend: keep whole-pixel snapping, revisit at the end.
2. **The Pit.** It is painted as 9 concentric discs in one pass. At 2× it can
   carry real depth — fog layers, parallax within the shaft. Worth doing well;
   it is the game's signature image.
3. **Where to stop.** Stages 0–4 would already read as a different game.
   Stages 5–9 are polish. A decision point after stage 4 is sensible.


---

## STAGES 1–4 — DONE (b29 … b33)

| Stage | Build | What landed |
|---|---|---|
| 1 | b29, b30 | Ground patches at device density, the `FAM` rank/style/depth edge system with diagonal corners, concentric sett paving in the city |
| 2 | b31 | `drawHumanoid` at 28×48 device units with an 8-frame walk and a 4-frame idle breathe; all nine class overlays converted |
| 3 | b32 | All 68 prop arms; shared `propShadow` / `woodBody` / `ironBody` / `rivets` / `masonry` / `canopy` painters |
| 4 | b33 | All 15 creature bodies; `frame` / `idleFr` / `atkFr` clocks; `quadLegs`; `critterShadow`; a distinct wind-up pose for every hostile |

Two rules came out of these four stages and both cost a bug before they were
written down:

1. **Anything that goes through the context transform rather than through
   `px`/`tpx` must stay OUTSIDE the authored-unit block.** Gradients, `arc`
   glow pools, `ellipse`. Inside it they draw at half size in the corner of
   where they belong. This was 90% of the stage 0 diff and it came back in
   stage 3 for the lamp, hearth, seal, brazier, node, gemcluster, pylon and
   lift glows, which are now in a second switch of their own.
2. **UI overlays on world objects do not scale with the object.** The status
   pips and hp bar over a creature are UI: they are the same size over a
   sporeling and over a slagbear, so they stay in world units.

### What remains
Stages 5–9: the dragon and its 17 parts (4 of which still render nothing), the
NPC builds and wiring up `n.frame`/`n.moving`, the Pit's radial pass, ambient
particles and the lighting list, parallax, and the UI/font pass.
