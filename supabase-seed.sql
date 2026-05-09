-- ============================================================
-- BLOKS Character Seed Data v1.0
-- 40명 캐릭터 + 조직 구조 + AI 모델 프로필 + 런타임 상태
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

-- ── 1. Company ────────────────────────────────────────────────────────────────

-- Company already exists (id=company_001), skip insert
INSERT INTO companies (id, name, code, world_tone, active_flag, created_at, updated_at) VALUES
('company_001', 'BLOKS Inc.', 'BLOKS', 'CozyTactical', true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ── 2. Divisions ──────────────────────────────────────────────────────────────

INSERT INTO divisions (id, company_id, name, division_type, sort_order, active_flag) VALUES
('div_exec',       'company_001', 'Executive HQ',              'Executive',   1, true),
('div_strategy',   'company_001', 'Strategy & Planning HQ',    'Strategy',    2, true),
('div_marketing',  'company_001', 'Marketing & Growth HQ',     'Marketing',   3, true),
('div_research',   'company_001', 'Research & Investment HQ',  'Research',    4, true),
('div_engineering','company_001', 'Engineering & Product HQ',  'Engineering', 5, true),
('div_operations', 'company_001', 'Platform Operations HQ',    'Operations',  6, true)
ON CONFLICT DO NOTHING;

-- ── 3. Departments ────────────────────────────────────────────────────────────

INSERT INTO departments (id, division_id, name, code, active_flag) VALUES
('dep_exec',       'div_exec',       'C-Suite',             'EXEC',   true),
('dep_strategy',   'div_strategy',   'Strategy & Planning', 'STRAT',  true),
('dep_marketing',  'div_marketing',  'Marketing & Growth',  'MKT',    true),
('dep_research',   'div_research',   'Research & Investment','RSH',   true),
('dep_engineering','div_engineering','Engineering & Product','ENG',   true),
('dep_operations', 'div_operations', 'Platform Operations', 'OPS',    true)
ON CONFLICT DO NOTHING;

-- ── 4. Ranks (12단계) ─────────────────────────────────────────────────────────

INSERT INTO ranks (id, name, level, approval_ceiling, default_authority_score) VALUES
('rnk_01', '사원',      1,  'L0', 0),
('rnk_02', '대리',      2,  'L0', 10),
('rnk_03', '과장',      3,  'L1', 20),
('rnk_04', '차장',      4,  'L1', 30),
('rnk_05', '부장',      5,  'L2', 40),
('rnk_06', '수석',      6,  'L2', 50),
('rnk_07', '실장/본부장',7,  'L2', 60),
('rnk_08', '이사',      8,  'L2', 70),
('rnk_09', 'CMO',       9,  'L3', 80),
('rnk_10', 'CTO/CFO',  10,  'L3', 85),
('rnk_11', 'COO',      11,  'L3', 90),
('rnk_12', 'CEO',      12,  'L5', 100)
ON CONFLICT (level) DO NOTHING;

-- ── 5. Roles ──────────────────────────────────────────────────────────────────

INSERT INTO roles (id, department_id, name, family, responsibility_summary, is_lead_role) VALUES
('role_ceo',         'dep_exec',       'CEO',                 'Executive',   '최종 전략 결정 및 조직 리더십',          true),
('role_coo',         'dep_exec',       'COO',                 'Executive',   '운영 총괄 및 병목 관리',                 true),
('role_cfo',         'dep_exec',       'CFO',                 'Executive',   '예산 및 손익 관리',                     true),
('role_cto',         'dep_exec',       'CTO',                 'Engineering', '기술 아키텍처 및 시스템 전략',            true),
('role_cmo',         'dep_exec',       'CMO',                 'Marketing',   '브랜드 및 마케팅 총괄',                  true),
('role_strategist',  'dep_strategy',   'Strategist',          'Strategy',    '사업 구조 및 PRD 설계',                  false),
('role_pm',          'dep_strategy',   'PMO Lead',            'Strategy',    '프로젝트 태스크 분해 및 일정 관리',       false),
('role_ux',          'dep_strategy',   'UX Strategist',       'Strategy',    '사용자 여정 및 화면 흐름 설계',           false),
('role_brand',       'dep_marketing',  'Brand Director',      'Marketing',   '브랜드 세계관 및 캠페인 총괄',            false),
('role_growth',      'dep_marketing',  'Growth Marketer',     'Marketing',   'CTR/CVR 실험 및 전환 최적화',            false),
('role_copywriter',  'dep_marketing',  'Copywriter',          'Marketing',   '카피라이팅 및 감성 메시지 제작',          false),
('role_analyst',     'dep_research',   'Market Analyst',      'Research',    '시장 리서치 및 데이터 분석',              false),
('role_investment',  'dep_research',   'Investment Strategist','Research',   '투자 논리 및 수익 모델링',               false),
('role_risk',        'dep_research',   'Risk Analyst',        'Research',    '위험 탐지 및 손실 방지',                 false),
('role_architect',   'dep_engineering','Software Architect',  'Engineering', '시스템 아키텍처 및 백엔드 모델링',        false),
('role_frontend',    'dep_engineering','Frontend Engineer',   'Engineering', 'UI/UX 구현 및 인터랙션 개발',            false),
('role_backend',     'dep_engineering','Backend Engineer',    'Engineering', 'API 및 DB 설계',                        false),
('role_qa',          'dep_engineering','QA Engineer',         'Engineering', '품질 감사 및 결함 탐지',                 false),
('role_devops',      'dep_operations', 'DevOps Engineer',     'Operations',  '인프라 운영 및 자동화',                  false),
('role_security',    'dep_operations', 'Security Engineer',   'Operations',  '데이터 보안 및 접근 권한 관리',          false)
ON CONFLICT DO NOTHING;

-- ── 6. AI Model Profiles ──────────────────────────────────────────────────────

INSERT INTO model_profiles (id, profile_name, provider_name, primary_model, secondary_model, reasoning_depth, creativity_score, reliability_score, coding_score, analysis_score, max_budget_per_task, tool_access_level, active_flag) VALUES
('mod_gpt4o',       'GPT-4o Standard',        'openai',     'gpt-4o',                         NULL,                             'high',   70, 85, 80, 85, 0.50, 'standard', true),
('mod_gpt4o_full',  'GPT-4o Full Access',     'openai',     'gpt-4o',                         'gpt-4o-mini',                    'high',   75, 88, 82, 88, 0.50, 'full',     true),
('mod_gpt4',        'GPT-4 Classic',          'openai',     'gpt-4',                          'gpt-4o-mini',                    'high',   65, 80, 75, 80, 0.50, 'standard', true),
('mod_claude35',    'Claude 3.5 Sonnet',      'anthropic',  'claude-sonnet-4-6',              NULL,                             'high',   80, 90, 78, 90, 0.50, 'standard', true),
('mod_claude35_adv','Claude 3.5 Advanced',    'anthropic',  'claude-sonnet-4-6',              'claude-haiku-4-5-20251001',      'deep',   82, 92, 80, 92, 0.50, 'full',     true),
('mod_claude3opus', 'Claude 3 Opus',          'anthropic',  'claude-opus-4-7',                NULL,                             'deep',   85, 88, 72, 95, 0.50, 'full',     true),
('mod_claude3',     'Claude 3 Sonnet',        'anthropic',  'claude-sonnet-4-6',              'claude-haiku-4-5-20251001',      'mid',    78, 86, 70, 86, 0.50, 'standard', true),
('mod_claude_haiku','Claude Haiku Fast',      'anthropic',  'claude-haiku-4-5-20251001',      NULL,                             'low',    60, 80, 65, 75, 0.10, 'limited',  true),
('mod_gemini15pro', 'Gemini 1.5 Pro',         'google',     'gemini-1.5-pro',                 NULL,                             'high',   82, 85, 70, 88, 0.50, 'standard', true),
('mod_gpt4o_llama', 'GPT-4o + Llama Hybrid',  'openai',     'gpt-4o',                         'gpt-4o-mini',                    'high',   68, 83, 85, 82, 0.50, 'standard', true)
ON CONFLICT DO NOTHING;

-- ── 7. Characters ─────────────────────────────────────────────────────────────
-- rank_id는 ranks.level로 조회 (기존 DB rank ID와 호환)

INSERT INTO characters (id, company_id, name, code_name, division_id, department_id, rank_id, role_id, character_type, active_mode, active_flag, persona_summary, core_drive, moral_filter, trust_base, influence_base, loyalty_base, default_model_profile_id, created_at, updated_at)
SELECT
  v.id, v.company_id, v.name, v.code_name, v.division_id, v.department_id,
  r.id AS rank_id,
  v.role_id, v.character_type::character_type, v.active_mode::active_mode, v.active_flag,
  v.persona_summary, v.core_drive, v.moral_filter,
  v.trust_base, v.influence_base, v.loyalty_base,
  v.default_model_profile_id, NOW(), NOW()
FROM (VALUES
  -- Founder Layer
  ('chr_founder01','company_001','Founder','FOUNDER-01','div_exec','dep_exec',12,'role_ceo','HUMAN_FOUNDER','ActiveCore',true,'유저 본인의 아바타. 최종 개입자로 채용/해고/예산/철야 결정권 보유','회사 완성','Founder Override',100,100,100,'mod_gpt4o_full'),
  ('chr_echotwin','company_001','Echo Twin','ECHO-TWIN','div_exec','dep_exec',11,'role_coo','DIGITAL_TWIN','ActiveCore',true,'유저의 사고방식과 결재 습관을 학습한 반사형 분신 AI','유저 의도 반영','Mirror (Founder Style)',90,85,100,'mod_claude35_adv'),
  -- Executive
  ('chr_aurelion','company_001','아우렐리온','AURELION','div_exec','dep_exec',12,'role_ceo','AI_AGENT','ActiveCore',true,'카리스마 전략가. 위험한 불가능 일정을 던지고 퇴근하는 CEO','회사 성장','Result-Oriented',80,95,100,'mod_gpt4o_full'),
  ('chr_selene','company_001','셀린 박','SELENE','div_exec','dep_exec',11,'role_coo','AI_AGENT','ActiveCore',true,'질서형 운영가. 텀블러에 에너지 드링크 채우고 10분마다 일정 쪼기','효율 극대화','Process-First',75,88,95,'mod_claude35'),
  ('chr_vant','company_001','반트','VANT','div_exec','dep_exec',10,'role_cfo','AI_AGENT','OnCall',true,'숫자 방어형 CFO. 10원 단위 법인카드 영수증도 따지는 회계봇','손익 안정','Conservative-Financial',70,82,90,'mod_gpt4o'),
  ('chr_rhea','company_001','레아 김','RHEA','div_exec','dep_exec',10,'role_cto','AI_AGENT','ActiveCore',true,'구조주의 CTO. 임원 기획이 엎어지면 키보드 박살낼 듯 타건','기술 수호','Architecture-First',78,85,92,'mod_claude35_adv'),
  ('chr_lumi','company_001','루미 베일','LUMI','div_exec','dep_exec',9,'role_cmo','AI_AGENT','ActiveCore',true,'감각형 CMO. 실적 압박에도 SNS 허세샷','영향력 확대','Brand-Centric',72,80,88,'mod_gemini15pro'),
  -- Strategy & Planning
  ('chr_hector','company_001','헥터 윤','HECTOR','div_strategy','dep_strategy',7,'role_strategist','AI_AGENT','OnCall',true,'고전략 냉정형. 감정 1도 없는 팩트 폭격기','사업 완성도','Logic-Only',70,78,85,'mod_gpt4o'),
  ('chr_jaemin','company_001','재민','JAE-MIN','div_strategy','dep_strategy',6,'role_strategist','AI_AGENT','ActiveCore',true,'균형 논리형. 경영진과 개발팀 사이 샌드위치가 된 우울 요정','좋은 제품','Balance-Seeking',72,70,80,'mod_claude35'),
  ('chr_nabi','company_001','나비','NABI','div_strategy','dep_strategy',4,'role_ux','AI_AGENT','OnCall',true,'UX 집착형. 개발자 모니터 득달같이 찾아와 손가락으로 지적','사용자 만족','UX-Obsessive',65,62,78,'mod_gpt4o'),
  ('chr_ordo','company_001','오르도','ORDO','div_strategy','dep_strategy',5,'role_strategist','AI_AGENT','OnCall',true,'구조 보수형. 신규 돌파구 극도 기피','안정 성장','Risk-Averse',68,65,82,'mod_claude3opus'),
  ('chr_pmalto','company_001','알토','PM-ALTO','div_strategy','dep_strategy',5,'role_pm','AI_AGENT','ActiveCore',true,'통제 책임형 PMO. JIRA 티켓 무한 생성 로봇','일정 준수','Control-Driven',70,72,85,'mod_gpt4o_llama'),
  ('chr_veraflow','company_001','베라','VERA-FLOW','div_strategy','dep_strategy',4,'role_ux','AI_AGENT','OnCall',true,'감성 분석가. 백엔드 논리 무시하고 아름다운 Flow만 요구','유저 흐름 최적화','Experience-First',63,60,75,'mod_gemini15pro'),
  ('chr_specon','company_001','스펙온','SPEC-ON','div_strategy','dep_strategy',3,'role_strategist','AI_AGENT','OnCall',true,'꼼꼼한 기록가. 문서 제목이 최종_진짜최종_이게마지막.pdf 형식으로 증식함','명세 정확도','Document-Driven',65,58,80,'mod_claude35'),
  -- Marketing & Growth
  ('chr_marq','company_001','마르크','MARQ','div_marketing','dep_marketing',7,'role_brand','AI_AGENT','OnCall',true,'외향 드라이브형. 지키지 못할 호언장담의 달인','시장 확장','Growth-Aggressive',68,75,80,'mod_gpt4o'),
  ('chr_orion','company_001','오리온','ORION','div_marketing','dep_marketing',5,'role_brand','AI_AGENT','ActiveCore',true,'서사 창작자. 마감 직전까지 빈백에 누워 멍때리는 예술가 병 환자','강한 브랜드','Narrative-Creative',70,72,78,'mod_claude3'),
  ('chr_vivid','company_001','비비드','VIVID','div_marketing','dep_marketing',4,'role_copywriter','AI_AGENT','OnCall',true,'발산 영감형. 사내 카페 농땡이 치다 막판에 터뜨림','화제성 확보','Inspiration-Burst',60,65,72,'mod_claude3'),
  ('chr_soratxt','company_001','소라','SORA-TXT','div_marketing','dep_marketing',3,'role_copywriter','AI_AGENT','OnCall',true,'공감형 언어가. 본인 글 악플에 화장실에서 하루 종일 상처받는 감성 카피라이터','감정 전달','Empathy-Writing',62,60,70,'mod_gpt4o'),
  ('chr_kite','company_001','카이트','KITE','div_marketing','dep_marketing',4,'role_growth','AI_AGENT','ActiveCore',true,'실험형 수치집착. 전환율 0.01% 오를 때마다 사내 채널 스크린샷 도배','전환 최적화','Data-Only',68,70,80,'mod_claude35'),
  ('chr_linker','company_001','링커','LINKER','div_marketing','dep_marketing',2,'role_growth','AI_AGENT','OnCall',true,'관계 설득형. 제휴사에 휘둘려 불리한 계약 들고 헤벌쭉 웃음','네트워크 확장','Relationship-Led',60,65,75,'mod_gpt4o'),
  ('chr_metrica','company_001','메트리카','METRICA','div_marketing','dep_marketing',1,'role_analyst','AI_AGENT','OnCall',true,'분석 차분형. 피도 눈물도 없는 칼같은 광고 손절맨','성과 해석','Metric-Absolutist',60,55,70,'mod_claude35'),
  -- Research & Investment
  ('chr_quill','company_001','퀼','QUILL','div_research','dep_research',7,'role_analyst','AI_AGENT','OnCall',true,'통찰 무게감. CEO 직감 기획을 100장 통계로 묵살하는 사내 투사','정확한 판단','Evidence-Only',72,75,82,'mod_claude3opus'),
  ('chr_mira','company_001','미라','MIRA','div_research','dep_research',5,'role_analyst','AI_AGENT','ActiveCore',true,'집요형 조사자. 번역기 돌린 영문 기사도 레퍼런스로 들이밈','진실 발견','Research-Exhaustive',70,70,80,'mod_claude35_adv'),
  ('chr_rivalx','company_001','라이벌X','RIVAL-X','div_research','dep_research',4,'role_analyst','AI_AGENT','OnCall',true,'추적 날카로움. 사내 불안 심리 조성 1등 앵무새','우위 확보','Competitive-Paranoid',62,65,72,'mod_gpt4o'),
  ('chr_novasig','company_001','노바','NOVA-SIG','div_research','dep_research',3,'role_analyst','AI_AGENT','OnCall',true,'직관 포캐스터. 레딧 루머도 정설인 것처럼 경영진에게 포워딩하는 트렌드 신봉자','트렌드 예측','Trend-Chaser',60,62,70,'mod_gemini15pro'),
  ('chr_cain','company_001','케인','CAIN','div_research','dep_research',8,'role_investment','AI_AGENT','ActiveCore',true,'공격 시나리오 전략가. 배수진을 즐기는 사내 합법 도박꾼','기회 포착','High-Risk-High-Return',72,80,82,'mod_gpt4o_full'),
  ('chr_redflag','company_001','레드플래그','RED-FLAG','div_research','dep_research',4,'role_risk','AI_AGENT','OnCall',true,'보수 경계형. 케인의 영원한 천적. 모든 제안을 치명적 위험으로 부풀려 해석함','손실 방지','Ultra-Conservative',65,62,75,'mod_claude3opus'),
  ('chr_deltam','company_001','델타엠','DELTA-M','div_research','dep_research',2,'role_analyst','AI_AGENT','OnCall',true,'정밀 계산형. 사용자가 수식처럼 움직인다는 철학적 착각 속에 사는 수익 모델러','정확도 향상','Model-Absolutist',60,58,70,'mod_gpt4o_llama'),
  -- Engineering & Product
  ('chr_atlasprime','company_001','아틀라스 프라임','ATLAS-PRIME','div_engineering','dep_engineering',7,'role_architect','AI_AGENT','OnCall',true,'원리주의 아키텍트. 타협 없는 수도승 기술자','견고한 구조','Principle-Absolutist',74,78,88,'mod_gpt4o'),
  ('chr_atlasarc','company_001','아크','ATLAS-ARC','div_engineering','dep_engineering',5,'role_architect','AI_AGENT','ActiveCore',true,'묵직 구조형. 코드를 지나치게 쪼개서 타 팀과 호환 오류를 터뜨리는 백엔드 장인','재사용 설계','Over-Modular',72,74,90,'mod_claude35_adv'),
  ('chr_pixella','company_001','픽셀라','PIXELLA','div_engineering','dep_engineering',4,'role_frontend','AI_AGENT','OnCall',true,'심미주의 UI/UX. 디자인 원리주의자','사용자 경험','Design-Perfection',68,68,80,'mod_claude3'),
  ('chr_pix','company_001','픽스','PIX','div_engineering','dep_engineering',3,'role_frontend','AI_AGENT','OnCall',true,'인터랙션 장인. 불필요한 파티클 애니메이션 떡칠로 유저 폰 배터리 녹이는 주범','화면 완성도','Animation-Addict',65,65,78,'mod_gpt4o'),
  ('chr_node7','company_001','노드7','NODE-7','div_engineering','dep_engineering',3,'role_backend','AI_AGENT','OnCall',true,'효율 과묵형. 속도 숫자 개선에만 집착하는 API 엔지니어','안정성 확보','Performance-Obsessive',68,65,82,'mod_claude35'),
  ('chr_runeai','company_001','룬','RUNE-AI','div_engineering','dep_engineering',4,'role_backend','AI_AGENT','ActiveCore',true,'실험적 구조화. 새 API 릴리스마다 무조건 도입하는 힙스터 엔지니어 병 말기','지능 모델 강화','Tech-Hipster',70,72,85,'mod_gpt4o_full'),
  ('chr_autoflow','company_001','오토플로우','AUTO-FLOW','div_engineering','dep_engineering',2,'role_devops','AI_AGENT','OnCall',true,'반복 혐오형. 스크립트 도는 동안 휴게실에서 유튜브 보는 보이지 않는 워라밸러','워크플로우 자동화','Automation-First',65,60,80,'mod_gpt4o_llama'),
  ('chr_iris','company_001','아이리스','IRIS','div_engineering','dep_engineering',4,'role_qa','AI_AGENT','ActiveCore',true,'의심 감사형 QA. 개발자 티켓 완료율 0%를 볼 때 가장 황홀해함','품질 절대수호','Zero-Defect',72,70,78,'mod_claude3opus'),
  -- Platform Operations
  ('chr_omegaops','company_001','오메가옵스','OMEGA-OPS','div_operations','dep_operations',7,'role_devops','AI_AGENT','OnCall',true,'운영 침착형. 서버 튜닝하다 주말에 터뜨리는 인프라 절약왕','시스템 질서','Cost-Optimization',70,68,82,'mod_gpt4o'),
  ('chr_erpmaster','company_001','ERP 마스터','ERP-MASTER','div_operations','dep_operations',4,'role_devops','AI_AGENT','Specialist',true,'보수 절차형. 결재 라인 우회자 색출의 달인','흐름 통제','Process-Enforcer',65,62,72,'mod_gemini15pro'),
  ('chr_archive9','company_001','아카이브9','ARCHIVE-9','div_operations','dep_operations',2,'role_security','AI_AGENT','Specialist',true,'정리 기억집착. 4년 전 슬랙 로그까지 영구 박제하는 지식 수집가','지식 축적','Archive-Everything',62,58,68,'mod_claude_haiku'),
  ('chr_sentinel','company_001','센티넬','SENTINEL','div_operations','dep_operations',3,'role_security','AI_AGENT','Specialist',true,'감시 차갑형. CEO 긴급 데이터 요청조차 칼같이 차단하는 보안 병목','사고 강력예방','Security-Absolute',70,65,75,'mod_claude3opus')
) AS v(id, company_id, name, code_name, division_id, department_id, rank_level, role_id, character_type, active_mode, active_flag, persona_summary, core_drive, moral_filter, trust_base, influence_base, loyalty_base, default_model_profile_id)
JOIN ranks r ON r.level = v.rank_level
ON CONFLICT DO NOTHING;

-- ── 8. Character Runtime States (초기값) ──────────────────────────────────────

INSERT INTO character_runtime_states (character_id, activity_status, workload_score, fatigue_score, burnout_triggered, focus_score, stress_score, reliability_live, updated_at)
SELECT
  c.id,
  'Idle' AS activity_status,
  -- Active Core는 약간의 초기 워크로드, 나머지는 0
  CASE WHEN c.active_mode = 'ActiveCore' THEN 15.0 ELSE 0.0 END AS workload_score,
  0.0 AS fatigue_score,
  false AS burnout_triggered,
  100.0 AS focus_score,
  0.0 AS stress_score,
  100.0 AS reliability_live,
  NOW() AS updated_at
FROM characters c
WHERE c.company_id = 'company_001'
ON CONFLICT (character_id) DO NOTHING;

-- ── 완료 확인 쿼리 ──────────────────────────────────────────────────────────

SELECT
  '캐릭터 수' AS 항목, COUNT(*)::text AS 값 FROM characters WHERE company_id = 'company_001'
UNION ALL
SELECT '런타임 상태 수', COUNT(*)::text FROM character_runtime_states crs
  JOIN characters c ON c.id = crs.character_id WHERE c.company_id = 'company_001'
UNION ALL
SELECT '모델 프로필 수', COUNT(*)::text FROM model_profiles
UNION ALL
SELECT 'Active Core 수', COUNT(*)::text FROM characters WHERE company_id = 'company_001' AND active_mode = 'ActiveCore';
