-- Schließt die Race-Condition zwischen Kapazitätsprüfung und tatsächlichem
-- Anlegen: zwei nahezu gleichzeitige Gäste (z. B. zwei Browser-Tabs oder ein
-- Skript) könnten sonst beide den letzten freien Tisch/Bestellslot
-- bekommen, weil Prüfung (lib/tischplan/regeln.ts bzw.
-- lib/bestellung/regeln.ts) und das anschließende Anlegen zwei getrennte
-- Anfragen sind.
--
-- Die volle Geschäftslogik (Öffnungszeiten, Feiertage, Kanal-Pausen,
-- Vorlaufzeit) bleibt bewusst in TypeScript – sie dorthin zu verlagern wäre
-- mit deutlich höherem Risiko verbunden, dieselbe Logik beim Portieren neu
-- kaputtzumachen, als das eigentliche Problem wert ist. Hier wird
-- ausschließlich der Kapazitäts-Zähler (die einzige Stelle, an der zwei
-- parallele Anfragen tatsächlich kollidieren können) ein zweites Mal, unter
-- einem Advisory-Lock, unmittelbar vor dem Insert geprüft. Der Lock ist
-- transaktionsgebunden (pg_advisory_xact_lock) und wird am Ende der
-- Funktion automatisch freigegeben, kein manuelles Unlock nötig.

create or replace function reservierung_mit_pruefung_erstellen(
  p_organisation_id uuid,
  p_name text,
  p_email text,
  p_anzahl_personen integer,
  p_datum date,
  p_uhrzeit time,
  p_dauer_minuten integer,
  p_gesamt_tische integer,
  p_max_personen_gleichzeitig integer,
  p_erinnerung boolean,
  p_notiz text
) returns reservierungen
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ende time;
  v_belegte_tische integer;
  v_belegte_personen integer;
  v_row reservierungen;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_organisation_id::text || p_datum::text, 0));

  v_ende := p_uhrzeit + make_interval(mins => p_dauer_minuten);

  -- Dieselbe Überschneidungslogik wie belegungFuerSlot() in
  -- lib/tischplan/regeln.ts: ein Tisch zählt als belegt, wenn sich sein
  -- Reservierungsfenster mit [p_uhrzeit, v_ende) überschneidet.
  select coalesce(count(*), 0), coalesce(sum(anzahl_personen), 0)
    into v_belegte_tische, v_belegte_personen
  from reservierungen
  where organisation_id = p_organisation_id
    and datum = p_datum
    and status not in ('storniert', 'nicht_erschienen')
    and uhrzeit < v_ende
    and p_uhrzeit < (uhrzeit + make_interval(mins => p_dauer_minuten));

  select v_belegte_tische + coalesce(sum(anzahl_tische), 0)
    into v_belegte_tische
  from blockierungen
  where organisation_id = p_organisation_id
    and datum = p_datum
    and start_zeit < v_ende
    and p_uhrzeit < end_zeit;

  if v_belegte_tische >= p_gesamt_tische then
    raise exception 'KAPAZITAET_TISCHE';
  end if;

  if v_belegte_personen + p_anzahl_personen > p_max_personen_gleichzeitig then
    raise exception 'KAPAZITAET_PERSONEN';
  end if;

  insert into reservierungen (organisation_id, name, email, anzahl_personen, datum, uhrzeit, erinnerung, notiz)
  values (p_organisation_id, p_name, p_email, p_anzahl_personen, p_datum, p_uhrzeit, p_erinnerung, p_notiz)
  returning * into v_row;

  return v_row;
end;
$$;

-- Gleiches Prinzip für Online-Bestellungen: nur die "wie viele Bestellungen
-- sind in diesem Kanal gerade offen"-Zählung (offeneAnzahl() in
-- lib/bestellung/regeln.ts) läuft hier ein zweites Mal unter Lock; Insert
-- von Bestellung + Positionen gemeinsam in einer Transaktion ersetzt das
-- bisherige "anlegen, bei Positionsfehler wieder löschen" in
-- bestellungErstellen().
create or replace function bestellung_mit_pruefung_erstellen(
  p_organisation_id uuid,
  p_kanal bestell_kanal,
  p_name text,
  p_telefon text,
  p_email text,
  p_adresse text,
  p_datum date,
  p_uhrzeit time,
  p_notiz text,
  p_gesamt_preis numeric,
  p_max_offen integer,
  p_positionen jsonb
) returns bestellungen
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offene_anzahl integer;
  v_row bestellungen;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_organisation_id::text || p_datum::text || p_kanal::text, 0));

  if p_max_offen is not null then
    select count(*) into v_offene_anzahl
    from bestellungen
    where organisation_id = p_organisation_id
      and datum = p_datum
      and kanal = p_kanal
      and status not in ('abgeschlossen', 'storniert');

    if v_offene_anzahl >= p_max_offen then
      raise exception 'KAPAZITAET_OFFEN';
    end if;
  end if;

  insert into bestellungen (organisation_id, kanal, name, telefon, email, adresse, datum, uhrzeit, notiz, gesamt_preis)
  values (p_organisation_id, p_kanal, p_name, p_telefon, p_email, p_adresse, p_datum, p_uhrzeit, p_notiz, p_gesamt_preis)
  returning * into v_row;

  insert into bestellpositionen (bestellung_id, name, preis, menge, notiz)
  select v_row.id, (pos ->> 'name')::text, (pos ->> 'preis')::numeric, (pos ->> 'menge')::integer, pos ->> 'notiz'
  from jsonb_array_elements(p_positionen) as pos;

  return v_row;
end;
$$;
