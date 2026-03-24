// Seed data — company, divisions, and departments for BLOKS Inc

export const COMPANY_ID = 'company_001';

export const DIV = {
  exec:        'div_exec',
  strategy:    'div_strategy',
  marketing:   'div_marketing',
  research:    'div_research',
  engineering: 'div_engineering',
  ops:         'div_ops',
} as const;

export const DEPT = {
  exec:     'dept_exec',
  strategy: 'dept_strategy',
  pmo:      'dept_pmo',
  brand:    'dept_brand',
  growth:   'dept_growth',
  research: 'dept_research',
  invest:   'dept_invest',
  eng:      'dept_eng',
  product:  'dept_product',
  qa:       'dept_qa',
  platform: 'dept_platform',
  security: 'dept_security',
} as const;

export const COMPANY = {
  id:         COMPANY_ID,
  name:       'BLOKS Inc',
  code:       'BLOKS',
  world_tone: 'CozyTactical',
  active_flag: true,
};

export const DIVISIONS = [
  { id: DIV.exec,        company_id: COMPANY_ID, name: 'Executive',                division_type: 'Executive',   sort_order: 1, active_flag: true },
  { id: DIV.strategy,    company_id: COMPANY_ID, name: 'Strategy & Planning HQ',   division_type: 'Strategy',    sort_order: 2, active_flag: true },
  { id: DIV.marketing,   company_id: COMPANY_ID, name: 'Marketing & Growth HQ',    division_type: 'Marketing',   sort_order: 3, active_flag: true },
  { id: DIV.research,    company_id: COMPANY_ID, name: 'Research & Investment HQ', division_type: 'Research',    sort_order: 4, active_flag: true },
  { id: DIV.engineering, company_id: COMPANY_ID, name: 'Engineering & Product HQ', division_type: 'Engineering', sort_order: 5, active_flag: true },
  { id: DIV.ops,         company_id: COMPANY_ID, name: 'Platform Operations HQ',   division_type: 'Operations',  sort_order: 6, active_flag: true },
];

export const DEPARTMENTS = [
  { id: DEPT.exec,     division_id: DIV.exec,        name: 'Executive Office',    code: 'exec',     active_flag: true },
  { id: DEPT.strategy, division_id: DIV.strategy,    name: 'Strategy & Planning', code: 'strategy', active_flag: true },
  { id: DEPT.pmo,      division_id: DIV.strategy,    name: 'PMO',                 code: 'pmo',      active_flag: true },
  { id: DEPT.brand,    division_id: DIV.marketing,   name: 'Brand & Content',     code: 'brand',    active_flag: true },
  { id: DEPT.growth,   division_id: DIV.marketing,   name: 'Growth & Performance',code: 'growth',   active_flag: true },
  { id: DEPT.research, division_id: DIV.research,    name: 'Market Research',     code: 'research', active_flag: true },
  { id: DEPT.invest,   division_id: DIV.research,    name: 'Investment Strategy', code: 'invest',   active_flag: true },
  { id: DEPT.eng,      division_id: DIV.engineering, name: 'Engineering',         code: 'eng',      active_flag: true },
  { id: DEPT.product,  division_id: DIV.engineering, name: 'Product & Design',    code: 'product',  active_flag: true },
  { id: DEPT.qa,       division_id: DIV.engineering, name: 'Quality Assurance',   code: 'qa',       active_flag: true },
  { id: DEPT.platform, division_id: DIV.ops,         name: 'Platform Operations', code: 'platform', active_flag: true },
  { id: DEPT.security, division_id: DIV.ops,         name: 'Security',            code: 'security', active_flag: true },
];
