/**
 * Trade runs draw as five white bundles spaced evenly along the whole train,
 * from the engine to its last carriage.
 */

import { describe, expect, it } from "vitest";
import {
  evenlySpaced,
  TRADE_RUN_BUNDLES,
  trainChain,
} from "../../../../src/client/render/gl/passes/UnitPass";
import { TrainType, UT_TRAIN } from "../../../../src/client/render/types";

const MAP_W = 100;
const tile = (x: number, y: number) => y * MAP_W + x;

/** A train heading east along row 5, cars `gap` tiles apart, like TrainExecution. */
function train(firstId: number, carriages: number, gap = 2) {
  const units = new Map<
    number,
    { id: number; unitType: string; trainType: number; pos: number }
  >();
  const add = (id: number, trainType: number, x: number) =>
    units.set(id, { id, unitType: UT_TRAIN, trainType, pos: tile(x, 5) });
  add(firstId, TrainType.Engine, 50);
  add(firstId + 1, TrainType.TailEngine, 50 - 4);
  for (let i = 0; i < carriages; i++) {
    add(firstId + 2 + i, TrainType.Carriage, 50 - 4 - gap * (i + 1));
  }
  return units;
}

describe("trade run bundles", () => {
  it("follows the train from the engine to its last carriage", () => {
    const units = train(10, 5);
    const chain = trainChain(units.get(10)!, units, MAP_W);
    expect(chain.length).toBe(7);
    expect(chain[0]).toEqual([50, 5]);
    expect(chain[6]).toEqual([36, 5]);
  });

  it("does not run into the next train's cars", () => {
    const units = new Map([...train(10, 5), ...train(17, 5)]);
    expect(trainChain(units.get(10)!, units, MAP_W).length).toBe(7);
  });

  it("spaces five bundles evenly along it", () => {
    const units = train(10, 5);
    const points = evenlySpaced(
      trainChain(units.get(10)!, units, MAP_W),
      TRADE_RUN_BUNDLES,
    );
    expect(points.map(([x]) => x)).toEqual([50, 46.5, 43, 39.5, 36]);
    // Evenly: 2-tile-wide bundles with 1.5 tiles of road between them.
    for (let i = 1; i < points.length; i++) {
      expect(points[i - 1][0] - points[i][0]).toBe(3.5);
    }
  });

  it("follows a bend", () => {
    const pts = evenlySpaced(
      [
        [0, 0],
        [4, 0],
        [4, 4],
      ],
      3,
    );
    expect(pts).toEqual([
      [0, 0],
      [4, 0],
      [4, 4],
    ]);
  });

  it("shows one bundle before the train has strung out", () => {
    expect(
      evenlySpaced(
        [
          [7, 7],
          [7, 7],
        ],
        5,
      ),
    ).toEqual([[7, 7]]);
  });
});
