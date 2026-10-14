// Bestätigungsmail mit Gutschein-Code an den Käufer – nach demselben
// Muster wie lib/bestellung/email.ts: ohne RESEND_API_KEY wird nichts
// versendet (geloggt, nicht geworfen), eine fehlende Mail-Konfiguration
// darf nie einen Gutschein-Kauf verhindern.
import { Resend } from 'resend'
import { escapeHtml } from '@/lib/htmlEscape'

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

function absender(): string {
  return process.env.RESEND_ABSENDER ?? 'reservierungen@resend.dev'
}

function formatPreis(betrag: number): string {
  return betrag.toFixed(2).replace('.', ',') + ' €'
}

export async function gutscheinBestaetigungsMailSenden(params: {
  organisationName: string
  empfaenger: string
  kaeuferName: string
  betrag: number
  code: string
}): Promise<void> {
  const resend = client()
  if (!resend) {
    console.warn('Gutschein-Bestätigungsmail nicht gesendet (kein RESEND_API_KEY).')
    return
  }

  try {
    const organisationName = escapeHtml(params.organisationName)
    const kaeuferName = escapeHtml(params.kaeuferName)
    await resend.emails.send({
      from: absender(),
      to: params.empfaenger,
      subject: `Dein Gutschein bei ${organisationName}`,
      html: `
        <p>Hallo ${kaeuferName},</p>
        <p>vielen Dank für deinen Gutschein-Kauf bei ${organisationName} über ${formatPreis(params.betrag)}.</p>
        <p>Dein Gutschein-Code:</p>
        <p style="font-size:20px;font-weight:700;letter-spacing:2px;">${escapeHtml(params.code)}</p>
        <p>Zeig diesen Code beim Bezahlen vor Ort vor, um ihn einzulösen.</p>
      `,
    })
  } catch (error) {
    console.error('Gutschein-Bestätigungsmail fehlgeschlagen:', error)
  }
}
