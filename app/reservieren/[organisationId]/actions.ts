'use server'

import { heuteBerlin } from '@/lib/datum'
import {
  ladeAusnahmeFuerDatum,
  ladeBlockierungenFuerTag,
  ladeEinstellungen,
  ladeReservierungenFuerTag,
  ladeTische,
  organisationsName,
  reservierungErstellenMitPruefung,
  reservierungResendIdSetzen,
} from '@/lib/tischplan/daten'
import { pruefeBuchung, verfuegbareSlots } from '@/lib/tischplan/regeln'
import { reservierungsMailsSenden } from '@/lib/tischplan/email'
import { oeffentlicheAnfrageSchluessel, rateLimitFehlgeschlagen, rateLimitPruefen, warteHinweis } from '@/lib/rateLimit'
import type { SlotVerfuegbarkeit } from '@/lib/tischplan/types'

const EMAIL_MUSTER = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SPERRE_AB_VERSUCHEN = 8

export async function organisationOeffentlichLadenAktion(organisationId: string): Promise<{ name: string } | null> {
  const name = await organisationsName(organisationId)
  return name ? { name } : null
}

export async function slotsLadenAktion(organisationId: string, datum: string, anzahlPersonen: number): Promise<SlotVerfuegbarkeit[]> {
  if (datum < heuteBerlin()) return []

  const [einstellungen, tische, reservierungenDesTages, blockierungenDesTages, ausnahme] = await Promise.all([
    ladeEinstellungen(organisationId),
    ladeTische(organisationId),
    ladeReservierungenFuerTag(organisationId, datum),
    ladeBlockierungenFuerTag(organisationId, datum),
    ladeAusnahmeFuerDatum(organisationId, datum),
  ])

  if (tische.length === 0) return []

  return verfuegbareSlots({
    einstellungen,
    gesamtTische: tische.length,
    anzahlPersonen,
    datum,
    reservierungenDesTages,
    blockierungenDesTages,
    ausnahme,
  })
}

export async function reservierungAnlegenAktion(input: {
  organisationId: string
  name: string
  email: string
  anzahlPersonen: number
  datum: string
  uhrzeit: string
  erinnerung: boolean
}): Promise<{ fehler?: string; erfolg?: boolean }> {
  const name = input.name.trim()
  const email = input.email.trim()

  if (name.length < 1 || name.length > 50) return { fehler: 'Bitte einen Namen angeben.' }
  if (!EMAIL_MUSTER.test(email)) return { fehler: 'Bitte eine gültige E-Mail-Adresse angeben.' }
  if (input.datum < heuteBerlin()) return { fehler: 'Dieses Datum liegt in der Vergangenheit.' }

  // Spam-Schutz: ein Skript, das automatisiert Reservierungen anlegt, soll
  // schnell ausgebremst werden – pro Organisation + IP, nicht global, damit
  // eine Spam-Welle gegen eine Organisation nicht alle anderen mitbremst.
  const sperrschluessel = await oeffentlicheAnfrageSchluessel('reservierung', input.organisationId)
  const sperre = await rateLimitPruefen(sperrschluessel)
  if (!sperre.erlaubt) return { fehler: warteHinweis(sperre.wartenSekunden!) }

  const organisationName = await organisationsName(input.organisationId)
  if (!organisationName) return { fehler: 'Diese Organisation wurde nicht gefunden.' }

  const [einstellungen, tische, reservierungenDesTages, blockierungenDesTages, ausnahme] = await Promise.all([
    ladeEinstellungen(input.organisationId),
    ladeTische(input.organisationId),
    ladeReservierungenFuerTag(input.organisationId, input.datum),
    ladeBlockierungenFuerTag(input.organisationId, input.datum),
    ladeAusnahmeFuerDatum(input.organisationId, input.datum),
  ])

  if (tische.length === 0) {
    return { fehler: 'Diese Organisation hat noch keine Tische hinterlegt.' }
  }

  // Serverseitig nochmal exakt dieselbe Prüfung wie bei der Slot-Anzeige –
  // verhindert, dass zwischen Anzeige und Absenden ein anderer Gast den
  // letzten Tisch gebucht hat.
  const pruefung = pruefeBuchung({
    einstellungen,
    gesamtTische: tische.length,
    anzahlPersonen: input.anzahlPersonen,
    datum: input.datum,
    uhrzeit: input.uhrzeit,
    reservierungenDesTages,
    blockierungenDesTages,
    ausnahme,
  })

  if (!pruefung.ok) return { fehler: pruefung.grund }

  await rateLimitFehlgeschlagen(sperrschluessel, SPERRE_AB_VERSUCHEN)

  const ergebnis = await reservierungErstellenMitPruefung(input.organisationId, {
    name,
    email,
    anzahlPersonen: input.anzahlPersonen,
    datum: input.datum,
    uhrzeit: input.uhrzeit,
    dauerMinuten: einstellungen.dauerMinuten,
    gesamtTische: tische.length,
    maxPersonenGleichzeitig: einstellungen.maxPersonenGleichzeitig,
    erinnerung: input.erinnerung,
  })

  if (ergebnis.fehler || !ergebnis.reservierung) {
    return { fehler: ergebnis.fehler ?? 'Reservierung konnte nicht gespeichert werden.' }
  }

  const mail = await reservierungsMailsSenden({
    organisationName,
    empfaenger: email,
    name,
    datum: input.datum,
    uhrzeit: input.uhrzeit,
    anzahlPersonen: input.anzahlPersonen,
    erinnerung: input.erinnerung,
  })

  if (mail.resendId) {
    await reservierungResendIdSetzen(ergebnis.reservierung.id, mail.resendId)
  }

  return { erfolg: true }
}
