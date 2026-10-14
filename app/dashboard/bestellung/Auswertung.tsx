'use client'

import { useEffect, useState, useTransition } from 'react'
import { bestellAnalyseLadenAktion } from './actions'
import type { BestellungAuswertung } from '@/lib/bestellung/auswertung'
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

function formatPreis(betrag: number): string {
  return betrag.toFixed(2).replace('.', ',') + ' €'
}

function prozent(anteil: number): string {
  return `${Math.round(anteil * 100)} %`
}

function Balken({ label, anzahl, max }: { label: string; anzahl: number; max: number }) {
  const hoeheProzent = max > 0 ? Math.max((anzahl / max) * 100, anzahl > 0 ? 6 : 0) : 0
  return (
    <div className="flex flex-1 flex-col items-center gap-1" title={`${label}: ${anzahl} Bestellungen`}>
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
  const [daten, setDaten] = useState<BestellungAuswertung | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      const ergebnis = await bestellAnalyseLadenAktion(datumVorXTagen(zeitraum), heute())
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
            <Kpi label="Bestellungen" wert={String(daten.gesamtBestellungen)} />
            <Kpi label="Umsatz" wert={formatPreis(daten.gesamtUmsatz)} />
            <Kpi label="Ø Bestellwert" wert={formatPreis(daten.durchschnittBestellwert)} />
            <Kpi label="Stornoquote" wert={prozent(daten.stornoQuote)} />
          </div>

          {daten.gesamtBestellungen === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">
              Keine Bestellungen in diesem Zeitraum.
            </p>
          ) : (
            <>
              <div className="rounded-2xl border border-border bg-card p-4">
                <h3 className="mb-3 text-sm font-semibold">Nach Kanal</h3>
                <div className="grid grid-cols-2 gap-3">
                  {daten.proKanal.map((k) => (
                    <div key={k.kanal} className="rounded-xl bg-card-dim p-3">
                      <p className="text-xs text-muted">{k.kanal === 'abholung' ? 'Abholung' : 'Lieferung'}</p>
                      <p className="font-display text-base font-semibold text-foreground">{k.anzahl}</p>
                      <p className="text-xs text-muted">{formatPreis(k.umsatz)}</p>
                    </div>
                  ))}
                </div>
              </div>

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
            </>
          )}
        </>
      )}
      {pending && <p className="text-xs text-muted">Aktualisiert…</p>}
    </div>
  )
}
