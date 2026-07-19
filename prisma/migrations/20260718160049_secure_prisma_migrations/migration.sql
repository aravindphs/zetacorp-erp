-- Seal Prisma's internal migration-bookkeeping table from PostgREST.
--
-- `_prisma_migrations` lives in the public schema and is therefore exposed via
-- Supabase's auto-generated API. It holds no business data, but leaving it
-- without RLS lets anyone with the anon key read the migration history, which
-- the Supabase advisor flags as CRITICAL. Enabling RLS with no policies denies
-- all anon/authenticated access. Prisma connects as the `postgres` role
-- (BYPASSRLS), so migrations continue to work unaffected.
--
-- The statement is guarded because `prisma migrate dev` replays migrations into
-- a shadow database where `_prisma_migrations` may not exist at replay time;
-- there it becomes a no-op, while on the real database it applies.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = '_prisma_migrations'
  ) THEN
    EXECUTE 'ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "_prisma_migrations" FORCE ROW LEVEL SECURITY';
  END IF;
END
$$;
