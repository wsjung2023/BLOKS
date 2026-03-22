# 04-01_BLOKS_permissions_and_approval_matrix_v0.1

## 문서 목적
이 문서는 BLOKS의 조직 질서, 직급 체계, 승인 규칙, 권한 범위를 **역할(Role)** 중심으로 명확히 정의하기 위한 1차 사양서다.

이 문서의 목적은 다음과 같다.

- 누가 어떤 상태를 바꿀 수 있는지 정한다.
- 누가 어떤 산출물을 승인할 수 있는지 정한다.
- 직급과 직책이 단순 장식이 아니라 실제 운영 규칙에 반영되도록 만든다.
- ERP / Workflow / Audit / Simulation 엔진이 공통으로 참조할 수 있는 기준표를 만든다.

---

## 1. 권한 설계 원칙

### 1.1 권한은 캐릭터 자체가 아니라 역할 기반으로 부여한다
권한은 기본적으로 **Role + Grade + Position + Department** 조합으로 결정한다.

즉,
- 같은 과장이라도 부서와 직책이 다르면 권한이 달라질 수 있다.
- 같은 캐릭터라도 임시 직책을 맡으면 임시 권한을 가질 수 있다.
- 개인에게만 귀속되는 특별 권한은 최소화한다.

### 1.2 승인권과 실행권은 분리한다
예:
- 실무자가 산출물을 만들 수 있어도 승인권은 없을 수 있다.
- PMO는 업무를 배정할 수 있어도 예산 승인은 못할 수 있다.
- QA는 반려권이 있어도 사업 종료 결정을 못할 수 있다.

### 1.3 Founder는 예외적 최상위 권한자다
Founder Avatar는 시스템 상 거의 모든 권한을 override 할 수 있다.  
단, Audit Log에는 반드시 override 기록이 남아야 한다.

### 1.4 Digital Twin은 기본적으로 보조 권한자다
Digital Twin은 Founder의 분신이지만, 기본 설정은 **권고/초안/제안 중심**이다.  
최종 승인권은 기본값으로 갖지 않는다.  
원하면 향후 설정에서 Founder가 일부 권한 위임 가능.

### 1.5 중요한 변경은 무조건 로그를 남긴다
다음은 반드시 로그 대상이다.
- 프로젝트 상태 변경
- 승인/반려
- 예산 한도 변경
- 우선순위 상향
- 권한 위임
- 캐릭터 활성/비활성
- 보안 정책 변경

---

## 2. 직급 체계와 기본 권한 범위

### 2.1 직급 체계
- 인턴
- 사원
- 주임
- 대리
- 과장
- 차장
- 부장
- 실장
- 이사
- 상무
- 전무
- 대표

### 2.2 직급별 기본 권한 해석

#### 인턴 / 사원
- 업무 수행 가능
- 업무 제안 가능
- 승인 불가
- 예산 변경 불가
- 타인 태스크 배정 불가

#### 주임 / 대리
- 자기 태스크 운영 가능
- 소규모 협업 요청 가능
- 하위 문서 초안 리뷰 가능
- 공식 승인권은 원칙적으로 없음

#### 과장
- 태스크 리드 가능
- 하위 실무 검토 가능
- 제한적 L1 승인 가능
- 일정 경고 발행 가능

#### 차장 / 부장
- 팀 단위 운영 가능
- L1 / 일부 L2 승인 가능
- 담당 영역 내 배정권 가능
- 재작업 지시 가능
- 제한적 우선순위 조정 가능

#### 실장 / 이사
- 본부/실 단위 자원 조정 가능
- L2 / 일부 L3 승인 가능
- 프로젝트 방향 수정 가능
- 예산 조정 요청 가능

#### 상무 / 전무
- 임원 레벨 승인
- L3 승인 가능
- 전략/예산/리스크 판단 가능
- 인력 재배치 제안 가능

#### 대표
- 최종 승인권
- 조직 정책 변경권
- 대형 예산 승인권
- 예외 override 가능

---

## 3. 직책 체계

### 3.1 직책 종류
- Head
- Lead
- Manager
- Director
- Chief
- Officer

### 3.2 직책별 운영 해석

#### Head
본부/팀 운영의 실질 책임자.  
일정, 품질, 배정, 보고선 관리 책임이 있다.

#### Lead
실무 리더.  
산출물 품질, 작업 방식, 실무 리뷰 책임이 있다.

#### Manager
상태 관리, 리소스 배분, 일정 관리, 작업 우선순위 조정 책임이 있다.

