# Maestoso

Zentrale Mandanten-Plattform (Arbeitsname bis zur Technik-Fertigstellung:
"Serviceflow Plattform", im Code/Repo-Namen noch sichtbar): ein Login, über
den jeder Kunde ("Organisation") seine Tools sieht – freigeschaltet oder als
Demo mit echten, aber unfreigeschalteten Testdaten. Gedacht sowohl als
laufendes Produkt für zahlende Kunden als auch als Vorführ-Tool im
Verkaufsgespräch.

Markenrichtung "Konzertsaal" (dunkles Tintenblau + Gold auf warmem
Creme-Papier, Fraunces/Manrope) ist mit dem Kunden abgestimmt und im echten
Projekt umgesetzt (Design-Tokens in `app/globals.css`, Sidebar-Navigation
in `components/Sidebar.tsx`/`DashboardShell.tsx`). Der Name "Maestoso"
(vorher "Partitura" – verworfen, weil .de/.com/.app/.io durchgehend
besetzt waren) ist markenrechtlich geprüft (EUIPO + DPMA, Klassen 09/42:
keine aktive Marke in Software-relevanten Klassen) und die Domain
`maestoso.io` ist frei.

## Zugänge & Rollen

- **Plattform-Admin** (du): unter `<plattform-domain>/login` mit E-Mail,
  Passwort und Authenticator-App (TOTP). Legt Organisationen an, lädt die
  Inhaberin bzw. den Inhaber ein, schaltet Module frei, verwaltet Domains und
  setzt bei verlorenem Handy die 2FA eines Kontos zurück.
- **Inhaber*in / Verwaltungskonto eines Betriebs**: unter der Adresse des
  Betriebs, `<domain-des-betriebs>/team` (lokal `/team/<organisationId>`),
  mit E-Mail, Passwort und Authenticator-App. Kommt per Einladungslink zum
  Konto, kann weitere Verwaltungskonten einladen („Zugänge & Geräte“ im
  Dashboard), auch von zu Hause. Einen geteilten Zugangscode gibt es nicht
  mehr – die Adresse sagt, um welchen Betrieb es geht.
- **Tresen-Gerät**: Tablet/Kasse im Laden, einmal von einem Verwaltungskonto
  freigegeben („Zugänge & Geräte“ → „Dieses Gerät als Tresen freigeben“),
  danach dauerhaft angemeldet (Cookie `maestoso_geraet`, Tabelle `geraete`).
  Benutzbar erst nach Mitarbeiter-PIN, nach 10 Minuten ohne Eingabe wieder
  gesperrt. Nur hier laufen Tagesgeschäft (Reservierungen, Bestellungen inkl.
  Schnellpause, Gutscheine einlösen, Veranstaltungen, Lager-Prüfungen) und das
  Erfassen der Arbeitszeit.
- **Mitarbeiter-Handy**: per QR-Code (15 Minuten gültig) + eigener PIN
  gekoppelt. Sieht nur Dienstplan (wer arbeitet wann), eigene Verfügbarkeit,
  Tauschbörse und die eigenen Zeiten zum Ansehen. Entkoppeln vom Handy selbst
  oder Entziehen durch die Inhaberin wirkt sofort.
- **Freischaltung je Tool**: welche Module eine Mitarbeiterin am Tresen bzw.
  auf dem Handy sieht (`mitarbeiter.module`, „Zugänge & Geräte“). Website und
  Bewertungsanfragen sind reine Verwaltung.
- **Nur Verwaltungskonto**: Einstellungen, Auswertungen, Personal (anlegen,
  PIN, Dokumente), Dienstplan planen/Tausch bestätigen, Lieferanten/Artikel/
  Bestellen, Exporte, Website, Bewertungen, Rechtliches, Zugänge. Die
  Mitarbeiter-Rolle „Leitung“ gibt keine Rechte mehr.
- Prüfung zentral in `lib/zugriff.ts` (`seiteFuer`, `aktionFuer`,
  `verwaltungFuer`) auf Basis von `getBetriebsSitzung()` (`lib/session.ts`) –
  jede Seite und jede Server Action prüft selbst, ausgeblendete Knöpfe allein
  schützen nichts. Migration `0025`.
- Ohne zweiten Faktor gibt es keine Sitzung, auch nicht beim ersten Mal
  (2FA-Einrichtung ist Teil der Anmeldung). Wiederherstellungscodes für ein
  verlorenes Handy, „Passwort vergessen“ per Mail-Link, Passwortänderung
  meldet alle anderen Geräte ab (`sitzung_version`).
- Sitzungen gelten nur auf der Domain, auf der sie entstanden sind, und nur
  für genau diesen Betrieb (`proxy.ts` + `lib/session.ts`).
- Technik: `lib/konten/` (Passwort, TOTP, Verschlüsselung der TOTP-Geheimnisse
  mit `ZWEI_FAKTOR_SCHLUESSEL`, Wiederherstellungscodes, Einladungen),
  Anmeldeablauf in `lib/konten/anmeldung.ts`, Oberfläche in
  `components/anmeldung/`, Migration `0024`.

Ein nicht freigeschaltetes Modul ist nicht gesperrt im Sinne von
unsichtbar – die Organisation sieht und nutzt das echte Modul, nur mit
einem Demo-Banner oben. Schaltet der Plattform-Admin später frei,
verschwindet nur der Banner; an den Daten ändert sich nichts.

## Aktueller Stand

Dieses Repo enthält das **Grundgerüst** (Login, Organisationen anlegen,
Freischaltungen umschalten, Dashboard mit Modul-Kacheln) sowie als erstes
echtes Modul die **Zeiterfassung** – Geschäftsregeln (Stunden-Limits je
Mitarbeitertyp, Auto-Pause ab 360 Minuten, Leitung ausgenommen) 1:1 aus
`zeiterfassung-liva-bad-nauheim` übernommen, aber mandantenfähig: alle
Tabellen tragen `organisation_id`, und Mitarbeiter melden sich statt mit
einem eigenen Supabase-Auth-Account mit einer Mitarbeiter-PIN innerhalb
der bereits angemeldeten Organisation an (eigenes, leichtgewichtiges
Session-Cookie neben der Organisations-Session).

Als zweites echtes Modul ist **Tischplan & Reservierungen** dazugekommen –
die Buchungsregeln (Öffnungsfenster Mo–Sa/So-Feiertag, 180-Minuten-Dauer,
60 Minuten Vorlauf, 1–7 Personen online) aus `liva-bad-nauheim`
übernommen, aber bewusst nicht 1:1 kopiert: Das Original hatte weder eine
Migration noch RLS noch eine echte Mitarbeiter-Ansicht (nur ein
Gast-Buchungsformular ohne Personal-Verwaltung) und berechnete
Verfügbarkeit einmal im Browser und einmal im Server dupliziert. Hier gibt
es stattdessen echte, benannte Tische pro Organisation, eine einzige
serverseitige Verfügbarkeitsprüfung (`lib/tischplan/regeln.ts`) für Gast-
und Personal-Buchung gleichermaßen, sowie eine öffentliche, nicht
eingeloggte Buchungsseite (`/reservieren/[organisationId]`), die jede
Organisation auf ihrer eigenen Website verlinken kann.

Als drittes echtes Modul ist **Dienstplan & Schichtplanung** dazugekommen –
Vorausplanung der Schichten, getrennt von der Ist-Zeiterfassung. Nutzt
dieselben Mitarbeiter wie die Zeiterfassung (keine eigene
Mitarbeiter-Tabelle, kein eigener PIN-Login): die Mitarbeiter-Sitzung ist
mit diesem Modul modulübergreifend geworden (siehe `lib/mitarbeiter/`,
unten) – wer sich einmal mit PIN anmeldet, ist in beiden Modulen
angemeldet. Mitarbeiter tragen ihre Verfügbarkeit ein, die Leitung plant
Schichten (inkl. Hinweis, wer an einem Tag nicht verfügbar ist) und jede
Schicht kann zum Tausch angeboten werden – ein anderer Mitarbeiter kann
zusagen (mit derselben Konfliktprüfung wie bei der manuellen Zuweisung
durch die Leitung), aber die Schicht wird dabei bewusst **nicht** sofort
umgeschrieben: Die Anfrage wechselt erst auf "Wartet auf Bestätigung",
sichtbar in der Tauschbörse. Nur die Leitung kann den Tausch bestätigen
(prüft dabei den Dienstplan des Zielmitarbeiters ein zweites Mal, falls
sich seitdem etwas geändert hat) oder ablehnen – ein Tausch darf nie
still durchlaufen, sonst taucht am Tag selbst ein ungeplanter Mitarbeiter
auf, ohne dass die Leitung je davon erfahren hat.

Als viertes echtes Modul ist **Website** dazugekommen – eine öffentliche
Marketing-Seite pro Organisation (Hero, Über uns, Tagesmenü, Speisekarte,
Galerie, eingebettetes Buchungsformular, Öffnungszeiten) mit eigener
CMS-Ansicht im Dashboard. Jede Organisation bekommt bei Anlage automatisch
eine Plattform-Subdomain (`<slug>.<NEXT_PUBLIC_PLATTFORM_DOMAIN>`); eine
eigene Domain lässt sich später nachrüsten, sobald der Kunde sie besitzt
(DNS-Eintrag beim Kunden, Freischaltung im Hosting-Projekt – beides
manuelle Schritte, siehe unten). Öffnungszeiten werden nicht dupliziert:
Die Website liest dieselbe `reservierung_einstellungen`-Zeile wie der
Tischplan – ändert die Leitung dort die Zeiten, zeigt die Website sofort
die neuen.

