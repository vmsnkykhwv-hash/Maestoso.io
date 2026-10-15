import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import EigenesKonto from '@/components/konto/EigenesKonto'
import { ladeKonto } from '@/lib/konten/daten'
import { getSitzung } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function AdminKontoPage() {
  const sitzung = await getSitzung()
  if (sitzung?.typ !== 'plattform-admin') redirect('/login')
  const konto = await ladeKonto('admin', sitzung.kontoId)

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader titel="Dein Admin-Konto" />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 p-6">
        <Link href="/plattform-admin" className="text-sm text-muted">
          ← Zurück zu den Organisationen
        </Link>
        <EigenesKonto email={konto?.email ?? ''} />
      </main>
    </div>
  )
}
