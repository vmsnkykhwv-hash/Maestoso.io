import { organisationsName } from '@/lib/tischplan/daten'
import { plattformUrl, teamUrl } from '@/lib/url'
import { ladeBenutzerDerOrganisation } from './einladung'
import { sicherheitshinweisSenden } from './email'
import type { Konto } from './daten'

// Jede Änderung an den Zugängen eines Betriebs geht per Mail an alle
// eingerichteten Verwaltungskonten – auch (gerade) wenn sie vom
// Maestoso-Support kommt. Ein heimlich angelegtes Konto oder ein fremder
// 2FA-Reset fällt so sofort auf, statt erst beim Blick ins Protokoll.
// Fehler beim Versand brechen die Aktion nicht ab (senden() fängt sie).
export async function verwaltungBenachrichtigen(
  organisationId: string,
  ereignis: string,
  wer: string,
  ausser: string[] = []
): Promise<void> {
  const [konten, betrieb, link] = await Promise.all([
    ladeBenutzerDerOrganisation(organisationId),
    organisationsName(organisationId),
    teamUrl(organisationId, ''),
  ])
  const empfaenger = konten.filter((k) => k.aktiv && k.eingerichtet && !ausser.includes(k.id))
  await Promise.all(empfaenger.map((k) => sicherheitshinweisSenden(k.email, betrieb ?? 'deinen Betrieb', ereignis, wer, link)))
}

// Passwortänderung: nur die Person selbst – merkt sie nichts davon, hat
// jemand anderes ihr Passwort oder ihr Mailpostfach.
export async function passwortAenderungMelden(konto: Konto): Promise<void> {
  if (konto.art === 'admin' || !konto.organisationId) {
    await sicherheitshinweisSenden(konto.email, 'Maestoso (Plattform-Admin)', 'Das Passwort deines Kontos wurde geändert.', konto.email, `${await plattformUrl()}/login`)
    return
  }
  const [betrieb, link] = await Promise.all([organisationsName(konto.organisationId), teamUrl(konto.organisationId, '')])
  await sicherheitshinweisSenden(konto.email, betrieb ?? 'deinen Betrieb', 'Das Passwort deines Kontos wurde geändert.', konto.email, link)
}
