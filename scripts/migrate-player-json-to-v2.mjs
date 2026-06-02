import {
  existsSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const PLAYER_JSON_DIR = new URL("../public/json/player/", import.meta.url);
const LOCAL_JSON_DIR = new URL("../src/app/player/localJson/", import.meta.url);
const PLAYBACK_V2_SOURCE = new URL("../src/lib/playbackV2/index.ts", import.meta.url);

async function loadPlaybackV2Compiler() {
  const source = readFileSync(PLAYBACK_V2_SOURCE, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      verbatimModuleSyntax: false,
    },
  }).outputText;
  const compiledModuleUrl = new URL(
    `../.tmp-playback-v2-compiler-${Date.now()}.mjs`,
    import.meta.url,
  );
  writeFileSync(compiledModuleUrl, transpiled);
  try {
    return await import(compiledModuleUrl.href);
  } finally {
    unlinkSync(compiledModuleUrl);
  }
}

function parseLegacyContent(payload) {
  const episode = payload?.data?.episode;
  const content = episode?.content;
  if (!content) return null;
  return typeof content === "string" ? JSON.parse(content) : content;
}

function isPlaybackEnvelope(payload) {
  return (
    typeof payload?.schemaVersion === "string" &&
    payload.schemaVersion.startsWith("playback-v2")
  );
}

function readMigrationSourcePayload(fileName, currentPayload) {
  if (!isPlaybackEnvelope(currentPayload)) return currentPayload;

  const localSourcePath = join(LOCAL_JSON_DIR.pathname, fileName);
  if (!existsSync(localSourcePath)) return currentPayload;
  return JSON.parse(readFileSync(localSourcePath, "utf8"));
}

function migrateFile(fileName, migrateLegacyContentToPlaybackV2) {
  if (fileName === "index.json" || !fileName.endsWith(".json")) return "skip";

  const filePath = join(PLAYER_JSON_DIR.pathname, fileName);
  const payload = JSON.parse(readFileSync(filePath, "utf8"));
  const sourcePayload = readMigrationSourcePayload(fileName, payload);
  const content = parseLegacyContent(sourcePayload);
  if (!content) {
    return isPlaybackEnvelope(payload) ? "already-v2" : "no-legacy-content";
  }

  const playerKey = String(payload.playerKey ?? fileName.replace(/\.json$/, ""));
  const episode = sourcePayload?.data?.episode ?? {};
  const envelope = migrateLegacyContentToPlaybackV2({
    playerKey,
    title: String(episode.title ?? payload.title ?? playerKey),
    legacyContent: content,
  });
  const withEpisodeMeta = {
    ...envelope,
    episode: {
      no: episode.no ?? null,
      product_no: episode.product_no ?? null,
      index: episode.index ?? null,
      subtitle: episode.subtitle ?? "",
    },
  };

  writeFileSync(filePath, `${JSON.stringify(withEpisodeMeta, null, 2)}\n`);
  return "migrated";
}

const { migrateLegacyContentToPlaybackV2 } = await loadPlaybackV2Compiler();
const results = {};
for (const fileName of readdirSync(PLAYER_JSON_DIR)) {
  const status = migrateFile(fileName, migrateLegacyContentToPlaybackV2);
  results[status] = (results[status] ?? 0) + 1;
  console.log(`${status}: ${fileName}`);
}
console.log("summary", results);
