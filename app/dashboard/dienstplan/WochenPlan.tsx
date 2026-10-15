'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Repeat } from 'lucide-react'
import {
  alleTageZwischen,
  datumPlusTage,
  formatDatumKurz,
  heuteBerlin,
  wochenStart,
  wochentagKurz,
} from '@/lib/datum'
import {
  schichtAktualisierenAktion,
  schichtenFuerZeitraumLadenAktion,
  schichtErstellenAktion,
  schichtLoeschenAktion,
  tauschAnfrageErstellenAktion,
  verfuegbarkeitenFuerZeitraumLadenAktion,
} from './actions'
import type { Schicht, Verfuegbarkeit } from '@/lib/dienstplan/types'
import type { Mitarbeiter } from '@/lib/mitarbeiter/types'
import { cn } from '@/lib/utils'

function NeueSchichtForm({
  datum,
  mitarbeiterNamen,
  nichtVerfuegbareIds,
  onAngelegt,
  onAbbrechen,
}: {
  datum: string
  mitarbeiterNamen: { id: string; name: string }[]
  nichtVerfuegbareIds: Set<string>
  onAngelegt: (s: Schicht) => void
  onAbbrechen: () => void
}) {
  const [beginn, setBeginn] = useState('09:00')
  const [ende, setEnde] = useState('17:00')
  const [mitarbeiterId, setMitarbeiterId] = useState('')
  const [notiz, setNotiz] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const verfuegbareMitarbeiter = mitarbeiterNamen.filter((m) => !nichtVerfuegbareIds.has(m.id))

  function anlegen() {
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await schichtErstellenAktion({
        datum,
        beginn,
        ende,
        mitarbeiterId: mitarbeiterId || null,
        notiz: notiz.trim() || undefined,
      })
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler)
        return
      }
      if (ergebnis.schicht) onAngelegt(ergebnis.schicht)
    })
  }

  return (
    <div className="mt-2 rounded-xl border border-border bg-background p-3">
      {fehler && <p className="mb-2 text-xs font-medium text-danger">{fehler}</p>}
      <div className="grid grid-cols-2 gap-2">
        <input type="time" value={beginn} onChange={(e) => setBeginn(e.target.value)} className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm" />
        <input type="time" value={ende} onChange={(e) => setEnde(e.target.value)} className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm" />
        <select
          value={mitarbeiterId}
          onChange={(e) => setMitarbeiterId(e.target.value)}
          className="col-span-2 rounded-lg border border-border bg-card px-2 py-1.5 text-sm"
        >
          <option value="">Noch offen (keine Zuweisung)</option>
          {verfuegbareMitarbeiter.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <input
          value={notiz}
          onChange={(e) => setNotiz(e.target.value)}
          placeholder="Notiz (optional)"
          className="col-span-2 rounded-lg border border-border bg-card px-2 py-1.5 text-sm"
        />
      </div>
      {mitarbeiterNamen.length > verfuegbareMitarbeiter.length && (
        <p className="mt-2 text-xs text-muted">
          Mitarbeiter, die für diesen Tag als nicht verfügbar eingetragen sind, werden hier nicht angezeigt.
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onAbbrechen} className="flex-1 rounded-lg bg-card py-1.5 text-xs font-medium text-muted">
          Abbrechen
        </button>
        <button
          type="button"
          onClick={anlegen}
          disabled={pending}
          className="flex-1 rounded-lg bg-accent py-1.5 text-xs font-semibold text-accent-foreground disabled:opacity-40"
        >
          {pending ? 'Speichert…' : 'Anlegen'}
        </button>
      </div>
    </div>
  )
}

function SchichtZeile({
  schicht,
  mitarbeiter,
  verwaltung,
  mitarbeiterNamen,
  nichtVerfuegbareIds,
  onAendern,
  onEntfernen,
}: {
  schicht: Schicht
  // null beim Verwaltungskonto (keine eigenen Schichten)
  mitarbeiter: Mitarbeiter | null
  verwaltung: boolean
  mitarbeiterNamen: { id: string; name: string }[]
  nichtVerfuegbareIds: Set<string>
  onAendern: (s: Schicht) => void
  onEntfernen: (id: string) => void
}) {
  const istLeitung = verwaltung
  const istEigeneSchicht = schicht.mitarbeiterId === mitarbeiter?.id
  const inZukunft = schicht.datum >= heuteBerlin()
  const [tauschPending, startTausch] = useTransition()
  const [tauschFehler, setTauschFehler] = useState<string | null>(null)
  const [tauschAngefragt, setTauschAngefragt] = useState(false)
  const [loeschPending, startLoeschen] = useTransition()

  const [bearbeiten, setBearbeiten] = useState(false)
  const [beginnEdit, setBeginnEdit] = useState(schicht.beginn)
  const [endeEdit, setEndeEdit] = useState(schicht.ende)
  const [notizEdit, setNotizEdit] = useState(schicht.notiz ?? '')
  const [bearbeitenFehler, setBearbeitenFehler] = useState<string | null>(null)
  const [speichernPending, startSpeichern] = useTransition()

  const name = schicht.mitarbeiterId ? mitarbeiterNamen.find((m) => m.id === schicht.mitarbeiterId)?.name : null

  // Zuweisung bleibt sichtbar auswählbar, auch wenn der/die Mitarbeiter:in
  // inzwischen als nicht verfügbar eingetragen ist – sonst verschwindet eine
  // bestehende Zuweisung kommentarlos aus der Liste.
  const auswaehlbareMitarbeiter = mitarbeiterNamen.filter(
    (m) => !nichtVerfuegbareIds.has(m.id) || m.id === schicht.mitarbeiterId
  )

  function tauschAnbieten() {
    setTauschFehler(null)
    startTausch(async () => {
      const ergebnis = await tauschAnfrageErstellenAktion(schicht.id)
      if (ergebnis.fehler) {
        setTauschFehler(ergebnis.fehler)
        return
      }
      setTauschAngefragt(true)
    })
  }

  function zuweisungAendern(mitarbeiterId: string) {
    const neu = { ...schicht, mitarbeiterId: mitarbeiterId || null }
    onAendern(neu)
    void schichtAktualisierenAktion(schicht.id, { mitarbeiterId: neu.mitarbeiterId }).then((ergebnis) => {
      if (ergebnis.fehler) onAendern(schicht) // Konflikt: Zuweisung zurücknehmen.
    })
  }

  function loeschen() {
    startLoeschen(async () => {
      await schichtLoeschenAktion(schicht.id)
      onEntfernen(schicht.id)
    })
  }

  function bearbeitenStarten() {
    setBeginnEdit(schicht.beginn)
    setEndeEdit(schicht.ende)
    setNotizEdit(schicht.notiz ?? '')
    setBearbeitenFehler(null)
    setBearbeiten(true)
  }

  function bearbeitenSpeichern() {
    setBearbeitenFehler(null)
    startSpeichern(async () => {
      const ergebnis = await schichtAktualisierenAktion(schicht.id, {
        beginn: beginnEdit,
        ende: endeEdit,
        notiz: notizEdit.trim() || null,
      })
      if (ergebnis.fehler) {
        setBearbeitenFehler(ergebnis.fehler)
        return
      }
      onAendern({ ...schicht, beginn: beginnEdit, ende: endeEdit, notiz: notizEdit.trim() || null })
      setBearbeiten(false)
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{schicht.beginn}–{schicht.ende} Uhr</span>
        {!schicht.mitarbeiterId && <span className="text-xs font-semibold text-locked">Offen</span>}
      </div>
      {schicht.notiz && <p className="mt-0.5 text-xs text-muted">{schicht.notiz}</p>}

      {istLeitung && bearbeiten ? (
        <div className="mt-2 rounded-xl border border-border bg-background p-3">
          {bearbeitenFehler && <p className="mb-2 text-xs font-medium text-danger">{bearbeitenFehler}</p>}
          <div className="grid grid-cols-2 gap-2">
            <input
              type="time"
              value={beginnEdit}
              onChange={(e) => setBeginnEdit(e.target.value)}
              className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm"
            />
            <input
              type="time"
              value={endeEdit}
              onChange={(e) => setEndeEdit(e.target.value)}
              className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm"
            />
            <input
              value={notizEdit}
              onChange={(e) => setNotizEdit(e.target.value)}
              placeholder="Notiz (optional)"
              className="col-span-2 rounded-lg border border-border bg-card px-2 py-1.5 text-sm"
            />
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setBearbeiten(false)}
              className="flex-1 rounded-lg bg-card py-1.5 text-xs font-medium text-muted"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={bearbeitenSpeichern}
              disabled={speichernPending}
              className="flex-1 rounded-lg bg-accent py-1.5 text-xs font-semibold text-accent-foreground disabled:opacity-40"
            >
              {speichernPending ? 'Speichert…' : 'Speichern'}
            </button>
          </div>
        </div>
      ) : istLeitung ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={schicht.mitarbeiterId ?? ''}
            onChange={(e) => zuweisungAendern(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
          >
            <option value="">Noch offen</option>
            {auswaehlbareMitarbeiter.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {nichtVerfuegbareIds.has(m.id) ? ' (nicht verfügbar)' : ''}
              </option>
            ))}
          </select>
          <button type="button" onClick={bearbeitenStarten} className="rounded-lg bg-background px-2 py-1 text-xs font-medium text-muted">
            Bearbeiten
          </button>
          <button
            type="button"
            onClick={loeschen}
            disabled={loeschPending}
            className="rounded-lg bg-background px-2 py-1 text-xs font-medium text-danger"
          >
            Löschen
          </button>
        </div>
      ) : (
        name && <p className="mt-1 text-xs text-muted">{name}</p>
      )}

      {!istLeitung && istEigeneSchicht && inZukunft && (
        <div className="mt-2">
          {tauschAngefragt ? (
            <p className="text-xs font-medium text-success">Zum Tausch angeboten – in der Tausch-Börse sichtbar.</p>
          ) : (
            <button
              type="button"
              onClick={tauschAnbieten}
              disabled={tauschPending}
              className="flex items-center gap-1.5 rounded-lg bg-background px-2 py-1 text-xs font-medium text-muted disabled:opacity-40"
            >
              <Repeat className="h-3 w-3" /> {tauschPending ? 'Lädt…' : 'Zum Tausch anbieten'}
            </button>
          )}
          {tauschFehler && <p className="mt-1 text-xs font-medium text-danger">{tauschFehler}</p>}
        </div>
      )}
    </div>
  )
}

export default function WochenPlan({
  mitarbeiter,
  verwaltung,
  mitarbeiterNamen,
}: {
  // null beim Verwaltungskonto (keine eigenen Schichten)
  mitarbeiter: Mitarbeiter | null
  verwaltung: boolean
  mitarbeiterNamen: { id: string; name: string }[]
}) {
  const [anker, setAnker] = useState(heuteBerlin())
  const [schichten, setSchichten] = useState<Schicht[]>([])
  const [verfuegbarkeiten, setVerfuegbarkeiten] = useState<Verfuegbarkeit[]>([])
  const [neueSchichtTag, setNeueSchichtTag] = useState<string | null>(null)
  const [laden, startLaden] = useTransition()

  const istLeitung = verwaltung
  const von = useMemo(() => wochenStart(anker), [anker])
  const bis = useMemo(() => datumPlusTage(von, 6), [von])
  const tage = useMemo(() => alleTageZwischen(von, bis), [von, bis])

  useEffect(() => {
    startLaden(async () => {
      const [schichtenListe, verfuegbarkeitenListe] = await Promise.all([
        schichtenFuerZeitraumLadenAktion(von, bis),
        istLeitung ? verfuegbarkeitenFuerZeitraumLadenAktion(von, bis) : Promise.resolve([]),
      ])
      setSchichten(schichtenListe)
      setVerfuegbarkeiten(verfuegbarkeitenListe)
    })
  }, [von, bis, istLeitung])

  function nichtVerfuegbareIdsFuerTag(datum: string): Set<string> {
    return new Set(verfuegbarkeiten.filter((v) => v.datum === datum && !v.verfuegbar).map((v) => v.mitarbeiterId))
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => setAnker((a) => datumPlusTage(a, -7))} className="px-2 text-muted">
          ←
        </button>
        <span className="text-sm font-semibold">
          {formatDatumKurz(von)} – {formatDatumKurz(bis)}
        </span>
        <button type="button" onClick={() => setAnker((a) => datumPlusTage(a, 7))} className="px-2 text-muted">
          →
        </button>
      </div>

      {laden ? (
        <p className="text-sm text-muted">Lade…</p>
      ) : (
        <div className="space-y-4">
          {tage.map((tag) => {
            const schichtenDesTages = schichten.filter((s) => s.datum === tag)
            const nichtVerfuegbareIds = nichtVerfuegbareIdsFuerTag(tag)
            const nichtVerfuegbareNamen = mitarbeiterNamen.filter((m) => nichtVerfuegbareIds.has(m.id)).map((m) => m.name)

            return (
              <div key={tag}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className={cn('text-xs font-semibold', tag < heuteBerlin() ? 'text-muted' : 'text-foreground')}>
                    {wochentagKurz(tag)} {formatDatumKurz(tag)}
                  </span>
                  {istLeitung && nichtVerfuegbareNamen.length > 0 && (
                    <span className="text-xs text-locked">Nicht verfügbar: {nichtVerfuegbareNamen.join(', ')}</span>
                  )}
                </div>

                <div className="space-y-2">
                  {schichtenDesTages.map((schicht) => (
                    <SchichtZeile
                      key={schicht.id}
                      schicht={schicht}
                      mitarbeiter={mitarbeiter}
                      verwaltung={verwaltung}
                      mitarbeiterNamen={mitarbeiterNamen}
                      nichtVerfuegbareIds={nichtVerfuegbareIds}
                      onAendern={(neu) => setSchichten((prev) => prev.map((s) => (s.id === neu.id ? neu : s)))}
                      onEntfernen={(id) => setSchichten((prev) => prev.filter((s) => s.id !== id))}
                    />
                  ))}
                  {schichtenDesTages.length === 0 && <p className="text-xs text-muted">Keine Schichten geplant.</p>}
                </div>

                {istLeitung &&
                  (neueSchichtTag === tag ? (
                    <NeueSchichtForm
                      datum={tag}
                      mitarbeiterNamen={mitarbeiterNamen}
                      nichtVerfuegbareIds={nichtVerfuegbareIds}
                      onAngelegt={(s) => {
                        setSchichten((prev) => [...prev, s])
                        setNeueSchichtTag(null)
                      }}
                      onAbbrechen={() => setNeueSchichtTag(null)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setNeueSchichtTag(tag)}
                      className="mt-2 w-full rounded-xl border border-dashed border-border py-2 text-xs font-medium text-muted"
                    >
                      + Schicht hinzufügen
                    </button>
                  ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
