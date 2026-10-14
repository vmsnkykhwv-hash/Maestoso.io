'use server'

import { heuteBerlin } from '@/lib/datum'
import { organisationsName } from '@/lib/tischplan/daten'
import { ladeVeranstaltungEinstellungen, veranstaltungAnlegen } from '@/lib/veranstaltung/daten'
import { veranstaltungAnfrageBenachrichtigungSenden, veranstaltungAnfrageBestaetigungSenden } from '@/lib/veranstaltung/email'
import { oeffentlicheAnfrageSchluessel, rateLimitFehlgeschlagen, rateLimitPruefen, warteHinweis } from '@/lib/rateLimit'

const EMAIL_MUSTER = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SPERRE_AB_VERSUCHEN = 8

export async function organisationOeffentlichLadenAktion(
  organisationId: string
): Promise<{ name: string; aktiv: boolean; infoText: string | null } | null> {
  const [name, einstellungen] = await Promise.all([
    organisationsName(organisationId),
    ladeVeranstaltungEinstellungen(organisationId),
  ])
  if (!name) return null
  return { name, aktiv: einstellungen.aktiv, infoText: einstellungen.infoText }
}

export async function veranstaltungAnfrageSendenAktion(input: {
  organisationId: string
  titel: string
  ansprechpartnerName: string
  email: string
  telefon: string
  datum: string
  beginn: string
  ende: string
  geschaetzteGaeste: number
  notiz: string
}): Promise<{ fehler?: string; erfolg?: boolean }> {
  const titel = input.titel.trim()
  const ansprechpartnerName = input.ansprechpartnerName.trim()
  const email = input.email.trim()
  const telefon = input.telefon.trim()

  if (titel.length < 1 || titel.length > 100) return { fehler: 'Bitte einen Titel angeben.' }
  if (ansprechpartnerName.length < 1 || ansprechpartnerName.length > 50) return { fehler: 'Bitte einen Namen angeben.' }
  if (!EMAIL_MUSTER.test(email)) return { fehler: 'Bitte eine gültige E-Mail-Adresse angeben.' }
  if (telefon.length < 3 || telefon.length > 30) return { fehler: 'Bitte eine Telefonnummer angeben.' }
  if (input.datum < heuteBerlin()) return { fehler: 'Dieses Datum liegt in der Vergangenheit.' }
  if (input.ende <= input.beginn) return { fehler: 'Ende muss nach dem Beginn liegen.' }
  if (!Number.isFinite(input.geschaetzteGaeste) || input.geschaetzteGaeste < 1 || input.geschaetzteGaeste > 1000) {
    return { fehler: 'Bitte eine gültige Gästezahl angeben.' }
  }

  // Spam-Schutz wie bei den übrigen öffentlichen Formularen (Reservierung,
  // Bestellung, Gutschein) – pro Organisation + IP, damit eine Spam-Welle
  // gegen eine Organisation nicht alle anderen mitbremst.
  const sperrschluessel = await oeffentlicheAnfrageSchluessel('veranstaltung', input.organisationId)
  const sperre = await rateLimitPruefen(sperrschluessel)
  if (!sperre.erlaubt) return { fehler: warteHinweis(sperre.wartenSekunden!) }

  const [organisationName, einstellungen] = await Promise.all([
    organisationsName(input.organisationId),
    ladeVeranstaltungEinstellungen(input.organisationId),
  ])
  if (!organisationName) return { fehler: 'Diese Organisation wurde nicht gefunden.' }
  if (!einstellungen.aktiv) return { fehler: 'Veranstaltungsanfragen sind aktuell nicht möglich.' }

  await rateLimitFehlgeschlagen(sperrschluessel, SPERRE_AB_VERSUCHEN)

  const ergebnis = await veranstaltungAnlegen(input.organisationId, {
    titel,
    ansprechpartnerName,
    email,
    telefon,
    datum: input.datum,
    beginn: input.beginn,
    ende: input.ende,
    geschaetzteGaeste: input.geschaetzteGaeste,
    notiz: input.notiz,
  })
  if (ergebnis.fehler) return { fehler: ergebnis.fehler }

  await veranstaltungAnfrageBestaetigungSenden({
    organisationName,
    empfaenger: email,
    ansprechpartnerName,
    datum: input.datum,
    beginn: input.beginn,
    ende: input.ende,
  })

  if (einstellungen.benachrichtigungEmail) {
    await veranstaltungAnfrageBenachrichtigungSenden({
      organisationName,
      empfaenger: einstellungen.benachrichtigungEmail,
      titel,
      ansprechpartnerName,
      email,
      telefon,
      datum: input.datum,
      beginn: input.beginn,
      ende: input.ende,
      geschaetzteGaeste: input.geschaetzteGaeste,
    })
  }

  return { erfolg: true }
}
