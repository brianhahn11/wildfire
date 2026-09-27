#!/usr/bin/env bash
#
# Wildfire — run every regression suite against the current build.
#
# There is no browser in this environment, so tests/shim.js is a hand-rolled
# Canvas2D implementation that renders to a PNG, and tests/strict.js layers on
# the argument validation a real browser performs (negative arc radii, non-finite
# coordinates, read-only AudioParams). The strict layer exists because a silent
# `bp.Q = 0.9` assignment once took the whole game down, and nothing but a real
# browser would have caught it.
#
# Usage: ./tools/test.sh [suite ...]   (default: all)

set -uo pipefail
cd "$(dirname "$0")/.."

./tools/build.sh >/dev/null

if [ "$#" -gt 0 ]; then
  SUITES=("$@")
else
  SUITES=(
    tests/suite_shim.js               # the render shim's own transform handling
    tests/suite_artscale.js           # the world/device split the art migration rests on
    tests/suite_full.js               # 9 classes, passivity, quest, transitions, soak
    tests/suite_journeys.js           # door round trips, full journey per class
    tests/suite_crash.js              # error panel and recovery
    tests/suite_reticle.js            # acquisition, range gating, facing snap
    tests/suite_killzone.js           # toggle, target steering, piercing, savant
    tests/suite_reaver.js             # tempo finishers
    tests/suite_tempo.js              # tempo only credits on a connecting hit
    tests/suite_tempo_alternation.js  # blade/gun alternation and whiffs
    tests/suite_eidolon.js            # summon special commands
    tests/suite_music.js              # the chiptune tracker and the seven themes
    tests/suite_title.js              # key art + the Reaver's silhouette
    tests/suite_cogway.js             # the ring city: geometry, citizens, palette
    tests/suite_wilds.js              # outer zones, hostile AI, the codex
    tests/suite_aethite.js            # the store, burning, and the locks it opens
    tests/suite_gear.js               # items, dragon parts, money, the tab strip
    tests/suite_phantom.js            # the puddle dodge: reach, geometry, i-frames
    tests/suite_dragonaim.js          # the hatchling aims from where it is, not where you are
    tests/suite_quests.js             # the five postings, gathering, the collector
    tests/suite_glimmervein.js        # elements, the imps, the pylons that pour them
    tests/suite_twoplayer.js          # the player cursor, tether, revive, key maps
  )
fi

fail=0
for s in "${SUITES[@]}"; do
  printf '\n=== %s ===\n' "$s"
  node "$s" || { fail=1; printf '!!! FAILED: %s\n' "$s"; }
done

[ "$fail" -eq 0 ] && echo -e "\nall suites passed" || echo -e "\nSUITE FAILURES"
exit "$fail"
