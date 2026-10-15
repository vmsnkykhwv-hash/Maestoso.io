'use server'

import { aktionFuer, verwaltungFuer } from '@/lib/zugriff'
import {
  bestellEinstellungenSpeichern,
  bestellungenGesehenMarkieren,
  bestellungStatusAendern,
  kanalPauseAufheben,
  kanalPausieren,
  ladeBestellEinstellungen,
  ladeBestellung,
  ladeBestellungenFuerTag,
  ladeBestellungenSchlankFuerZeitraum,
  neueBestellungenAnzahl,
} from '@/lib/bestellung/daten'
import { bestellStatusMailSenden } from '@/lib/bestellung/email'
import { organisationsName } from '@/lib/tischplan/daten'
import { bewertungsanfragePlanenFuerBestellung, bewertungsanfrageStornierenFuerBestellung } from '@/lib/bewertung/aktionen'
import { berechneBestellAnalyse, type BestellungAuswertung } from '@/lib/bestellung/auswertung'
import type { Bestellung, BestellEinstellungen, BestellKanal, BestellStatus } from '@/lib/bestellung/types'
import { mitProtokoll, protokollieren } from '@/lib/protokoll'
import { BESTELL_STATUS_LABEL } from '@/lib/bestellung/types'

// Tagesgeschäft: Verwaltungskonto oder Tresen-Gerät mit freigeschalteter
// Mitarbeiterin, nicht vom Handy aus.
async function organisationIdOderFehler(): Promise<string> {
  return (await aktionFuer('bestellung', { ohneHandy: true })).organisationId
}

// Einstellungen und Auswertungen: nur Verwaltungskonto.
async function verwaltungsIdOderFehler(): Promise<string> {
  return (await verwaltungFuer('bestellung')).organisationId
}

export async function einstellungenLadenAktion(): Promise<BestellEinstellungen> {
  const organisationId = await organisationIdOderFehler()
  return ladeBestellEinstellungen(organisationId)
}

export async function einstellungenSpeichernAktion(
  einstellungen: Omit<BestellEinstellungen, 'abholungPausiertBis' | 'lieferungPausiertBis' | 'abholungPauseGrund' | 'lieferungPauseGrund'>
): Promise<{ fehler?: string }> {
  const organisationId = await verwaltungsIdOderFehler()
  return mitProtokoll(bestellEinstellungenSpeichern(organisationId, einstellungen), 'bestellung', 'Einstellungen geändert', null, null)
}

export async function kanalPausierenAktion(kanal: BestellKanal, minuten: number, grund?: string): Promise<{ fehler?: string }> {
  const organisationId = await organisationIdOderFehler()
  return mitProtokoll(kanalPausieren(organisationId, kanal, minuten, grund), 'bestellung', 'Kanal pausiert', `${kanal === 'abholung' ? 'Abholung' : 'Lieferung'}, ${minuten} Min.`, null)
}

export async function kanalPauseAufhebenAktion(kanal: BestellKanal): Promise<{ fehler?: string }> {
  const organisationId = await organisationIdOderFehler()
  return mitProtokoll(kanalPauseAufheben(organisationId, kanal), 'bestellung', 'Pause aufgehoben', kanal === 'abholung' ? 'Abholung' : 'Lieferung', null)
}

export async function bestellungenFuerTagLadenAktion(datum: string): Promise<Bestellung[]> {
  const organisationId = await organisationIdOderFehler()
  const bestellungen = await ladeBestellungenFuerTag(organisationId, datum)

  // Der "Neu"-Marker im UI beruht auf dem hier zurückgegebenen Stand (vor
  // dieser Markierung) – erst der nächste Abruf zeigt sie als nicht mehr neu.
  const ungeseheneIds = bestellungen.filter((b) => !b.gesehen).map((b) => b.id)
  await bestellungenGesehenMarkieren(ungeseheneIds)

  return bestellungen
}

export async function bestellungStatusAendernAktion(id: string, status: BestellStatus): Promise<{ fehler?: string }> {
  const organisationId = await organisationIdOderFehler()
  const ergebnis = await bestellungStatusAendern(id, organisationId, status)
  if (ergebnis.fehler) return ergebnis

  await bestellungenGesehenMarkieren([id])

  if (status === 'bestaetigt' || status === 'storniert') {
    const bestellung = await ladeBestellung(id)
    if (bestellung?.email) {
      const organisationName = await organisationsName(organisationId)
      if (organisationName) {
        await bestellStatusMailSenden({
          organisationName,
          empfaenger: bestellung.email,
          name: bestellung.name,
          kanal: bestellung.kanal,
          datum: bestellung.datum,
          uhrzeit: bestellung.uhrzeit,
          status,
        })
      }
    }
  }

  // Bewertungsanfrage ist an "Abgeschlossen" gekoppelt, nie an die
  // Bestellung an sich – ein Storno soll nie um eine Rezension bitten.
  // Wechselt der Status danach wieder weg, wird eine bereits geplante Mail
  // storniert (gleiches Prinzip wie bei Reservierungen, siehe
  // app/dashboard/tischplan/actions.ts).
  if (status === 'abgeschlossen') await bewertungsanfragePlanenFuerBestellung(organisationId, id)
  else await bewertungsanfrageStornierenFuerBestellung(id)

  await protokollieren('bestellung', 'Bestellung: Status geändert', BESTELL_STATUS_LABEL[status], id)
  return {}
}

export async function bestellAnalyseLadenAktion(von: string, bis: string): Promise<BestellungAuswertung> {
  const organisationId = await verwaltungsIdOderFehler()
  const bestellungen = await ladeBestellungenSchlankFuerZeitraum(organisationId, von, bis)
  return berechneBestellAnalyse(bestellungen)
}

export async function neueBestellungenAnzahlAktion(): Promise<number> {
  const organisationId = await organisationIdOderFehler()
  return neueBestellungenAnzahl(organisationId)
}
