# BLOKS Locked Scope (to avoid scope creep)

기준일: 2026-03-29

## 왜 이 문서를 추가했나
작업 중 "해야 할 게 계속 늘어나는" 체감을 막기 위해,
남은 작업을 **고정 목록**으로 잠그고 이 목록 밖 항목은 다음 라운드로 이월한다.

## 현재 고정 남은 작업 (총 8개)
1. `smoke:board` API 모드(실환경) 주기 실행 및 실패 알림 연동
2. verify 워크플로우 캐시/병렬화 최적화
3. 장애 대응 런북 문서화 (API down, Redis down)
4. board 화면 렌더링 통합 테스트(jsdom/RTL)
5. world 캔버스 데이터 매핑(snapshot) 테스트
6. API cost/queue depth 대시보드 위젯 추가
7. P95 응답시간, 실패율 지표 수집
8. 월별 실행 비용 리포트 자동 생성

## 운영 규칙
- 위 8개가 완료되기 전에는 신규 요구를 기본적으로 backlog로만 기록한다.
- 진행 보고는 항상 `Done / Remaining / Next` 3블록으로만 한다.
- Remaining 숫자는 매 턴 감소/유지 중 하나여야 하며, 증가 시 증가 사유를 명시한다.
