import { notFound } from 'next/navigation'
import AngabenFehlen from '@/components/rechtliches/AngabenFehlen'
import DatenschutzBetrieb from '@/components/rechtliches/DatenschutzBetrieb'
import RechtsSeite from '@/components/rechtliches/RechtsSeite'
import { gaesteHref } from '@/lib/gaesteLinks'
import { ladeRechtsseitenDaten } from '@/lib/rechtliches/oeffentlich'

export const dynamic = 'force-dynamic'

export default async function BetriebDatenschutzPage({ params }: { params: Promise<{ organisationId: string }> }) {
  const { organisationId } = await params
  const daten = await ladeRechtsseitenDaten(organisationId)
  if (!daten) notFound()

  return (
    <RechtsSeite
      titel="Datenschutzerklärung"
      zurueckHref={await gaesteHref(organisationId, '/')}
      zurueckText={`Zurück zu ${daten.name}`}
    >
      {daten.vollstaendig ? (
        <DatenschutzBetrieb angaben={daten.angaben} freischaltungen={daten.freischaltungen} />
      ) : (
        <AngabenFehlen name={daten.name} />
      )}
    </RechtsSeite>
  )
}
