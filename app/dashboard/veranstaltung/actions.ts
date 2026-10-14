'use server'

import { getSitzung } from '@/lib/session'
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

async function organisationIdOderFehler(): Promise<string> {
  const sitzung = await getSitzung()
  if (!sitzung || sitzung.typ !== 'organisation') throw new Error('Nicht angemeldet')
  return sitzung.organisationId
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
  const organisationId = await organisationIdOderFehler()
  return veranstaltungEinstellungenSpeichern(organisationId, einstellungen)
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
  return veranstaltungAnlegen(organisationId, input)
}

export async function veranstaltungBestaetigenAktion(id: string): Promise<{ fehler?: string }> {
  const organisationId = await organisationIdOderFehler()
  return veranstaltungBestaetigen(organisationId, id)
}

export async function veranstaltungAbsagenAktion(id: string): Promise<{ fehler?: string }> {
  const organisationId = await organisationIdOderFehler()
  return veranstaltungAbsagen(organisationId, id)
}

export async function veranstaltungAlsDurchgefuehrtAktion(id: string): Promise<{ fehler?: string }> {
  const organisationId = await organisationIdOderFehler()
  return veranstaltungStatusAendern(id, organisationId, 'durchgefuehrt')
}

export async function veranstaltungLoeschenAktion(id: string): Promise<{ fehler?: string }> {
  const organisationId = await organisationIdOderFehler()
  return veranstaltungLoeschenMitBlockierung(organisationId, id)
}

export async function veranstaltungPreiseSpeichernAktion(
  id: string,
  input: { preis: number | null; anzahlung: number | null }
): Promise<{ fehler?: string }> {
  const organisationId = await organisationIdOderFehler()
  return veranstaltungPreiseSpeichern(id, organisationId, input)
}
