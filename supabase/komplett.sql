-- Maestoso: alle Datenbank-Migrationen in einem Durchgang.
-- Nicht von Hand bearbeiten – erzeugt von supabase/komplett-erzeugen.sh.
-- Nur EINMAL auf einem leeren Supabase-Projekt ausführen (SQL Editor → Run).
-- Läuft als eine Transaktion: bei einem Fehler wird nichts angelegt.

begin;

-- ===== 0001_init.sql =====
-- Mandantenfähige Grundstruktur der Plattform: eine Organisation = ein
-- (potenzieller) Kunde, mit eigenem Zugangscode + PIN. Freischaltungen
-- bestimmen pro Organisation und Modul, ob es freigeschaltet ist – ohne
-- Freischaltung läuft das Modul trotzdem, nur mit sichtbarem Demo-Hinweis
-- (siehe app/dashboard).
--
-- Bewusst keine Policies für anon/authenticated: der Browser bekommt nie
-- direkten Supabase-Zugriff, alle Zugriffe laufen über Server Actions mit
-- dem Service-Role-Key. RLS ist aktiv, aber ohne Policy = kein Zugriff von
-- außen.

do $$ begin
  create type modul_schluessel as enum ('zeiterfassung', 'tischplan');
exception
  when duplicate_object then null;
end $$;

create table if not exists organisationen (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  login_code text not null unique,
  pin_hash text not null,
  erstellt_at timestamptz not null default now()
);

alter table organisationen enable row level security;

create table if not exists freischaltungen (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id) on delete cascade,
  modul modul_schluessel not null,
  freigeschaltet boolean not null default false,
  freigeschaltet_am timestamptz,
  unique (organisation_id, modul)
);

alter table freischaltungen enable row level security;

create index if not exists freischaltungen_organisation_idx on freischaltungen (organisation_id);

-- ===== 0002_zeiterfassung.sql =====
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

-- ===== 0003_tischplan.sql =====
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

-- ===== 0004_dienstplan.sql =====
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

-- ===== 0005_website.sql =====
-- Website-Modul: eine öffentliche Marketing-Seite pro Organisation (Hero,
-- Über uns, Speisekarte, Tagesmenü, Galerie, eingebettetes Buchungsformular)
-- plus Domain-Zuordnung. Jede Organisation bekommt bei Anlage automatisch
-- eine Plattform-Subdomain (z. B. musterbetrieb.maestoso.io); eine eigene
-- Domain (z. B. musterbetrieb.de) ist optional nachrüstbar, sobald der Kunde sie
-- besitzt (siehe proxy.ts für die Domain-basierte Weiterleitung).
--
-- Bewusst NICHT dupliziert: die auf der Website angezeigten Öffnungszeiten
-- kommen direkt aus `reservierung_einstellungen` (0003_tischplan.sql) –
-- ändert die Leitung dort die Zeiten, zeigt die Website sofort die neuen,
-- ohne eigene Kopie der Regel.

do $$ begin
  alter type modul_schluessel add value 'website';
exception
  when duplicate_object then null;
end $$;

alter table organisationen add column if not exists subdomain text unique;
alter table organisationen add column if not exists custom_domain text unique;

-- Öffentlicher Storage-Bucket für Hero-/Galeriebilder. Objekte werden nur
-- serverseitig über den Service-Role-Key geschrieben (wie der Rest der
-- Plattform), aber öffentlich lesbar ausgeliefert (public = true), damit
-- die Marketing-Seite Bilder ohne Login/Policy-Umweg anzeigen kann.
insert into storage.buckets (id, name, public)
values ('website-bilder', 'website-bilder', true)
on conflict (id) do nothing;

create table if not exists website_inhalt (
  organisation_id uuid primary key references organisationen(id) on delete cascade,
  hero_titel text not null default '',
  hero_untertitel text not null default '',
  ueber_uns text not null default '',
  tagesmenu_text text not null default '',
  tagesmenu_aktiv boolean not null default false,
  kontakt_telefon text not null default '',
  kontakt_email text not null default '',
  kontakt_adresse text not null default '',
  instagram_url text,
  aktualisiert_at timestamptz not null default now()
);

alter table website_inhalt enable row level security;

create table if not exists website_bilder (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id) on delete cascade,
  rolle text not null check (rolle in ('hero', 'galerie')),
  storage_pfad text not null,
  sortierung integer not null default 0,
  erstellt_at timestamptz not null default now()
);

alter table website_bilder enable row level security;

create index if not exists website_bilder_organisation_idx on website_bilder (organisation_id, rolle, sortierung);

create table if not exists website_menu_kategorien (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id) on delete cascade,
  name text not null,
  sortierung integer not null default 0
);

alter table website_menu_kategorien enable row level security;

create index if not exists website_menu_kategorien_organisation_idx on website_menu_kategorien (organisation_id, sortierung);

create table if not exists website_menu_eintraege (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id) on delete cascade,
  kategorie_id uuid not null references website_menu_kategorien(id) on delete cascade,
  name text not null,
  beschreibung text,
  preis numeric(6, 2) not null check (preis >= 0),
  aktiv boolean not null default true,
  sortierung integer not null default 0
);

alter table website_menu_eintraege enable row level security;

create index if not exists website_menu_eintraege_kategorie_idx on website_menu_eintraege (kategorie_id, sortierung);

