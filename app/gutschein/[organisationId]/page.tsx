import { notFound } from 'next/navigation'
import { gutscheinSeiteLadenAktion } from './actions'
import GutscheinFormular from './GutscheinFormular'

export const dynamic = 'force-dynamic'

export default async function GutscheinPage({ params }: { params: Promise<{ organisationId: string }> }) {
  const { organisationId } = await params
  const daten = await gutscheinSeiteLadenAktion(organisationId)
  if (!daten) notFound()

  return (
    <div className="flex min-h-dvh justify-center bg-background p-6">
      <main className="w-full max-w-md py-8">
        <h1 className="mb-1 text-xl font-semibold">Gutschein bei {daten.name}</h1>
        {daten.aktiv ? (
          <>
            <p className="mb-6 text-sm text-muted">Betrag wählen, Daten angeben – Zahlung online per PayPal oder vor Ort.</p>
            <GutscheinFormular
              organisationId={organisationId}
              betraege={daten.betraege}
              paypalVerfuegbar={daten.paypalVerfuegbar}
            />
          </>
        ) : (
          <p className="text-sm text-muted">Hier werden aktuell keine Gutscheine verkauft.</p>
        )}
      </main>
    </div>
  )
}
