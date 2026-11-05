-- PG Growth Hub: manager-to-rep messages
-- Run in the Supabase SQL Editor BEFORE deploying the version with "Messages".

create table if not exists messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references profiles(id) on delete cascade,
  recipient_id uuid references profiles(id) on delete cascade,  -- null = every sales rep
  subject      text not null default '',
  body         text not null,
  urgent       boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists idx_messages_recipient on messages(recipient_id);
create index if not exists idx_messages_created on messages(created_at desc);

create table if not exists message_reads (
  message_id uuid not null references messages(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  read_at    timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table messages enable row level security;
alter table message_reads enable row level security;

drop policy if exists messages_select on messages;
drop policy if exists messages_admin_write on messages;
drop policy if exists reads_select on message_reads;
drop policy if exists reads_insert on message_reads;

-- Management sees everything; a rep sees messages addressed to them or to everyone.
create policy messages_select on messages for select to authenticated
  using (is_admin() or (is_active_user() and (recipient_id is null or recipient_id = auth.uid())));
create policy messages_admin_write on messages for all to authenticated
  using (is_admin()) with check (is_admin() and sender_id = auth.uid());

-- Read receipts: a user records and sees their own; management sees all.
create policy reads_select on message_reads for select to authenticated
  using (is_admin() or user_id = auth.uid());
create policy reads_insert on message_reads for insert to authenticated
  with check (
    user_id = auth.uid() and exists (
      select 1 from messages m where m.id = message_id and (m.recipient_id is null or m.recipient_id = auth.uid())
    )
  );