-- ===== 0006_lager.sql =====
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

-- ===== 0007_tischplan_ausnahmen.sql =====
-- Tagesgenaue Ausnahmen von den normalen Öffnungszeiten im Tischplan: ein
-- einzelnes Datum, an dem kürzer/länger geöffnet oder ganz geschlossen ist
-- (z. B. Heiligabend, Inventur, Betriebsferien) – ohne die regulären
-- Mo-Sa/So-Einstellungen dafür anzufassen. Wird in lib/tischplan/regeln.ts
-- VOR der Wochentag-Regel geprüft (siehe oeffnungsfenster()).

create table if not exists reservierung_ausnahmen (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id) on delete cascade,
  datum date not null,
  geschlossen boolean not null default false,
  von time,
  bis time,
  notiz text,
  erstellt_at timestamptz not null default now(),
  unique (organisation_id, datum),
  check ((von is null) = (bis is null)),
  check (geschlossen or (von is not null and bis is not null and bis > von))
);

alter table reservierung_ausnahmen enable row level security;

create index if not exists reservierung_ausnahmen_organisation_idx on reservierung_ausnahmen (organisation_id, datum);

-- ===== 0008_bestellung.sql =====
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

-- ===== 0009_bewertung.sql =====
-- Automatisierte Google-Bewertungsanfrage: sobald die Leitung eine
-- Reservierung als "erschienen" markiert, wird – nur falls aktiviert und
-- eine Google-Bewertungs-URL hinterlegt ist – automatisch eine Mail mit
-- Bitte um Rezension geplant (Resend `scheduledAt`, kein Cron-Job nötig,
-- siehe lib/bewertung/email.ts). Ändert sich der Status danach wieder
-- (z. B. versehentlicher Klick), wird die bereits geplante Mail über
-- dieselbe Resend-ID storniert statt einem No-Show eine Bewertung
-- abzuverlangen.

do $$ begin
  alter type modul_schluessel add value 'bewertung';
exception
  when duplicate_object then null;
end $$;

create table if not exists bewertungsanfrage_einstellungen (
  organisation_id uuid primary key references organisationen(id) on delete cascade,
  aktiv boolean not null default false,
  google_url text,
  verzoegerung_minuten integer not null default 180 check (verzoegerung_minuten >= 0)
);

alter table bewertungsanfrage_einstellungen enable row level security;

alter table reservierungen add column if not exists bewertung_resend_id text;

-- ===== 0010_bestellung_benachrichtigung.sql =====
-- Bestätigungs-/Status-Mails an Kunden sowie Benachrichtigung des Personals
-- bei einer neuen Bestellung (siehe lib/bestellung/email.ts). `gesehen`
-- markiert, ob eine Bestellung im Dashboard schon einmal angezeigt oder
-- bearbeitet wurde – Grundlage für den "Neu"-Marker und die In-App-
-- Benachrichtigung (app/dashboard/BestellBenachrichtigung.tsx), kein
-- Cron-Job nötig, da rein beim Laden/Ändern aktualisiert.

alter table bestellungen add column if not exists gesehen boolean not null default false;

alter table bestell_einstellungen add column if not exists benachrichtigung_email text;

-- ===== 0011_zeiterfassung_dokumente.sql =====
-- Ablage von Arbeitsverträgen & Co. pro Mitarbeiter. Anders als
-- website-bilder bewusst ein PRIVATER Bucket (public = false) – Verträge
-- sind sensible Dokumente, keine Marketing-Bilder. Der Download läuft
-- deshalb nie über eine öffentliche/signierte URL, sondern ausschließlich
-- über eine serverseitige Route, die vorher die Leitungs-Session prüft
-- (siehe app/dashboard/zeiterfassung/dokumente/[id]/route.ts).

insert into storage.buckets (id, name, public)
values ('mitarbeiter-dokumente', 'mitarbeiter-dokumente', false)
on conflict (id) do nothing;

create table if not exists mitarbeiter_dokumente (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id) on delete cascade,
  mitarbeiter_id uuid not null references mitarbeiter(id) on delete cascade,
  dateiname text not null,
  storage_pfad text not null,
  groesse_bytes bigint not null,
  hochgeladen_at timestamptz not null default now()
);

alter table mitarbeiter_dokumente enable row level security;

create index if not exists mitarbeiter_dokumente_mitarbeiter_idx on mitarbeiter_dokumente (mitarbeiter_id);

-- ===== 0012_lager_bestellung.sql =====
-- Lagerbestand: statt eines Mengenwunsches (der die Bestellmenge vorwegnahm)
-- trägt die Prüfung jetzt immer einen aktuellen Bestand ein, unabhängig vom
-- "Nachbestellen"-Haken – die Entscheidung über die Bestellmenge bleibt bei
-- der Leitung. Dafür bekommt jeder Eintrag zwei neue, von der Leitung
-- gepflegte Felder: `bestellmenge` (was tatsächlich bestellt werden soll)
-- und `bestellt` (true, sobald die Bestellung tatsächlich per Mail
-- rausgegangen ist – siehe app/dashboard/lager/BestellungUebersicht.tsx).
-- Ein als "nachbestellen" markierter, aber noch nicht bestellter Eintrag
-- taucht dort gruppiert nach Lieferant auf.

