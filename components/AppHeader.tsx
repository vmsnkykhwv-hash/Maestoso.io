'use client'

import { LogOut, Menu } from 'lucide-react'
import { logout } from '@/app/actions'
import { useOpenMobileNav } from './DashboardShell'

// Innerhalb von DashboardShell (Dashboard-Seiten) übernimmt die Sidebar das
// Abmelden; hier erscheint stattdessen auf kleinen Bildschirmen ein Knopf,
// der die Sidebar als Overlay öffnet. Außerhalb von DashboardShell (aktuell
// nur der Plattform-Admin-Bereich, der keine Sidebar hat) bleibt der
// klassische Abmelden-Knopf, sonst käme man dort gar nicht mehr raus.
export default function AppHeader({ titel }: { titel: string }) {
  const openMobileNav = useOpenMobileNav()

  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
      <div className="flex items-center gap-3">
        {openMobileNav && (
          <button
            type="button"
            onClick={openMobileNav}
            aria-label="Navigation öffnen"
            className="-ml-1.5 flex h-9 w-9 items-center justify-center rounded-lg text-foreground-soft md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <h1 className="font-display text-lg font-semibold">{titel}</h1>
      </div>
      {!openMobileNav && (
        <form action={logout}>
          <button type="submit" className="flex items-center gap-1.5 text-sm text-muted">
            <LogOut className="h-4 w-4" />
            Abmelden
          </button>
        </form>
      )}
    </header>
  )
}
