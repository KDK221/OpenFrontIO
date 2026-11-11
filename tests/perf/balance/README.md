# Samguk balance benchmark

Run from the repository root with installed dependencies:

```sh
node --import tsx tests/perf/balance/SamgukBalance.ts balance01 easy 6000 /tmp/balance.json
```

The harness runs the actual engine and normal Samguk terrain without rendering.
It uses 33 independent Nation AI cities, 400 tribes, scenario golden lands, all
units enabled, and ends placement after eight ticks. Each run lasts 6,000 ticks
(10 simulated minutes). Stock AI spawn jitter is retained. The eight measured
cities are the first city of each flag in the manifest: the player selection
capitals. Same-flag cities are independent competitors, not a unified country.

This is an AI starting-location benchmark, not human win rates, multiplayer
balance, or complete match outcomes. A human scenario replaces one capital AI
with a human; this benchmark retains all cities as AI. Survival alone rewards
isolation, so compare it with land growth. Median land includes defeated cities
as zero. Removed players are treated as defeated only after successful initial
placement. These small samples are exploratory, not statistically conclusive.

The dated results file contains per-minute capital snapshots and aggregate
statistics. Entire runs with a missing initial capital are excluded from the
comparison and retained under exclusions. Seed balance03 failed to spawn
BalhaeFrontier on both difficulties (SpawnExecution warning); this could depend
on this harness's shortened placement phase and needs a separate UI reproduction.
No gameplay balance values were changed by this benchmark.

Geometry measures straight-line city distances and passable land within a
200-tile radius on the same connected land component. It is potential local
space before competition, not uncontested territory or travel distance.

## Sengoku benchmark

Run the same engine benchmark on the Sengoku scenario (39 selectable factions,
46 independent Nation AI cities, 400 tribes):

```sh
node tests/perf/balance/RunSengokuMediumHard.mjs
node tests/perf/balance/SummarizeSengokuMediumHard.mjs
```

The runner attempts eight paired seeds on Medium and Hard for 6,000 ticks each.
Results are written to `tests/perf/balance/sengoku-run-20261111/`. The summarizer
excludes an entire pair if either run has a missing initial capital. All general
method limitations above also apply to Sengoku; same-flag cities are independent.
The dated Sengoku report and aggregate JSON files preserve the completed run.

### Sengoku relocation comparison

The relocation keeps all 39 selectable capitals and 46 Nation AI cities. Gifu's
extra Nation moves to the fictional Ezo Eastern Outpost at `[1930, 210]`; a
positioned ordinary tribe named Gifu occupies `[1280, 1249]` within the existing
400-tribe budget. Iida retains its original Nation city. Golden lands are unchanged.

```sh
node tests/perf/balance/RunSengokuMediumHard.mjs tests/perf/balance/sengoku-relocated-one-run-20261111 working-tree
node tests/perf/balance/SummarizeSengokuMediumHard.mjs tests/perf/balance/sengoku-relocated-one-run-20261111
python3 tests/perf/balance/CompareSengokuRelocation.py
```

The runner now records a SHA-256 of the actual map manifest. Compare only seed
pairs with successful initial capital placement in both versions and difficulties.
The dated relocation comparison records that common sample. This is a tested
first placement adjustment, not a guarantee of equal human win rates.

## China: Three Kingdoms — Warlords benchmark

The internal map id remains `WarringStates`, but the current scenario is
`Three Kingdoms — Warlords` (삼국지 · 군웅할거). It has 21 selectable capitals and
41 independent Nation AI cities. The benchmark uses the same normal-size map,
400 tribes, scenario golden lands, 6,000 ticks and eight paired Medium/Hard seeds.

```sh
node tests/perf/balance/RunWarringStatesMediumHard.mjs tests/perf/balance/warringstates-run-20261111 SOURCE_COMMIT
node tests/perf/balance/SummarizeWarringStatesMediumHard.mjs
```

The dated results, summary, geometry and report are preserved alongside the
harness. Geometry counts other Nation start locations within straight-line
100/200-tile radii; it does not measure navigable paths, alliances or uncontested
land. A missing initial capital excludes both difficulties for that seed.
No China gameplay or map placement changes are made by this benchmark.
