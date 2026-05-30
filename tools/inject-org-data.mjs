// 임시 스크립트: org 데이터(ranks, roles)를 모든 local-db.json에 직접 주입
import { readFileSync, writeFileSync } from "node:fs";

const RANKS = [
  { id: "rank_intern",    name: "인턴",      level: 1,  approval_ceiling: "L0", default_authority_score: 0   },
  { id: "rank_junior",    name: "주니어",     level: 2,  approval_ceiling: "L0", default_authority_score: 10  },
  { id: "rank_mid",       name: "대리/과장",  level: 3,  approval_ceiling: "L1", default_authority_score: 25  },
  { id: "rank_senior",    name: "시니어",     level: 4,  approval_ceiling: "L1", default_authority_score: 35  },
  { id: "rank_lead",      name: "리드/차장",  level: 5,  approval_ceiling: "L2", default_authority_score: 45  },
  { id: "rank_gm",        name: "부장/GM",    level: 6,  approval_ceiling: "L2", default_authority_score: 55  },
  { id: "rank_director",  name: "이사",       level: 7,  approval_ceiling: "L3", default_authority_score: 65  },
  { id: "rank_vp",        name: "부사장",     level: 8,  approval_ceiling: "L3", default_authority_score: 75  },
  { id: "rank_svp",       name: "SVP",       level: 9,  approval_ceiling: "L4", default_authority_score: 82  },
  { id: "rank_c_level",   name: "C-Level",   level: 10, approval_ceiling: "L4", default_authority_score: 90  },
  { id: "rank_ceo_level", name: "CEO",       level: 11, approval_ceiling: "L5", default_authority_score: 97  },
  { id: "rank_founder",   name: "창업자",     level: 12, approval_ceiling: "L5", default_authority_score: 100 },
];

const DEPT = {
  exec:"dept_exec", strategy:"dept_strategy", product_strategy:"dept_product_strategy",
  pmo:"dept_pmo", brand:"dept_brand", content:"dept_content", growth:"dept_growth",
  design:"dept_design", social:"dept_social", analytics:"dept_analytics",
  market_research:"dept_market_research", investment:"dept_investment",
  competitive_intel:"dept_competitive_intel", data_science:"dept_data_science",
  strategy_research:"dept_strategy_research", backend:"dept_backend",
  frontend:"dept_frontend", product:"dept_product", qa:"dept_qa",
  devops:"dept_devops", platform:"dept_platform", security:"dept_security",
  hr:"dept_hr", admin:"dept_admin", finance:"dept_finance",
  legal:"dept_legal", operations:"dept_operations",
};

