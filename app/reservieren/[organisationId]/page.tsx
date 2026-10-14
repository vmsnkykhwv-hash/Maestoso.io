import { notFound } from 'next/navigation'
import { organisationOeffentlichLadenAktion } from './actions'
import BuchungsFormular from './BuchungsFormular'

export const dynamic = 'force-dynamic'

export default async function ReservierenPage({ params }: { params: Promise<{ organisationId: string }> }) {
  const { organisationId } = await params
  const organisation = await organisationOeffentlichLadenAktion(organisationId)
  if (!organisation) notFound()

  return (
    <div className="flex min-h-dvh justify-center bg-background p-6">
      <main className="w-full max-w-md py-8">
        <h1 className="mb-1 text-xl font-semibold">Tisch reservieren bei {organisation.name}</h1>
        <p className="mb-6 text-sm text-muted">Wählt Datum, Uhrzeit und Personenzahl – ihr erhaltet sofort eine Bestätigung.</p>
        <BuchungsFormular organisationId={organisationId} />
      </main>
    </div>
  )
}
