import fs from "node:fs";
const dir = process.argv[2] ?? "tests/perf/balance/warringstates-run-20261111";
const r = JSON.parse(fs.readFileSync(dir + "/results.json", "utf8"));
const goodSeeds = [...new Set(r.runs.map((x) => x.seed))].filter((s) =>
  ["medium", "hard"].every((d) =>
    r.runs.some(
      (x) =>
        x.seed === s && x.difficulty === d && !x.error && !x.missing.length,
    ),
  ),
);
const median = (a) => {
  a = a.toSorted((x, y) => x - y);
  return a.length
    ? (a[Math.floor((a.length - 1) / 2)] + a[Math.ceil((a.length - 1) / 2)]) / 2
    : null;
};
const summary = {
  sourceCommit: r.sourceCommit,
  mapManifestSha256: r.mapManifestSha256,
  ticks: r.ticks,
  pairedSeeds: goodSeeds,
  attempted: r.runs.length,
  excluded: r.runs
    .filter((x) => x.error || x.missing.length)
    .map((x) => ({
      seed: x.seed,
      difficulty: x.difficulty,
      missing: x.missing,
      error: x.error,
    })),
  difficulties: {},
};
for (const d of ["medium", "hard"]) {
  const runs = r.runs.filter(
    (x) => x.difficulty === d && goodSeeds.includes(x.seed),
  );
  const rows = [];
  for (const capital of runs[0]?.capitals ?? []) {
    const cs = runs.map((x) => x.capitals.find((c) => c.flag === capital.flag));
    const at = (t) => cs.map((c) => c.history.find((h) => h.tick === t));
    rows.push({
      flag: capital.flag,
      name: capital.name,
      n: runs.length,
      alive5: at(3000).filter((x) => x.alive).length,
      alive10: at(6000).filter((x) => x.alive).length,
      medianLand5: median(at(3000).map((x) => (x.alive ? x.land : 0))),
      medianLand10: median(at(6000).map((x) => (x.alive ? x.land : 0))),
      topCityCount: runs.filter((x) => x.topCities[0].name === capital.name)
        .length,
    });
  }
  summary.difficulties[d] = {
    actualDifficulties: [...new Set(runs.map((x) => x.actualDifficulty))],
    rows,
    leaders: runs.map((x) => ({ seed: x.seed, city: x.topCities[0] })),
  };
}
fs.writeFileSync(dir + "/summary.json", JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
