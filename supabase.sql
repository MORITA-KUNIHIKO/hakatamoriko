-- Supabase の「SQL Editor」に、このファイルの中身を全部貼り付けて「Run」を押してください
-- 何回実行しても大丈夫です

create table if not exists public.tasks (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text       text not null,
  done       boolean not null default false,
  created_at timestamptz not null default now()
);

-- タスクの日付（空のままでもOK）。すでにテーブルがある場合は、この行で列だけ追加されます
alter table public.tasks add column if not exists due_date date;

-- 自分のタスクだけを読み書きできるようにする
alter table public.tasks enable row level security;

drop policy if exists "自分のタスクを見る" on public.tasks;
create policy "自分のタスクを見る" on public.tasks
  for select using (auth.uid() = user_id);

drop policy if exists "自分のタスクを追加する" on public.tasks;
create policy "自分のタスクを追加する" on public.tasks
  for insert with check (auth.uid() = user_id);

drop policy if exists "自分のタスクを更新する" on public.tasks;
create policy "自分のタスクを更新する" on public.tasks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "自分のタスクを削除する" on public.tasks;
create policy "自分のタスクを削除する" on public.tasks
  for delete using (auth.uid() = user_id);