Als fünftes echtes Modul ist **Lagerbestand & Wareneinkauf** dazugekommen –
bewusst **keine Mengenbuchhaltung**: Ohne Kassenanbindung (die Plattform
hat explizit keine Kasse) würde ein "exakter Bestand" sofort
auseinanderlaufen, weil Verkäufe nie automatisch abgezogen werden. Statt
dessen ein Rhythmus entlang des tatsächlichen Bestellzyklus pro
Lieferanten (z. B. "wöchentlich dienstags" oder "monatlich am 1."):
kurz vor dem Bestelltag wird eine Bestandsprüfung fällig und automatisch
der Person zugewiesen, die laut Dienstplan an diesem Tag arbeitet (direkte
Wiederverwendung der `schichten`-Daten aus dem Dienstplan-Modul, keine
eigene Zuweisungslogik). Die Prüfung selbst ist nur ein Ja/Nein
"nachbestellen" je Artikel plus Mengenwunsch – kein Zähl-Anspruch. Es gibt
keinen Cron-Job in diesem Projekt: fällige Prüfungen werden "on the fly"
erkannt und angelegt, sobald jemand das Modul öffnet.

Danach folgten drei gezielte Erweiterungen bestehender Module:

- **Tischplan – tagesgenaue Ausnahmen von den Öffnungszeiten**: In den
  Einstellungen lässt sich für ein einzelnes Datum (z. B. Heiligabend,
  Inventur) eine abweichende Öffnungszeit hinterlegen oder der Tag ganz
  schließen – ohne die regulären Öffnungszeiten anzufassen. Geprüft wird
  das zentral in `lib/tischplan/regeln.ts` (`oeffnungsfenster()`), noch vor
  der regulären Wochentagslogik, und gilt dadurch identisch für die
  Gäste-Buchungsseite und die manuelle Buchung durchs Personal.
- **Dienstplan – Team-Verfügbarkeit einsehen und Zuweisung daran koppeln**:
  Ein eigener Tab "Team-Verfügbarkeit" (nur für die Leitung) zeigt pro
  Woche, wer sich verfügbar/nicht verfügbar eingetragen hat. Gleichzeitig
  blendet die Schichtzuweisung (neue Schicht wie Umbesetzung) Mitarbeiter,
  die für den jeweiligen Tag als nicht verfügbar eingetragen sind, aus der
  Auswahl aus – eine bereits bestehende Zuweisung bleibt davon ausgenommen
  sichtbar, falls jemand nachträglich auf nicht verfügbar wechselt.
- **Dienstplan – Schichten bearbeiten statt nur löschen/neu anlegen**: Die
  Leitung kann Beginn, Ende und Notiz einer bestehenden Schicht direkt
  ändern (nutzt dieselbe `schichtAktualisierenAktion`/Konfliktprüfung wie
  die Zuweisung), statt sie löschen und neu eintragen zu müssen.

Als sechstes echtes Modul ist **Online-Bestellung** (Abholung/Lieferung)
dazugekommen – nutzt die Speisekarte des Website-Moduls direkt weiter,
keine eigene Gerichte-Tabelle (`bestellpositionen` speichert nur einen
Namens-/Preis-Snapshot zum Bestellzeitpunkt). Abholung und Lieferung sind
einzeln ein-/ausschaltbar und zeitlich enger fassbar als die Öffnungszeiten
– niemals weiter: `lib/bestellung/regeln.ts` bildet dafür die Schnittmenge
aus dem konfigurierten Kanal-Fenster und `oeffnungsfenster()` aus dem
Tischplan-Modul (inklusive dessen tagesgenauer Ausnahmen), statt eine
eigene, zweite Zeitrechnung zu pflegen. Schutzmechanismus gegen
Selbstüberschätzung (wie bei Lieferando & Co.): eine befristete
Schnellpause je Kanal (läuft ohne Cron-Job automatisch wieder ab) und eine
optionale Obergrenze gleichzeitig offener Bestellungen je Kanal – ist die
erreicht, bietet die Online-Seite von selbst keine weiteren Zeiten mehr an.
Die öffentliche Bestellseite (`/bestellen/[organisationId]`) ist zugleich
im Website-Modul eingebettet und erscheint dort nur, solange mindestens ein
Kanal tatsächlich aktiv ist – schaltet die Leitung beides ab oder pausiert
beide, verschwindet der Bestellen-Bereich von der Website, ohne dass dort
etwas manuell angepasst werden müsste.

