'use client'

import { useEffect, useState, useTransition } from 'react'
import { formatDatumKurz, heuteBerlin, wochentagKurz } from '@/lib/datum'
import { bestellungenFuerTagLadenAktion, bestellungStatusAendernAktion } from './actions'
import { BESTELL_STATUS_LABEL, type Bestellung, type BestellStatus } from '@/lib/bestellung/types'
import { cn } from '@/lib/utils'

const STATUS_FARBE: Record<BestellStatus, string> = {
  neu: 'text-locked',
  bestaetigt: 'text-accent',
  abgeschlossen: 'text-success',
  storniert: 'text-muted',
}

const KANAL_LABEL: Record<Bestellung['kanal'], string> = { abholung: 'Abholung', lieferung: 'Lieferung' }

function formatPreis(preis: number): string {
  return preis.toFixed(2).replace('.', ',') + ' €'
}

export default function BestellListe() {
  const [datum, setDatum] = useState(heuteBerlin())
  const [bestellungen, setBestellungen] = useState<Bestellung[]>([])
  const [laden, startLaden] = useTransition()
  const [, startAktion] = useTransition()

  useEffect(() => {
    startLaden(async () => {
      setBestellungen(await bestellungenFuerTagLadenAktion(datum))
    })
  }, [datum])

  function statusAendern(id: string, status: BestellStatus) {
    setBestellungen((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)))
    startAktion(async () => {
      await bestellungStatusAendernAktion(id, status)
    })
  }

  const aktive = bestellungen.filter((b) => b.status !== 'storniert')

  return (
    <div className="space-y-4">
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
      ) : aktive.length === 0 ? (
        <p className="text-sm text-muted">Keine Bestellungen an diesem Tag.</p>
      ) : (
        <ul className="space-y-2">
          {aktive.map((b) => (
            <li key={b.id} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    {b.uhrzeit} Uhr · {KANAL_LABEL[b.kanal]} · {b.name}
                  </p>
                  <p className="text-xs text-muted">
                    {b.telefon}
                    {b.adresse ? ` · ${b.adresse}` : ''}
                  </p>
                </div>
                <div className="flex flex-none items-center gap-2">
                  {!b.gesehen && (
                    <span className="rounded-full bg-danger px-2 py-0.5 text-xs font-semibold text-white">Neu</span>
                  )}
                  <span className={cn('text-xs font-semibold', STATUS_FARBE[b.status])}>{BESTELL_STATUS_LABEL[b.status]}</span>
                </div>
              </div>

              <ul className="mt-2 space-y-0.5 text-xs text-muted">
                {b.positionen.map((p) => (
                  <li key={p.id}>
                    {p.menge}× {p.name}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs font-semibold">{formatPreis(b.gesamtPreis)}</p>
              {b.notiz && <p className="mt-1 text-xs text-muted">{b.notiz}</p>}

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {(Object.keys(BESTELL_STATUS_LABEL) as BestellStatus[])
                  .filter((s) => s !== b.status)
                  .map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => statusAendern(b.id, s)}
                      className="rounded-lg bg-background px-2 py-1 text-xs font-medium text-muted"
                    >
                      {BESTELL_STATUS_LABEL[s]}
                    </button>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
