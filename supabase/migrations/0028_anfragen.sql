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
