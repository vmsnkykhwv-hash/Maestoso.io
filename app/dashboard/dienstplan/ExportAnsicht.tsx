'use client'

import { useMemo, useState } from 'react'
import {
  datumPlusTage,
  formatDatumKurz,
  formatMonatLabel,
  heuteBerlin,
  monatsEnde,
  monatsStart,
  naechsterMonat,
  wochenStart,
} from '@/lib/datum'
import { cn } from '@/lib/utils'

type ZeitraumTyp = 'woche' | 'monat' | 'zeitraum'

export default function ExportAnsicht() {
  const [typ, setTyp] = useState<ZeitraumTyp>('woche')
  const [anker, setAnker] = useState(heuteBerlin())
  const [vonManuell, setVonManuell] = useState(wochenStart(heuteBerlin()))
  const [bisManuell, setBisManuell] = useState(heuteBerlin())

  const { von, bis, label } = useMemo(() => {
    if (typ === 'monat') {
      return { von: monatsStart(anker), bis: monatsEnde(anker), label: formatMonatLabel(anker) }
    }
    if (typ === 'zeitraum') {
      return { von: vonManuell, bis: bisManuell, label: `${formatDatumKurz(vonManuell)} – ${formatDatumKurz(bisManuell)}` }
    }
    const von = wochenStart(anker)
    const bis = datumPlusTage(von, 6)
    return { von, bis, label: `${formatDatumKurz(von)} – ${formatDatumKurz(bis)}` }
  }, [typ, anker, vonManuell, bisManuell])

  function zurueck() {
    setAnker((a) => (typ === 'monat' ? naechsterMonat(a, -1) : datumPlusTage(a, -7)))
  }
  function weiter() {
    setAnker((a) => (typ === 'monat' ? naechsterMonat(a, 1) : datumPlusTage(a, 7)))
  }

  const href = `/dashboard/dienstplan/export?von=${von}&bis=${bis}`

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['woche', 'monat', 'zeitraum'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTyp(t)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium',
              typ === t ? 'bg-accent text-accent-foreground' : 'bg-card text-muted'
            )}
          >
            {t === 'woche' ? 'Woche' : t === 'monat' ? 'Monat' : 'Zeitraum'}
          </button>
        ))}
      </div>

      {typ === 'zeitraum' ? (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={vonManuell}
            max={bisManuell}
            onChange={(e) => setVonManuell(e.target.value)}
            className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm"
          />
          <span className="text-xs text-muted">bis</span>
          <input
            type="date"
            value={bisManuell}
            min={vonManuell}
            onChange={(e) => setBisManuell(e.target.value)}
            className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm"
          />
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <button type="button" onClick={zurueck} className="px-2 text-muted">
            ←
          </button>
          <span className="text-sm font-semibold">{label}</span>
          <button type="button" onClick={weiter} className="px-2 text-muted">
            →
          </button>
        </div>
      )}

      <a
        href={href}
        className="block w-full rounded-xl bg-accent py-3 text-center text-sm font-semibold text-accent-foreground"
      >
        Als Excel herunterladen
      </a>
    </div>
  )
}
