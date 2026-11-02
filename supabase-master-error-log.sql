-- Run ONCE in Supabase SQL Editor for the existing BarOS project.
-- Every record belongs to the authenticated user. No service-role key in frontend.
create table if not exists public.baros_error_log (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists baros_error_log_user_idx on public.baros_error_log(user_id);
alter table public.baros_error_log enable row level security;
revoke all on public.baros_error_log from anon;
grant select,insert,update,delete on public.baros_error_log to authenticated;
drop policy if exists "Owners read error log" on public.baros_error_log;
create policy "Owners read error log" on public.baros_error_log for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Owners insert error log" on public.baros_error_log;
create policy "Owners insert error log" on public.baros_error_log for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Owners update error log" on public.baros_error_log;
create policy "Owners update error log" on public.baros_error_log for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Owners delete error log" on public.baros_error_log;
create policy "Owners delete error log" on public.baros_error_log for delete to authenticated using ((select auth.uid()) = user_id);
