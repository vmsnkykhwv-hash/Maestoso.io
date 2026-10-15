'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { History, KeyRound, LogOut, Scale, UserRoundX } from 'lucide-react'
import { logout } from '@/app/actions'
import { geraetEntkoppelnAktion } from '@/app/dashboard/zugaenge/actions'
import { mitarbeiterAbmelden } from '@/lib/mitarbeiter/aktionen'
import { MODULE, type ModulSchluessel } from '@/lib/module'
import Logo from './Logo'

// Wer gerade arbeitet – bestimmt, welche Module und welche Fußzeile die
// Sidebar zeigt (die eigentliche Prüfung passiert serverseitig in
// lib/zugriff.ts, das hier ist nur die Anzeige).
export type ShellNutzer =
  | { art: 'inhaber' }
  | { art: 'tresen'; name: string; module: ModulSchluessel[] }
  | { art: 'handy'; name: string; module: ModulSchluessel[] }

const FUSSLINK = 'flex min-h-9 items-center gap-2 px-2 text-xs hover:text-sidebar-foreground'

export default function Sidebar({ organisationName, nutzer }: { organisationName: string; nutzer: ShellNutzer }) {
  const pathname = usePathname()
  const sichtbar = nutzer.art === 'inhaber' ? MODULE : MODULE.filter((m) => nutzer.module.includes(m.schluessel))

  function fusslink(href: string, Icon: typeof Scale, text: string) {
    return (
      <Link href={href} className={`${FUSSLINK} ${pathname.startsWith(href) ? 'font-semibold text-accent' : 'text-sidebar-foreground/70'}`}>
        <Icon className="h-3.5 w-3.5" />
        {text}
      </Link>
    )
  }

  return (
    <nav className="flex h-full w-64 flex-none flex-col gap-7 bg-sidebar px-4 py-7 text-sidebar-foreground">
      <Link href="/dashboard" className="flex items-center gap-2.5 px-2">
        <Logo className="h-6 w-6 flex-none text-accent" />
        <span className="font-display text-xl font-semibold">Maestoso</span>
      </Link>

      <ul className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {sichtbar.map((modul) => {
          const aktiv = pathname.startsWith(modul.href)
          const Icon = modul.icon
          return (
            <li key={modul.schluessel}>
              <Link
                href={modul.href}
                className={
                  aktiv
                    ? 'flex min-h-11 items-center gap-3 rounded-lg bg-accent px-3.5 py-2.5 text-sm font-semibold text-accent-foreground'
                    : 'flex min-h-11 items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-sidebar-foreground/75 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground'
                }
              >
                <Icon className="h-[18px] w-[18px] flex-none" />
                {modul.kurzname}
              </Link>
            </li>
          )
        })}
      </ul>

      <div className="flex flex-col gap-2 border-t border-sidebar-foreground/15 pt-4">
        <p className="truncate px-2 text-sm font-semibold">{organisationName}</p>

        {nutzer.art === 'inhaber' && (
          <>
            {fusslink('/dashboard/zugaenge', KeyRound, 'Zugänge & Geräte')}
            {fusslink('/dashboard/protokoll', History, 'Änderungsprotokoll')}
            {fusslink('/dashboard/rechtliches', Scale, 'Impressum & Datenschutz')}
            <form action={logout}>
              <button type="submit" className={`${FUSSLINK} text-sidebar-foreground/70`}>
                <LogOut className="h-3.5 w-3.5" />
                Abmelden
              </button>
            </form>
          </>
        )}

        {nutzer.art === 'tresen' && (
          <>
            <p className="px-2 text-xs text-sidebar-foreground/70">Am Tresen: {nutzer.name}</p>
            <form action={async () => { await mitarbeiterAbmelden(); window.location.href = '/dashboard' }}>
              <button type="submit" className={`${FUSSLINK} text-sidebar-foreground/70`}>
                <LogOut className="h-3.5 w-3.5" />
                Abmelden / Wechseln
              </button>
            </form>
          </>
        )}

        {nutzer.art === 'handy' && (
          <>
            <p className="px-2 text-xs text-sidebar-foreground/70">{nutzer.name}</p>
            <form
              action={async () => {
                if (!window.confirm('Dieses Handy wirklich entkoppeln? Danach braucht es einen neuen QR-Code.')) return
                await geraetEntkoppelnAktion()
                window.location.href = '/team'
              }}
            >
              <button type="submit" className={`${FUSSLINK} text-sidebar-foreground/70`}>
                <UserRoundX className="h-3.5 w-3.5" />
                Handy entkoppeln
              </button>
            </form>
          </>
        )}

        {/* Impressum/Datenschutz der Plattform selbst – die Angaben des
            Betriebs pflegt der Link oben. */}
        <div className="flex gap-3 px-2 pt-1 text-[11px] text-sidebar-foreground/50">
          <Link href="/impressum" className="hover:text-sidebar-foreground">
            Impressum
          </Link>
          <Link href="/datenschutz" className="hover:text-sidebar-foreground">
            Datenschutz
          </Link>
        </div>
      </div>
    </nav>
  )
}
