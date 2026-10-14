-- Lagerbestand & Wareneinkauf: bewusst KEINE Mengenbuchhaltung (die
-- Plattform hat keine Kassenanbindung – ohne automatischen Abzug pro
-- Verkauf würde ein "exakter Bestand" sofort auseinanderlaufen). Stattdessen
-- ein Rhythmus entlang des tatsächlichen Bestellzyklus pro Lieferant:
-- Mitarbeiter prüfen kurz vor dem Bestelltag, was nachbestellt werden muss
-- (Ja/Nein je Artikel + Mengenwunsch), die Leitung lädt sich daraus die
-- fertige Bestellliste herunter.
--
-- Es gibt absichtlich keinen Cron-Job/Hintergrundprozess in diesem Projekt
-- – fällige Prüfungen werden "on the fly" erkannt und angelegt, sobald
-- jemand das Modul öffnet (siehe app/dashboard/lager/actions.ts), nicht
-- über einen geplanten Task. Die automatische Zuweisung an die Person, die
-- laut Dienstplan am relevanten Tag arbeitet, nutzt die bestehende
-- `schichten`-Tabelle aus 0004_dienstplan.sql direkt – keine Dopplung der
-- Dienstplan-Daten.

do $$ begin
  alter type modul_schluessel add value 'lager';
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type bestellzyklus_typ as enum ('woechentlich', 'monatlich');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type bestandspruefung_status as enum ('offen', 'erledigt');
exception
  when duplicate_object then null;
end $$;

create table if not exists lieferanten (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id) on delete cascade,
  name text not null,
  kontakt_email text,
  kontakt_telefon text,
  notiz text,
  zyklus_typ bestellzyklus_typ not null default 'woechentlich',
  -- 0 = Sonntag .. 6 = Samstag, mehrere Tage möglich (nur bei woechentlich).
  wochentage smallint[] not null default '{}',
  -- 1-28, um Monatslängen-Probleme zu vermeiden (nur bei monatlich).
  tag_im_monat smallint check (tag_im_monat is null or (tag_im_monat between 1 and 28)),
  vorlauf_tage smallint not null default 1 check (vorlauf_tage >= 0),
  aktiv boolean not null default true,
  erstellt_at timestamptz not null default now(),
  check (
    (zyklus_typ = 'woechentlich' and coalesce(array_length(wochentage, 1), 0) > 0)
    or (zyklus_typ = 'monatlich' and tag_im_monat is not null)
  )
);

alter table lieferanten enable row level security;

create index if not exists lieferanten_organisation_idx on lieferanten (organisation_id);

create table if not exists artikel (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id) on delete cascade,
  lieferant_id uuid not null references lieferanten(id) on delete cascade,
  name text not null,
  einheit text not null default 'Stück',
  mindestbestand numeric(8, 2) not null default 0 check (mindestbestand >= 0),
  notiz text,
  aktiv boolean not null default true,
  sortierung integer not null default 0
);

alter table artikel enable row level security;

create index if not exists artikel_lieferant_idx on artikel (lieferant_id, sortierung);

create table if not exists bestandspruefungen (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id) on delete cascade,
  lieferant_id uuid not null references lieferanten(id) on delete cascade,
  bestelldatum date not null,
  zugewiesener_mitarbeiter_id uuid references mitarbeiter(id) on delete set null,
  status bestandspruefung_status not null default 'offen',
  erstellt_at timestamptz not null default now(),
  erledigt_at timestamptz,
  unique (lieferant_id, bestelldatum)
);

alter table bestandspruefungen enable row level security;

create index if not exists bestandspruefungen_organisation_idx on bestandspruefungen (organisation_id, bestelldatum);
create index if not exists bestandspruefungen_mitarbeiter_idx on bestandspruefungen (zugewiesener_mitarbeiter_id);

create table if not exists bestandspruefung_eintraege (
  id uuid primary key default gen_random_uuid(),
  bestandspruefung_id uuid not null references bestandspruefungen(id) on delete cascade,
  artikel_id uuid not null references artikel(id) on delete cascade,
  nachbestellen boolean not null default false,
  menge_wunsch text,
  unique (bestandspruefung_id, artikel_id)
);

alter table bestandspruefung_eintraege enable row level security;

create index if not exists bestandspruefung_eintraege_pruefung_idx on bestandspruefung_eintraege (bestandspruefung_id);
