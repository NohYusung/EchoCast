# test-player

`test-player` is a monorepo scaffold for testing the next Dubright player direction.

## Structure

- `back/`: NestJS + TypeScript API scaffold.
- `front/`: React + Next.js player test surface.

## Principles

- Use existing Dubright code to confirm requirements and data contracts.
- Use `vogopang_back` and `vogopang_front` as implementation references.
- Do not copy the old Dubright player structure as the new implementation pattern.
- Model image and video playback together.
- Replace the legacy `spoint`-first scroll model with scene, media, and cue based playback data.

## Scripts

- `npm run dev:back`: run the NestJS API on `http://localhost:4100`.
- `npm run dev:front`: run the Next.js app on `http://localhost:3000`.
- `npm run typecheck`: typecheck all workspaces.
- `npm test`: run all workspace tests.
- `npm run build`: build all workspaces.

