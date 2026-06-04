import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPlaybackEvents } from "../buildPlaybackEvents";
import { sampleManifest } from "../sampleManifest";

test("buildPlaybackEvents schedules approved records before tts fallback for the same cue", () => {
  const events = buildPlaybackEvents(sampleManifest);
  const approvedRecordEvent = events.find(
    (event) => event.sourceId === "record-5001-approved",
  );
  const ttsEvent = events.find((event) => event.sourceId === "tts-5001");

  assert.equal(approvedRecordEvent?.kind, "record");
  assert.equal(ttsEvent, undefined);
});

test("buildPlaybackEvents schedules tts fallback when a cue has no approved record", () => {
  const events = buildPlaybackEvents(sampleManifest);
  const fallbackEvent = events.find((event) => event.sourceId === "tts-5002");

  assert.equal(fallbackEvent?.kind, "tts");
  assert.equal(fallbackEvent?.startTime, 2600);
});

test("buildPlaybackEvents returns events in timeline order", () => {
  const events = buildPlaybackEvents(sampleManifest);
  const times = events.map((event) => event.startTime);

  assert.deepEqual(times, [...times].sort((a, b) => a - b));
});
