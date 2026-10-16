// Gleicher Aufbau wie die übrigen Mails: ohne RESEND_API_KEY wird nur
// geloggt. Antworten gehen an die Plattform-Admins – "antworte einfach auf
// diese Mail" ist der kürzeste Weg vom Testkunden zum Vertrag.
import { Resend } from 'resend'
import { mailPruefen } from '@/lib/mailPruefen'
import { escapeHtml } from '@/lib/htmlEscape'

export function datumLang(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: 'numeric', month: 'long', year: 'numeric' })
}

async function senden(an: string[], antwortAn: string[], betreff: string, absaetze: string[]): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key || an.length === 0) {
    console.warn(`RESEND_API_KEY nicht gesetzt oder keine Empfänger – Mail "${betreff}" übersprungen.`)
    return
  }
  try {
    mailPruefen(await new Resend(key).emails.send({
      from: process.env.RESEND_ABSENDER ?? 'reservierungen@resend.dev',
      to: an,
      replyTo: antwortAn.length > 0 ? antwortAn : undefined,
      subject: betreff,
      html: ['Hallo,', ...absaetze, 'Viele Grüße<br>Maestoso'].map((p) => `<p>${p}</p>`).join(''),
    }))
  } catch (e) {
    console.error('Mailversand fehlgeschlagen', e)
  }
}

const b = (text: string) => `<strong>${escapeHtml(text)}</strong>`

export function testEndetBaldSenden(an: string[], antwortAn: string[], betrieb: string, testBis: string) {
  return senden(an, antwortAn, `Deine Testphase für ${betrieb} läuft am ${datumLang(testBis)} ab`, [
    `die kostenlose Testphase für ${b(betrieb)} läuft noch bis ${b(datumLang(testBis))}. Danach sperren wir den Zugang und die Gästeseiten. Deine Daten bleiben erst einmal gespeichert.`,
    'Willst du weitermachen? Antworte einfach auf diese Mail. Wir schicken dir den Vertrag, und es geht ohne Unterbrechung weiter.',
  ])
}

export function gesperrtSenden(an: string[], antwortAn: string[], betrieb: string, loeschungAm: string) {
  return senden(an, antwortAn, `Testphase beendet: ${betrieb} ist gesperrt`, [
    `die Testphase für ${b(betrieb)} ist vorbei. Anmeldung, Geräte und Gästeseiten sind ab jetzt gesperrt.`,
    `Alles, was du eingerichtet hast, bleibt bis ${b(datumLang(loeschungAm))} gespeichert. Antwortest du bis dahin auf diese Mail, schalten wir den Betrieb genau so wieder frei, wie er war.`,
    `Hören wir nichts von dir, löschen wir den Betrieb am ${b(datumLang(loeschungAm))} mit allen Daten endgültig.`,
  ])
}

export function loeschungBaldSenden(an: string[], antwortAn: string[], betrieb: string, loeschungAm: string) {
  return senden(an, antwortAn, `Am ${datumLang(loeschungAm)} löschen wir ${betrieb}`, [
    `${b(betrieb)} ist seit dem Ende der Testphase gesperrt. Am ${b(datumLang(loeschungAm))} löschen wir den Betrieb mit allen Daten – Reservierungen, Mitarbeitende, Zeiten, Bilder und Zugänge.`,
    'Willst du ihn behalten, antworte auf diese Mail. Danach lässt sich nichts mehr wiederherstellen.',
  ])
}

export function geloeschtSenden(an: string[], antwortAn: string[], betrieb: string) {
  return senden(an, antwortAn, `${betrieb} wurde gelöscht`, [
    `wie angekündigt haben wir ${b(betrieb)} mit allen Daten aus Maestoso gelöscht. Deine Zugänge funktionieren nicht mehr.`,
    'Danke, dass du Maestoso ausprobiert hast. Wenn du uns sagst, was gefehlt hat, hilft uns das sehr.',
  ])
}

export function adminZusammenfassungSenden(an: string[], zeilen: string[]) {
  return senden(an, [], `Testphasen: ${zeilen.length} ${zeilen.length === 1 ? 'Ereignis' : 'Ereignisse'}`, [
    'heute ist bei den Testphasen Folgendes passiert:',
    `<ul>${zeilen.map((z) => `<li>${escapeHtml(z)}</li>`).join('')}</ul>`,
  ])
}
