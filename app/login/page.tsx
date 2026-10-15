import Anmeldung from '@/components/anmeldung/Anmeldung'
import AnmeldeRahmen from '@/components/anmeldung/AnmeldeRahmen'
import Ersteinrichtung from '@/components/anmeldung/Ersteinrichtung'
import { einrichtungsDaten, zwischenstandLesen } from '@/lib/konten/anmeldung'
import { adminVorhanden } from '@/lib/konten/daten'

export const dynamic = 'force-dynamic'

// Nur noch für den Plattform-Admin – Betriebe melden sich unter ihrer eigenen
// Adresse an (<domain>/team).
export default async function LoginPage() {
  if (!(await adminVorhanden())) {
    return (
      <AnmeldeRahmen titel="Maestoso" untertitel="Ersteinrichtung Plattform-Admin">
        <Ersteinrichtung />
      </AnmeldeRahmen>
    )
  }

  const zwischen = await zwischenstandLesen()
  const stand = zwischen?.stand.art === 'admin' ? zwischen : null
  const einrichtung = stand?.stand.schritt === 'einrichten' ? await einrichtungsDaten(stand.konto) : null
  const schritt = stand && (stand.stand.schritt === '2fa' || einrichtung) ? stand.stand.schritt : 'passwort'

  return (
    <AnmeldeRahmen titel="Maestoso" untertitel="Plattform-Admin">
      <Anmeldung art="admin" schritt={schritt} einrichtung={einrichtung} ziel="/plattform-admin" />
    </AnmeldeRahmen>
  )
}
