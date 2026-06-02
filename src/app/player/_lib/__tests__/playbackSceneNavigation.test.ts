import { describe, expect, it } from "vitest";
import {
  resolveSceneNavigateTimeMs,
  resolveTimelineSceneMarkers,
} from "@/app/player/_lib/playbackSceneNavigation";

describe("playbackSceneNavigation", () => {
  it("keeps navigation time inside a wide scene segment", () => {
    expect(
      resolveSceneNavigateTimeMs(1000, [
        { time_ms: 0, index: 0 },
        { time_ms: 2000, index: 1 },
      ]),
    ).toBe(1000);
  });

  it("snaps navigation time to a nearby scene boundary", () => {
    expect(
      resolveSceneNavigateTimeMs(1600, [
        { time_ms: 0, index: 0 },
        { time_ms: 2000, index: 1 },
      ]),
    ).toBe(2000);
  });

  it("anchors navigation to the previous marker when outside nearest tolerance", () => {
    expect(
      resolveSceneNavigateTimeMs(2800, [
        { time_ms: 0, index: 0 },
        { time_ms: 1000, index: 1 },
        { time_ms: 2000, index: 2 },
      ]),
    ).toBe(2000);
  });

  it("prefers playback runtime markers over content markers", () => {
    expect(
      resolveTimelineSceneMarkers(
        [{ time_ms: 500, index: 2, positionRatio: 20 }],
        [{ time_ms: 100, index: 1, positionRatio: 10 }],
      ),
    ).toEqual([{ time_ms: 500, index: 2, positionRatio: 20 }]);
  });
});
