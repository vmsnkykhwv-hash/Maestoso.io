import Link from 'next/link'
import { notFound } from 'next/navigation'
import AnmeldeRahmen from '@/components/anmeldung/AnmeldeRahmen'
import PasswortFestlegen from '@/components/anmeldung/PasswortFestlegen'
import { teamHref } from '@/lib/gaesteLinks'
import { tokenPruefenFuer } from '@/lib/konten/einladung'
import { organisationsName } from '@/lib/tischplan/daten'

export const dynamic = 'force-dynamic'

export default async function PasswortNeuPage({
  params,
  searchParams,
}: {
  params: Promise<{ organisationId: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { organisationId } = await params
  const { token = '' } = await searchParams
  const name = await organisationsName(organisationId)
  if (!name) notFound()

  const gefunden = await tokenPruefenFuer(token, 'passwort', organisationId)
  const anmeldeHref = await teamHref(organisationId)

  return (
    <AnmeldeRahmen titel={name} untertitel="Neues Passwort">
      {gefunden ? (
        <PasswortFestlegen organisationId={organisationId} zweck="passwort" token={token} email={gefunden.konto.email} anmeldeHref={anmeldeHref} />
      ) : (
        <div className="space-y-4 text-sm text-muted">
          <p>Der Link ist ungültig, abgelaufen oder wurde schon benutzt.</p>
          <Link href={anmeldeHref} className="font-medium text-accent">
            Zur Anmeldung
          </Link>
        </div>
      )}
    </AnmeldeRahmen>
  )
}