alter table bestandspruefung_eintraege rename column menge_wunsch to aktueller_bestand;
alter table bestandspruefung_eintraege add column if not exists bestellt boolean not null default false;
alter table bestandspruefung_eintraege add column if not exists bestellmenge text;

-- Zusätzliche Lieferanten-Felder für die automatisch vorbereitete
-- Bestell-Mail (lib/lager/email.ts) – beide optional, viele Lieferanten
-- erwarten aber eine Kundennummer in der Bestellung.
alter table lieferanten add column if not exists ansprechpartner text;
alter table lieferanten add column if not exists kundennummer text;

-- ===== 0013_gutschein_paypal.sql =====
-- Gutschein-Verkauf + PayPal als Zusatzoption (nie Pflicht). Jede
-- Organisation hinterlegt ihre eigenen PayPal-Zugangsdaten (Client-ID +
-- Secret ihrer eigenen PayPal-Business-App) – das Geld fließt direkt an
-- den Mandanten, wir fassen es nie an. Ohne hinterlegte/aktive
-- Zugangsdaten bleibt nur "Vor Ort bezahlen" übrig, genau wie bisher bei
-- der Online-Bestellung.

do $$ begin
  alter type modul_schluessel add value 'gutschein';
exception
  when duplicate_object then null;
end $$;

-- Wie bei bewertungsanfrage_einstellungen: RLS ohne Policies, also nur
-- über den Service-Role-Client lesbar/schreibbar – das Secret darf nie
-- im Browser landen.
create table if not exists organisation_zahlungseinstellungen (
  organisation_id uuid primary key references organisationen(id) on delete cascade,
  paypal_client_id text,
  paypal_client_secret text,
  paypal_modus text not null default 'sandbox' check (paypal_modus in ('sandbox', 'live')),
  paypal_aktiv boolean not null default false
);

alter table organisation_zahlungseinstellungen enable row level security;

create table if not exists gutschein_einstellungen (
  organisation_id uuid primary key references organisationen(id) on delete cascade,
  aktiv boolean not null default false,
  betraege numeric(10, 2)[] not null default '{25, 50, 100}'
);

alter table gutschein_einstellungen enable row level security;

-- Für Gäste gibt es bewusst keine Policy (wie überall sonst auch): ein
-- Gutschein-Käufer hat keine Sitzung, geschrieben wird ausschließlich
-- serverseitig, nachdem entweder "vor Ort bezahlen" gewählt oder die
-- PayPal-Zahlung erfolgreich erfasst wurde.
create table if not exists gutscheine (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id) on delete cascade,
  code text not null unique,
  betrag numeric(10, 2) not null,
  kaeufer_name text not null,
  kaeufer_email text not null,
  zahlungsart text not null check (zahlungsart in ('paypal', 'vor_ort')),
  status text not null default 'offen' check (status in ('offen', 'bezahlt', 'eingeloest', 'storniert')),
  paypal_order_id text,
  erstellt_at timestamptz not null default now(),
  bezahlt_am timestamptz,
  eingeloest_am timestamptz
);

alter table gutscheine enable row level security;

create index if not exists gutscheine_organisation_idx on gutscheine (organisation_id);

-- ===== 0014_paypal_webhook.sql =====
-- Schließt die Lücke aus 0013: Bricht der Käufer nach der PayPal-Freigabe
-- ab, bevor der Browser zur Rückkehr-Seite zurückfindet (Tab geschlossen,
-- Verbindung weg), blieb der Gutschein für immer auf "Offen" hängen – die
-- Rückkehr-Seite war der einzige Ort, der die Zahlung erfasst hat. Ein
-- PayPal-Webhook ist vom Browser des Käufers unabhängig und erfasst die
-- Zahlung zusätzlich, sobald PayPal sie meldet (siehe lib/paypal/webhook.ts).

alter table organisation_zahlungseinstellungen add column if not exists paypal_webhook_id text;

-- ===== 0015_bewertung_bestellung.sql =====
-- Die Google-Bewertungsanfrage lief bisher nur über Reservierungen
-- (Tischplan, "Erschienen"). Jetzt zusätzlich über abgeschlossene
-- Online-Bestellungen – gleiches Prinzip, eigene Resend-ID-Spalte, damit
-- eine spätere Statusänderung die bereits geplante Mail unabhängig von
-- Reservierungen stornieren kann.

alter table bestellungen add column if not exists bewertung_resend_id text;

-- ===== 0016_tausch_bestaetigung.sql =====
-- Ein Schichttausch darf nie still durchlaufen: Nimmt ein Mitarbeiter eine
-- angebotene Schicht an, wird die Schicht NICHT sofort umgeschrieben,
-- sondern die Anfrage wechselt erst auf "angenommen" (wartet auf
-- Bestätigung der Leitung). Erst wenn die Leitung bestätigt, wird die
-- Schicht tatsächlich zugewiesen – vorher soll die Leitung nie von
-- plötzlich auftauchenden, ungeplanten Mitarbeitern überrascht werden.

do $$ begin
  alter type tausch_status add value 'bestaetigt';
exception
  when duplicate_object then null;
end $$;

-- ===== 0017_rate_limit.sql =====
-- Generische Versuchszähler-Tabelle fürs Login-Rate-Limiting (siehe
-- lib/rateLimit.ts) – ein Schlüssel kann ein Zugangscode, eine
-- Organisation-ID oder ein fester Name wie 'plattform-admin' sein. Ohne
-- diese Sperre waren alle drei PIN-Arten (Organisation, Mitarbeiter,
-- Plattform-Admin) beliebig oft durchprobierbar.

