'use client'

import { useEffect, useState, useTransition } from 'react'
import { auslastungLadenAktion } from './actions'
import type { TischplanAuswertung } from '@/lib/tischplan/auswertung'
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

function Balken({ label, anzahl, max }: { label: string; anzahl: number; max: number }) {
  const hoeheProzent = max > 0 ? Math.max((anzahl / max) * 100, anzahl > 0 ? 6 : 0) : 0
  return (
    <div className="flex flex-1 flex-col items-center gap-1" title={`${label}: ${anzahl} Reservierungen`}>
      <span className="text-[11px] font-semibold text-foreground">{anzahl || ''}</span>
      <div className="flex h-24 w-full items-end rounded-md bg-card-dim">
        <div className="w-full rounded-md bg-accent transition-all" style={{ height: `${hoeheProzent}%` }} />
      </div>
      <span className="text-[11px] text-muted">{label}</span>
    </div>
  )
}

function Kpi({ label, wert }: { label: string; wert: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="font-display text-lg font-semibold text-foreground">{wert}</p>
    </div>
  )
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

  const maxWochentag = daten ? Math.max(...daten.proWochentag.map((w) => w.anzahl), 1) : 1
  const maxStunde = daten ? Math.max(...daten.proStunde.map((s) => s.anzahl), 1) : 1

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
                <div className="flex gap-1.5">
                  {daten.proWochentag.map((w) => (
                    <Balken key={w.wochentag} label={w.wochentag} anzahl={w.anzahl} max={maxWochentag} />
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Nach Uhrzeit</h3>
                  {daten.meistgefragteStunde && <span className="text-xs text-muted">Am meisten los: {daten.meistgefragteStunde}</span>}
                </div>
                {daten.proStunde.length === 0 ? (
                  <p className="text-sm text-muted">Keine Daten.</p>
                ) : (
                  <div className="flex gap-1.5 overflow-x-auto">
                    {daten.proStunde.map((s) => (
                      <Balken key={s.stunde} label={s.stunde.replace(' Uhr', '')} anzahl={s.anzahl} max={maxStunde} />
                    ))}
                  </div>
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
