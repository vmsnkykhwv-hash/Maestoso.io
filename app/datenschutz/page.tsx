import DatenschutzPlattform from '@/components/rechtliches/DatenschutzPlattform'
import RechtsSeite from '@/components/rechtliches/RechtsSeite'

export const metadata = { title: 'Datenschutz – Maestoso' }

export default function PlattformDatenschutzPage() {
  return (
    <RechtsSeite titel="Datenschutzerklärung" zurueckHref="/" zurueckText="Zurück zu Maestoso">
      <DatenschutzPlattform />
    </RechtsSeite>
  )
}
