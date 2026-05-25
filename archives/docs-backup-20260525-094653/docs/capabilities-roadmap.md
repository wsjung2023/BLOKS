# BLOKS 직원 역량 로드맵

> **목표**: 최대 50명의 AI 직원이 각 도메인에서 수준급(Genspark/전문가 수준) 결과물을 실제로 납품하는 회사

---

## 현재 위치 (2026-05-21 기준)

| 역량 | 현재 수준 | 목표 수준 | 거리 |
|------|-----------|-----------|------|
| PPT 제작 | Level 1.5 — 실제 .pptx 생성, 기본 디자인 | Level 3 — Genspark급 비주얼, 다이어그램 | 🟡 중간 |
| 프로그램 개발 | Level 2 — 실행 가능한 코드 생성 | Level 3 — PR, 테스트, CI까지 완성 | 🟡 중간 |
| 홈페이지 개발 | Level 2 — 완성 HTML 생성 | Level 3 — 실제 배포까지 | 🟡 중간 |
| 리서치 | Level 1 — 텍스트 분석, 요약 | Level 3 — 실시간 웹 검색 + 출처 인용 | 🔴 멀다 |
| 마케팅 | Level 1 — 카피라이팅 | Level 3 — 채널 실행까지 자동화 | 🔴 멀다 |
| 주가 분석 | Level 0 — 없음 | Level 3 — 실시간 데이터 + 보고서 | 🔴 없음 |
| PC 제어 | Level 0 — 없음 | Level 3 — 실제 앱 조작 자동화 | 🔴 없음 |

---

## 1. PPT 제작 역량

### 현재 (Level 1.5)
- AI가 마크다운으로 슬라이드 콘텐츠 작성 → python-pptx로 .pptx 변환
- 기본 디자인: 텍스트 + 색상 블록 (consulting/bloks 2가지 스타일)
- 자동 생성: 커버 → 섹션헤더 → 내용 → 메트릭 → 마감

### 다음 단계 (Level 2)

**구현 목록:**
- [ ] **차트 슬라이드**: python-pptx `charts` 모듈 — 막대/원형/꺾은선 차트 자동 생성
  - 데이터: AI 출력에서 숫자 테이블 파싱 → Chart 객체 삽입
  - 파일: `tools/pptx-gen/charts.py` 신규

- [ ] **이미지 슬라이드**: Unsplash API (무료) 또는 로컬 이미지 삽입
  - AI가 "적합한 이미지 키워드" 제안 → API 호출 → 슬라이드 배경/우측에 삽입
  - 파일: `tools/pptx-gen/images.py` 신규

- [ ] **표 슬라이드**: `prs.slides[n].shapes.add_table()` — 경쟁사 비교표, KPI 표 등
  - AI 출력의 마크다운 `| column | column |` 테이블 파싱 → PPTX Table 변환

- [ ] **다이어그램 슬라이드**: SmartArt 대신 도형 조합으로 플로우차트 생성
  - 기술 스택: python-pptx `add_shape` + `add_connector`
  - AI가 ASCII 다이어그램 → 파서가 도형 좌표 계산

- [ ] **다중 스타일**: 4종 (consulting, bloks, minimal, dark)

### Level 3 (Genspark급)

**추가 구현:**
- [ ] **멀티턴 정제 루프**: 생성 → AI 자체 리뷰 → 개선 → 최종 (최대 3회)
  - AI가 "슬라이드 5 메트릭 슬라이드에 차트 필요" 같은 피드백 → 자동 개선
  
- [ ] **브랜드 템플릿 시스템**: `.pptx` 마스터 슬라이드를 템플릿으로 로드
  - 실제 PowerPoint 마스터 슬라이드 사용 → 브랜드 일관성

- [ ] **AI 이미지 생성**: DALL-E 3 또는 Stable Diffusion API → 커스텀 일러스트
  - "AI 직원들이 협업하는 장면" → 생성 이미지 삽입

- [ ] **나레이터 스크립트 자동 생성**: 각 슬라이드별 발표자 노트 자동 작성

**예상 기간**: Level 2까지 2주, Level 3까지 6주

---

## 2. 프로그램 개발 역량

### 현재 (Level 2)
- AI가 Python/JS/HTML 코드를 코드블록으로 출력
- `run-scenario.mjs`가 추출해서 파일로 저장
- 실행 가능한 수준이나 프로덕션 배포는 안됨

### 다음 단계 (Level 2.5)

**구현 목록:**
- [ ] **코드 자동 실행 검증**: 생성된 Python 코드를 샌드박스(Docker)에서 실행
  - `tools/code-runner/run.sh` — Docker 컨테이너에서 실행, stdout/stderr 캡처
  - 실패 시 AI에게 에러 피드백 → 재시도 (최대 3회)

- [ ] **의존성 자동 처리**: 코드에서 `import` 파싱 → `requirements.txt` 자동 생성
  - pipreqs 또는 정규식으로 import 추출

