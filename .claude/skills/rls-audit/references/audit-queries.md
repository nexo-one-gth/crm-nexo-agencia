# RLS Audit SQL Queries

## 1. Tables Without RLS

```sql
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'auth', 'storage', 'extensions', 'graphql', 'graphql_public', 'realtime', 'supabase_functions', 'supabase_migrations', '_analytics', 'pgsodium', 'vault', 'pgbouncer', 'net', 'cron')
  AND rowsecurity = false
ORDER BY schemaname, tablename;
```

## 2. Tables With RLS Enabled But No Policies

```sql
SELECT t.schemaname, t.tablename
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
GROUP BY t.schemaname, t.tablename
HAVING COUNT(p.policyname) = 0;
```

## 3. All Existing Policies (Full Detail)

```sql
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,    -- 'PERMISSIVE' or 'RESTRICTIVE'
  roles,
  cmd,           -- ALL, SELECT, INSERT, UPDATE, DELETE
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;
```

## 4. Tables With SELECT But Missing INSERT/UPDATE/DELETE Policies

```sql
WITH policy_coverage AS (
  SELECT tablename,
    bool_or(cmd = 'SELECT' OR cmd = 'ALL') AS has_select,
    bool_or(cmd = 'INSERT' OR cmd = 'ALL') AS has_insert,
    bool_or(cmd = 'UPDATE' OR cmd = 'ALL') AS has_update,
    bool_or(cmd = 'DELETE' OR cmd = 'ALL') AS has_delete
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY tablename
)
SELECT tablename,
  has_select, has_insert, has_update, has_delete
FROM policy_coverage
WHERE NOT (has_select AND has_insert AND has_update AND has_delete);
```

## 5. Overly Permissive Policies (true / 1=1)

```sql
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    qual = 'true' OR qual = '(true)' OR qual IS NULL
    OR with_check = 'true' OR with_check = '(true)' OR with_check IS NULL
  );
```

## 6. FORCE ROW LEVEL SECURITY Check

Tables should have `FORCE ROW LEVEL SECURITY` to prevent table owners from bypassing policies:

```sql
SELECT c.relname AS tablename,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity = true
  AND c.relforcerowsecurity = false;
```

## 7. Grants to anon/authenticated Roles

```sql
SELECT grantee, table_schema, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;
```

## 8. Functions With SECURITY DEFINER (Potential RLS Bypass)

```sql
SELECT n.nspname AS schema, p.proname AS function_name,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdefiner = true;
```

## 9. Policies Referencing auth.uid() vs Hardcoded Values

```sql
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual NOT LIKE '%auth.uid()%' AND qual NOT LIKE '%auth.jwt()%' AND qual != 'true' AND qual IS NOT NULL);
```

## 10. Cross-Table Policy Dependencies

Find policies that reference other tables via subqueries:

```sql
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual LIKE '%SELECT%FROM%' OR qual LIKE '%EXISTS%');
```