#### Director
전략/우선순위/투자/리스크 판단에 깊게 개입한다.

#### Chief / Officer
회사 전반 정책과 최고 수준 자원 배분에 개입한다.

---

## 4. 핵심 역할(Role) 정의

### 4.1 Founder Avatar
- 회사 최고 권한자
- 최종 승인권
- override 권한
- 인사/구조/정책 변경권
- 세계관 설정 및 우선순위 재정의 가능

### 4.2 Digital Twin
- 제안권
- 검토 의견권
- Founder 대리 초안 작성 가능
- 기본적으로 강제 승인권 없음
- 설정에 따라 특정 업무에 한해 대행 승인 가능

### 4.3 CEO
- 회사 전체 전략 운영 책임
- 주요 프로젝트 방향성 승인
- 임원 간 조정
- 사업 우선순위 확정

### 4.4 COO
- 프로젝트 intake / routing / 배정 통제
- 병목 해소
- 자원 재배치
- 운영 규율 유지

### 4.5 CFO / Investment Director
- 예산 관련 승인
- 투자 전략 문서 최종 검토
- 수익성/리스크 판단
- 비용 초과 경고 권한

### 4.6 CTO
- 기술 구조 승인
- 아키텍처 관련 반려권
- 엔지니어링 우선순위 조정
- 기술 리스크 escalation 권한

### 4.7 CMO
- 마케팅 전략 승인
- 브랜드 적합성 검토
- 콘텐츠 톤앤매너 최종 조정

### 4.8 PMO Lead
- 태스크 생성
- 태스크 배정 제안
- 일정 경고 발행
- 프로젝트 상태 운영
- 직접적인 최종 승인권은 제한적

### 4.9 QA Auditor
- 품질 반려권
- 검증 통과/실패 판정권
- 위험 보고 권한
- 사업 방향 승인권은 없음

### 4.10 ERP / Workflow Admin
- 워크플로우 규칙 운영
- 결재선 설정 관리
- 권한 설정 관리
- 정책 자체 변경은 불가, 반영만 가능

### 4.11 Security & Audit Operator
- 보안 경고 발행
- 접근 위반 로그 감시
- 민감 데이터 접근 승인 요청 에스컬레이션 가능
- 일반 업무 승인권은 없음

---

## 5. 승인 레벨 체계

### 5.1 승인 레벨 정의
- L0: 승인 불필요
- L1: 실무 리드 승인
- L2: 부서장/실장 승인
- L3: 임원 승인
- L4: Founder/CEO 최종 승인

### 5.2 L0
- 반복 업무
- 템플릿 기반 경미 수정
- 자동화된 내부 처리
- 저위험 콘텐츠 작업

### 5.3 L1
- 일반 태스크 결과물
- 하위 산출물
- 중간 산출물 검토
- 내부 초안 제출

### 5.4 L2
- 부서간 전달용 공식 산출물
- PRD 확정 전 단계
- 외부 공개 직전 마케팅 초안
- 투자 분석 중간 확정본

### 5.5 L3
- 핵심 사업 판단 문서
- 대형 예산 연동 작업
- 기술 아키텍처 결정
- 투자 전략 문서
- 브랜드 전략 핵심 문서

### 5.6 L4
- Founder 보고 문서
- 회사 방향 변경
- 핵심 제품 출시 승인
- 대규모 구조 개편
- 예산 한도 예외 승인

---

## 6. 산출물(Artifact) 유형별 승인 매트릭스

### 6.1 앱/웹 기획서 계열
- 아이디어 메모: L0~L1
- 요구사항 정리서: L1
- 화면 흐름도: L1~L2
- PRD 공식본: L2~L3
- 개발 착수 승인본: L3~L4

### 6.2 마케팅 계열
- 카피 초안: L1
- 캠페인 전략안: L2
- 브랜드 핵심 메시지: L3
- 대외 공개 최종본: L3~L4

### 6.3 리서치 / 투자 계열
- 시장 조사 노트: L1
- 경쟁사 분석 보고서: L2
- 투자 전략 보고서: L3
- 자본 배분 제안: L4

### 6.4 엔지니어링 계열
- 기능 티켓: L1
- 시스템 설계서: L2~L3
- 아키텍처 변경안: L3
- 배포 승인: L2~L3
- 보안 예외 승인: L4

