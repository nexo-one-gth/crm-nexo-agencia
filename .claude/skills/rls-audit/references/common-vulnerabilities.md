# Common RLS Vulnerabilities

## 1. Missing RLS on Sensitive Tables

Tables containing user data, PII, or business-critical records without RLS enabled. Any authenticated user can read/write all rows.

**Fix:** `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;`

## 2. RLS Enabled But No Policies

When RLS is on but no policies exist, **all access is denied** (except table owner). This silently breaks the app — queries return empty results without errors.

**Fix:** Create at least SELECT + INSERT policies for each table.

## 3. Overly Permissive Policies (`USING (true)`)

Policies with `USING (true)` grant access to all rows, effectively disabling RLS while giving false sense of security.

**When acceptable:** Truly public lookup tables (countries, currencies). Flag everything else.

## 4. Missing FORCE ROW LEVEL SECURITY

Without `FORCE`, table owners bypass all policies. In Supabase, `postgres` role is owner and some Edge Functions may run as owner.

**Fix:** `ALTER TABLE <table> FORCE ROW LEVEL SECURITY;`

## 5. Missing WITH CHECK on INSERT/UPDATE

`USING` controls which rows can be read; `WITH CHECK` controls what values can be written. Without `WITH CHECK`, a user can INSERT rows with another user's `user_id`.

**Fix:** Add `WITH CHECK (user_id = auth.uid())` to INSERT/UPDATE policies.

## 6. SECURITY DEFINER Functions Bypassing RLS

Functions marked `SECURITY DEFINER` run as the function owner (usually `postgres`), bypassing all RLS. If these functions accept user input and query tables, they create an RLS bypass.

**Fix:** Use `SECURITY INVOKER` unless the function explicitly needs elevated privileges. If DEFINER is needed, validate all inputs.

## 7. Missing Policies for Specific Operations

Having a SELECT policy but missing INSERT/UPDATE/DELETE policies. The missing operations default to DENY, which may be correct — but verify it's intentional.

## 8. Tenant Isolation Leaks

In multi-tenant apps, policies that check `user_id = auth.uid()` but not `tenant_id` — allowing users to see data from other tenants if they somehow have a row with their user_id in another tenant.

**Fix:** Always include tenant_id checks in multi-tenant policies.

## 9. JWT Claims Without Validation

Policies using `auth.jwt() ->> 'role'` where the role claim can be set by the client (e.g., custom claims in sign-up). Ensure claims are set server-side only.

## 10. Grants Without Matching RLS

Tables with `GRANT SELECT ON table TO anon` but no RLS — anonymous users get full read access.

**Fix:** Ensure every table with grants to `anon`/`authenticated` has RLS enabled and appropriate policies.
