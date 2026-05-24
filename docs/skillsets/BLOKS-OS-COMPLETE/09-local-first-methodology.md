# 09. Local-First Methodology

## Goal

Deliver a product that a general user can install and run on personal PC without mandatory extra paid tools or complex infrastructure setup.

## Decision framework

For every technical choice, answer these questions:

1. Can a non-technical user complete setup in under 10 minutes?
2. Does this introduce mandatory paid dependency?
3. Is there a local fallback when external service is unavailable?
4. Is security preserved in default local mode?

If any answer fails, the decision is blocked or redesigned.

## Dependency policy

1. Mandatory dependencies must be bundled or auto-provisioned.
2. External services must remain optional for baseline operation.
3. Paid providers can improve quality, but not unlock core functionality.

## Architecture methodology

1. Build profile-based runtime: local-first profile and connected profile.
2. Keep one execution contract across profiles.
3. Keep one policy contract across profiles.
4. Keep one audit contract across profiles.

## UX methodology

1. First-run wizard must choose safe defaults automatically.
2. Advanced options must be hidden behind explicit "advanced setup."
3. User language should describe outcomes, not infrastructure terms.
4. Recovery path should be one command (`doctor` + guided fix).

## Delivery methodology

1. Build vertical slices from install to real task completion.
2. Validate on clean machines weekly.
3. Add release gates that enforce onboarding simplicity.
4. Treat onboarding friction bugs as release blockers.
