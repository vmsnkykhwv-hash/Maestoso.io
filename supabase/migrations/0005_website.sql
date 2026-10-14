-- Website-Modul: eine öffentliche Marketing-Seite pro Organisation (Hero,
-- Über uns, Speisekarte, Tagesmenü, Galerie, eingebettetes Buchungsformular)
-- plus Domain-Zuordnung. Jede Organisation bekommt bei Anlage automatisch
-- eine Plattform-Subdomain (z. B. cafedoa.serviceflow.app); eine eigene
-- Domain (z. B. cafedoa.de) ist optional nachrüstbar, sobald der Kunde sie
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
