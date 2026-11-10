import {
  GameMapType,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { AttackExecution } from "@openfront/engine/execution/AttackExecution";
import { setup } from "./util/Setup";
import { roundTrip } from "./util/Snapshot";
import type { Game } from "@openfront/engine/game/Game";
const advance = (g: Game, n: number) => {
  for (let i = 0; i < n; i++) g.executeNextTick();
};
const create = () =>
  setup("plains", { gameMap: GameMapType.Samguk, instantBuild: true }, [
    new PlayerInfo("p", PlayerType.Human, null, "p"),
  ]);
function ignite(g: Game) {
  for (let x = 25; x < 35; x++)
    for (let y = 25; y < 35; y++) g.setFallout(g.ref(x, y), true);
}

describe("slow fire spread", () => {
  it("waits for ignition age, spreads only one tile per wave and destroys reached buildings", async () => {
    const g = await create();
    ignite(g);
    const player = g.player("p");
    const buildings = [];
    for (let y = 24; y <= 35; y++)
      for (let x = 24; x <= 35; x++) {
        if (x !== 24 && x !== 35 && y !== 24 && y !== 35) continue;
        const t = g.ref(x, y);
        player.conquer(t);
        buildings.push(player.buildUnit(UnitType.City, t, {}));
      }
    advance(g, 160);
    expect(g.numTilesWithFallout()).toBe(100);
    advance(g, 1);
    expect(g.numTilesWithFallout()).toBeGreaterThan(100);
    expect(g.hasFallout(g.ref(23, 28))).toBe(false);
    const hit = buildings.filter((b) => g.hasFallout(b.tile()));
    expect(hit.length).toBeGreaterThan(0);
    for (const b of hit)
      expect(g.units().some((u) => u.id() === b.id())).toBe(false);
  });
  it("cannot burn water and stops spreading when all fire is reclaimed", async () => {
    const g = await create();
    ignite(g);
    const water = g.ref(24, 28);
    g.setWater(water);
    advance(g, 800);
    expect(g.hasFallout(water)).toBe(false);
    const player = g.player("p");
    for (let y = 0; y < g.height(); y++)
      for (let x = 0; x < g.width(); x++) {
        const t = g.ref(x, y);
        if (g.hasFallout(t)) player.conquer(t);
      }
    expect(g.numTilesWithFallout()).toBe(0);
    advance(g, 400);
    expect(g.numTilesWithFallout()).toBe(0);
  });
  it("keeps troop-consuming attacks as the extinguishing action", async () => {
    const g = await create();
    const p = g.player("p");
    p.conquer(g.ref(10, 10));
    p.addTroops(10000);
    for (let y = 9; y <= 11; y++)
      for (let x = 9; x <= 11; x++)
        if (x !== 10 || y !== 10) g.setFallout(g.ref(x, y), true);
    const before = p.troops();
    g.addExecution(new AttackExecution(1000, p, null));
    advance(g, 30);
    expect(p.troops()).toBeLessThan(before);
    expect(g.numTilesWithFallout()).toBeLessThan(8);
  });
  it("preserves ignition ages and deterministic spread across snapshot restore", async () => {
    const g = await create();
    ignite(g);
    advance(g, 100);
    const { restored } = await roundTrip(g, "plains");
    advance(g, 701);
    advance(restored, 701);
    for (let y = 20; y < 40; y++)
      for (let x = 20; x < 40; x++)
        expect(restored.hasFallout(restored.ref(x, y))).toBe(
          g.hasFallout(g.ref(x, y)),
        );
    expect(restored.numTilesWithFallout()).toBe(g.numTilesWithFallout());
  });
  it("allows explicit clearing instead of ignoring false", async () => {
    const g = await create();
    const t = g.ref(5, 5);
    g.setFallout(t, true);
    g.setFallout(t, false);
    expect(g.hasFallout(t)).toBe(false);
  });
});
