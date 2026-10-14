import { notFound } from 'next/navigation'
import { organisationOeffentlichLadenAktion } from './actions'
import BestellFormular from './BestellFormular'

export const dynamic = 'force-dynamic'

export default async function BestellenPage({ params }: { params: Promise<{ organisationId: string }> }) {
  const { organisationId } = await params
  const organisation = await organisationOeffentlichLadenAktion(organisationId)
  if (!organisation) notFound()

  return (
    <div className="flex min-h-dvh justify-center bg-background p-6">
      <main className="w-full max-w-md py-8">
        <h1 className="mb-1 text-xl font-semibold">Online bestellen bei {organisation.name}</h1>
        <p className="mb-6 text-sm text-muted">Zum Abholen oder Liefern – wählt Gerichte, Zeit und Kontaktdaten.</p>
        <BestellFormular organisationId={organisationId} />
      </main>
    </div>
  )
}
