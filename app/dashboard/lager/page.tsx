import AppHeader from '@/components/AppHeader'
import { istVerwaltung, seiteFuer } from '@/lib/zugriff'
import { ladeFreischaltungen } from '@/lib/organisationen'
import { ladeMitarbeiter } from '@/lib/mitarbeiter/daten'
import LagerApp from './LagerApp'

export const dynamic = 'force-dynamic'

export default async function LagerPage() {
  const sitzung = await seiteFuer('lager', { ohneHandy: true })

  const freischaltungen = await ladeFreischaltungen(sitzung.organisationId)

  const mitarbeiter = sitzung.art === 'inhaber' || !sitzung.mitarbeiter ? null : await ladeMitarbeiter(sitzung.mitarbeiter.id, sitzung.organisationId)

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader titel="Lagerbestand & Wareneinkauf" />
      <LagerApp freigeschaltet={freischaltungen.lager} verwaltung={istVerwaltung(sitzung)} mitarbeiter={mitarbeiter} />
    </div>
  )
}
