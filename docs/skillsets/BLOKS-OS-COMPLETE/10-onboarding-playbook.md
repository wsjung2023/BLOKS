# 10. Onboarding Playbook

## Target persona

General user with no DevOps knowledge and no existing backend setup.

## Standard user journey

1. Visit product page and copy one install command.
2. Run `npx bloks-os init`.
3. Follow setup wizard:
4. Choose local-only mode (default recommended).
5. Optionally add provider key.
6. Run `npx bloks-os start`.
7. Browser opens with company bootstrap flow.
8. Create first project and run first agent task.

## First-run wizard requirements

1. Detect OS and permissions automatically.
2. Validate required runtime components.
3. Offer automatic fixes where possible.
4. Save configuration profile safely.
5. Explain approval mode before first execution.

## First task success checklist

1. Agent receives task from world UI.
2. Tool execution request appears in activity timeline.
3. Approval prompt appears for risky action.
4. Output is persisted and visible in artifacts panel.
5. Audit trail is available and exportable.

## QA scenarios for onboarding

1. Clean Windows machine install test.
2. Clean macOS machine install test.
3. Clean Linux machine install test.
4. No-provider-key mode test.
5. Provider-key optional mode test.
6. Upgrade from previous stable version test.

## Support and recovery flow

1. User runs `npx bloks-os doctor`.
2. Doctor returns categorized fix guidance.
3. User can run one-click repair command.
4. If unresolved, user exports diagnostics package.
