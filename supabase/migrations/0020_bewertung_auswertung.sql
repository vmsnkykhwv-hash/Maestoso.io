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
