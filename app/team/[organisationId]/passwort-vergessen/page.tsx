import { notFound } from 'next/navigation'
import AnmeldeRahmen from '@/components/anmeldung/AnmeldeRahmen'
import PasswortVergessen from '@/components/anmeldung/PasswortVergessen'
import { teamHref } from '@/lib/gaesteLinks'
import { organisationsName } from '@/lib/tischplan/daten'

export const dynamic = 'force-dynamic'

export default async function PasswortVergessenPage({ params }: { params: Promise<{ organisationId: string }> }) {
  const { organisationId } = await params
  const name = await organisationsName(organisationId)
  if (!name) notFound()

  return (
    <AnmeldeRahmen titel={name} untertitel="Passwort vergessen">
      <PasswortVergessen organisationId={organisationId} anmeldeHref={await teamHref(organisationId)} />
    </AnmeldeRahmen>
  )
}