- [ ] **GitHub 자동 PR 생성**: 완성된 코드 → 새 브랜치 → PR 오픈
  - `gh pr create` + PR 설명 AI 자동 작성

### Level 3

**추가 구현:**
- [ ] **TDD 루프**: 테스트 먼저 작성 → 구현 → 모든 테스트 통과 확인
- [ ] **코드 리뷰 → 자동 수정**: 리뷰어 AI가 지적 → 구현자 AI가 수정
- [ ] **실제 배포**: Vercel/Railway에 자동 배포 → URL 반환
- [ ] **보안 스캔**: bandit(Python), ESLint security plugin 자동 실행

---

## 3. 홈페이지 개발 역량

### 현재 (Level 2)
- AI가 완성된 HTML/CSS/JS 단일 파일 생성 (BLOKS 브랜드 컬러 포함)
- ScenarioViewer에서 iframe 미리보기

### 다음 단계 (Level 2.5)

**구현 목록:**
- [ ] **멀티파일 프로젝트 생성**: HTML + CSS + JS 분리 → ZIP 다운로드
- [ ] **반응형 검증**: Playwright로 모바일/태블릿/데스크톱 3종 스크린샷 자동 캡처
- [ ] **W3C 유효성 검사**: validator.w3.org API 호출 → 오류 피드백 → AI 수정

### Level 3

**추가 구현:**
- [ ] **Next.js 프로젝트 생성**: `create-next-app` → 컴포넌트 분리 → 실제 코드베이스
- [ ] **자동 배포**: Vercel API → 미리보기 URL 반환 → ScenarioViewer에 임베드
- [ ] **SEO 최적화**: meta 태그, sitemap.xml, robots.txt 자동 생성 + Lighthouse 검사

---

## 4. 리서치 역량

### 현재 (Level 1)
- AI 학습 데이터 기반 분석 — 실시간 정보 없음
- 수치가 부정확하거나 구식일 수 있음

### 다음 단계 (Level 2)

**구현 목록:**
- [ ] **웹 검색 통합**: `packages/ai-router/src/tools/search.ts` 신규
  - Tavily API (리서치 특화) 또는 Bing Search API
  - `TAVILY_API_KEY` 환경변수 추가
  - 도구 정의: `{ name: "web_search", description: "Search the web for current information" }`

- [ ] **출처 인용**: AI 출력에 `[출처: url]` 자동 삽입, ScenarioViewer에서 링크 렌더링

- [ ] **PDF 분석**: 업로드된 PDF를 텍스트 추출 → AI 컨텍스트로 제공
  - `pdf-parse` npm 패키지 또는 Python `pdfminer`

### Level 3

**추가 구현:**
- [ ] **딥 리서치 에이전트**: 단일 쿼리 → 20-30개 소스 검색 → 요약 → 교차 검증
  - OpenAI Assistants API `file_search` 또는 Perplexity API
  - 처리 시간 5-15분 → 진행상황 스트리밍

- [ ] **정기 리서치 자동화**: 크론으로 매일 특정 주제 리포트 자동 생성
  - `apps/worker/src/queues/research-cron.ts` 신규

---

## 5. 마케팅 역량

### 현재 (Level 1)
- 카피라이팅, IR 슬라이드 문구 생성
- 실제 채널 실행 없음

### 다음 단계 (Level 2)

**구현 목록:**
- [ ] **소셜 미디어 콘텐츠 생성**: 트위터/LinkedIn용 포스트 + 해시태그 + 이미지 텍스트
  - `taskType: "social_post"` 신규 추가
  - 결과물: 텍스트 + 이미지 프롬프트 (DALL-E로 생성)

- [ ] **이메일 시퀀스 생성**: 드립 캠페인 5-7회 이메일 자동 작성
  - `taskType: "email_sequence"` 신규

- [ ] **A/B 테스트 카피**: 같은 메시지의 3가지 변형 자동 생성 + 예상 성과 분석

### Level 3

**추가 구현:**
- [ ] **실제 발행**: Twitter API v2 + LinkedIn API → 승인 플로우 → 실제 게시
  - `apps/api/src/routes/publish.ts` 신규 — 승인 대기 → 스케줄 발행

- [ ] **성과 추적**: 발행 후 N일 뒤 engagement 자동 수집 → 분석 리포트

---

## 6. 주가 분석 역량

### 현재 (Level 0)
- 없음

### 다음 단계 (Level 2)

**구현 목록:**
- [ ] **시장 데이터 도구 통합**: `packages/ai-router/src/tools/finance.ts` 신규
  - Alpha Vantage API (무료 500콜/일) 또는 Yahoo Finance (비공식)
  - 도구: `get_stock_price`, `get_financial_statements`, `get_news`

- [ ] **분석 태스크 타입**: `taskType: "stock_analysis"` 신규
  - 입력: 종목 티커 (ex. "NVDA")
  - 출력: 가격 차트 텍스트 + 재무 요약 + AI 의견

