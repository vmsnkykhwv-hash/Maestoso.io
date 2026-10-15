import { PLATTFORM_BETREIBER, STAND_RECHTSTEXTE } from '@/lib/rechtliches/plattform'
import Anbieterangaben from './Anbieterangaben'
import Betroffenenrechte from './Betroffenenrechte'
import Dienstleisterliste from './Dienstleisterliste'
import { Abschnitt } from './RechtsSeite'

// Datenschutzerklärung der Plattform selbst (Login, Dashboard,
// Plattform-Admin). Die Daten, die Betriebe über ihre Gäste und ihr Personal
// eingeben, verarbeitet Maestoso dagegen nur im Auftrag – dafür ist der
// jeweilige Betrieb verantwortlich (eigene Datenschutzerklärung je Betrieb).
export default function DatenschutzPlattform() {
  return (
    <>
      <Abschnitt titel="Verantwortlicher">
        <Anbieterangaben angaben={PLATTFORM_BETREIBER} />
      </Abschnitt>

      <Abschnitt titel="Worum es hier geht">
        <p>
          Diese Erklärung gilt für die Nutzung der Plattform Maestoso durch Gastronomiebetriebe und ihr Personal
          (Anmeldung, Dashboard, Verwaltung). Alles, was ein Betrieb über seine Gäste oder Mitarbeitenden in
          Maestoso erfasst, verarbeiten wir als Auftragsverarbeiter für diesen Betrieb (Art. 28 DSGVO).
          Verantwortlich ist dafür der jeweilige Betrieb; seine Datenschutzerklärung ist auf seinen Gästeseiten
          verlinkt.
        </p>
      </Abschnitt>

      <Abschnitt titel="Hosting und Dienstleister">
        <p>Für den Betrieb der Plattform setzen wir folgende Dienstleister als Auftragsverarbeiter ein:</p>
        <Dienstleisterliste />
      </Abschnitt>

      <Abschnitt titel="Anmeldung und Nutzung">
        <p>
          Für persönliche Konten verarbeiten wir E-Mail-Adresse, Name und Passwort; das Passwort speichern wir nur als
          kryptografischen Hash, nie im Klartext. Für die Zwei-Faktor-Anmeldung speichern wir ein verschlüsseltes
          Geheimnis für deine Authenticator-App und Wiederherstellungscodes als Hash. Für Einladungen und „Passwort
          vergessen“ schicken wir dir E-Mails mit einmal gültigen Links. Mitarbeitende melden sich an den Geräten des
          Betriebs mit einer PIN an, die ebenfalls nur als Hash gespeichert wird.
        </p>
        <p>
          Zum Schutz vor dem Durchprobieren von Passwörtern, Codes und PINs zählen wir Fehlversuche und sperren nach
          zu vielen Versuchen vorübergehend. Rechtsgrundlage ist die Erfüllung des Nutzungsvertrags mit dem Betrieb
          (Art. 6 Abs. 1 lit. b DSGVO) und unser berechtigtes Interesse an einem sicheren Betrieb (Art. 6 Abs. 1 lit.
          f DSGVO).
        </p>
      </Abschnitt>

      <Abschnitt titel="Cookies">
        <p>Wir setzen ausschließlich Cookies, die für die von dir gewünschten Funktionen nötig sind:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Sitzungs-Cookies, die dich nach der Anmeldung angemeldet halten (Verwaltungskonto bzw. Mitarbeiter*in),</li>
          <li>ein kurzlebiges Cookie (10 Minuten) für den Schritt zwischen Passwort und Zwei-Faktor-Code,</li>
          <li>
            ein Geräte-Cookie, wenn ein Betrieb ein Tresen-Gerät freigibt oder ein Handy koppelt – es enthält nur eine
            zufällige Geräte-Kennung und gilt bis zu 400 Tage oder bis das Gerät entzogen wird,
          </li>
          <li>ein Cookie, der sich deine Wahl zwischen hellem und dunklem Design merkt.</li>
        </ul>
        <p>
          Diese Cookies sind unbedingt erforderlich und brauchen deshalb keine Einwilligung (§ 25 Abs. 2 Nr. 2
          TDDDG). Analyse- oder Werbe-Cookies gibt es nicht. Schriftarten werden von unserem eigenen Server
          geladen, nicht von Google.
        </p>
      </Abschnitt>

      <Abschnitt titel="Speicherdauer">
        <p>
          Sitzungs-Cookies laufen nach Ablauf der Sitzung bzw. beim Abmelden ab, der Design-Cookie nach einem
          Jahr, das Geräte-Cookie nach spätestens 400 Tagen. Konto- und Vertragsdaten löschen wir nach Vertragsende, soweit keine gesetzlichen
          Aufbewahrungspflichten (bis zu zehn Jahre, § 147 AO, § 257 HGB) entgegenstehen.
        </p>
      </Abschnitt>

      <Betroffenenrechte />

      <p className="text-xs text-muted">Stand: {STAND_RECHTSTEXTE}</p>
    </>
  )
}
