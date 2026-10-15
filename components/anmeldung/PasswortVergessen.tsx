'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { passwortVergessenAktion } from '@/app/anmeldung/actions'

export default function PasswortVergessen({ organisationId, anmeldeHref }: { organisationId: string; anmeldeHref: string }) {
  const [email, setEmail] = useState('')
  const [gesendet, setGesendet] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function absenden(e: React.FormEvent) {
    e.preventDefault()
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await passwortVergessenAktion(organisationId, email)
      if (ergebnis.fehler) return setFehler(ergebnis.fehler)
      setGesendet(true)
    })
  }

  if (gesendet) {
    return (
      <div className="space-y-4 text-sm text-muted">
        <p>Wenn es zu dieser Adresse ein Konto gibt, ist jetzt eine E-Mail mit einem Link unterwegs. Er ist eine Stunde gültig.</p>
        <Link href={anmeldeHref} className="font-medium text-accent">
          Zurück zur Anmeldung
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={absenden} className="space-y-4 text-left">
      <label className="block text-sm font-medium">
        E-Mail deines Kontos
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-normal"
          required
        />
      </label>
      {fehler && <p className="text-sm font-medium text-danger">{fehler}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground disabled:opacity-40">
        {pending ? 'Sende…' : 'Link zuschicken'}
      </button>
      <p className="text-center text-xs text-muted">
        <Link href={anmeldeHref}>Zurück zur Anmeldung</Link>
      </p>
    </form>
  )
}
