-- Merkt sich, ob die eigene Domain einer Organisation tatsächlich
-- funktioniert (DNS zeigt auf Vercel, Zertifikat da). Erst dann leitet
-- proxy.ts die Plattform-Subdomain dauerhaft auf die eigene Domain um –
-- vorher landeten Gäste sonst auf einer Adresse, die noch nicht erreichbar
-- ist. Gesetzt über "Status prüfen" im Plattform-Admin.
alter table organisationen add column if not exists custom_domain_aktiv boolean not null default false;
