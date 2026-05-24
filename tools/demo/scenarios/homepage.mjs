// Scenario A — 홈페이지 제작
//
// [BLOKS 브랜드 컨텍스트]
// BLOKS는 AI 캐릭터들이 실제 업무(기획·개발·QA·전략)를 수행하는 가상 회사 시뮬레이션 플랫폼.
// 슬로건: "AI가 실제로 일하는 회사를 만들어보세요"
// 핵심 기능: ① 가상 오피스(isometric world) — 캐릭터들이 실시간으로 움직이며 협업
//            ② 칸반 보드 — 태스크를 AI 캐릭터에게 배정하면 자동으로 완성
//            ③ 분석 대시보드 — AI 비용·토큰·완료율 실시간 추적
// 타겟: 스타트업·개발팀·AI에 관심 있는 테크 워커
// 톤: 모던·기술적·게이미피케이션 요소 포함 (게임 같은 UI)
// 메인 색상: 딥 다크(#0f0f1a) 배경 + 네온 퍼플(#7c3aed) 포인트

const BLOKS_CONTEXT = `
[BLOKS 서비스 소개]
- 서비스명: BLOKS
- 슬로건: "AI가 실제로 일하는 회사를 만들어보세요"
- 핵심 기능 3가지:
  1. 가상 오피스(isometric world): AI 캐릭터들이 실시간으로 움직이며 협업
  2. AI 칸반 보드: 태스크를 캐릭터에게 배정하면 AI가 자동으로 완성
  3. 분석 대시보드: AI 비용·토큰·완료율 실시간 추적
- 타겟 사용자: 스타트업, 개발팀, AI 자동화에 관심 있는 테크 워커
- 브랜드 톤: 모던·기술적·게이미피케이션 (게임 같은 몰입감)
- 색상 팔레트: 딥 다크(#0f0f1a) 배경, 네온 퍼플(#7c3aed) 포인트, 흰색 텍스트
`.trim();

export const homepageScenario = {
  name: "homepage",
  projectTitle: "BLOKS 공식 홈페이지 제작",
  projectBrief: "AI 캐릭터 협업으로 BLOKS 공식 홈페이지를 기획·디자인·개발·QA까지 완성한다.",
  projectPriority: "High",
  tasks: [
    { codeName: "sprint", title: "홈페이지 PRD 작성", taskType: "prd_draft", priority: "High",
      description: `${BLOKS_CONTEXT}\n\n위 서비스의 공식 홈페이지 PRD를 작성한다. 목적, 타겟 사용자, 핵심 기능(히어로·기능소개·가격·CTA 섹션), 성공 지표(전환율·이탈률·가입 수)를 포함한다.` },
    { codeName: "nabi", title: "UX 기획 및 와이어프레임", taskType: "planningDocument", priority: "High",
      description: `${BLOKS_CONTEXT}\n\n위 서비스의 홈페이지 UX를 설계한다. 방문자 여정(랜딩→기능이해→가입)을 중심으로 섹션별 콘텐츠 배치와 내비게이션 구조를 텍스트 와이어프레임으로 정의한다.` },
    { codeName: "pixels", title: "디자인 콘셉트 문서", taskType: "document", priority: "Medium",
      description: `${BLOKS_CONTEXT}\n\n위 브랜드에 맞는 홈페이지 비주얼 아이덴티티를 정의한다. 딥 다크 배경에 네온 퍼플 포인트를 활용한 컬러 팔레트, 타이포그래피(헤더/본문 폰트), 버튼·카드·아이콘 스타일 가이드를 작성한다.` },
    { codeName: "glitch", title: "홈페이지 HTML/CSS 구현", taskType: "web_development", priority: "High",
      description: `${BLOKS_CONTEXT}\n\n위 서비스의 공식 홈페이지를 완성된 단일 HTML 파일(인라인 CSS 포함)로 구현한다. 반드시 아래 섹션을 모두 포함한다:\n1. 헤더(로고+내비게이션)\n2. 히어로(슬로건+CTA 버튼)\n3. 핵심 기능 3가지 소개 카드\n4. 작동 방식(3단계 설명)\n5. 가격 플랜(Free/Pro/Team)\n6. 푸터\n\n딥 다크(#0f0f1a) 배경, 네온 퍼플(#7c3aed) 포인트, 실제로 브라우저에서 열 수 있는 완성된 코드를 출력한다. 코드블록으로 전체 HTML을 출력할 것.` },
    { codeName: "debug", title: "QA 체크리스트 작성", taskType: "document", priority: "Medium",
      description: `${BLOKS_CONTEXT}\n\n위 서비스 홈페이지의 QA 체크리스트를 작성한다. 크로스 브라우저(Chrome/Safari/Firefox), 모바일 반응형, 접근성(WCAG 2.1), CTA 버튼 동작, 페이지 로드 속도 항목을 포함한다.` },
    { codeName: "arch", title: "기술 아키텍처 리뷰 메모", taskType: "strategy_memo", priority: "Medium",
      description: `${BLOKS_CONTEXT}\n\n위 서비스 홈페이지의 배포 아키텍처를 검토한다. Vercel/Netlify 정적 배포, CDN 전략, SEO 최적화(메타태그·OG), 성능(Core Web Vitals) 기준을 제안하는 기술 메모를 작성한다.` },
  ],
};
