// Bewertungsanfrage per Resend, genau wie die Reservierungs-Erinnerung in
// lib/tischplan/email.ts geplant (Resend `scheduledAt`) statt per Cron-Job
// versendet – ohne RESEND_API_KEY wird nichts versendet (geloggt, nicht
// geworfen), ein fehlendes Mail-Setup darf nie eine Statusänderung
// blockieren.

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

function bewertungsHtml(params: { organisationName: string; name: string; googleUrl: string; abmeldeLink: string }): string {
  const organisationName = escapeHtml(params.organisationName)
  const name = escapeHtml(params.name)
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h1 style="font-size: 18px;">Wie war euer Besuch bei ${organisationName}?</h1>
      <p>Hallo ${name},</p>
      <p>wir hoffen, es hat euch bei uns gefallen! Über eine kurze Google-Bewertung würden wir uns sehr freuen:</p>
      <p>
        <a href="${escapeHtml(params.googleUrl)}" style="display:inline-block;padding:10px 16px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;">
          Jetzt bewerten
        </a>
      </p>
      <p>Danke für euren Besuch!</p>
      <p style="margin-top:24px;font-size:12px;color:#777;">
        Du möchtest keine Bewertungsanfragen mehr von ${organisationName}?
        <a href="${escapeHtml(params.abmeldeLink)}" style="color:#777;">Hier abmelden</a>.
      </p>
    </div>
  `
}

export async function bewertungsanfrageSenden(params: {
  organisationName: string
  empfaenger: string
  name: string
  googleUrl: string
  abmeldeLink: string
  // Der tatsächliche Zeitpunkt des Besuchs/der Lieferung (Reservierungs-
  // bzw. Bestell-Uhrzeit), nicht der Moment, in dem die Leitung den Status
  // setzt – sonst ginge die Mail raus, bevor der Gast überhaupt da war,
  // falls der Status erst nachträglich geändert wird.
  ankerZeitpunkt: Date
  verzoegerungMinuten: number
}): Promise<{ resendId?: string }> {
  const resend = client()
  if (!resend) {
    console.warn('RESEND_API_KEY nicht gesetzt – Bewertungsanfrage übersprungen.')
    return {}
  }

  try {
    const geplanterZeitpunkt = new Date(params.ankerZeitpunkt.getTime() + params.verzoegerungMinuten * 60 * 1000)
    // Liegt der berechnete Zeitpunkt schon in der Vergangenheit (Status
    // wurde erst deutlich später gesetzt), sofort verschicken statt mit
    // einem scheduledAt in der Vergangenheit zu scheitern.
    const scheduledAt = geplanterZeitpunkt.getTime() > Date.now() ? geplanterZeitpunkt.toISOString() : undefined

    const antwort = mailPruefen(await resend.emails.send({
      from: absender(),
      to: params.empfaenger,
      subject: `Wie war's bei ${params.organisationName}?`,
      html: bewertungsHtml(params),
      ...(scheduledAt ? { scheduledAt } : {}),
    }))
    return { resendId: antwort.data?.id }
  } catch (error) {
    console.error('Bewertungsanfrage konnte nicht geplant werden:', error)
    return {}
  }
}

export async function bewertungsanfrageStornieren(resendId: string): Promise<void> {
  const resend = client()
  if (!resend) return
  try {
    mailPruefen(await resend.emails.cancel(resendId))
  } catch (error) {
    console.error('Geplante Bewertungsanfrage konnte nicht storniert werden:', error)
  }
}
