import { notFound } from 'next/navigation'
import { organisationOeffentlichLadenAktion } from './actions'
import AnfrageFormular from './AnfrageFormular'

export const dynamic = 'force-dynamic'

export default async function VeranstaltungAnfragePage({ params }: { params: Promise<{ organisationId: string }> }) {
  const { organisationId } = await params
  const organisation = await organisationOeffentlichLadenAktion(organisationId)
  if (!organisation) notFound()

  return (
    <div className="flex min-h-dvh justify-center bg-background p-6">
      <main className="w-full max-w-md py-8">
        <h1 className="mb-1 text-xl font-semibold">Veranstaltung anfragen bei {organisation.name}</h1>
        <p className="mb-6 text-sm text-muted">
          Geschlossene Gesellschaft, Feier oder Raummiete – schickt uns die Eckdaten, wir melden uns zur Bestätigung bei euch.
        </p>
        {organisation.infoText && (
          <p className="mb-6 whitespace-pre-line rounded-xl border border-border bg-card p-4 text-sm text-muted">{organisation.infoText}</p>
        )}
        {organisation.aktiv ? (
          <AnfrageFormular organisationId={organisationId} />
        ) : (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">
            Veranstaltungsanfragen sind aktuell nicht möglich. Bitte direkt Kontakt aufnehmen.
          </p>
        )}
      </main>
    </div>
  )
}
