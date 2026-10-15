import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import EigenesKonto from '@/components/konto/EigenesKonto'
import { ladeKonto } from '@/lib/konten/daten'
import { ladeBenutzerDerOrganisation } from '@/lib/konten/einladung'
import { GERAET_COOKIE_NAME, geraeteTokenPruefen } from '@/lib/geraete/auth'
import { ladeGeraeteDerOrganisation } from '@/lib/geraete/daten'
import { ladeMitarbeiterListe } from '@/lib/mitarbeiter/daten'
import { getBetriebsSitzung } from '@/lib/session'
import Geraete from './Geraete'
import Mitarbeitende from './Mitarbeitende'
import Verwaltungskonten from './Verwaltungskonten'

export const dynamic = 'force-dynamic'

export default async function ZugaengePage() {
  const sitzung = await getBetriebsSitzung()
  if (sitzung?.art !== 'inhaber') redirect('/dashboard')

  const cookieStore = await cookies()
  const [konto, benutzer, geraete, mitarbeiter, diesesGeraet] = await Promise.all([
    ladeKonto('benutzer', sitzung.kontoId),
    ladeBenutzerDerOrganisation(sitzung.organisationId),
    ladeGeraeteDerOrganisation(sitzung.organisationId),
    ladeMitarbeiterListe(sitzung.organisationId),
    geraeteTokenPruefen(cookieStore.get(GERAET_COOKIE_NAME)?.value),
  ])
  const mitarbeiterNamen = Object.fromEntries(mitarbeiter.map((m) => [m.id, m.name]))
  // Nur zeigen, wenn das Cookie zu einem noch aktiven Gerät dieses Betriebs gehört.
  const diesesGeraetId = diesesGeraet && geraete.some((g) => g.id === diesesGeraet.geraetId) ? diesesGeraet.geraetId : null

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader titel="Zugänge & Geräte" />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 p-6">
        <EigenesKonto email={konto?.email ?? ''} />
        <Verwaltungskonten eigeneKontoId={sitzung.kontoId} anfangsBenutzer={benutzer} />
        <Geraete anfangsGeraete={geraete} mitarbeiterNamen={mitarbeiterNamen} diesesGeraetId={diesesGeraetId} />
        <Mitarbeitende mitarbeiter={mitarbeiter} />
      </main>
    </div>
  )
}
