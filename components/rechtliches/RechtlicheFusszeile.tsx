import Link from 'next/link'

// Ohne organisationId: Links auf Impressum/Datenschutz der Plattform
// (Login, Dashboard). Mit organisationId: auf die Seiten des Betriebs – auf
// den Gästeseiten ist der Betrieb Anbieter, nicht Maestoso.
export default function RechtlicheFusszeile({
  organisationId,
  className = '',
}: {
  organisationId?: string
  className?: string
}) {
  const basis = organisationId ? `/website/${organisationId}` : ''
  return (
    <footer className={`flex justify-center gap-4 text-xs text-muted ${className}`}>
      <Link href={`${basis}/impressum`} className="hover:text-foreground">
        Impressum
      </Link>
      <Link href={`${basis}/datenschutz`} className="hover:text-foreground">
        Datenschutz
      </Link>
    </footer>
  )
}
