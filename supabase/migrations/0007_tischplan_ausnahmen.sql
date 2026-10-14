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
