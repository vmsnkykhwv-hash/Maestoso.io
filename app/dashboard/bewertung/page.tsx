import AppHeader from '@/components/AppHeader'
import { seiteFuer } from '@/lib/zugriff'
import { ladeFreischaltungen } from '@/lib/organisationen'
import { ladeBewertungsEinstellungen, ladeBewertungsUebersicht } from '@/lib/bewertung/daten'
import BewertungApp from './BewertungApp'

export const dynamic = 'force-dynamic'

export default async function BewertungPage() {
  const sitzung = await seiteFuer('bewertung', { verwaltung: true })

  const [freischaltungen, einstellungen, uebersicht] = await Promise.all([
    ladeFreischaltungen(sitzung.organisationId),
    ladeBewertungsEinstellungen(sitzung.organisationId),
    ladeBewertungsUebersicht(sitzung.organisationId),
  ])

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader titel="Google-Bewertungsanfrage" />
      <BewertungApp freigeschaltet={freischaltungen.bewertung} anfangsEinstellungen={einstellungen} anfangsUebersicht={uebersicht} />
    </div>
  )
}
