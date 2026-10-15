'use client'

import { useState, useTransition } from 'react'
import { handyKopplungAbschliessenAktion } from '@/app/dashboard/zugaenge/actions'

export default function HandyKoppeln({ organisationId, code, mitarbeiterName }: { organisationId: string; code: string; mitarbeiterName: string }) {
  const [pin, setPin] = useState('')
  const [geraetName, setGeraetName] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function koppeln(e: React.FormEvent) {
    e.preventDefault()
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await handyKopplungAbschliessenAktion(organisationId, code, pin, geraetName)
      if (ergebnis.fehler) return setFehler(ergebnis.fehler)
      window.location.href = '/dashboard/dienstplan'
    })
  }

  return (
    <form onSubmit={koppeln} className="space-y-4 text-left">
      <p className="text-sm text-muted">
        Dieses Handy wird mit deinem Zugang verbunden, <strong className="text-foreground">{mitarbeiterName}</strong>. Danach
        siehst du hier deinen Dienstplan, kannst Verfügbarkeiten eintragen und Schichten tauschen. Zur Bestätigung deine
        PIN eingeben.
      </p>
      <label className="block text-sm font-medium">
        Deine PIN
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm"
          required
        />
      </label>
      <label className="block text-sm font-medium">
        Name für dieses Handy (optional)
        <input
          value={geraetName}
          onChange={(e) => setGeraetName(e.target.value)}
          placeholder="z. B. Handy Mara"
          className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-normal"
        />
      </label>
      {fehler && <p className="text-sm font-medium text-danger">{fehler}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground disabled:opacity-40">
        {pending ? 'Kopple…' : 'Handy koppeln'}
      </button>
    </form>
  )
}
