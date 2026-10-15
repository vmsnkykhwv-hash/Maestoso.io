import Link from 'next/link'
import Logo from '@/components/Logo'

export default function NichtGefunden() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo className="h-8 w-8 text-accent" />
      <h1 className="font-display text-2xl font-semibold">Seite nicht gefunden</h1>
      <p className="max-w-sm text-sm text-muted">Diese Adresse gibt es nicht (mehr). Vielleicht hat sich der Link geändert.</p>
      <Link href="/" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
        Zur Startseite
      </Link>
    </main>
  )
}
