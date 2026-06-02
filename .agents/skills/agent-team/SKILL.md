---
name: agent-team
description: Use when test-player work needs designer, product-manager, reviewer, or executer role coordination.
---

# Agent Team

## Overview

test-player 작업을 역할 기반 에이전트 팀으로 나누어 진행한다.

## Team Files

- `../../../.codex/agents/designer.toml`
- `../../../.codex/agents/product-manager.toml`
- `../../../.codex/agents/reviewer.toml`
- `../../../.codex/agents/executer.toml`

## Routing

- 디자인 요청이면 `designer`를 먼저 사용한다.
- 기획 요청이면 `product-manager`를 먼저 사용한다.
- 리뷰 요청이면 `reviewer`를 사용한다.
- 코드 수정, 문서 작성, 테스트, 스캐폴드 작업이면 `executer`를 사용한다.

## Required Order

- 구현 전 요구사항이 불명확하면 `product-manager` 산출물을 만든다.
- 화면·UX 판단이 필요하면 `designer` 산출물을 만든다.
- 실행은 `executer`가 담당한다.
- 완료 전 `reviewer`가 디자인, 기획, 코드 중 해당 산출물을 검토한다.

## Default Flow

- 기획이 필요한 작업: `product-manager -> reviewer -> executer`.
- 디자인이 필요한 작업: `designer -> reviewer -> executer`.
- 코드 변경 작업: `product-manager` 또는 `designer`로 요구사항을 정리한 뒤 `executer -> reviewer`.
- 리뷰 요청: `reviewer`가 단독 수행하고, 수정이 필요하면 `executer`로 넘긴다.

## Rules

- 각 역할은 `.codex/agents/*.toml`의 자기 정의를 따른다.
- test-player 작업은 `test-player/AGENTS.md`를 항상 우선한다.
