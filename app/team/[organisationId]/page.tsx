import { notFound } from 'next/navigation'
import Anmeldung from '@/components/anmeldung/Anmeldung'
import AnmeldeRahmen from '@/components/anmeldung/AnmeldeRahmen'
import { teamHref } from '@/lib/gaesteLinks'
import { einrichtungsDaten, zwischenstandLesen } from '@/lib/konten/anmeldung'
import { organisationsName } from '@/lib/tischplan/daten'

export const dynamic = 'force-dynamic'

// Anmeldung für das Team eines Betriebs unter dessen eigener Adresse
// (musterbetrieb.de/team) – die Adresse sagt schon, um welchen Betrieb es
// geht, deshalb kein Zugangscode mehr.
export default async function TeamAnmeldungPage({ params }: { params: Promise<{ organisationId: string }> }) {
  const { organisationId } = await params
  const name = await organisationsName(organisationId)
  if (!name) notFound()

  const zwischen = await zwischenstandLesen()
  // Ein Zwischenstand eines anderen Betriebs (oder des Admins) gilt hier nicht.
  const stand = zwischen?.stand.art === 'benutzer' && zwischen.konto.organisationId === organisationId ? zwischen : null
  const einrichtung = stand?.stand.schritt === 'einrichten' ? await einrichtungsDaten(stand.konto) : null
  const schritt = stand && (stand.stand.schritt === '2fa' || einrichtung) ? stand.stand.schritt : 'passwort'

  return (
    <AnmeldeRahmen titel={name} untertitel="Anmeldung für das Team">
      <Anmeldung
        art="benutzer"
        organisationId={organisationId}
        schritt={schritt}
        einrichtung={einrichtung}
        ziel="/dashboard"
        passwortVergessenHref={await teamHref(organisationId, '/passwort-vergessen')}
      />
    </AnmeldeRahmen>
  )
}