create table if not exists login_versuche (
  schluessel text primary key,
  fehlversuche integer not null default 0,
  letzter_versuch timestamptz not null default now(),
  gesperrt_bis timestamptz
);

alter table login_versuche enable row level security;

-- ===== 0018_tausch_unique_fix.sql =====
-- Die ursprüngliche Sperre galt nur für Status "offen". Seit der
-- zweistufigen Bestätigung (0016) bleibt eine zugesagte, aber noch nicht
-- bestätigte Anfrage auf Status "angenommen" stehen, OHNE dass die Schicht
-- schon umgeschrieben ist – in dieser Zeit konnte für dieselbe Schicht
-- eine zweite "offen"-Anfrage entstehen (die Sperre griff nicht, weil die
-- erste ja nicht mehr "offen" war), die ein zweiter Mitarbeiter annehmen
-- und die Leitung bestätigen konnte – das hätte die erste Bestätigung
-- still überschrieben.

drop index if exists tausch_anfragen_offen_je_schicht_idx;

create unique index if not exists tausch_anfragen_aktiv_je_schicht_idx
  on tausch_anfragen (schicht_id)
  where status in ('offen', 'angenommen');

-- ===== 0019_kapazitaets_rpc.sql =====
-- Schließt die Race-Condition zwischen Kapazitätsprüfung und tatsächlichem
-- Anlegen: zwei nahezu gleichzeitige Gäste (z. B. zwei Browser-Tabs oder ein
-- Skript) könnten sonst beide den letzten freien Tisch/Bestellslot
-- bekommen, weil Prüfung (lib/tischplan/regeln.ts bzw.
-- lib/bestellung/regeln.ts) und das anschließende Anlegen zwei getrennte
-- Anfragen sind.
--
-- Die volle Geschäftslogik (Öffnungszeiten, Feiertage, Kanal-Pausen,
-- Vorlaufzeit) bleibt bewusst in TypeScript – sie dorthin zu verlagern wäre
-- mit deutlich höherem Risiko verbunden, dieselbe Logik beim Portieren neu
-- kaputtzumachen, als das eigentliche Problem wert ist. Hier wird
-- ausschließlich der Kapazitäts-Zähler (die einzige Stelle, an der zwei
-- parallele Anfragen tatsächlich kollidieren können) ein zweites Mal, unter
-- einem Advisory-Lock, unmittelbar vor dem Insert geprüft. Der Lock ist
-- transaktionsgebunden (pg_advisory_xact_lock) und wird am Ende der
-- Funktion automatisch freigegeben, kein manuelles Unlock nötig.

create or replace function reservierung_mit_pruefung_erstellen(
  p_organisation_id uuid,
  p_name text,
  p_email text,
  p_anzahl_personen integer,
  p_datum date,
  p_uhrzeit time,
  p_dauer_minuten integer,
  p_gesamt_tische integer,
  p_max_personen_gleichzeitig integer,
  p_erinnerung boolean,
  p_notiz text
) returns reservierungen
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ende time;
  v_belegte_tische integer;
  v_belegte_personen integer;
  v_row reservierungen;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_organisation_id::text || p_datum::text, 0));

  v_ende := p_uhrzeit + make_interval(mins => p_dauer_minuten);

  -- Dieselbe Überschneidungslogik wie belegungFuerSlot() in
  -- lib/tischplan/regeln.ts: ein Tisch zählt als belegt, wenn sich sein
  -- Reservierungsfenster mit [p_uhrzeit, v_ende) überschneidet.
  select coalesce(count(*), 0), coalesce(sum(anzahl_personen), 0)
    into v_belegte_tische, v_belegte_personen
  from reservierungen
  where organisation_id = p_organisation_id
    and datum = p_datum
    and status not in ('storniert', 'nicht_erschienen')
    and uhrzeit < v_ende
    and p_uhrzeit < (uhrzeit + make_interval(mins => p_dauer_minuten));

  select v_belegte_tische + coalesce(sum(anzahl_tische), 0)
    into v_belegte_tische
  from blockierungen
  where organisation_id = p_organisation_id
    and datum = p_datum
    and start_zeit < v_ende
    and p_uhrzeit < end_zeit;

  if v_belegte_tische >= p_gesamt_tische then
    raise exception 'KAPAZITAET_TISCHE';
  end if;

  if v_belegte_personen + p_anzahl_personen > p_max_personen_gleichzeitig then
    raise exception 'KAPAZITAET_PERSONEN';
  end if;

  insert into reservierungen (organisation_id, name, email, anzahl_personen, datum, uhrzeit, erinnerung, notiz)
  values (p_organisation_id, p_name, p_email, p_anzahl_personen, p_datum, p_uhrzeit, p_erinnerung, p_notiz)
  returning * into v_row;

  return v_row;
end;
$$;

