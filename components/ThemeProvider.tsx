'use client'

import { createContext, useContext, useState } from 'react'
import { THEME_COOKIE_NAME, type Theme } from '@/lib/theme'

const ThemeContext = createContext<{ theme: Theme; umschalten: () => void } | null>(null)

export function useTheme() {
  return useContext(ThemeContext)
}

export default function ThemeProvider({ anfangsTheme, children }: { anfangsTheme: Theme; children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(anfangsTheme)

  function umschalten() {
    const neu: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(neu)
    // Ein Jahr gültig, damit die Wahl auch nach dem Abmelden bleibt –
    // reine Darstellungseinstellung, nichts Sicherheitsrelevantes.
    document.cookie = `${THEME_COOKIE_NAME}=${neu}; path=/; max-age=31536000; SameSite=Lax`
  }

  return (
    <ThemeContext.Provider value={{ theme, umschalten }}>
      <div data-theme={theme} className="min-h-dvh bg-background text-foreground">
        {children}
      </div>
    </ThemeContext.Provider>
  )
}
