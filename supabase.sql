-- 1) Таблица заявок
create table if not exists public.deeds (
  id uuid primary key default gen_random_uuid(),
  author_name text not null default 'Анонимно',
  content text not null check (char_length(content) between 3 and 500),
  likes_count integer not null default 0 check (likes_count >= 0),
  pinned boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Таблица лайков
create table if not exists public.deed_likes (
  id bigint generated always as identity primary key,
  deed_id uuid not null references public.deeds(id) on delete cascade,
  liker_token text not null,
  created_at timestamptz not null default now(),
  unique (deed_id, liker_token)
);

-- 3) Таблица администраторов
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

-- 4) Автообновление updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_deeds_updated_at on public.deeds;
create trigger set_deeds_updated_at
before update on public.deeds
for each row
execute function public.set_updated_at();

-- 5) Проверка, является ли пользователь админом
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

-- 6) Безопасная функция лайка
create or replace function public.like_deed(p_deed_id uuid, p_liker_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  if coalesce(length(trim(p_liker_token)), 0) < 10 then
    raise exception 'Некорректный токен лайка';
  end if;

  if not exists (
    select 1
    from public.deeds
    where id = p_deed_id
      and status = 'approved'
  ) then
    raise exception 'Запись не найдена или не одобрена';
  end if;

  insert into public.deed_likes (deed_id, liker_token)
  values (p_deed_id, p_liker_token)
  on conflict (deed_id, liker_token) do nothing;

  get diagnostics inserted_count = row_count;

  if inserted_count = 0 then
    raise exception 'Вы уже ставили лайк этой записи';
  end if;

  update public.deeds
  set likes_count = likes_count + 1
  where id = p_deed_id;
end;
$$;

revoke all on function public.like_deed(uuid, text) from public;
grant execute on function public.like_deed(uuid, text) to anon, authenticated;

-- 7) RLS
alter table public.deeds enable row level security;
alter table public.deed_likes enable row level security;
alter table public.admin_users enable row level security;

-- 8) Публичный просмотр только одобренных заявок
create policy "public can read approved deeds"
on public.deeds
for select
using (status = 'approved' or public.is_admin());

-- 9) Публичная отправка только в pending без лайков и закрепления
create policy "public can create pending deeds"
on public.deeds
for insert
to anon, authenticated
with check (
  status = 'pending'
  and likes_count = 0
  and pinned = false
  and char_length(content) between 3 and 500
);

-- 10) Только админ может менять и удалять заявки
create policy "admins can update deeds"
on public.deeds
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins can delete deeds"
on public.deeds
for delete
to authenticated
using (public.is_admin());

-- 11) Лайки напрямую читать/менять не нужно, только через функцию
create policy "admins can read likes"
on public.deed_likes
for select
to authenticated
using (public.is_admin());

create policy "admins can manage likes"
on public.deed_likes
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 12) Пользователь может проверить только свою админ-запись
create policy "admin can read own admin row"
on public.admin_users
for select
to authenticated
using (user_id = auth.uid());

-- 13) Первичное создание администратора
-- Шаг A: в Supabase -> Authentication -> Users создайте пользователя с email и паролем.
-- Шаг B: после этого выполните SQL ниже, заменив email:
-- insert into public.admin_users (user_id, email)
-- select id, email from auth.users where email = 'admin@example.com'
-- on conflict (user_id) do nothing;
