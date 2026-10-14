-- Dienstplan/Schichtplanung: Vorausplanung der Schichten (wer arbeitet
-- wann), getrennt von der Ist-Zeiterfassung (0002_zeiterfassung.sql).
-- Nutzt dieselben Mitarbeiter wie die Zeiterfassung (keine eigene
-- Mitarbeiter-Tabelle, kein eigener PIN-Login) – die Mitarbeiter-Sitzung
-- aus der Zeiterfassung gilt modulübergreifend (siehe lib/mitarbeiter/).
--
-- Eine Schicht kann unbesetzt bleiben (mitarbeiter_id null): die Leitung
-- plant zuerst den Bedarf, die Zuweisung folgt danach oder per
-- Tausch-Anfrage. Tausch-Anfragen laufen zwischen Mitarbeitern direkt
-- (wer eine offene Anfrage annimmt, übernimmt die Schicht sofort) – die
-- Leitung kann eine Anfrage jederzeit ablehnen/stornieren, muss eine
-- Annahme aber nicht extra bestätigen.

-- Neues Modul im freischaltungen-Enum (siehe 0001_init.sql).
do $$ begin
  alter type modul_schluessel add value 'dienstplan';
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type tausch_status as enum ('offen', 'angenommen', 'abgelehnt', 'storniert');
exception
  when duplicate_object then null;
end $$;

create table if not exists schichten (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id) on delete cascade,
  mitarbeiter_id uuid references mitarbeiter(id) on delete set null,
  datum date not null,
  beginn time not null,
  ende time not null,
  notiz text,
  erstellt_at timestamptz not null default now(),
  check (ende > beginn)
);

alter table schichten enable row level security;

create index if not exists schichten_organisation_datum_idx on schichten (organisation_id, datum);
create index if not exists schichten_mitarbeiter_idx on schichten (mitarbeiter_id, datum);

create table if not exists verfuegbarkeiten (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id) on delete cascade,
  mitarbeiter_id uuid not null references mitarbeiter(id) on delete cascade,
  datum date not null,
  verfuegbar boolean not null default true,
  von time,
  bis time,
  notiz text,
  erstellt_at timestamptz not null default now(),
  aktualisiert_at timestamptz not null default now(),
  unique (mitarbeiter_id, datum),
  check ((von is null) = (bis is null)),
  check (von is null or bis > von)
);

alter table verfuegbarkeiten enable row level security;

create index if not exists verfuegbarkeiten_organisation_datum_idx on verfuegbarkeiten (organisation_id, datum);

create table if not exists tausch_anfragen (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id) on delete cascade,
  schicht_id uuid not null references schichten(id) on delete cascade,
  anfragender_mitarbeiter_id uuid not null references mitarbeiter(id) on delete cascade,
  ziel_mitarbeiter_id uuid references mitarbeiter(id) on delete set null,
  status tausch_status not null default 'offen',
  erstellt_at timestamptz not null default now(),
  entschieden_at timestamptz
);

alter table tausch_anfragen enable row level security;

create index if not exists tausch_anfragen_organisation_idx on tausch_anfragen (organisation_id);
create index if not exists tausch_anfragen_schicht_idx on tausch_anfragen (schicht_id);

-- Höchstens eine offene Tausch-Anfrage gleichzeitig pro Schicht.
create unique index if not exists tausch_anfragen_offen_je_schicht_idx
  on tausch_anfragen (schicht_id)
  where status = 'offen';
