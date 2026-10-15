import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import { getSitzung } from '@/lib/session'
import { ladeBenutzerDerOrganisation } from '@/lib/konten/einladung'
import { ladeOrganisationen } from '@/lib/organisationen'
import OrganisationenVerwaltung from './OrganisationenVerwaltung'
import RechtlicheFusszeile from '@/components/rechtliches/RechtlicheFusszeile'

export const dynamic = 'force-dynamic'

export default async function PlattformAdminPage() {
  const sitzung = await getSitzung()
  if (!sitzung || sitzung.typ !== 'plattform-admin') redirect('/login')

  const organisationen = await ladeOrganisationen()
  const benutzer = await Promise.all(organisationen.map((o) => ladeBenutzerDerOrganisation(o.id)))
  const benutzerNachOrganisation = Object.fromEntries(organisationen.map((o, i) => [o.id, benutzer[i]]))

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader titel="Plattform-Admin" />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 p-6">
        <Link href="/plattform-admin/konto" className="text-sm text-muted underline">
          Dein Admin-Konto (Passwort, Wiederherstellungscodes)
        </Link>
        <OrganisationenVerwaltung anfangsOrganisationen={organisationen} benutzerNachOrganisation={benutzerNachOrganisation} />
      </main>
      <RechtlicheFusszeile className="pb-6" />
    </div>
  )
}
