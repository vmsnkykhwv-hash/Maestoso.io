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
