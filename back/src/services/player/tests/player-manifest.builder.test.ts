import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertNoForbiddenLegacyFields,
  buildPlayerManifest,
} from "../domain/player-manifest.builder";
import { createPlayerDraftFixture } from "./player-draft.fixture";

test("buildPlayerManifest returns one contract with duration, tracks, items, cues, media, records, and tts", () => {
  const manifest = buildPlayerManifest(createPlayerDraftFixture());

  assert.equal(manifest.episodeId, "sample-player");
  assert.equal(manifest.durationMs, 12000);
  assert.equal(manifest.tracks.length, 2);
  assert.equal(manifest.items.length, 3);
  assert.equal(manifest.cues.length, 2);
  assert.equal(manifest.media.length, 1);
  assert.equal(manifest.records.length, 1);
  assert.equal(manifest.tts.length, 1);

  const approvedCue = manifest.cues.find((cue) => cue.id === "cue-5001");
  assert.equal(approvedCue?.approvedRecordUrl, "/audio/record-5001-approved.wav");
  assert.equal(approvedCue?.ttsUrl, "/audio/tts-5001.wav");

  const fallbackCue = manifest.cues.find((cue) => cue.id === "cue-5002");
  assert.equal(fallbackCue?.approvedRecordUrl, undefined);
  assert.equal(fallbackCue?.ttsUrl, undefined);

  assertNoForbiddenLegacyFields(manifest);
});

test("buildPlayerManifest rejects timeline items that end before their start time", () => {
  const draft = createPlayerDraftFixture();
  draft.timelineItems[0] = {
    ...draft.timelineItems[0],
    startTime: 3000,
    endTime: 2500,
  };

  assert.throws(
    () => buildPlayerManifest(draft),
    /timeline item visual-strip-1 must end after it starts/,
  );
});

test("buildPlayerManifest rejects cue placements that reference missing cues", () => {
  const draft = createPlayerDraftFixture();
  draft.timelineItems.push({
    id: "orphan-cue-item",
    trackId: "track-dialogue",
    kind: "cue",
    startTime: 13000,
    endTime: 14000,
    cueId: "missing-cue",
    layerId: 1,
  });

  assert.throws(
    () => buildPlayerManifest(draft),
    /timeline item orphan-cue-item references missing cue missing-cue/,
  );
});