### 6.5 운영 / 보안 계열
- 워크플로우 룰 변경 요청: L2
- 권한 정책 변경안: L3
- 감사 리포트: L2~L3
- 민감 정책 예외 처리: L4

---

## 7. 권한 매트릭스 (핵심 요약)

| 액션 | Founder | Digital Twin | CEO | COO | CFO | CTO | CMO | PMO Lead | Head/Lead | QA | ERP Admin | Security |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 프로젝트 생성 | O | O(초안) | O | O | △ | △ | △ | O | △ | X | X | X |
| 프로젝트 상태 변경 | O | △ | O | O | △ | △ | △ | O(제한) | △ | X | X | X |
| 태스크 생성 | O | O | O | O | X | O | O | O | O | X | X | X |
| 태스크 배정 | O | X | O | O | X | O | O | O | O(부서내) | X | X | X |
| 태스크 수락 | O | O | O | O | O | O | O | O | O | O | X | X |
| 승인 L1 | O | △ | O | O | X | O | O | O | O | O | X | X |
| 승인 L2 | O | X | O | O | △ | O | O | △ | O(권한 있을 때) | O(품질영역) | X | X |
| 승인 L3 | O | X | O | △ | O | O | O | X | X | △ | X | X |
| 승인 L4 | O | △(위임시) | O | X | X | X | X | X | X | X | X | X |
| 예산 승인 | O | X | O | △ | O | X | X | X | X | X | X | X |
| 우선순위 상향 | O | △ | O | O | X | △ | △ | O | △ | X | X | X |
| 반려 | O | △ | O | O | O(재무영역) | O(기술영역) | O(마케팅영역) | O(L1범위) | O | O | X | X |
| 보안 경고 발행 | O | X | O | O | X | O | X | X | X | O | X | O |
| 권한 정책 적용 | O | X | O | O | X | X | X | X | X | X | O | O(감사) |

설명:
- O = 가능
- △ = 제한적 / 조건부
- X = 불가

---

## 8. 상태 전이별 권한 규칙

### 8.1 Project 상태
- Idea → Intake: Founder, CEO, COO, PMO Lead
- Intake → Qualified: COO, CEO
- Qualified → Approved for Planning: CEO, Founder
- Approved for Planning → In Planning: COO, PMO Lead
- In Planning → In Execution: COO, 관련 본부 Head 이상
- In Execution → Review: PMO Lead, Head, COO
- Review → Approved: 승인 레벨 보유자
- Approved → Released: Founder, CEO, 해당 임원
- On Hold 전환: COO, CEO, Founder
- Cancelled 전환: CEO, Founder

### 8.2 Task 상태
- Draft → Created: PMO Lead, Head, Founder
- Created → Assigned: PMO Lead, Head, COO
- Assigned → Accepted: 담당자
- Accepted → In Progress: 담당자
- In Progress → Pending Review: 담당자, Lead
- Pending Review → Approved: 승인권자
- Pending Review → Rejected: 승인권자, QA
- Rejected → Rework: 담당자, Head
- Blocked → In Progress: 담당자, Head
- Any → Cancelled: 상위 권한자

### 8.3 Approval 상태
- Waiting L1/L2/L3/Founder 설정: 시스템 + 배정 권한자
- Approved / Rejected / Returned for Revision: 해당 승인 레벨 보유자만 가능
- Expired: 시스템 자동 전이

---

## 9. 부서별 특수 권한

### 9.1 Strategy & Planning HQ
- PRD / 기능 정의 관련 문서 생성권 강함
- 사업 아이디어 제안권 강함
- 예산 승인권은 없음
- 기술 아키텍처 최종 승인권은 없음

### 9.2 Marketing & Growth HQ
- 콘텐츠/캠페인 초안 및 실행권 강함
- 브랜드 적합성 반려권 있음
- 예산/투자 최종 승인권은 없음

### 9.3 Research & Investment HQ
- 조사/분석/예측 문서 생성권 강함
- 투자 관련 문서의 재무 검토 영향력 큼
- 제품 출시 승인권은 없음

### 9.4 Engineering & Product HQ
- 기술 설계 / 배포 / QA 관련 권한 강함
- 기술 리스크 반려권 강함
- 브랜드/투자 최종 승인권은 없음

### 9.5 Platform Operations HQ
- 권한/로그/워크플로우 유지 권한 강함
- 정책 반영 및 기술 운영 권한 있음
- 사업 실무 승인권은 약함

---

## 10. 예산 권한 기본안

