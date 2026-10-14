-- Bestätigungs-/Status-Mails an Kunden sowie Benachrichtigung des Personals
-- bei einer neuen Bestellung (siehe lib/bestellung/email.ts). `gesehen`
-- markiert, ob eine Bestellung im Dashboard schon einmal angezeigt oder
-- bearbeitet wurde – Grundlage für den "Neu"-Marker und die In-App-
-- Benachrichtigung (app/dashboard/BestellBenachrichtigung.tsx), kein
-- Cron-Job nötig, da rein beim Laden/Ändern aktualisiert.

alter table bestellungen add column if not exists gesehen boolean not null default false;

alter table bestell_einstellungen add column if not exists benachrichtigung_email text;
