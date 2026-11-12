import { TileRef } from "@openfront/engine-api/game/GameMap";
import { MessageType, UnitType } from "@openfront/engine-api/game/GameTypes";
import { renderTroops } from "@openfront/engine-lib/Format";
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
  /**
   * Fraction of troops lost per drain step. Troop growth fights the drain, so
   * the target settles well above (1 - DRAIN)^steps: at 4% a second a large
   * player ends about 40% down, where 1% only managed about 12% and read as
   * "nothing happened".
   */
  static readonly DRAIN = 0.04;
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
  /** Troops each infected player has lost so far, for the closing report. */
  private lost = new Map<Player, number>();

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
        const before = p.troops();
        p.removeTroops(before * PlagueExecution.DRAIN);
        this.lost.set(p, (this.lost.get(p) ?? 0) + (before - p.troops()));
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
      this.mg.displayMessage(
        "events_display.plague_failed", MessageType.ATTACK_FAILED, this.player.id(),
      );
      this.active = false;
      return;
    }
    // Validate first, then charge the current price before incrementing launches.
    this.player.removeGold(this.mg.unitInfo(UnitType.MIRV).cost(this.mg, this.player));
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
    this.mg.displayMessage(
      "events_display.plague_released",
      MessageType.MIRV_INBOUND,
      this.player.id(),
      undefined,
      { name: target.displayName(), seconds: PlagueExecution.DURATION * this.mg.config().msPerTick() / 1000 },
      undefined,
      target.id(),
    );

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
    // Report what it did: to the one who released it, per victim, and to
    // each victim, so the plague's effect is visible, not just its start.
    for (const [victim, lost] of this.lost) {
      if (lost < 1) continue;
      const troops = renderTroops(lost);
      this.mg.displayMessage(
        "events_display.plague_ended",
        MessageType.NUKE_DETONATED,
        this.player.id(),
        undefined,
        { name: victim.displayName(), troops },
        undefined,
        victim.id(),
      );
      this.mg.displayMessage(
        "events_display.plague_ended_victim",
        MessageType.UNIT_DESTROYED,
        victim.id(),
        undefined,
        { troops },
      );
    }
  }

  /** Troops the plague has taken from `p` so far. */
  public troopsLost(p: Player): number {
    return this.lost.get(p) ?? 0;
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
      lost: [...this.lost].map(([p, n]) => [w.player(p), Math.round(n)]),
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
    this.lost = new Map((s.lost ?? []).map(([p, n]) => [r.player(p), n]));
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
  // Added after version 1 shipped; saves from before it have none.
  lost: z.array(z.tuple([zPlayerRef(), zInt()])).optional(),
});
type PlagueState = z.infer<typeof PlagueStateSchema>;

export const PlagueExecutionSnapshot = execSnapshotType({
  name: "Plague",
  version: 1,
  schema: PlagueStateSchema,
  cls: () => PlagueExecution,
});
