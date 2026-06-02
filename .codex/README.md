# test-player Codex 설정

`test-player/.codex`는 `test-player` 작업에만 적용되는 Codex 설정과 custom agent를 관리한다.
이 문서는 에이전트 수정 위치, 역할 분리, 적용 기준을 빠르게 확인하기 위한 운영 가이드다.

## 구조

- `agents/`: custom agent TOML 파일을 둔다.
- `config.toml`: 프로젝트 로컬 Codex 설정을 둔다.
- `../.agents/skills/`: repo-local skill 검색 경로다.

## 기본 팀

- `designer`: player UX, UI 구조, 반응형 상태, 인터랙션 방향을 설계한다.
- `product-manager`: 요구사항, 범위, 우선순위, acceptance criteria를 정리한다.
- `reviewer`: 디자인, 기획, 코드 변경의 품질과 회귀 위험을 검토한다.
- `executer`: 승인된 요구사항과 리뷰 피드백을 실제 파일 변경으로 반영한다.

## 운영 원칙

- 각 에이전트는 자기 역할의 산출물을 먼저 명확히 만든다.
- `reviewer`는 실행자가 아니며, 발견한 이슈와 근거를 제시한다.
- `executer`는 승인된 기획·디자인·리뷰 피드백을 실제 작업으로 반영한다.
- 코드 변경은 `test-player/AGENTS.md`와 상위 워크스페이스 지침을 따른다.
- 기존 Dubright player 구조는 요구사항 이해용으로만 사용하고, 새 player 구조의 기본값으로 복제하지 않는다.
- 이미지와 영상 양쪽 media 흐름을 항상 함께 고려한다.
- `spoint` 대체 구조는 데이터 모델, timeline/scroll 동작, 프론트 소비 방식까지 함께 검토한다.

## 수정 기준

- 에이전트 이름을 바꿀 때는 TOML의 `name` 값을 수정한다.
- 사용자에게 보이는 역할 설명은 `description`을 수정한다.
- 호출 별칭 후보는 `nickname_candidates`에 추가한다.
- 실제 행동 규칙은 `developer_instructions`에 한국어 bullet로 작성한다.
- 에이전트가 직접 파일을 수정하면 안 되는 역할은 `Boundaries`에 명확히 적는다.
- 새 역할을 추가할 때는 `.codex/agents/{role}.toml` 파일을 만들고 이 README의 기본 팀 목록도 함께 갱신한다.

## 적용 방법

- `.codex/agents/*.toml`을 수정하면 다음 Codex 작업부터 해당 agent 정의를 기준으로 사용한다.
- 에이전트 행동이 예상과 다르면 `developer_instructions`의 `역할`, `주요 작업`, `경계` 항목을 먼저 조정한다.
- skill 기반 협업 흐름을 바꿀 때는 `.agents/skills/agent-team/SKILL.md`를 수정한다.
- 프로젝트 전체 규칙은 `AGENTS.md`를 우선 적용하고, `.codex`는 Codex agent 운영 지침만 담는다.

## 공식 경로 기준

- custom agent는 `.codex/agents/*.toml`에 둔다.
- skill은 `.agents/skills/*/SKILL.md`에 둔다.
- 팀 협업 흐름은 `.agents/skills/agent-team/SKILL.md`에서 관리한다.
