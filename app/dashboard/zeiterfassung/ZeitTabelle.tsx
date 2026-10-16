'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Check } from 'lucide-react'
import { zeiteintragSpeichern, zeiteintragVerlaufLaden } from './actions'
import { arbeitsminuten, formatDatumKurz, wochentagKurz } from '@/lib/zeiterfassung/zeit'
import { EINTRAG_ART_LABEL, type EintragArt, type ZeitHistorie, type ZeitStand, type Zeiteintrag } from '@/lib/zeiterfassung/types'

function standText(z: ZeitStand | null): string {
  if (!z) return '–'
  if (z.art !== 'arbeit') return EINTRAG_ART_LABEL[z.art]
  const zeit = (t: string | null) => (t ? t.slice(0, 5) : '?')
  return `${zeit(z.beginn)}–${zeit(z.ende)}${z.pause_minuten ? `, ${z.pause_minuten} Min. Pause` : ''}`
}

// Zeigt, wer was wann geändert hat – Grundlage dafür ist die Historie in der
// Datenbank (Migration 0031), die auch der Betrieb selbst nicht löschen kann.
function Verlauf({ id, mitarbeiterId }: { id: string; mitarbeiterId: string }) {
  const [eintraege, setEintraege] = useState<ZeitHistorie[] | null>(null)
  const [offen, setOffen] = useState(false)
  const [laedt, startLaden] = useTransition()

  function umschalten() {
    setOffen((o) => !o)
    if (!eintraege) startLaden(async () => setEintraege(await zeiteintragVerlaufLaden(id, mitarbeiterId)))
  }

  return (
    <div className="mt-2 text-xs">
      <button type="button" onClick={umschalten} className="font-medium text-muted underline">
        Nachträglich geändert · Verlauf {offen ? 'ausblenden' : 'anzeigen'}
      </button>
      {offen && (
        <ul className="mt-1.5 space-y-1 text-muted">
          {laedt && <li>Lade…</li>}
          {eintraege?.map((h, i) => (
            <li key={i}>
              {new Date(h.zeitpunkt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' })} ·{' '}
              {h.geaendertVon ?? 'unbekannt'}:{' '}
              {h.aktion === 'angelegt' ? `angelegt mit ${standText(h.neu)}` : h.aktion === 'geloescht' ? `gelöscht (war ${standText(h.alt)})` : `${standText(h.alt)} → ${standText(h.neu)}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

type Zeile = {
  id?: string
  geaendert?: boolean
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
    geaendert: e.geaendert,
    arbeitstag: e.arbeitstag,
    art: e.art,
    // Postgres liefert "HH:MM:SS" – das Zeitfeld zeigte dann Sekunden an und
    // ließ sich nach dem Speichern nicht mehr sauber auf HH:MM ändern.
    beginn: e.beginn?.slice(0, 5) ?? '',
    ende: e.ende?.slice(0, 5) ?? '',
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
  selbstAb,
}: {
  // Mitarbeitende am Tresen: Tage vor diesem Datum korrigiert nur die
  // Leitung (der Server lehnt es ohnehin ab).
  selbstAb?: string
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
      {selbstAb && !nurLesen && tage.some((t) => t < selbstAb) && (
        <p className="text-xs text-muted">Heute und gestern trägst du selbst ein. Ältere Tage korrigiert die Leitung.</p>
      )}
      {tage.map((tag) => {
        const zeile = zeilen[tag]
        if (!zeile) return null
        const dirty = istDirty(tag)
        const tagFehler = fehler[tag]
        const gesperrt = !!selbstAb && tag < selbstAb

        return (
          <fieldset key={tag} disabled={gesperrt} className={`rounded-2xl border border-border bg-card p-3 ${gesperrt ? 'opacity-70' : ''}`}>
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

            {zeile.id && zeile.geaendert && <Verlauf id={zeile.id} mitarbeiterId={mitarbeiterId} />}
          </fieldset>
        )
      })}
    </fieldset>
  )
}
