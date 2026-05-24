"use client";
import React from "react";

// ── Shared styles ──────────────────────────────────────────────────────────────

const s = {
  section: {
    marginBottom: "1.1rem",
  } as React.CSSProperties,
  heading: {
    fontSize: "0.68rem",
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    color: "var(--color-muted)",
    marginBottom: "0.4rem",
  },
  item: {
    display: "flex",
    gap: "0.45rem",
    marginBottom: "0.35rem",
    lineHeight: 1.5,
    fontSize: "0.78rem",
  } as React.CSSProperties,
  icon: {
    flexShrink: 0,
    width: "1.1rem",
    textAlign: "center" as const,
  },
  tip: {
    background: "rgba(255,215,0,0.07)",
    border: "1px solid rgba(255,215,0,0.18)",
    borderRadius: 6,
    padding: "0.5rem 0.65rem",
    fontSize: "0.73rem",
    lineHeight: 1.55,
    color: "var(--color-text)",
  } as React.CSSProperties,
};

function HelpItem({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={s.item}>
      <span style={s.icon}>{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function HelpSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={s.section}>
      <div style={s.heading}>{title}</div>
      {children}
    </div>
  );
}

// ── Screen Help Components ────────────────────────────────────────────────────

export function WorldHelp() {
  return (
    <>
      <HelpSection title="화면 설명">
        <HelpItem icon="🏢" text="AI 직원 68명이 실시간으로 활동하는 가상 오피스입니다." />
        <HelpItem icon="👁️" text="직원들이 책상에 앉거나, 이동하거나, 회의에 참석하는 모습을 실시간으로 볼 수 있습니다." />
      </HelpSection>
      <HelpSection title="층 이동">
        <HelpItem icon="⬆️" text="화면 좌측 상단 화살표 버튼으로 1F~8F를 전환합니다." />
        <HelpItem icon="🗺️" text="각 층에 배치된 캐릭터는 부서 코드에 따라 자동 배정됩니다." />
      </HelpSection>
      <HelpSection title="캐릭터 조작">
        <HelpItem icon="🖱️" text="캐릭터를 클릭하면 이름·상태·피로도를 확인할 수 있습니다." />
        <HelpItem icon="💬" text="말풍선이 자동으로 표시됩니다. 회의 시작 시 관련 캐릭터가 회의실로 이동합니다." />
      </HelpSection>
      <div style={s.tip}>
        💡 하단 라이브 티커에서 AI 이벤트를 실시간으로 확인하세요.
      </div>
    </>
  );
}

export function ProjectsHelp() {
  return (
    <>
      <HelpSection title="화면 설명">
        <HelpItem icon="🗂️" text="프로젝트 단위로 AI 직원에게 업무를 지시하는 메인 관리 화면입니다." />
      </HelpSection>
      <HelpSection title="기본 사용법">
        <HelpItem icon="➕" text="우측 상단 '+ 새 프로젝트' 버튼으로 프로젝트를 생성합니다." />
        <HelpItem icon="🖱️" text="프로젝트 카드를 클릭하면 오른쪽 패널에 태스크 목록이 펼쳐집니다." />
        <HelpItem icon="⚡" text="태스크 상세에서 '⚡ AI 실행' 버튼을 누르면 담당 캐릭터가 즉시 처리를 시작합니다." />
      </HelpSection>
      <HelpSection title="필터">
        <HelpItem icon="🔘" text="상단 칩(초안·진행 중·완료 등)으로 프로젝트를 상태별로 필터링합니다." />
      </HelpSection>
      <HelpSection title="우선순위 색상">
        <HelpItem icon="🔴" text="Critical — 즉시 처리 필요" />
        <HelpItem icon="🟠" text="High — 높은 중요도" />
        <HelpItem icon="🟡" text="Medium — 일반" />
        <HelpItem icon="⚪" text="Low — 낮은 중요도" />
      </HelpSection>
    </>
  );
}

export function BoardHelp() {
  return (
    <>
      <HelpSection title="화면 설명">
        <HelpItem icon="📋" text="모든 태스크를 칸반 보드로 한눈에 확인하는 화면입니다." />
      </HelpSection>
      <HelpSection title="칸반 5단계">
        <HelpItem icon="⬜" text="할 일 → 진행 중 → 검토 중 → 블록 → 완료 순서로 진행됩니다." />
        <HelpItem icon="🔴" text="블록(Blocked): 외부 의존성 또는 승인 대기 상태입니다." />
      </HelpSection>
      <HelpSection title="태스크 조작">
        <HelpItem icon="🖱️" text="카드를 클릭하면 우측 패널에서 상태 전환 버튼이 나타납니다." />
        <HelpItem icon="⚡" text="'⚡ AI 즉시 실행' 버튼으로 담당 캐릭터가 바로 처리를 시작합니다." />
        <HelpItem icon="📊" text="상단 프로젝트 필터로 특정 프로젝트 태스크만 볼 수 있습니다." />
      </HelpSection>
      <HelpSection title="실시간 업데이트">
        <HelpItem icon="🔄" text="SSE 스트림으로 AI가 태스크 상태를 변경하면 보드가 자동으로 갱신됩니다." />
      </HelpSection>
    </>
  );
}

export function CharactersHelp() {
  return (
    <>
      <HelpSection title="화면 설명">
        <HelpItem icon="👥" text="가상 회사의 AI 직원 68명 전체 목록입니다." />
      </HelpSection>
      <HelpSection title="조회">
        <HelpItem icon="🔍" text="상단 검색창으로 이름이나 코드명으로 찾을 수 있습니다." />
        <HelpItem icon="🏷️" text="부서·직급 필터로 원하는 그룹만 볼 수 있습니다." />
        <HelpItem icon="🖱️" text="카드를 클릭하면 우측 패널에 상세 정보가 표시됩니다." />
      </HelpSection>
      <HelpSection title="캐릭터 상태 표시">
        <HelpItem icon="🟢" text="활성 — 현재 업무 처리 중" />
        <HelpItem icon="🟡" text="대기 — 배정된 태스크 없음" />
        <HelpItem icon="🔴" text="번아웃 — 피로도 초과, 휴식 필요" />
      </HelpSection>
      <div style={s.tip}>
        💡 피로도(Fatigue)가 80 이상이면 캐릭터가 카페로 이동해 휴식을 취합니다.
      </div>
    </>
  );
}

export function SpriteEditorHelp() {
  return (
    <>
      <HelpSection title="화면 설명">
        <HelpItem icon="🎨" text="LPC 스프라이트 시트를 조합해 캐릭터 외형을 커스터마이징합니다." />
      </HelpSection>
      <HelpSection title="사용법">
        <HelpItem icon="🧑" text="성별·피부·머리 등 레이어별로 옵션을 선택합니다." />
        <HelpItem icon="👁️" text="우측 미리보기에서 조합 결과를 실시간으로 확인합니다." />
        <HelpItem icon="💾" text="저장하면 해당 캐릭터의 스프라이트 URL이 업데이트됩니다." />
      </HelpSection>
      <HelpSection title="레이어 우선순위">
        <HelpItem icon="📑" text="아래에서 위로: 몸 → 옷 → 머리 → 모자 → 무기 순으로 합성됩니다." />
      </HelpSection>
      <div style={s.tip}>
        💡 월드 화면에서 캐릭터가 변경된 스프라이트로 표시되려면 페이지를 새로고침하세요.
      </div>
    </>
  );
}

export function ApprovalsHelp() {
  return (
    <>
      <HelpSection title="화면 설명">
        <HelpItem icon="✅" text="AI 캐릭터가 위험한 작업을 실행하기 전 사람의 확인을 받는 결재 화면입니다." />
      </HelpSection>
      <HelpSection title="위험 등급 (L0~L3)">
        <HelpItem icon="🟢" text="L0 안전 — 읽기 전용, 자동 허용" />
        <HelpItem icon="🔵" text="L1 일반 — 제한적 쓰기, 대부분 자동" />
        <HelpItem icon="🟠" text="L2 승인 필요 — 사람이 직접 승인해야 실행됨" />
        <HelpItem icon="🔴" text="L3 위험 — 정책에 의해 차단됨" />
      </HelpSection>
      <HelpSection title="결재 처리">
        <HelpItem icon="✔️" text="'승인' 버튼: AI가 해당 작업을 즉시 실행합니다." />
        <HelpItem icon="✖️" text="'거절' 버튼: AI가 작업을 취소하고 다음 단계로 넘어갑니다." />
        <HelpItem icon="📋" text="입력값을 펼쳐서 AI가 무엇을 하려는지 확인할 수 있습니다." />
      </HelpSection>
      <div style={s.tip}>
        💡 우측 상단 알림 벨(🔔)의 숫자가 대기 중인 결재 건수입니다.
      </div>
    </>
  );
}

export function AuditHelp() {
  return (
    <>
      <HelpSection title="화면 설명">
        <HelpItem icon="🔍" text="AI 직원들의 모든 행동이 기록된 감사 로그 화면입니다." />
        <HelpItem icon="🔒" text="SHA-256 해시 체인으로 위·변조가 불가능합니다." />
      </HelpSection>
      <HelpSection title="사용법">
        <HelpItem icon="📜" text="이벤트 목록에서 각 항목을 클릭하면 상세 내용을 확인합니다." />
        <HelpItem icon="🔁" text="'트레이스 재생' 기능으로 특정 작업의 전체 실행 흐름을 다시 볼 수 있습니다." />
        <HelpItem icon="💾" text="우측 상단 내보내기 버튼으로 CSV 또는 JSONL 형식으로 다운로드합니다." />
      </HelpSection>
      <HelpSection title="킬 스위치">
        <HelpItem icon="🚨" text="비상 시 '킬 스위치' 버튼으로 모든 AI 실행을 즉시 중단합니다." />
      </HelpSection>
    </>
  );
}

export function AnalyticsHelp() {
  return (
    <>
      <HelpSection title="화면 설명">
        <HelpItem icon="📊" text="AI 직원들의 업무 현황과 시스템 상태를 한눈에 보는 대시보드입니다." />
      </HelpSection>
      <HelpSection title="주요 지표">
        <HelpItem icon="😓" text="피로도(Fatigue): 높을수록 캐릭터 성능이 저하됩니다. 80 초과 시 번아웃." />
        <HelpItem icon="📦" text="워크로드: 현재 처리 중인 태스크 수 기반 부담 지수입니다." />
        <HelpItem icon="💰" text="API 비용: 프로젝트별 누적 AI 호출 비용입니다." />
      </HelpSection>
      <HelpSection title="큐 상태">
        <HelpItem icon="⚙️" text="BullMQ 작업 큐의 대기·처리 중 건수를 실시간으로 표시합니다." />
      </HelpSection>
      <div style={s.tip}>
        💡 피로도가 높은 캐릭터에게는 잠시 태스크를 배정하지 않는 것이 좋습니다.
      </div>
    </>
  );
}

export function PromptsHelp() {
  return (
    <>
      <HelpSection title="화면 설명">
        <HelpItem icon="⚡" text="AI 캐릭터에게 전달되는 프롬프트 템플릿을 관리하는 콘솔입니다." />
      </HelpSection>
      <HelpSection title="사용법">
        <HelpItem icon="📄" text="태스크 유형별로 프롬프트 템플릿이 관리됩니다." />
        <HelpItem icon="✏️" text="템플릿을 클릭하면 내용을 직접 편집할 수 있습니다." />
        <HelpItem icon="🔘" text="'활성' 토글로 특정 템플릿을 켜거나 끌 수 있습니다." />
        <HelpItem icon="🔢" text="버전 번호로 변경 이력을 추적합니다." />
      </HelpSection>
      <HelpSection title="태스크 유형">
        <HelpItem icon="📝" text="기획 문서, PRD, 리서치, 마케팅 카피, 승인 분석, 캐릭터 액션 등" />
      </HelpSection>
      <div style={s.tip}>
        💡 템플릿을 수정하면 이후 AI 실행 시 즉시 반영됩니다.
      </div>
    </>
  );
}

export function MapEditorHelp() {
  return (
    <>
      <HelpSection title="화면 설명">
        <HelpItem icon="🗺️" text="각 층의 레이아웃(타일·오브젝트·좌석)을 직접 편집하는 도구입니다." />
      </HelpSection>
      <HelpSection title="층 선택">
        <HelpItem icon="📋" text="좌측 상단 드롭다운에서 편집할 층을 선택합니다." />
        <HelpItem icon="✨" text="'신규 층 만들기'를 선택하면 빈 캔버스로 새 층을 만듭니다." />
      </HelpSection>
      <HelpSection title="편집 도구">
        <HelpItem icon="🖌️" text="Draw: 타일을 그립니다. 팔레트에서 바닥재를 선택하세요." />
        <HelpItem icon="🪣" text="Fill: 영역 전체를 같은 타일로 채웁니다." />
        <HelpItem icon="🪑" text="Seat: 캐릭터가 앉을 수 있는 좌석을 배치합니다." />
        <HelpItem icon="📐" text="Zone: 회의실·카페 등 구역을 드래그로 지정합니다." />
      </HelpSection>
      <HelpSection title="오브젝트">
        <HelpItem icon="🪑" text="우측 팔레트에서 책상·소파 등을 캔버스로 드래그합니다." />
        <HelpItem icon="↔️" text="배치된 오브젝트를 클릭하면 이동·반전·삭제할 수 있습니다." />
      </HelpSection>
      <HelpSection title="저장">
        <HelpItem icon="💾" text="'저장' 버튼을 누르면 layout.json과 배경 이미지가 업데이트됩니다." />
      </HelpSection>
    </>
  );
}

export function DemoHelp() {
  return (
    <>
      <HelpSection title="화면 설명">
        <HelpItem icon="🎬" text="미리 준비된 데모 시나리오의 실행 결과를 확인하는 화면입니다." />
      </HelpSection>
      <HelpSection title="시나리오 종류">
        <HelpItem icon="🌐" text="홈페이지 제작 — 기획·디자인·개발·QA 6명 협업" />
        <HelpItem icon="📊" text="PPT 발표자료 — 리서치·분석·카피·디자인 5명 협업" />
        <HelpItem icon="💻" text="프로그램 개발 — 설계·백엔드·프론트·QA 6명 협업" />
      </HelpSection>
      <HelpSection title="결과 확인">
        <HelpItem icon="📄" text="각 시나리오 카드에서 AI가 생성한 산출물을 다운로드할 수 있습니다." />
        <HelpItem icon="🤖" text="단계별로 어떤 캐릭터가 어떤 작업을 수행했는지 확인합니다." />
      </HelpSection>
      <div style={s.tip}>
        💡 데모 시나리오는 터미널에서 <code>pnpm demo:run</code>으로 실행합니다.
      </div>
    </>
  );
}
