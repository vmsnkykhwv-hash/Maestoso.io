'use client'

import { useEffect, useState, useTransition } from 'react'
import { Download } from 'lucide-react'
import { formatDatumKurz } from '@/lib/datum'
import { allePruefungenLadenAktion, lieferantenLadenAktion, pruefungZuweisenAktion } from './actions'
import type { Bestandspruefung, Lieferant } from '@/lib/lager/types'
import { cn } from '@/lib/utils'

export default function PruefungenUebersicht({ mitarbeiterNamen }: { mitarbeiterNamen: { id: string; name: string }[] }) {
  const [pruefungen, setPruefungen] = useState<Bestandspruefung[]>([])
  const [lieferanten, setLieferanten] = useState<Lieferant[]>([])
  const [laden, startLaden] = useTransition()
  const [, startAktion] = useTransition()

  useEffect(() => {
    startLaden(async () => {
      const [p, l] = await Promise.all([allePruefungenLadenAktion(), lieferantenLadenAktion()])
      setPruefungen(p)
      setLieferanten(l)
    })
  }, [])

  function lieferantName(id: string): string {
    return lieferanten.find((l) => l.id === id)?.name ?? 'Unbekannt'
  }

  function zuweisen(pruefungId: string, mitarbeiterId: string) {
    setPruefungen((prev) => prev.map((p) => (p.id === pruefungId ? { ...p, zugewiesenerMitarbeiterId: mitarbeiterId || null } : p)))
    startAktion(async () => {
      await pruefungZuweisenAktion(pruefungId, mitarbeiterId || null)
    })
  }

  if (laden) return <p className="text-sm text-muted">Lade…</p>

  if (pruefungen.length === 0) {
    return <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">Noch keine Prüfungen angelegt – die erste entsteht automatisch, sobald ein Lieferant bald fällig ist.</p>
  }

  return (
    <div className="space-y-2">
      {pruefungen.map((p) => (
        <div key={p.id} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{lieferantName(p.lieferantId)}</p>
              <p className="text-xs text-muted">Bestelltermin: {formatDatumKurz(p.bestelldatum)}</p>
            </div>
            <span className={cn('text-xs font-semibold', p.status === 'erledigt' ? 'text-success' : 'text-locked')}>
              {p.status === 'erledigt' ? 'Erledigt' : 'Offen'}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={p.zugewiesenerMitarbeiterId ?? ''}
              onChange={(e) => zuweisen(p.id, e.target.value)}
              className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
            >
              <option value="">Niemandem zugewiesen</option>
              {mitarbeiterNamen.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>

            {p.status === 'erledigt' && (
              <a
                href={`/dashboard/lager/export?pruefungId=${p.id}`}
                className="flex items-center gap-1.5 rounded-lg bg-background px-2 py-1 text-xs font-medium text-muted"
              >
                <Download className="h-3 w-3" /> Bestellliste
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
