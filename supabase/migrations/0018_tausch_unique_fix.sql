-- Die ursprüngliche Sperre galt nur für Status "offen". Seit der
-- zweistufigen Bestätigung (0016) bleibt eine zugesagte, aber noch nicht
-- bestätigte Anfrage auf Status "angenommen" stehen, OHNE dass die Schicht
-- schon umgeschrieben ist – in dieser Zeit konnte für dieselbe Schicht
-- eine zweite "offen"-Anfrage entstehen (die Sperre griff nicht, weil die
-- erste ja nicht mehr "offen" war), die ein zweiter Mitarbeiter annehmen
-- und die Leitung bestätigen konnte – das hätte die erste Bestätigung
-- still überschrieben.

drop index if exists tausch_anfragen_offen_je_schicht_idx;

create unique index if not exists tausch_anfragen_aktiv_je_schicht_idx
  on tausch_anfragen (schicht_id)
  where status in ('offen', 'angenommen');
