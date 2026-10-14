-- Generische Versuchszähler-Tabelle fürs Login-Rate-Limiting (siehe
-- lib/rateLimit.ts) – ein Schlüssel kann ein Zugangscode, eine
-- Organisation-ID oder ein fester Name wie 'plattform-admin' sein. Ohne
-- diese Sperre waren alle drei PIN-Arten (Organisation, Mitarbeiter,
-- Plattform-Admin) beliebig oft durchprobierbar.

create table if not exists login_versuche (
  schluessel text primary key,
  fehlversuche integer not null default 0,
  letzter_versuch timestamptz not null default now(),
  gesperrt_bis timestamptz
);

alter table login_versuche enable row level security;
