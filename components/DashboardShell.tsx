'use client'

import { createContext, useContext, useState } from 'react'
import { X } from 'lucide-react'
import Sidebar, { type ShellNutzer } from './Sidebar'

const MobileNavContext = createContext<(() => void) | null>(null)

// Von AppHeader genutzt, um auf kleinen Bildschirmen die Sidebar als
// Overlay zu öffnen – lebt hier, weil der Umschalt-Zustand (offen/zu) in
// DashboardShell gehalten wird, AppHeader aber als Kind tiefer im Baum
// sitzt und keinen direkten Zugriff darauf hat.
export function useOpenMobileNav() {
  return useContext(MobileNavContext)
}

export default function DashboardShell({
  organisationName,
  nutzer,
  children,
}: {
  organisationName: string
  nutzer: ShellNutzer
  children: React.ReactNode
}) {
  const [mobilNavOffen, setMobilNavOffen] = useState(false)

  return (
    <MobileNavContext.Provider value={() => setMobilNavOffen(true)}>
      <div className="flex min-h-dvh">
        <div className="hidden md:flex">
          <Sidebar organisationName={organisationName} nutzer={nutzer} />
        </div>

        {mobilNavOffen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div className="absolute inset-0 bg-sidebar/40" onClick={() => setMobilNavOffen(false)} />
            <div className="relative flex">
              <Sidebar organisationName={organisationName} nutzer={nutzer} />
              <button
                type="button"
                onClick={() => setMobilNavOffen(false)}
                aria-label="Navigation schließen"
                className="absolute right-[-44px] top-4 flex h-9 w-9 items-center justify-center rounded-full bg-sidebar text-sidebar-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </MobileNavContext.Provider>
  )
}
