-- Ablage von Arbeitsverträgen & Co. pro Mitarbeiter. Anders als
-- website-bilder bewusst ein PRIVATER Bucket (public = false) – Verträge
-- sind sensible Dokumente, keine Marketing-Bilder. Der Download läuft
-- deshalb nie über eine öffentliche/signierte URL, sondern ausschließlich
-- über eine serverseitige Route, die vorher die Leitungs-Session prüft
-- (siehe app/dashboard/zeiterfassung/dokumente/[id]/route.ts).

insert into storage.buckets (id, name, public)
values ('mitarbeiter-dokumente', 'mitarbeiter-dokumente', false)
on conflict (id) do nothing;

create table if not exists mitarbeiter_dokumente (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id) on delete cascade,
  mitarbeiter_id uuid not null references mitarbeiter(id) on delete cascade,
  dateiname text not null,
  storage_pfad text not null,
  groesse_bytes bigint not null,
  hochgeladen_at timestamptz not null default now()
);

alter table mitarbeiter_dokumente enable row level security;

create index if not exists mitarbeiter_dokumente_mitarbeiter_idx on mitarbeiter_dokumente (mitarbeiter_id);
