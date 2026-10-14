import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import { getSitzung } from '@/lib/session'
import { ladeFreischaltungen } from '@/lib/organisationen'
import { getMitarbeiterSitzung } from '@/lib/mitarbeiter/session'
import { ladeMitarbeiter } from '@/lib/mitarbeiter/daten'
import ZeiterfassungApp from './ZeiterfassungApp'

export const dynamic = 'force-dynamic'

export default async function ZeiterfassungPage() {
  const sitzung = await getSitzung()
  if (!sitzung || sitzung.typ !== 'organisation') redirect('/login')

  const freischaltungen = await ladeFreischaltungen(sitzung.organisationId)

  const mitarbeiterSitzung = await getMitarbeiterSitzung()
  const anfangsMitarbeiter =
    mitarbeiterSitzung && mitarbeiterSitzung.organisationId === sitzung.organisationId
      ? await ladeMitarbeiter(mitarbeiterSitzung.mitarbeiterId, sitzung.organisationId)
      : null

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader titel="Zeiterfassung" />
      <ZeiterfassungApp freigeschaltet={freischaltungen.zeiterfassung} anfangsMitarbeiter={anfangsMitarbeiter} />
    </div>
  )
}
