import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";

const serviceEntityModules = [
  {
    file: "products/domain/product.entity.ts",
    exportName: "Product",
    load: () => import("../../products/domain/product.entity"),
  },
  {
    file: "episodes/domain/episode.entity.ts",
    exportName: "Episode",
    load: () => import("../../episodes/domain/episode.entity"),
  },
  {
    file: "TTS-voices/domain/tts-voice.entity.ts",
    exportName: "TtsVoice",
    load: () => import("../../TTS-voices/domain/tts-voice.entity"),
  },
  {
    file: "medias/domain/media.entity.ts",
    exportName: "Media",
    load: () => import("../../medias/domain/media.entity"),
  },
  {
    file: "tracks/domain/track.entity.ts",
    exportName: "Track",
    load: () => import("../../tracks/domain/track.entity"),
  },
  {
    file: "scripts/domain/script.entity.ts",
    exportName: "Script",
    load: () => import("../../scripts/domain/script.entity"),
  },
  {
    file: "cues/domain/cue.entity.ts",
    exportName: "Cue",
    load: () => import("../../cues/domain/cue.entity"),
  },
  {
    file: "characters/domain/character.entity.ts",
    exportName: "Character",
    load: () => import("../../characters/domain/character.entity"),
  },
];

test("all services entity classes extend DddAggregate", async () => {
  for (const entityModule of serviceEntityModules) {
    const exports = await entityModule.load();
    const entityClass = exports[entityModule.exportName];

    assert.equal(
      typeof entityClass,
      "function",
      `${entityModule.file} must export ${entityModule.exportName}`,
    );
    assert.equal(
      exports[`${entityModule.exportName}Entity`],
      undefined,
      `${entityModule.file} must not export ${entityModule.exportName}Entity`,
    );
    assert.equal(
      inheritsDddAggregate(entityClass),
      true,
      `${entityModule.exportName} must extend DddAggregate`,
    );
  }
});

function inheritsDddAggregate(entityClass: Function): boolean {
  let currentPrototype = Object.getPrototypeOf(entityClass.prototype);

  while (currentPrototype) {
    if (currentPrototype.constructor?.name === "DddAggregate") {
      return true;
    }
    currentPrototype = Object.getPrototypeOf(currentPrototype);
  }

  return false;
}
