'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, Calendar } from 'lucide-react'
import DemoBanner from '@/app/dashboard/DemoBanner'
import {
  mitarbeiterAktualisieren,
  mitarbeiterAnlegen,
  mitarbeiterListeLadenAktion,
  mitarbeiterPinZuruecksetzen,
  zeiteintraegeLadenAktion,
} from './actions'
import ZeitTabelle from './ZeitTabelle'
import LimitCard from './LimitCard'
import MitarbeiterDokumente from './MitarbeiterDokumente'
import {
  alleTageZwischen,
  datumPlusTage,
  formatMonatLabel,
  formatDatumKurz,
  heuteBerlin,
  monatsEnde,
  monatsStart,
  naechsterMonat,
  wochenStart,
} from '@/lib/zeiterfassung/zeit'
import {
  MITARBEITER_TYP_LABEL,
  type Mitarbeiter,
  type MitarbeiterTyp,
} from '@/lib/mitarbeiter/types'
import type { Zeiteintrag } from '@/lib/zeiterfassung/types'
import { cn } from '@/lib/utils'

type Ansicht = 'meine-zeiten' | 'alle-zeiten' | 'mitarbeiter' | 'export'

function periodeFuer(typ: MitarbeiterTyp, anker: string): { von: string; bis: string; label: string } {
  if (typ === 'minijob') {
    return { von: monatsStart(anker), bis: monatsEnde(anker), label: formatMonatLabel(anker) }
  }
  const von = wochenStart(anker)
  const bis = datumPlusTage(von, 6)
  return { von, bis, label: `${formatDatumKurz(von)} – ${formatDatumKurz(bis)}` }
}

