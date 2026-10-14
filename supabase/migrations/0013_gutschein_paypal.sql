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
