import AppHeader from '@/components/AppHeader'
import { istVerwaltung, seiteFuer } from '@/lib/zugriff'
import { ladeFreischaltungen } from '@/lib/organisationen'
import { ladeBestellEinstellungen } from '@/lib/bestellung/daten'
import BestellungApp from './BestellungApp'
import { oeffentlicheUrl } from '@/lib/url'

export const dynamic = 'force-dynamic'

export default async function BestellungPage() {
  const sitzung = await seiteFuer('bestellung', { ohneHandy: true })

  const [freischaltungen, einstellungen] = await Promise.all([
    ladeFreischaltungen(sitzung.organisationId),
    ladeBestellEinstellungen(sitzung.organisationId),
  ])

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader titel="Online-Bestellung" />
      <BestellungApp
        darfVerwalten={istVerwaltung(sitzung)}
        freigeschaltet={freischaltungen.bestellung}
        oeffentlicherLink={await oeffentlicheUrl(sitzung.organisationId, '/bestellen')}
        anfangsEinstellungen={einstellungen}
      />
    </div>
  )
}
