// Scenario B — PPT 발표자료 제작 (BLOKS 시리즈A IR 덱)

const BLOKS_CONTEXT = `
[BLOKS 서비스 소개 — IR 발표 배경]
- 서비스명: BLOKS
- 슬로건: "AI가 실제로 일하는 회사를 만들어보세요"
- 핵심 기능 3가지:
  1. 가상 오피스(isometric world): AI 캐릭터들이 실시간으로 움직이며 협업
  2. AI 칸반 보드: 태스크를 캐릭터에게 배정하면 AI가 자동으로 완성
  3. 분석 대시보드: AI 비용·토큰·완료율 실시간 추적
- 타겟 사용자: 스타트업, 개발팀, AI 자동화에 관심 있는 테크 워커
- 비즈니스 모델: SaaS 구독 — Free / Pro $29/월 / Team $99/월
- 경쟁 포지셔닝: Notion(문서) + Linear(칸반) + AI Agent(자동화)를 하나로 합친 게임화된 협업 툴
- 브랜드 톤: 모던·기술적·게이미피케이션 (게임 같은 몰입감)
- 현황: 시드 완료, 시리즈 A $3M 목표로 투자 유치 진행 중
`.trim();

export const pptScenario = {
  name: "ppt",
  projectTitle: "BLOKS 시리즈 A IR 덱 제작",
  projectBrief: "BLOKS의 시리즈 A $3M 투자 유치를 위한 IR 발표자료(15장)를 시장 리서치부터 최종 제안서까지 AI 캐릭터 협업으로 제작한다.",
  projectPriority: "High",
  tasks: [
    {
      codeName: "axiom",
      title: "AI SaaS 시장·경쟁사 리서치 요약",
      taskType: "research_summary",
      priority: "High",
      description: `${BLOKS_CONTEXT}

위 BLOKS 서비스의 시리즈 A IR을 위한 시장·경쟁사 리서치 요약 보고서를 작성한다.

반드시 아래 내용을 구체적 수치와 함께 포함할 것:
1. TAM/SAM/SOM 분석 (글로벌 AI SaaS 협업툴 시장 규모, 수치 포함)
2. 주요 경쟁사 비교표: Notion AI / Linear / GitHub Copilot / ClickUp AI 각각의 강점·약점·가격·타겟 비교
3. BLOKS의 차별화 포인트 (경쟁사 대비 3가지 핵심 우위)
4. 시장 성장률 및 트렌드 (AI Agent, 게이미피케이션 협업툴 수요)
5. 투자자가 주목할 시장 기회 요약 (3줄 핵심 메시지)

보고서는 IR 발표 맥락에서 투자자를 설득하는 논거로 바로 사용할 수 있도록 작성한다.`,
    },
    {
      codeName: "lens",
      title: "AI 협업툴 시장 규모 분석",
      taskType: "market_research",
      priority: "High",
      description: `${BLOKS_CONTEXT}

BLOKS가 공략하는 AI 기반 협업툴 시장의 규모와 성장성을 분석한 리포트를 작성한다.

반드시 아래 내용을 수치 중심으로 포함할 것:
1. 글로벌 AI SaaS 시장 규모 (2024년 기준 + 2028년 예측, CAGR)
2. AI 협업툴 세부 시장 규모 및 성장률
3. 한국 시장 현황 (규모, 성장률, 주요 플레이어)
4. 기업 AI 도입률 트렌드 및 ROI 데이터
5. BLOKS 수익 시뮬레이션: MAU 1만 명 기준 연 ARR 예측 (Free 80%/Pro 15%/Team 5% 가정)
6. 투자 근거 3가지 핵심 수치 (IR 슬라이드에 바로 쓸 수 있는 형태로)

표, 수치, 예측 모델을 구체적으로 작성한다.`,
    },
    {
      codeName: "vesper",
      title: "IR 덱 슬라이드 카피 (15장 전문)",
      taskType: "marketing_copy",
      priority: "High",
      description: `${BLOKS_CONTEXT}

BLOKS 시리즈 A IR 덱 15장 전체의 슬라이드 카피를 작성한다.

반드시 아래 15장 구조에 맞춰 각 슬라이드별 헤드라인(1줄) + 본문 카피(3~5줄 또는 불릿 3~5개)를 작성할 것:
1. 표지: 서비스명, 슬로건, 날짜
2. 문제(Problem): 기존 협업툴의 한계 3가지
3. 해결책(Solution): BLOKS가 해결하는 방식
4. 제품 데모: 핵심 기능 3가지 설명
5. 작동 방식(How it works): 3단계 플로우
6. 시장 기회(Market): TAM/SAM/SOM 핵심 수치
7. 비즈니스 모델(Business Model): 구독 플랜 + 수익 구조
8. 견인력(Traction): 현재 지표 (베타 유저, NPS, 리텐션 등)
9. 경쟁 우위(Competitive Edge): 포지셔닝 맵
10. 로드맵(Roadmap): 12개월 마일스톤
11. 팀(Team): 핵심 멤버 소개
12. 재무 계획(Financials): 18개월 번레이트 + 손익분기 예측
13. 투자 사용처(Use of Funds): $3M 배분 계획
14. 비전(Vision): 3년 후 목표
15. Ask: 투자 조건 + CTA

각 슬라이드를 "### 슬라이드 N: [제목]" 형태로 구분하여 전체를 출력한다.`,
    },
    {
      codeName: "pixels",
      title: "IR 덱 슬라이드 레이아웃 가이드",
      taskType: "document",
      priority: "Medium",
      description: `${BLOKS_CONTEXT}

BLOKS IR 덱 15장의 슬라이드별 비주얼 레이아웃 가이드를 작성한다.
BLOKS 브랜드 컬러: 딥 다크(#0f0f1a) 배경, 네온 퍼플(#7c3aed) 포인트, 흰색 텍스트.

반드시 아래 내용을 포함할 것:
1. 전체 디자인 원칙 (색상 팔레트, 타이포그래피, 여백 규칙)
2. 슬라이드 템플릿 유형 4가지 정의: 표지형/텍스트-이미지형/데이터형/비교표형
3. 슬라이드 1~15 각각의 레이아웃 지정:
   - 템플릿 유형
   - 주요 시각 요소 (차트 유형, 다이어그램, 아이콘 등)
   - 배치 구조 (좌우 분할/전체 너비/카드 그리드 등)
4. 핵심 슬라이드 3장(문제/시장/Ask)의 상세 레이아웃 ASCII 다이어그램
5. 투자자 IR에서 효과적인 시각화 팁 5가지

각 슬라이드를 "### 슬라이드 N" 형태로 구분하여 상세히 작성한다.`,
    },
    {
      codeName: "hector",
      title: "BLOKS IR 최종 Executive Summary",
      taskType: "proposal_draft",
      priority: "High",
      description: `${BLOKS_CONTEXT}

BLOKS 시리즈 A 투자 유치를 위한 최종 Executive Summary 문서를 작성한다.
이 문서는 투자자가 미팅 전에 읽는 1~2페이지 분량의 핵심 요약으로, 나머지 팀원들이 작성한 시장 분석·슬라이드 카피를 종합한 최종본이다.

반드시 아래 구조로 작성할 것:
1. 헤드라인 피치 (1문장으로 BLOKS를 설명)
2. 해결하는 문제 (3줄)
3. 솔루션 & 차별화 (4~5줄)
4. 시장 기회 (TAM 수치 포함, 3줄)
5. 비즈니스 모델 (2줄)
6. 현재 트랙션 (수치 포함)
7. 팀 소개 (4줄)
8. 펀딩 Ask: $3M 시리즈 A, 사용처 요약
9. 투자자에게 전하는 핵심 메시지 (3가지 불릿)

그리고 별도로 "IR 전략 노트"를 추가한다:
- 투자자가 가장 많이 묻는 질문 Top 5 + 답변 가이드
- 발표 시 강조해야 할 3가지 포인트
- 미팅 전 준비사항 체크리스트

전체를 완성된 문서 형태로 출력한다.`,
    },
  ],
};
