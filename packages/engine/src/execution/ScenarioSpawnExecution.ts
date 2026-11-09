import { TileRef } from "@openfront/engine-api/game/GameMap";
import {
  GameType,
  PlayerInfo,
  PlayerType,
} from "@openfront/engine-api/game/GameTypes";
import { zInt, zTiles } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game } from "../game/Game";
import {
  PlayerInfoSchema,
  playerInfoData,
  readPlayerInfo,
} from "../snapshot/CommonSchemas";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { PlayerExecution } from "./PlayerExecution";
import { getSpawnTiles } from "./Util";

/**
 * Scenario mode: places the human on every city of the faction they play.
 * The first city is the capital (the player's spawn tile). Runs once, a few
 * ticks into the spawn phase so the AI nations have claimed their cities
 * first; in singleplayer it then ends the spawn phase, as a manual spawn does.
 */
export class ScenarioSpawnExecution implements Execution {
  /** Ticks to wait before placing the player. */
  static readonly DELAY = 5;
  /** How far from a city's coordinates to look for free land. */
  static readonly SEARCH_RADIUS = 25;

  private active = true;
  private mg: Game;
  private waited = 0;

  constructor(
    private playerInfo: PlayerInfo,
    // Faction city coordinates in map tiles, capital first.
    private cities: TileRef[],
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
  }

  tick(ticks: number): void {
    if (this.waited < ScenarioSpawnExecution.DELAY) {
      this.waited++;
      return;
    }
    this.active = false;

    const player = this.mg.hasPlayer(this.playerInfo.id)
      ? this.mg.player(this.playerInfo.id)
      : this.mg.addPlayer(this.playerInfo);
    if (player.hasSpawned()) return;

    let capital: TileRef | null = null;
    for (const city of this.cities) {
      const center = this.freeLandNear(city);
      if (center === null) continue;
      for (const t of getSpawnTiles(this.mg, center, false)) {
        player.conquer(t);
      }
      capital ??= center;
    }
    if (capital === null) {
      console.warn(`ScenarioSpawn: no free land for ${this.playerInfo.name}`);
      return;
    }

    this.mg.addExecution(new PlayerExecution(player));
    player.setSpawnTile(capital);
    this.mg.stats().recordSpawnTile(player, capital);

    if (
      this.mg.config().gameConfig().gameType === GameType.Singleplayer &&
      this.playerInfo.playerType === PlayerType.Human
    ) {
      this.mg.endSpawnPhase();
    }
  }

  /** The nearest unowned, passable land tile to `tile`, ring by ring. */
  private freeLandNear(tile: TileRef): TileRef | null {
    const mg = this.mg;
    const cx = mg.x(tile);
    const cy = mg.y(tile);
    const ok = (x: number, y: number) => {
      if (!mg.isValidCoord(x, y)) return false;
      const t = mg.ref(x, y);
      return mg.isLand(t) && !mg.hasOwner(t) && !mg.isImpassable(t);
    };
    for (let r = 0; r <= ScenarioSpawnExecution.SEARCH_RADIUS; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (ok(cx + dx, cy + dy)) return mg.ref(cx + dx, cy + dy);
        }
      }
    }
    return null;
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return true;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return ScenarioSpawnExecutionSnapshot.write({
      active: this.active,
      waited: this.waited,
      playerInfo: playerInfoData(this.playerInfo),
      cities: w.tiles(this.cities),
    });
  }

  restoreSnapshot(s: ScenarioSpawnState, r: SnapshotReader): void {
    this.mg = r.game;
    this.active = s.active;
    this.waited = s.waited;
    this.playerInfo = readPlayerInfo(s.playerInfo, r);
    this.cities = Array.from(s.cities);
  }
}

const ScenarioSpawnStateSchema = z.object({
  active: z.boolean(),
  waited: zInt(),
  playerInfo: PlayerInfoSchema,
  cities: zTiles(),
});
type ScenarioSpawnState = z.infer<typeof ScenarioSpawnStateSchema>;

export const ScenarioSpawnExecutionSnapshot = execSnapshotType({
  name: "ScenarioSpawn",
  version: 1,
  schema: ScenarioSpawnStateSchema,
  cls: () => ScenarioSpawnExecution,
});
