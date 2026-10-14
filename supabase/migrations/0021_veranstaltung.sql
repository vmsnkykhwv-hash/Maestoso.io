-- Veranstaltungsplanung: geschlossene Gesellschaften / Raumvermietungen, als
-- eigenständiges Modul statt eines Tischplan-Tabs (siehe README), weil der
-- Datenbedarf (Ansprechpartner, Pauschale/Anzahlung, Status-Workflow,
-- eigenes öffentliches Anfrageformular) über das hinausgeht, was ein
-- Tischplan-Tab sinnvoll abbildet.
--
-- Bewusst an die bestehende Blockierungen-Tabelle angedockt statt einer
-- eigenen Kapazitätsprüfung: eine bestätigte Veranstaltung legt automatisch
-- eine ganz normale Blockierung an (siehe lib/veranstaltung/aktionen.ts),
-- damit sich reguläre Tischplan-Reservierungen nicht mit ihr überschneiden
-- können – dieselbe Prüfung wie bei jeder anderen Blockierung auch, keine
-- zweite, separat zu pflegende Kapazitätslogik.

do $$ begin
  alter type modul_schluessel add value 'veranstaltung';
exception
  when duplicate_object then null;
end $$;

create table if not exists veranstaltung_einstellungen (
  organisation_id uuid primary key references organisationen(id) on delete cascade,
  aktiv boolean not null default false,
  info_text text,
  benachrichtigung_email text
);

alter table veranstaltung_einstellungen enable row level security;

create table if not exists veranstaltungen (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id) on delete cascade,
  titel text not null,
  ansprechpartner_name text not null,
  email text not null,
  telefon text not null,
  datum date not null,
  beginn time not null,
  ende time not null,
  geschaetzte_gaeste integer not null check (geschaetzte_gaeste > 0),
  status text not null default 'angefragt' check (status in ('angefragt', 'bestaetigt', 'abgesagt', 'durchgefuehrt')),
  preis numeric(10, 2) check (preis is null or preis >= 0),
  anzahlung numeric(10, 2) check (anzahlung is null or anzahlung >= 0),
  notiz text,
  blockierung_id uuid references blockierungen(id) on delete set null,
  erstellt_at timestamptz not null default now()
);

alter table veranstaltungen enable row level security;

create index if not exists veranstaltungen_organisation_idx on veranstaltungen (organisation_id, datum);
