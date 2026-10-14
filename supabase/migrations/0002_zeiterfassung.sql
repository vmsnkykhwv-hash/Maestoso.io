-- Zeiterfassung: Mitarbeiter (mit PIN-Login innerhalb einer Organisation,
-- keine eigenen Supabase-Auth-Konten wie im Einzelkunden-Original) und ihre
-- Zeiteinträge. Geschäftsregeln 1:1 aus zeiterfassung-liva-bad-nauheim
-- übernommen:
--   - Vollzeit/Teilzeit: Grenze pro Kalenderwoche (Mo-So).
--   - Minijob: Grenze pro Kalendermonat.
--   - Leitung ist von der Stundengrenze ausgenommen – wer tatsächlich
--     länger gearbeitet hat, muss das erfassen können.
--   - Ab mehr als 6 Stunden Schicht mindestens 30 Minuten Pause, egal was
--     eingetragen wurde (eine längere manuell eingetragene Pause bleibt
--     unangetastet).
-- Bewusst nicht übernommen: der feste "gilt ab"-Stichtag aus dem Original
-- (dort eine einmalige Übergangsregel für bereits bestehende Altdaten) –
-- für neue Organisationen ohne Altdaten unnötig.

do $$ begin
  create type mitarbeiter_typ as enum ('vollzeit', 'teilzeit', 'minijob');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type mitarbeiter_rolle as enum ('mitarbeiter', 'leitung');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type eintrag_art as enum ('arbeit', 'urlaub', 'krank', 'frei', 'feiertag');
exception
  when duplicate_object then null;
end $$;

create table if not exists mitarbeiter (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id) on delete cascade,
  name text not null,
  pin_hash text not null,
  rolle mitarbeiter_rolle not null default 'mitarbeiter',
  -- vollzeit/teilzeit -> stunden_grenze ist eine Wochengrenze;
  -- minijob -> stunden_grenze ist eine Monatsgrenze. 0 = keine Grenze.
  mitarbeiter_typ mitarbeiter_typ not null default 'vollzeit',
  stunden_grenze numeric(6, 2) not null default 0 check (stunden_grenze >= 0),
  aktiv boolean not null default true,
  erstellt_at timestamptz not null default now(),
  unique (organisation_id, pin_hash)
);

alter table mitarbeiter enable row level security;

create index if not exists mitarbeiter_organisation_idx on mitarbeiter (organisation_id);

create table if not exists zeiteintraege (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id) on delete cascade,
  mitarbeiter_id uuid not null references mitarbeiter(id) on delete cascade,
  arbeitstag date not null,
  art eintrag_art not null default 'arbeit',
  beginn time,
  ende time,
  pause_minuten integer not null default 0 check (pause_minuten >= 0),
  notiz text,
  erstellt_at timestamptz not null default now(),
  aktualisiert_at timestamptz not null default now()
);

alter table zeiteintraege enable row level security;

create index if not exists zeiteintraege_mitarbeiter_idx on zeiteintraege (mitarbeiter_id, arbeitstag);
create index if not exists zeiteintraege_organisation_idx on zeiteintraege (organisation_id);

-- Rohe Schichtlänge in Minuten, behandelt Mitternachts-Überlauf.
create or replace function zeit_rohminuten(v_beginn time, v_ende time)
returns integer
language plpgsql
immutable
as $$
declare
  v_diff integer;
begin
  v_diff := (extract(epoch from (v_ende - v_beginn)) / 60)::integer;
  if v_diff <= 0 then
    v_diff := v_diff + 24 * 60;
  end if;
  return v_diff;
end;
$$;

-- Arbeitsminuten netto (abzüglich Pause, nie negativ).
create or replace function zeit_arbeitsminuten(v_beginn time, v_ende time, v_pause integer)
returns integer
language plpgsql
immutable
as $$
begin
  return greatest(0, zeit_rohminuten(v_beginn, v_ende) - coalesce(v_pause, 0));
end;
$$;

create or replace function zeit_vor_speichern()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_roh_minuten integer;
  v_typ mitarbeiter_typ;
  v_grenze numeric;
  v_rolle mitarbeiter_rolle;
  v_minuten_vorhanden integer;
  v_minuten_neu integer;
  v_perioden_start date;
  v_perioden_ende date;
begin
  if new.art <> 'arbeit' or new.beginn is null or new.ende is null then
    return new;
  end if;

  v_roh_minuten := zeit_rohminuten(new.beginn, new.ende);

  -- Pausen-Automatik: ab mehr als 6 Stunden Schicht mindestens 30 Minuten
  -- Pause, egal was eingetragen wurde.
  if v_roh_minuten > 360 and coalesce(new.pause_minuten, 0) < 30 then
    new.pause_minuten := 30;
  end if;

  select rolle, mitarbeiter_typ, stunden_grenze
    into v_rolle, v_typ, v_grenze
    from mitarbeiter
    where id = new.mitarbeiter_id;

  -- Die Leitung ist von der Stundengrenze ausgenommen.
  if v_rolle = 'leitung' or v_grenze is null or v_grenze <= 0 then
    new.aktualisiert_at := now();
    return new;
  end if;

  if v_typ = 'minijob' then
    v_perioden_start := date_trunc('month', new.arbeitstag)::date;
    v_perioden_ende := (date_trunc('month', new.arbeitstag) + interval '1 month' - interval '1 day')::date;
  else
    v_perioden_start := date_trunc('week', new.arbeitstag)::date;
    v_perioden_ende := v_perioden_start + 6;
  end if;

  select coalesce(sum(zeit_arbeitsminuten(t.beginn, t.ende, t.pause_minuten)), 0)
    into v_minuten_vorhanden
    from zeiteintraege t
    where t.mitarbeiter_id = new.mitarbeiter_id
      and t.art = 'arbeit'
      and t.arbeitstag between v_perioden_start and v_perioden_ende
      and (new.id is null or t.id <> new.id);

  v_minuten_neu := zeit_arbeitsminuten(new.beginn, new.ende, new.pause_minuten);

  if v_minuten_vorhanden + v_minuten_neu > v_grenze * 60 then
    raise exception '% überschritten: % von % Stunden',
      (case when v_typ = 'minijob' then 'Monatsgrenze' else 'Wochengrenze' end),
      round((v_minuten_vorhanden + v_minuten_neu) / 60.0, 2),
      v_grenze
      using errcode = 'check_violation';
  end if;

  new.aktualisiert_at := now();
  return new;
end;
$$;

drop trigger if exists zeit_vor_speichern_pruefen on zeiteintraege;
create trigger zeit_vor_speichern_pruefen
  before insert or update on zeiteintraege
  for each row execute function zeit_vor_speichern();
