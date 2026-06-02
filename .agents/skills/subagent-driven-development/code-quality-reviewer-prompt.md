# 코드 품질 리뷰어 프롬프트 템플릿

코드 품질 리뷰어 subagent를 보낼 때 이 템플릿을 사용한다.

**목적:** 구현이 잘 만들어졌는지 확인한다 (깔끔함, 테스트됨, 유지보수 가능함).

**스펙 준수 리뷰가 통과한 뒤에만 보낸다.**

<!--
아래 Task tool 블록은 코드 품질 리뷰어 subagent를 호출할 때 채워 넣는 dispatch 템플릿이다.
DESCRIPTION에는 작업 요약, PLAN_OR_REQUIREMENTS에는 계획 항목, BASE_SHA/HEAD_SHA에는 리뷰 범위가 되는 커밋을 넣어 리뷰어가 실제 diff 기준으로 품질을 검토하게 한다.
-->

```
Task tool (general-purpose):
  Use template at requesting-code-review/code-reviewer.md

  DESCRIPTION: [task summary, from implementer's report]
  PLAN_OR_REQUIREMENTS: Task N from [plan-file]
  BASE_SHA: [commit before task]
  HEAD_SHA: [current commit]
```

**표준 코드 품질 항목에 더해, 리뷰어는 다음을 확인해야 한다:**

- 각 파일이 명확한 하나의 책임과 잘 정의된 인터페이스를 가지는가?
- 각 단위가 독립적으로 이해하고 테스트할 수 있도록 분해되어 있는가?
- 구현이 계획의 파일 구조를 따르고 있는가?
- 이번 구현이 이미 큰 새 파일을 만들었거나, 기존 파일을 크게 키웠는가? (기존부터 컸던 파일 크기는 지적하지 않는다. 이번 변경이 기여한 부분에 집중한다.)

**코드 리뷰어 반환값:** 강점, 이슈 (Critical/Important/Minor), 평가
