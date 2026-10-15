'use client'

import { useState, useTransition } from 'react'
import { passwortFestlegenAktion } from '@/app/anmeldung/actions'
import { PASSWORT_MINDESTLAENGE } from '@/lib/konten/regeln'
import type { TokenZweck } from '@/lib/konten/einladung'

const FELD = 'mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-normal'

// Für Einladung (mit Namensfeld) und "Passwort vergessen". Danach geht es
// zur Anmeldeseite, die direkt beim zweiten Faktor weitermacht.
export default function PasswortFestlegen({
  organisationId,
  zweck,
  token,
  email,
  anmeldeHref,
}: {
  organisationId: string
  zweck: TokenZweck
  token: string
  email: string
  anmeldeHref: string
}) {
  const [name, setName] = useState('')
  const [passwort, setPasswort] = useState('')
  const [wiederholung, setWiederholung] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function absenden(e: React.FormEvent) {
    e.preventDefault()
    setFehler(null)
    if (passwort !== wiederholung) return setFehler('Die Passwörter stimmen nicht überein.')
    startTransition(async () => {
      const ergebnis = await passwortFestlegenAktion(organisationId, zweck, token, passwort, name)
      if (ergebnis.fehler) return setFehler(ergebnis.fehler)
      window.location.href = anmeldeHref
    })
  }

  return (
    <form onSubmit={absenden} className="space-y-4 text-left">
      <p className="text-sm text-muted">Konto: {email}</p>
      {zweck === 'einladung' && (
        <label className="block text-sm font-medium">
          Dein Name
          <input value={name} onChange={(e) => setName(e.target.value)} className={FELD} autoComplete="name" />
        </label>
      )}
      <label className="block text-sm font-medium">
        Neues Passwort (mind. {PASSWORT_MINDESTLAENGE} Zeichen)
        <input type="password" value={passwort} onChange={(e) => setPasswort(e.target.value)} className={FELD} autoComplete="new-password" required />
      </label>
      <label className="block text-sm font-medium">
        Passwort wiederholen
        <input type="password" value={wiederholung} onChange={(e) => setWiederholung(e.target.value)} className={FELD} autoComplete="new-password" required />
      </label>
      {fehler && <p className="text-sm font-medium text-danger">{fehler}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground disabled:opacity-40">
        {pending ? 'Speichere…' : 'Passwort festlegen'}
      </button>
    </form>
  )
}
