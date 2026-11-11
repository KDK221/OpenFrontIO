import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const dir = path.resolve("tests/perf/balance/sengoku-run-20261111");
fs.mkdirSync(dir, { recursive: true });
const runs = [];
async function worker(difficulty) {
  for (let i = 1; i <= 8; i++) {
    const seed = "balance" + String(i).padStart(2, "0"),
      out = path.join(dir, seed + "-" + difficulty + ".json");
    const start = Date.now();
    console.log("START", seed, difficulty);
    const log = fs.openSync(out + ".log", "w");
    const code = await new Promise((resolve) => {
      const child = spawn(
        process.execPath,
        [
          "--import",
          "tsx",
          "tests/perf/balance/SengokuBalance.ts",
          seed,
          difficulty,
          "6000",
          out,
        ],
        { stdio: ["ignore", log, log] },
      );
      child.on("exit", resolve);
      child.on("error", (e) => {
        console.error(e);
        resolve(-1);
      });
    });
    fs.closeSync(log);
    if (code !== 0) {
      console.log(
        "FAILED",
        seed,
        difficulty,
        code,
        fs.readFileSync(out + ".log", "utf8").slice(-1500),
      );
      runs.push({ seed, difficulty, error: code });
      continue;
    }
    const r = JSON.parse(fs.readFileSync(out, "utf8"));
    const missing = Object.entries(r.capitalNames)
      .filter(
        ([flag, name]) =>
          !r.snapshots[0].players.some(
            (p) => p.name === name && p.flag === flag && p.spawned,
          ),
      )
      .map(([flag]) => flag);
    const capitals = Object.entries(r.capitalNames).map(([flag, name]) => ({
      flag,
      name,
      history: r.snapshots.map((s) => {
        const p = s.players.find((p) => p.name === name && p.flag === flag);
        return {
          tick: s.tick,
          alive: p?.alive ?? false,
          land: p?.land ?? 0,
          troops: p?.troops ?? 0,
        };
      }),
    }));
    const last = r.snapshots
      .at(-1)
      .players.filter((p) => p.spawned)
      .sort((a, b) => b.land - a.land);
    runs.push({
      seed,
      difficulty,
      actualDifficulty: r.config.difficulty,
      missing,
      wallSeconds: r.wallSeconds,
      capitals,
      topCities: last
        .slice(0, 5)
        .map((p) => ({ name: p.name, flag: p.flag, land: p.land })),
    });
    fs.writeFileSync(
      path.join(dir, "results.json"),
      JSON.stringify(
        {
          sourceCommit: "5cfd8a39950a2a2160ffdeec61228f766b2b6f5f",
          ticks: 6000,
          bots: 400,
          runs,
        },
        null,
        2,
      ),
    );
    console.log(
      "DONE",
      seed,
      difficulty,
      "seconds",
      Math.round((Date.now() - start) / 1000),
      "missing",
      missing.join(","),
      "top",
      last[0]?.name,
    );
  }
}
await Promise.all([worker("medium"), worker("hard")]);
console.log("ALL_DONE");
