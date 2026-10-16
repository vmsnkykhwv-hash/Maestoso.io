import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import { ladeAnfragen } from '@/lib/anfragen/daten'
import { getSitzung } from '@/lib/session'
import AnfragenListe from './AnfragenListe'

export const dynamic = 'force-dynamic'

export default async function AnfragenSeite() {
  const sitzung = await getSitzung()
  if (!sitzung || sitzung.typ !== 'plattform-admin') redirect('/login')
  const anfragen = await ladeAnfragen()

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader titel="Anfragen" />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 p-6">
        <Link href="/plattform-admin" className="text-sm text-muted underline">← Zurück zum Plattform-Admin</Link>
        <p className="text-sm text-muted">Demo-Termine, Fragen und Nachrichten von maestoso-gastro.de. Antworten per Mail an die angegebene Adresse.</p>
        <AnfragenListe anfangs={anfragen} />
      </main>
    </div>
  )
}
