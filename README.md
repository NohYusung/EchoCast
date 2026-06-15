# test-player

`test-player` is a monorepo scaffold for testing the next Dubright player direction.

## Structure

- `back/`: NestJS + TypeScript API scaffold.
- `front/`: React + Next.js player test surface.
- `back/src/services/player/domain/`: fixture and playback manifest generation logic.
- `front/src/app/player/`: manifest-consuming runtime console.

## Principles

- Use existing Dubright code to confirm requirements and data contracts.
- Use `vogopang_back` and `vogopang_front` as implementation references.
- Do not copy the old Dubright player structure as the new implementation pattern.
- Model image and video playback together.
- Replace the legacy `spoint`-first scroll model with scene, media, and cue based playback data.

## Scripts

- `npm run dev:back`: run the NestJS API on `http://localhost:4100`.
- `npm run dev:front`: run the Next.js app on `http://localhost:3000`.
- `npm run desktop`: run the Electron desktop shell, which starts the NestJS API and Next.js frontend, opens an Electron window, and stops both child processes when the app exits.
- `npm run typecheck`: typecheck all workspaces.
- `npm test`: run all workspace tests.
- `npm run build`: build all workspaces.

## Desktop Shell

- Default ports are `4100` for `back` and `3000` for `front`.
- Set `TEST_PLAYER_DESKTOP_BACK_PORT` or `TEST_PLAYER_DESKTOP_FRONT_PORT` to override ports.
- Set `TEST_PLAYER_DESKTOP_PATH` to open a specific route when the local backend already has the required data, for example:
  `TEST_PLAYER_DESKTOP_PATH=/studio/products/1/episodes/1 npm run desktop`.

## Player Flow

- `GET /player/manifest/sample-player` returns the generated sample playback manifest.
- `?variant=image-only` keeps image scenes while preserving source timeline positions.
- The frontend requests the API manifest first and falls back to `front/src/data/sampleManifest.ts` when the API is unavailable.
- Set `NEXT_PUBLIC_API_BASE_URL=http://localhost:4100` for the frontend to call the local NestJS API directly.
