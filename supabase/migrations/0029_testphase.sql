-- Testphase: 30 Tage kostenlos, danach sperrt der tägliche Cron-Job
-- (app/api/cron/testphase) den Betrieb. Ab der Sperre hat der Kunde
-- 30 Tage Zeit, sich zu entscheiden – danach wird der Betrieb mit allen
-- Daten gelöscht. "aktiv" = Vertrag läuft, keine Fristen mehr.
-- Die Sperre greift auch ohne Cron sofort mit Ablauf von test_bis
-- (lib/testphase/regeln.ts) – der Cron setzt nur Status und Löschfrist und
-- verschickt die Mails.

do $$
begin
  if not exists (
    select 1 from information_schema.columns where table_name = 'organisationen' and column_name = 'vertrag_status'
  ) then
    alter table organisationen
      add column vertrag_status text not null default 'test' check (vertrag_status in ('test', 'aktiv', 'gesperrt')),
      add column test_bis timestamptz default (now() + interval '30 days'),
      add column loeschung_am timestamptz,
      add column erinnerung_test_gesendet boolean not null default false,
      add column erinnerung_loeschung_gesendet boolean not null default false;

    -- Nur beim ersten Einspielen: bestehende Betriebe testen ab ihrer
    -- Anlage, aber noch mindestens 7 Tage ab heute – niemand soll durch die
    -- Migration selbst überraschend gesperrt werden.
    update organisationen set test_bis = greatest(erstellt_at + interval '30 days', now() + interval '7 days');
  end if;
end $$;
