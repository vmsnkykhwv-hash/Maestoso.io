'use client'

import { useEffect, useState, useTransition } from 'react'
import { googleTrendLadenAktion, googleSnapshotSpeichernAktion } from './actions'
import type { GoogleTrendAuswertung } from '@/lib/bewertung/auswertung'

function heute(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatDatum(datum: string): string {
  const [jahr, monat, tag] = datum.split('-')
  return `${tag}.${monat}.${jahr}`
}

function Kpi({ label, wert }: { label: string; wert: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="font-display text-lg font-semibold text-foreground">{wert}</p>
    </div>
  )
}

function ErfassenFormular({ onGespeichert }: { onGespeichert: () => void }) {
  const [anzahl, setAnzahl] = useState('')
  const [durchschnitt, setDurchschnitt] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function speichern() {
    const anzahlZahl = Number(anzahl)
    const durchschnittZahl = Number(durchschnitt.replace(',', '.'))
    if (!Number.isFinite(anzahlZahl) || anzahlZahl < 0) {
      setFehler('Bitte eine gültige Anzahl angeben.')
      return
    }
    if (!Number.isFinite(durchschnittZahl) || durchschnittZahl < 1 || durchschnittZahl > 5) {
      setFehler('Durchschnitt muss zwischen 1,0 und 5,0 liegen.')
      return
    }
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await googleSnapshotSpeichernAktion({
        datum: heute(),
        anzahlBewertungen: anzahlZahl,
        durchschnitt: durchschnittZahl,
      })
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler)
        return
      }
      setAnzahl('')
      setDurchschnitt('')
      onGespeichert()
    })
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">Heutigen Stand eintragen ({formatDatum(heute())})</h3>
      <p className="text-xs text-muted">
        Werte von der eigenen Google-Unternehmensseite ablesen (Anzahl Rezensionen gesamt + angezeigte Durchschnittsnote) und
        hier eintragen – ein Eintrag pro Tag, ein neuer Eintrag am selben Tag ersetzt den alten.
      </p>
      <div className="flex gap-2">
        <label className="flex-1 text-xs text-muted">
          Bewertungen gesamt
          <input
            type="number"
            min={0}
            value={anzahl}
            onChange={(e) => setAnzahl(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex-1 text-xs text-muted">
          Durchschnitt (1,0–5,0)
          <input
            value={durchschnitt}
            onChange={(e) => setDurchschnitt(e.target.value)}
            placeholder="4,6"
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      {fehler && <p className="text-sm text-danger">{fehler}</p>}
      <button
        type="button"
        onClick={speichern}
        disabled={pending}
        className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-40"
      >
        {pending ? 'Speichert…' : 'Eintragen'}
      </button>
    </div>
  )
}

export default function GoogleTrend() {
  const [daten, setDaten] = useState<GoogleTrendAuswertung | null>(null)

  function neuLaden() {
    googleTrendLadenAktion().then(setDaten)
  }

  useEffect(() => {
    neuLaden()
  }, [])

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-card-dim p-3 text-xs text-muted">
        Manuell erfasst: Ein automatischer Abruf über die Google Business Profile API würde eine eigene
        Google-Cloud-Projekteinrichtung samt Freigabe durch Google voraussetzen. Bis die steht, hier kurz eintragen – dauert
        unter einer Minute.
      </p>

      <ErfassenFormular onGespeichert={neuLaden} />

      {!daten && <p className="text-sm text-muted">Lädt…</p>}

      {daten && !daten.aktuell && (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">
          Noch kein Stand erfasst.
        </p>
      )}

      {daten?.aktuell && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Kpi label="Bewertungen gesamt" wert={String(daten.aktuell.anzahlBewertungen)} />
            <Kpi label="Durchschnitt" wert={daten.aktuell.durchschnitt.toFixed(1)} />
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Verlauf</h3>
            <div className="space-y-2">
              {[...daten.verlauf].reverse().map((eintrag) => (
                <div key={eintrag.datum} className="flex items-center justify-between rounded-xl bg-card-dim p-3">
                  <div>
                    <p className="text-sm font-medium">{formatDatum(eintrag.datum)}</p>
                    <p className="text-xs text-muted">
                      {eintrag.anzahlBewertungen} Bewertungen · Ø {eintrag.durchschnitt.toFixed(1)}
                    </p>
                  </div>
                  {eintrag.neueBewertungen !== null && (
                    <div className="text-right text-xs">
                      <p className={eintrag.neueBewertungen > 0 ? 'font-semibold text-success' : 'text-muted'}>
                        {eintrag.neueBewertungen > 0 ? '+' : ''}
                        {eintrag.neueBewertungen} neu
                      </p>
                      {eintrag.notenDelta !== null && eintrag.notenDelta !== 0 && (
                        <p className={eintrag.notenDelta > 0 ? 'text-success' : 'text-danger'}>
                          {eintrag.notenDelta > 0 ? '+' : ''}
                          {eintrag.notenDelta.toFixed(1)} Note
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
