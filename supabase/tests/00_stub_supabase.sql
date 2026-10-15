-- LOCAL TEST HARNESS ONLY: emulates the parts of Supabase that migrations rely on (auth schema, roles).
-- Not used on real Supabase, where these already exist.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), phone text);
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema public, auth to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
