# Backup and Restore Runbook

## Scope

Covers PostgreSQL (via Supabase or local Docker), Redis, and `.env` configuration.

---

## 1. PostgreSQL Backup

### 1a. Local Docker (dev)

```bash
# Dump entire bloks database
docker exec bloks-postgres pg_dump -U postgres bloks > bloks-$(date +%Y%m%d-%H%M%S).sql

# Verify dump is non-empty
wc -l bloks-*.sql
```

### 1b. Supabase (connected mode)

Use the Supabase dashboard → Project Settings → Database → Backups, or:

```bash
# With DATABASE_URL from .env
pg_dump "$DATABASE_URL" --no-owner --no-acl \
  -f bloks-$(date +%Y%m%d-%H%M%S).sql
```

### Retention policy

Keep 7 daily backups. Rotate with:

```bash
ls -t bloks-*.sql | tail -n +8 | xargs rm -f
```

---

## 2. PostgreSQL Restore

```bash
# Stop worker (prevents writes during restore)
pnpm --filter worker exec kill 1   # or Ctrl-C in dev

# Restore into a clean database
psql -U postgres -c "DROP DATABASE IF EXISTS bloks;"
psql -U postgres -c "CREATE DATABASE bloks;"
psql -U postgres -d bloks < bloks-YYYYMMDD-HHMMSS.sql

# Re-run migrations to ensure schema is current
pnpm db:migrate

# Restart all services
pnpm dev
```

**Verification:**
```bash
psql -U postgres -d bloks -c "SELECT COUNT(*) FROM characters;"
psql -U postgres -d bloks -c "SELECT COUNT(*) FROM projects;"
```

---

## 3. Redis Backup

Redis data is ephemeral job queue state. Full DB restore is not required after a Redis failure — BullMQ jobs are re-queued by the API on next request.

For audit purposes, take a Redis RDB snapshot:

```bash
docker exec bloks-redis redis-cli BGSAVE
docker cp bloks-redis:/data/dump.rdb ./redis-$(date +%Y%m%d-%H%M%S).rdb
```

---

## 4. Redis Restore

```bash
# Stop the Redis container
docker stop bloks-redis

# Copy backup into data directory
docker cp ./redis-YYYYMMDD-HHMMSS.rdb bloks-redis:/data/dump.rdb

# Restart Redis
docker start bloks-redis

# Verify
docker exec bloks-redis redis-cli PING   # → PONG
```

---

## 5. Configuration Backup

The `.env` file contains secrets that are not in git. Back it up separately:

```bash
# Encrypt before storing
gpg --symmetric --cipher-algo AES256 .env
# Output: .env.gpg — store in secure location (password manager, secrets vault)
```

---

## 6. Rollback Procedure

### Code rollback

```bash
# List recent deployments (git tags)
git tag --sort=-creatordate | head -10

# Roll back to a specific release tag
git checkout v0.1.0
pnpm install
pnpm build
pnpm dev
```

### Helm rollback (Kubernetes)

```bash
# List release history
helm history bloks-os -n bloks

# Roll back to previous revision
helm rollback bloks-os -n bloks

# Roll back to specific revision
helm rollback bloks-os 3 -n bloks
```

---

## 7. Disaster Recovery Checklist

| Step | Action | Owner |
|------|--------|-------|
| 1 | Identify scope of data loss | On-call |
| 2 | Stop worker to halt writes | On-call |
| 3 | Restore PostgreSQL from latest backup | On-call |
| 4 | Run `pnpm db:migrate` to ensure schema | On-call |
| 5 | Flush Redis and restart | On-call |
| 6 | Restart all services | On-call |
| 7 | Verify via `pnpm bloks-os doctor` | On-call |
| 8 | Post incident review within 24h | Team |

**RTO target:** < 30 minutes for local deployments.
**RPO target:** Last daily backup (< 24h data loss).