Als siebtes echtes Modul ist die **automatisierte Google-Bewertungsanfrage**
dazugekommen (vorgezogen vor dem Gutschein-Verkauf, siehe "Nächste
Schritte"). Markiert die Leitung im Tischplan eine Reservierung als
"Erschienen" **oder** eine Online-Bestellung als "Abgeschlossen" (Migration
`0015` ergänzt dafür dieselbe Resend-ID-Spalte auch auf `bestellungen`),
wird – nur falls hier aktiviert und ein Google-Bewertungslink hinterlegt
ist – automatisch eine Mail mit Bitte um Rezension geplant. "Geplant"
heißt hier wörtlich: Resends `scheduledAt` übernimmt die Verzögerung
(Standard 180 Minuten, einstellbar), genau wie schon bei der
Reservierungs-Erinnerung – kein Cron-Job nötig. Die Verzögerung zählt
dabei **ab der Reservierungs- bzw. Liefer-/Abholzeit**, nicht ab dem
Moment, in dem die Leitung den Status setzt (`lib/datum.ts` →
`berlinZeitpunktAlsUtc`, rechnet Datum+Uhrzeit korrekt inkl. Sommer-/
Winterzeit in den tatsächlichen Versandzeitpunkt um) – wird der Status
erst nachträglich gesetzt (z. B. abends für den ganzen Tag), darf die Mail
nie vor dem eigentlichen Besuch rausgehen; liegt der berechnete Zeitpunkt
bereits in der Vergangenheit, wird sofort statt verzögert verschickt.
Wechselt der Status
danach wieder weg (Storno, Korrektur eines Klicks), wird die bereits
geplante Mail über dieselbe Resend-ID storniert, statt einem No-Show oder
einer abgesagten Bestellung/Reservierung eine Bewertung abzuverlangen.
Die Statusänderung selbst bleibt bewusst im jeweiligen Modul (Tischplan/
Bestellung) – das Bewertungsanfrage-Dashboard bekam aber eine eigene
**Bewertungsliste** (zweiter Tab neben den Einstellungen), die beide
Quellen zusammen anzeigt (wer schon eine Anfrage bekommen hat, wem keine
E-Mail hinterlegt war): Ursprünglich sprang das Modul beim Öffnen gefühlt
"nach woanders", weil es nichts zum Anschauen gab außer dem
Einstellungs-Formular – diese Liste behebt genau das, ohne dass man ins
Tischplan- oder Bestellung-Modul wechseln muss, nur um den Überblick zu
behalten.
Als achtes echtes Modul ist der **Gutschein-Verkauf** dazugekommen –
zusammen mit **PayPal als organisationseigener Zahlungsoption**
(`lib/paypal/`): Jede Organisation hinterlegt ihre eigenen PayPal-
Zugangsdaten (Client-ID + Secret ihrer eigenen PayPal-Business-App,
Sandbox oder Live), das Geld fließt direkt an sie – wir fassen es nie an,
keine zusätzliche Finanzaufsicht nötig. PayPal ist dabei bewusst
**Zusatzoption, nie Pflicht**: Ohne hinterlegte/aktive Zugangsdaten bleibt
nur "Bestellen, vor Ort bezahlen" übrig (Gutschein wird mit Status "Offen"
angelegt, die Leitung markiert ihn nach Kassieren manuell als bezahlt) –
genau wie bei der Online-Bestellung. Zahlt der Käufer online, läuft die
PayPal Orders API v2 im Redirect-Flow (kein JavaScript-SDK nötig): Order
anlegen → Käufer bestätigt bei PayPal → Rückkehr auf
`/gutschein/[organisationId]/erfolg` → Order serverseitig erfassen → erst
dann gilt der Gutschein als bezahlt. Jeder Gutschein bekommt einen
zufälligen 8-stelligen Code (per Mail an den Käufer), den die Leitung im
Dashboard einlösen kann, sobald er den Status "Bezahlt" hat.

Zusätzlich ein **PayPal-Webhook** (`app/api/paypal/webhook/[organisationId]`,
Migration `0014`): Schließt der Käufer den Tab nach der PayPal-Freigabe,
bevor der Browser zur Rückkehr-Seite zurückfindet, blieb der Gutschein
sonst für immer auf "Offen" hängen – die Rückkehr-Seite war der einzige
Ort, der die Zahlung erfasst hat. Der Webhook ist vom Browser des Käufers
unabhängig: PayPal ruft ihn selbst auf, sobald die Order freigegeben
wurde. Wird automatisch bei PayPal registriert, sobald die Leitung aktive
PayPal-Zugangsdaten speichert (kein manueller Schritt im
PayPal-Entwickler-Dashboard nötig). Beide Wege (Rückkehr-Seite und
Webhook) rufen dieselbe Funktion auf (`lib/gutschein/zahlung.ts`), die
idempotent ist – welcher zuerst ankommt, gewinnt, der andere erkennt
"schon erledigt" und tut nichts doppelt.

Danach folgte eine Runde gezielter Erweiterungen quer durch alle Module,
aus konkretem Praxis-Feedback:

- **Online-Bestellung – Kunden-Mails und Personal-Benachrichtigung**:
  Eingangsbestätigung bei jeder neuen Bestellung, Status-Mail sobald die
  Leitung "Bestätigt" oder "Storniert" setzt (`lib/bestellung/email.ts`).
  Neue Bestellungen tragen einen "Neu"-Marker, bis sie einmal aufgerufen
  oder im Status geändert wurden. Solange ein Dashboard-Tab offen ist,
  fragt `app/dashboard/BestellBenachrichtigung.tsx` im Hintergrund nach
  neuen Bestellungen und zeigt dann einen Banner – plus optional eine Mail
  an eine hinterlegte Benachrichtigungsadresse. Bewusst keine echte
  Push-Benachrichtigung (bräuchte Service Worker + Geräte-Registrierung),
  nur In-App-Hinweis + Mail.
- **Tischplan – Ausnahme-Hinweis auf der Webseite**: Ein Banner direkt
  unter dem Header zeigt automatisch an, wenn für heute eine
  Öffnungszeiten-Ausnahme hinterlegt ist (geschlossen oder abweichende
  Zeiten) – vorher stand dort nur der reguläre Wochentext.
- **Dienstplan – Export**: Wochen- oder Monatsplan als Excel, analog zum
  Zeiterfassungs-Export – plus ein dritter Modus "Zeitraum" mit zwei freien
  Datumsfeldern, wenn weder die aktuelle Woche noch der aktuelle Monat passt.
- **Zeiterfassung – drei Ergänzungen**: Kalender-Icon zum direkten
  Datumssprung (statt nur Wochen-/Monatsweise blättern); private
  Dokumentenablage je Mitarbeiter für Arbeitsverträge & Co.
  (`mitarbeiter-dokumente`-Bucket, NICHT öffentlich – Download nur über
  eine Route, die vorher die Leitungs-Session prüft, nie über eine
  öffentliche/signierte URL); ein zusätzlicher Steuerberater-Export (ein
  Tabellenblatt pro Mitarbeiter, voller Monat). Bewusst kein DATEV-Format,
  weil dessen Lohnart-/Personalnummer-Zuordnung pro Steuerberater individuell
  konfiguriert ist und sich nicht pauschal richtig raten lässt. Im normalen
  Export (von/bis + Mitarbeiterauswahl für die Leitung) gibt es zusätzlich
  zwei Schnellwahl-Knöpfe ("Aktueller Monat" / "Letzter Monat") und
  "Alle auswählen" für die Mitarbeiterliste.
- **Lagerbestand – Bestellfluss neu gedacht**: Die Prüfung trägt jetzt
  immer einen "Aktuellen Bestand" ein (vorher nur bei "Nachbestellen" ein
  freier "Mengenwunsch") – die Bestellmenge legt danach bewusst die
  Leitung fest, nicht der prüfende Mitarbeiter. Dafür gibt es einen neuen
  Tab "Bestellung": alle offenen "Nachbestellen"-Artikel aus
  abgeschlossenen Prüfungen, gruppiert nach Lieferant; die Leitung hakt ab,
  trägt die Menge ein und sieht einen E-Mail-Entwurf, bevor sie bewusst auf
  "Jetzt senden" klickt (`lib/lager/email.ts`) – nie automatisch im
  Hintergrund, ein Tippfehler soll nie ungeprüft an einen externen
  Lieferanten rausgehen. Lieferanten haben zwei neue Felder
  (Ansprechpartner, Kundennummer) für den Mail-Entwurf. Artikel lassen
  sich jetzt auch bearbeiten, nicht nur anlegen/löschen.

## Sicherheits-Audit vor dem Livegang

Vor dem ersten echten Kunden wurde das gesamte Projekt noch einmal gezielt
auf Sicherheit, Datentrennung zwischen Organisationen und Nebenläufigkeits-
Fehler durchgesehen. Alles Gefundene wurde behoben:

- **IDOR / Mandantentrennung**: In mehreren Modulen (Lagerbestand,
  Bestellung, Tischplan, Zeiterfassung) fehlte bei Aktualisieren/Löschen
  per ID die Prüfung, dass die ID tatsächlich zur eigenen Organisation
  gehört – rein serverseitig fehlte sonst nur eine erratene/beobachtete ID,
  um in Dashboard-Aktionen auf fremde Datensätze zuzugreifen (die Leitung
  einer Organisation ist angemeldet, die Prüfung fehlte aber trotzdem).
  Betroffene Funktionen bekommen jetzt überall `organisation_id` als
  Pflichtparameter und filtern konsequent danach (`lib/lager/daten.ts`,
  `lib/bestellung/daten.ts`, `lib/tischplan/daten.ts`,
  `lib/zeiterfassung/*.ts`, `lib/mitarbeiter/daten.ts`) – inklusive des
  Lager-Export-Routenhandlers, der zuvor jede `pruefungId` ungeprüft
  akzeptierte.
  Nachtrag: Das Website-Modul war beim Audit übersehen worden – Bild
  löschen, Speisekarten-Kategorien und -Einträge ändern/löschen sowie das
  Anlegen eines Eintrags in einer fremden Kategorie liefen nur über die ID.
  Jetzt ebenfalls über `organisation_id` gefiltert (`lib/website/daten.ts`),
  mit "Nicht gefunden" statt stillem Erfolg, wenn die ID nicht passt.
- **Zugänge (zweite Runde)**:
  - Mitarbeiter-PINs müssen je Organisation eindeutig sein – die Anmeldung
    erkennt die Person allein an der PIN. Der unique-Index aus `0002` greift
    seit den gesalzenen Hashes nicht mehr, deshalb prüft jetzt
    `pinInOrganisationVergeben` (`lib/mitarbeiter/daten.ts`) beim Anlegen und
    Zurücksetzen gegen jeden Hash.
  - Login verrät nicht mehr, ob ein Zugangscode existiert: einheitliche
    Meldung und gleiche Antwortzeit (Attrappen-Hash in `app/actions.ts`).
  - Neue Organisationen: PIN 6–12 Ziffern, Mitarbeiter-PIN 4–8 Ziffern,
    triviale PINs (0000, 1234 …) abgelehnt (`lib/pinRegeln.ts`, gilt nur für
    neue/geänderte PINs). Zugangscode ohne Vorgabe wird mit Zufallsanteil
    erzeugt (z. B. `cafe-rose-k7m2qx`). Organisationen sind intern ohnehin
    über ihre UUID getrennt – gleiche Namen sind kein Problem, nur der
    Zugangscode muss eindeutig sein (Datenbank-Constraint).
  - Eigene Domain kann nur noch der Plattform-Admin eintragen – vorher hätte
    ein Betrieb die Domain eines anderen beanspruchen können.
- **Bestellung – Preismanipulation**: Der Online-Bestellen-Endpunkt nahm
  bisher Name/Preis jeder Warenkorbposition direkt vom Client entgegen –
  ein direkter Aufruf der Server Action (am Formular vorbei) hätte beliebige
  Preise oder erfundene Artikel einschleusen können. Der Client schickt
  jetzt nur noch `eintragId` + Menge; Name und Preis werden ausschließlich
  serverseitig aus der echten, aktiven Speisekarte nachgeschlagen
  (`app/bestellen/[organisationId]/actions.ts`).
- **Gutschein-Doppeleinlösung & Tauschbörse-Rennen**: Einlösen/Stornieren
  eines Gutscheins sowie die Tauschbörsen-Status-Übergänge liefen bisher
  "lesen, dann schreiben" – bei zwei fast gleichzeitigen Versuchen (zwei
  Kassen, Doppelklick) konnte derselbe Gutschein zweimal eingelöst oder ein
  bereits bestätigter Tausch nachträglich wieder abgelehnt werden. Beides
  läuft jetzt über ein bedingtes Update (nur vom erwarteten Ausgangsstatus
  aus, mit Prüfung der betroffenen Zeilenzahl) statt eines blinden Updates.
  Dieselbe Lücke bei gleichzeitigen Tauschangeboten auf dieselbe Schicht
  schließt ein erweiterter Unique-Index.
- **Login/PIN-Sicherheit**: Alle drei PIN-Typen (Plattform-Admin,
  Organisation, Mitarbeiter) sind jetzt mit exponentiell steigender
  Sperrzeit gegen Durchprobieren geschützt (`lib/rateLimit.ts`), PIN-Hashes
  nutzen einen gesalzenen, langsamen KDF (`scrypt`, `lib/pinHash.ts`) statt
  eines einzigen, global geteilten HMAC-Schlüssels (ein geleakter Schlüssel
  hätte sonst alle PINs offline angreifbar UND Sitzungscookies fälschbar
  gemacht – "ein Schlüssel für beides"), und alle sicherheitsrelevanten
  Vergleiche (Signaturen, Admin-PIN) laufen zeitkonstant. Session-Cookies
  setzen `sameSite: 'strict'` statt `'lax'`.
- **PayPal**: Der erfasste Zahlungsbetrag/die Währung aus der
  Capture-Antwort wird jetzt gegen den erwarteten Betrag geprüft, bevor ein
  Gutschein als bezahlt gilt (vorher zählte nur der Status "COMPLETED").
  Die Rückkehr-/Webhook-URL wird nicht mehr ungeprüft aus dem `Host`-Header
  übernommen (Server Actions sind eigenständig aufrufbare Endpunkte, der
  Header lässt sich vom Aufrufer frei setzen) – `herkunftUrl()` prüft jetzt
  gegen eine Zulassliste aus Plattform-Domain und der eigenen
  Subdomain/Custom-Domain der Organisation (`lib/url.ts`).
- **Kapazitäts-Rennen bei Reservierung & Bestellung**: Zwischen der
  Verfügbarkeitsprüfung und dem tatsächlichen Anlegen lag ein kleines
  Zeitfenster, in dem zwei nahezu gleichzeitige Gäste denselben letzten
  Tisch/Bestellslot bekommen konnten. Die volle Geschäftslogik
  (Öffnungszeiten, Feiertage, Vorlaufzeit, Kanal-Pausen) bleibt bewusst in
  TypeScript – nur der eigentliche Kapazitäts-Zähler läuft jetzt ein
  zweites Mal, unter einem Postgres-Advisory-Lock, unmittelbar vor dem
  Insert (`0019_kapazitaets_rpc.sql`,
  `reservierungErstellenMitPruefung`/`bestellungErstellenMitPruefung`).
- **Spam-Schutz auf öffentlichen Formularen**: Gutschein kaufen, Bestellen
  und Reservieren sind jetzt zusätzlich pro Organisation+IP
  ratenbegrenzt – unabhängig von der Kapazitätsprüfung, die nur die
  Geschäftsregel schützt, nicht die Formulare selbst vor einem Spam-Skript.
- **E-Mails**: Alle Textfelder aus Formularen, die auch anonyme Gäste
  ausfüllen (Name, Telefon, Positionsnamen, Lieferanten-Ansprechpartner),
  werden jetzt vor dem Einbetten in E-Mail-HTML escaped
  (`lib/htmlEscape.ts`) – vorher hätte ein manipulierter Name HTML/Links in
  die Mail einschleusen können.
- **Fehlermeldungen an anonyme Aufrufer**: Unerwartete Datenbankfehler bei
  Gutschein-/Bestellungs-/Reservierungs-Anlage geben nicht mehr die rohe
  DB-Fehlermeldung zurück (könnte Spalten-/Constraint-Namen verraten),
  sondern eine generische Meldung; die echte Meldung landet nur im
  Server-Log.
- **Lagerbestand – doppelter Bestellversand**: "Jetzt senden" markierte
  Positionen bisher erst *nach* dem Mailversand als bestellt – ein
  Doppelklick konnte dieselbe Bestellung zweimal an den Lieferanten
  schicken. Jetzt wird zuerst bedingt beansprucht (nur von
  "nicht bestellt"), erst danach die Mail verschickt.
- **Bewertungsanfrage – doppelter Versand**: Dieselbe Lesen-dann-Schreiben-
  Lücke wie beim Lagerbestand, hier beim Planen der Bewertungs-Mail bei
  Statuswechsel auf "erschienen"/"abgeschlossen" – ebenfalls auf ein
  bedingtes Beanspruchen umgestellt.

Keine dieser Änderungen hat sichtbare Auswirkungen auf das UI oder die
Demo (`claude.ai/artifact/...`) – es handelt sich ausschließlich um
Backend-/Datenbankhärtung ohne neues oder geändertes Verhalten für
Nutzer:innen, die alles richtig benutzen.

## Markenauftritt & Layout ("Konzertsaal")

Nach dem Sicherheits-Audit folgte die Optik: Name, Farben, Typografie und
Navigation wurden überarbeitet, damit die Plattform professionell und
bedienerfreundlich wirkt, bevor echte Kunden sie sehen.

- **Name**: "Maestoso" (italienisch für "majestätisch", eine
  Tempobezeichnung) – bleibt in der Dirigenten-/Orchester-Metapher, die
  schon mit "Partitura" begonnen hat. Markenrechtlich geprüft (EUIPO +
  DPMA, Klassen 09/42: keine aktive Marke in Software-relevanten
  Klassen) und Domain `maestoso.io` gesichert – Status: abgeschlossen.
- **Farben/Typografie**: Palette "Konzertsaal" (dunkles Tintenblau `#1b2340`,
  Gold `#c9962b`, warmes Creme-Papier `#faf7f0`) in `app/globals.css` als
  CSS-Variablen, Schriften Fraunces (Überschriften) + Manrope (Fließtext)
  über `next/font/google` in `app/layout.tsx`.
- **Navigation**: feste Sidebar (`components/Sidebar.tsx`) mit allen
  Modulen inkl. Icons und aktiver Markierung statt reiner Kachel-Startseite;
  `components/DashboardShell.tsx` liefert dazu das mobile
  Navigations-Overlay (Hamburger-Menü in `AppHeader.tsx`, aufklappbar via
  React Context). `app/dashboard/layout.tsx` bindet das für alle
  Dashboard-Seiten einmalig ein.
- **Dashboard-Startseite**: vier Kennzahlen oben (Reservierungen heute,
  Bestellungen heute, fällige Lagerprüfungen, Personal heute), aus den
  bestehenden, bereits mandantensicheren Abfragen berechnet – siehe
  `app/dashboard/page.tsx`.
- **Dark Mode**: nur per Schalter (Login oben rechts, sonst in
  `AppHeader.tsx`), nie automatisch über die Geräteeinstellung – alle
  sehen zuerst den hellen Standard. Die Wahl liegt im Cookie
  `maestoso-theme` und wird serverseitig gelesen (`components/ThemeBereich.tsx`),
  damit nichts beim Laden umspringt. Gilt nur für Login, Dashboard und
  Plattform-Admin; öffentliche Gästeseiten bleiben immer hell. Die Sidebar
  hat eigene Tokens (`--sidebar*`) und bleibt in beiden Modi dunkelblau.
- **Logo**: drei Taktstriche (`components/Logo.tsx`), funktioniert als
  eigenständiges Zeichen (App-Icon) wie auch neben dem Schriftzug.
- **Zwei Demo-Artefakte** (beide synchron zum echten Projekt-Look, nicht
  Teil dieses Repos, nur als Link): eine responsive Desktop-/Tablet-Demo
  und eine zweite, die sich auf echten Handys randlos öffnet (Telefon-Rahmen
  nur bei Desktop-Breite sichtbar) – Links auf Anfrage, ändern sich nicht
  bei neuen Chats/Sessions.

## Statistiken & Auswertungen

Fünf Auswertungen, jeweils als eigener Tab im passenden Modul (keine neue
Seite, keine neue Sidebar-Kachel):

1. **Tischplan → "Auswertung"**: Reservierungen nach Wochentag/Uhrzeit,
   Ø Personen, No-Show- und Stornoquote, Zeitraum wählbar (7/30/90 Tage).
   `lib/tischplan/auswertung.ts`.
2. **Bestellung → "Auswertung"**: Umsatz/Anzahl nach Kanal (Abholung/
   Lieferung), Wochentag und Uhrzeit, Ø Bestellwert, Stornoquote.
   `lib/bestellung/auswertung.ts`.
3. **Gutschein → "Verbindlichkeiten"**: offener Betrag (bezahlt, noch nicht
   eingelöst) vs. bereits eingelöster Betrag, plus Warnliste für Gutscheine,
   die sich der 3-Jahres-Verjährung nähern (§195 BGB, Warnschwelle 30 Monate
   nach Bezahlung). `lib/gutschein/auswertung.ts`.
4. **Bewertung → "Klickrate"**: wie viele Bewertungsanfrage-Mails wurden
   geöffnet/angeklickt, Zeitraum wählbar. Dafür ein dauerhaftes Protokoll
   (Tabelle `bewertungsanfragen`, unabhängig von den `bewertung_resend_id`-
   Spalten auf Reservierung/Bestellung, die beim Stornieren genullt werden)
   plus ein Resend-Webhook (`app/api/resend/webhook`, Signatur per `svix`
   geprüft). Ohne `RESEND_WEBHOOK_SECRET` bleibt der Tab leer, nichts
   anderes wird dadurch beeinträchtigt. `lib/bewertung/auswertung.ts`.
5. **Bewertung → "Google-Trend"**: Verlauf der Google-Gesamtbewertungen
   (Anzahl + Durchschnitt) mit Delta zum letzten Eintrag. **Manuell erfasst**
   – eine echte Anbindung an die Google Business Profile API würde eine
   eigene Google-Cloud-Projekteinrichtung samt Freigabe durch Google
   voraussetzen (externer, mehrtägiger Prozess), das lässt sich in dieser
   Session nicht abschließen. Die Leitung trägt Stand/Durchschnitt stattdessen
   kurz selbst ein (ein Eintrag pro Tag).

**Dabei gefunden und mitbehoben**: `proxy.ts` hat bislang *jeden* Request
ohne Login-Cookie auf `/login` umgeleitet, auch unter `/api/*` – damit hätte
weder der neue Resend-Webhook noch der bestehende PayPal-Webhook je einen
echten, unauthentifizierten Aufruf von außen erreicht (beide prüfen sich
selbst per Signatur, keine Session nötig). API-Routen sind jetzt von der
Login-Weiterleitung ausgenommen.

## Veranstaltungsplanung

Eigenes Modul (`veranstaltung`), für geschlossene Gesellschaften und
Raumvermietungen – bewusst kein Tischplan-Tab, weil der Datenbedarf
(Ansprechpartner, Pauschale/Anzahlung, eigener Status-Workflow, eigenes
öffentliches Anfrageformular) darüber hinausgeht, siehe Diskussion im
Chat-Verlauf.

- **Datenmodell**: `lib/veranstaltung/types.ts` + Migration `0021` – Titel,
  Ansprechpartner (Name/E-Mail/Telefon), Datum, Beginn/Ende, geschätzte
  Gästezahl, Status (`angefragt` → `bestaetigt`/`abgesagt`/`durchgefuehrt`),
  optionale Pauschale + Anzahlung, Notiz.
- **Kapazitätsprüfung ohne eigene Logik**: Eine bestätigte Veranstaltung legt
  automatisch eine ganz normale Tischplan-Blockierung an (ganzer Betrieb, für
  den angefragten Zeitraum) – siehe `lib/veranstaltung/aktionen.ts`. Reguläre
  Reservierungen können sich damit nie mit einer Veranstaltung überschneiden,
  ohne dass eine zweite, separat zu pflegende Kapazitätsprüfung nötig wäre.
  Beim Absagen/Löschen wird dieselbe Blockierung wieder entfernt.
- **Dashboard** (`app/dashboard/veranstaltung/`): Liste mit Status-Aktionen
  (Bestätigen/Absagen/Als durchgeführt markieren/Löschen), Pauschale/
  Anzahlung direkt editierbar, manuelles Anlegen durchs Personal (z. B.
  telefonische Anfrage), Einstellungen (Anfrageformular an/aus, Infotext,
  Benachrichtigungs-E-Mail).
- **Öffentliches Anfrageformular** (`app/veranstaltung/[organisationId]`):
  kein Verfügbarkeits-Check wie bei der Tischreservierung – jede Anfrage
  landet als "Angefragt" im Dashboard, die Leitung bestätigt manuell (erst
  dann entsteht die Blockierung). Rate-limited wie die übrigen öffentlichen
  Formulare (`lib/rateLimit.ts`), schickt eine Eingangsbestätigung an die
  anfragende Person plus optional eine Benachrichtigung ans Personal.

## Rechtliches (Impressum & Datenschutz)

Zwei Ebenen, weil die Verantwortung unterschiedlich verteilt ist:

- **Plattform** (`/impressum`, `/datenschutz`): Maestoso als Anbieter
  gegenüber den Betrieben (Login, Dashboard, Plattform-Admin). Die
  Betreiberdaten stehen in `lib/rechtliches/plattform.ts` und sind noch
  **Platzhalter in eckigen Klammern**. Vor dem Livegang dort eintragen:
  Name/Firma, Anschrift, Kontakt, ggf. Register und USt-IdNr., außerdem die
  Supabase-Region und die Anschriften von Supabase/Resend laut deren DPA
  (Vercel-Anschrift gegenprüfen).
- **Je Betrieb** (`/website/<id>/impressum`, `/website/<id>/datenschutz`, auf
  der eigenen Domain auch `/impressum` und `/datenschutz`, siehe `proxy.ts`):
  Auf den Gästeseiten ist der Betrieb Anbieter und Verantwortlicher, Maestoso
  nur Auftragsverarbeiter. Jeder Betrieb trägt seine Angaben im Dashboard
  unter „Impressum & Datenschutz“ ein (Sidebar unten, Tabelle
  `rechtliche_angaben`, Migration `0022`). Die Datenschutzerklärung zeigt nur
  Abschnitte für freigeschaltete Module. Solange Name, Anschrift oder E-Mail
  fehlen, zeigen die Seiten statt eines halben Textes einen Hinweis.
- Alle Gästeseiten und das Login verlinken unten auf die passenden Seiten
  (`components/rechtliches/RechtlicheFusszeile.tsx`).
- Dienstleister (Vercel, Supabase, Resend) stehen zentral in
  `DIENSTLEISTER` (`lib/rechtliches/plattform.ts`) und erscheinen in beiden
  Datenschutzerklärungen. Ein neuer Dienstleister im Code muss dort ergänzt
  werden.
- Die Texte sind eine Vorlage, keine Rechtsberatung, und sollten vor dem
  Livegang einmal anwaltlich geprüft werden. Offen ist außerdem noch der
  AVV mit jeder Organisation.

## Preismodell

Noch nicht im Code abgebildet (keine Abrechnungslogik, keine Preisseite) –
hier nur die Entscheidung aus den Preisgesprächen festgehalten, damit sie
nicht wieder neu verhandelt werden muss, wenn Abrechnung/Preisseite gebaut
werden.

**Ausgangslage:** Ziel ist Profitabilität schon ab 3–5 Kunden, nicht erst
ab Dutzenden. Laufende Infrastrukturkosten liegen bei ca. 42–60 €/Monat
(Supabase Pro ~23 €, Vercel Pro ~18 € – Hobby-Tier ist nur für private
Nutzung zulässig, Resend bis 3.000 Mails/Monat kostenlos, danach ~18 €).
Ein vergleichbarer Funktionsumfang bei der Konkurrenz (z. B. gastronovi:
Tischreservierung + Bestellsystem + Kasse + Kassenbuch + Kalkulation +
Einkauf einzeln lizenziert) kostet in Summe grob 250–350 €/Monat.

### Drei Stufen

| | Basic | Plus | Full |
|---|---|---|---|
| **Preis** | 49 €/Monat | 109 €/Monat | 149 €/Monat |
| Zeiterfassung | ✓ | ✓ | ✓ |
| Tischplan & Reservierungen | ✓ | ✓ | ✓ |
| Website | ✓ | ✓ | ✓ |
| Dienstplan | | ✓ | ✓ |
| Online-Bestellung | | ✓ | ✓ |
| Google-Bewertungsanfrage | | ✓ | ✓ |
| Lagerbestand | | | ✓ |
| Gutschein-Verkauf | | | ✓ |
| Veranstaltungsplanung | | | ✓ |

Erzählstruktur der Staffelung: Basic = online sichtbar + buchbar, Plus =
aktiv Umsatz machen + Personal koordinieren, Full = komplettes Backoffice
inkl. Sonderanlässe. Jede Stufe baut auf der vorigen auf, kein Modul taucht
isoliert in einer höheren Stufe auf, ohne in der vorigen enthalten zu sein.

### Einzelpreise (Module einzeln buchbar, für Kunden ohne Bundle)

Zeiterfassung 19 € · Tischplan 35 € · Website 16 € · Dienstplan 22 € ·
**Online-Bestellung 59 €** · Bewertungsanfrage 16 € · Lagerbestand 25 € ·
Gutschein-Verkauf 19 € · Veranstaltungsplanung 32 €

Summe aller neun Module einzeln: 243 € – bewusst über dem Full-Preis
(149 €), damit das Bundle immer der günstigere Weg bleibt (ca. 30–40 %
Bundle-Rabatt), aber weiterhin klar unter der Konkurrenz-Summe von
250–350 €.

### Online-Bestellung ist bewusst der Ausreißer nach oben

59 € liegt über dem, was einzelne Wettbewerber für ein reines
Bestellmodul verlangen (gastronovi: 49 €/Monat) – hier zählt aber nicht
der Vergleich mit anderer Software, sondern mit Lieferando: 13–30 %
Provision pro Bestellung, bei mittlerem Umsatz schnell 300–600 €/Monat.
Eine Flatrate wirkt dagegen selbst bei höherem Preis wie ein Schnäppchen.
Deshalb bewusst **in Plus belassen, nicht nach Full verschoben** – das
Modul ist der stärkste Türöffner im Verkaufsgespräch (konkrete
Ersparnis vorrechenbar), ein Kunde, der nur Online-Bestellung ohne
Provision will, soll nicht zur Konkurrenz abwandern, nur weil das Modul
hinter der teuersten Stufe versteckt ist.

## Setup

### 1. Supabase-Projekt anlegen

Ein **neues, separates** Supabase-Projekt erstellen. Danach im SQL-Editor
die Migrationen der Reihe nach ausführen:

```
supabase/migrations/0001_init.sql
supabase/migrations/0002_zeiterfassung.sql
supabase/migrations/0003_tischplan.sql
supabase/migrations/0004_dienstplan.sql
supabase/migrations/0005_website.sql
supabase/migrations/0006_lager.sql
supabase/migrations/0007_tischplan_ausnahmen.sql
supabase/migrations/0008_bestellung.sql
supabase/migrations/0009_bewertung.sql
supabase/migrations/0010_bestellung_benachrichtigung.sql
supabase/migrations/0011_zeiterfassung_dokumente.sql
supabase/migrations/0012_lager_bestellung.sql
supabase/migrations/0013_gutschein_paypal.sql
supabase/migrations/0014_paypal_webhook.sql
supabase/migrations/0015_bewertung_bestellung.sql
supabase/migrations/0016_tausch_bestaetigung.sql
supabase/migrations/0017_rate_limit.sql
supabase/migrations/0018_tausch_unique_fix.sql
supabase/migrations/0019_kapazitaets_rpc.sql
```

`0001` legt `organisationen` und `freischaltungen` an, `0002` die
Zeiterfassungs-Tabellen samt Trigger für die Stunden-Limits, `0003` die
Tische/Reservierungen/Blockierungen samt Buchungseinstellungen, `0004` die
Schichten/Verfügbarkeiten/Tausch-Anfragen (und erweitert dabei das
`modul_schluessel`-Enum aus `0001` um `'dienstplan'`), `0005` die
Website-Inhalte/Speisekarte/Bilder, die `subdomain`/`custom_domain`-Spalten
auf `organisationen` sowie den öffentlichen Storage-Bucket
`website-bilder` (per SQL angelegt, keine manuelle Einrichtung im
Supabase-Dashboard nötig), `0006` die Lieferanten/Artikel/Bestandsprüfungen
(und erweitert das `modul_schluessel`-Enum um `'lager'`), `0007` die
tagesgenauen Öffnungszeiten-Ausnahmen im Tischplan-Modul, `0008` die
Online-Bestellung (Einstellungen, Bestellungen, Bestellpositionen; erweitert
das `modul_schluessel`-Enum um `'bestellung'`), `0009` die
Bewertungsanfrage-Einstellungen sowie die `bewertung_resend_id`-Spalte auf
`reservierungen` (und erweitert das `modul_schluessel`-Enum um
`'bewertung'`), `0010` den "Neu"-Marker (`gesehen`) auf Bestellungen sowie
die Benachrichtigungs-E-Mail-Spalte in den Bestell-Einstellungen, `0011`
den privaten Storage-Bucket `mitarbeiter-dokumente` und die zugehörige
Tabelle für die Arbeitsvertrags-Ablage, `0012` den Umbau der
Bestandsprüfung (`menge_wunsch` → `aktueller_bestand`, neu `bestellt` und
`bestellmenge`) sowie zwei neue Lieferanten-Felder
(`ansprechpartner`, `kundennummer`), `0013` die PayPal-Zugangsdaten pro
Organisation (`organisation_zahlungseinstellungen`, RLS ohne Policies –
nur per Service-Role lesbar) sowie Gutschein-Einstellungen und -Tabelle
(und erweitert das `modul_schluessel`-Enum um `'gutschein'`), `0014` die
`paypal_webhook_id`-Spalte für den automatisch registrierten PayPal-Webhook
(siehe "Aktueller Stand"), `0015` dieselbe `bewertung_resend_id`-Spalte wie
auf `reservierungen` jetzt auch auf `bestellungen`, damit die
Bewertungsanfrage auch an abgeschlossene Online-Bestellungen gekoppelt
werden kann, `0016` den neuen `tausch_status`-Wert `'bestaetigt'` fürs
zweistufige Bestätigen eines Schichttauschs (siehe "Aktueller Stand"),
`0017` die `login_versuche`-Tabelle fürs Rate-Limiting gegen
Durchprobieren/Spam (siehe "Sicherheits-Audit"), `0018` den erweiterten
Unique-Index auf `tausch_anfragen` (jetzt auch `'angenommen'` zählt als
aktiv, nicht nur `'offen'`) gegen mehrere gleichzeitige Tauschangebote auf
dieselbe Schicht, `0019` zwei Postgres-Funktionen
(`reservierung_mit_pruefung_erstellen`,
`bestellung_mit_pruefung_erstellen`), die die Kapazitätsprüfung ein zweites
Mal unter einem Advisory-Lock direkt vor dem Insert laufen lassen (siehe
"Sicherheits-Audit").

### 2. Umgebungsvariablen

`.env.example` kopieren nach `.env.local` und ausfüllen:

- `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` – aus den
  Supabase-Projekteinstellungen (API).
- `PLATTFORM_ADMIN_PIN` – nur noch für die einmalige Ersteinrichtung des
  ersten Admin-Kontos unter `/login` (danach wirkungslos).
- `ZWEI_FAKTOR_SCHLUESSEL` – 64 Hex-Zeichen (`openssl rand -hex 32`),
  verschlüsselt die TOTP-Geheimnisse in der Datenbank. Nicht nachträglich
  ändern, sonst müssen alle Konten 2FA neu einrichten.
- `SESSION_SECRET` – langer Zufallsstring, z. B. `openssl rand -hex 32`.
- `RESEND_API_KEY` / `RESEND_ABSENDER` – optional, für Bestätigungs-/
  Erinnerungsmails im Tischplan-Modul sowie die Bewertungsanfrage. Ohne Key
  wird die Reservierung trotzdem gespeichert bzw. der Status trotzdem
  geändert, nur der jeweilige Mailversand übersprungen.
- `RESEND_WEBHOOK_SECRET` – optional, nur für die Klickrate im
  Bewertung-Modul (siehe "Statistiken & Auswertungen"). Signing Secret aus
  dem bei Resend angelegten Webhook-Endpoint (`<domain>/api/resend/webhook`,
  Events "email.opened" + "email.clicked").
- `NEXT_PUBLIC_PLATTFORM_DOMAIN` – eure eigene Plattform-Domain (z. B.
  `maestoso.io`), ohne Protokoll/Subdomain. Lokal leer lassen – ohne
  diese Variable ist das Domain-Routing fürs Website-Modul inaktiv.
- `VERCEL_API_TOKEN` / `VERCEL_PROJECT_ID` / `VERCEL_TEAM_ID` – optional,
  damit der Plattform-Admin Kunden-Domains direkt aus Maestoso im
  Vercel-Projekt anlegen, prüfen und entfernen kann (`lib/vercel/domains.ts`).
  Token unter Vercel → Account Settings → Tokens (Scope: das Team des
  Projekts), Projekt-ID unter Project Settings → General, Team-ID unter Team
  Settings (leer lassen bei einem persönlichen Account). Ohne diese Werte
  wird die Domain nur gespeichert und muss in Vercel von Hand eingetragen
  werden.

### 3. Lokal starten

```
npm install
npm run dev
```

Unter `/login` beim ersten Mal mit `PLATTFORM_ADMIN_PIN` das Admin-Konto
anlegen (E-Mail, Passwort, danach Authenticator-App einrichten). Im Admin
eine Organisation mit Name und E-Mail der Inhaberin anlegen – ohne
Resend-Konfiguration erscheint der Einladungslink zum Kopieren. Lokal (ohne
`NEXT_PUBLIC_PLATTFORM_DOMAIN`) liegt die Team-Anmeldung unter
`/team/<organisationId>`.

### 4. Deployment (Vercel)

- Eigenes Vercel-Projekt für dieses Repo anlegen.
- Die Umgebungsvariablen oben in den Vercel-Projekteinstellungen eintragen
  (Production + Preview).
- Eigene Domain + Wildcard-Subdomain im Vercel-Projekt hinzufügen (z. B.
  `maestoso.io` und `*.maestoso.io`), damit jede
  Organisations-Subdomain automatisch funktioniert, sobald
  `NEXT_PUBLIC_PLATTFORM_DOMAIN` gesetzt ist.
- Eigene Kunden-Domain (z. B. `musterbetrieb.de`): nur im Plattform-Admin
  bei der Organisation → „Verbinden“. Das trägt sie in der Datenbank und
  (mit den `VERCEL_*`-Variablen) im Vercel-Projekt ein, optional mit
  `www.`-Weiterleitung. „Status prüfen“ zeigt die noch fehlenden
  DNS-Einträge (A/CNAME, ggf. TXT-Nachweis). Die Anleitungen für die drei
  Wege – Domain beim bisherigen Anbieter lassen, zu Vercel umziehen (Auth-Code,
  MX-Einträge übernehmen!), neu bei Vercel kaufen – stehen direkt im Admin
  (`app/plattform-admin/DomainVerwaltung.tsx`). Kauf und Umzug selbst laufen
  bewusst über die Vercel-Oberfläche: beides kostet Geld bzw. ist nicht
  einfach rückgängig zu machen. Beim Löschen einer Organisation wird ihre
  Domain auch aus Vercel entfernt.
- Gästeseiten unter der Domain des Betriebs: `/` (Website), `/reservieren`,
  `/bestellen`, `/gutschein`, `/gutschein/erfolg`, `/veranstaltung`,
  `/impressum`, `/datenschutz` (Zuordnung in `lib/gaestePfade.ts`, gemeinsam
  für `proxy.ts` und alle Links). Alte Adressen
  `maestoso.io/reservieren/<id>` usw. leiten dorthin um.
- Subdomain verstecken: Sobald „Status prüfen“ die eigene Domain als fertig
  meldet (`custom_domain_aktiv`, Migration `0023`), leitet die Subdomain
  dauerhaft (308) auf die eigene Domain um. Bricht die DNS später weg,
  schaltet die nächste Prüfung die Umleitung wieder ab. Dashboard-Links zum
  Teilen und die PayPal-Rückkehradresse nutzen ebenfalls die eigene Domain
  (`oeffentlicheUrl` in `lib/url.ts`), der PayPal-Webhook bewusst die
  Plattform-Domain.

## Aufbau

- `app/login` – zentrales Login, zwei Tabs (Organisation / Plattform-Admin).
- `app/dashboard` – Modul-Übersicht einer Organisation; `[modul]/page.tsx`
  zeigt pro Modul den Demo-Banner, falls nicht freigeschaltet.
- `app/dashboard/zeiterfassung` – Zeiterfassungs-Modul: `page.tsx` (Server
  Component, prüft Organisations- und Mitarbeiter-Session),
  `ZeiterfassungApp.tsx` (Mitarbeiter-Anmeldung, Wochen-/Monatsauswahl,
  Verwaltung), `ZeitTabelle.tsx` (Tageszeilen, Speichern pro Tag),
  `LimitCard.tsx` (Fortschrittsbalken zur Stundengrenze), `actions.ts`
  (alle Server Actions), `export/route.ts` (Excel-Export).
- `app/plattform-admin` – Organisationen anlegen/löschen, Module pro
  Organisation freischalten/sperren.
- `proxy.ts` – schützt alle Routen; `/dashboard*` nur für Organisationen,
  `/plattform-admin*` nur für den Plattform-Admin.
- `lib/module.ts` – zentrale Liste der Module (neues Tool = eine Zeile
  hier plus ein neuer Enum-Wert in der Datenbank).
- `lib/organisationen.ts` – lädt Organisationen/Freischaltungen aus der
  Datenbank.
- `lib/auth.ts` – Organisations-/Plattform-Admin-Session-Cookie und
  PIN-Hashing für Organisations-PINs.
- `lib/signiertesToken.ts` – gemeinsame, modulübergreifende Signatur-Logik
  (HMAC-SHA256 über Web Crypto) hinter `lib/auth.ts` und jeder
  modul-eigenen Sub-Session wie der Mitarbeiter-PIN-Anmeldung; auch die
  zeitkonstante Vergleichsfunktion `konstantZeitGleich` lebt hier
  (Edge-kompatibel, kein `node:crypto`).
- `lib/pinHash.ts` – gesalzenes, langsames PIN-Hashing (`scrypt`). Bewusst
  getrennt von `lib/signiertesToken.ts`/`lib/auth.ts`: `proxy.ts` (Next.js
  Middleware, Edge-Runtime) importiert `lib/auth.ts` direkt, und
  `node:crypto` steht dort nicht zur Verfügung – dieses Modul wird deshalb
  ausschließlich aus Node-Server-Actions importiert, nie aus Edge-Code.
- `lib/rateLimit.ts` – generisches Rate-Limiting (`login_versuche`-Tabelle,
  exponentiell steigende Sperrzeit) für Login-PINs und öffentliche
  Gäste-Formulare.
- `lib/htmlEscape.ts` – HTML-Eskapierung für Text aus Gäste-Formularen, der
  in E-Mail-HTML eingebettet wird.
- `lib/url.ts` – `herkunftUrl()`, die Basis-URL für PayPal-Rückkehr-/
  Webhook-URLs, geprüft gegen eine Zulassliste statt den rohen
  `Host`-Header ungefiltert zu übernehmen (Server Actions sind eigenständig
  aufrufbare Endpunkte, siehe "Sicherheits-Audit").
- `lib/mitarbeiter/` – die Mitarbeiter-Identität selbst, modulübergreifend
  (Zeiterfassung und Dienstplan planen/erfassen für dieselben Mitarbeiter
  derselben Organisation): `types.ts` (Typen), `auth.ts`/`session.ts`
  (PIN-Sub-Login, eigenes Cookie `sfp_mitarbeiter`, gilt für beide Module),
  `aktionen.ts` (Anmelden/Abmelden als Server Actions), `daten.ts`
  (Mitarbeiter laden – einmal mit allen Feldern für die Leitung, einmal nur
  Name für Ansichten wie den Dienstplan, die Kolleginnen/Kollegen beim
  Namen zeigen, aber keine sensiblen Felder sehen dürfen).
- `lib/zeiterfassung/` – Geschäftslogik der Zeiterfassung selbst: `types.ts`
  (`Zeiteintrag`/`EintragArt`), `zeit.ts` (Pausen-/Stundenrechnung, reicht
  die generische Datumsrechnung aus `lib/datum.ts` weiter), `daten.ts`
  (Zeiteinträge laden).
- `lib/datum.ts` – generische Europe/Berlin-sichere Kalenderrechnung,
  gemeinsam von Zeiterfassung, Tischplan und Dienstplan genutzt (keine
  Duplikation).
- `lib/tischplan/` – Geschäftslogik von Tischplan & Reservierungen:
  `types.ts` (Typen), `regeln.ts` (Feiertage Hessen, Slot-Erzeugung,
  einzige Verfügbarkeitsprüfung für Gast- und Personal-Buchung), `daten.ts`
  (Datenbankzugriffe), `email.ts` (optionale Bestätigungs-/Erinnerungsmail
  über Resend).
- `app/dashboard/tischplan` – Personal-Ansicht: Reservierungen des Tages
  (Status ändern, Tisch zuweisen, manuell anlegen), Tischverwaltung,
  Blockierungen (Kontingent für einen Zeitraum sperren), Ausnahmen
  (`Ausnahmen.tsx` – einzelnes Datum kürzer/länger öffnen oder schließen),
  Einstellungen (Öffnungszeiten/Buchungsregeln), plus der kopierbare Link
  zur öffentlichen Buchungsseite.
- `app/reservieren/[organisationId]` – öffentliche, nicht eingeloggte
  Gäste-Buchungsseite (Datum/Personenzahl/Uhrzeit, sofortige Bestätigung).
  In `proxy.ts` bewusst von der Login-Pflicht ausgenommen.
- `lib/dienstplan/` – Geschäftslogik von Dienstplan & Schichtplanung:
  `types.ts` (Typen), `regeln.ts` (einzige Überschneidungsprüfung – gilt
  für die manuelle Zuweisung durch die Leitung genauso wie für die Annahme
  einer Tausch-Anfrage), `daten.ts` (Datenbankzugriffe).
- `app/dashboard/dienstplan` – Personal-Ansicht: `DienstplanApp.tsx`
  (dieselbe PIN-Anmeldung wie die Zeiterfassung, aus `lib/mitarbeiter/`),
  `WochenPlan.tsx` (Schichten der Woche; Leitung legt an/weist zu/bearbeitet
  Beginn-Ende-Notiz/löscht – Zuweisung blendet für den Tag nicht verfügbare
  Mitarbeiter aus, außer es ist die bereits bestehende Zuweisung –, jeder
  sieht seine eigenen Schichten und kann sie zum Tausch anbieten),
  `VerfuegbarkeitAnsicht.tsx` (eigene Verfügbarkeit pro Tag eintragen),
  `TeamVerfuegbarkeit.tsx` (nur Leitung: Wochen-Überblick, wer sich
  verfügbar/nicht verfügbar eingetragen hat), `TauschBoerse.tsx` (zusagen/
  zurückziehen, als Leitung bestätigen/ablehnen – Zusage und Bestätigung
  sind zwei getrennte Schritte, Migration `0016` ergänzt dafür den Status
  `'bestaetigt'`).
- `lib/website/` – Geschäftslogik des Website-Moduls: `types.ts` (Typen),
  `daten.ts` (Inhalte/Bilder/Speisekarte; Bild-Upload/-Löschung inkl.
  Supabase-Storage-Objekt, nicht nur die Datenbank-Zeile).
- `app/dashboard/website` – CMS-Ansicht der Organisation: `WebsiteApp.tsx`
  (Tabs + kopierbarer/öffnungsfähiger Website-Link), `WebsiteInhaltForm.tsx`
  (Hero/Über uns/Tagesmenü/Kontakt), `SpeisekarteVerwaltung.tsx`
  (Kategorien und Gerichte, inkl. Ein-/Ausblenden ohne Löschen),
  `BilderVerwaltung.tsx` (Hero-Bild, Galerie bis 12 Bilder),
  `DomainEinstellungen.tsx` (Subdomain und eigene Domain, nur Anzeige –
  eingetragen wird im Plattform-Admin).
- `app/website/[organisationId]` – die öffentliche Website selbst: Hero,
  Über uns, Tagesmenü, Speisekarte, Öffnungszeiten (aus dem
  Tischplan-Modul), eingebettetes `<BuchungsFormular>` (dasselbe wie unter
  `/reservieren`) und, solange mindestens ein Bestell-Kanal aktiv ist,
  `<BestellFormular>` (dasselbe wie unter `/bestellen`), Galerie, Kontakt.
- `proxy.ts` – zusätzlich zum Login-Schutz jetzt auch Domain-basiertes
  Routing: trifft eine Anfrage auf die Subdomain oder eigene Domain einer
  Organisation (statt der Plattform-Domain selbst), wird intern auf
  `/website/[organisationId]` umgeschrieben – unabhängig vom angefragten
  Pfad, diese Domains zeigen ausschließlich die öffentliche Website, nie
  Login/Dashboard.
- `lib/lager/` – Geschäftslogik von Lagerbestand & Wareneinkauf: `types.ts`
  (Typen), `regeln.ts` (einzige Stelle, die aus dem Bestellzyklus eines
  Lieferanten den nächsten Bestelltermin und die Fälligkeit berechnet),
  `daten.ts` (Datenbankzugriffe; `pruefungErstellen` ist idempotent –
  mehrfacher Aufruf für denselben Lieferanten/Termin erzeugt nie
  Duplikate).
- `app/dashboard/lager` – Personal-Ansicht: `LagerApp.tsx` (dieselbe
  PIN-Anmeldung wie Zeiterfassung/Dienstplan; ruft beim Öffnen
  `pruefungenSicherstellenAktion` auf, die fällige Prüfungen anlegt und
  anhand der Dienstplan-Schichten automatisch zuweist),
  `MeinePruefungen.tsx` (eigene zugewiesene Prüfungen, Artikel-Checkliste
  nachbestellen/Mengenwunsch), `LieferantenVerwaltung.tsx` (Zyklus
  wöchentlich/monatlich, Vorlaufzeit), `ArtikelVerwaltung.tsx` (je
  Lieferant, mit Mindestbestand), `PruefungenUebersicht.tsx` (alle
  Prüfungen, manuelle Zuweisung, Bestellliste), `export/route.ts`
  (Bestellliste einer erledigten Prüfung als Excel).
- `lib/bestellung/` – Geschäftslogik der Online-Bestellung: `types.ts`
  (Typen), `regeln.ts` (einzige Stelle für Kanal-Status, die Schnittmenge
  aus Kanal-Fenster und tatsächlichem Öffnungsfenster sowie die
  Kapazitätsprüfung – gilt identisch für die Slot-Anzeige und die
  tatsächliche Bestellung), `daten.ts` (Datenbankzugriffe inkl.
  Schnellpause/Kapazitätsgrenze).
- `app/dashboard/bestellung` – Personal-Ansicht: `BestellungApp.tsx`
  (dieselbe Organisations-Session wie der Tischplan, kein eigener
  PIN-Login), `BestellListe.tsx` (Bestellungen eines Tages, Status ändern),
  `BestellEinstellungenForm.tsx` (Abholung/Lieferung je einzeln
  ein-/ausschalten, eigenes Zeitfenster, Vorlauf, Kapazitätsgrenze,
  Schnellpause-Buttons mit Restzeit-Anzeige).
- `app/bestellen/[organisationId]` – öffentliche, nicht eingeloggte
  Bestellseite (Kanal wählen, Speisekarte mit Warenkorb, Zeitslot,
  Kontaktdaten) – dieselbe Komponente ist zugleich im Website-Modul
  eingebettet. In `proxy.ts` bewusst von der Login-Pflicht ausgenommen.
- `lib/bewertung/` – Geschäftslogik der Google-Bewertungsanfrage:
  `types.ts` (Typen, inkl. `BewertungsListenEintrag` fürs Dashboard),
  `daten.ts` (Einstellungen, Resend-ID je Reservierung/Bestellung,
  `ladeBewertungsUebersicht` fasst beide Quellen zusammen), `email.ts`
  (Mail-Text und -Versand über Resend, `scheduledAt` statt Cron-Job – wie
  bei der Reservierungs-Erinnerung), `aktionen.ts` (verknüpft mit
  Tischplan- UND Bestellung-Modul, ohne deren Code anzufassen: planen bei
  Status "erschienen"/"abgeschlossen", stornieren bei jedem anderen
  Statuswechsel).
- `app/dashboard/bewertung` – `BewertungApp.tsx` mit zwei Tabs:
  "Bewertungsliste" (erschienene Reservierungen + abgeschlossene
  Bestellungen an einem Ort, mit Hinweis, ob schon eine Anfrage geplant
  ist oder keine E-Mail hinterlegt war) und Einstellungen (Ein-/Ausschalten,
  Google-Bewertungslink, Verzögerung in Minuten). Die Statusänderung selbst
  bleibt im jeweiligen Modul – hier geht es nur um den Überblick, ohne dafür
  hin- und herwechseln zu müssen.
- `app/dashboard/tischplan/actions.ts` – `reservierungStatusAendernAktion`
  ruft nach einem erfolgreichen Statuswechsel `lib/bewertung/aktionen.ts`
  auf (identisches Cross-Modul-Muster wie beim Lagerbestand, der die
  Dienstplan-Schichten direkt liest). `app/dashboard/bestellung/actions.ts`
  macht dasselbe bei `bestellungStatusAendernAktion`.
- `lib/paypal/` – Dünner Wrapper um die PayPal Orders API v2:
  `types.ts`, `daten.ts` (Zugangsdaten + Webhook-ID je Organisation,
  Service-Role-only, Secret landet nie im Browser), `client.ts` (Order
  anlegen/erfassen, Redirect-Flow ohne JS-SDK; außerdem Webhook
  registrieren und dessen Signatur über PayPals eigenen
  Verify-Endpunkt prüfen, statt das Zertifikat selbst zu verifizieren).
  Modulübergreifend nutzbar, aktuell nur vom Gutschein-Verkauf verwendet.
- `lib/gutschein/` – Geschäftslogik des Gutschein-Verkaufs: `types.ts`,
  `daten.ts` (Code-Vergabe, Status-Übergänge offen → bezahlt → eingelöst,
  plus storniert, sowie `gutscheinNachPaypalOrderLaden` fürs
  Webhook-Routing), `email.ts` (Bestätigungsmail mit Code über Resend,
  gleiches Muster wie die übrigen Mail-Module), `zahlung.ts`
  (`gutscheinPaypalZahlungErfassen` – die eigentliche Capture-Logik,
  idempotent, von Rückkehr-Seite und Webhook gleichermaßen genutzt).
- `app/gutschein/[organisationId]` – öffentliche, nicht eingeloggte
  Kaufseite: Betrag wählen, Name/E-Mail angeben, dann entweder "Jetzt mit
  PayPal bezahlen" (nur sichtbar, wenn die Organisation PayPal aktiv und
  vollständig hinterlegt hat) oder "Bestellen, vor Ort bezahlen" (legt den
  Gutschein mit Status "Offen" an). `erfolg/page.tsx` ist die
  PayPal-Rückkehr-Seite, `app/api/paypal/webhook/[organisationId]` der
  unabhängige zweite Weg, falls der Käufer nie dorthin zurückfindet –
  beide rufen `lib/gutschein/zahlung.ts` auf.
