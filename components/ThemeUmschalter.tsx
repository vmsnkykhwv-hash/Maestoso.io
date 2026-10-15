'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from './ThemeProvider'

export default function ThemeUmschalter({ className = '' }: { className?: string }) {
  const kontext = useTheme()
  // Außerhalb eines ThemeBereich (öffentliche Gästeseiten) gibt es nichts
  // umzuschalten.
  if (!kontext) return null

  const dunkel = kontext.theme === 'dark'
  return (
    <button
      type="button"
      onClick={kontext.umschalten}
      aria-label={dunkel ? 'Helles Design einschalten' : 'Dunkles Design einschalten'}
      className={`flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted ${className}`}
    >
      {dunkel ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
      {dunkel ? 'Hell' : 'Dunkel'}
    </button>
  )
}
