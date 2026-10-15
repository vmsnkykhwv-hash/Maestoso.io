'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ersteinrichtungAktion } from '@/app/anmeldung/actions'
import { PASSWORT_MINDESTLAENGE } from '@/lib/konten/regeln'

const FELD = 'mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-normal'

export default function Ersteinrichtung() {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [email, setEmail] = useState('')
  const [passwort, setPasswort] = useState('')
  const [wiederholung, setWiederholung] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function absenden(e: React.FormEvent) {
    e.preventDefault()
    setFehler(null)
    if (passwort !== wiederholung) return setFehler('Die Passwörter stimmen nicht überein.')
    startTransition(async () => {
      const ergebnis = await ersteinrichtungAktion(pin, email, passwort)
      if (ergebnis.fehler) return setFehler(ergebnis.fehler)
      router.refresh()
    })
  }

  return (
    <form onSubmit={absenden} className="space-y-4 text-left">
      <p className="text-sm text-muted">
        Es gibt noch kein Admin-Konto. Zur Bestätigung einmalig den PIN aus <code>PLATTFORM_ADMIN_PIN</code> eingeben –
        danach meldest du dich nur noch mit E-Mail, Passwort und Authenticator-App an.
      </p>
      <label className="block text-sm font-medium">
        PLATTFORM_ADMIN_PIN
        <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} className={FELD} required />
      </label>
      <label className="block text-sm font-medium">
        E-Mail
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={FELD} autoComplete="username" required />
      </label>
      <label className="block text-sm font-medium">
        Passwort (mind. {PASSWORT_MINDESTLAENGE} Zeichen)
        <input type="password" value={passwort} onChange={(e) => setPasswort(e.target.value)} className={FELD} autoComplete="new-password" required />
      </label>
      <label className="block text-sm font-medium">
        Passwort wiederholen
        <input type="password" value={wiederholung} onChange={(e) => setWiederholung(e.target.value)} className={FELD} autoComplete="new-password" required />
      </label>
      {fehler && <p className="text-sm font-medium text-danger">{fehler}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground disabled:opacity-40">
        {pending ? 'Lege an…' : 'Admin-Konto anlegen'}
      </button>
    </form>
  )
}
