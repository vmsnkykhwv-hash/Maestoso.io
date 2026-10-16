// Bestätigungs-/Status-Mail an den Kunden sowie Benachrichtigung ans
// Personal bei einer neuen Bestellung – nach demselben Muster wie
// lib/tischplan/email.ts: ohne RESEND_API_KEY wird nichts versendet
// (geloggt, nicht geworfen), eine fehlende Mail-Konfiguration darf nie eine
// Bestellung verhindern.

import { Resend } from 'resend'
import { mailPruefen } from '@/lib/mailPruefen'
import { formatDatumKurz } from '@/lib/datum'
import { escapeHtml } from '@/lib/htmlEscape'
import type { BestellKanal, BestellPosition } from './types'

const KANAL_LABEL: Record<BestellKanal, string> = { abholung: 'Abholung', lieferung: 'Lieferung' }

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

function absender(): string {
  return process.env.RESEND_ABSENDER ?? 'reservierungen@resend.dev'
}

function formatPreis(preis: number): string {
  return preis.toFixed(2).replace('.', ',') + ' €'
}

function positionenHtml(positionen: Pick<BestellPosition, 'name' | 'menge'>[]): string {
  return `<ul>${positionen.map((p) => `<li>${p.menge}× ${escapeHtml(p.name)}</li>`).join('')}</ul>`
}

function bestaetigungsHtml(params: {
  organisationName: string
  name: string
  kanal: BestellKanal
  datum: string
  uhrzeit: string
  gesamtPreis: number
  positionen: Pick<BestellPosition, 'name' | 'menge'>[]
}): string {
  const organisationName = escapeHtml(params.organisationName)
  const name = escapeHtml(params.name)
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h1 style="font-size: 18px;">Bestellbestätigung – ${organisationName}</h1>
      <p>Hallo ${name},</p>
      <p>eure Bestellung ist eingegangen und wird geprüft:</p>
      <ul>
        <li>${KANAL_LABEL[params.kanal]}: ${formatDatumKurz(params.datum)}, ${params.uhrzeit} Uhr</li>
      </ul>
      ${positionenHtml(params.positionen)}
      <p>Gesamt: ${formatPreis(params.gesamtPreis)}</p>
      <p>Ihr bekommt gleich Bescheid, sobald sie bestätigt ist.</p>
    </div>
  `
}

function statusHtml(params: {
  organisationName: string
  name: string
  kanal: BestellKanal
  datum: string
  uhrzeit: string
  status: 'bestaetigt' | 'storniert'
}): string {
  const organisationName = escapeHtml(params.organisationName)
  const name = escapeHtml(params.name)
  if (params.status === 'bestaetigt') {
    return `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h1 style="font-size: 18px;">Bestellung bestätigt – ${organisationName}</h1>
        <p>Hallo ${name},</p>
        <p>eure ${KANAL_LABEL[params.kanal].toLowerCase()} für ${formatDatumKurz(params.datum)}, ${params.uhrzeit} Uhr ist bestätigt. Wir freuen uns auf euch!</p>
      </div>
    `
  }
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h1 style="font-size: 18px;">Bestellung storniert – ${organisationName}</h1>
      <p>Hallo ${name},</p>
      <p>eure Bestellung für ${formatDatumKurz(params.datum)}, ${params.uhrzeit} Uhr wurde storniert. Bei Fragen meldet euch gerne bei uns.</p>
    </div>
  `
}

function benachrichtigungsHtml(params: {
  organisationName: string
  kanal: BestellKanal
  name: string
  telefon: string
  datum: string
  uhrzeit: string
  gesamtPreis: number
  positionen: Pick<BestellPosition, 'name' | 'menge'>[]
}): string {
  const organisationName = escapeHtml(params.organisationName)
  const name = escapeHtml(params.name)
  const telefon = escapeHtml(params.telefon)
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h1 style="font-size: 18px;">Neue Bestellung – ${organisationName}</h1>
      <p>${KANAL_LABEL[params.kanal]} von ${name} (${telefon}), ${formatDatumKurz(params.datum)} ${params.uhrzeit} Uhr:</p>
      ${positionenHtml(params.positionen)}
      <p>Gesamt: ${formatPreis(params.gesamtPreis)}</p>
    </div>
  `
}

export async function bestellBestaetigungsMailSenden(params: {
  organisationName: string
  empfaenger: string
  name: string
  kanal: BestellKanal
  datum: string
  uhrzeit: string
  gesamtPreis: number
  positionen: Pick<BestellPosition, 'name' | 'menge'>[]
}): Promise<void> {
  const resend = client()
  if (!resend) {
    console.warn('RESEND_API_KEY nicht gesetzt – Bestellbestätigung übersprungen.')
    return
  }
  try {
    mailPruefen(await resend.emails.send({
      from: absender(),
      to: params.empfaenger,
      subject: `Bestellbestätigung – ${params.organisationName}`,
      html: bestaetigungsHtml(params),
    }))
  } catch (error) {
    console.error('Bestellbestätigung konnte nicht gesendet werden:', error)
  }
}

export async function bestellStatusMailSenden(params: {
  organisationName: string
  empfaenger: string
  name: string
  kanal: BestellKanal
  datum: string
  uhrzeit: string
  status: 'bestaetigt' | 'storniert'
}): Promise<void> {
  const resend = client()
  if (!resend) {
    console.warn('RESEND_API_KEY nicht gesetzt – Status-Mail übersprungen.')
    return
  }
  try {
    mailPruefen(await resend.emails.send({
      from: absender(),
      to: params.empfaenger,
      subject: params.status === 'bestaetigt' ? `Bestellung bestätigt – ${params.organisationName}` : `Bestellung storniert – ${params.organisationName}`,
      html: statusHtml(params),
    }))
  } catch (error) {
    console.error('Status-Mail konnte nicht gesendet werden:', error)
  }
}

export async function bestellBenachrichtigungsMailSenden(params: {
  organisationName: string
  empfaenger: string
  kanal: BestellKanal
  name: string
  telefon: string
  datum: string
  uhrzeit: string
  gesamtPreis: number
  positionen: Pick<BestellPosition, 'name' | 'menge'>[]
}): Promise<void> {
  const resend = client()
  if (!resend) {
    console.warn('RESEND_API_KEY nicht gesetzt – Personal-Benachrichtigung übersprungen.')
    return
  }
  try {
    mailPruefen(await resend.emails.send({
      from: absender(),
      to: params.empfaenger,
      subject: `Neue Bestellung – ${params.organisationName}`,
      html: benachrichtigungsHtml(params),
    }))
  } catch (error) {
    console.error('Personal-Benachrichtigung konnte nicht gesendet werden:', error)
  }
}
