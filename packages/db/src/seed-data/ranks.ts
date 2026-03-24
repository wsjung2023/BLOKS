// Seed data — 12-tier rank system (doc 11 P0 fix #2: canonical from doc 04)

export const RANK = {
  intern:       'rank_01',
  staff:        'rank_02',
  senior_staff: 'rank_03',
  asst_mgr:     'rank_04',
  manager:      'rank_05',
  deputy_gm:    'rank_06',
  gm:           'rank_07',
  div_head:     'rank_08',
  director:     'rank_09',
  exec_dir:     'rank_10',
  vp:           'rank_11',
  ceo_level:    'rank_12',
} as const;

export const RANKS = [
  { id: RANK.intern,       name: '인턴',       level: 1,  approval_ceiling: 'L0', default_authority_score: 0   },
  { id: RANK.staff,        name: '사원',       level: 2,  approval_ceiling: 'L0', default_authority_score: 5   },
  { id: RANK.senior_staff, name: '주임',       level: 3,  approval_ceiling: 'L0', default_authority_score: 10  },
  { id: RANK.asst_mgr,     name: '대리',       level: 4,  approval_ceiling: 'L0', default_authority_score: 20  },
  { id: RANK.manager,      name: '과장',       level: 5,  approval_ceiling: 'L1', default_authority_score: 30  },
  { id: RANK.deputy_gm,    name: '차장',       level: 6,  approval_ceiling: 'L1', default_authority_score: 42  },
  { id: RANK.gm,           name: '부장',       level: 7,  approval_ceiling: 'L2', default_authority_score: 55  },
  { id: RANK.div_head,     name: '실장',       level: 8,  approval_ceiling: 'L2', default_authority_score: 65  },
  { id: RANK.director,     name: '이사',       level: 9,  approval_ceiling: 'L3', default_authority_score: 75  },
  { id: RANK.exec_dir,     name: '상무',       level: 10, approval_ceiling: 'L3', default_authority_score: 85  },
  { id: RANK.vp,           name: '전무',       level: 11, approval_ceiling: 'L4', default_authority_score: 92  },
  { id: RANK.ceo_level,    name: '사장 / CEO', level: 12, approval_ceiling: 'L4', default_authority_score: 100 },
];