- [ ] **리포트 생성**: PPTX 또는 PDF로 투자 분석 보고서 자동 생성

### Level 3

**추가 구현:**
- [ ] **실시간 데이터**: WebSocket으로 실시간 가격 수신 → 알림
- [ ] **포트폴리오 추적**: 다수 종목 모니터링 → 이상 감지 → 자동 리포트
- [ ] **백테스팅**: 전략 코드 생성 → 과거 데이터로 시뮬레이션 실행

**필요 환경변수**: `ALPHA_VANTAGE_API_KEY`

---

## 7. PC 제어 역량

### 현재 (Level 0)
- 없음

### 다음 단계 (Level 2)

**구현 목록:**
- [ ] **브라우저 자동화 에이전트**: Playwright MCP를 AI 도구로 연결
  - `packages/ai-router/src/tools/browser.ts` — `navigate`, `click`, `type`, `screenshot`
  - AI가 자연어로 "naver.com에서 삼성전자 뉴스 검색해서 첫 3개 요약해줘" → 실제 실행

- [ ] **스크린샷 기반 작업**: 화면 캡처 → AI에게 이미지 분석 → 다음 액션 결정
  - gpt-4o vision + Playwright screenshot 조합

- [ ] **파일 시스템 작업**: 파일 읽기/쓰기/정리 자동화
  - 샌드박스 환경에서만 허용 (보안 중요)

### Level 3

**추가 구현:**
- [ ] **PyAutoGUI 통합**: 비브라우저 앱 (Excel, Word, 데스크톱 앱) 제어
- [ ] **반복 업무 자동화**: "매일 오전 9시 이 보고서 다운로드 → 정리 → 슬랙 공유"
- [ ] **에러 복구**: 예상치 못한 팝업, 로딩 지연 자동 처리

⚠️ **보안 주의**: PC 제어는 샌드박스(Docker + 가상 디스플레이 Xvfb) 안에서만 실행

---

## 구현 우선순위 (Phase별)

### Phase 1 — 즉시 (2주)
1. **PPT Level 2**: 차트 + 표 슬라이드 추가 (`tools/pptx-gen/charts.py`)
2. **리서치 Level 2**: Tavily API 웹 검색 통합 (`packages/ai-router`)
3. **코드 실행 검증**: Docker 샌드박스 실행 + 에러 피드백 루프

### Phase 2 — 단기 (1개월)
4. **주가 분석 Level 2**: Alpha Vantage API + `stock_analysis` 태스크 타입
5. **홈페이지 Level 2.5**: 반응형 검증 + Vercel 자동 배포
6. **마케팅 Level 2**: 소셜 포스트 + 이메일 시퀀스 생성

### Phase 3 — 중기 (3개월)
7. **브라우저 자동화 (PC 제어 Level 2)**: Playwright MCP → AI 도구 연결
8. **PPT Level 3**: 멀티턴 정제 + AI 이미지 생성
9. **딥 리서치 에이전트**: 30개 소스 교차 분석

### Phase 4 — 장기 (6개월)
10. **PC 제어 Level 3**: PyAutoGUI + 반복 업무 자동화
11. **마케팅 Level 3**: 실제 채널 발행 + 성과 추적
12. **AI 직원 50명 체제**: 전문화된 역할 분담 + 지식 공유

---

## 기술 스택 추가 계획

| 기능 | 패키지/API | 위치 |
|------|-----------|------|
| 웹 검색 | Tavily API | `packages/ai-router/src/tools/search.ts` |
| 금융 데이터 | Alpha Vantage | `packages/ai-router/src/tools/finance.ts` |
| 브라우저 제어 | Playwright MCP | `packages/ai-router/src/tools/browser.ts` |
| PPT 차트 | python-pptx charts | `tools/pptx-gen/charts.py` |
| 코드 실행 | Docker sandbox | `tools/code-runner/` |
| 이미지 생성 | DALL-E 3 API | `packages/ai-router/src/tools/image.ts` |

**새 환경변수:**
```
TAVILY_API_KEY=...         # 웹 검색
ALPHA_VANTAGE_API_KEY=...  # 금융 데이터
UNSPLASH_ACCESS_KEY=...    # 스톡 이미지
```

---

## 비용 추정 (태스크당)

| 역량 | 현재 | Phase 2 목표 | Phase 3 목표 |
|------|------|-------------|-------------|
| PPT 6태스크 | ~$0.10 | ~$0.25 (이미지+차트) | ~$0.50 (AI 이미지) |
| 리서치 1태스크 | ~$0.02 | ~$0.05 (검색 포함) | ~$0.15 (딥리서치) |
| 코드 개발 1태스크 | ~$0.05 | ~$0.10 (실행검증) | ~$0.20 (TDD+배포) |
| 주가 분석 1태스크 | — | ~$0.03 (API 포함) | ~$0.08 |

월 50명 × 20태스크/월 = 1,000태스크 → 예상 월 비용 $50~200
