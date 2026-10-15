import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import { getSitzung } from '@/lib/session'
import { ladeFreischaltungen } from '@/lib/organisationen'
import { ladeEinstellungen, ladeTische } from '@/lib/tischplan/daten'
import TischplanApp from './TischplanApp'
import { oeffentlicheUrl } from '@/lib/url'

export const dynamic = 'force-dynamic'

export default async function TischplanPage() {
  const sitzung = await getSitzung()
  if (!sitzung || sitzung.typ !== 'organisation') redirect('/login')

  const [freischaltungen, einstellungen, tische] = await Promise.all([
    ladeFreischaltungen(sitzung.organisationId),
    ladeEinstellungen(sitzung.organisationId),
    ladeTische(sitzung.organisationId),
  ])

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader titel="Tischplan & Reservierungen" />
      <TischplanApp
        freigeschaltet={freischaltungen.tischplan}
        oeffentlicherLink={await oeffentlicheUrl(sitzung.organisationId, '/reservieren')}
        anfangsEinstellungen={einstellungen}
        anfangsTische={tische}
      />
    </div>
  )
}
