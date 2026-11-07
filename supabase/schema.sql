-- =====================================================================
--  Kulturka – Komisja Kultury i Projektów SS PWr
--  Schemat bazy dla Supabase (darmowy plan).
--  Wklej CAŁOŚĆ w Supabase → SQL Editor → Run. Skrypt można uruchomić
--  ponownie (jest idempotentny tam, gdzie to możliwe).
--
--  Zasada: WSZYSTKIE uprawnienia są egzekwowane w bazie (RLS + triggery),
--  a nie tylko przez ukrywanie przycisków w aplikacji.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
--  Ustawienia aplikacji (jeden wiersz, id = 1)
-- ---------------------------------------------------------------------
create table if not exists public.app_settings (
  id                    int primary key default 1 check (id = 1),
  committee_name        text not null default 'Komisja Kultury i Projektów',
  allowed_email_domain  text not null default '',        -- np. student.pwr.edu.pl ('' = dowolna)
  drive_folder_id       text not null default '',        -- folder Google Drive na agendy i listy
  apps_script_url       text not null default '',        -- URL wdrożonego Apps Script (do "Synchronizuj teraz")
  agenda_template_id    text not null default '',        -- opcjonalny szablon agendy (ID Google Docs)
  updated_at            timestamptz not null default now()
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;
-- udostępnianie agend (Google Docs) do edycji osobom z uprawnieniami do spotkania
alter table public.app_settings add column if not exists share_agendas boolean not null default false;

-- ---------------------------------------------------------------------
--  Profile użytkowników
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  full_name    text not null default '',
  role         text not null default 'pending'
               check (role in ('pending', 'member', 'board', 'chair', 'admin', 'rejected', 'alumni')),
  faculty      text not null default '',
  study_field  text not null default '',
  study_year   text not null default '',
  bio          text not null default '' check (char_length(bio) <= 1500),
  phone        text not null default '',
  instagram    text not null default '',
  facebook     text not null default '',
  show_email   boolean not null default true,
  show_phone   boolean not null default false,
  avatar_url   text not null default '',
  consent_at   timestamptz,
  approved_by  uuid references public.profiles (id) on delete set null,
  approved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists profiles_role_idx on public.profiles (role);
-- aktualizacja istniejącej bazy: dodanie roli 'admin' (administrator techniczny, osobno od przewodniczącego)
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('pending', 'member', 'board', 'chair', 'admin', 'rejected', 'alumni'));

-- Sekret do rotującego kodu QR obecności (widoczny tylko dla właściciela)
create table if not exists public.qr_secrets (
  user_id  uuid primary key references public.profiles (id) on delete cascade,
  secret   text not null default encode(extensions.gen_random_bytes(20), 'hex')
);

-- ---------------------------------------------------------------------
--  Role niestandardowe / tymczasowe
-- ---------------------------------------------------------------------
create table if not exists public.custom_roles (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null check (char_length(name) between 1 and 60),
  color                 text not null default '#4FB3E8',
  description           text not null default '',
  can_post_important    boolean not null default false,  -- publikuje w "Ważne" bez akceptacji
  can_scan              boolean not null default false,  -- sprawdza obecność / skanuje QR
  can_manage_meetings   boolean not null default false,  -- tworzy i edytuje spotkania
  created_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now()
);
-- edytuje własne treści (ogłoszenia, spotkania) także po akceptacji / publikacji
alter table public.custom_roles add column if not exists can_edit_own boolean not null default false;

create table if not exists public.custom_role_assignments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role_id     uuid not null references public.custom_roles (id) on delete cascade,
  expires_at  timestamptz,                                -- null = bezterminowo
  granted_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists cra_user_idx on public.custom_role_assignments (user_id);

