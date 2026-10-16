-- Arbeitszeiten revisionssicher: jede Anlage, Änderung und Löschung eines
-- Zeiteintrags landet mit altem und neuem Wert in zeiteintrag_historie –
-- per Trigger in der Datenbank, damit kein Codepfad sie umgehen kann.
-- Vorher wurde der Originaleintrag einfach überschrieben, und das
-- Änderungsprotokoll kannte nur den neuen Wert.

alter table zeiteintraege add column if not exists geaendert_von text;

create table if not exists zeiteintrag_historie (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id) on delete cascade,
  -- Bewusst ohne Fremdschlüssel: die Historie bleibt, auch wenn der Eintrag
  -- gelöscht wird.
  zeiteintrag_id uuid not null,
  mitarbeiter_id uuid not null,
  arbeitstag date not null,
  aktion text not null check (aktion in ('angelegt', 'geaendert', 'geloescht')),
  alt jsonb,
  neu jsonb,
  geaendert_von text,
  zeitpunkt timestamptz not null default now()
);

alter table zeiteintrag_historie enable row level security;

create index if not exists zeiteintrag_historie_eintrag_idx on zeiteintrag_historie (organisation_id, zeiteintrag_id, zeitpunkt);

create or replace function zeiteintrag_als_json(z zeiteintraege)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'arbeitstag', z.arbeitstag, 'art', z.art, 'beginn', z.beginn, 'ende', z.ende,
    'pause_minuten', z.pause_minuten, 'notiz', z.notiz
  )
$$;

create or replace function zeiteintrag_historie_schreiben()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into zeiteintrag_historie (organisation_id, zeiteintrag_id, mitarbeiter_id, arbeitstag, aktion, neu, geaendert_von)
    values (new.organisation_id, new.id, new.mitarbeiter_id, new.arbeitstag, 'angelegt', zeiteintrag_als_json(new), new.geaendert_von);
    return null;
  elsif tg_op = 'UPDATE' then
    -- Nur "wer" gesetzt (passiert direkt vor dem Löschen): keine Änderung
    -- der Arbeitszeit, also kein Historieneintrag.
    if zeiteintrag_als_json(old) = zeiteintrag_als_json(new) then
      return null;
    end if;
    insert into zeiteintrag_historie (organisation_id, zeiteintrag_id, mitarbeiter_id, arbeitstag, aktion, alt, neu, geaendert_von)
    values (new.organisation_id, new.id, new.mitarbeiter_id, new.arbeitstag, 'geaendert', zeiteintrag_als_json(old), zeiteintrag_als_json(new), new.geaendert_von);
    return null;
  else
    -- Wird der ganze Betrieb gelöscht, gibt es nichts mehr aufzuheben (und
    -- die Organisation, auf die der Eintrag zeigen müsste, ist schon weg).
    if not exists (select 1 from organisationen where id = old.organisation_id) then
      return null;
    end if;
    insert into zeiteintrag_historie (organisation_id, zeiteintrag_id, mitarbeiter_id, arbeitstag, aktion, alt, geaendert_von)
    values (old.organisation_id, old.id, old.mitarbeiter_id, old.arbeitstag, 'geloescht', zeiteintrag_als_json(old), old.geaendert_von);
    return null;
  end if;
end;
$$;

drop trigger if exists zeiteintrag_historie_trigger on zeiteintraege;
create trigger zeiteintrag_historie_trigger
  after insert or update or delete on zeiteintraege
  for each row execute function zeiteintrag_historie_schreiben();

-- Die Historie selbst ist unveränderlich. Löschen geht nur mit dem ganzen
-- Betrieb (Cascade, die Organisation ist dann schon weg).
create or replace function zeiteintrag_historie_schuetzen()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'Die Historie der Arbeitszeiten ist unveränderlich';
  end if;
  if exists (select 1 from organisationen where id = old.organisation_id) then
    raise exception 'Die Historie der Arbeitszeiten ist unveränderlich';
  end if;
  return old;
end;
$$;

drop trigger if exists zeiteintrag_historie_schutz on zeiteintrag_historie;
create trigger zeiteintrag_historie_schutz
  before update or delete on zeiteintrag_historie
  for each row execute function zeiteintrag_historie_schuetzen();

-- Bestehende Einträge als Ausgangsstand festhalten (nur beim ersten Mal).
insert into zeiteintrag_historie (organisation_id, zeiteintrag_id, mitarbeiter_id, arbeitstag, aktion, neu, geaendert_von, zeitpunkt)
select z.organisation_id, z.id, z.mitarbeiter_id, z.arbeitstag, 'angelegt', zeiteintrag_als_json(z), 'Bestand vor Einführung der Historie', z.erstellt_at
from zeiteintraege z
where not exists (select 1 from zeiteintrag_historie h where h.zeiteintrag_id = z.id);
