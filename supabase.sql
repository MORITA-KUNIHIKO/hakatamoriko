-- Supabase の「SQL Editor」に貼り付けて1回だけ実行してください

create table if not exists public.tasks (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text       text not null,
  done       boolean not null default false,
  created_at timestamptz not null default now()
);

-- 自分のタスクだけを読み書きできるようにする
alter table public.tasks enable row level security;

create policy "自分のタスクを見る" on public.tasks
  for select using (auth.uid() = user_id);

create policy "自分のタスクを追加する" on public.tasks
  for insert with check (auth.uid() = user_id);

create policy "自分のタスクを更新する" on public.tasks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "自分のタスクを削除する" on public.tasks
  for delete using (auth.uid() = user_id);
