# BLOKS Next Phase Backlog (Post EXECUTION_PLAN)

기준일: 2026-03-29

`docs/EXECUTION_PLAN.md`의 체크리스트(25/25)가 완료된 이후, 다음 릴리즈를 위한 후속 작업.

## A. 운영 안정화
- [ ] `smoke:board` API 모드(실환경) 주기 실행 및 실패 알림 연동
- [ ] verify 워크플로우 캐시/병렬화 최적화
- [ ] 장애 대응 런북 문서화 (API down, Redis down)

## B. 테스트 강화
- [ ] board 화면 렌더링 통합 테스트(jsdom/RTL)
- [x] approvals approve/reject 라우트 시나리오 테스트 추가
- [ ] world 캔버스 데이터 매핑(snapshot) 테스트

## C. 제품 품질
- [x] Approvals/Board/Characters 패널 액션 접근성 개선(키보드 포커스/ARIA)
- [x] 모바일 뷰 대응(최소 breakpoint 레이아웃)
- [x] 에러 메시지/토스트 공통화 (AppShell ToastContext)

## D. 데이터/비용 가시성
- [ ] API cost/queue depth 대시보드 위젯 추가
- [ ] P95 응답시간, 실패율 지표 수집
- [ ] 월별 실행 비용 리포트 자동 생성
