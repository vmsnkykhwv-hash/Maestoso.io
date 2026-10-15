import Impressum from '@/components/rechtliches/Impressum'
import RechtsSeite from '@/components/rechtliches/RechtsSeite'
import { PLATTFORM_BETREIBER } from '@/lib/rechtliches/plattform'

export const metadata = { title: 'Impressum – Maestoso' }

export default function PlattformImpressumPage() {
  return (
    <RechtsSeite titel="Impressum" zurueckHref="/" zurueckText="Zurück zu Maestoso">
      <Impressum angaben={PLATTFORM_BETREIBER} />
    </RechtsSeite>
  )
}
