'use client'

import { useState, useTransition } from 'react'
import { gutscheinKaufenAktion } from './actions'
import { cn } from '@/lib/utils'

function formatPreis(betrag: number): string {
  return betrag.toFixed(2).replace('.', ',') + ' €'
}

export default function GutscheinFormular({
  organisationId,
  betraege,
  paypalVerfuegbar,
}: {
  organisationId: string
  betraege: number[]
  paypalVerfuegbar: boolean
}) {
  const [betrag, setBetrag] = useState<number | null>(betraege[0] ?? null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function kaufen(zahlungsart: 'paypal' | 'vor_ort') {
    if (!betrag) return
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await gutscheinKaufenAktion({ organisationId, betrag, name, email, zahlungsart })
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler)
        return
      }
      if (ergebnis.freigabeLink) {
        window.location.href = ergebnis.freigabeLink
        return
      }
      if (ergebnis.code) setCode(ergebnis.code)
    })
  }

  if (code) {
    return (
      <div className="space-y-4 rounded-2xl border border-border bg-card p-4 text-center">
        <p className="text-sm text-muted">Gutschein angelegt – Code außerdem per E-Mail verschickt.</p>
        <p className="rounded-xl border border-border bg-background p-4 text-lg font-bold tracking-widest">{code}</p>
        <p className="text-xs text-muted">Zahlung und Einlösen erfolgen vor Ort anhand dieses Codes.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {betraege.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setBetrag(b)}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium',
              betrag === b ? 'bg-accent text-accent-foreground' : 'bg-card text-muted'
            )}
          >
            {formatPreis(b)}
          </button>
        ))}
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm"
      />
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="E-Mail-Adresse"
        type="email"
        className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm"
      />

      {fehler && <p className="text-sm font-medium text-danger">{fehler}</p>}

      {paypalVerfuegbar && (
        <button
          type="button"
          onClick={() => kaufen('paypal')}
          disabled={pending || !betrag}
          className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground disabled:opacity-40"
        >
          {pending ? 'Einen Moment…' : 'Jetzt mit PayPal bezahlen'}
        </button>
      )}
      <button
        type="button"
        onClick={() => kaufen('vor_ort')}
        disabled={pending || !betrag}
        className="w-full rounded-xl bg-card py-3 text-sm font-semibold disabled:opacity-40"
      >
        {pending ? 'Einen Moment…' : 'Bestellen, vor Ort bezahlen'}
      </button>
    </div>
  )
}