-- ---------------------------------------------------------------------
--  "Ważne" – ogłoszenia
-- ---------------------------------------------------------------------
create table if not exists public.announcements (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 1 and 140),
  body         text not null default '' check (char_length(body) <= 5000),
  author_id    uuid references public.profiles (id) on delete set null,
  status       text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  pinned       boolean not null default false,
  reviewed_by  uuid references public.profiles (id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists announcements_status_idx on public.announcements (status, created_at desc);

-- ---------------------------------------------------------------------
--  Spotkania i obecność
-- ---------------------------------------------------------------------
create table if not exists public.meetings (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 1 and 140),
  description  text not null default '',
  location     text not null default '',
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  agenda_url   text not null default '',   -- link do Google Docs (wklejony albo utworzony automatycznie)
  sheet_url    text not null default '',   -- link do arkusza obecności (tworzony przez Apps Script)
  auto_agenda  boolean not null default true,
  dirty        boolean not null default true,   -- wymaga synchronizacji z Google
  synced_at    timestamptz,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists meetings_starts_idx on public.meetings (starts_at);

create table if not exists public.attendance (
  meeting_id  uuid not null references public.meetings (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  present     boolean not null default true,
  method      text not null default 'manual' check (method in ('manual', 'qr')),
  marked_by   uuid references public.profiles (id) on delete set null,
  marked_at   timestamptz not null default now(),
  primary key (meeting_id, user_id)
);

-- Dostęp roli tymczasowej do KONKRETNEGO spotkania (nadaje zarząd)
create table if not exists public.meeting_role_access (
  meeting_id  uuid not null references public.meetings (id) on delete cascade,
  role_id     uuid not null references public.custom_roles (id) on delete cascade,
  can_edit    boolean not null default true,    -- edycja spotkania i jego agendy
  can_scan    boolean not null default false,   -- sprawdzanie obecności na tym spotkaniu
  granted_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (meeting_id, role_id)
);

-- ---------------------------------------------------------------------
--  Dziennik zmian (audyt)
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  action      text not null,
  target_id   uuid,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- =====================================================================
--  Funkcje pomocnicze uprawnień
-- =====================================================================
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_active_member() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('member', 'board', 'chair', 'admin'), false)
$$;

create or replace function public.is_board() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('board', 'chair', 'admin'), false)
$$;

-- uprawnienia na poziomie przewodniczącego (ma je też administrator)
create or replace function public.is_chair() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('chair', 'admin'), false)
$$;

-- administrator techniczny aplikacji
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'admin', false)
$$;

