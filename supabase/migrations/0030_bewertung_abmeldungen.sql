-- Gäste, die keine Bewertungsanfragen mehr von einem Betrieb wollen
-- (Abmeldelink in jeder Bewertungsmail). Je Betrieb getrennt: wer sich bei
-- Café A abmeldet, hat Café B nichts verboten.
create table if not exists bewertung_abmeldungen (
  organisation_id uuid not null references organisationen(id) on delete cascade,
  email text not null,
  erstellt_at timestamptz not null default now(),
  primary key (organisation_id, email)
);

alter table bewertung_abmeldungen enable row level security;
