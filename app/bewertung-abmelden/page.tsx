import type { Metadata } from 'next'
import Logo from '@/components/Logo'
import { abmeldeTokenPruefen, istAbgemeldet } from '@/lib/bewertung/abmeldung'
import { getServiceClient } from '@/lib/supabase/server'
import { abmeldenAktion } from './actions'

export const metadata: Metadata = { title: 'Bewertungsanfragen abbestellen', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function BewertungAbmelden({ searchParams }: { searchParams: Promise<{ t?: string; fertig?: string; fehler?: string }> }) {
  const { t, fertig, fehler } = await searchParams
  const daten = await abmeldeTokenPruefen(t)
  // Bewusst direkt statt organisationsName(): auch ein gesperrter Betrieb
  // soll hier mit Namen erscheinen, abmelden muss immer gehen.
  const { data: org } = daten
    ? await getServiceClient().from('organisationen').select('name').eq('id', daten.organisationId).maybeSingle()
    : { data: null }
  const betrieb = (org?.name as string | undefined) ?? 'diesem Betrieb'
  const schonAbgemeldet = daten ? await istAbgemeldet(daten.organisationId, daten.email) : false

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo className="h-8 w-8 text-accent" />
      {!daten ? (
        <>
          <h1 className="font-display text-2xl font-semibold">Link ungültig</h1>
          <p className="max-w-sm text-sm text-muted">Dieser Abmeldelink ist unvollständig oder abgelaufen. Antworte einfach auf die Mail, dann tragen wir dich von Hand aus.</p>
        </>
      ) : fertig || schonAbgemeldet ? (
        <>
          <h1 className="font-display text-2xl font-semibold">Du bist abgemeldet</h1>
          <p className="max-w-sm text-sm text-muted">
            {betrieb} schickt dir keine Bewertungsanfragen mehr an {daten.email}. Reservierungs- und Bestellbestätigungen bekommst du weiterhin.
          </p>
        </>
      ) : (
        <>
          <h1 className="font-display text-2xl font-semibold">Keine Bewertungsanfragen mehr?</h1>
          <p className="max-w-sm text-sm text-muted">
            {betrieb} schickt dann keine Bitten um eine Google-Bewertung mehr an {daten.email}.
          </p>
          {fehler && <p className="text-sm text-danger">Das hat gerade nicht geklappt. Bitte versuch es noch einmal.</p>}
          <form action={abmeldenAktion}>
            <input type="hidden" name="t" value={t} />
            <button className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">Abmelden</button>
          </form>
        </>
      )}
    </main>
  )
}