const ROLES = [
  { id: "role_founder",             department_id: DEPT.exec,             name: "창업자 아바타",        family: "Executive",   is_lead_role: true  },
  { id: "role_digital_twin",        department_id: DEPT.exec,             name: "에코 트윈",            family: "Executive",   is_lead_role: false },
  { id: "role_ceo",                 department_id: DEPT.exec,             name: "CEO",                 family: "Executive",   is_lead_role: true  },
  { id: "role_coo",                 department_id: DEPT.exec,             name: "COO",                 family: "Executive",   is_lead_role: true  },
  { id: "role_cfo",                 department_id: DEPT.exec,             name: "CFO",                 family: "Finance",     is_lead_role: true  },
  { id: "role_cto",                 department_id: DEPT.exec,             name: "CTO",                 family: "Engineering", is_lead_role: true  },
  { id: "role_cmo",                 department_id: DEPT.exec,             name: "CMO",                 family: "Marketing",   is_lead_role: true  },
  { id: "role_strategy_head",       department_id: DEPT.strategy,         name: "전략기획 본부장",      family: "Strategy",    is_lead_role: true  },
  { id: "role_sr_strategist",       department_id: DEPT.strategy,         name: "시니어 전략기획",      family: "Strategy",    is_lead_role: false },
  { id: "role_ux_planner",          department_id: DEPT.strategy,         name: "UX 기획 차장",        family: "Strategy",    is_lead_role: false },
  { id: "role_biz_strategist",      department_id: DEPT.strategy,         name: "비즈니스 전략 부장",  family: "Strategy",    is_lead_role: false },
  { id: "role_pmo_lead",            department_id: DEPT.pmo,              name: "PMO 리드",            family: "Strategy",    is_lead_role: true  },
  { id: "role_ux_analyst",          department_id: DEPT.strategy,         name: "UX 분석 차장",        family: "Strategy",    is_lead_role: false },
  { id: "role_spec_writer",         department_id: DEPT.strategy,         name: "스펙 기록 과장",       family: "Strategy",    is_lead_role: false },
  { id: "role_mktg_head",           department_id: DEPT.brand,            name: "마케팅 본부장",        family: "Marketing",   is_lead_role: true  },
  { id: "role_brand_mgr",           department_id: DEPT.brand,            name: "브랜드 부장",          family: "Marketing",   is_lead_role: false },
  { id: "role_copywriter",          department_id: DEPT.content,          name: "카피라이터 과장",      family: "Marketing",   is_lead_role: false },
  { id: "role_growth_hacker",       department_id: DEPT.growth,           name: "그로스 해커",          family: "Marketing",   is_lead_role: false },
  { id: "role_visual_designer",     department_id: DEPT.design,           name: "비주얼 디자이너",      family: "Design",      is_lead_role: false },
  { id: "role_sns_mgr",             department_id: DEPT.social,           name: "SNS 매니저",          family: "Marketing",   is_lead_role: false },
  { id: "role_mktg_analyst",        department_id: DEPT.analytics,        name: "마케팅 애널리스트",   family: "Marketing",   is_lead_role: false },
  { id: "role_research_head",       department_id: DEPT.market_research,  name: "리서치 본부장",        family: "Research",    is_lead_role: true  },
  { id: "role_market_analyst",      department_id: DEPT.market_research,  name: "시장 분석 부장",      family: "Research",    is_lead_role: false },
  { id: "role_competitive_analyst", department_id: DEPT.competitive_intel,name: "경쟁 분석가",          family: "Research",    is_lead_role: false },
  { id: "role_investment_analyst",  department_id: DEPT.investment,       name: "투자 분석가",          family: "Research",    is_lead_role: false },
  { id: "role_data_scientist",      department_id: DEPT.data_science,     name: "데이터 사이언티스트", family: "Data",        is_lead_role: false },
  { id: "role_data_engineer",       department_id: DEPT.data_science,     name: "데이터 엔지니어",     family: "Engineering", is_lead_role: false },
  { id: "role_strategy_researcher", department_id: DEPT.strategy_research,name: "전략 연구원",          family: "Strategy",    is_lead_role: false },
  { id: "role_eng_head",            department_id: DEPT.backend,          name: "개발 본부장",          family: "Engineering", is_lead_role: true  },
  { id: "role_backend_dev",         department_id: DEPT.backend,          name: "백엔드 개발자",        family: "Engineering", is_lead_role: false },
  { id: "role_frontend_dev",        department_id: DEPT.frontend,         name: "프론트엔드 개발자",   family: "Engineering", is_lead_role: false },
  { id: "role_security_engineer",   department_id: DEPT.security,         name: "보안 엔지니어",        family: "Security",    is_lead_role: false },
  { id: "role_product_manager",     department_id: DEPT.product,          name: "프로덕트 매니저",      family: "Strategy",    is_lead_role: false },
  { id: "role_qa_engineer",         department_id: DEPT.qa,               name: "QA 엔지니어",         family: "Engineering", is_lead_role: false },
  { id: "role_devops_engineer",     department_id: DEPT.devops,           name: "DevOps 엔지니어",     family: "Engineering", is_lead_role: false },
  { id: "role_junior_dev",          department_id: DEPT.backend,          name: "주니어 개발자",        family: "Engineering", is_lead_role: false },
  { id: "role_tech_architect",      department_id: DEPT.platform,         name: "기술 아키텍트",        family: "Engineering", is_lead_role: false },
  { id: "role_hr_head",             department_id: DEPT.hr,               name: "HR 본부장",           family: "HR",          is_lead_role: true  },
  { id: "role_ops_manager",         department_id: DEPT.admin,            name: "운영 매니저",          family: "Operations",  is_lead_role: false },
  { id: "role_finance_analyst",     department_id: DEPT.finance,          name: "재무 분석가",          family: "Finance",     is_lead_role: false },
  { id: "role_legal_compliance",    department_id: DEPT.legal,            name: "법무 컴플라이언스",   family: "Legal",       is_lead_role: false },
  { id: "role_recruiter",           department_id: DEPT.hr,               name: "리크루터",             family: "HR",          is_lead_role: false },
  { id: "role_ops_specialist",      department_id: DEPT.operations,       name: "운영 전문가",          family: "Operations",  is_lead_role: false },
  { id: "role_strategy_lead",       department_id: DEPT.strategy,         name: "전략 리드",            family: "Strategy",    is_lead_role: false },
  { id: "role_product_strategist",  department_id: DEPT.product_strategy, name: "제품 전략가",          family: "Strategy",    is_lead_role: false },
];

const paths = [
  "D:/Projects/BLOKS/.bloks-data/local-db.json",
  "D:/Projects/BLOKS/apps/api/.bloks-data/local-db.json",
  "D:/Projects/BLOKS/apps/worker/.bloks-data/local-db.json",
];

for (const p of paths) {
  try {
    const db = JSON.parse(readFileSync(p, "utf8"));
    db.ranks = RANKS;
    db.roles = ROLES;
    writeFileSync(p, JSON.stringify(db, null, 2), "utf8");
    console.log(`OK  ${p.split("/").pop()} → ranks:${db.ranks.length} roles:${db.roles.length} divisions:${db.divisions?.length ?? 0}`);
  } catch (e) {
    console.log(`SKIP ${p}: ${e.message}`);
  }
}
