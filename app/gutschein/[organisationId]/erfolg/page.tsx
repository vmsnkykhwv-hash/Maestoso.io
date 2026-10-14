import Link from 'next/link'
import { ladeGutschein } from '@/lib/gutschein/daten'
import { gutscheinPaypalZahlungErfassen } from '@/lib/gutschein/zahlung'

export const dynamic = 'force-dynamic'

export default async function GutscheinErfolgPage({
  params,
  searchParams,
}: {
  params: Promise<{ organisationId: string }>
  searchParams: Promise<{ gutscheinId?: string }>
}) {
  const { organisationId } = await params
  const { gutscheinId } = await searchParams

  const ergebnis = await zahlungAbschliessen(organisationId, gutscheinId)

  return (
    <div className="flex min-h-dvh justify-center bg-background p-6">
      <main className="w-full max-w-md py-8 text-center">
        {ergebnis.fehler ? (
          <>
            <h1 className="mb-2 text-xl font-semibold text-danger">Zahlung nicht abgeschlossen</h1>
            <p className="text-sm text-muted">{ergebnis.fehler}</p>
          </>
        ) : (
          <>
            <h1 className="mb-2 text-xl font-semibold">Zahlung erfolgreich</h1>
            <p className="mb-4 text-sm text-muted">
              Dein Gutschein-Code wurde zusätzlich an deine E-Mail-Adresse geschickt.
            </p>
            <p className="mb-6 rounded-2xl border border-border bg-card p-4 text-lg font-bold tracking-widest">
              {ergebnis.code}
            </p>
          </>
        )}
        <Link href={`/gutschein/${organisationId}`} className="text-sm font-medium text-accent">
          Zurück
        </Link>
      </main>
    </div>
  )
}

// Die eigentliche Erfassung (PayPal-Capture + Bestätigungsmail) kann auch
// schon durch den Webhook gelaufen sein, falls der Kunde erst jetzt zu
// dieser Seite zurückfindet – gutscheinPaypalZahlungErfassen ist dafür
// idempotent (siehe lib/gutschein/zahlung.ts).
async function zahlungAbschliessen(
  organisationId: string,
  gutscheinId: string | undefined
): Promise<{ fehler?: string; code?: string }> {
  if (!gutscheinId) return { fehler: 'Unbekannte Zahlung.' }

  const gutschein = await ladeGutschein(gutscheinId)
  if (!gutschein || gutschein.organisationId !== organisationId) {
    return { fehler: 'Dieser Gutschein wurde nicht gefunden.' }
  }

  const ergebnis = await gutscheinPaypalZahlungErfassen(organisationId, gutschein)
  if (ergebnis.fehler) return { fehler: ergebnis.fehler }

  return { code: gutschein.code }
}
