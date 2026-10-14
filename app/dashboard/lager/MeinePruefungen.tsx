'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { formatDatumKurz } from '@/lib/datum'
import {
  eintragSetzenAktion,
  lieferantenNamenLadenAktion,
  meinePruefungenLadenAktion,
  pruefungAbschliessenAktion,
  pruefungDetailsLadenAktion,
} from './actions'
import type { Artikel, Bestandspruefung, BestandspruefungEintrag } from '@/lib/lager/types'

type Zeile = { nachbestellen: boolean; aktuellerBestand: string }

function PruefungsCheckliste({ pruefungId, onFertig }: { pruefungId: string; onFertig: () => void }) {
  const [artikel, setArtikel] = useState<Artikel[]>([])
  const [zeilen, setZeilen] = useState<Record<string, Zeile>>({})
  const [laden, startLaden] = useTransition()
  const [abschliessenPending, startAbschliessen] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)

  useEffect(() => {
    startLaden(async () => {
      const ergebnis = await pruefungDetailsLadenAktion(pruefungId)
      if (ergebnis.fehler || !ergebnis.artikel) {
        setFehler(ergebnis.fehler ?? 'Konnte nicht geladen werden')
        return
      }
      setArtikel(ergebnis.artikel)
      const karte: Record<string, Zeile> = {}
      for (const a of ergebnis.artikel) {
        const bestehend = ergebnis.eintraege?.find((e: BestandspruefungEintrag) => e.artikelId === a.id)
        karte[a.id] = { nachbestellen: bestehend?.nachbestellen ?? false, aktuellerBestand: bestehend?.aktuellerBestand ?? '' }
      }
      setZeilen(karte)
    })
  }, [pruefungId])

  function feldAendern(artikelId: string, patch: Partial<Zeile>) {
    const neu = { ...zeilen[artikelId], ...patch }
    setZeilen((prev) => ({ ...prev, [artikelId]: neu }))
    void eintragSetzenAktion(pruefungId, artikelId, neu.nachbestellen, neu.aktuellerBestand)
  }

  function abschliessen() {
    startAbschliessen(async () => {
      const ergebnis = await pruefungAbschliessenAktion(pruefungId)
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler)
        return
      }
      onFertig()
    })
  }

  if (laden) return <p className="text-sm text-muted">Lade…</p>
  if (fehler) return <p className="text-sm text-danger">{fehler}</p>

  return (
    <div className="space-y-3">
      <button type="button" onClick={onFertig} className="text-xs text-muted">
        ← Zurück zur Übersicht
      </button>

      {artikel.length === 0 && <p className="text-sm text-muted">Dieser Lieferant hat noch keine Artikel hinterlegt.</p>}

      {artikel.map((a) => {
        const zeile = zeilen[a.id] ?? { nachbestellen: false, aktuellerBestand: '' }
        return (
          <div key={a.id} className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{a.name}</p>
                <p className="text-xs text-muted">
                  Einheit: {a.einheit} · Mindestbestand: {a.mindestbestand}
                </p>
              </div>
              <label className="flex flex-none items-center gap-1.5 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={zeile.nachbestellen}
                  onChange={(e) => feldAendern(a.id, { nachbestellen: e.target.checked })}
                />
                Nachbestellen
              </label>
            </div>
            <input
              value={zeile.aktuellerBestand}
              onChange={(e) => feldAendern(a.id, { aktuellerBestand: e.target.value })}
              placeholder={`Aktueller Bestand, z. B. 2 ${a.einheit}`}
              className="mt-2 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
        )
      })}

      <button
        type="button"
        onClick={abschliessen}
        disabled={abschliessenPending}
        className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground disabled:opacity-40"
      >
        {abschliessenPending ? 'Speichert…' : 'Prüfung abschließen'}
      </button>
    </div>
  )
}

export default function MeinePruefungen({ mitarbeiterId }: { mitarbeiterId: string }) {
  const [pruefungen, setPruefungen] = useState<Bestandspruefung[]>([])
  const [lieferantenNamen, setLieferantenNamen] = useState<{ id: string; name: string }[]>([])
  const [laden, startLaden] = useTransition()
  const [offenerPruefungId, setOffenerPruefungId] = useState<string | null>(null)

  const neuLaden = useCallback(() => {
    startLaden(async () => {
      const [p, l] = await Promise.all([meinePruefungenLadenAktion(), lieferantenNamenLadenAktion()])
      setPruefungen(p)
      setLieferantenNamen(l)
    })
  }, [])

  useEffect(() => {
    neuLaden()
  }, [mitarbeiterId, neuLaden])

  if (offenerPruefungId) {
    return (
      <PruefungsCheckliste
        pruefungId={offenerPruefungId}
        onFertig={() => {
          setOffenerPruefungId(null)
          neuLaden()
        }}
      />
    )
  }

  function lieferantName(id: string): string {
    return lieferantenNamen.find((l) => l.id === id)?.name ?? 'Unbekannt'
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Hier erscheinen Bestandsprüfungen, sobald ein Lieferant in Kürze beliefert und dir laut Dienstplan an dem Tag
        zugewiesen ist.
      </p>

      {laden ? (
        <p className="text-sm text-muted">Lade…</p>
      ) : pruefungen.length === 0 ? (
        <p className="text-sm text-muted">Aktuell keine offenen Prüfungen für dich.</p>
      ) : (
        pruefungen.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOffenerPruefungId(p.id)}
            className="block w-full rounded-2xl border border-border bg-card p-4 text-left"
          >
            <p className="text-sm font-semibold">{lieferantName(p.lieferantId)}</p>
            <p className="text-xs text-muted">Bestelltermin: {formatDatumKurz(p.bestelldatum)}</p>
          </button>
        ))
      )}
    </div>
  )
}
