-- Persönliche Konten mit Passwort und Zwei-Faktor-Anmeldung (TOTP, also
-- Authenticator-App) statt eines geteilten Zugangscodes mit PIN.
--
-- plattform_admins: der Plattform-Betreiber (vorher ein PIN aus der
-- Umgebungsvariable PLATTFORM_ADMIN_PIN – der dient jetzt nur noch einmalig
-- zur Ersteinrichtung des ersten Admin-Kontos).
-- benutzer: Verwaltungskonten eines Betriebs (Inhaber*in und weitere
-- Personen mit vollen Rechten), angemeldet unter <domain-des-betriebs>/team.
--
-- totp_geheimnis ist mit ZWEI_FAKTOR_SCHLUESSEL verschlüsselt (siehe
-- lib/konten/verschluesselung.ts) – ein Datenbank-Leak allein reicht so
-- nicht, um Codes zu erzeugen. Wiederherstellungscodes nur als Hash.
-- sitzung_version: wird bei Passwortänderung oder 2FA-Zurücksetzen erhöht und
-- macht damit alle bestehenden Sitzungen dieses Kontos ungültig.

create table if not exists plattform_admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  passwort_hash text not null,
  totp_geheimnis text,
  totp_aktiv boolean not null default false,
  totp_letzter_schritt bigint,
  wiederherstellungscodes text[] not null default '{}',
  sitzung_version integer not null default 1,
  erstellt_at timestamptz not null default now()
);

alter table plattform_admins enable row level security;

create table if not exists benutzer (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id) on delete cascade,
  email text not null,
  name text not null default '',
  -- null, solange die Einladung noch nicht angenommen wurde
  passwort_hash text,
  totp_geheimnis text,
  totp_aktiv boolean not null default false,
  totp_letzter_schritt bigint,
  wiederherstellungscodes text[] not null default '{}',
  sitzung_version integer not null default 1,
  aktiv boolean not null default true,
  erstellt_at timestamptz not null default now(),
  unique (organisation_id, email)
);

alter table benutzer enable row level security;

create index if not exists benutzer_organisation_idx on benutzer (organisation_id);

-- Einmal-Links für Einladung und "Passwort vergessen" – nur der SHA-256-Hash
-- wird gespeichert, der Link selbst existiert nur in der E-Mail.
create table if not exists konto_tokens (
  id uuid primary key default gen_random_uuid(),
  benutzer_id uuid not null references benutzer(id) on delete cascade,
  zweck text not null check (zweck in ('einladung', 'passwort')),
  token_hash text not null unique,
  ablauf timestamptz not null,
  verwendet_at timestamptz,
  erstellt_at timestamptz not null default now()
);

alter table konto_tokens enable row level security;

-- Der geteilte Zugangscode + PIN je Organisation wird abgelöst (siehe
-- README → "Zugänge & Rollen"); die Spalten bleiben vorerst bestehen,
-- dürfen für neue Organisationen aber leer sein.
alter table organisationen alter column login_code drop not null;
alter table organisationen alter column pin_hash drop not null;
