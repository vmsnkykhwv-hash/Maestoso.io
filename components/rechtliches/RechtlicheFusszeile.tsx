import Link from 'next/link'
import { gaesteHref } from '@/lib/gaesteLinks'

// Ohne organisationId: Links auf Impressum/Datenschutz der Plattform
// (Login, Dashboard). Mit organisationId: auf die Seiten des Betriebs – auf
// den Gästeseiten ist der Betrieb Anbieter, nicht Maestoso.
export default async function RechtlicheFusszeile({
  organisationId,
  className = '',
}: {
  organisationId?: string
  className?: string
}) {
  const impressum = organisationId ? await gaesteHref(organisationId, '/impressum') : '/impressum'
  const datenschutz = organisationId ? await gaesteHref(organisationId, '/datenschutz') : '/datenschutz'
  return (
    <footer className={`flex justify-center gap-4 text-xs text-muted ${className}`}>
      <Link href={impressum} className="hover:text-foreground">
        Impressum
      </Link>
      <Link href={datenschutz} className="hover:text-foreground">
        Datenschutz
      </Link>
    </footer>
  )
}
