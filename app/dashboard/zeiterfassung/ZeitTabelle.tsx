'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Check } from 'lucide-react'
import { zeiteintragSpeichern } from './actions'
import { arbeitsminuten, formatDatumKurz, wochentagKurz } from '@/lib/zeiterfassung/zeit'
import { EINTRAG_ART_LABEL, type EintragArt, type Zeiteintrag } from '@/lib/zeiterfassung/types'

type Zeile = {
  id?: string
  arbeitstag: string
  art: EintragArt
  beginn: string
  ende: string
  pause: string
  notiz: string
}

function leereZeile(arbeitstag: string): Zeile {
  return { arbeitstag, art: 'arbeit', beginn: '', ende: '', pause: '0', notiz: '' }
}

function zeileAusEintrag(e: Zeiteintrag): Zeile {
  return {
    id: e.id,
    arbeitstag: e.arbeitstag,
    art: e.art,
    beginn: e.beginn ?? '',
    ende: e.ende ?? '',
    pause: String(e.pauseMinuten ?? 0),
    notiz: e.notiz ?? '',
  }
}

function zeilenKarteAufbauen(tage: string[], eintraege: Zeiteintrag[]): Record<string, Zeile> {
  const karte: Record<string, Zeile> = {}
  for (const tag of tage) karte[tag] = leereZeile(tag)
  for (const e of eintraege) karte[e.arbeitstag] = zeileAusEintrag(e)
  return karte
}

export default function ZeitTabelle({
  mitarbeiterId,
  tage,
  anfangsEintraege,
  onMinutenGeaendert,
  nurLesen = false,
}: {
  // Auf dem gekoppelten Handy: eigene Zeiten nur ansehen, erfasst wird am
  // Tresen (die Server Actions lehnen Schreiben vom Handy ohnehin ab).
  nurLesen?: boolean
  mitarbeiterId: string
  tage: string[]
  anfangsEintraege: Zeiteintrag[]
  onMinutenGeaendert?: (minutenGesamt: number) => void
}) {
  // Kein Resync-Effect nötig: der Aufrufer gibt dieser Komponente bei
  // Periodenwechsel einen neuen `key` (siehe ZeiterfassungApp.tsx), React
  // erzeugt dadurch eine frische Instanz mit frischem State statt dass wir
  // hier manuell zurücksetzen müssten.
  const [zeilen, setZeilen] = useState<Record<string, Zeile>>(() => zeilenKarteAufbauen(tage, anfangsEintraege))
  const [gespeichert, setGespeichert] = useState<Record<string, Zeile>>(() => zeilenKarteAufbauen(tage, anfangsEintraege))
  const [fehler, setFehler] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()
  const [speicherndTag, setSpeicherndTag] = useState<string | null>(null)

  const gesamtMinuten = useMemo(() => {
    let summe = 0
    for (const tag of tage) {
      const z = gespeichert[tag]
      if (z?.art === 'arbeit' && z.beginn && z.ende) {
        summe += arbeitsminuten(z.beginn, z.ende, Number(z.pause) || 0)
      }
    }
    return summe
  }, [tage, gespeichert])

  useEffect(() => {
    onMinutenGeaendert?.(gesamtMinuten)
  }, [gesamtMinuten, onMinutenGeaendert])

  function istDirty(tag: string): boolean {
    const a = zeilen[tag]
    const b = gespeichert[tag]
    if (!a || !b) return false
    return a.art !== b.art || a.beginn !== b.beginn || a.ende !== b.ende || a.pause !== b.pause || a.notiz !== b.notiz
  }

  function feldAendern(tag: string, patch: Partial<Zeile>) {
    setZeilen((prev) => ({ ...prev, [tag]: { ...prev[tag], ...patch } }))
  }

  function speichern(tag: string) {
    const zeile = zeilen[tag]
    setFehler((prev) => ({ ...prev, [tag]: '' }))
    setSpeicherndTag(tag)
    startTransition(async () => {
      const ergebnis = await zeiteintragSpeichern({
        id: zeile.id,
        mitarbeiterId,
        arbeitstag: tag,
        art: zeile.art,
        beginn: zeile.art === 'arbeit' && zeile.beginn ? zeile.beginn : null,
        ende: zeile.art === 'arbeit' && zeile.ende ? zeile.ende : null,
        pauseMinuten: Number(zeile.pause) || 0,
        notiz: zeile.notiz.trim() || null,
      })
      setSpeicherndTag(null)

      if (ergebnis.fehler) {
        setFehler((prev) => ({ ...prev, [tag]: ergebnis.fehler! }))
        return
      }

      if (ergebnis.eintrag) {
        const neueZeile = zeileAusEintrag(ergebnis.eintrag)
        setZeilen((prev) => ({ ...prev, [tag]: neueZeile }))
        setGespeichert((prev) => ({ ...prev, [tag]: neueZeile }))
      }
    })
  }

  return (
    <fieldset disabled={nurLesen} className="space-y-2">
      {tage.map((tag) => {
        const zeile = zeilen[tag]
        if (!zeile) return null
        const dirty = istDirty(tag)
        const tagFehler = fehler[tag]

        return (
          <div key={tag} className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">
                {wochentagKurz(tag)} {formatDatumKurz(tag)}
              </span>
              <select
                value={zeile.art}
                onChange={(e) => feldAendern(tag, { art: e.target.value as EintragArt })}
                className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
              >
                {(Object.keys(EINTRAG_ART_LABEL) as EintragArt[]).map((art) => (
                  <option key={art} value={art}>
                    {EINTRAG_ART_LABEL[art]}
                  </option>
                ))}
              </select>
            </div>

            {zeile.art === 'arbeit' && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                <input
                  type="time"
                  value={zeile.beginn}
                  onChange={(e) => feldAendern(tag, { beginn: e.target.value })}
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                />
                <input
                  type="time"
                  value={zeile.ende}
                  onChange={(e) => feldAendern(tag, { ende: e.target.value })}
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  value={zeile.pause}
                  onChange={(e) => feldAendern(tag, { pause: e.target.value })}
                  placeholder="Pause"
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

            {tagFehler && <p className="mt-2 text-xs font-medium text-danger">{tagFehler}</p>}

            {dirty && !nurLesen && (
              <button
                type="button"
                disabled={pending && speicherndTag === tag}
                onClick={() => speichern(tag)}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent py-2 text-xs font-semibold text-accent-foreground disabled:opacity-40"
              >
                <Check className="h-3.5 w-3.5" />
                {pending && speicherndTag === tag ? 'Speichert…' : 'Speichern'}
              </button>
            )}
          </div>
        )
      })}
    </fieldset>
  )
}
