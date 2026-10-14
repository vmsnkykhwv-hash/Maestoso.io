'use client'

import { useMemo } from 'react'
import { berechneVerbindlichkeiten } from '@/lib/gutschein/auswertung'
import type { Gutschein } from '@/lib/gutschein/types'

function formatPreis(betrag: number): string {
  return betrag.toFixed(2).replace('.', ',') + ' €'
}

function formatDatum(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
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

export default function Verbindlichkeiten({ gutscheine }: { gutscheine: Gutschein[] }) {
  const auswertung = useMemo(() => berechneVerbindlichkeiten(gutscheine), [gutscheine])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Kpi
          label="Offene Verbindlichkeiten"
          wert={formatPreis(auswertung.offenerBetrag)}
          hinweis={`${auswertung.anzahlOffen} bezahlt, noch nicht eingelöst`}
        />
        <Kpi label="Bereits eingelöst" wert={formatPreis(auswertung.eingeloestBetrag)} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-semibold">Verkauft insgesamt</p>
        <p className="font-display text-xl font-semibold text-foreground">{formatPreis(auswertung.verkauftGesamt)}</p>
        <p className="mt-1 text-xs text-muted">Bezahlte Gutscheine (offen + eingelöst), ohne unbezahlte oder stornierte.</p>
        {auswertung.aeltesteOffenSeit && (
          <p className="mt-2 text-xs text-muted">Ältester offener Gutschein bezahlt am {formatDatum(auswertung.aeltesteOffenSeit)}.</p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-1 text-sm font-semibold">Verjährung im Blick behalten</h3>
        <p className="mb-3 text-xs text-muted">
          Gutschein-Ansprüche verjähren regelmäßig drei Jahre nach dem Kaufjahr (§195 BGB). Diese hier sind seit mindestens
          2,5 Jahren bezahlt und noch nicht eingelöst.
        </p>
        {auswertung.baldVerfallend.length === 0 ? (
          <p className="text-sm text-muted">Keine Gutscheine in diesem Zeitfenster.</p>
        ) : (
          <div className="space-y-2">
            {auswertung.baldVerfallend.map((g) => (
              <div key={g.id} className="flex items-center justify-between rounded-xl bg-card-dim p-3">
                <div>
                  <p className="font-mono text-sm font-bold tracking-widest">{g.code}</p>
                  <p className="text-xs text-muted">
                    {g.kaeuferName} · bezahlt am {g.bezahltAm ? formatDatum(g.bezahltAm) : '–'}
                  </p>
                </div>
                <span className="text-sm font-semibold text-locked">{formatPreis(g.betrag)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
