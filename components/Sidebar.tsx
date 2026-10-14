'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { logout } from '@/app/actions'
import { MODULE } from '@/lib/module'
import Logo from './Logo'

export default function Sidebar({ organisationName }: { organisationName: string }) {
  const pathname = usePathname()

  return (
    <nav className="flex h-full w-64 flex-none flex-col gap-7 bg-foreground px-4 py-7 text-background">
      <Link href="/dashboard" className="flex items-center gap-2.5 px-2">
        <Logo className="h-6 w-6 flex-none text-accent" />
        <span className="font-display text-xl font-semibold">Partitura</span>
      </Link>

      <ul className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {MODULE.map((modul) => {
          const aktiv = pathname.startsWith(modul.href)
          const Icon = modul.icon
          return (
            <li key={modul.schluessel}>
              <Link
                href={modul.href}
                className={
                  aktiv
                    ? 'flex min-h-11 items-center gap-3 rounded-lg bg-accent px-3.5 py-2.5 text-sm font-semibold text-accent-foreground'
                    : 'flex min-h-11 items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-background/75 hover:bg-background/10 hover:text-background'
                }
              >
                <Icon className="h-[18px] w-[18px] flex-none" />
                {modul.kurzname}
              </Link>
            </li>
          )
        })}
      </ul>

      <div className="flex flex-col gap-2 border-t border-background/15 pt-4">
        <p className="truncate px-2 text-sm font-semibold">{organisationName}</p>
        <form action={logout}>
          <button
            type="submit"
            className="flex min-h-9 items-center gap-2 px-2 text-xs text-background/70 hover:text-background"
          >
            <LogOut className="h-3.5 w-3.5" />
            Abmelden
          </button>
        </form>
      </div>
    </nav>
  )
}
