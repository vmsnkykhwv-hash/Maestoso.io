import Link from 'next/link'
import { PREISE_OEFFENTLICH } from '@/lib/preise'
import Wortmarke from './Wortmarke'

const LINKS = [
  { href: '/#funktionen', text: 'Funktionen' },
  { href: '/#ablauf', text: 'So arbeitest du' },
  { href: '/#sicherheit', text: 'Sicherheit' },
  ...(PREISE_OEFFENTLICH ? [{ href: '/preise', text: 'Preise' }] : []),
  { href: '/#fragen', text: 'Fragen' },
]

export default function Kopf() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-m-nacht/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" aria-label="Maestoso – zur Startseite">
          <Wortmarke hell />
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-white/75 lg:flex" aria-label="Hauptnavigation">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-white">
              {l.text}
            </Link>
          ))}
        </nav>
        <Link
          href="/#kontakt"
          className="rounded-full bg-m-gold px-4 py-2 text-sm font-semibold text-m-nacht transition hover:bg-m-gold-hell"
        >
          Demo anfragen
        </Link>
      </div>
    </header>
  )
}
