import { describe, expect, it } from "vitest";
import {
  getLocalPlayerJsonPath,
  normalizePlayerKey,
  parsePlayerIndex,
} from "@/lib/localPlayerContent";

describe("localPlayerContent", () => {
  it("normalizes player keys to safe file names", () => {
    expect(normalizePlayerKey(" samguk-yusa-ep1 ")).toBe("samguk-yusa-ep1");
    expect(normalizePlayerKey("../secret")).toBeNull();
    expect(normalizePlayerKey("bad/key")).toBeNull();
    expect(normalizePlayerKey("bad key")).toBeNull();
  });

  it("builds a public JSON URL for a safe player key", () => {
    expect(getLocalPlayerJsonPath("three-kingdoms-ep0")).toBe(
      "/json/player/three-kingdoms-ep0.json",
    );
  });

  it("parses a minimal player index and drops invalid items", () => {
    const index = parsePlayerIndex({
      players: [
        { playerKey: "iliad-main-ep1", title: "Iliad", subtitle: "1화" },
        { playerKey: "../bad", title: "Bad" },
        { title: "Missing key" },
      ],
    });

    expect(index).toEqual([
      {
        playerKey: "iliad-main-ep1",
        title: "Iliad",
        subtitle: "1화",
      },
    ]);
  });
});
