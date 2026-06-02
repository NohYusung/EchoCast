import { describe, expect, it } from "vitest";
import { sampleManifest } from "@/data/sampleManifest";
import { formatDuration, getActiveSceneAtMs, getSceneProgress } from "./playerTimeline";

describe("playerTimeline", () => {
  it("selects the scene that contains the playback position", () => {
    expect(getActiveSceneAtMs(sampleManifest, 8000)?.id).toBe("scene-002");
  });

  it("clamps scene progress between 0 and 1", () => {
    const scene = sampleManifest.scenes[1];

    expect(getSceneProgress(scene, 6500)).toBe(0);
    expect(getSceneProgress(scene, 11250)).toBeCloseTo(0.5);
    expect(getSceneProgress(scene, 18000)).toBe(1);
  });

  it("formats milliseconds as mm:ss", () => {
    expect(formatDuration(90500)).toBe("01:30");
  });
});