- `lib/url.ts` – `herkunftUrl()`, aus dem eingehenden Request abgeleitet
  (funktioniert unabhängig von Subdomain/eigener Domain); gebraucht für
  PayPal-Rückkehr-URLs und die Webhook-Registrierung.
- `app/dashboard/gutschein` – `GutscheinApp.tsx` mit zwei Tabs: Liste
  verkaufter Gutscheine (als bezahlt markieren, per Code einlösen,
  stornieren) und Einstellungen (Verkauf an/aus + verfügbare Beträge,
  sowie das PayPal-Formular aus `lib/paypal/` – registriert beim Speichern
  automatisch den Webhook, kein manueller Schritt im
  PayPal-Entwickler-Dashboard nötig).
- `app/dashboard/BestellBenachrichtigung.tsx` + `app/dashboard/layout.tsx`
  – Hintergrund-Timer über alle Dashboard-Seiten hinweg, der neue
  Bestellungen erkennt und einen Banner einblendet (In-App, kein Service
  Worker). `lib/bestellung/email.ts` ergänzt die Eingangs-/Status-Mail an
  Kunden und die optionale Benachrichtigungsmail ans Personal.
- `lib/zeiterfassung/dokumente.ts` +
  `app/dashboard/zeiterfassung/MitarbeiterDokumente.tsx` +
  `app/dashboard/zeiterfassung/dokumente/[id]/route.ts` – private
  Dokumentenablage je Mitarbeiter (Arbeitsverträge & Co.): Upload/Löschen
  über Server Actions, Download ausschließlich über die Route, die vorher
  die Leitungs-Session prüft, nie über eine öffentliche/signierte URL.
  `app/dashboard/zeiterfassung/export/route.ts` kennt zusätzlich
  `format=buchhaltung` für den Steuerberater-Export (ein Blatt pro
  Mitarbeiter, voller Monat).
