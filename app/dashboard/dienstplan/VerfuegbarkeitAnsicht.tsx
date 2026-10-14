'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { alleTageZwischen, datumPlusTage, formatDatumKurz, heuteBerlin, wochenStart, wochentagKurz } from '@/lib/datum'
import { verfuegbarkeitenLadenAktion, verfuegbarkeitSetzenAktion } from './actions'
import type { Verfuegbarkeit } from '@/lib/dienstplan/types'
import type { Mitarbeiter } from '@/lib/mitarbeiter/types'

type Zeile = { verfuegbar: boolean; von: string; bis: string; notiz: string }

function leereZeile(): Zeile {
  return { verfuegbar: true, von: '', bis: '', notiz: '' }
}

function zeileAusVerfuegbarkeit(v: Verfuegbarkeit): Zeile {
  return { verfuegbar: v.verfuegbar, von: v.von ?? '', bis: v.bis ?? '', notiz: v.notiz ?? '' }
}

export default function VerfuegbarkeitAnsicht({ mitarbeiter }: { mitarbeiter: Mitarbeiter }) {
  const [anker, setAnker] = useState(heuteBerlin())
  const [zeilen, setZeilen] = useState<Record<string, Zeile>>({})
  const [laden, startLaden] = useTransition()
  const [speicherndTag, setSpeicherndTag] = useState<string | null>(null)

  const von = useMemo(() => wochenStart(anker), [anker])
  const bis = useMemo(() => datumPlusTage(von, 6), [von])
  const tage = useMemo(() => alleTageZwischen(von, bis), [von, bis])

  useEffect(() => {
    startLaden(async () => {
      const liste = await verfuegbarkeitenLadenAktion(mitarbeiter.id, von, bis)
      const karte: Record<string, Zeile> = {}
      for (const tag of alleTageZwischen(von, bis)) karte[tag] = leereZeile()
      for (const v of liste) karte[v.datum] = zeileAusVerfuegbarkeit(v)
      setZeilen(karte)
    })
  }, [mitarbeiter.id, von, bis])

  function feldAendern(tag: string, patch: Partial<Zeile>) {
    setZeilen((prev) => ({ ...prev, [tag]: { ...(prev[tag] ?? leereZeile()), ...patch } }))
  }

  function speichern(tag: string) {
    const zeile = zeilen[tag]
    setSpeicherndTag(tag)
    verfuegbarkeitSetzenAktion({
      datum: tag,
      verfuegbar: zeile.verfuegbar,
      von: zeile.verfuegbar && zeile.von ? zeile.von : null,
      bis: zeile.verfuegbar && zeile.bis ? zeile.bis : null,
      notiz: zeile.notiz.trim() || undefined,
    }).finally(() => setSpeicherndTag(null))
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
        Trag hier ein, an welchen Tagen du (nicht) arbeiten kannst – die Leitung sieht das beim Planen der Schichten.
      </p>

      {laden ? (
        <p className="text-sm text-muted">Lade…</p>
      ) : (
        <div className="space-y-2">
          {tage.map((tag) => {
            const zeile = zeilen[tag] ?? leereZeile()
            return (
              <div key={tag} className="rounded-2xl border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">
                    {wochentagKurz(tag)} {formatDatumKurz(tag)}
                  </span>
                  <select
                    value={zeile.verfuegbar ? 'verfuegbar' : 'nicht_verfuegbar'}
                    onChange={(e) => feldAendern(tag, { verfuegbar: e.target.value === 'verfuegbar' })}
                    className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
                  >
                    <option value="verfuegbar">Verfügbar</option>
                    <option value="nicht_verfuegbar">Nicht verfügbar</option>
                  </select>
                </div>

                {zeile.verfuegbar && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      type="time"
                      value={zeile.von}
                      onChange={(e) => feldAendern(tag, { von: e.target.value })}
                      placeholder="ab (optional)"
                      className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                    />
                    <input
                      type="time"
                      value={zeile.bis}
                      onChange={(e) => feldAendern(tag, { bis: e.target.value })}
                      placeholder="bis (optional)"
                      className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                    />
                  </div>
                )}

                <input
                  value={zeile.notiz}
                  onChange={(e) => feldAendern(tag, { notiz: e.target.value })}
                  placeholder="Notiz (optional)"
                  className="mt-2 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                />

                <button
                  type="button"
                  onClick={() => speichern(tag)}
                  disabled={speicherndTag === tag}
                  className="mt-2 w-full rounded-lg bg-accent py-1.5 text-xs font-semibold text-accent-foreground disabled:opacity-40"
                >
                  {speicherndTag === tag ? 'Speichert…' : 'Speichern'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
