import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import EigenesKonto from '@/components/konto/EigenesKonto'
import { ladeKonto } from '@/lib/konten/daten'
import { ladeBenutzerDerOrganisation } from '@/lib/konten/einladung'
import { getBetriebsSitzung } from '@/lib/session'
import Verwaltungskonten from './Verwaltungskonten'

export const dynamic = 'force-dynamic'

export default async function ZugaengePage() {
  const sitzung = await getBetriebsSitzung()
  if (sitzung?.art !== 'inhaber') redirect('/dashboard')

  const [konto, benutzer] = await Promise.all([ladeKonto('benutzer', sitzung.kontoId), ladeBenutzerDerOrganisation(sitzung.organisationId)])

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader titel="Zugänge & Geräte" />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 p-6">
        <EigenesKonto email={konto?.email ?? ''} />
        <Verwaltungskonten eigeneKontoId={sitzung.kontoId} anfangsBenutzer={benutzer} />
      </main>
    </div>
  )
}
