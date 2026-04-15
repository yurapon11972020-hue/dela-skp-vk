create extension if not exists pgcrypto;

create table if not exists public.good_deeds (
  id uuid primary key default gen_random_uuid(),
  author_name text not null,
  deed_text text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  likes_count integer not null default 0 check (likes_count >= 0),
  is_pinned boolean not null default false,
  display_order integer not null default 0,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz
);

create table if not exists public.post_likes (
  post_id uuid not null references public.good_deeds(id) on delete cascade,
  liker_token text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, liker_token)
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

DROP TRIGGER IF EXISTS trg_good_deeds_updated_at ON public.good_deeds;
create trigger trg_good_deeds_updated_at
before update on public.good_deeds
for each row
execute function public.touch_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

create or replace function public.submit_good_deed(
  p_author_name text,
  p_deed_text text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_author_name text;
  v_deed_text text;
begin
  v_author_name := btrim(coalesce(p_author_name, ''));
  v_deed_text := btrim(coalesce(p_deed_text, ''));

  if char_length(v_author_name) < 2 then
    raise exception 'Поле "От кого" должно содержать минимум 2 символа.';
  end if;

  if char_length(v_deed_text) < 3 then
    raise exception 'Описание доброго дела должно содержать минимум 3 символа.';
  end if;

  if char_length(v_author_name) > 80 then
    raise exception 'Поле "От кого" не должно превышать 80 символов.';
  end if;

  if char_length(v_deed_text) > 1000 then
    raise exception 'Описание доброго дела не должно превышать 1000 символов.';
  end if;

  insert into public.good_deeds (
    author_name,
    deed_text,
    status,
    likes_count,
    is_pinned,
    display_order,
    admin_note,
    approved_at
  )
  values (
    v_author_name,
    v_deed_text,
    'pending',
    0,
    false,
    0,
    null,
    null
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.increment_good_deed_like(
  p_deed_id uuid,
  p_liker_token text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_likes integer;
  v_inserted integer;
begin
  if p_deed_id is null then
    raise exception 'Не указан идентификатор записи.';
  end if;

  if btrim(coalesce(p_liker_token, '')) = '' then
    raise exception 'Не указан токен лайка.';
  end if;

  if not exists (
    select 1
    from public.good_deeds
    where id = p_deed_id
      and status = 'approved'
  ) then
    raise exception 'Лайк можно поставить только одобренной записи.';
  end if;

  insert into public.post_likes (post_id, liker_token)
  values (p_deed_id, p_liker_token)
  on conflict do nothing;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  if v_inserted > 0 then
    update public.good_deeds
    set likes_count = likes_count + 1
    where id = p_deed_id;
  end if;

  select likes_count
  into v_current_likes
  from public.good_deeds
  where id = p_deed_id;

  return coalesce(v_current_likes, 0);
end;
$$;

alter table public.good_deeds enable row level security;
alter table public.post_likes enable row level security;
alter table public.admin_users enable row level security;

DROP POLICY IF EXISTS "Public can view approved deeds" ON public.good_deeds;
create policy "Public can view approved deeds"
on public.good_deeds
for select
using (
  status = 'approved' or public.is_admin()
);

DROP POLICY IF EXISTS "Admins can manage deeds" ON public.good_deeds;
create policy "Admins can manage deeds"
on public.good_deeds
for all
using (public.is_admin())
with check (public.is_admin());

DROP POLICY IF EXISTS "Admins can view likes" ON public.post_likes;
create policy "Admins can view likes"
on public.post_likes
for select
using (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage likes" ON public.post_likes;
create policy "Admins can manage likes"
on public.post_likes
for all
using (public.is_admin())
with check (public.is_admin());

DROP POLICY IF EXISTS "Admins can view admin users" ON public.admin_users;
create policy "Admins can view admin users"
on public.admin_users
for select
using (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage admin users" ON public.admin_users;
create policy "Admins can manage admin users"
on public.admin_users
for all
using (public.is_admin())
with check (public.is_admin());

revoke all on public.good_deeds from anon, authenticated;
revoke all on public.post_likes from anon, authenticated;
revoke all on public.admin_users from anon, authenticated;

grant select on public.good_deeds to anon, authenticated;
grant all on public.good_deeds to authenticated;
grant select on public.post_likes to authenticated;
grant all on public.post_likes to authenticated;
grant select on public.admin_users to authenticated;
grant all on public.admin_users to authenticated;

grant execute on function public.submit_good_deed(text, text) to anon, authenticated;
grant execute on function public.increment_good_deed_like(uuid, text) to anon, authenticated;
grant execute on function public.is_admin() to authenticated;

comment on function public.submit_good_deed(text, text)
  is 'Публичная отправка доброго дела. Всегда сохраняет запись как pending.';

comment on function public.increment_good_deed_like(uuid, text)
  is 'Ставит лайк одной одобренной записи один раз на один browser token.';
