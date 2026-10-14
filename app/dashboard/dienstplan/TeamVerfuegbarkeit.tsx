'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { alleTageZwischen, datumPlusTage, formatDatumKurz, heuteBerlin, wochenStart, wochentagKurz } from '@/lib/datum'
import { verfuegbarkeitenFuerZeitraumLadenAktion } from './actions'
import type { Verfuegbarkeit } from '@/lib/dienstplan/types'

export default function TeamVerfuegbarkeit({ mitarbeiterNamen }: { mitarbeiterNamen: { id: string; name: string }[] }) {
  const [anker, setAnker] = useState(heuteBerlin())
  const [verfuegbarkeiten, setVerfuegbarkeiten] = useState<Verfuegbarkeit[]>([])
  const [laden, startLaden] = useTransition()

  const von = useMemo(() => wochenStart(anker), [anker])
  const bis = useMemo(() => datumPlusTage(von, 6), [von])
  const tage = useMemo(() => alleTageZwischen(von, bis), [von, bis])

  useEffect(() => {
    startLaden(async () => {
      setVerfuegbarkeiten(await verfuegbarkeitenFuerZeitraumLadenAktion(von, bis))
    })
  }, [von, bis])

  function nameVon(mitarbeiterId: string): string {
    return mitarbeiterNamen.find((m) => m.id === mitarbeiterId)?.name ?? 'Unbekannt'
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => setAnker((a) => datumPlusTage(a, -7))} className="px-2 text-muted">
          ←
        </button>
        <span className="text-sm font-semibold">
          {formatDatumKurz(von)} – {formatDatumKurz(bis)}
        </span>
        <button type="button" onClick={() => setAnker((a) => datumPlusTage(a, 7))} className="px-2 text-muted">
          →
        </button>
      </div>

      <p className="mb-3 text-xs text-muted">
        Wer hat für welchen Tag eine Verfügbarkeit eingetragen? Mitarbeiter ohne Eintrag haben keine Angabe gemacht.
      </p>

      {laden ? (
        <p className="text-sm text-muted">Lade…</p>
      ) : (
        <div className="space-y-2">
          {tage.map((tag) => {
            const desTages = verfuegbarkeiten.filter((v) => v.datum === tag)
            const verfuegbar = desTages.filter((v) => v.verfuegbar)
            const nichtVerfuegbar = desTages.filter((v) => !v.verfuegbar)

            return (
              <div key={tag} className="rounded-2xl border border-border bg-card p-3">
                <span className={cnDatum(tag)}>
                  {wochentagKurz(tag)} {formatDatumKurz(tag)}
                </span>

                {desTages.length === 0 ? (
                  <p className="mt-1 text-xs text-muted">Keine Angaben.</p>
                ) : (
                  <div className="mt-1.5 space-y-1">
                    {verfuegbar.length > 0 && (
                      <p className="text-xs text-success">
                        Verfügbar:{' '}
                        {verfuegbar
                          .map((v) => `${nameVon(v.mitarbeiterId)}${v.von && v.bis ? ` (${v.von}–${v.bis})` : ''}`)
                          .join(', ')}
                      </p>
                    )}
                    {nichtVerfuegbar.length > 0 && (
                      <p className="text-xs text-locked">Nicht verfügbar: {nichtVerfuegbar.map((v) => nameVon(v.mitarbeiterId)).join(', ')}</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function cnDatum(tag: string): string {
  return tag < heuteBerlin() ? 'text-xs font-semibold text-muted' : 'text-xs font-semibold text-foreground'
}
