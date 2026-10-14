'use client'

import { useEffect, useState, useTransition } from 'react'
import { auslastungLadenAktion } from './actions'
import type { TischplanAuswertung } from '@/lib/tischplan/auswertung'
import { BalkenReihe, Kpi, StundenHeatmap } from '@/components/Auswertung'
import { cn } from '@/lib/utils'

type Zeitraum = 7 | 30 | 90

function datumVorXTagen(tage: number): string {
  const d = new Date()
  d.setDate(d.getDate() - tage)
  return d.toISOString().slice(0, 10)
}

function heute(): string {
  return new Date().toISOString().slice(0, 10)
}

function prozent(anteil: number): string {
  return `${Math.round(anteil * 100)} %`
}

export default function Auswertung() {
  const [zeitraum, setZeitraum] = useState<Zeitraum>(30)
  const [daten, setDaten] = useState<TischplanAuswertung | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      const ergebnis = await auslastungLadenAktion(datumVorXTagen(zeitraum), heute())
      setDaten(ergebnis)
    })
  }, [zeitraum])

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {([7, 30, 90] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setZeitraum(option)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium',
              zeitraum === option ? 'bg-accent text-accent-foreground' : 'bg-card text-muted'
            )}
          >
            Letzte {option} Tage
          </button>
        ))}
      </div>

      {!daten && <p className="text-sm text-muted">Lädt…</p>}

      {daten && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Reservierungen" wert={String(daten.gesamtReservierungen)} />
            <Kpi label="Gäste" wert={String(daten.gesamtGaeste)} />
            <Kpi label="Ø Personen" wert={daten.durchschnittPersonen.toFixed(1)} />
            <Kpi label="No-Show-Quote" wert={prozent(daten.noShowQuote)} />
          </div>

          {daten.gesamtReservierungen === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">
              Keine Reservierungen in diesem Zeitraum.
            </p>
          ) : (
            <>
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Nach Wochentag</h3>
                  {daten.meistgefragterWochentag && (
                    <span className="text-xs text-muted">Am meisten los: {daten.meistgefragterWochentag}</span>
                  )}
                </div>
                <BalkenReihe eintraege={daten.proWochentag.map((w) => ({ label: w.wochentag, anzahl: w.anzahl }))} einheit="Reservierungen" />
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Nach Uhrzeit</h3>
                  {daten.meistgefragteStunde && <span className="text-xs text-muted">Am meisten los: {daten.meistgefragteStunde}</span>}
                </div>
                {daten.proStunde.length === 0 ? (
                  <p className="text-sm text-muted">Keine Daten.</p>
                ) : (
                  <StundenHeatmap
                    eintraege={daten.proStunde.map((s) => ({ label: s.stunde.replace(' Uhr', 'h'), anzahl: s.anzahl }))}
                    einheit="Reservierungen"
                  />
                )}
              </div>

              <p className="text-xs text-muted">Stornoquote in diesem Zeitraum: {prozent(daten.stornoQuote)}</p>
            </>
          )}
        </>
      )}
      {pending && <p className="text-xs text-muted">Aktualisiert…</p>}
    </div>
  )
}
