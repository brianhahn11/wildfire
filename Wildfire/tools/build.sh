#!/usr/bin/env bash
#
# Wildfire — build the vertical slice.
#
# The prototype is authored as eleven ordered parts so that any one of them
# stays small enough to edit surgically. They share a single scope, so ORDER
# MATTERS: p0 defines the bitmap font that p9's HUD needs, p1 defines the
# palette and game state everything else reads, and so on. There is no module
# system on purpose — the ship artefact has to be one file you can double-click
# with no server, so the parts are simply concatenated and wrapped in a <script>.
#
# Usage:  ./tools/build.sh
# Output: build/game.js   (concatenated sources, what the test harness loads)
#         wildfire-slice.html  (the playable single-file build)

set -euo pipefail
cd "$(dirname "$0")/.."

PARTS=(
  src/p0_font.js        # bitmap glyphs + text()
  src/p1_core.js        # constants, palette, audio, global state, error capture
  src/p1b_music.js      # the chiptune tracker and the seven themes
  src/p2_classes.js     # the nine classes and six hatchlings
  src/p3_tiles.js       # tile art and the two terrain buffers
  src/p4_areas.js       # cottage / clearing / Ironhaven road
  src/p5_player.js      # movement, targeting, class gauges
  src/p6_abilities.js   # all 36 abilities + summon commands
  src/p7_actors.js      # dragon, creatures, damage model
  src/p7b_quests.js     # the five postings, materials turn-in, the collector
  src/p8_sprites.js     # actor rendering, reticle, walls
  src/p9_ui.js          # HUD, menus, dialogue, journal
  src/p10_main.js       # input map and the crash-proof loop
)

mkdir -p build
cat "${PARTS[@]}" > build/game.js

# Catch syntax errors here rather than as a blank page in the browser.
node --check build/game.js

{
  cat src/shell.html
  cat build/game.js
  printf '\n</script>\n</body>\n</html>\n'
} > wildfire-slice.html

printf 'built wildfire-slice.html (%s bytes)\n' "$(wc -c < wildfire-slice.html)"
