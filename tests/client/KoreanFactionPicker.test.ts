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
