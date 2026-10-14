-- Ein Schichttausch darf nie still durchlaufen: Nimmt ein Mitarbeiter eine
-- angebotene Schicht an, wird die Schicht NICHT sofort umgeschrieben,
-- sondern die Anfrage wechselt erst auf "angenommen" (wartet auf
-- Bestätigung der Leitung). Erst wenn die Leitung bestätigt, wird die
-- Schicht tatsächlich zugewiesen – vorher soll die Leitung nie von
-- plötzlich auftauchenden, ungeplanten Mitarbeitern überrascht werden.

do $$ begin
  alter type tausch_status add value 'bestaetigt';
exception
  when duplicate_object then null;
end $$;
