// BLOKS ranks seed data — 12-tier hierarchy per doc 11
export const RANK = {
  intern:    'rank_intern',
  junior:    'rank_junior',
  mid:       'rank_mid',
  manager:   'rank_mid',
  senior:    'rank_senior',
  deputy_gm: 'rank_lead',
  lead:      'rank_lead',
  gm:        'rank_gm',
  div_head:  'rank_gm',
  director:  'rank_director',
  vp:        'rank_vp',
  svp:       'rank_svp',
  c_level:   'rank_c_level',
  ceo_level: 'rank_ceo_level',
  founder:   'rank_founder',
} as const;

export const RANKS_DATA = [
  { id: 'rank_intern',    name: '인턴',          level: 1,  approval_ceiling: 'L0', default_authority_score: 0   },
  { id: 'rank_junior',    name: '주니어',         level: 2,  approval_ceiling: 'L0', default_authority_score: 10  },
  { id: 'rank_mid',       name: '대리/과장',      level: 3,  approval_ceiling: 'L1', default_authority_score: 25  },
  { id: 'rank_senior',    name: '시니어',         level: 4,  approval_ceiling: 'L1', default_authority_score: 35  },
  { id: 'rank_lead',      name: '리드/차장',      level: 5,  approval_ceiling: 'L2', default_authority_score: 45  },
  { id: 'rank_gm',        name: '부장/GM',        level: 6,  approval_ceiling: 'L2', default_authority_score: 55  },
  { id: 'rank_director',  name: '이사',           level: 7,  approval_ceiling: 'L3', default_authority_score: 65  },
  { id: 'rank_vp',        name: '부사장',         level: 8,  approval_ceiling: 'L3', default_authority_score: 75  },
  { id: 'rank_svp',       name: 'SVP',           level: 9,  approval_ceiling: 'L4', default_authority_score: 82  },
  { id: 'rank_c_level',   name: 'C-Level',       level: 10, approval_ceiling: 'L4', default_authority_score: 90  },
  { id: 'rank_ceo_level', name: 'CEO',           level: 11, approval_ceiling: 'L5', default_authority_score: 97  },
  { id: 'rank_founder',   name: '창업자',         level: 12, approval_ceiling: 'L5', default_authority_score: 100 },
];