- `app/dashboard/dienstplan/ExportAnsicht.tsx` +
  `app/dashboard/dienstplan/export/route.ts` – Wochen-/Monatsplan als
  Excel, analog zum Zeiterfassungs-Export.
- `app/dashboard/lager/BestellungUebersicht.tsx` – neuer Tab, gruppiert
  die offenen "Nachbestellen"-Artikel abgeschlossener Prüfungen nach
  Lieferant; `lib/lager/email.ts` verschickt die Bestellung erst nach
  explizitem Klick auf "Jetzt senden" (nie automatisch), `daten.ts` dafür
  um `ladeOffeneBestellEintraege`/`eintragBestellungSetzen`/
  `eintraegeAlsBestelltMarkieren` ergänzt.

## Nächste Schritte

1. ~~Zeiterfassung aus `zeiterfassung-liva-bad-nauheim` portieren~~ –
   erledigt (siehe "Aktueller Stand" und "Aufbau").
2. ~~Tischplan & Reservierungen aus `liva-bad-nauheim` portieren~~ –
   erledigt (siehe "Aktueller Stand" und "Aufbau").
3. ~~Dienstplan/Schichtplanung~~ – erledigt (siehe "Aktueller Stand" und
   "Aufbau").
4. ~~Lagerbestand/Wareneinkauf~~ – erledigt (siehe "Aktueller Stand" und
   "Aufbau").
