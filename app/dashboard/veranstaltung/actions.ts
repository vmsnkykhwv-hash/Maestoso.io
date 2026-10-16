'use server'

import { aktionFuer, verwaltungFuer } from '@/lib/zugriff'
import {
  ladeVeranstaltungEinstellungen,
  ladeVeranstaltungenFuerOrganisation,
  veranstaltungAnlegen,
  veranstaltungEinstellungenSpeichern,
  veranstaltungPreiseSpeichern,
  veranstaltungStatusAendern,
} from '@/lib/veranstaltung/daten'
import { veranstaltungAbsagen, veranstaltungBestaetigen, veranstaltungLoeschenMitBlockierung } from '@/lib/veranstaltung/aktionen'
import type { Veranstaltung, VeranstaltungEinstellungen } from '@/lib/veranstaltung/types'
import { mitProtokoll } from '@/lib/protokoll'

// Tagesgeschäft: Verwaltungskonto oder Tresen-Gerät mit freigeschalteter
// Mitarbeiterin, nicht vom Handy aus.
async function organisationIdOderFehler(): Promise<string> {
  return (await aktionFuer('veranstaltung', { ohneHandy: true })).organisationId
}

// Einstellungen und Auswertungen: nur Verwaltungskonto.
async function verwaltungsIdOderFehler(): Promise<string> {
  return (await verwaltungFuer('veranstaltung')).organisationId
}

export async function veranstaltungenLadenAktion(): Promise<Veranstaltung[]> {
  const organisationId = await organisationIdOderFehler()
  return ladeVeranstaltungenFuerOrganisation(organisationId)
}

export async function einstellungenLadenAktion(): Promise<VeranstaltungEinstellungen> {
  const organisationId = await organisationIdOderFehler()
  return ladeVeranstaltungEinstellungen(organisationId)
}

export async function einstellungenSpeichernAktion(einstellungen: VeranstaltungEinstellungen): Promise<{ fehler?: string }> {
  const organisationId = await verwaltungsIdOderFehler()
  return mitProtokoll(veranstaltungEinstellungenSpeichern(organisationId, einstellungen), 'veranstaltung', 'Einstellungen geändert', null, null)
}

// Manuelle Anlage durchs Personal (z. B. telefonische Anfrage) – landet wie
// eine Anfrage über das öffentliche Formular zunächst als "Angefragt", keine
// Blockierung, bis sie bestätigt wird.
export async function veranstaltungAnlegenAktion(input: {
  titel: string
  ansprechpartnerName: string
  email: string
  telefon: string
  datum: string
  beginn: string
  ende: string
  geschaetzteGaeste: number
  notiz?: string
}): Promise<{ fehler?: string; veranstaltung?: Veranstaltung }> {
  const organisationId = await organisationIdOderFehler()
  if (!input.titel.trim()) return { fehler: 'Bitte einen Titel angeben.' }
  if (!input.ansprechpartnerName.trim()) return { fehler: 'Bitte einen Ansprechpartner angeben.' }
  if (input.ende <= input.beginn) return { fehler: 'Ende muss nach dem Beginn liegen.' }
  if (input.geschaetzteGaeste < 1) return { fehler: 'Bitte eine gültige Gästezahl angeben.' }
  return mitProtokoll(veranstaltungAnlegen(organisationId, input), 'veranstaltung', 'Veranstaltung angelegt', `${input.titel}, ${input.datum}`, null)
}

export async function veranstaltungBestaetigenAktion(id: string, trotzReservierungen = false): Promise<{ fehler?: string; rueckfrage?: string }> {
  const organisationId = await organisationIdOderFehler()
  const ergebnis = await veranstaltungBestaetigen(organisationId, id, trotzReservierungen)
  // Eine Rückfrage ist noch keine Zusage – erst die bestätigte Antwort kommt ins Protokoll.
  if (ergebnis.rueckfrage) return ergebnis
  return mitProtokoll(ergebnis, 'veranstaltung', 'Veranstaltung bestätigt', trotzReservierungen ? 'trotz bestehender Reservierungen' : null, id)
}

export async function veranstaltungAbsagenAktion(id: string): Promise<{ fehler?: string }> {
  const organisationId = await organisationIdOderFehler()
  return mitProtokoll(veranstaltungAbsagen(organisationId, id), 'veranstaltung', 'Veranstaltung abgesagt', null, id)
}

export async function veranstaltungAlsDurchgefuehrtAktion(id: string): Promise<{ fehler?: string }> {
  const organisationId = await organisationIdOderFehler()
  return mitProtokoll(veranstaltungStatusAendern(id, organisationId, 'durchgefuehrt'), 'veranstaltung', 'Veranstaltung durchgeführt', null, id)
}

export async function veranstaltungLoeschenAktion(id: string): Promise<{ fehler?: string }> {
  const organisationId = await organisationIdOderFehler()
  return mitProtokoll(veranstaltungLoeschenMitBlockierung(organisationId, id), 'veranstaltung', 'Veranstaltung gelöscht', null, id)
}

export async function veranstaltungPreiseSpeichernAktion(
  id: string,
  input: { preis: number | null; anzahlung: number | null }
): Promise<{ fehler?: string }> {
  const organisationId = await verwaltungsIdOderFehler()
  return mitProtokoll(veranstaltungPreiseSpeichern(id, organisationId, input), 'veranstaltung', 'Preise geändert', `Pauschale ${input.preis ?? '–'} €, Anzahlung ${input.anzahlung ?? '–'} €`, id)
}
