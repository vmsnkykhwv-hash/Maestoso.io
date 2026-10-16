import Link from 'next/link'
import { PREISE_OEFFENTLICH } from '@/lib/preise'
import Wortmarke from './Wortmarke'

export default function Fuss() {
  return (
    <footer className="bg-m-nacht text-white/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-xs space-y-3">
          <Wortmarke hell slogan />
          <p className="text-sm">Software für kleine Gastronomiebetriebe. Entwickelt und betrieben in Deutschland.</p>
        </div>
        <nav className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm" aria-label="Fußnavigation">
          <Link href="/#funktionen" className="hover:text-white">Funktionen</Link>
          <Link href="/impressum" className="hover:text-white">Impressum</Link>
          {PREISE_OEFFENTLICH ? <Link href="/preise" className="hover:text-white">Preise</Link> : <span />}
          <Link href="/datenschutz" className="hover:text-white">Datenschutz</Link>
          <Link href="/#kontakt" className="hover:text-white">Kontakt</Link>
          <Link href="/login" className="hover:text-white">Admin</Link>
        </nav>
      </div>
      <p className="border-t border-white/10 py-4 text-center text-xs text-white/40">© {new Date().getFullYear()} Maestoso</p>
    </footer>
  )
}
