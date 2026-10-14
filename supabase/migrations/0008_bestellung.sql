-- Online-Bestellung zum Abholen/Liefern. Nutzt die bestehende Speisekarte
-- des Website-Moduls (website_menu_kategorien/-eintraege) weiter, keine
-- eigene Gerichte-Tabelle – `bestellpositionen` speichert nur einen
-- Namens-/Preis-Snapshot zum Bestellzeitpunkt, damit eine spätere
-- Preisänderung alte Bestellungen nicht rückwirkend verändert.
--
-- Schutzmechanismus gegen Selbstüberschätzung (wie bei Lieferando & Co.):
-- jeder Kanal (Abholung/Lieferung) ist einzeln ein-/ausschaltbar, lässt sich
-- für eine befristete Zeit "pausieren" (abholung_pausiert_bis/
-- lieferung_pausiert_bis – kein Cron nötig, wird beim Laden on the fly
-- geprüft) und kann eine Obergrenze gleichzeitig offener Bestellungen
-- haben (max_offen_abholung/-lieferung, null = unbegrenzt). Die
-- Bestellzeiten je Kanal dürfen die tatsächlichen Öffnungszeiten (inkl.
-- Tischplan-Ausnahmen, siehe lib/bestellung/regeln.ts) nie überschreiten,
-- können sie aber enger fassen.

do $$ begin
  alter type modul_schluessel add value 'bestellung';
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type bestell_kanal as enum ('abholung', 'lieferung');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type bestell_status as enum ('neu', 'bestaetigt', 'abgeschlossen', 'storniert');
exception
  when duplicate_object then null;
end $$;

create table if not exists bestell_einstellungen (
  organisation_id uuid primary key references organisationen(id) on delete cascade,
  abholung_aktiv boolean not null default true,
  lieferung_aktiv boolean not null default true,
  abholung_von time,
  abholung_bis time,
  lieferung_von time,
  lieferung_bis time,
  slot_minuten integer not null default 15 check (slot_minuten > 0),
  vorlauf_minuten_abholung integer not null default 20 check (vorlauf_minuten_abholung >= 0),
  vorlauf_minuten_lieferung integer not null default 45 check (vorlauf_minuten_lieferung >= 0),
  max_offen_abholung integer check (max_offen_abholung > 0),
  max_offen_lieferung integer check (max_offen_lieferung > 0),
  abholung_pausiert_bis timestamptz,
  lieferung_pausiert_bis timestamptz,
  abholung_pause_grund text,
  lieferung_pause_grund text,
  check ((abholung_von is null) = (abholung_bis is null)),
  check (abholung_von is null or abholung_bis > abholung_von),
  check ((lieferung_von is null) = (lieferung_bis is null)),
  check (lieferung_von is null or lieferung_bis > lieferung_von)
);

alter table bestell_einstellungen enable row level security;

create table if not exists bestellungen (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id) on delete cascade,
  kanal bestell_kanal not null,
  name text not null,
  telefon text not null,
  email text,
  adresse text,
  datum date not null,
  uhrzeit time not null,
  status bestell_status not null default 'neu',
  notiz text,
  gesamt_preis numeric(10, 2) not null default 0,
  erstellt_at timestamptz not null default now(),
  check (kanal <> 'lieferung' or adresse is not null)
);

alter table bestellungen enable row level security;

create index if not exists bestellungen_organisation_datum_idx on bestellungen (organisation_id, datum);

create table if not exists bestellpositionen (
  id uuid primary key default gen_random_uuid(),
  bestellung_id uuid not null references bestellungen(id) on delete cascade,
  name text not null,
  preis numeric(10, 2) not null,
  menge integer not null default 1 check (menge > 0),
  notiz text
);

alter table bestellpositionen enable row level security;

create index if not exists bestellpositionen_bestellung_idx on bestellpositionen (bestellung_id);
