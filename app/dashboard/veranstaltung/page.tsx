import AppHeader from '@/components/AppHeader'
import { istVerwaltung, seiteFuer } from '@/lib/zugriff'
import { ladeFreischaltungen } from '@/lib/organisationen'
import { ladeVeranstaltungEinstellungen, ladeVeranstaltungenFuerOrganisation } from '@/lib/veranstaltung/daten'
import VeranstaltungApp from './VeranstaltungApp'
import { oeffentlicheUrl } from '@/lib/url'

export const dynamic = 'force-dynamic'

export default async function VeranstaltungPage() {
  const sitzung = await seiteFuer('veranstaltung', { ohneHandy: true })

  const [freischaltungen, einstellungen, veranstaltungen] = await Promise.all([
    ladeFreischaltungen(sitzung.organisationId),
    ladeVeranstaltungEinstellungen(sitzung.organisationId),
    ladeVeranstaltungenFuerOrganisation(sitzung.organisationId),
  ])

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader titel="Veranstaltungsplanung" />
      <VeranstaltungApp
        darfVerwalten={istVerwaltung(sitzung)}
        freigeschaltet={freischaltungen.veranstaltung}
        oeffentlicherLink={await oeffentlicheUrl(sitzung.organisationId, '/veranstaltung')}
        anfangsEinstellungen={einstellungen}
        anfangsVeranstaltungen={veranstaltungen}
      />
    </div>
  )
}
