import { notFound } from 'next/navigation'
import AngabenFehlen from '@/components/rechtliches/AngabenFehlen'
import Impressum from '@/components/rechtliches/Impressum'
import RechtsSeite from '@/components/rechtliches/RechtsSeite'
import { gaesteHref } from '@/lib/gaesteLinks'
import { ladeRechtsseitenDaten } from '@/lib/rechtliches/oeffentlich'

export const dynamic = 'force-dynamic'

export default async function BetriebImpressumPage({ params }: { params: Promise<{ organisationId: string }> }) {
  const { organisationId } = await params
  const daten = await ladeRechtsseitenDaten(organisationId)
  if (!daten) notFound()

  return (
    <RechtsSeite titel="Impressum" zurueckHref={await gaesteHref(organisationId, '/')} zurueckText={`Zurück zu ${daten.name}`}>
      {daten.vollstaendig ? <Impressum angaben={daten.angaben} /> : <AngabenFehlen name={daten.name} />}
    </RechtsSeite>
  )
}
