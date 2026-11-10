import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import manifest from "../../resources/maps/samguk/manifest.json";
import {
  factionsOf,
  PlayModePicker,
} from "../../src/client/components/PlayModePicker";
vi.mock("../../src/client/Utils", () => ({
  translateText: (key: string) => key,
}));
afterEach(() => document.body.replaceChildren());
describe("Korean scenario faction picker", () => {
  it("starts Wa on passable Kyushu land at both supported map sizes", () => {
    const city = manifest.nations.find((n) => n.flag === "Wa")!;
    expect(city.name).toBe("Tsukushi");
    expect(city.coordinates).toEqual([1063, 2035]);
    for (const [file, width, scale] of [
      ["map.bin", 1088, 1],
      ["map4x.bin", 544, 2],
    ] as const) {
      const bytes = readFileSync(`resources/maps/samguk/${file}`);
      const tile =
        bytes[
          Math.floor(city.coordinates[1] / scale) * width +
            Math.floor(city.coordinates[0] / scale)
        ];
      expect(tile & 128).toBe(128);
      expect(tile & 31).not.toBe(31);
    }
    const source = JSON.parse(
      readFileSync("map-generator/assets/maps/samguk/info.json", "utf8"),
    );
    expect(
      source.nations.find((n: { flag: string }) => n.flag === "Wa"),
    ).toEqual(city);
  });
  it("pins each faction's first city in the original map coordinate system", () => {
    const factions = factionsOf(manifest.nations, {
      ...manifest.map,
      image: "/map.webp",
    });
    expect(factions).toHaveLength(6);
    for (const faction of factions) {
      const first = manifest.nations.find((n) => n.flag === faction.id)!;
      expect(faction.capital).toBe(first.name);
      expect(faction.location).toMatchObject({
        x: first.coordinates[0],
        y: first.coordinates[1],
        width: 1088,
        height: 2188,
      });
    }
    expect(
      factionsOf([{ flag: "test", name: "invalid", coordinates: [-1, 0] }], {
        width: 10,
        height: 10,
        image: "test",
      })[0].location,
    ).toBeUndefined();
  });
  it("renders six portraits with small emblems and preserves faction selection events", async () => {
    const picker = new PlayModePicker();
    picker.pickerSection = "factions";
    picker.factions = factionsOf(manifest.nations, {
      ...manifest.map,
      image: "/map.webp",
    });
    picker.selectedFaction = "Goguryeo";
    document.body.append(picker);
    await picker.updateComplete;
    expect(picker.querySelectorAll(".korean-ruler-portrait")).toHaveLength(6);
    expect(picker.querySelectorAll("svg image")).toHaveLength(6);
    const selected = vi.fn();
    picker.addEventListener("faction-selected", selected);
    (picker.querySelectorAll("button")[1] as HTMLButtonElement).click();
    expect(selected.mock.calls[0][0].detail).toEqual({ faction: "Baekje" });
    picker.selectedFaction = "Baekje";
    await picker.updateComplete;
    expect(picker.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
    expect(
      picker.querySelectorAll("button")[1].getAttribute("aria-pressed"),
    ).toBe("true");
  });
});
