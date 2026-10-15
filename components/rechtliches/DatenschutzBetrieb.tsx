import type { ModulSchluessel } from '@/lib/module'
import { PLATTFORM_BETREIBER, STAND_RECHTSTEXTE } from '@/lib/rechtliches/plattform'
import type { RechtlicheAngaben } from '@/lib/rechtliches/types'
import Anbieterangaben from './Anbieterangaben'
import Betroffenenrechte from './Betroffenenrechte'
import Dienstleisterliste from './Dienstleisterliste'
import { Abschnitt } from './RechtsSeite'

// Datenschutzerklärung für die Gästeseiten eines Betriebs. Abschnitte zu
// einzelnen Funktionen erscheinen nur, wenn das zugehörige Modul
// freigeschaltet ist – sonst stünden dort Verarbeitungen, die es bei diesem
// Betrieb gar nicht gibt.
export default function DatenschutzBetrieb({
  angaben,
  freischaltungen,
}: {
  angaben: RechtlicheAngaben
  freischaltungen: Record<ModulSchluessel, boolean>
}) {
  return (
    <>
      <Abschnitt titel="Verantwortlicher">
        <Anbieterangaben angaben={angaben} />
        {angaben.datenschutzKontakt && <p>Datenschutzbeauftragte*r: {angaben.datenschutzKontakt}</p>}
      </Abschnitt>

      <Abschnitt titel="Technischer Betrieb durch Maestoso">
        <p>
          Diese Seiten und die zugehörigen Formulare laufen auf der Plattform Maestoso, betrieben von{' '}
          {PLATTFORM_BETREIBER.firma}, {PLATTFORM_BETREIBER.strasse}, {PLATTFORM_BETREIBER.plzOrt}. Maestoso
          verarbeitet deine Daten ausschließlich in unserem Auftrag und nach unseren Weisungen
          (Auftragsverarbeitung nach Art. 28 DSGVO) und setzt dafür folgende Unterauftragsverarbeiter ein:
        </p>
        <Dienstleisterliste />
      </Abschnitt>

      <Abschnitt titel="Aufruf der Seiten">
        <p>
          Beim Aufruf verarbeitet der Hosting-Anbieter technisch notwendige Daten wie IP-Adresse, Zeitpunkt,
          aufgerufene Adresse und Browser-Kennung, um die Seite auszuliefern und vor Angriffen zu schützen. Zum
          Schutz unserer Formulare vor massenhaftem Missbrauch zählen wir außerdem für kurze Zeit die
          Absendeversuche je IP-Adresse. Rechtsgrundlage ist unser berechtigtes Interesse an einem sicheren
          Betrieb (Art. 6 Abs. 1 lit. f DSGVO).
        </p>
        <p>
          Auf diesen Seiten werden keine Cookies gesetzt und keine Analyse- oder Werbedienste eingebunden.
          Schriftarten werden von unserem eigenen Server geladen, nicht von Google.
        </p>
      </Abschnitt>

      {freischaltungen.tischplan && (
        <Abschnitt titel="Tischreservierung">
          <p>
            Für eine Reservierung verarbeiten wir Name, E-Mail-Adresse, Datum, Uhrzeit und Personenzahl, um deinen
            Tisch freizuhalten und dir eine Bestätigung per E-Mail zu schicken. Rechtsgrundlage ist die
            Durchführung der Reservierung (Art. 6 Abs. 1 lit. b DSGVO).
          </p>
        </Abschnitt>
      )}

      {freischaltungen.bestellung && (
        <Abschnitt titel="Online-Bestellung">
          <p>
            Für eine Bestellung zur Abholung oder Lieferung verarbeiten wir Name, Telefonnummer, optional
            E-Mail-Adresse, bei Lieferung die Lieferadresse, die bestellten Speisen und deine Anmerkungen. Wir
            nutzen sie, um die Bestellung zuzubereiten, auszuliefern und dich bei Rückfragen zu erreichen
            (Art. 6 Abs. 1 lit. b DSGVO). Bezahlt wird bei Abholung bzw. Lieferung.
          </p>
        </Abschnitt>
      )}

      {freischaltungen.gutschein && (
        <Abschnitt titel="Gutscheinkauf">
          <p>
            Beim Kauf eines Gutscheins verarbeiten wir Name, E-Mail-Adresse, Betrag, Zahlungsart und den
            Gutscheincode, um dir den Gutschein auszustellen und ihn bei der Einlösung zu prüfen (Art. 6 Abs. 1
            lit. b DSGVO).
          </p>
          <p>
            Wählst du die Zahlung per PayPal, wirst du zu PayPal (Europe) S.à r.l. et Cie, S.C.A., 22–24 Boulevard
            Royal, L-2449 Luxemburg weitergeleitet. PayPal verarbeitet deine Zahlungsdaten in eigener
            Verantwortung; es gilt die Datenschutzerklärung von PayPal. Wir erhalten von PayPal nur die
            Bestätigung der Zahlung.
          </p>
        </Abschnitt>
      )}

      {freischaltungen.veranstaltung && (
        <Abschnitt titel="Anfrage für Veranstaltungen">
          <p>
            Für eine Veranstaltungsanfrage verarbeiten wir Titel, Ansprechpartner*in, E-Mail-Adresse,
            Telefonnummer, Wunschtermin, geschätzte Gästezahl und deine Anmerkungen, um dir ein Angebot zu machen
            und die Veranstaltung zu planen (Art. 6 Abs. 1 lit. b DSGVO, vorvertragliche Maßnahmen).
          </p>
        </Abschnitt>
      )}

      {freischaltungen.bewertung && (
        <Abschnitt titel="Bitte um eine Bewertung">
          <p>
            Nach deinem Besuch bzw. einer abgeschlossenen Bestellung schicken wir dir an die angegebene
            E-Mail-Adresse einmalig eine Bitte, uns bei Google zu bewerten. Dabei wird erfasst, ob die E-Mail
            geöffnet und der Link angeklickt wurde, damit wir sehen, ob die Anfragen ankommen. Rechtsgrundlage ist
            unser berechtigtes Interesse an Rückmeldungen unserer Gäste (Art. 6 Abs. 1 lit. f DSGVO, § 7 Abs. 3
            UWG). Du kannst dem jederzeit widersprechen, z. B. per E-Mail an {angaben.email}, ohne dass dafür
            andere als die Übermittlungskosten nach den Basistarifen entstehen.
          </p>
        </Abschnitt>
      )}

      <Abschnitt titel="Speicherdauer">
        <p>
          Wir löschen deine Daten, sobald sie für den jeweiligen Zweck nicht mehr gebraucht werden. Daten zu
          Käufen und Zahlungen bewahren wir so lange auf, wie es handels- und steuerrechtliche Pflichten
          vorschreiben (bis zu zehn Jahre, § 147 AO, § 257 HGB).
        </p>
      </Abschnitt>

      <Betroffenenrechte />

      <p className="text-xs text-muted">Stand: {STAND_RECHTSTEXTE}</p>
    </>
  )
}
