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