-- Gleiches Prinzip für Online-Bestellungen: nur die "wie viele Bestellungen
-- sind in diesem Kanal gerade offen"-Zählung (offeneAnzahl() in
-- lib/bestellung/regeln.ts) läuft hier ein zweites Mal unter Lock; Insert
-- von Bestellung + Positionen gemeinsam in einer Transaktion ersetzt das
-- bisherige "anlegen, bei Positionsfehler wieder löschen" in
-- bestellungErstellen().
create or replace function bestellung_mit_pruefung_erstellen(
  p_organisation_id uuid,
  p_kanal bestell_kanal,
  p_name text,
  p_telefon text,
  p_email text,
  p_adresse text,
  p_datum date,
  p_uhrzeit time,
  p_notiz text,
  p_gesamt_preis numeric,
  p_max_offen integer,
  p_positionen jsonb
) returns bestellungen
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offene_anzahl integer;
  v_row bestellungen;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_organisation_id::text || p_datum::text || p_kanal::text, 0));

  if p_max_offen is not null then
    select count(*) into v_offene_anzahl
    from bestellungen
    where organisation_id = p_organisation_id
      and datum = p_datum
      and kanal = p_kanal
      and status not in ('abgeschlossen', 'storniert');

    if v_offene_anzahl >= p_max_offen then
      raise exception 'KAPAZITAET_OFFEN';
    end if;
  end if;

  insert into bestellungen (organisation_id, kanal, name, telefon, email, adresse, datum, uhrzeit, notiz, gesamt_preis)
  values (p_organisation_id, p_kanal, p_name, p_telefon, p_email, p_adresse, p_datum, p_uhrzeit, p_notiz, p_gesamt_preis)
  returning * into v_row;

  insert into bestellpositionen (bestellung_id, name, preis, menge, notiz)
  select v_row.id, (pos ->> 'name')::text, (pos ->> 'preis')::numeric, (pos ->> 'menge')::integer, pos ->> 'notiz'
  from jsonb_array_elements(p_positionen) as pos;

  return v_row;
end;
$$;

-- ===== 0020_bewertung_auswertung.sql =====
-- Zwei Auswertungen rund um Bewertungen:
--
-- 1) Klickrate der Bewertungsanfrage-Mails. `reservierungen.bewertung_resend_id`
--    bzw. `bestellungen.bewertung_resend_id` (siehe 0009/0015) werden beim
--    Stornieren wieder auf null gesetzt – fürs Nachverfolgen "wie viele Mails
--    wurden je geöffnet/angeklickt" braucht es deshalb ein eigenes, dauerhaftes
--    Protokoll statt der beiden Spalten direkt. Der Webhook aus
--    app/api/resend/webhook/route.ts trägt hier Öffnen/Klick anhand der
--    Resend-ID nach.
--
-- 2) Manuell erfasste Google-Bewertungsschnappschüsse. Die Google Business
--    Profile API bräuchte eine eigene Google-Cloud-Projekteinrichtung mit
--    Freigabe durch Google (siehe README) – bis das steht, trägt die Leitung
--    Anzahl/Durchschnitt selbst ein, ein Eintrag pro Tag.

create table if not exists bewertungsanfragen (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id) on delete cascade,
  resend_id text not null unique,
  quelle text not null check (quelle in ('reservierung', 'bestellung')),
  quelle_id uuid not null,
  storniert boolean not null default false,
  geoeffnet_am timestamptz,
  geklickt_am timestamptz,
  erstellt_at timestamptz not null default now()
);

alter table bewertungsanfragen enable row level security;

create index if not exists bewertungsanfragen_organisation_idx on bewertungsanfragen (organisation_id, erstellt_at);

create table if not exists google_bewertung_snapshots (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id) on delete cascade,
  datum date not null,
  anzahl_bewertungen integer not null check (anzahl_bewertungen >= 0),
  durchschnitt numeric(2, 1) not null check (durchschnitt >= 1 and durchschnitt <= 5),
  erstellt_at timestamptz not null default now(),
  unique (organisation_id, datum)
);

alter table google_bewertung_snapshots enable row level security;

create index if not exists google_bewertung_snapshots_organisation_idx on google_bewertung_snapshots (organisation_id, datum);

-- ===== 0021_veranstaltung.sql =====
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

-- ===== 0022_rechtliche_angaben.sql =====
-- Rechtliche Angaben je Organisation (Impressum nach § 5 DDG und
-- Verantwortlicher für die Datenschutzerklärung). Auf den öffentlichen
-- Gästeseiten (Website, Reservieren, Bestellen, Gutschein, Veranstaltung)
-- ist jeweils der Betrieb Anbieter und Verantwortlicher – Maestoso ist dort
-- nur Auftragsverarbeiter, deshalb gehören diese Angaben zur Organisation
-- und nicht zur Plattform.
--
-- Bewusst eine eigene Tabelle statt Spalten in website_inhalt: die Pflicht
-- besteht auch ohne freigeschaltetes Website-Modul, sobald z. B. nur der
-- Reservierungslink geteilt wird.

create table if not exists rechtliche_angaben (
  organisation_id uuid primary key references organisationen(id) on delete cascade,
  firma text not null default '',
  vertreten_durch text not null default '',
  strasse text not null default '',
  plz_ort text not null default '',
  telefon text not null default '',
  email text not null default '',
  register_eintrag text not null default '',
  ust_id text not null default '',
  datenschutz_kontakt text not null default '',
  aktualisiert_at timestamptz not null default now()
);

alter table rechtliche_angaben enable row level security;