-- p: 'post_important' | 'scan' | 'manage_meetings'
create or replace function public.has_perm(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_board() or (
    public.is_active_member() and exists (
      select 1
      from public.custom_role_assignments a
      join public.custom_roles r on r.id = a.role_id
      where a.user_id = auth.uid()
        and (a.expires_at is null or a.expires_at > now())
        and case p
              when 'post_important'  then r.can_post_important
              when 'scan'            then r.can_scan
              when 'manage_meetings' then r.can_manage_meetings
              when 'edit_own'        then r.can_edit_own
              else false
            end
    )
  )
$$;

-- p: 'edit' | 'scan' – uprawnienie do konkretnego spotkania
create or replace function public.has_meeting_perm(p_meeting uuid, p text) returns boolean
language sql stable security definer set search_path = public as $$
  select
    public.has_perm(case p when 'edit' then 'manage_meetings' else 'scan' end)
    or (
      public.is_active_member() and exists (
        select 1
        from public.meeting_role_access mra
        join public.custom_role_assignments a on a.role_id = mra.role_id
        where mra.meeting_id = p_meeting
          and a.user_id = auth.uid()
          and (a.expires_at is null or a.expires_at > now())
          and case p when 'edit' then mra.can_edit when 'scan' then mra.can_scan else false end
      )
    )
    or (
      p = 'edit' and public.has_perm('edit_own')
      and exists (select 1 from public.meetings m where m.id = p_meeting and m.created_by = auth.uid())
    )
$$;

create or replace function public.log_action(p_action text, p_target uuid, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (actor_id, action, target_id, details) values (auth.uid(), p_action, p_target, p_details)
$$;

-- =====================================================================
--  Rejestracja: tworzenie profilu po założeniu konta
-- =====================================================================
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_domain text;
  v_role   text := 'pending';
begin
  select allowed_email_domain into v_domain from public.app_settings where id = 1;
  if coalesce(v_domain, '') <> '' and lower(new.email) not like '%@' || lower(v_domain) then
    raise exception 'Rejestracja możliwa tylko z adresem @%', v_domain;
  end if;

  -- Pierwsza osoba w systemie zostaje administratorem (bootstrap).
  if not exists (select 1 from public.profiles where role in ('admin', 'chair')) then
    v_role := 'admin';
  end if;

  insert into public.profiles (id, email, full_name, role, consent_at, approved_at)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    v_role,
    case when (new.raw_user_meta_data ->> 'consent') = 'true' then now() end,
    case when v_role = 'admin' then now() end
  );
  insert into public.qr_secrets (user_id) values (new.id);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
--  Ochrona zmian ról i pól systemowych w profilu
-- =====================================================================
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.id := old.id;
  new.email := old.email;
  new.created_at := old.created_at;

  -- Zmiany wykonywane z SQL Editora / Apps Script (bez zalogowanego użytkownika) są dozwolone.
  if auth.uid() is null then
    return new;
  end if;

  if new.role is distinct from old.role then
    if not public.is_board() then
      raise exception 'Brak uprawnień do zmiany roli';
    end if;
    if (old.role = 'admin' or new.role = 'admin') and not public.is_admin() then
      raise exception 'Tylko administrator może nadawać lub odbierać rolę administratora';
    end if;
    if (old.role in ('board', 'chair') or new.role in ('board', 'chair')) and not public.is_chair() then
      raise exception 'Tylko przewodniczący lub administrator może nadawać lub odbierać role zarządu i przewodniczącego';
    end if;
    if old.role = 'admin' and (select count(*) from public.profiles where role = 'admin') <= 1 then
      raise exception 'Musi zostać co najmniej jeden administrator – najpierw nadaj tę rolę komuś innemu';
    end if;
    if old.role = 'chair' and (select count(*) from public.profiles where role = 'chair') <= 1
       and not exists (select 1 from public.profiles where role = 'admin') then
      raise exception 'Musi zostać co najmniej jeden przewodniczący – najpierw nadaj tę rolę komuś innemu';
    end if;
    if old.role = 'pending' and new.role in ('member', 'board', 'chair', 'admin') then
      new.approved_by := auth.uid();
      new.approved_at := now();
    end if;
    perform public.log_action('role_change', new.id, jsonb_build_object('from', old.role, 'to', new.role));
    -- nowi/usunięci członkowie → odśwież listy obecności nadchodzących spotkań
    update public.meetings set dirty = true where starts_at > now() - interval '1 day';
  else
    new.approved_by := old.approved_by;
    new.approved_at := old.approved_at;
  end if;

  if old.consent_at is not null then
    new.consent_at := old.consent_at;
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- =====================================================================
--  Ogłoszenia: status ustawiany przez bazę, nie przez klienta
-- =====================================================================
create or replace function public.announcements_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.author_id := auth.uid();
    new.created_at := now();
    if public.has_perm('post_important') then
      new.status := 'published';
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    else
      new.status := 'pending';
      new.pinned := false;
      new.reviewed_by := null;
      new.reviewed_at := null;
    end if;
    return new;
  end if;

  -- UPDATE
  new.author_id := old.author_id;
  new.created_at := old.created_at;
  if auth.uid() is not null and not public.is_board() then
    new.status := old.status;
    new.pinned := old.pinned;
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
  elsif new.status is distinct from old.status then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  return new;
end $$;

drop trigger if exists announcements_guard on public.announcements;
create trigger announcements_guard before insert or update on public.announcements
  for each row execute function public.announcements_guard();

-- =====================================================================
--  Spotkania: znacznik "dirty" do synchronizacji z Google
-- =====================================================================
create or replace function public.meetings_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.dirty := true;
    return new;
  end if;
  new.updated_at := now();
  -- Apps Script ustawia synced_at + dirty=false; każda inna zmiana oznacza "do synchronizacji"
  if new.synced_at is not distinct from old.synced_at then
    new.dirty := true;
  end if;
  return new;
end $$;

drop trigger if exists meetings_touch on public.meetings;
create trigger meetings_touch before insert or update on public.meetings
  for each row execute function public.meetings_touch();

create or replace function public.attendance_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.meetings set dirty = true
   where id = coalesce(new.meeting_id, old.meeting_id);
  if tg_op <> 'DELETE' then
    new.marked_by := coalesce(auth.uid(), new.marked_by);
    new.marked_at := now();
    return new;
  end if;
  return old;
end $$;

drop trigger if exists attendance_touch on public.attendance;
create trigger attendance_touch before insert or update or delete on public.attendance
  for each row execute function public.attendance_touch();

create or replace function public.mra_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.meetings set dirty = true where id = coalesce(new.meeting_id, old.meeting_id);
  return coalesce(new, old);
end $$;

drop trigger if exists mra_touch on public.meeting_role_access;
create trigger mra_touch after insert or update or delete on public.meeting_role_access
  for each row execute function public.mra_touch();

-- =====================================================================
--  RPC: skanowanie QR obecności (weryfikacja po stronie serwera)
--  Format kodu: KKP1.<user_uuid>.<okno_30s>.<hmac10>
-- =====================================================================
create or replace function public.scan_attendance(p_meeting uuid, p_payload text, p_scanned_at timestamptz default now())
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  parts     text[];
  v_user    uuid;
  v_window  bigint;
  v_code    text;
  v_secret  text;
  v_scan_w  bigint;
  v_prof    public.profiles;
  v_already boolean;
begin
  if not public.has_meeting_perm(p_meeting, 'scan') then
    raise exception 'Brak uprawnień do sprawdzania obecności na tym spotkaniu';
  end if;
  if p_scanned_at > now() + interval '5 minutes' or p_scanned_at < now() - interval '7 days' then
    return jsonb_build_object('ok', false, 'error', 'Nieprawidłowy czas skanu');
  end if;

  parts := string_to_array(coalesce(p_payload, ''), '.');
  if array_length(parts, 1) <> 4 or parts[1] <> 'KKP1' then
    return jsonb_build_object('ok', false, 'error', 'To nie jest kod obecności Kulturki');
  end if;
  begin
    v_user := parts[2]::uuid;
    v_window := parts[3]::bigint;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'Uszkodzony kod');
  end;
  v_code := parts[4];

  v_scan_w := floor(extract(epoch from p_scanned_at) / 30);
  if abs(v_scan_w - v_window) > 2 then
    return jsonb_build_object('ok', false, 'error', 'Kod wygasł – poproś o odświeżenie kodu (to może być zrzut ekranu)');
  end if;

  select secret into v_secret from public.qr_secrets where user_id = v_user;
  if v_secret is null or left(encode(hmac(v_window::text, v_secret, 'sha256'), 'hex'), 10) <> v_code then
    return jsonb_build_object('ok', false, 'error', 'Nieprawidłowy kod');
  end if;

  select * into v_prof from public.profiles where id = v_user;
  if v_prof.role not in ('member', 'board', 'chair') then
    return jsonb_build_object('ok', false, 'error', case when v_prof.role = 'admin'
      then 'Administrator nie jest liczony jako członek komisji' else 'Ta osoba nie jest aktywnym członkiem' end);
  end if;
  if not exists (select 1 from public.meetings where id = p_meeting) then
    return jsonb_build_object('ok', false, 'error', 'Nie ma takiego spotkania');
  end if;

  select present into v_already from public.attendance where meeting_id = p_meeting and user_id = v_user;
  insert into public.attendance (meeting_id, user_id, present, method)
  values (p_meeting, v_user, true, 'qr')
  on conflict (meeting_id, user_id) do update set present = true, method = 'qr';

  return jsonb_build_object(
    'ok', true,
    'already', coalesce(v_already, false),
    'user_id', v_prof.id,
    'full_name', v_prof.full_name,
    'avatar_url', v_prof.avatar_url
  );
