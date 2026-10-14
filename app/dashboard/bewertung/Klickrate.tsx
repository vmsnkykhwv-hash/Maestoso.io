'use client'

import { useEffect, useState, useTransition } from 'react'
import { klickrateLadenAktion } from './actions'
import type { KlickrateAuswertung } from '@/lib/bewertung/auswertung'
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

function Kpi({ label, wert, hinweis }: { label: string; wert: string; hinweis?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="font-display text-lg font-semibold text-foreground">{wert}</p>
      {hinweis && <p className="mt-0.5 text-[11px] text-muted">{hinweis}</p>}
    </div>
  )
}

export default function Klickrate() {
  const [zeitraum, setZeitraum] = useState<Zeitraum>(30)
  const [daten, setDaten] = useState<KlickrateAuswertung | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      const ergebnis = await klickrateLadenAktion(datumVorXTagen(zeitraum), heute())
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

      {daten && daten.verschickt === 0 && (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">
          Keine Bewertungsanfragen in diesem Zeitraum.
        </p>
      )}

      {daten && daten.verschickt > 0 && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Kpi label="Verschickt" wert={String(daten.verschickt)} />
            <Kpi label="Geöffnet" wert={prozent(daten.oeffnungsRate)} hinweis={`${daten.geoeffnet} Mails`} />
            <Kpi label="Geklickt" wert={prozent(daten.klickRate)} hinweis={`${daten.geklickt} Mails`} />
          </div>
          {daten.geoeffnet > 0 && (
            <p className="text-xs text-muted">
              Von den geöffneten Mails hat {prozent(daten.klickRateVonGeoeffnet)} auch wirklich den Bewertungslink angeklickt.
            </p>
          )}
        </>
      )}

      <p className="rounded-xl bg-card-dim p-3 text-xs text-muted">
        Zählt nur Mails, zu denen Resend ein Öffnen-/Klick-Event zugestellt hat (Open-/Click-Tracking muss bei Resend für die
        Absenderdomain aktiv sein, und manche Mailprogramme blockieren Trackingpixel grundsätzlich) – die echte Quote liegt
        damit eher etwas höher als hier angezeigt.
      </p>

      {pending && <p className="text-xs text-muted">Aktualisiert…</p>}
    </div>
  )
}
