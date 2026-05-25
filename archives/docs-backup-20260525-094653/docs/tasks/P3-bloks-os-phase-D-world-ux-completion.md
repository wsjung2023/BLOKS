---
title: P3 Phase D - World UX Completion (Weeks 15-18)
priority: MEDIUM
owner: TBD
status: DONE
---

## Objective

Complete world UX so runtime and governance are understandable for general users.

## Current Reality Status (2026-05-21)

### 완료 ✅
- Phaser 3 top-down RPG world canvas (`/world`) — 아이소메트릭 완전 교체
- Approval center UX (`/approvals`) — L0~L3 위험도 컨텍스트 완성
- Audit replay views (`/audit`) — 실행 이력 조회 및 재생
- Setup wizard — `/projects` 빈 상태 3-step 온보딩 가이드
- Stream event SSE (connected mode)

### 미완료 ⚠️

(없음 — NPC 대화 개선 포함 모든 기능 구현 완료)

### DoD 미달 항목
- 클린 머신에서 비기술 사용자 온보딩 검증 미실시

## Scope

1. Execution timeline and world synchronization
2. Approval center UX completion
3. Setup wizard and first-run user guidance
4. Replay and observability views

## Work Steps

1. Map each runtime lifecycle event to visual world signals.
2. Implement approval decision UX with risk context and clear action labels.
3. Build first-run setup wizard for local-first default mode.
4. Build execution replay views tied to audit records.
5. Add onboarding hints for first project and first task flow.

## Deliverables

1. Real-time world visualization for execution states.
2. Non-technical-user-friendly approval UX.
3. Setup wizard integrated into first launch.

## Definition of Done (DoD)

1. Runtime, approval, and audit states are visually consistent.
2. Fresh user can complete first task without docs lookup.
3. User can inspect and replay prior execution traces.

## Dependencies

1. Runtime events and audit outputs from Phase B/C
2. Existing world UI base in `apps/web/src/components/world`

## Risks And Mitigation

1. Risk: UX complexity overwhelms users.
2. Mitigation: progressive disclosure and safe defaults in setup flow.
