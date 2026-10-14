'use client'

import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { tischAktualisierenAktion, tischAnlegenAktion, tischLoeschenAktion } from './actions'
import type { Tisch } from '@/lib/tischplan/types'

export default function TischeVerwaltung({ tische, onAendern }: { tische: Tisch[]; onAendern: (tische: Tisch[]) => void }) {
  const [name, setName] = useState('')
  const [kapazitaet, setKapazitaet] = useState('2')
  const [fehler, setFehler] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function anlegen() {
    if (!name.trim()) return
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await tischAnlegenAktion({ name, kapazitaet: Number(kapazitaet) || 1 })
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler)
        return
      }
      if (ergebnis.tisch) {
        onAendern([...tische, ergebnis.tisch])
        setName('')
        setKapazitaet('2')
      }
    })
  }

  function kapazitaetAendern(id: string, wert: number) {
    onAendern(tische.map((t) => (t.id === id ? { ...t, kapazitaet: wert } : t)))
    startTransition(async () => {
      await tischAktualisierenAktion(id, { kapazitaet: wert })
    })
  }

  function loeschen(id: string) {
    onAendern(tische.filter((t) => t.id !== id))
    startTransition(async () => {
      await tischLoeschenAktion(id)
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Jeder Tisch zählt als ein buchbarer Slot – wie viele Personen tatsächlich an einem Tisch
        sitzen können, dient nur eurer eigenen Übersicht und wird bei Reservierungen nicht
        automatisch geprüft.
      </p>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Neuen Tisch anlegen</h3>
        {fehler && <p className="mb-2 text-sm text-danger">{fehler}</p>}
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Tisch 1"
            className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
          <input
            type="number"
            min={1}
            value={kapazitaet}
            onChange={(e) => setKapazitaet(e.target.value)}
            placeholder="Plätze"
            className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={anlegen}
          disabled={pending}
          className="mt-3 w-full rounded-lg bg-accent py-2 text-sm font-semibold text-accent-foreground disabled:opacity-40"
        >
          Anlegen
        </button>
      </div>

      {tische.length === 0 ? (
        <p className="text-sm text-muted">Noch keine Tische angelegt.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {tische.map((t) => (
            <div key={t.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{t.name}</span>
                <button type="button" onClick={() => loeschen(t.id)} aria-label={`${t.name} löschen`} className="text-muted">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <label className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                Plätze
                <input
                  type="number"
                  min={1}
                  defaultValue={t.kapazitaet}
                  onBlur={(e) => kapazitaetAendern(t.id, Number(e.target.value) || 1)}
                  className="w-14 rounded-lg border border-border bg-background px-1.5 py-1 text-xs"
                />
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
