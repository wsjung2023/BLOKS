# Release Checklist — BLOKS OS

Use this checklist for every release (RC → GA).

---

## Pre-Release

### Code

- [ ] All TypeScript compiles clean: `pnpm lint` (tsc --noEmit across all packages)
- [ ] All unit tests pass: `pnpm test`
- [ ] No unresolved FIXME/TODO marked as blocking in the diff
- [ ] `pnpm verify:ci` passes (lint + test + smoke)
- [ ] Release branch created from `main`: `git checkout -b release/v0.x.x`

### Database

- [ ] Migrations generated and reviewed: `pnpm db:generate && pnpm db:migrate`
- [ ] Seed data verified on fresh database: `pnpm db:seed`
- [ ] Backup taken of production DB before deploy

### Configuration

- [ ] `.env.example` up-to-date with all required keys
- [ ] Helm `values.yaml` updated with correct image tags
- [ ] Secrets verified in Kubernetes Secret / Supabase environment

---

## Deployment

### Local (dev)

```bash
pnpm bloks-os init   # first-time only
pnpm bloks-os start
pnpm bloks-os doctor # verify health
```

### Kubernetes

```bash
# 1. Build and push images
docker build -f apps/api/Dockerfile -t ghcr.io/wsjung2023/bloks-api:v0.x.x .
docker push ghcr.io/wsjung2023/bloks-api:v0.x.x
# repeat for bloks-web and bloks-worker

# 2. Deploy via Helm
helm upgrade --install bloks-os deploy/helm/bloks-os \
  --namespace bloks --create-namespace \
  --set api.image.tag=v0.x.x \
  --set web.image.tag=v0.x.x \
  --set worker.image.tag=v0.x.x

# 3. Verify rollout
kubectl rollout status deployment/bloks-os-api -n bloks
kubectl rollout status deployment/bloks-os-web -n bloks
kubectl rollout status deployment/bloks-os-worker -n bloks
```

---

## Post-Deploy Verification

- [ ] `GET /healthz` returns 200 on API
- [ ] `GET /api/v1/characters` returns character list
- [ ] World canvas loads at `/world`
- [ ] Create a test project → assign character → trigger AI → confirm artifact appears
- [ ] Approval flow: trigger L2 tool → confirm approval request appears in `/approvals`
- [ ] Audit log: confirm execution appears in `/audit`

---

## Rollback

If critical issue is found after deploy:

```bash
# Code rollback
helm rollback bloks-os -n bloks

# Database rollback (if migration was applied)
# See docs/runbooks/backup-restore.md — Section 2
```

---

## Post-Release

- [ ] Git tag created: `git tag v0.x.x && git push origin v0.x.x`
- [ ] GitHub Release created with changelog
- [ ] Known issues logged in risk register (see `docs/runbooks/ga-validation-report.md`)
- [ ] Monitoring verified: check metrics at `/api/v1/metrics/costs/daily`
- [ ] Incident runbook reviewed: `docs/runbooks/incident-response.md`