-- ===== 0023_domain_aktiv.sql =====
-- Merkt sich, ob die eigene Domain einer Organisation tatsächlich
-- funktioniert (DNS zeigt auf Vercel, Zertifikat da). Erst dann leitet
-- proxy.ts die Plattform-Subdomain dauerhaft auf die eigene Domain um –
-- vorher landeten Gäste sonst auf einer Adresse, die noch nicht erreichbar
-- ist. Gesetzt über "Status prüfen" im Plattform-Admin.
alter table organisationen add column if not exists custom_domain_aktiv boolean not null default false;

-- ===== 0024_konten.sql =====
-- Persönliche Konten mit Passwort und Zwei-Faktor-Anmeldung (TOTP, also
-- Authenticator-App) statt eines geteilten Zugangscodes mit PIN.
--
-- plattform_admins: der Plattform-Betreiber (vorher ein PIN aus der
-- Umgebungsvariable PLATTFORM_ADMIN_PIN – der dient jetzt nur noch einmalig
-- zur Ersteinrichtung des ersten Admin-Kontos).
-- benutzer: Verwaltungskonten eines Betriebs (Inhaber*in und weitere
-- Personen mit vollen Rechten), angemeldet unter <domain-des-betriebs>/team.
--
-- totp_geheimnis ist mit ZWEI_FAKTOR_SCHLUESSEL verschlüsselt (siehe
-- lib/konten/verschluesselung.ts) – ein Datenbank-Leak allein reicht so
-- nicht, um Codes zu erzeugen. Wiederherstellungscodes nur als Hash.
-- sitzung_version: wird bei Passwortänderung oder 2FA-Zurücksetzen erhöht und
-- macht damit alle bestehenden Sitzungen dieses Kontos ungültig.

create table if not exists plattform_admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  passwort_hash text not null,
  totp_geheimnis text,
  totp_aktiv boolean not null default false,
  totp_letzter_schritt bigint,
  wiederherstellungscodes text[] not null default '{}',
  sitzung_version integer not null default 1,
  erstellt_at timestamptz not null default now()
);

alter table plattform_admins enable row level security;

create table if not exists benutzer (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id) on delete cascade,
  email text not null,
  name text not null default '',
  -- null, solange die Einladung noch nicht angenommen wurde
  passwort_hash text,
  totp_geheimnis text,
  totp_aktiv boolean not null default false,
  totp_letzter_schritt bigint,
  wiederherstellungscodes text[] not null default '{}',
  sitzung_version integer not null default 1,
  aktiv boolean not null default true,
  erstellt_at timestamptz not null default now(),
  unique (organisation_id, email)
);

alter table benutzer enable row level security;

create index if not exists benutzer_organisation_idx on benutzer (organisation_id);

-- Einmal-Links für Einladung und "Passwort vergessen" – nur der SHA-256-Hash
-- wird gespeichert, der Link selbst existiert nur in der E-Mail.
create table if not exists konto_tokens (
  id uuid primary key default gen_random_uuid(),
  benutzer_id uuid not null references benutzer(id) on delete cascade,
  zweck text not null check (zweck in ('einladung', 'passwort')),
  token_hash text not null unique,
  ablauf timestamptz not null,
  verwendet_at timestamptz,
  erstellt_at timestamptz not null default now()
);

alter table konto_tokens enable row level security;

-- Der geteilte Zugangscode + PIN je Organisation wird abgelöst (siehe
-- README → "Zugänge & Rollen"); die Spalten bleiben vorerst bestehen,
-- dürfen für neue Organisationen aber leer sein.
alter table organisationen alter column login_code drop not null;
alter table organisationen alter column pin_hash drop not null;

-- ===== 0025_geraete.sql =====
-- Geräte eines Betriebs:
-- - tresen: das zentrale Tablet/Kassen-Gerät im Laden. Einmal durch ein
--   Verwaltungskonto freigegeben, bleibt es dauerhaft angemeldet; wer daran
--   arbeitet, meldet sich mit seiner Mitarbeiter-PIN an. Nur hier gehen
--   Tagesgeschäft (Reservierungen, Bestellungen, Gutscheine) und Stempeln.
-- - handy: das eigene Handy einer Mitarbeiterin, per QR-Code + PIN gekoppelt.
--   Sieht nur Dienstplan, Verfügbarkeit, Tauschbörse und die eigenen Zeiten.
-- Entziehen (widerrufen_at) wirkt sofort, weil jede Anfrage das Gerät gegen
-- diese Tabelle prüft (lib/session.ts).

create table if not exists geraete (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id) on delete cascade,
  art text not null check (art in ('tresen', 'handy')),
  name text not null,
  mitarbeiter_id uuid references mitarbeiter(id) on delete cascade,
  erstellt_von uuid references benutzer(id) on delete set null,
  erstellt_at timestamptz not null default now(),
  zuletzt_gesehen_at timestamptz,
  widerrufen_at timestamptz,
  check ((art = 'handy') = (mitarbeiter_id is not null))
);

alter table geraete enable row level security;

create index if not exists geraete_organisation_idx on geraete (organisation_id);

-- Einmal-Codes für das Koppeln eines Mitarbeiter-Handys (15 Minuten gültig,
-- nur der Hash wird gespeichert).
create table if not exists kopplungscodes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id) on delete cascade,
  mitarbeiter_id uuid not null references mitarbeiter(id) on delete cascade,
  code_hash text not null unique,
  ablauf timestamptz not null,
  verwendet_at timestamptz,
  erstellt_at timestamptz not null default now()
);

