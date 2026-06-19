-- Role-based admin accounts (admin / chairperson / headteacher) + anonymous voting codes.
-- Apply in the Supabase SQL editor (or via the MCP migration tool).

create table if not exists admin_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password text not null,
  role text not null default 'headteacher' check (role in ('admin','chairperson','headteacher')),
  full_name text,
  created_at timestamptz not null default now()
);

alter table admin_accounts enable row level security;

-- Mirror the app's existing anon-key access model used by other tables.
do $$ begin
  create policy admin_accounts_all on admin_accounts for all using (true) with check (true);
exception when duplicate_object then null; end $$;

-- Seed the administrator account (idempotent).
insert into admin_accounts (username, password, role, full_name)
values ('admin', 'Lavender', 'admin', 'Administrator')
on conflict (username) do nothing;

-- Anonymous voting-codes mode + per-voter flag.
alter table election_settings add column if not exists anon_codes_enabled boolean not null default false;
alter table users add column if not exists is_anonymous boolean not null default false;