function ZeitenAnsicht({ ziel, nurLesen = false }: { ziel: Mitarbeiter; nurLesen?: boolean }) {
  const [anker, setAnker] = useState(heuteBerlin())
  const [eintraege, setEintraege] = useState<Zeiteintrag[]>([])
  const [minuten, setMinuten] = useState(0)
  const [laden, startLaden] = useTransition()
  const datumFeldRef = useRef<HTMLInputElement>(null)

  const periode = useMemo(() => periodeFuer(ziel.mitarbeiterTyp, anker), [ziel.mitarbeiterTyp, anker])
  const tage = useMemo(() => alleTageZwischen(periode.von, periode.bis), [periode.von, periode.bis])

  useEffect(() => {
    startLaden(async () => {
      const liste = await zeiteintraegeLadenAktion(ziel.id, periode.von, periode.bis)
      setEintraege(liste)
    })
  }, [ziel.id, periode.von, periode.bis])

  function periodeVor() {
    setAnker((a) => (ziel.mitarbeiterTyp === 'minijob' ? naechsterMonat(a, -1) : datumPlusTage(a, -7)))
  }
  function periodeWeiter() {
    setAnker((a) => (ziel.mitarbeiterTyp === 'minijob' ? naechsterMonat(a, 1) : datumPlusTage(a, 7)))
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={periodeVor} className="px-2 text-muted">
          ←
        </button>
        <span className="text-sm font-semibold">{periode.label}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => datumFeldRef.current?.showPicker?.()}
            aria-label="Zu einem Datum springen"
            className="relative text-muted"
          >
            <Calendar className="h-4 w-4" />
            <input
              ref={datumFeldRef}
              type="date"
              value={anker}
              onChange={(e) => e.target.value && setAnker(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </button>
          <button type="button" onClick={periodeWeiter} className="px-2 text-muted">
            →
          </button>
        </div>
      </div>

      <div className="mb-3">
        <LimitCard
          minutenVerwendet={minuten}
          stundenGrenze={ziel.stundenGrenze}
          periodeLabel={ziel.mitarbeiterTyp === 'minijob' ? 'Diesen Monat' : 'Diese Woche'}
        />
      </div>

      {laden ? (
        <p className="text-sm text-muted">Lade…</p>
      ) : (
        <ZeitTabelle
          key={periode.von}
          mitarbeiterId={ziel.id}
          tage={tage}
          anfangsEintraege={eintraege}
          onMinutenGeaendert={setMinuten}
          nurLesen={nurLesen}
        />
      )}
    </div>
  )
}

function MitarbeiterVerwaltung({
  liste,
  onListeAendern,
}: {
  liste: Mitarbeiter[]
  onListeAendern: (liste: Mitarbeiter[]) => void
}) {
  const [pending, startTransition] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)
  const [pinAendernId, setPinAendernId] = useState<string | null>(null)
  const [neuerPinWert, setNeuerPinWert] = useState('')
  const [dokumenteOffenId, setDokumenteOffenId] = useState<string | null>(null)

  const [neuerName, setNeuerName] = useState('')
  const [neuerPin, setNeuerPin] = useState('')
  const [neuerTyp, setNeuerTyp] = useState<MitarbeiterTyp>('vollzeit')
  const [neueGrenze, setNeueGrenze] = useState('')

  function anlegen() {
    if (!neuerName.trim() || !neuerPin.trim()) return
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await mitarbeiterAnlegen({
        name: neuerName,
        pin: neuerPin,
        // Leitungsrechte gibt es nur noch über ein Verwaltungskonto
        // ("Zugänge & Geräte"), nicht über die Mitarbeiter-Rolle.
        rolle: 'mitarbeiter',
        mitarbeiterTyp: neuerTyp,
        stundenGrenze: Number(neueGrenze.replace(',', '.')) || 0,
      })
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler)
        return
      }
      if (ergebnis.mitarbeiter) {
        onListeAendern([...liste, ergebnis.mitarbeiter])
        setNeuerName('')
        setNeuerPin('')
        setNeueGrenze('')
      }
    })
  }

  function aktualisieren(id: string, patch: Partial<Mitarbeiter>) {
    onListeAendern(liste.map((m) => (m.id === id ? { ...m, ...patch } : m)))
    startTransition(async () => {
      await mitarbeiterAktualisieren(id, patch)
    })
  }

  function pinSpeichern(id: string) {
    if (!neuerPinWert.trim()) return
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await mitarbeiterPinZuruecksetzen(id, neuerPinWert)
      if (ergebnis.fehler) setFehler(ergebnis.fehler)
      setPinAendernId(null)
      setNeuerPinWert('')
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Neuen Mitarbeiter anlegen</h3>
        {fehler && <p className="mb-2 text-sm text-danger">{fehler}</p>}
        <div className="grid grid-cols-2 gap-2">
          <input
            value={neuerName}
            onChange={(e) => setNeuerName(e.target.value)}
            placeholder="Name"
            className="col-span-2 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
          <input
            value={neuerPin}
            onChange={(e) => setNeuerPin(e.target.value)}
            placeholder="PIN"
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
          <select
            value={neuerTyp}
            onChange={(e) => setNeuerTyp(e.target.value as MitarbeiterTyp)}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          >
            {(Object.keys(MITARBEITER_TYP_LABEL) as MitarbeiterTyp[]).map((typ) => (
              <option key={typ} value={typ}>
                {MITARBEITER_TYP_LABEL[typ]}
              </option>
            ))}
          </select>
          <input
            value={neueGrenze}
            onChange={(e) => setNeueGrenze(e.target.value)}
            placeholder={neuerTyp === 'minijob' ? 'Std. / Monat (0 = keine Grenze)' : 'Std. / Woche (0 = keine Grenze)'}
            inputMode="decimal"
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={anlegen}
          disabled={pending}
          className="mt-3 w-full rounded-lg bg-accent py-2 text-sm font-semibold text-accent-foreground disabled:opacity-40"
        >
          Anlegen
        </button>
      </div>

      <ul className="divide-y divide-border rounded-2xl border border-border bg-card px-4">
        {liste.length === 0 && <li className="py-3 text-sm text-muted">Noch keine Mitarbeiter angelegt.</li>}
        {liste.map((m) => (
          <li key={m.id} className="py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{m.name}</span>
              <span className={cn('text-xs font-medium', m.aktiv ? 'text-success' : 'text-muted')}>
                {m.aktiv ? 'Aktiv' : 'Deaktiviert'}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                value={m.mitarbeiterTyp}
                onChange={(e) => aktualisieren(m.id, { mitarbeiterTyp: e.target.value as MitarbeiterTyp })}
                className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
              >
                {(Object.keys(MITARBEITER_TYP_LABEL) as MitarbeiterTyp[]).map((typ) => (
                  <option key={typ} value={typ}>
                    {MITARBEITER_TYP_LABEL[typ]}
                  </option>
                ))}
              </select>
              <input
                type="number"
                defaultValue={m.stundenGrenze}
                onBlur={(e) => aktualisieren(m.id, { stundenGrenze: Number(e.target.value) || 0 })}
                className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-xs"
              />
              <button
                type="button"
                onClick={() => aktualisieren(m.id, { aktiv: !m.aktiv })}
                className="rounded-lg bg-background px-2 py-1 text-xs font-medium text-muted"
              >
                {m.aktiv ? 'Deaktivieren' : 'Aktivieren'}
              </button>
              {pinAendernId === m.id ? (
                <span className="flex items-center gap-1">
                  <input
                    value={neuerPinWert}
                    onChange={(e) => setNeuerPinWert(e.target.value)}
                    placeholder="Neuer PIN"
                    className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => pinSpeichern(m.id)}
                    className="rounded-lg bg-accent px-2 py-1 text-xs font-medium text-accent-foreground"
                  >
                    OK
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setPinAendernId(m.id)
                    setNeuerPinWert('')
                  }}
                  className="rounded-lg bg-background px-2 py-1 text-xs font-medium text-muted"
                >
                  PIN ändern
                </button>
              )}
              <button
                type="button"
                onClick={() => setDokumenteOffenId(dokumenteOffenId === m.id ? null : m.id)}
                className="rounded-lg bg-background px-2 py-1 text-xs font-medium text-muted"
              >
                {dokumenteOffenId === m.id ? 'Dokumente ausblenden' : 'Dokumente'}
              </button>
            </div>
            {dokumenteOffenId === m.id && <MitarbeiterDokumente mitarbeiterId={m.id} />}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ExportAnsicht({
  verwaltung,
  eigeneId,
  mitarbeiterListe,
}: {
  verwaltung: boolean
  eigeneId: string | null
  mitarbeiterListe: Mitarbeiter[]
}) {
  const heute = heuteBerlin()
  const [von, setVon] = useState(monatsStart(heute))
  const [bis, setBis] = useState(heute)
  const [ausgewaehlt, setAusgewaehlt] = useState<Set<string>>(
    new Set(verwaltung || !eigeneId ? [] : [eigeneId])
  )

  const href = useMemo(() => {
    const params = new URLSearchParams({ von, bis })
    const ids = verwaltung ? Array.from(ausgewaehlt) : eigeneId ? [eigeneId] : []
    for (const id of ids) params.append('mitarbeiterId', id)
    return `/dashboard/zeiterfassung/export?${params.toString()}`
  }, [von, bis, ausgewaehlt, verwaltung, eigeneId])

  const keineAuswahl = verwaltung && ausgewaehlt.size === 0

  function setzeAktuellerMonat() {
    setVon(monatsStart(heute))
    setBis(heute)
  }
  function setzeLetzterMonat() {
    const vormonat = naechsterMonat(heute, -1)
    setVon(monatsStart(vormonat))
    setBis(monatsEnde(vormonat))
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={setzeAktuellerMonat}
          className="rounded-full bg-card px-3 py-1.5 text-xs font-medium text-muted"
        >
          Aktueller Monat
        </button>
        <button
          type="button"
          onClick={setzeLetzterMonat}
          className="rounded-full bg-card px-3 py-1.5 text-xs font-medium text-muted"
        >
          Letzter Monat
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="date"
          value={von}
          max={bis}
          onChange={(e) => setVon(e.target.value)}
          className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm"
        />
        <span className="text-xs text-muted">bis</span>
        <input
          type="date"
          value={bis}
          min={von}
          max={heute}
          onChange={(e) => setBis(e.target.value)}
          className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm"
        />
      </div>

      {verwaltung && (
        <div className="space-y-1.5 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-semibold">Mitarbeiter</span>
            <button
              type="button"
              onClick={() =>
                setAusgewaehlt(
                  ausgewaehlt.size === mitarbeiterListe.length ? new Set() : new Set(mitarbeiterListe.map((m) => m.id))
                )
              }
              className="text-xs font-medium text-accent"
            >
              {ausgewaehlt.size === mitarbeiterListe.length ? 'Alle abwählen' : 'Alle auswählen'}
            </button>
          </div>
          {mitarbeiterListe.map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ausgewaehlt.has(m.id)}
                onChange={(e) => {
                  setAusgewaehlt((prev) => {
                    const neu = new Set(prev)
                    if (e.target.checked) neu.add(m.id)
                    else neu.delete(m.id)
                    return neu
                  })
                }}
              />
              {m.name}
            </label>
          ))}
        </div>
      )}

      {keineAuswahl ? (
        <p className="text-center text-sm text-muted">Mindestens einen Mitarbeiter auswählen.</p>
      ) : (
        <a
          href={href}
          className="block w-full rounded-xl bg-accent py-3 text-center text-sm font-semibold text-accent-foreground"
        >
          Als Excel herunterladen
        </a>
      )}

      {verwaltung && <SteuerberaterExport />}
    </div>
  )
}