alter table kopplungscodes enable row level security;

-- Welche Module eine Mitarbeiterin am Tresen bzw. auf dem Handy nutzen darf
-- (Freischaltung je Tool durch die Inhaberin). Website und
-- Bewertungsanfragen sind reine Verwaltung und stehen hier nie drin.
alter table mitarbeiter
  add column if not exists module text[] not null
  default '{tischplan,bestellung,gutschein,veranstaltung,zeiterfassung,dienstplan,lager}';

-- ===== 0026_aenderungsprotokoll.sql =====
-- Änderungsprotokoll je Betrieb: wer hat wann was geändert. Gegen
-- Manipulation hilft das mehr als jede Sperre – eine stornierte
-- Reservierung, ein eingelöster Gutschein oder eine geänderte Arbeitszeit
-- ist damit immer einer Person zuzuordnen (Verwaltungskonto, Mitarbeiterin
-- am Tresen per PIN oder gekoppeltes Handy).
--
-- Nur Einfügen, kein Ändern/Löschen im Code – auch nicht durch das
-- Verwaltungskonto. Gelöscht wird nur mit der ganzen Organisation.
-- akteur_name wird beim Schreiben festgehalten, damit ein Eintrag auch nach
-- dem Löschen oder Umbenennen der Person lesbar bleibt.

create table if not exists aenderungsprotokoll (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id) on delete cascade,
  zeitpunkt timestamptz not null default now(),
  akteur_art text not null check (akteur_art in ('inhaber', 'tresen', 'handy')),
  akteur_id uuid,
  akteur_name text not null,
  modul text not null,
  aktion text not null,
  details text,
  objekt_id text
);

alter table aenderungsprotokoll enable row level security;

create index if not exists aenderungsprotokoll_organisation_idx on aenderungsprotokoll (organisation_id, zeitpunkt desc);

-- ===== 0027_protokoll_support.sql =====
-- Eingriffe des Plattform-Admins in einen Betrieb (Konto einladen, 2FA
-- zurücksetzen, Konto sperren, Module, Domain) landen im Änderungsprotokoll
-- des Betriebs als "Maestoso-Support". Sonst könnte sich der Admin
-- unbemerkt ein Verwaltungskonto in einem fremden Betrieb anlegen.
alter table aenderungsprotokoll drop constraint if exists aenderungsprotokoll_akteur_art_check;
alter table aenderungsprotokoll
  add constraint aenderungsprotokoll_akteur_art_check
  check (akteur_art in ('inhaber', 'tresen', 'handy', 'support'));

-- ===== 0028_anfragen.sql =====
-- Anfragen von der öffentlichen Website (maestoso-gastro.de): Demo-Termin,
-- Fragen, Sonstiges. Nur der Plattform-Admin sieht und bearbeitet sie.
-- Kein Bezug zu einer Organisation – die Interessenten sind (noch) keine
-- Kunden.

create table if not exists anfragen (
  id uuid primary key default gen_random_uuid(),
  erstellt_at timestamptz not null default now(),
  art text not null check (art in ('demo', 'frage', 'sonstiges')),
  name text not null,
  betrieb text,
  email text not null,
  telefon text,
  wunschtag date,
  tageszeit text check (tageszeit in ('vormittags', 'nachmittags', 'abends')),
  nachricht text,
  status text not null default 'neu' check (status in ('neu', 'in_bearbeitung', 'erledigt')),
  notiz text
);

alter table anfragen enable row level security;

create index if not exists anfragen_erstellt_idx on anfragen (erstellt_at desc);

-- ===== 0029_testphase.sql =====
-- Testphase: 30 Tage kostenlos, danach sperrt der tägliche Cron-Job
-- (app/api/cron/testphase) den Betrieb. Ab der Sperre hat der Kunde
-- 30 Tage Zeit, sich zu entscheiden – danach wird der Betrieb mit allen
-- Daten gelöscht. "aktiv" = Vertrag läuft, keine Fristen mehr.
-- Die Sperre greift auch ohne Cron sofort mit Ablauf von test_bis
-- (lib/testphase/regeln.ts) – der Cron setzt nur Status und Löschfrist und
-- verschickt die Mails.

do $$
begin
  if not exists (
    select 1 from information_schema.columns where table_name = 'organisationen' and column_name = 'vertrag_status'
  ) then
    alter table organisationen
      add column vertrag_status text not null default 'test' check (vertrag_status in ('test', 'aktiv', 'gesperrt')),
      add column test_bis timestamptz default (now() + interval '30 days'),
      add column loeschung_am timestamptz,
      add column erinnerung_test_gesendet boolean not null default false,
      add column erinnerung_loeschung_gesendet boolean not null default false;

    -- Nur beim ersten Einspielen: bestehende Betriebe testen ab ihrer
    -- Anlage, aber noch mindestens 7 Tage ab heute – niemand soll durch die
    -- Migration selbst überraschend gesperrt werden.
    update organisationen set test_bis = greatest(erstellt_at + interval '30 days', now() + interval '7 days');
  end if;
end $$;

