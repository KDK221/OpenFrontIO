import { TileRef } from "@openfront/engine-api/game/GameMap";
import { MessageType, UnitType } from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import {
  zInt,
  zPlayerRef,
  zRandom,
  zTile,
} from "@openfront/engine-lib/snapshot/SnapshotType";
import { simpleHash } from "@openfront/engine-lib/Util";
import { z } from "zod";
import { Execution, Game, Player } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";

/**
 * Plague: the era's replacement for the MIRV. A disease is released on the
 * player owning the target tile. It drains troops (never land) and may spread
 * to players that share a border with an infected player.
 *
 * Launched from a ready Siege Camp, like the other strategic attacks.
 */
export class PlagueExecution implements Execution {
  /** Ticks the plague lasts. */
  static readonly DURATION = 900;
  /** Troops are drained every STEP ticks. */
  static readonly STEP = 10;
  /** Fraction of troops lost per drain step. */
  static readonly DRAIN = 0.01;
  /** Ticks between spread attempts. */
  static readonly SPREAD_INTERVAL = 50;
  /** Percent chance per attempt that a bordering player catches it. */
  static readonly SPREAD_CHANCE = 35;

  private active = true;
  private mg: Game;
  private random: PseudoRandom;
  private started = false;
  private age = 0;
  private infected: Player[] = [];

  constructor(
    private player: Player,
    private dst: TileRef,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    this.random = new PseudoRandom(mg.ticks() + simpleHash(this.player.id()));
  }

  /** Players currently suffering from the plague. */
  public infectedPlayers(): readonly Player[] {
    return this.infected;
  }

  tick(ticks: number): void {
    if (!this.started) {
      this.start();
      return;
    }
    this.age++;
    if (this.age > PlagueExecution.DURATION) {
      this.finish();
      return;
    }

    this.infected = this.infected.filter((p) => p.isAlive());
    if (this.infected.length === 0) {
      this.finish();
      return;
    }

    if (this.age % PlagueExecution.STEP === 0) {
      for (const p of this.infected) {
        p.removeTroops(p.troops() * PlagueExecution.DRAIN);
      }
    }
    if (this.age % PlagueExecution.SPREAD_INTERVAL === 0) {
      this.spread();
    }
  }

  private start(): void {
    const spawn = this.player.canBuild(UnitType.MIRV, this.dst);
    const target = this.mg.owner(this.dst);
    if (spawn === false || !target.isPlayer()) {
      console.warn("cannot spread plague");
      this.active = false;
      return;
    }
    this.started = true;
    this.infected = [target];
    // Counts toward the price of the next plague (see EngineConfig).
    this.mg.recordMirvLaunch();
    this.mg.stats().bombLaunch(this.player, target, UnitType.MIRV);

    // Betrayal on release, same as the strike it replaces.
    const alliance = this.player.allianceWith(target);
    if (alliance !== null) {
      this.player.breakAlliance(alliance);
    }
    if (target !== this.player) {
      target.updateRelation(this.player, -100);
      this.player.updateRelation(target, -100);
    }
    this.notify(target);

    const silo = this.player
      .units(UnitType.MissileSilo)
      .find((s) => s.tile() === spawn);
    if (silo) {
      silo.launch();
    }
  }

  private spread(): void {
    const newlyInfected: Player[] = [];
    for (const carrier of this.infected) {
      for (const other of this.mg.players()) {
        if (
          other === carrier ||
          !other.isAlive() ||
          this.infected.includes(other) ||
          newlyInfected.includes(other) ||
          // The one who released it keeps its own people healthy, as do its
          // teammates.
          other === this.player ||
          this.player.isOnSameTeam(other) ||
          !carrier.sharesBorderWith(other)
        ) {
          continue;
        }
        if (this.random.nextInt(0, 100) < PlagueExecution.SPREAD_CHANCE) {
          newlyInfected.push(other);
          this.notify(other);
        }
      }
    }
    this.infected.push(...newlyInfected);
  }

  private notify(target: Player): void {
    this.mg.displayMessage(
      "events_display.mirv_inbound",
      MessageType.MIRV_INBOUND,
      target.id(),
      undefined,
      { name: this.player.displayName() },
      undefined,
      this.player.id(),
    );
  }

  private finish(): void {
    this.active = false;
    const first = this.mg.owner(this.dst);
    this.mg.stats().bombLand(this.player, first, UnitType.MIRV);
  }

  owner(): Player {
    return this.player;
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return PlagueExecutionSnapshot.write({
      active: this.active,
      player: w.player(this.player),
      dst: this.dst,
      // mg and random are both set by init.
      random: this.mg === undefined ? null : w.random(this.random),
      started: this.started,
      age: this.age,
      infected: this.infected.map((p) => w.player(p)),
    });
  }

  restoreSnapshot(s: PlagueState, r: SnapshotReader): void {
    this.active = s.active;
    this.player = r.player(s.player);
    this.dst = s.dst;
    if (s.random !== null) {
      this.mg = r.game;
      this.random = r.random(s.random);
    }
    this.started = s.started;
    this.age = s.age;
    this.infected = s.infected.map((p) => r.player(p));
  }
}

const PlagueStateSchema = z.object({
  active: z.boolean(),
  player: zPlayerRef(),
  dst: zTile(),
  random: zRandom().nullable(),
  started: z.boolean(),
  age: zInt(),
  infected: z.array(zPlayerRef()),
});
type PlagueState = z.infer<typeof PlagueStateSchema>;

export const PlagueExecutionSnapshot = execSnapshotType({
  name: "Plague",
  version: 1,
  schema: PlagueStateSchema,
  cls: () => PlagueExecution,
});
