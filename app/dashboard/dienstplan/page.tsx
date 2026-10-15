import AppHeader from '@/components/AppHeader'
import { istVerwaltung, seiteFuer } from '@/lib/zugriff'
import { ladeFreischaltungen } from '@/lib/organisationen'
import { ladeMitarbeiter } from '@/lib/mitarbeiter/daten'
import DienstplanApp from './DienstplanApp'

export const dynamic = 'force-dynamic'

export default async function DienstplanPage() {
  const sitzung = await seiteFuer('dienstplan')

  const freischaltungen = await ladeFreischaltungen(sitzung.organisationId)

  const mitarbeiter = sitzung.art === 'inhaber' || !sitzung.mitarbeiter ? null : await ladeMitarbeiter(sitzung.mitarbeiter.id, sitzung.organisationId)

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader titel="Dienstplan & Schichtplanung" />
      <DienstplanApp freigeschaltet={freischaltungen.dienstplan} verwaltung={istVerwaltung(sitzung)} mitarbeiter={mitarbeiter} />
    </div>
  )
}
