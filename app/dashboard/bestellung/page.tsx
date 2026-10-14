import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import { getSitzung } from '@/lib/session'
import { ladeFreischaltungen } from '@/lib/organisationen'
import { ladeBestellEinstellungen } from '@/lib/bestellung/daten'
import BestellungApp from './BestellungApp'

export const dynamic = 'force-dynamic'

export default async function BestellungPage() {
  const sitzung = await getSitzung()
  if (!sitzung || sitzung.typ !== 'organisation') redirect('/login')

  const [freischaltungen, einstellungen] = await Promise.all([
    ladeFreischaltungen(sitzung.organisationId),
    ladeBestellEinstellungen(sitzung.organisationId),
  ])

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader titel="Online-Bestellung" />
      <BestellungApp
        freigeschaltet={freischaltungen.bestellung}
        organisationId={sitzung.organisationId}
        anfangsEinstellungen={einstellungen}
      />
    </div>
  )
}
