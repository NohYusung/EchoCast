---
title: test-player player API case matrix
updated: 2026-06-04
---

# Player API Case Matrix

| API | Case | Expected | Status |
|-----|------|----------|--------|
| `GET /player/manifest/:episodeId` | existing `sample-player` | returns manifest with `durationMs`, `tracks`, `items`, `cues`, `media`, `records`, `tts` | covered |
| `GET /player/manifest/:episodeId` | unknown episode id | returns `404` with Nest default error body | pending |
| `GET /episodes/:episodeId/player-draft` | existing `sample-player` | returns independent draft source | covered |
| `PUT /episodes/:episodeId/player-draft` | valid draft | stores draft and returns updated manifest | covered |
| `PUT /episodes/:episodeId/player-draft` | invalid timeline item | returns validation error | pending |
| `POST /products` | minimal valid payload | creates in-memory product | covered |
| `POST /products/:productId/episodes` | valid product id and episode payload | creates in-memory episode | covered |
| auth/permission | any request | not_applicable because this plan explicitly excludes auth, permission, and operating workflow | not_applicable |
