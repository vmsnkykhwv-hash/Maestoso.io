// Bestell-Mail an den Lieferanten – anders als die übrigen Mail-Funktionen
// in diesem Projekt NICHT automatisch im Hintergrund verschickt, sondern
// erst, nachdem die Leitung den Entwurf im Bestellung-Tab gesehen und
// bewusst auf "Jetzt senden" gedrückt hat (ein Tippfehler bei der Menge
// soll nie ungeprüft an einen externen Lieferanten rausgehen). Schlägt der
// Versand fehl, wird das deshalb als Fehler an die Leitung zurückgegeben
// statt nur geloggt.

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

function bestellHtml(params: {
  organisationName: string
  ansprechpartner: string | null
  kundennummer: string | null
  positionen: { name: string; einheit: string; menge: string }[]
}): string {
  const organisationName = escapeHtml(params.organisationName)
  const ansprechpartner = params.ansprechpartner ? escapeHtml(params.ansprechpartner) : null
  const kundennummer = params.kundennummer ? escapeHtml(params.kundennummer) : null
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h1 style="font-size: 18px;">Bestellung – ${organisationName}</h1>
      <p>${ansprechpartner ? `Hallo ${ansprechpartner},` : 'Hallo,'}</p>
      <p>wir möchten folgende Artikel bestellen:</p>
      <ul>${params.positionen.map((p) => `<li>${escapeHtml(p.menge)} ${escapeHtml(p.einheit)} ${escapeHtml(p.name)}</li>`).join('')}</ul>
      ${kundennummer ? `<p>Kundennummer: ${kundennummer}</p>` : ''}
      <p>Vielen Dank!</p>
    </div>
  `
}

export async function bestellMailSenden(params: {
  organisationName: string
  empfaenger: string
  ansprechpartner: string | null
  kundennummer: string | null
  positionen: { name: string; einheit: string; menge: string }[]
}): Promise<{ fehler?: string }> {
  const resend = client()
  if (!resend) return { fehler: 'Kein Mailversand konfiguriert (RESEND_API_KEY fehlt).' }

  try {
    mailPruefen(await resend.emails.send({
      from: absender(),
      to: params.empfaenger,
      subject: `Bestellung – ${params.organisationName}`,
      html: bestellHtml(params),
    }))
    return {}
  } catch (error) {
    return { fehler: error instanceof Error ? error.message : 'Mail konnte nicht gesendet werden.' }
  }
}