end $$;

create or replace function public.regenerate_qr_secret() returns void
language sql security definer set search_path = public, extensions as $$
  update public.qr_secrets set secret = encode(gen_random_bytes(20), 'hex') where user_id = auth.uid()
$$;

-- RODO: usunięcie własnego konta (kasuje profil, obecności itd. kaskadowo)
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'Jesteś jedynym administratorem – najpierw nadaj tę rolę komuś innemu';
  end if;
  if public.my_role() = 'chair' and (select count(*) from public.profiles where role = 'chair') <= 1
     and not exists (select 1 from public.profiles where role = 'admin') then
    raise exception 'Jesteś jedynym przewodniczącym – najpierw przekaż tę rolę';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

-- Ustawienia publiczne (dostępne przed zalogowaniem)
create or replace function public.get_public_settings() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('committee_name', committee_name, 'allowed_email_domain', allowed_email_domain)
  from public.app_settings where id = 1
$$;

-- =====================================================================
--  Row Level Security
-- =====================================================================
alter table public.app_settings            enable row level security;
alter table public.profiles                enable row level security;
alter table public.qr_secrets              enable row level security;
alter table public.custom_roles            enable row level security;
alter table public.custom_role_assignments enable row level security;
alter table public.announcements           enable row level security;
alter table public.meetings                enable row level security;
alter table public.attendance              enable row level security;
alter table public.audit_log               enable row level security;
alter table public.meeting_role_access     enable row level security;

