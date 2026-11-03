/**
 * The fortress (defense post) is stronger in this fork than in OpenFront: in
 * the historical scenarios it is the main way to hold a line. Pin the tuning so
 * a change is deliberate; AttackLogicGolden / AttackScenarios hold the full
 * numeric output.
 */
import { PlayerType, TerrainType } from "@openfront/engine-api/game/GameTypes";
import { GameConfig } from "@openfront/engine-api/Schemas";
import {
  AttackLogicInput,
  EngineConfig,
} from "@openfront/engine/configuration/EngineConfig";

const config = new EngineConfig({} as GameConfig, false);

function attack(defenderHasDefensePost: boolean) {
  const input: AttackLogicInput = {
    terrain: TerrainType.Plains,
    attackTroops: 100_000,
    attacker: { type: PlayerType.Human, numTiles: 20_000 },
    defender: {
      type: PlayerType.Human,
      numTiles: 20_000,
      troops: 100_000,
      isTraitor: false,
      isDisconnectedTeammate: false,
    },
    defenderHasDefensePost,
    falloutRatio: null,
    borderSize: 100,
  };
  return config.attackLogic(input);
}

describe("fortress (defense post) tuning", () => {
  test("keeps the 30-tile range and multiplies attacker losses by 12 and tile cost by 8", () => {
    expect(config.defensePostRange()).toBe(30);
    expect(config.defensePostDefenseBonus()).toBe(12);
    expect(config.defensePostSpeedBonus()).toBe(8);
  });

  test("a covered tile costs the attacker 12x the troops and takes 8x as long", () => {
    const open = attack(false);
    const covered = attack(true);
    expect(covered.attackerTroopLoss / open.attackerTroopLoss).toBeCloseTo(12, 5);
    expect(covered.tickFraction / open.tickFraction).toBeCloseTo(8, 5);
  });
});
