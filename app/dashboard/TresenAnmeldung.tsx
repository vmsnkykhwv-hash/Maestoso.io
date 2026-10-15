'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'
import { mitarbeiterAnmelden } from '@/lib/mitarbeiter/aktionen'

// Am Tresen-Gerät arbeitet niemand anonym: erst wer seine PIN eingibt, sieht
// die für sie/ihn freigeschalteten Module – so ist jede Änderung einer Person
// zuzuordnen (Änderungsprotokoll).
export default function TresenAnmeldung({
  organisationName,
  geraetName,
  verwaltungHref,
}: {
  organisationName: string
  geraetName: string
  verwaltungHref: string
}) {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function anmelden(e: React.FormEvent) {
    e.preventDefault()
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await mitarbeiterAnmelden(pin)
      setPin('')
      if (ergebnis.fehler) return setFehler(ergebnis.fehler)
      router.refresh()
    })
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6">
      <form onSubmit={anmelden} className="w-full max-w-xs space-y-6 text-center">
        <div className="flex flex-col items-center gap-2">
          <Logo className="h-7 w-7 text-accent" />
          <h1 className="font-display text-xl font-semibold">{organisationName}</h1>
          <p className="text-xs text-muted">{geraetName}</p>
        </div>
        <label className="block text-sm font-medium">
          Deine PIN
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-3 text-center text-lg tracking-[0.5em]"
            autoFocus
          />
        </label>
        {fehler && <p className="text-sm font-medium text-danger">{fehler}</p>}
        <button
          type="submit"
          disabled={pending || !pin}
          className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground disabled:opacity-40"
        >
          {pending ? 'Prüfe…' : 'Anmelden'}
        </button>
        <Link href={verwaltungHref} className="block text-xs text-muted underline">
          Mit Verwaltungskonto anmelden
        </Link>
      </form>
    </main>
  )
}