-- usuń stare polityki (pozwala ponownie uruchomić skrypt)
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- app_settings
create policy settings_read   on public.app_settings for select to authenticated using (true);
create policy settings_update on public.app_settings for update to authenticated using (public.is_chair()) with check (public.is_chair());

-- profiles
create policy profiles_read on public.profiles for select to authenticated using (
  id = auth.uid()
  or public.is_board()
  or (public.is_active_member() and role in ('member', 'board', 'chair', 'admin', 'alumni'))
);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_board())
  with check (id = auth.uid() or public.is_board());

-- qr_secrets: tylko właściciel
create policy qr_read on public.qr_secrets for select to authenticated using (user_id = auth.uid());

-- custom roles
create policy croles_read  on public.custom_roles for select to authenticated using (public.is_active_member());
create policy croles_write on public.custom_roles for all to authenticated using (public.is_board()) with check (public.is_board());

create policy cra_read  on public.custom_role_assignments for select to authenticated using (public.is_active_member() or user_id = auth.uid());
create policy cra_write on public.custom_role_assignments for all to authenticated using (public.is_board()) with check (public.is_board());

-- announcements
create policy ann_read on public.announcements for select to authenticated using (
  (status = 'published' and public.is_active_member())
  or author_id = auth.uid()
  or public.is_board()
);
create policy ann_insert on public.announcements for insert to authenticated with check (public.is_active_member());
create policy ann_update on public.announcements for update to authenticated
  using (
    public.is_board()
    or (author_id = auth.uid() and status = 'pending')
    or (author_id = auth.uid() and status = 'published' and public.has_perm('edit_own'))
  )
  with check (public.is_board() or author_id = auth.uid());
create policy ann_delete on public.announcements for delete to authenticated
  using (public.is_board() or author_id = auth.uid());

-- meetings
create policy meet_read  on public.meetings for select to authenticated using (public.is_active_member());
create policy meet_insert on public.meetings for insert to authenticated with check (public.has_perm('manage_meetings'));
create policy meet_update on public.meetings for update to authenticated
  using (public.has_meeting_perm(id, 'edit')) with check (public.has_meeting_perm(id, 'edit'));
create policy meet_delete on public.meetings for delete to authenticated using (public.has_perm('manage_meetings'));

-- dostęp ról do spotkań: widzą członkowie, nadaje zarząd
create policy mra_read  on public.meeting_role_access for select to authenticated using (public.is_active_member());
create policy mra_write on public.meeting_role_access for all to authenticated
  using (public.is_board()) with check (public.is_board());

-- attendance
create policy att_read  on public.attendance for select to authenticated
  using (user_id = auth.uid() or public.has_meeting_perm(meeting_id, 'scan'));
create policy att_write on public.attendance for all to authenticated
  using (public.has_meeting_perm(meeting_id, 'scan')) with check (public.has_meeting_perm(meeting_id, 'scan'));

-- audit log
create policy audit_read on public.audit_log for select to authenticated using (public.is_board());

-- uprawnienia do wywołań RPC
revoke execute on function public.scan_attendance(uuid, text, timestamptz) from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
revoke execute on function public.regenerate_qr_secret() from public, anon;
grant execute on function public.scan_attendance(uuid, text, timestamptz) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.regenerate_qr_secret() to authenticated;
grant execute on function public.get_public_settings() to anon, authenticated;

-- =====================================================================
--  Storage: zdjęcia profilowe (publiczny bucket "avatars")
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "avatars insert own" on storage.objects;
drop policy if exists "avatars update own" on storage.objects;
drop policy if exists "avatars delete own" on storage.objects;
create policy "avatars insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars update own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
