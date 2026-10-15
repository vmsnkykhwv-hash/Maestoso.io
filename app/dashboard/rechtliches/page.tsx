import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import { ladeRechtlicheAngaben } from '@/lib/rechtliches/daten'
import { getSitzung } from '@/lib/session'
import RechtlichesFormular from './RechtlichesFormular'

export const dynamic = 'force-dynamic'

export default async function RechtlichesPage() {
  const sitzung = await getSitzung()
  if (!sitzung || sitzung.typ !== 'organisation') redirect('/login')

  const angaben = await ladeRechtlicheAngaben(sitzung.organisationId)

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader titel="Impressum & Datenschutz" />
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        <RechtlichesFormular organisationId={sitzung.organisationId} anfangsAngaben={angaben} />
      </main>
    </div>
  )
}
