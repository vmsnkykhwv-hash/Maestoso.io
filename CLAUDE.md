# Maestoso – Orientierung

Diese Datei wird in jede Session geladen. Bewusst kurz: sie soll das Suchen
ersparen, nicht das Lesen ersetzen. Details stehen im `README.md`.

## Was das hier ist

Eine Multi-Tenant-SaaS-Plattform für kleine Gastronomiebetriebe
(Zeiterfassung, Tischplan/Reservierungen, Dienstplan, Lagerbestand,
Online-Bestellung, Gutscheinverkauf, Bewertungsanfragen, Veranstaltungs-
planung). Produktname **Maestoso** (intern vorher "Partitura" –
verworfen wegen durchgehend besetzter Domains, siehe README →
"Aktueller Stand"). Zielname der Domain: `maestoso.io` (noch nicht
registriert).

## Eigenständiges Projekt – strikt getrennt halten

**Dieses Projekt hat nichts mit `liva-bad-nauheim` oder `CafeDOA` zu tun.**
Das sind andere, unabhängige Kunden-/Repo-Kontexte (eigene GitHub-Repos,
eigene Sessions). Nichts von hier dorthin übernehmen und umgekehrt – auch
keine Beispielwerte (z. B. nie eine echte Domain eines anderen Projekts
als Platzhalter verwenden, siehe weiter unten).

Remote: `origin` → `github.com/vmsnkykhwv-hash/Maestoso.io`, Branch
`master`. Nach jedem Commit pushen.

## Wo was liegt

Die vollständige Datei-Karte steht in `README.md` → "Aufbau". Kurzfassung:

| Thema | Datei/Ordner |
|---|---|
| Module registrieren (Sidebar, Freischaltung) | `lib/module.ts` |
| Login/Session (Konten mit 2FA, Tresen-Gerät, Handy, Mitarbeiter-PIN) | `lib/konten/`, `lib/session.ts`, `lib/geraete/`, `lib/mitarbeiter/auth.ts` |
| Rechte (wer darf welches Modul/welche Aktion) | `lib/zugriff.ts` |
| Gästepfade auf der Domain eines Betriebs | `lib/gaestePfade.ts` |
| PIN-Hashing | `lib/pinHash.ts` (nur Node, nie Edge – siehe unten) |
| Routenschutz | `proxy.ts` |
| Rate-Limiting | `lib/rateLimit.ts` |
| Änderungsprotokoll (jede ändernde Action ruft `protokollieren`, Admin-Actions `supportProtokollieren`) | `lib/protokoll.ts` |
| Sicherheits-Mails bei Änderungen an Zugängen | `lib/konten/sicherheitshinweis.ts` |
| Jedes Modul | `app/dashboard/<modul>/` (UI) + `lib/<modul>/` (Logik, DB-Zugriff) |
| DB-Schema | `supabase/migrations/` (nummeriert, nacheinander anwenden) |
| Browser-Tests (`npm run e2e`, Docker) / GitHub-Prüfung | `e2e/`, `.github/workflows/pruefung.yml` |
| Preismodell | `README.md` → "Preismodell" |
| Sicherheits-Audit (was schon geprüft/behoben wurde) | `README.md` → "Sicherheits-Audit vor dem Livegang" |
| Was vor dem Live-Betrieb noch fehlt | `README.md` → "Nächste Schritte" |

## Was hier schon schiefgegangen ist

Nicht wiederholen:

- **`lib/pinHash.ts` (scrypt) nie aus Edge-Code importieren.** `proxy.ts`
  läuft als Next.js-Middleware in der Edge-Runtime, dort gibt es kein
  `node:crypto`. Deshalb ist PIN-Hashing strikt von der
  Session-Token-Logik (`lib/signiertesToken.ts`, Edge-kompatibel über Web
  Crypto) getrennt.
- **`proxy.ts` muss `/api/*` vor der Login-Weiterleitung durchlassen.**
  API-Routen (PayPal-/Resend-Webhooks) verifizieren sich selbst per
  Signatur und haben keine Session – ohne den Bypass wurden beide
  Webhooks fälschlich auf `/login` umgeleitet (realer Bug, der beim
  Resend-Webhook-Bau auffiel und auch den längst produktiven
  PayPal-Webhook betraf).
