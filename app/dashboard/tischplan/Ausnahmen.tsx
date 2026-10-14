'use client'

import { useEffect, useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { formatDatumKurz, heuteBerlin, wochentagKurz } from '@/lib/datum'
import { ausnahmeLoeschenAktion, ausnahmeSpeichernAktion, ausnahmenLadenAktion } from './actions'
import type { ReservierungAusnahme } from '@/lib/tischplan/types'

export default function Ausnahmen() {
  const [ausnahmen, setAusnahmen] = useState<ReservierungAusnahme[]>([])
  const [laden, startLaden] = useTransition()
  const [pending, startTransition] = useTransition()

  const [datum, setDatum] = useState(heuteBerlin())
  const [geschlossen, setGeschlossen] = useState(false)
  const [von, setVon] = useState('09:00')
  const [bis, setBis] = useState('20:30')
  const [notiz, setNotiz] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)

  useEffect(() => {
    startLaden(async () => {
      setAusnahmen(await ausnahmenLadenAktion())
    })
  }, [])

  function anlegen() {
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await ausnahmeSpeichernAktion({
        datum,
        geschlossen,
        von: geschlossen ? null : von,
        bis: geschlossen ? null : bis,
        notiz: notiz.trim() || undefined,
      })
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler)
        return
      }
      if (ergebnis.ausnahme) {
        setAusnahmen((prev) => [...prev.filter((a) => a.datum !== ergebnis.ausnahme!.datum), ergebnis.ausnahme!].sort((a, b) => (a.datum < b.datum ? -1 : 1)))
        setNotiz('')
      }
    })
  }

  function loeschen(id: string) {
    setAusnahmen((prev) => prev.filter((a) => a.id !== id))
    startTransition(async () => {
      await ausnahmeLoeschenAktion(id)
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Für ein einzelnes Datum die Öffnungszeiten überschreiben – z. B. an Heiligabend kürzer geöffnet oder an einem
        Feiertag ganz geschlossen. Gilt nur für diesen einen Tag, die regulären Öffnungszeiten bleiben unverändert.
      </p>

      {laden ? (
        <p className="text-sm text-muted">Lade…</p>
      ) : ausnahmen.length === 0 ? (
        <p className="text-sm text-muted">Noch keine Ausnahmen hinterlegt.</p>
      ) : (
        <ul className="space-y-2">
          {ausnahmen.map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
              <div>
                <p className="text-sm font-medium">
                  {wochentagKurz(a.datum)} {formatDatumKurz(a.datum)} ·{' '}
                  {a.geschlossen ? 'Geschlossen' : `${a.von}–${a.bis} Uhr`}
                </p>
                {a.notiz && <p className="text-xs text-muted">{a.notiz}</p>}
              </div>
              <button type="button" onClick={() => loeschen(a.id)} aria-label="Ausnahme löschen" className="flex-none text-muted">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Neue Ausnahme</h3>
        {fehler && <p className="mb-2 text-sm text-danger">{fehler}</p>}
        <div className="space-y-2">
          <input
            type="date"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={geschlossen} onChange={(e) => setGeschlossen(e.target.checked)} />
            An diesem Tag komplett geschlossen
          </label>
          {!geschlossen && (
            <div className="grid grid-cols-2 gap-2">
              <input
                type="time"
                value={von}
                onChange={(e) => setVon(e.target.value)}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
              />
              <input
                type="time"
                value={bis}
                onChange={(e) => setBis(e.target.value)}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
              />
            </div>
          )}
          <input
            value={notiz}
            onChange={(e) => setNotiz(e.target.value)}
            placeholder="Notiz (optional), z. B. Heiligabend"
            className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={anlegen}
          disabled={pending}
          className="mt-3 w-full rounded-lg bg-accent py-2 text-sm font-semibold text-accent-foreground disabled:opacity-40"
        >
          {pending ? 'Speichert…' : 'Speichern'}
        </button>
      </div>
    </div>
  )
}
