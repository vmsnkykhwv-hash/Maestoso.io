// Gleicher Aufbau wie die Modul-Mails: ohne RESEND_API_KEY wird nur geloggt –
// die Anfrage ist dann trotzdem im Plattform-Admin sichtbar.
import { Resend } from 'resend'
import { escapeHtml } from '@/lib/htmlEscape'
import { ANFRAGE_ART_LABEL, TAGESZEIT_LABEL, type NeueAnfrage } from './daten'

export async function anfrageMelden(an: string[], anfrage: NeueAnfrage, adminLink: string): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key || an.length === 0) {
    console.warn(`RESEND_API_KEY nicht gesetzt – Mail "Neue Anfrage" übersprungen.`)
    return
  }
  const zeile = (titel: string, wert: string | null) =>
    wert ? `<tr><td style="padding:4px 12px 4px 0;color:#6b6456;">${escapeHtml(titel)}</td><td style="padding:4px 0;">${escapeHtml(wert)}</td></tr>` : ''
  const wunsch = anfrage.wunschtag
    ? `${new Date(anfrage.wunschtag + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}${anfrage.tageszeit ? `, ${TAGESZEIT_LABEL[anfrage.tageszeit]}` : ''}`
    : null
  const html = `<p>Neue Anfrage über maestoso-gastro.de:</p><table style="border-collapse:collapse;font-size:14px;">${zeile('Art', ANFRAGE_ART_LABEL[anfrage.art])}${zeile('Name', anfrage.name)}${zeile('Betrieb', anfrage.betrieb)}${zeile('E-Mail', anfrage.email)}${zeile('Telefon', anfrage.telefon)}${zeile('Wunschtermin', wunsch)}</table>${anfrage.nachricht ? `<p style="white-space:pre-wrap;border-left:3px solid #d8b083;padding-left:10px;">${escapeHtml(anfrage.nachricht)}</p>` : ''}<p>Antworten geht direkt über „Antworten“ in deinem Mailprogramm. Alle Anfragen: <a href="${escapeHtml(adminLink)}">${escapeHtml(adminLink)}</a></p>`
  try {
    await new Resend(key).emails.send({
      from: process.env.RESEND_ABSENDER ?? 'reservierungen@resend.dev',
      to: an,
      replyTo: anfrage.email,
      subject: `Neue Anfrage: ${ANFRAGE_ART_LABEL[anfrage.art]} – ${anfrage.betrieb || anfrage.name}`,
      html,
    })
  } catch (e) {
    console.error('Mailversand fehlgeschlagen', e)
  }
}
