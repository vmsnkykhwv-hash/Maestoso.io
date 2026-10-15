-- Eingriffe des Plattform-Admins in einen Betrieb (Konto einladen, 2FA
-- zurücksetzen, Konto sperren, Module, Domain) landen im Änderungsprotokoll
-- des Betriebs als "Maestoso-Support". Sonst könnte sich der Admin
-- unbemerkt ein Verwaltungskonto in einem fremden Betrieb anlegen.
alter table aenderungsprotokoll drop constraint if exists aenderungsprotokoll_akteur_art_check;
alter table aenderungsprotokoll
  add constraint aenderungsprotokoll_akteur_art_check
  check (akteur_art in ('inhaber', 'tresen', 'handy', 'support'));
