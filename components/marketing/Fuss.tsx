import Link from 'next/link'
import { PREISE_OEFFENTLICH } from '@/lib/preise'
import Wortmarke from './Wortmarke'

const LINKS = [
  { href: '/#funktionen', text: 'Funktionen' },
  ...(PREISE_OEFFENTLICH ? [{ href: '/preise', text: 'Preise' }] : []),
  { href: '/#kontakt', text: 'Kontakt' },
  { href: '/impressum', text: 'Impressum' },
  { href: '/datenschutz', text: 'Datenschutz' },
  { href: '/login', text: 'Admin' },
]

export default function Fuss() {
  return (
    <footer className="bg-m-nacht text-white/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <Wortmarke hell slogan />
          <p className="text-sm">
            Aus der Gastronomie gedacht, für die Gastronomie gemacht.
            <br />
            Entwickelt und betrieben in Deutschland.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Fußnavigation">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-white">
              {l.text}
            </Link>
          ))}
        </nav>
      </div>
      <p className="border-t border-white/10 py-4 text-center text-xs text-white/40">© {new Date().getFullYear()} Maestoso</p>
    </footer>
  )
}
