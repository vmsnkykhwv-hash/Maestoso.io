-- Founding Partner: die ersten drei Pilotbetriebe mit reduzierter
-- Einrichtung (lib/preise.ts). Der Plattform-Admin markiert sie am Betrieb;
-- die Website zählt daraus die noch freien Plätze.
alter table organisationen add column if not exists founding_partner boolean not null default false;

-- Bewerbungen kommen über das Anfrageformular, mit gewünschtem Paket.
alter table anfragen add column if not exists paket text check (paket in ('basic', 'plus', 'full'));
alter table anfragen drop constraint if exists anfragen_art_check;
alter table anfragen add constraint anfragen_art_check check (art in ('demo', 'frage', 'sonstiges', 'founding_partner'));
