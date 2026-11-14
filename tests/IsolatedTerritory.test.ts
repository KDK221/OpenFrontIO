import {
  GameMapType,
  PlayerInfo,
  PlayerType,
  TerrainType,
} from "@openfront/engine-api/game/GameTypes";
import type { GameConfig } from "@openfront/engine-api/Schemas";
import { EngineConfig } from "@openfront/engine/configuration/EngineConfig";
import { ISOLATION_INTERVAL } from "@openfront/engine/game/GameImpl";
import type { Game, Player } from "@openfront/engine/game/Game";
import { setup } from "./util/Setup";
import { roundTrip } from "./util/Snapshot";

const create = () =>
  setup("plains", { gameMap: GameMapType.Samguk, instantBuild: true }, [
    new PlayerInfo("p", PlayerType.Human, null, "p"),
    new PlayerInfo("q", PlayerType.Human, null, "q"),
  ]);

function block(g: Game, owner: Player, x0: number, y0: number, size: number) {
  for (let x = x0; x < x0 + size; x++)
    for (let y = y0; y < y0 + size; y++) owner.conquer(g.ref(x, y));
}

/** Runs enough ticks for every player to get an isolation pass. */
function nextPass(g: Game) {
  for (let i = 0; i < ISOLATION_INTERVAL; i++) g.executeNextTick();
}

describe("isolated territory", () => {
  it("marks land cut off from the capital, not the capital's own piece", async () => {
    const g = await create();
    const p = g.player("p");
    block(g, p, 5, 5, 6);
    block(g, p, 30, 30, 3);
    p.setSpawnTile(g.ref(7, 7));
    nextPass(g);
    expect(g.isIsolatedTile(g.ref(7, 7))).toBe(false);
    expect(g.isIsolatedTile(g.ref(31, 31))).toBe(true);
    expect(g.isIsolatedTile(g.ref(50, 50))).toBe(false);
  });

  it("follows the capital, even to the smaller piece", async () => {
    const g = await create();
    const p = g.player("p");
    block(g, p, 5, 5, 6);
    block(g, p, 30, 30, 3);
    p.setSpawnTile(g.ref(31, 31));
    nextPass(g);
    expect(g.isIsolatedTile(g.ref(31, 31))).toBe(false);
    expect(g.isIsolatedTile(g.ref(7, 7))).toBe(true);
  });

  it("falls back to the biggest piece once the capital is lost", async () => {
    const g = await create();
    const p = g.player("p");
    const q = g.player("q");
    block(g, p, 5, 5, 6);
    block(g, p, 30, 30, 3);
    p.setSpawnTile(g.ref(31, 31));
    q.conquer(g.ref(31, 31));
    nextPass(g);
    expect(g.isIsolatedTile(g.ref(7, 7))).toBe(false);
    expect(g.isIsolatedTile(g.ref(30, 30))).toBe(true);
  });

  it("stops counting a tile once someone else takes it, and heals when rejoined", async () => {
    const g = await create();
    const p = g.player("p");
    const q = g.player("q");
    block(g, p, 5, 5, 6);
    block(g, p, 13, 5, 3);
    p.setSpawnTile(g.ref(7, 7));
    nextPass(g);
    expect(g.isIsolatedTile(g.ref(14, 6))).toBe(true);
    q.conquer(g.ref(14, 6));
    expect(g.isIsolatedTile(g.ref(14, 6))).toBe(false);
    for (let y = 5; y < 8; y++) {
      p.conquer(g.ref(11, y));
      p.conquer(g.ref(12, y));
    }
    nextPass(g);
    expect(g.isIsolatedTile(g.ref(13, 5))).toBe(false);
  });

  it("makes isolated land cheaper and faster to attack", async () => {
    const input = {
      terrain: TerrainType.Plains,
      attackTroops: 10_000,
      attacker: { type: PlayerType.Human, numTiles: 1000 },
      defender: {
        type: PlayerType.Human,
        numTiles: 1000,
        troops: 10_000,
        isTraitor: false,
        isDisconnectedTeammate: false,
      },
      defenderHasDefensePost: false,
      falloutRatio: null,
      borderSize: 50,
    };
    const config = new EngineConfig({} as GameConfig, false);
    const connected = config.attackLogic(input);
    const isolated = config.attackLogic({
      ...input,
      defenderTileIsolated: true,
    });
    const m = config.isolatedDefenseModifier();
    expect(isolated.attackerTroopLoss).toBeCloseTo(
      connected.attackerTroopLoss * m,
    );
    expect(isolated.tickFraction).toBeCloseTo(connected.tickFraction * m);
    expect(isolated.defenderTroopLoss).toBe(connected.defenderTroopLoss);
  });

  it("survives a snapshot round trip", async () => {
    const g = await create();
    const p = g.player("p");
    block(g, p, 5, 5, 6);
    block(g, p, 30, 30, 3);
    p.setSpawnTile(g.ref(7, 7));
    nextPass(g);
    g.executeNextTick();
    const { restored } = await roundTrip(g, "plains");
    expect(restored.isIsolatedTile(restored.ref(31, 31))).toBe(true);
    expect(restored.isIsolatedTile(restored.ref(7, 7))).toBe(false);
  });
});
