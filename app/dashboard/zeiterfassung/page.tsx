import AppHeader from '@/components/AppHeader'
import { istVerwaltung, seiteFuer } from '@/lib/zugriff'
import { ladeFreischaltungen } from '@/lib/organisationen'
import { ladeMitarbeiter } from '@/lib/mitarbeiter/daten'
import ZeiterfassungApp from './ZeiterfassungApp'

export const dynamic = 'force-dynamic'

export default async function ZeiterfassungPage() {
  const sitzung = await seiteFuer('zeiterfassung')

  const freischaltungen = await ladeFreischaltungen(sitzung.organisationId)
  const mitarbeiter = sitzung.art === 'inhaber' || !sitzung.mitarbeiter ? null : await ladeMitarbeiter(sitzung.mitarbeiter.id, sitzung.organisationId)

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader titel="Zeiterfassung" />
      <ZeiterfassungApp
        freigeschaltet={freischaltungen.zeiterfassung}
        verwaltung={istVerwaltung(sitzung)}
        mitarbeiter={mitarbeiter}
        nurLesen={sitzung.art === 'handy'}
      />
    </div>
  )
}
