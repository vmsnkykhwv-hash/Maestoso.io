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
