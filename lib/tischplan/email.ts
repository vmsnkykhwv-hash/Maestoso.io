// Bestätigungs-/Erinnerungsmail per Resend. Bewusst optional: ohne
// RESEND_API_KEY (z. B. lokal oder bevor ein Kunde eine eigene Absenderdomain
// eingerichtet hat) wird die Buchung trotzdem gespeichert, nur der
// Mailversand übersprungen (geloggt, nicht geworfen) – eine Reservierung
// soll nie an einer fehlenden Mail-Konfiguration scheitern.

import { Resend } from 'resend'
import { formatDatumKurz } from '@/lib/datum'
import { escapeHtml } from '@/lib/htmlEscape'

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

function absender(): string {
  return process.env.RESEND_ABSENDER ?? 'reservierungen@resend.dev'
}

function bestaetigungsHtml(params: { organisationName: string; name: string; datum: string; uhrzeit: string; anzahlPersonen: number }): string {
  const organisationName = escapeHtml(params.organisationName)
  const name = escapeHtml(params.name)
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h1 style="font-size: 18px;">Reservierungsbestätigung – ${organisationName}</h1>
      <p>Hallo ${name},</p>
      <p>eure Reservierung ist bestätigt:</p>
      <ul>
        <li>Datum: ${formatDatumKurz(params.datum)}</li>
        <li>Uhrzeit: ${params.uhrzeit} Uhr</li>
        <li>Personen: ${params.anzahlPersonen}</li>
      </ul>
      <p>Wir freuen uns auf euch!</p>
    </div>
  `
}

function erinnerungsHtml(params: { organisationName: string; name: string; datum: string; uhrzeit: string }): string {
  const organisationName = escapeHtml(params.organisationName)
  const name = escapeHtml(params.name)
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h1 style="font-size: 18px;">Erinnerung an eure Reservierung – ${organisationName}</h1>
      <p>Hallo ${name},</p>
      <p>kurze Erinnerung: euer Tisch bei ${organisationName} ist heute um ${params.uhrzeit} Uhr reserviert.</p>
    </div>
  `
}

function scheduledAtVor(datum: string, uhrzeit: string, minutenVorher: number): string {
  const [jahr, monat, tag] = datum.split('-').map(Number)
  const [h, m] = uhrzeit.split(':').map(Number)
  const termin = new Date(Date.UTC(jahr, monat - 1, tag, h, m))
  termin.setUTCMinutes(termin.getUTCMinutes() - minutenVorher)
  return termin.toISOString()
}

export async function reservierungsMailsSenden(params: {
  organisationName: string
  empfaenger: string
  name: string
  datum: string
  uhrzeit: string
  anzahlPersonen: number
  erinnerung: boolean
}): Promise<{ resendId?: string }> {
  const resend = client()
  if (!resend) {
    console.warn('RESEND_API_KEY nicht gesetzt – Bestätigungsmail übersprungen.')
    return {}
  }

  try {
    await resend.emails.send({
      from: absender(),
      to: params.empfaenger,
      subject: `Reservierungsbestätigung – ${params.organisationName}`,
      html: bestaetigungsHtml(params),
    })
  } catch (error) {
    console.error('Bestätigungsmail konnte nicht gesendet werden:', error)
  }

  if (!params.erinnerung) return {}

  try {
    const antwort = await resend.emails.send({
      from: absender(),
      to: params.empfaenger,
      subject: `Erinnerung – Reservierung bei ${params.organisationName}`,
      html: erinnerungsHtml(params),
      scheduledAt: scheduledAtVor(params.datum, params.uhrzeit, 120),
    })
    return { resendId: antwort.data?.id }
  } catch (error) {
    console.error('Erinnerungsmail konnte nicht geplant werden:', error)
    return {}
  }
}
