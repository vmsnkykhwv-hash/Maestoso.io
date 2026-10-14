// Verknüpft die Bewertungsanfrage mit dem Tischplan-Modul, ohne dessen
// eigenen Code anzufassen: aufgerufen aus
// app/dashboard/tischplan/actions.ts, sobald sich der Reservierungsstatus
// ändert (derselbe Aufbau wie beim Lagerbestand-Modul, das die
// Dienstplan-Schichten direkt liest statt dort Code einzubauen).

import { ladeReservierung, organisationsName } from '@/lib/tischplan/daten'
import {
  ladeBestellung,
  bestellungBewertungAnfrageBeanspruchen,
  bestellungBewertungResendId,
  bestellungBewertungResendIdSetzen,
  BEWERTUNG_WIRD_GEPLANT as BESTELLUNG_BEWERTUNG_WIRD_GEPLANT,
} from '@/lib/bestellung/daten'
import { berlinZeitpunktAlsUtc } from '@/lib/datum'
import {
  ladeBewertungsEinstellungen,
  reservierungBewertungAnfrageBeanspruchen,
  reservierungBewertungResendId,
  reservierungBewertungResendIdSetzen,
  BEWERTUNG_WIRD_GEPLANT,
} from './daten'
import { bewertungsanfrageSenden, bewertungsanfrageStornieren } from './email'

export async function bewertungsanfragePlanen(organisationId: string, reservierungId: string): Promise<void> {
  const einstellungen = await ladeBewertungsEinstellungen(organisationId)
  if (!einstellungen.aktiv || !einstellungen.googleUrl) return

  // Bedingtes Update (claim) statt Lesen-dann-Schreiben – verhindert, dass
  // zwei fast gleichzeitige Statusänderungen (z. B. Status versehentlich
  // zurück- und wieder auf "erschienen" gesetzt, oder ein Doppelklick) zwei
  // Bewertungsmails für dieselbe Reservierung auslösen.
  const beansprucht = await reservierungBewertungAnfrageBeanspruchen(reservierungId)
  if (!beansprucht) return

  const [reservierung, organisationName] = await Promise.all([
    ladeReservierung(reservierungId),
    organisationsName(organisationId),
  ])
  if (!reservierung || !organisationName) {
    await reservierungBewertungResendIdSetzen(reservierungId, null) // claim wieder freigeben
    return
  }

  const ergebnis = await bewertungsanfrageSenden({
    organisationName,
    empfaenger: reservierung.email,
    name: reservierung.name,
    googleUrl: einstellungen.googleUrl,
    ankerZeitpunkt: berlinZeitpunktAlsUtc(reservierung.datum, reservierung.uhrzeit),
    verzoegerungMinuten: einstellungen.verzoegerungMinuten,
  })

  // Versand fehlgeschlagen: claim wieder freigeben, damit ein späterer
  // Statuswechsel es erneut versuchen kann, statt für immer auf dem
  // Platzhalter stehen zu bleiben.
  await reservierungBewertungResendIdSetzen(reservierungId, ergebnis.resendId ?? null)
}

export async function bewertungsanfrageStornierenFuerReservierung(reservierungId: string): Promise<void> {
  const resendId = await reservierungBewertungResendId(reservierungId)
  if (!resendId) return

  // Platzhalter (Mail wird gerade in einem anderen Request geplant) nie an
  // die Resend-API schicken – nur zurücksetzen.
  if (resendId !== BEWERTUNG_WIRD_GEPLANT) await bewertungsanfrageStornieren(resendId)
  await reservierungBewertungResendIdSetzen(reservierungId, null)
}

// Gleiches Prinzip wie oben, nur für Online-Bestellungen (Status
// "Abgeschlossen") statt Reservierungen – aufgerufen aus
// app/dashboard/bestellung/actions.ts.
export async function bewertungsanfragePlanenFuerBestellung(organisationId: string, bestellungId: string): Promise<void> {
  const einstellungen = await ladeBewertungsEinstellungen(organisationId)
  if (!einstellungen.aktiv || !einstellungen.googleUrl) return

  // Bedingtes Update (claim) statt Lesen-dann-Schreiben – siehe
  // bewertungsanfragePlanen oben, gleiche Begründung.
  const beansprucht = await bestellungBewertungAnfrageBeanspruchen(bestellungId)
  if (!beansprucht) return

  const [bestellung, organisationName] = await Promise.all([ladeBestellung(bestellungId), organisationsName(organisationId)])
  if (!bestellung || !bestellung.email || !organisationName) {
    await bestellungBewertungResendIdSetzen(bestellungId, null) // claim wieder freigeben
    return
  }

  const ergebnis = await bewertungsanfrageSenden({
    organisationName,
    empfaenger: bestellung.email,
    name: bestellung.name,
    googleUrl: einstellungen.googleUrl,
    ankerZeitpunkt: berlinZeitpunktAlsUtc(bestellung.datum, bestellung.uhrzeit),
    verzoegerungMinuten: einstellungen.verzoegerungMinuten,
  })

  await bestellungBewertungResendIdSetzen(bestellungId, ergebnis.resendId ?? null)
}

export async function bewertungsanfrageStornierenFuerBestellung(bestellungId: string): Promise<void> {
  const resendId = await bestellungBewertungResendId(bestellungId)
  if (!resendId) return

  if (resendId !== BESTELLUNG_BEWERTUNG_WIRD_GEPLANT) await bewertungsanfrageStornieren(resendId)
  await bestellungBewertungResendIdSetzen(bestellungId, null)
}
