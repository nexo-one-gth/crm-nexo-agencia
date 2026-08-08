---
name: rls-audit
description: Audit Row Level Security (RLS) policies in PostgreSQL/Supabase databases. Finds tables without RLS, missing policies, overly permissive rules, SECURITY DEFINER bypasses, missing FORCE RLS, and tenant isolation leaks. Trigger terms - RLS audit, аудит RLS, проверка политик, row level security check, supabase security audit, RLS gaps, policy review, безопасность базы данных, проверка безопасности.
---

# RLS Policy Audit

## Workflow

### 1. Discover Schema

Read the project's Supabase migration files to understand current schema:

```bash
# Find migration files
find supabase/migrations -name "*.sql" | sort
```

Also check for existing RLS policies in migrations using grep for `ENABLE ROW LEVEL SECURITY`, `CREATE POLICY`, `FORCE ROW LEVEL SECURITY`.

### 2. Run Audit Queries

Use queries from `references/audit-queries.md` against the database. Run them via `supabase db` CLI or direct psql connection. Key checks in order of severity:

1. **Tables without RLS** — highest risk, full data exposure
2. **Tables with RLS but no policies** — silently broken (returns empty)
3. **Overly permissive policies** (`USING (true)`)
4. **Missing FORCE ROW LEVEL SECURITY** — owner bypass risk
5. **Incomplete operation coverage** — SELECT without INSERT/UPDATE/DELETE
6. **SECURITY DEFINER functions** — potential RLS bypass
7. **Grants without matching RLS** — anon/authenticated access gaps
8. **Missing WITH CHECK** on write policies

### 3. Classify Findings

Assign severity to each finding:

| Severity | Criteria |
|----------|----------|
| CRITICAL | Data exposed to unauthorized users (no RLS, permissive policy on sensitive table) |
| HIGH | Bypass possible (missing FORCE, SECURITY DEFINER without validation) |
| MEDIUM | Incomplete coverage (missing operations, no WITH CHECK) |
| LOW | Best practice violation (no index on policy column, verbose policy) |

### 4. Generate Report

Output a markdown report with:
- Summary table: total tables, protected, unprotected, policy count
- Findings grouped by severity
- For each finding: table name, issue, current state, recommended fix SQL
- A migration file with all fixes

### 5. Generate Fix Migration

Create a single migration file `supabase/migrations/<timestamp>_rls_audit_fixes.sql` containing:
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` for unprotected tables
- `ALTER TABLE ... FORCE ROW LEVEL SECURITY` for tables missing force
- `CREATE POLICY` statements for missing policies
- `DROP POLICY` + `CREATE POLICY` for overly permissive policies that need tightening

## Common Vulnerability Patterns

Consult `references/common-vulnerabilities.md` for detailed descriptions and fixes of the 10 most common RLS vulnerabilities.

## Supabase-Specific Notes

- System schemas to exclude from audit: `auth`, `storage`, `extensions`, `graphql`, `graphql_public`, `realtime`, `supabase_functions`, `supabase_migrations`, `_analytics`, `pgsodium`, `vault`, `pgbouncer`, `net`, `cron`
- Use `auth.uid()` for user ownership checks, `auth.jwt()` for role/claims checks
- Supabase automatically grants access to `anon` and `authenticated` roles — always verify grants match RLS policies
- Edge Functions running as `postgres` role bypass RLS unless `FORCE` is set
