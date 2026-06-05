import assert from "node:assert/strict";
import { test } from "node:test";
import { DddRepository } from "../../../libs/ddd";

const serviceRepositoryModules = [
  {
    file: "products/repository/product.repository.ts",
    load: () => import("../../products/repository/product.repository"),
  },
  {
    file: "episodes/repository/episode.repository.ts",
    load: () => import("../../episodes/repository/episode.repository"),
  },
  {
    file: "TTS-voices/repository/tts-voice.repository.ts",
    load: () => import("../../TTS-voices/repository/tts-voice.repository"),
  },
  {
    file: "medias/repository/media.repository.ts",
    load: () => import("../../medias/repository/media.repository"),
  },
  {
    file: "tracks/repository/track.repository.ts",
    load: () => import("../../tracks/repository/track.repository"),
  },
  {
    file: "scripts/repository/script.repository.ts",
    load: () => import("../../scripts/repository/script.repository"),
  },
  {
    file: "cues/repository/cue.repository.ts",
    load: () => import("../../cues/repository/cue.repository"),
  },
  {
    file: "characters/repository/characater.repository.ts",
    load: () => import("../../characters/repository/characater.repository"),
  },
];

test("all services repository classes extend DddRepository", async () => {
  for (const repositoryModule of serviceRepositoryModules) {
    const exports = await repositoryModule.load();
    const repositoryExports = Object.entries(exports).filter(
      ([name, value]) =>
        name.endsWith("Repository") && typeof value === "function",
    );

    assert.equal(
      repositoryExports.length,
      1,
      `${repositoryModule.file} must export one Repository class`,
    );

    for (const [repositoryName, repositoryClass] of repositoryExports) {
      assert.equal(
        repositoryClass.prototype instanceof DddRepository,
        true,
        `${repositoryName} must extend DddRepository`,
      );
      assert.equal(
        typeof repositoryClass.prototype.find,
        "function",
        `${repositoryName} must expose find()`,
      );
      assert.equal(
        typeof repositoryClass.prototype.count,
        "function",
        `${repositoryName} must expose count()`,
      );
    }
  }
});
