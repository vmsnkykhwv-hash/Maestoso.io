import Link from 'next/link'

// Gemeinsamer Rahmen für Impressum und Datenschutzerklärung (Plattform und
// je Betrieb) – schlicht gehalten, damit die Texte auch eingebettet oder
// ausgedruckt gut lesbar bleiben.
export default function RechtsSeite({
  titel,
  zurueckHref,
  zurueckText,
  children,
}: {
  titel: string
  zurueckHref: string
  zurueckText: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh justify-center bg-background px-6 py-10">
      <main className="w-full max-w-2xl">
        <Link href={zurueckHref} className="text-sm text-muted hover:text-foreground">
          ← {zurueckText}
        </Link>
        <h1 className="mt-4 font-display text-2xl font-semibold">{titel}</h1>
        <div className="mt-6 space-y-6 text-sm leading-relaxed">{children}</div>
      </main>
    </div>
  )
}

export function Abschnitt({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold">{titel}</h2>
      <div className="space-y-2 text-muted">{children}</div>
    </section>
  )
}
