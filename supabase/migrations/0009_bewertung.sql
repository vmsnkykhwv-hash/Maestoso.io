-- Automatisierte Google-Bewertungsanfrage: sobald die Leitung eine
-- Reservierung als "erschienen" markiert, wird – nur falls aktiviert und
-- eine Google-Bewertungs-URL hinterlegt ist – automatisch eine Mail mit
-- Bitte um Rezension geplant (Resend `scheduledAt`, kein Cron-Job nötig,
-- siehe lib/bewertung/email.ts). Ändert sich der Status danach wieder
-- (z. B. versehentlicher Klick), wird die bereits geplante Mail über
-- dieselbe Resend-ID storniert statt einem No-Show eine Bewertung
-- abzuverlangen.

do $$ begin
  alter type modul_schluessel add value 'bewertung';
exception
  when duplicate_object then null;
end $$;

create table if not exists bewertungsanfrage_einstellungen (
  organisation_id uuid primary key references organisationen(id) on delete cascade,
  aktiv boolean not null default false,
  google_url text,
  verzoegerung_minuten integer not null default 180 check (verzoegerung_minuten >= 0)
);

alter table bewertungsanfrage_einstellungen enable row level security;

alter table reservierungen add column if not exists bewertung_resend_id text;
