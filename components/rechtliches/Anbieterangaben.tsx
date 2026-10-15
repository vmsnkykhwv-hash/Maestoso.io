import type { RechtlicheAngaben } from '@/lib/rechtliches/types'

// Name, Anschrift und Kontakt – identisch im Impressum und als
// "Verantwortlicher" in der Datenschutzerklärung, deshalb nur einmal.
export default function Anbieterangaben({ angaben }: { angaben: RechtlicheAngaben }) {
  return (
    <>
      <p>
        {angaben.firma}
        <br />
        {angaben.strasse}
        <br />
        {angaben.plzOrt}
      </p>
      {angaben.vertretenDurch && <p>Vertreten durch: {angaben.vertretenDurch}</p>}
      <p>
        {angaben.telefon && (
          <>
            Telefon: {angaben.telefon}
            <br />
          </>
        )}
        E-Mail: {angaben.email}
      </p>
    </>
  )
}
