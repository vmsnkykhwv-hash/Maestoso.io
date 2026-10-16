// Gleicher Aufbau wie lib/bestellung/email.ts: eigener kleiner Resend-Client
// pro Modul, ohne RESEND_API_KEY wird nur geloggt statt geworfen – ein
// fehlendes Mail-Setup darf nie die Anfrage selbst blockieren.
import { Resend } from 'resend'
import { mailPruefen } from '@/lib/mailPruefen'
import { escapeHtml } from '@/lib/htmlEscape'

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

function absender(): string {
  return process.env.RESEND_ABSENDER ?? 'reservierungen@resend.dev'
}

function formatDatumKurz(datum: string): string {
  const [jahr, monat, tag] = datum.split('-')
  return `${tag}.${monat}.${jahr}`
}

export async function veranstaltungAnfrageBestaetigungSenden(params: {
  organisationName: string
  empfaenger: string
  ansprechpartnerName: string
  datum: string
  beginn: string
  ende: string
}): Promise<void> {
  const resend = client()
  if (!resend) {
    console.warn('RESEND_API_KEY nicht gesetzt – Eingangsbestätigung Veranstaltungsanfrage übersprungen.')
    return
  }
  const organisationName = escapeHtml(params.organisationName)
  const name = escapeHtml(params.ansprechpartnerName)
  try {
    mailPruefen(await resend.emails.send({
      from: absender(),
      to: params.empfaenger,
      subject: `Eure Veranstaltungsanfrage – ${params.organisationName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h1 style="font-size: 18px;">Anfrage eingegangen</h1>
          <p>Hallo ${name},</p>
          <p>eure Anfrage für ${formatDatumKurz(params.datum)}, ${params.beginn}–${params.ende} Uhr, ist bei ${organisationName} eingegangen. Wir melden uns zeitnah bei euch, um alles Weitere zu klären.</p>
        </div>
      `,
    }))
  } catch (error) {
    console.error('Eingangsbestätigung Veranstaltungsanfrage konnte nicht gesendet werden:', error)
  }
}

export async function veranstaltungAnfrageBenachrichtigungSenden(params: {
  organisationName: string
  empfaenger: string
  titel: string
  ansprechpartnerName: string
  email: string
  telefon: string
  datum: string
  beginn: string
  ende: string
  geschaetzteGaeste: number
}): Promise<void> {
  const resend = client()
  if (!resend) {
    console.warn('RESEND_API_KEY nicht gesetzt – Personal-Benachrichtigung Veranstaltungsanfrage übersprungen.')
    return
  }
  const titel = escapeHtml(params.titel)
  const name = escapeHtml(params.ansprechpartnerName)
  const email = escapeHtml(params.email)
  const telefon = escapeHtml(params.telefon)
  try {
    mailPruefen(await resend.emails.send({
      from: absender(),
      to: params.empfaenger,
      subject: `Neue Veranstaltungsanfrage – ${params.organisationName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h1 style="font-size: 18px;">Neue Veranstaltungsanfrage</h1>
          <p><strong>${titel}</strong></p>
          <p>${formatDatumKurz(params.datum)}, ${params.beginn}–${params.ende} Uhr · ${params.geschaetzteGaeste} Gäste</p>
          <p>${name} · ${email} · ${telefon}</p>
        </div>
      `,
    }))
  } catch (error) {
    console.error('Personal-Benachrichtigung Veranstaltungsanfrage konnte nicht gesendet werden:', error)
  }
}

// Zusage oder Absage an die anfragende Person – vorher erfuhr sie davon nur,
// wenn der Betrieb von sich aus anrief.
export async function veranstaltungStatusMailSenden(params: {
  organisationName: string
  empfaenger: string
  ansprechpartnerName: string
  titel: string
  datum: string
  beginn: string
  ende: string
  status: 'bestaetigt' | 'abgesagt'
}): Promise<void> {
  const resend = client()
  if (!resend) {
    console.warn('RESEND_API_KEY nicht gesetzt – Mail zur Veranstaltung übersprungen.')
    return
  }
  const organisationName = escapeHtml(params.organisationName)
  const name = escapeHtml(params.ansprechpartnerName)
  const wann = `${formatDatumKurz(params.datum)}, ${params.beginn}–${params.ende} Uhr`
  const bestaetigt = params.status === 'bestaetigt'
  try {
    mailPruefen(await resend.emails.send({
      from: absender(),
      to: params.empfaenger,
      subject: bestaetigt ? `Zusage für eure Veranstaltung – ${params.organisationName}` : `Absage eurer Veranstaltungsanfrage – ${params.organisationName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h1 style="font-size: 18px;">${bestaetigt ? 'Eure Veranstaltung ist bestätigt' : 'Leider können wir eure Anfrage nicht annehmen'}</h1>
          <p>Hallo ${name},</p>
          ${
            bestaetigt
              ? `<p>${organisationName} hat eure Veranstaltung „${escapeHtml(params.titel)}“ am ${wann} bestätigt. Für Details zu Menü, Ablauf oder Anzahlung meldet sich der Betrieb bei euch.</p>`
              : `<p>${organisationName} kann eure Veranstaltung „${escapeHtml(params.titel)}“ am ${wann} leider nicht ausrichten. Bei Fragen meldet euch gern direkt beim Betrieb.</p>`
          }
        </div>
      `,
    }))
  } catch (error) {
    console.error('Mail zur Veranstaltung konnte nicht gesendet werden:', error)
  }
}
