import Link from 'next/link'
import { notFound } from 'next/navigation'
import AnmeldeRahmen from '@/components/anmeldung/AnmeldeRahmen'
import { kopplungscodePruefen } from '@/lib/geraete/daten'
import { ladeMitarbeiter } from '@/lib/mitarbeiter/daten'
import { organisationsName } from '@/lib/tischplan/daten'
import HandyKoppeln from './HandyKoppeln'

export const dynamic = 'force-dynamic'

export default async function KoppelnPage({
  params,
  searchParams,
}: {
  params: Promise<{ organisationId: string }>
  searchParams: Promise<{ code?: string }>
}) {
  const { organisationId } = await params
  const { code = '' } = await searchParams
  const name = await organisationsName(organisationId)
  if (!name) notFound()

  const gefunden = await kopplungscodePruefen(code, organisationId)
  const mitarbeiter = gefunden ? await ladeMitarbeiter(gefunden.mitarbeiterId, organisationId) : null

  return (
    <AnmeldeRahmen titel={name} untertitel="Handy koppeln">
      {mitarbeiter ? (
        <HandyKoppeln organisationId={organisationId} code={code} mitarbeiterName={mitarbeiter.name} />
      ) : (
        <div className="space-y-4 text-sm text-muted">
          <p>Der QR-Code ist abgelaufen oder wurde schon benutzt. Bitte lass dir einen neuen erstellen.</p>
          <Link href="/" className="font-medium text-accent">
            Zur Startseite
          </Link>
        </div>
      )}
    </AnmeldeRahmen>
  )
}
