'use client'

import { useEffect, useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { heuteBerlin, formatDatumKurz, wochentagKurz } from '@/lib/datum'
import { blockierungAnlegenAktion, blockierungenFuerTagLadenAktion, blockierungLoeschenAktion } from './actions'
import type { Blockierung } from '@/lib/tischplan/types'

export default function Blockierungen() {
  const [datum, setDatum] = useState(heuteBerlin())
  const [liste, setListe] = useState<Blockierung[]>([])
  const [startZeit, setStartZeit] = useState('09:00')
  const [endZeit, setEndZeit] = useState('20:30')
  const [anzahlTische, setAnzahlTische] = useState('1')
  const [notiz, setNotiz] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [laden, startLaden] = useTransition()
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    startLaden(async () => {
      setListe(await blockierungenFuerTagLadenAktion(datum))
    })
  }, [datum])

  function anlegen() {
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await blockierungAnlegenAktion({
        datum,
        startZeit,
        endZeit,
        anzahlTische: Number(anzahlTische) || 1,
        notiz: notiz.trim() || undefined,
      })
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler)
        return
      }
      if (ergebnis.blockierung) {
        setListe((prev) => [...prev, ergebnis.blockierung!])
        setNotiz('')
      }
    })
  }

  function loeschen(id: string) {
    setListe((prev) => prev.filter((b) => b.id !== id))
    startTransition(async () => {
      await blockierungLoeschenAktion(id)
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Eine Blockierung entfernt für den angegebenen Zeitraum eine festgelegte Anzahl Tische aus
        der Verfügbarkeit – z. B. für eine private Feier oder einen Ruhetag.
      </p>

      <div className="flex items-center justify-between">
        <input
          type="date"
          value={datum}
          onChange={(e) => setDatum(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm"
        />
        <span className="text-sm text-muted">
          {wochentagKurz(datum)} {formatDatumKurz(datum)}
        </span>
      </div>

      {laden ? (
        <p className="text-sm text-muted">Lade…</p>
      ) : liste.length === 0 ? (
        <p className="text-sm text-muted">Keine Blockierungen an diesem Tag.</p>
      ) : (
        <ul className="space-y-2">
          {liste.map((b) => (
            <li key={b.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
              <div>
                <p className="text-sm font-medium">
                  {b.startZeit}–{b.endZeit} Uhr · {b.anzahlTische} Tisch(e) blockiert
                </p>
                {b.notiz && <p className="text-xs text-muted">{b.notiz}</p>}
              </div>
              <button type="button" onClick={() => loeschen(b.id)} aria-label="Blockierung löschen" className="text-muted">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Neue Blockierung</h3>
        {fehler && <p className="mb-2 text-sm text-danger">{fehler}</p>}
        <div className="grid grid-cols-2 gap-2">
          <input
            type="time"
            value={startZeit}
            onChange={(e) => setStartZeit(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
          <input
            type="time"
            value={endZeit}
            onChange={(e) => setEndZeit(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
          <input
            type="number"
            min={1}
            value={anzahlTische}
            onChange={(e) => setAnzahlTische(e.target.value)}
            placeholder="Anzahl Tische"
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
          <input
            value={notiz}
            onChange={(e) => setNotiz(e.target.value)}
            placeholder="Notiz (optional)"
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
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
    </div>
  )
}
