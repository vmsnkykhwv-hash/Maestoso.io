'use client'

import { useState, useTransition } from 'react'
import { einstellungenSpeichernAktion } from './actions'
import type { Einstellungen as EinstellungenTyp } from '@/lib/tischplan/types'

export default function Einstellungen({
  einstellungen,
  onGespeichert,
}: {
  einstellungen: EinstellungenTyp
  onGespeichert: (einstellungen: EinstellungenTyp) => void
}) {
  const [werte, setWerte] = useState(einstellungen)
  const [gespeichert, setGespeichert] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function feld<K extends keyof EinstellungenTyp>(key: K, wert: EinstellungenTyp[K]) {
    setWerte((prev) => ({ ...prev, [key]: wert }))
    setGespeichert(false)
  }

  function speichern() {
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await einstellungenSpeichernAktion(werte)
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler)
        return
      }
      setGespeichert(true)
      onGespeichert(werte)
    })
  }

  return (
    <div className="space-y-4">
      {fehler && <p className="text-sm text-danger">{fehler}</p>}

      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Öffnungszeiten (Reservierungsfenster)</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-muted">
            Mo–Sa von
            <input
              type="time"
              value={werte.wocheStart}
              onChange={(e) => feld('wocheStart', e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-muted">
            Mo–Sa bis
            <input
              type="time"
              value={werte.wocheEnde}
              onChange={(e) => feld('wocheEnde', e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-muted">
            So/Feiertag von
            <input
              type="time"
              value={werte.sonntagStart}
              onChange={(e) => feld('sonntagStart', e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-muted">
            So/Feiertag bis
            <input
              type="time"
              value={werte.sonntagEnde}
              onChange={(e) => feld('sonntagEnde', e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-muted">Feiertage: gesetzliche Feiertage in Hessen, automatisch berechnet.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Buchungsregeln</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-muted">
            Slot-Raster (Min.)
            <input
              type="number"
              min={5}
              value={werte.slotMinuten}
              onChange={(e) => feld('slotMinuten', Number(e.target.value) || 15)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-muted">
            Tischdauer (Min.)
            <input
              type="number"
              min={15}
              value={werte.dauerMinuten}
              onChange={(e) => feld('dauerMinuten', Number(e.target.value) || 180)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-muted">
            Vorlauf (Min.)
            <input
              type="number"
              min={0}
              value={werte.vorlaufMinuten}
              onChange={(e) => feld('vorlaufMinuten', Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-muted">
            Min. Personen online
            <input
              type="number"
              min={1}
              value={werte.minPersonen}
              onChange={(e) => feld('minPersonen', Number(e.target.value) || 1)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-muted">
            Max. Personen online
            <input
              type="number"
              min={1}
              value={werte.maxPersonenOnline}
              onChange={(e) => feld('maxPersonenOnline', Number(e.target.value) || 1)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-muted">
            Max. Gäste gleichzeitig
            <input
              type="number"
              min={1}
              value={werte.maxPersonenGleichzeitig}
              onChange={(e) => feld('maxPersonenGleichzeitig', Number(e.target.value) || 1)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
        </div>
      </div>

      <button
        type="button"
        onClick={speichern}
        disabled={pending || gespeichert}
        className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground disabled:opacity-40"
      >
        {pending ? 'Speichert…' : gespeichert ? 'Gespeichert' : 'Speichern'}
      </button>
    </div>
  )
}
