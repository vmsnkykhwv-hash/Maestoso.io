-- Die Google-Bewertungsanfrage lief bisher nur über Reservierungen
-- (Tischplan, "Erschienen"). Jetzt zusätzlich über abgeschlossene
-- Online-Bestellungen – gleiches Prinzip, eigene Resend-ID-Spalte, damit
-- eine spätere Statusänderung die bereits geplante Mail unabhängig von
-- Reservierungen stornieren kann.

alter table bestellungen add column if not exists bewertung_resend_id text;
