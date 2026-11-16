-- Defence in depth for Supabase.
-- The application connects server-side with its own database role and enforces
-- role-based authorisation in code. These statements make sure that NONE of the
-- tables are reachable through Supabase's public REST/GraphQL API (anon /
-- authenticated keys), even if a key leaks: RLS is enabled with no policies
-- (deny-all) and table privileges are revoked.
-- Safe to run on plain Postgres / PGlite: role-specific parts are skipped.

do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;

  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon';
    execute 'revoke all on all sequences in schema public from anon';
    execute 'revoke all on all functions in schema public from anon';
    execute 'alter default privileges in schema public revoke all on tables from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on all tables in schema public from authenticated';
    execute 'revoke all on all sequences in schema public from authenticated';
    execute 'revoke all on all functions in schema public from authenticated';
    execute 'alter default privileges in schema public revoke all on tables from authenticated';
  end if;
end;
$$;
