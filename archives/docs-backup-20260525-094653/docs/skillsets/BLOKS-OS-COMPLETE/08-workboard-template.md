# 08. Workboard Template

## Weekly execution board

Use this board every week for production rollout tracking.

## Column definitions

1. `Backlog`
2. `Ready`
3. `In Progress`
4. `Review`
5. `Done`
6. `Blocked`

## Ticket template

```md
### [ID] Title
- Owner:
- Phase:
- Scope:
- User impact:
- Dependencies:
- Definition of Done:
- Test cases:
- Risk level:
- Local-first check:
- Target date:
- Status:
```

## Epic template

```md
## Epic: <name>
- Goal:
- Components:
- Entry criteria:
- Exit criteria:
- Risk controls:
- Metrics:
```

## Daily execution checklist

1. Confirm blockers and dependencies
2. Verify tests for all merged tickets
3. Validate policy/audit impact for runtime changes
4. Update incident/risk register
5. Sync progress against release gates
6. Verify that no new mandatory paid/external dependency was introduced

## Weekly governance checklist

1. Policy drift review
2. Security findings triage
3. Reliability SLO check
4. Release gate delta report
5. General-user onboarding friction review
