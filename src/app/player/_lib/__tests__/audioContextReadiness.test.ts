import { describe, expect, it } from "vitest";
import { waitForAudioContextRunning } from "@/app/player/_lib/audioContextReadiness";

describe("audioContextReadiness", () => {
  it("returns true immediately when the context is already running", async () => {
    const result = await waitForAudioContextRunning({
      getState: () => "running",
      resume: async () => undefined,
      totalTimeoutMs: 5,
      resumeTimeoutMs: 1,
      pollIntervalMs: 1,
    });

    expect(result).toEqual({ ok: true, state: "running" });
  });

  it("times out when resume never settles", async () => {
    const result = await waitForAudioContextRunning({
      getState: () => "suspended",
      resume: () => new Promise<void>(() => undefined),
      totalTimeoutMs: 5,
      resumeTimeoutMs: 1,
      pollIntervalMs: 1,
    });

    expect(result).toEqual({ ok: false, state: "suspended" });
  });
});
