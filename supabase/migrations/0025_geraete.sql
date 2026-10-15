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
