# new-dubright

`new-dubright` is a monorepo scaffold for testing the next Dubright player direction.

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
- `npm run desktop:dir`: build the frontend and create an unpacked Electron app for local packaging checks.
- `npm run desktop:dmg`: build the frontend and create a local macOS DMG in `dist/desktop/`.
- `npm run typecheck`: typecheck all workspaces.
- `npm test`: run all workspace tests.
- `npm run build`: build all workspaces.

## Desktop Shell

- Default ports are `4100` for `back` and `3000` for `front`.
- Set `NEW_DUBRIGHT_DESKTOP_BACK_PORT` or `NEW_DUBRIGHT_DESKTOP_FRONT_PORT` to override ports.
- Set `NEW_DUBRIGHT_DESKTOP_PATH` to open a specific route when the local backend already has the required data, for example:
  `NEW_DUBRIGHT_DESKTOP_PATH=/studio/products/1/episodes/1 npm run desktop`.
- Packaged DMG builds include the Next.js standalone frontend and do not start the NestJS backend.
- Set `NEXT_PUBLIC_API_BASE_URL` before `npm run desktop:dmg` when the packaged frontend should call a remote backend.

## Player Flow

- `GET /player/manifest/sample-player` returns the generated sample playback manifest.
- `?variant=image-only` keeps image scenes while preserving source timeline positions.
- The frontend requests the API manifest first and falls back to `front/src/data/sampleManifest.ts` when the API is unavailable.
- Set `NEXT_PUBLIC_API_BASE_URL=http://localhost:4100` for the frontend to call the local NestJS API directly.

## Backend Dev Deploy

- `.github/workflows/ci-cd.yml` builds and pushes `back/Dockerfile` to ECR on `main` pushes when backend or common files change.
- Default target: ECR `new-dubright-back-dev`, ECS cluster `dev-ecs`, service `new-dubright-back-task-dev-service`, region `ap-northeast-2`.
- Required GitHub auth: set either repository variable `AWS_ROLE_TO_ASSUME` for OIDC or repository secrets `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.
- Override defaults with repository variables when needed: `AWS_REGION`, `BACKEND_ECR_REPOSITORY`, `BACKEND_ECS_CLUSTER`, `BACKEND_ECS_SERVICE`, `BACKEND_SECRET_ARN`, `BACKEND_LOG_GROUP`, `BACKEND_TASK_ROLE_ARN`, `BACKEND_EXECUTION_ROLE_ARN`.
- Set repository variable `BACKEND_DEPLOY_ENABLED=false` to disable backend deploy while keeping CI active.
