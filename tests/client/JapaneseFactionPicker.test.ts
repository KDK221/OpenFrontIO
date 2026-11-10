import { existsSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import manifest from "../../resources/maps/sengoku/manifest.json";
import {
  factionsOf,
  PlayModePicker,
} from "../../src/client/components/PlayModePicker";
vi.mock("../../src/client/Utils", () => ({
  translateText: (key: string) => key,
}));
afterEach(() => document.body.replaceChildren());

it("shows all 39 Japanese portraits and preserves each faction's actual starting city", async () => {
  const picker = new PlayModePicker();
  picker.pickerSection = "factions";
  picker.factions = factionsOf(manifest.nations, {
    ...manifest.map,
    image: "/japan.webp",
  });
  document.body.append(picker);
  await picker.updateComplete;
  const portraits = picker.querySelectorAll<HTMLImageElement>(
    ".korean-ruler-portrait",
  );
  expect(portraits).toHaveLength(39);
  for (const [i, portrait] of [...portraits].entries()) {
    const faction = picker.factions[i];
    expect(portrait.getAttribute("src")).toBe(
      `/images/rulers/japan/${faction.id}.webp`,
    );
    expect(existsSync(`resources/images/rulers/japan/${faction.id}.webp`)).toBe(
      true,
    );
    const marker = portrait
      .closest("button")!
      .querySelector(".korean-start-marker")!;
    expect(Number(marker.getAttribute("cx"))).toBe(faction.location!.x);
    expect(Number(marker.getAttribute("cy"))).toBe(faction.location!.y);
  }
  const selected = vi.fn();
  picker.addEventListener("faction-selected", selected);
  picker.querySelector<HTMLButtonElement>("button")!.click();
  expect(selected.mock.calls[0][0].detail).toEqual({ faction: "Oda" });
  picker.factions = [{ id: "Goguryeo", capital: "Gungnae" }];
  await picker.updateComplete;
  expect(
    picker.querySelector(".korean-ruler-portrait")!.getAttribute("src"),
  ).toBe("/images/rulers/korea/gwanggaeto.webp");
});
