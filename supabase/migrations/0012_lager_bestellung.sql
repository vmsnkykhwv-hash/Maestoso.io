-- Lagerbestand: statt eines Mengenwunsches (der die Bestellmenge vorwegnahm)
-- trägt die Prüfung jetzt immer einen aktuellen Bestand ein, unabhängig vom
-- "Nachbestellen"-Haken – die Entscheidung über die Bestellmenge bleibt bei
-- der Leitung. Dafür bekommt jeder Eintrag zwei neue, von der Leitung
-- gepflegte Felder: `bestellmenge` (was tatsächlich bestellt werden soll)
-- und `bestellt` (true, sobald die Bestellung tatsächlich per Mail
-- rausgegangen ist – siehe app/dashboard/lager/BestellungUebersicht.tsx).
-- Ein als "nachbestellen" markierter, aber noch nicht bestellter Eintrag
-- taucht dort gruppiert nach Lieferant auf.

alter table bestandspruefung_eintraege rename column menge_wunsch to aktueller_bestand;
alter table bestandspruefung_eintraege add column if not exists bestellt boolean not null default false;
alter table bestandspruefung_eintraege add column if not exists bestellmenge text;

-- Zusätzliche Lieferanten-Felder für die automatisch vorbereitete
-- Bestell-Mail (lib/lager/email.ts) – beide optional, viele Lieferanten
-- erwarten aber eine Kundennummer in der Bestellung.
alter table lieferanten add column if not exists ansprechpartner text;
alter table lieferanten add column if not exists kundennummer text;