-- ===== 0030_bewertung_abmeldungen.sql =====
-- Gäste, die keine Bewertungsanfragen mehr von einem Betrieb wollen
-- (Abmeldelink in jeder Bewertungsmail). Je Betrieb getrennt: wer sich bei
-- Café A abmeldet, hat Café B nichts verboten.
create table if not exists bewertung_abmeldungen (
  organisation_id uuid not null references organisationen(id) on delete cascade,
  email text not null,
  erstellt_at timestamptz not null default now(),
  primary key (organisation_id, email)
);

alter table bewertung_abmeldungen enable row level security;

-- ===== 0031_zeiteintrag_historie.sql =====
-- Arbeitszeiten revisionssicher: jede Anlage, Änderung und Löschung eines
-- Zeiteintrags landet mit altem und neuem Wert in zeiteintrag_historie –
-- per Trigger in der Datenbank, damit kein Codepfad sie umgehen kann.
-- Vorher wurde der Originaleintrag einfach überschrieben, und das
-- Änderungsprotokoll kannte nur den neuen Wert.

alter table zeiteintraege add column if not exists geaendert_von text;

create table if not exists zeiteintrag_historie (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id) on delete cascade,
  -- Bewusst ohne Fremdschlüssel: die Historie bleibt, auch wenn der Eintrag
  -- gelöscht wird.
  zeiteintrag_id uuid not null,
  mitarbeiter_id uuid not null,
  arbeitstag date not null,
  aktion text not null check (aktion in ('angelegt', 'geaendert', 'geloescht')),
  alt jsonb,
  neu jsonb,
  geaendert_von text,
  zeitpunkt timestamptz not null default now()
);

alter table zeiteintrag_historie enable row level security;

create index if not exists zeiteintrag_historie_eintrag_idx on zeiteintrag_historie (organisation_id, zeiteintrag_id, zeitpunkt);

create or replace function zeiteintrag_als_json(z zeiteintraege)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'arbeitstag', z.arbeitstag, 'art', z.art, 'beginn', z.beginn, 'ende', z.ende,
    'pause_minuten', z.pause_minuten, 'notiz', z.notiz
  )
$$;

create or replace function zeiteintrag_historie_schreiben()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into zeiteintrag_historie (organisation_id, zeiteintrag_id, mitarbeiter_id, arbeitstag, aktion, neu, geaendert_von)
    values (new.organisation_id, new.id, new.mitarbeiter_id, new.arbeitstag, 'angelegt', zeiteintrag_als_json(new), new.geaendert_von);
    return null;
  elsif tg_op = 'UPDATE' then
    -- Nur "wer" gesetzt (passiert direkt vor dem Löschen): keine Änderung
    -- der Arbeitszeit, also kein Historieneintrag.
    if zeiteintrag_als_json(old) = zeiteintrag_als_json(new) then
      return null;
    end if;
    insert into zeiteintrag_historie (organisation_id, zeiteintrag_id, mitarbeiter_id, arbeitstag, aktion, alt, neu, geaendert_von)
    values (new.organisation_id, new.id, new.mitarbeiter_id, new.arbeitstag, 'geaendert', zeiteintrag_als_json(old), zeiteintrag_als_json(new), new.geaendert_von);
    return null;
  else
    -- Wird der ganze Betrieb gelöscht, gibt es nichts mehr aufzuheben (und
    -- die Organisation, auf die der Eintrag zeigen müsste, ist schon weg).
    if not exists (select 1 from organisationen where id = old.organisation_id) then
      return null;
    end if;
    insert into zeiteintrag_historie (organisation_id, zeiteintrag_id, mitarbeiter_id, arbeitstag, aktion, alt, geaendert_von)
    values (old.organisation_id, old.id, old.mitarbeiter_id, old.arbeitstag, 'geloescht', zeiteintrag_als_json(old), old.geaendert_von);
    return null;
  end if;
end;
$$;

drop trigger if exists zeiteintrag_historie_trigger on zeiteintraege;
create trigger zeiteintrag_historie_trigger
  after insert or update or delete on zeiteintraege
  for each row execute function zeiteintrag_historie_schreiben();

-- Die Historie selbst ist unveränderlich. Löschen geht nur mit dem ganzen
-- Betrieb (Cascade, die Organisation ist dann schon weg).
create or replace function zeiteintrag_historie_schuetzen()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'Die Historie der Arbeitszeiten ist unveränderlich';
  end if;
  if exists (select 1 from organisationen where id = old.organisation_id) then
    raise exception 'Die Historie der Arbeitszeiten ist unveränderlich';
  end if;
  return old;
end;
$$;

drop trigger if exists zeiteintrag_historie_schutz on zeiteintrag_historie;
create trigger zeiteintrag_historie_schutz
  before update or delete on zeiteintrag_historie
  for each row execute function zeiteintrag_historie_schuetzen();

-- Bestehende Einträge als Ausgangsstand festhalten (nur beim ersten Mal).
insert into zeiteintrag_historie (organisation_id, zeiteintrag_id, mitarbeiter_id, arbeitstag, aktion, neu, geaendert_von, zeitpunkt)
select z.organisation_id, z.id, z.mitarbeiter_id, z.arbeitstag, 'angelegt', zeiteintrag_als_json(z), 'Bestand vor Einführung der Historie', z.erstellt_at
from zeiteintraege z
where not exists (select 1 from zeiteintrag_historie h where h.zeiteintrag_id = z.id);

commit;
