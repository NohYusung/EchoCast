# test-player 작업 범위

## 기본 목표

- `test-player`는 Dubright player 기능을 분리해 테스트하기 위한 기본 스캐폴드 레포다.
- 이번 범위는 전체 제품 구현이 아니라 player 관련 핵심 흐름을 실험할 수 있는 최소 골격을 만드는 것이다.
- Dubright에서 player 실행에 필요한 데이터 생성 로직과 실제 player 실행 로직만 떼어내어 검증한다.

## 필수 로직

- `player 생성 로직`
  - Dubright 원본 데이터 또는 테스트 fixture를 받아 player가 소비할 수 있는 manifest 형태로 변환한다.
  - 기존 `spoint` 중심 구조를 그대로 복제하지 않고 scene, media, cue, timeline 기반의 새 구조를 실험한다.
  - 이미지와 영상을 모두 표현할 수 있는 데이터 구조를 기본 전제로 둔다.

- `player 실행 로직`
  - 생성된 manifest를 읽어 프론트 player 화면에서 재생 흐름을 실행한다.
  - scene 전환, timeline 위치, cue 상태, image/video media 표시를 분리해서 검증할 수 있어야 한다.
  - 실제 서비스 기능 전체가 아니라 테스트 가능한 player runtime 골격을 우선한다.

## 스캐폴드 기준

- `back/`은 player manifest 생성과 제공을 위한 NestJS + TypeScript 기본 구조를 둔다.
- `front/`는 player manifest를 소비하고 실행 흐름을 확인하는 React + Next.js 기본 구조를 둔다.
- back과 front는 모노레포 안에 함께 두되, 책임과 경계를 명확히 분리한다.
- 테스트 fixture, sample manifest, 최소 API, 최소 player 화면까지만 포함한다.

## 범위 제한

- 완성형 제작툴이나 운영 서비스 기능은 만들지 않는다.
- Dubright 레거시 player 코드를 그대로 이식하지 않는다.
- 인증, 결제, 권한, 실제 운영 DB 연동, 배포 설정은 기본 스캐폴드 범위에 포함하지 않는다.
- 이후 확장은 `AGENTS.md`와 `.codex/.agents` 에이전트 팀 구조에 따라 기획, 디자인, 리뷰, 실행 단계를 나눠 진행한다.