5. ~~Gutschein-Verkauf~~ – erledigt (siehe "Aktueller Stand" und
   "Aufbau"), zurückgestellt bis Modul 8 (PayPal) stand, dann zusammen
   damit gebaut.
6. ~~Automatisierte Google-Bewertungsanfrage~~ – erledigt (siehe
   "Aktueller Stand" und "Aufbau"), vorgezogen vor Modul 5. Bewusst nur
   E-Mail (Resend, schon vorhanden), kein SMS-Versand – dafür wäre ein
   weiterer Anbieter nötig, der aktuell nicht gebraucht wird.
7. ~~Online-Bestellung zum Abholen/Liefern~~ – erledigt (siehe "Aktueller
   Stand" und "Aufbau"), vorgezogen vor Modul 5/6. Bewusst ohne
   Zahlungsabwicklung – Zahlung bleibt Barzahlung/Kartenzahlung bei
   Abholung bzw. Lieferung. PayPal als Zusatzoption (siehe Punkt 8) wurde
   bewusst nur für den Gutschein-Verkauf angebunden, nicht hier – kann bei
   Bedarf separat nachgerüstet werden (`lib/paypal/` ist bereits
   modulübergreifend nutzbar).
8. ~~Automatisierte Online-Zahlung (PayPal statt Stripe, organisations-
   eigenes Konto statt Plattform-Sammelkonto)~~ – erledigt (siehe
   "Aktueller Stand" und "Aufbau"), macht Modul 5 (Gutscheine) erst richtig
   sinnvoll. ~~Bewusst ohne Webhooks~~ – inzwischen nachgerüstet (Migration
   `0014`, `app/api/paypal/webhook/[organisationId]`): schließt genau die
   Lücke, die hier ursprünglich offen war (abgebrochene Zahlungen, bei
   denen der Käufer nie zur Rückkehr-Seite zurückfindet).
9. ~~Sicherheits-Audit vor dem Livegang~~ – erledigt (siehe
   "Sicherheits-Audit" oben): Mandantentrennung lückenlos geprüft,
   Nebenläufigkeits-Fehler (Doppeleinlösung, Doppelversand, Kapazitäts-
   Rennen) geschlossen, PIN-/Session-Sicherheit gehärtet, PayPal-Betrag
   verifiziert, Spam-/Brute-Force-Schutz auf allen öffentlichen Formularen.
10. ~~Markenauftritt & Layout ("Konzertsaal")~~ – erledigt (siehe
    "Markenauftritt & Layout" oben).
11. **Vor dem echten Livegang noch offen** (siehe Setup-Checkliste +
    Rechtliches):
    - ~~Impressum, Datenschutzerklärung~~ – als Vorlage umgesetzt (siehe
      "Rechtliches" oben). Noch offen: Platzhalter in
      `lib/rechtliches/plattform.ts` füllen, anwaltliche Prüfung der Texte,
      Auftragsverarbeitungsvertrag (AVV) mit jeder Organisation.
    - ~~Domain-/Markenprüfung~~ – erledigt, Name auf "Maestoso" geändert
      (siehe "Aktueller Stand" oben), Domain `maestoso.io` tatsächlich
      registrieren, sobald es an den Live-Betrieb geht.
    - Produktivumgebung einrichten (echtes Supabase-Projekt, echte
      Umgebungsvariablen, Resend-Absende-Domain verifizieren, PayPal auf
      Live-Modus je Organisation umstellen) – siehe "Setup" oben.
    - Einmal komplett mit echten Daten durch alle Module klicken
      (bisher nur per Demo-Artefakt und `npm run build`/`eslint` geprüft,
      nie mit einem echten Supabase-Projekt im Browser).
12. ~~Statistiken/Auswertungen je Modul~~ – erledigt (siehe "Statistiken &
    Auswertungen" oben): Tischplan-Auslastung, Bestellung-Analyse,
    Gutschein-Verbindlichkeiten, Bewertungs-Klickrate, Google-Bewertungstrend
    (Letzterer vorerst manuell erfasst statt per Google-API, siehe dort).
13. **Kassensystem-Integration** – als generischer Adapter pro Anbieter
    angedacht (analog `lib/paypal/`), hängt davon ab, welches
    Kassensystem die Kunden tatsächlich einsetzen – noch nicht begonnen.
14. ~~Veranstaltungsplanung~~ – erledigt (siehe "Veranstaltungsplanung"
    oben): eigenes Modul statt Tischplan-Tab, an die bestehenden
    Blockierungen angedockt statt eigener Kapazitätsprüfung.

Mit Punkt 11 abgeschlossen ist das Projekt technisch bereit für den
ersten echten Kunden; rechtlich und betrieblich (siehe Punkt 11) stehen
noch Schritte aus, die außerhalb von Code liegen.
