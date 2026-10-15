'use client'

import Logo from '@/components/Logo'

// Keine technischen Details anzeigen – die stehen im Server-Log. Die
// digest-Nummer hilft beim Support, den passenden Logeintrag zu finden.
export default function Fehler({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo className="h-8 w-8 text-accent" />
      <h1 className="font-display text-2xl font-semibold">Da ist etwas schiefgegangen</h1>
      <p className="max-w-sm text-sm text-muted">
        Deine Eingaben bis eben sind gespeichert, nur diese Ansicht konnte nicht geladen werden. Versuch es noch einmal – wenn
        es wieder passiert, melde dich bei uns{error.digest ? ` und nenn den Code ${error.digest}` : ''}.
      </p>
      <button type="button" onClick={reset} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
        Nochmal versuchen
      </button>
    </main>
  )
}
