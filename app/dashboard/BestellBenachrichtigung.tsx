'use client'

// Solange eine Dashboard-Seite offen ist, fragt dieser Hintergrund-Timer in
// Intervallen nach, ob neue (noch nicht gesehene) Bestellungen eingetroffen
// sind, und zeigt dann einen auffälligen Banner – unabhängig davon, auf
// welcher Dashboard-Seite man gerade ist. Kein Cron-Job, keine echte
// Push-Benachrichtigung (würde Service Worker + Geräte-Registrierung
// brauchen): nur solange der Tab offen ist, dafür ohne zusätzliche
// Infrastruktur. Die Mail an die hinterlegte Benachrichtigungsadresse
// (lib/bestellung/email.ts) deckt den Fall ab, dass gerade niemand
// hinschaut.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, X } from 'lucide-react'
import { neueBestellungenAnzahlAktion } from './bestellung/actions'

const INTERVALL_MS = 20000

export default function BestellBenachrichtigung() {
  const [sichtbar, setSichtbar] = useState(false)
  const letzteAnzahlRef = useRef<number | null>(null)

  useEffect(() => {
    let abgebrochen = false

    async function pruefen() {
      let anzahl: number
      try {
        anzahl = await neueBestellungenAnzahlAktion()
      } catch {
        return // kein Organisations-Login auf dieser Seite (z. B. Plattform-Admin-Kontext) – einfach überspringen
      }
      if (abgebrochen) return

      if (letzteAnzahlRef.current !== null && anzahl > letzteAnzahlRef.current) {
        setSichtbar(true)
      }
      letzteAnzahlRef.current = anzahl
    }

    pruefen()
    const intervall = setInterval(pruefen, INTERVALL_MS)
    return () => {
      abgebrochen = true
      clearInterval(intervall)
    }
  }, [])

  if (!sichtbar) return null

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-3 bg-danger px-4 py-3 text-sm font-semibold text-white">
      <span className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 flex-none" /> Achtung: neue Bestellung eingetroffen!
      </span>
      <div className="flex flex-none items-center gap-3">
        <Link href="/dashboard/bestellung" onClick={() => setSichtbar(false)} className="underline">
          Ansehen
        </Link>
        <button type="button" onClick={() => setSichtbar(false)} aria-label="Hinweis schließen">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