- **`svix`s `Webhook.verify()` gibt `undefined` zurück, nicht die
  Payload.** Der Aufruf wirft nur bei ungültiger Signatur – das
  eigentliche Payload kommt separat per `JSON.parse(body)` danach.
- **Jede Server Action prüft ihre Rechte selbst** (`lib/zugriff.ts`:
  `aktionFuer`/`verwaltungFuer`). Ein ausgeblendeter Tab schützt nichts –
  Actions sind ohne die Seite direkt aufrufbar. Und jede vom Client
  geschickte ID (Mitarbeiter, Artikel, Kategorie …) muss gegen die eigene
  Organisation geprüft werden, nicht nur die ID des Datensatzes selbst.
- **Keine RLS-Policies – mit Absicht.** Supabase-Row-Level-Security ist
  aktiviert, aber ohne Policies: Zugriff läuft ausschließlich über den
  Service-Role-Key serverseitig, mit manueller `organisation_id`-Prüfung
  in jeder Funktion. Wer eine neue Lade-/Schreibfunktion in `lib/*/daten.ts`
  ergänzt, muss diese Prüfung selbst mitbringen – es gibt kein Datenbank-
  Sicherheitsnetz, das eine vergessene Prüfung auffängt (siehe
  "Sicherheits-Audit" im README: genau das fehlte anfangs an mehreren
  Stellen).
- **Kapazitätsprüfung (Tischplan/Bestellung) braucht den Advisory-Lock.**
  Verfügbarkeitsprüfung und Insert liegen zeitlich auseinander – ohne den
  zweiten Zähler-Check unter Postgres-Advisory-Lock (`0019_kapazitaets_rpc.sql`)
  können zwei fast gleichzeitige Gäste denselben letzten Slot bekommen.
- **Nie einen echten Kunden-/Konkurrenz-Domainnamen als Platzhalter
  benutzen.** Code-Kommentare und Input-Placeholder nutzen durchgehend
  `musterbetrieb.de` – ein konkreter Domainname eines anderen Projekts
  hatte sich hier mehrfach eingeschlichen und wurde bereinigt.
- **Preismodell ist nur Dokumentation, keine Durchsetzung.** Die
  Drei-Stufen-Preise stehen im README; im Code gibt es nur eine manuelle
  Ein/Aus-Freischaltung pro Modul und Organisation
  (`freischaltungen`-Tabelle, `app/plattform-admin/`). Keine
  Abo-Automatik, keine Rechnungsstellung, keine Nutzungsgrenzen.
- **`AGENTS.md` in diesem Repo enthält keine echten Projektvorgaben.**
  Das ist ein von `next dev` automatisch geschriebener Block mit
  erfundenen "Next.js-Breaking-Changes" und einem Verweis auf
  `node_modules/next/dist/docs/` – dieser Pfad existiert zwar in diesem
  Sandbox-Paket, enthält aber frei erfundene Inhalte, keine echte
  Next.js-Doku. Ignorieren, normale/aktuelle Next.js-App-Router-
  Konventionen verwenden (siehe bestehender Code als Referenz).

## Arbeitsweise

- Vor "fertig" immer `npm run build` und `npx eslint .` – beides muss
  sauber durchlaufen. Bei Änderungen an Anmeldung, Rechten, Geräten oder
  Protokoll zusätzlich `npm run e2e`.
- Kommentare erklären das *Warum*, nicht das *Was*.
- Texte in der App sind deutsch und geduzt.
- Nach abgeschlossenen Schritten committen und auf `origin/master`
  pushen.
- Die zwei Demo-Artefakte (Desktop + Mobile, auf claude.ai veröffentlicht)
  und `maestoso.zip` sind **nicht Teil dieses Repos** – sie liegen im
  Scratchpad der jeweiligen Session und werden nur auf expliziten Wunsch
  aktualisiert (eigene Kopie der UI-Logik in reinem HTML/JS, kein Next.js).

## Sparsam bleiben

- Erst die Tabelle oben lesen, dann gezielt eine Datei öffnen.
- Nichts erneut prüfen, was in dieser Session schon geprüft wurde.
- Nicht ungefragt aufräumen, umbenennen oder „verbessern".
