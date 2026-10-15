import type { RechtlicheAngaben } from '@/lib/rechtliches/types'
import Anbieterangaben from './Anbieterangaben'
import { Abschnitt } from './RechtsSeite'

export default function Impressum({ angaben }: { angaben: RechtlicheAngaben }) {
  return (
    <>
      <Abschnitt titel="Angaben gemäß § 5 DDG">
        <Anbieterangaben angaben={angaben} />
      </Abschnitt>

      {angaben.registerEintrag && (
        <Abschnitt titel="Registereintrag">
          <p>{angaben.registerEintrag}</p>
        </Abschnitt>
      )}

      {angaben.ustId && (
        <Abschnitt titel="Umsatzsteuer-ID">
          <p>Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz: {angaben.ustId}</p>
        </Abschnitt>
      )}

      <Abschnitt titel="Verbraucherstreitbeilegung">
        <p>
          Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </Abschnitt>
    </>
  )
}
