# 07. Deployment And Distribution

## Installation UX

1. `npx bloks-os init`
2. `npx bloks-os start`
3. `npx bloks-os doctor`
4. `npx bloks-os upgrade`

## End-user flow (general users)

1. User runs `npx bloks-os init`.
2. Setup wizard configures local profile automatically.
3. User chooses model mode: local model or external provider key.
4. User runs `npx bloks-os start`.
5. Browser opens world UI and first-company bootstrap starts.

## Deployment modes

1. Local single-user mode
2. Team self-hosted mode
3. Hybrid mode (local runtime + central control plane)

## Packaging requirements

1. Cross-platform service registration
2. Environment validation and guided setup
3. Safe upgrades with rollback points
4. Version compatibility checks
5. Local dependency auto-provisioning in default mode

## Infrastructure profiles

1. Local bundle profile: embedded DB and embedded queue for individual users
2. Docker Compose single-node bundle for advanced users
3. High-availability profile with separate API/worker/redis
4. Kubernetes Helm chart for managed operations

## Production operations

1. Backup schedule and restore procedures
2. Migration strategy with zero-data-loss policy
3. Secret rotation and key management workflow
4. Runtime health checks and restart policy

## Release channels

1. Stable channel for general users
2. Beta channel for early adopters
3. Nightly channel for internal validation
