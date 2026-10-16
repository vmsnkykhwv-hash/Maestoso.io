import type { Metadata } from 'next'
import Logo from '@/components/Logo'
import { plattformUrl } from '@/lib/url'

export const metadata: Metadata = { title: 'Nicht erreichbar', robots: { index: false, follow: false } }

// Ziel von proxy.ts für jede Seite eines gesperrten Betriebs. Gäste sollen
// nicht lesen, dass die Testphase abgelaufen ist – nur der Betrieb selbst
// bekommt den Hinweis, an wen er sich wendet.
export default async function Gesperrt() {
  const plattform = await plattformUrl()
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo className="h-8 w-8 text-accent" />
      <h1 className="font-display text-2xl font-semibold">Diese Seite ist gerade nicht erreichbar</h1>
      <p className="max-w-sm text-sm text-muted">Bitte versuch es später noch einmal oder wende dich direkt an den Betrieb.</p>
      <p className="max-w-sm text-xs text-muted">
        Dein Betrieb? Alle Infos zum Zugang haben wir dir per Mail geschickt – oder{' '}
        <a href={`${plattform}/#kontakt`} className="underline">
          schreib uns
        </a>
        .
      </p>
    </main>
  )
}
