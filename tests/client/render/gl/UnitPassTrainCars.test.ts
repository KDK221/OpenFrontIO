/**
 * Trade runs draw as three evenly spaced white bundles: the lead engine and
 * the 1st and 4th carriages (0, 6 and 12 tiles back). The tail engine and the
 * other carriages are not drawn.
 */

import { describe, expect, it } from "vitest";
import { isShownTrainCar } from "../../../../src/client/render/gl/passes/UnitPass";
import { TrainType, UT_TRAIN } from "../../../../src/client/render/types";

function train(firstId: number, carriages: number) {
  const units = new Map<number, { id: number; unitType: string; trainType: number }>();
  const add = (id: number, trainType: number) =>
    units.set(id, { id, unitType: UT_TRAIN, trainType });
  // TrainExecution.createTrainUnits order: engine, tail, then carriages.
  add(firstId, TrainType.Engine);
  add(firstId + 1, TrainType.TailEngine);
  for (let i = 0; i < carriages; i++) add(firstId + 2 + i, TrainType.Carriage);
  return units;
}

describe("isShownTrainCar", () => {
  it("shows the engine and the 1st and 4th carriages only", () => {
    const units = train(10, 5);
    const shown = [...units.values()]
      .filter((u) => isShownTrainCar(u, units))
      .map((u) => u.id);
    // 10 engine, 11 tail, 12-16 carriages.
    expect(shown).toEqual([10, 12, 15]);
  });

  it("keeps showing three per train with several trains", () => {
    const units = new Map([...train(10, 5), ...train(40, 5)]);
    const shown = [...units.values()].filter((u) => isShownTrainCar(u, units));
    expect(shown.length).toBe(6);
  });

  it("hides carriages it can't place once the tail is gone", () => {
    const units = train(10, 5);
    units.delete(11);
    expect(isShownTrainCar(units.get(12)!, units)).toBe(false);
    expect(isShownTrainCar(units.get(15)!, units)).toBe(false);
  });
});
