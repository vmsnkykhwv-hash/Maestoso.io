import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import { getSitzung } from '@/lib/session'
import { ladeOrganisationen } from '@/lib/organisationen'
import OrganisationenVerwaltung from './OrganisationenVerwaltung'
import RechtlicheFusszeile from '@/components/rechtliches/RechtlicheFusszeile'

export const dynamic = 'force-dynamic'

export default async function PlattformAdminPage() {
  const sitzung = await getSitzung()
  if (!sitzung || sitzung.typ !== 'plattform-admin') redirect('/login')

  const organisationen = await ladeOrganisationen()

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader titel="Plattform-Admin" />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <OrganisationenVerwaltung anfangsOrganisationen={organisationen} />
      </main>
      <RechtlicheFusszeile className="pb-6" />
    </div>
  )
}
