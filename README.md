# test-player

- `vogopang_front`의 player 로직을 로컬 JSON으로 검증하기 위한 테스트 앱입니다.
- 백엔드에서 받던 player payload는 `public/json/player/*.json`에 둡니다.
- 실제 이미지/오디오 리소스는 JSON의 경로와 `.env.local`의 media base URL을 통해 가져옵니다.

## Commands

- `npm run dev`
- `npm run test`
- `npm run typecheck`
- `npm run build`