function SteuerberaterExport() {
  const [anker, setAnker] = useState(heuteBerlin())
  const monatVon = monatsStart(anker)
  const monatBis = monatsEnde(anker)

  const href = `/dashboard/zeiterfassung/export?von=${monatVon}&bis=${monatBis}&format=buchhaltung`

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-1 text-sm font-semibold">Steuerberater-Export</h3>
      <p className="mb-3 text-xs text-muted">Alle Mitarbeiter, ein Tabellenblatt pro Person, für den vollen Monat.</p>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => setAnker((a) => naechsterMonat(a, -1))} className="px-2 text-muted">
          ←
        </button>
        <span className="text-sm font-semibold">{formatMonatLabel(anker)}</span>
        <button type="button" onClick={() => setAnker((a) => naechsterMonat(a, 1))} className="px-2 text-muted">
          →
        </button>
      </div>
      <a href={href} className="block w-full rounded-xl bg-accent py-2.5 text-center text-sm font-semibold text-accent-foreground">
        Als Excel herunterladen
      </a>
    </div>
  )
}

// Wer was sieht, entscheidet der Server (page.tsx): das Verwaltungskonto alle
// Zeiten und das Personal, Mitarbeitende (am Tresen per PIN oder über das
// gekoppelte Handy) nur die eigenen Zeiten. Die PIN-Anmeldung am Tresen
// passiert vorher im Dashboard-Rahmen (app/dashboard/TresenAnmeldung.tsx).
export default function ZeiterfassungApp({
  freigeschaltet,
  verwaltung,
  mitarbeiter,
  nurLesen,
}: {
  freigeschaltet: boolean
  verwaltung: boolean
  mitarbeiter: Mitarbeiter | null
  nurLesen: boolean
}) {
  const [ansicht, setAnsicht] = useState<Ansicht>(verwaltung ? 'alle-zeiten' : 'meine-zeiten')
  const [mitarbeiterListe, setMitarbeiterListe] = useState<Mitarbeiter[] | null>(null)

  useEffect(() => {
    if (!verwaltung || mitarbeiterListe) return
    mitarbeiterListeLadenAktion().then(setMitarbeiterListe)
  }, [verwaltung, mitarbeiterListe])

  const tabs: { key: Ansicht; label: string }[] = verwaltung
    ? [
        { key: 'alle-zeiten', label: 'Alle Zeiten' },
        { key: 'mitarbeiter', label: 'Mitarbeiter' },
        { key: 'export', label: 'Export' },
      ]
    : [
        { key: 'meine-zeiten', label: 'Meine Zeiten' },
        { key: 'export', label: 'Export' },
      ]

  return (
    <>
      {!freigeschaltet && <DemoBanner />}

      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <Link href="/dashboard" className="mb-4 flex items-center gap-1 text-sm text-muted">
          <ArrowLeft className="h-4 w-4" /> Zurück zu den Tools
        </Link>

        <div className="mb-4 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setAnsicht(tab.key)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium',
                ansicht === tab.key ? 'bg-accent text-accent-foreground' : 'bg-card text-muted'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {mitarbeiter && !verwaltung && (
          <p className="mb-4 text-xs text-muted">
            {mitarbeiter.name}
            {nurLesen && ' · Zeiten erfasst du am Tresen-Gerät, hier kannst du sie ansehen.'}
          </p>
        )}

        {ansicht === 'meine-zeiten' && mitarbeiter && <ZeitenAnsicht ziel={mitarbeiter} nurLesen={nurLesen} />}
        {ansicht === 'alle-zeiten' && verwaltung && <AlleZeitenAnsicht mitarbeiterListe={mitarbeiterListe ?? []} />}
        {ansicht === 'mitarbeiter' && verwaltung && (
          <MitarbeiterVerwaltung liste={mitarbeiterListe ?? []} onListeAendern={setMitarbeiterListe} />
        )}
        {ansicht === 'export' && (
          <ExportAnsicht verwaltung={verwaltung} eigeneId={mitarbeiter?.id ?? null} mitarbeiterListe={mitarbeiterListe ?? []} />
        )}
      </main>
    </>
  )
}

function AlleZeitenAnsicht({ mitarbeiterListe }: { mitarbeiterListe: Mitarbeiter[] }) {
  const [ausgewaehlteId, setAusgewaehlteId] = useState(mitarbeiterListe[0]?.id ?? '')
  const ziel = mitarbeiterListe.find((m) => m.id === ausgewaehlteId)

  if (mitarbeiterListe.length === 0) {
    return <p className="text-sm text-muted">Noch keine Mitarbeiter angelegt.</p>
  }

  return (
    <div>
      <select
        value={ausgewaehlteId}
        onChange={(e) => setAusgewaehlteId(e.target.value)}
        className="mb-3 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
      >
        {mitarbeiterListe.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      {ziel && <ZeitenAnsicht ziel={ziel} />}
    </div>
  )
}
