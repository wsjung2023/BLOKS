// ApprovalState and ApprovalLevel enums — used by the BLOKS approval workflow (doc 03, 04)
export enum ApprovalState {
  NotRequired = "NotRequired",
  WaitingL1 = "WaitingL1",
  WaitingL2 = "WaitingL2",
  WaitingL3 = "WaitingL3",
  WaitingFounder = "WaitingFounder",
  Approved = "Approved",
  Rejected = "Rejected",
  ReturnedForRevision = "ReturnedForRevision",
  Expired = "Expired",
}

/** Approval authority levels — L0 auto, L1 Manager, L2 GM, L3 Director, Founder (doc 11 P0 fix #2) */
export enum ApprovalLevel {
  L0 = "L0",
  L1 = "L1",
  L2 = "L2",
  L3 = "L3",
  Founder = "Founder",
}

/** Allowed transitions per approval state (doc 03 section 4.3) */
export const APPROVAL_TRANSITIONS: Record<ApprovalState, ApprovalState[]> = {
  [ApprovalState.NotRequired]: [ApprovalState.Approved],
  [ApprovalState.WaitingL1]: [
    ApprovalState.WaitingL2,
    ApprovalState.ReturnedForRevision,
    ApprovalState.Rejected,
    ApprovalState.Expired,
  ],
  [ApprovalState.WaitingL2]: [
    ApprovalState.WaitingL3,
    ApprovalState.ReturnedForRevision,
    ApprovalState.Rejected,
    ApprovalState.Expired,
  ],
  [ApprovalState.WaitingL3]: [
    ApprovalState.WaitingFounder,
    ApprovalState.ReturnedForRevision,
    ApprovalState.Rejected,
    ApprovalState.Expired,
  ],
  [ApprovalState.WaitingFounder]: [
    ApprovalState.Approved,
    ApprovalState.ReturnedForRevision,
    ApprovalState.Rejected,
    ApprovalState.Expired,
  ],
  [ApprovalState.Approved]: [],
  [ApprovalState.Rejected]: [],
  [ApprovalState.ReturnedForRevision]: [],
  [ApprovalState.Expired]: [],
};