### 10.1 예산 등급
- B0: 무예산 / 자동 허용
- B1: 소액
- B2: 중간
- B3: 고액
- B4: 예외 승인 필요

### 10.2 예산 승인 규칙 예시
- B0: 승인 불필요
- B1: Head 또는 PMO
- B2: 부서장 + CFO/COO
- B3: CFO + CEO
- B4: Founder 최종 승인

### 10.3 예산 초과 시 자동 이벤트
- Risk 상태 상향
- CFO 알림
- COO 재배정 검토
- 승인 대기 상태 전환 가능

---

## 11. override / 위임 규칙

### 11.1 Override
Founder는 override 가능.  
단, 아래 항목을 반드시 남긴다.
- override 대상
- 원래 승인선
- override 사유
- 영향 범위
- 후속 감사 필요 여부

### 11.2 Delegation (위임)
Founder 또는 CEO는 일부 권한을 일시적으로 위임할 수 있다.

필수 값:
- delegator
- delegatee
- scope
- start_at
- end_at
- reason
- revocable

예:
- Founder가 Digital Twin에게 L2 수준의 대행 검토권 48시간 위임

---

## 12. 금지 규칙

### 12.1 자기 승인 금지
원칙적으로 같은 캐릭터가 직접 만든 최종 산출물을 스스로 최종 승인할 수 없다.  
단, L0 자동 업무 제외.

### 12.2 보안 영역 우회 금지
Security 경고가 Critical 이상이면 Founder override 없이는 배포 금지.

### 12.3 QA 반려 무시 금지
QA가 Critical defect로 반려한 항목은 CTO 또는 Founder 승인 없이 Released 불가.

### 12.4 예산 초과 무단 진행 금지
B3 이상에서 예산 승인 없이 In Execution 장기 지속 금지.

### 12.5 inactive 캐릭터 승인 금지
Offline 상태 캐릭터는 승인권 행사 불가.

---

## 13. 감사(Audit) 포인트

반드시 감사 대상이 되는 이벤트:
- 승인선 변경
- 권한 위임
- override 수행
- 보안 예외 승인
- 예산 등급 상향
- QA 반려 무시
- Released 이후 상태 롤백

감사 로그 필수 필드:
- actor_id
- action_type
- target_entity_id
- policy_rule_id
- before_value
- after_value
- timestamp
- reason_code

---

## 14. MVP에서 꼭 필요한 권한 규칙

### 반드시 포함
- Founder 최상위 권한
- Digital Twin 제한 권한
- L1/L2/L3/L4 승인 레벨
- PMO의 생성/배정 권한
- QA 반려권
- CTO 기술 반려권
- CFO 예산 승인권
- 자기 승인 금지
- override 감사 로그

### 후순위 가능
- 시간제 권한 위임
- 프로젝트별 임시 권한
- 다중 승인자 병렬 승인
- 세부 예산 카테고리별 결재 분기

---

## 15. 구현을 위한 데이터 구조 초안

### 15.1 Role Permission
```json
{
  "role_id": "role_pmo_lead",
  "allowed_actions": [
    "project.create",
    "task.create",
    "task.assign",
    "project.transition.intake_to_planning"
  ],
  "approval_levels": ["L1"],
  "department_scope": ["strategy", "marketing", "research", "engineering"]
}
```

### 15.2 Delegation
```json
{
  "delegation_id": "dlg_001",
  "delegator_id": "founder_01",
  "delegatee_id": "twin_01",
  "scope": ["approval.L2", "project.review"],
  "start_at": "2026-03-20T09:00:00Z",
  "end_at": "2026-03-22T09:00:00Z",
  "reason": "Founder unavailable",
  "revocable": true
}
```

### 15.3 Approval Policy
```json
{
  "artifact_type": "prd_final",
  "required_levels": ["L2", "L3"],
  "extra_conditions": [
    "no_self_approval",
    "qa_clear_if_engineering_related"
  ]
}
```

---

## 16. 다음 문서 연결

다음 우선 문서는 아래 둘 중 하나가 자연스럽다.

- 06_BLOKS_information_architecture_v0.1.md
- 07_BLOKS_erp_workflow_module_spec_v0.1.md

현재 흐름상 더 먼저 추천하는 문서는:

**06_BLOKS_information_architecture_v0.1.md**

이유:
권한과 승인 체계를 정했으니,  
이제 이 구조가 어떤 화면과 정보 구조로 보이는지 정리해야  
UI / 데이터 / 오케스트레이션이 한 줄로 이어진다.
