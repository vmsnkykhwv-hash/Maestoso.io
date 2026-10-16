// Gleicher Aufbau wie die Modul-Mails (z. B. lib/veranstaltung/email.ts):
// ohne RESEND_API_KEY wird nur geloggt. Die Links zeigt der Admin bzw. die
// Inhaberin zusätzlich zum Kopieren an, damit es auch ohne Mailversand geht.
import { Resend } from 'resend'
import { mailPruefen } from '@/lib/mailPruefen'
import { escapeHtml } from '@/lib/htmlEscape'

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY
  return key ? new Resend(key) : null
}

function absender(): string {
  return process.env.RESEND_ABSENDER ?? 'reservierungen@resend.dev'
}

async function senden(an: string, betreff: string, html: string): Promise<boolean> {
  const resend = client()
  if (!resend) {
    console.warn(`RESEND_API_KEY nicht gesetzt – Mail "${betreff}" übersprungen.`)
    return false
  }
  try {
    mailPruefen(await resend.emails.send({ from: absender(), to: an, subject: betreff, html }))
    return true
  } catch (e) {
    console.error('Mailversand fehlgeschlagen', e)
    return false
  }
}

function knopf(link: string, text: string): string {
  return `<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 16px;background:#c9962b;color:#1b2340;border-radius:8px;text-decoration:none;font-weight:600;">${escapeHtml(text)}</a></p>`
}

export async function einladungSenden(an: string, betrieb: string, link: string): Promise<boolean> {
  return senden(
    an,
    `Dein Zugang zu Maestoso für ${betrieb}`,
    `<p>Hallo,</p><p>für <strong>${escapeHtml(betrieb)}</strong> wurde ein Verwaltungskonto bei Maestoso für dich angelegt. Lege über den Link ein Passwort fest und richte danach die Anmeldung mit einer Authenticator-App ein.</p>${knopf(link, 'Zugang einrichten')}<p>Der Link ist 7 Tage gültig.</p>`
  )
}

export async function passwortLinkSenden(an: string, betrieb: string, link: string): Promise<boolean> {
  return senden(
    an,
    `Neues Passwort für ${betrieb}`,
    `<p>Hallo,</p><p>du hast ein neues Passwort für dein Maestoso-Konto bei <strong>${escapeHtml(betrieb)}</strong> angefordert.</p>${knopf(link, 'Neues Passwort festlegen')}<p>Der Link ist eine Stunde gültig. Wenn du das nicht warst, ignoriere diese Mail – dein Passwort bleibt unverändert.</p>`
  )
}

export async function sicherheitshinweisSenden(an: string, betrieb: string, ereignis: string, wer: string, link: string): Promise<boolean> {
  const zeit = new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'medium', timeStyle: 'short' })
  return senden(
    an,
    `Sicherheitshinweis: Änderung an den Zugängen von ${betrieb}`,
    `<p>Hallo,</p><p>bei <strong>${escapeHtml(betrieb)}</strong> wurde gerade etwas an den Zugängen geändert:</p><p><strong>${escapeHtml(ereignis)}</strong><br>durch ${escapeHtml(wer)} am ${escapeHtml(zeit)} Uhr</p><p>War das abgesprochen, musst du nichts tun. Wenn nicht: melde dich an, prüfe unter „Zugänge &amp; Geräte“ und im Änderungsprotokoll, sperre unbekannte Konten und gib uns sofort Bescheid.</p>${knopf(link, 'Zu Maestoso')}`
  )
}
