'use server'

import { aktionFuer, verwaltungFuer } from '@/lib/zugriff'
import { bewertungsanfragePlanen, bewertungsanfrageStornierenFuerReservierung } from '@/lib/bewertung/aktionen'
import {
  ausnahmeLoeschen,
  ausnahmeSpeichern,
  blockierungErstellen,
  blockierungLoeschen,
  einstellungenSpeichern,
  ladeAusnahmeFuerDatum,
  ladeAusnahmen,
  ladeBlockierungenFuerTag,
  ladeEinstellungen,
  ladeReservierungenFuerTag,
  ladeReservierungenFuerZeitraum,
  ladeTische,
  reservierungErstellenMitPruefung,
  reservierungStatusAendern,
  reservierungTischZuweisen,
  tischAktualisieren,
  tischErstellen,
  tischLoeschen,
} from '@/lib/tischplan/daten'
import { pruefeBuchung } from '@/lib/tischplan/regeln'
import { berechneAuslastung, type TischplanAuswertung } from '@/lib/tischplan/auswertung'
import type { Blockierung, Einstellungen, Reservierung, ReservierungAusnahme, ReservierungStatus, Tisch } from '@/lib/tischplan/types'

// Tagesgeschäft: Verwaltungskonto oder Tresen-Gerät mit freigeschalteter
// Mitarbeiterin, nicht vom Handy aus.
async function organisationIdOderFehler(): Promise<string> {
  return (await aktionFuer('tischplan', { ohneHandy: true })).organisationId
}

// Einstellungen und Auswertungen: nur Verwaltungskonto.
async function verwaltungsIdOderFehler(): Promise<string> {
  return (await verwaltungFuer('tischplan')).organisationId
}

export async function einstellungenSpeichernAktion(einstellungen: Einstellungen): Promise<{ fehler?: string }> {
  const organisationId = await verwaltungsIdOderFehler()
  return einstellungenSpeichern(organisationId, einstellungen)
}

export async function tischAnlegenAktion(input: { name: string; kapazitaet: number }): Promise<{ fehler?: string; tisch?: Tisch }> {
  const organisationId = await verwaltungsIdOderFehler()
  return tischErstellen(organisationId, input)
}

export async function tischAktualisierenAktion(tischId: string, patch: { name?: string; kapazitaet?: number }): Promise<{ fehler?: string }> {
  const organisationId = await verwaltungsIdOderFehler()
  return tischAktualisieren(tischId, organisationId, patch)
}

export async function tischLoeschenAktion(tischId: string): Promise<{ fehler?: string }> {
  const organisationId = await verwaltungsIdOderFehler()
  return tischLoeschen(tischId, organisationId)
}

export async function reservierungenFuerTagLadenAktion(datum: string): Promise<Reservierung[]> {
  const organisationId = await organisationIdOderFehler()
  return ladeReservierungenFuerTag(organisationId, datum)
}

export async function auslastungLadenAktion(von: string, bis: string): Promise<TischplanAuswertung> {
  const organisationId = await verwaltungsIdOderFehler()
  const reservierungen = await ladeReservierungenFuerZeitraum(organisationId, von, bis)
  return berechneAuslastung(reservierungen)
}

export async function blockierungenFuerTagLadenAktion(datum: string): Promise<Blockierung[]> {
  const organisationId = await organisationIdOderFehler()
  return ladeBlockierungenFuerTag(organisationId, datum)
}

export async function blockierungAnlegenAktion(input: {
  datum: string
  startZeit: string
  endZeit: string
  anzahlTische: number
  notiz?: string
}): Promise<{ fehler?: string; blockierung?: Blockierung }> {
  const organisationId = await organisationIdOderFehler()
  return blockierungErstellen(organisationId, input)
}

export async function blockierungLoeschenAktion(id: string): Promise<{ fehler?: string }> {
  const organisationId = await organisationIdOderFehler()
  return blockierungLoeschen(id, organisationId)
}

export async function ausnahmenLadenAktion(): Promise<ReservierungAusnahme[]> {
  const organisationId = await organisationIdOderFehler()
  return ladeAusnahmen(organisationId)
}

export async function ausnahmeSpeichernAktion(input: {
  datum: string
  geschlossen: boolean
  von: string | null
  bis: string | null
  notiz?: string
}): Promise<{ fehler?: string; ausnahme?: ReservierungAusnahme }> {
  const organisationId = await verwaltungsIdOderFehler()
  return ausnahmeSpeichern(organisationId, input)
}

export async function ausnahmeLoeschenAktion(id: string): Promise<{ fehler?: string }> {
  const organisationId = await verwaltungsIdOderFehler()
  return ausnahmeLoeschen(id, organisationId)
}

export async function reservierungStatusAendernAktion(id: string, status: ReservierungStatus): Promise<{ fehler?: string }> {
  const organisationId = await organisationIdOderFehler()
  const ergebnis = await reservierungStatusAendern(id, organisationId, status)
  if (ergebnis.fehler) return ergebnis

  // Bewertungsanfrage ist an "erschienen" gekoppelt, nie an die Reservierung
  // an sich – ein Storno/No-Show soll nie um eine Rezension bitten. Wechselt
  // der Status danach wieder weg, wird eine bereits geplante Mail storniert.
  if (status === 'erschienen') await bewertungsanfragePlanen(organisationId, id)
  else await bewertungsanfrageStornierenFuerReservierung(id)

  return {}
}

export async function reservierungTischZuweisenAktion(id: string, tischId: string | null): Promise<{ fehler?: string }> {
  const organisationId = await organisationIdOderFehler()
  return reservierungTischZuweisen(id, organisationId, tischId)
}

// Manuelle Buchung durchs Personal (z. B. telefonische Reservierung) –
// durchläuft dieselbe Verfügbarkeitsprüfung wie die Gast-Buchung, damit kein
// Tisch doppelt vergeben wird.
export async function reservierungManuellAnlegenAktion(input: {
  name: string
  email: string
  anzahlPersonen: number
  datum: string
  uhrzeit: string
  notiz?: string
}): Promise<{ fehler?: string; reservierung?: Reservierung }> {
  const organisationId = await organisationIdOderFehler()

  const [einstellungen, tische, reservierungenDesTages, blockierungenDesTages, ausnahme] = await Promise.all([
    ladeEinstellungen(organisationId),
    ladeTische(organisationId),
    ladeReservierungenFuerTag(organisationId, input.datum),
    ladeBlockierungenFuerTag(organisationId, input.datum),
    ladeAusnahmeFuerDatum(organisationId, input.datum),
  ])

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

  // Das Personal darf anders als Gäste auch außerhalb der Online-Grenzen
  // (z. B. mehr als 7 Personen) buchen – nur die Kapazitäts- und
  // Vorlaufprüfung bleibt hart, sonst verliert sie ihren Sinn.
  if (!pruefung.ok && pruefung.grund && !pruefung.grund.startsWith('Online buchbar')) {
    return { fehler: pruefung.grund }
  }

  return reservierungErstellenMitPruefung(organisationId, {
    name: input.name,
    email: input.email,
    anzahlPersonen: input.anzahlPersonen,
    datum: input.datum,
    uhrzeit: input.uhrzeit,
    dauerMinuten: einstellungen.dauerMinuten,
    gesamtTische: tische.length,
    maxPersonenGleichzeitig: einstellungen.maxPersonenGleichzeitig,
    erinnerung: false,
    notiz: input.notiz,
  })
}
