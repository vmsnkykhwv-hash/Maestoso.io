-- Tischplan & Reservierungen: physische Tische pro Organisation,
-- Buchungsregeln pro Organisation konfigurierbar, Reservierungen mit echten
-- Postgres-Typen (date/time) statt der "DD.MM.YYYY"-Strings aus dem
-- Ursprungsprojekt (liva-bad-nauheim) – das Original hatte außerdem keine
-- Migration, kein RLS und keine Constraints, alles nur in Anwendungscode.
--
-- Bewusst übernommen (Geschäftsregel aus dem Original): ein Tisch zählt als
-- ein belegter Slot in der Überschneidungsprüfung, unabhängig von der
-- tatsächlichen Sitzplatzkapazität – keine Sitzplatz-Bin-Packing-Logik.
-- Bewusst NEU (Lücke im Original): echte, benannte Tische mit Kapazität
-- (für die Tischverwaltung im Personal-Bereich) statt nur einer
-- Tischanzahl-Konstante; Mitarbeiter-Login über dieselbe
-- Mitarbeiter-PIN-Tabelle wie die Zeiterfassung (siehe 0002), kein eigenes
-- Auth-System.

do $$ begin
  create type reservierung_status as enum ('bestaetigt', 'erschienen', 'storniert', 'nicht_erschienen');
exception
  when duplicate_object then null;
end $$;

create table if not exists tische (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id) on delete cascade,
  name text not null,
  kapazitaet integer not null check (kapazitaet > 0),
  sortierung integer not null default 0,
  erstellt_at timestamptz not null default now(),
  unique (organisation_id, name)
);

alter table tische enable row level security;

create index if not exists tische_organisation_idx on tische (organisation_id);

create table if not exists reservierung_einstellungen (
  organisation_id uuid primary key references organisationen(id) on delete cascade,
  woche_start time not null default '09:00',
  woche_ende time not null default '20:30',
  sonntag_start time not null default '10:00',
  sonntag_ende time not null default '20:00',
  slot_minuten integer not null default 15 check (slot_minuten > 0),
  dauer_minuten integer not null default 180 check (dauer_minuten > 0),
  vorlauf_minuten integer not null default 60 check (vorlauf_minuten >= 0),
  min_personen integer not null default 1 check (min_personen > 0),
  max_personen_online integer not null default 7 check (max_personen_online >= min_personen),
  max_personen_gleichzeitig integer not null default 40 check (max_personen_gleichzeitig > 0),
  check (woche_ende > woche_start),
  check (sonntag_ende > sonntag_start)
);

alter table reservierung_einstellungen enable row level security;

create table if not exists blockierungen (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id) on delete cascade,
  datum date not null,
  start_zeit time not null,
  end_zeit time not null,
  anzahl_tische integer not null check (anzahl_tische > 0),
  notiz text,
  erstellt_at timestamptz not null default now(),
  check (end_zeit > start_zeit)
);

alter table blockierungen enable row level security;

create index if not exists blockierungen_organisation_datum_idx on blockierungen (organisation_id, datum);

create table if not exists reservierungen (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id) on delete cascade,
  name text not null,
  email text not null,
  anzahl_personen integer not null check (anzahl_personen > 0),
  datum date not null,
  uhrzeit time not null,
  erinnerung boolean not null default false,
  status reservierung_status not null default 'bestaetigt',
  tisch_id uuid references tische(id) on delete set null,
  resend_id text,
  notiz text,
  erstellt_at timestamptz not null default now()
);

alter table reservierungen enable row level security;

create index if not exists reservierungen_organisation_datum_idx on reservierungen (organisation_id, datum);
create index if not exists reservierungen_tisch_idx on reservierungen (tisch_id);
