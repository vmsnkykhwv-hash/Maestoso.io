'use client'

import { useEffect, useState, useTransition } from 'react'
import { heuteBerlin } from '@/lib/datum'
import { reservierungAnlegenAktion, slotsLadenAktion } from './actions'
import type { SlotVerfuegbarkeit } from '@/lib/tischplan/types'
import { cn } from '@/lib/utils'

export default function BuchungsFormular({ organisationId }: { organisationId: string }) {
  const [datum, setDatum] = useState(heuteBerlin())
  const [anzahlPersonen, setAnzahlPersonen] = useState(2)
  const [slots, setSlots] = useState<SlotVerfuegbarkeit[]>([])
  const [uhrzeit, setUhrzeit] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [erinnerung, setErinnerung] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [erfolg, setErfolg] = useState(false)
  const [ladenSlots, startLadenSlots] = useTransition()
  const [sendet, startSenden] = useTransition()

  useEffect(() => {
    startLadenSlots(async () => {
      setSlots(await slotsLadenAktion(organisationId, datum, anzahlPersonen))
    })
  }, [organisationId, datum, anzahlPersonen])

  function datumAendern(wert: string) {
    setUhrzeit(null)
    setDatum(wert)
  }

  function anzahlPersonenAendern(wert: number) {
    setUhrzeit(null)
    setAnzahlPersonen(wert)
  }

  function absenden() {
    if (!uhrzeit || !name.trim() || !email.trim()) return
    setFehler(null)
    startSenden(async () => {
      const ergebnis = await reservierungAnlegenAktion({
        organisationId,
        name,
        email,
        anzahlPersonen,
        datum,
        uhrzeit,
        erinnerung,
      })
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler)
        return
      }
      setErfolg(true)
    })
  }

  if (erfolg) {
    return (
      <div className="rounded-2xl border border-success bg-success-bg p-6 text-center">
        <p className="text-sm font-semibold text-success">Reservierung bestätigt!</p>
        <p className="mt-1 text-sm text-success">
          {datum} um {uhrzeit} Uhr für {anzahlPersonen} Personen. Ihr erhaltet gleich eine Bestätigungsmail.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="date"
          value={datum}
          min={heuteBerlin()}
          onChange={(e) => datumAendern(e.target.value)}
          className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm"
        />
        <select
          value={anzahlPersonen}
          onChange={(e) => anzahlPersonenAendern(Number(e.target.value))}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm"
        >
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? 'Person' : 'Personen'}
            </option>
          ))}
        </select>
      </div>

      {ladenSlots ? (
        <p className="text-sm text-muted">Lade freie Zeiten…</p>
      ) : slots.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">
          An diesem Tag ist leider keine Online-Buchung möglich.
        </p>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {slots.map((s) => (
            <button
              key={s.uhrzeit}
              type="button"
              disabled={!s.verfuegbar}
              onClick={() => setUhrzeit(s.uhrzeit)}
              className={cn(
                'rounded-lg py-2 text-xs font-medium',
                !s.verfuegbar && 'cursor-not-allowed bg-background text-muted opacity-40',
                s.verfuegbar && uhrzeit !== s.uhrzeit && 'bg-card text-foreground',
                s.verfuegbar && uhrzeit === s.uhrzeit && 'bg-accent text-accent-foreground'
              )}
            >
              {s.uhrzeit}
            </button>
          ))}
        </div>
      )}

      {uhrzeit && (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-Mail"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={erinnerung} onChange={(e) => setErinnerung(e.target.checked)} />
            Erinnerung 2 Stunden vorher per Mail
          </label>

          {fehler && <p className="text-sm text-danger">{fehler}</p>}

          <button
            type="button"
            onClick={absenden}
            disabled={sendet || !name.trim() || !email.trim()}
            className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground disabled:opacity-40"
          >
            {sendet ? 'Reserviert…' : `Tisch um ${uhrzeit} Uhr reservieren`}
          </button>
        </div>
      )}
    </div>
  )
}
