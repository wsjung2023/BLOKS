// ReasonCode enum — standard and black-comedy rejection/hold reason codes (doc 03 section 9)
export enum ReasonCode {
  // ── Business-standard codes ───────────────────────────────────────────────
  StrategicChange = "STRATEGIC_CHANGE",
  ResourceShortage = "RESOURCE_SHORTAGE",
  LowConfidence = "LOW_CONFIDENCE",
  QualityIssue = "QUALITY_ISSUE",
  RiskDetected = "RISK_DETECTED",
  WaitingDependency = "WAITING_DEPENDENCY",
  FounderDecision = "FOUNDER_DECISION",
  BudgetLimit = "BUDGET_LIMIT",
  Timeout = "TIMEOUT",
  DuplicateRequest = "DUPLICATE_REQUEST",
  ScopeChanged = "SCOPE_CHANGED",
  InvalidInput = "INVALID_INPUT",

  // ── Task-specific rejection codes ─────────────────────────────────────────
  RequirementsUnclear = "REQUIREMENTS_UNCLEAR",
  LogicInsufficient = "LOGIC_INSUFFICIENT",
  MarketEvidenceWeak = "MARKET_EVIDENCE_WEAK",
  TechnicalRiskHigh = "TECHNICAL_RISK_HIGH",
  TestFailed = "TEST_FAILED",
  SecurityConcern = "SECURITY_CONCERN",

  // ── Black-comedy / simulation codes ───────────────────────────────────────
  OverloadRejection = "OVERLOAD_REJECTION",
  PoliticalConflict = "POLITICAL_CONFLICT",
  FounderMicroManagement = "FOUNDER_MICRO_MANAGEMENT",
  BudgetFrozen = "BUDGET_FROZEN",
}
