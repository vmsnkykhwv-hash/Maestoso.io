import { organisationsName } from '@/lib/tischplan/daten'
import { teamUrl } from '@/lib/url'
import { einladungSenden } from './email'
import { tokenErstellen } from './einladung'

// Link wird immer zurückgegeben (zum Kopieren), die Mail ist ein Zusatz –
// ohne Resend-Konfiguration funktioniert die Einladung trotzdem.
export async function einladungVerschicken(
  organisationId: string,
  benutzerId: string,
  email: string
): Promise<{ link: string; versendet: boolean }> {
  const token = await tokenErstellen(benutzerId, 'einladung')
  const link = await teamUrl(organisationId, `/einladung?token=${encodeURIComponent(token)}`)
  const betrieb = (await organisationsName(organisationId)) ?? 'deinen Betrieb'
  const versendet = await einladungSenden(email, betrieb, link)
  return { link, versendet }
}
