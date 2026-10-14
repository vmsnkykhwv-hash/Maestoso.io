'use client'

import { useEffect, useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import {
  lieferantAktualisierenAktion,
  lieferantenLadenAktion,
  lieferantErstellenAktion,
  lieferantLoeschenAktion,
} from './actions'
import { WOCHENTAG_LABEL, type BestellzyklusTyp, type Lieferant } from '@/lib/lager/types'
import { cn } from '@/lib/utils'

type FormWerte = {
  name: string
  kontaktEmail: string
  kontaktTelefon: string
  ansprechpartner: string
  kundennummer: string
  notiz: string
  zyklusTyp: BestellzyklusTyp
  wochentage: number[]
  tagImMonat: string
  vorlaufTage: string
}

function leereFormWerte(): FormWerte {
  return {
    name: '',
    kontaktEmail: '',
    kontaktTelefon: '',
    ansprechpartner: '',
    kundennummer: '',
    notiz: '',
    zyklusTyp: 'woechentlich',
    wochentage: [],
    tagImMonat: '1',
    vorlaufTage: '1',
  }
}

function formWerteAusLieferant(l: Lieferant): FormWerte {
  return {
    name: l.name,
    kontaktEmail: l.kontaktEmail ?? '',
    kontaktTelefon: l.kontaktTelefon ?? '',
    ansprechpartner: l.ansprechpartner ?? '',
    kundennummer: l.kundennummer ?? '',
    notiz: l.notiz ?? '',
    zyklusTyp: l.zyklusTyp,
    wochentage: l.wochentage,
    tagImMonat: String(l.tagImMonat ?? 1),
    vorlaufTage: String(l.vorlaufTage),
  }
}

function zyklusBeschreibung(l: Lieferant): string {
  if (l.zyklusTyp === 'woechentlich') {
    if (l.wochentage.length === 0) return 'Wöchentlich (kein Tag gewählt)'
    return 'Wöchentlich: ' + l.wochentage.map((w) => WOCHENTAG_LABEL[w]).join(', ')
  }
  return `Monatlich: Tag ${l.tagImMonat}`
}

function LieferantForm({
  anfangsWerte,
  onSpeichern,
  onAbbrechen,
}: {
  anfangsWerte: FormWerte
  onSpeichern: (werte: FormWerte) => Promise<string | undefined>
  onAbbrechen: () => void
}) {
  const [werte, setWerte] = useState(anfangsWerte)
  const [fehler, setFehler] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function wochentagUmschalten(tag: number) {
    setWerte((prev) => ({
      ...prev,
      wochentage: prev.wochentage.includes(tag) ? prev.wochentage.filter((t) => t !== tag) : [...prev.wochentage, tag].sort(),
    }))
  }

  function speichern() {
    if (!werte.name.trim()) return
    setFehler(null)
    startTransition(async () => {
      const fehlerText = await onSpeichern(werte)
      if (fehlerText) setFehler(fehlerText)
    })
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      {fehler && <p className="mb-2 text-sm text-danger">{fehler}</p>}
      <div className="space-y-2">
        <input
          value={werte.name}
          onChange={(e) => setWerte((p) => ({ ...p, name: e.target.value }))}
          placeholder="Name, z. B. Getränke Schmidt"
          className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            value={werte.kontaktEmail}
            onChange={(e) => setWerte((p) => ({ ...p, kontaktEmail: e.target.value }))}
            placeholder="E-Mail (optional)"
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
          <input
            value={werte.kontaktTelefon}
            onChange={(e) => setWerte((p) => ({ ...p, kontaktTelefon: e.target.value }))}
            placeholder="Telefon (optional)"
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
          <input
            value={werte.ansprechpartner}
            onChange={(e) => setWerte((p) => ({ ...p, ansprechpartner: e.target.value }))}
            placeholder="Ansprechpartner (optional)"
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
          <input
            value={werte.kundennummer}
            onChange={(e) => setWerte((p) => ({ ...p, kundennummer: e.target.value }))}
            placeholder="Kundennummer (optional)"
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>

        <p className="text-xs text-muted">
          Ansprechpartner und Kundennummer erscheinen automatisch im E-Mail-Entwurf für Bestellungen (Tab „Bestellung”).
        </p>

        <div className="rounded-xl border border-border bg-background p-3">
          <p className="mb-2 text-xs font-semibold">Bestellzyklus</p>
          <select
            value={werte.zyklusTyp}
            onChange={(e) => setWerte((p) => ({ ...p, zyklusTyp: e.target.value as BestellzyklusTyp }))}
            className="mb-2 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-sm"
          >
            <option value="woechentlich">Wöchentlich</option>
            <option value="monatlich">Monatlich</option>
          </select>

          {werte.zyklusTyp === 'woechentlich' ? (
            <div className="flex flex-wrap gap-1.5">
              {WOCHENTAG_LABEL.map((label, tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => wochentagUmschalten(tag)}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-medium',
                    werte.wochentage.includes(tag) ? 'bg-accent text-accent-foreground' : 'bg-card text-muted'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <label className="block text-xs text-muted">
              Tag im Monat (1–28)
              <input
                type="number"
                min={1}
                max={28}
                value={werte.tagImMonat}
                onChange={(e) => setWerte((p) => ({ ...p, tagImMonat: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-sm"
              />
            </label>
          )}

          <label className="mt-2 block text-xs text-muted">
            Vorlauf (Tage vor Bestelltermin, Prüfung wird fällig)
            <input
              type="number"
              min={0}
              value={werte.vorlaufTage}
              onChange={(e) => setWerte((p) => ({ ...p, vorlaufTage: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-sm"
            />
          </label>
        </div>

        <input
          value={werte.notiz}
          onChange={(e) => setWerte((p) => ({ ...p, notiz: e.target.value }))}
          placeholder="Notiz (optional)"
          className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
        />
      </div>

      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onAbbrechen} className="flex-1 rounded-lg bg-background py-2 text-sm font-medium text-muted">
          Abbrechen
        </button>
        <button
          type="button"
          onClick={speichern}
          disabled={pending}
          className="flex-1 rounded-lg bg-accent py-2 text-sm font-semibold text-accent-foreground disabled:opacity-40"
        >
          {pending ? 'Speichert…' : 'Speichern'}
        </button>
      </div>
    </div>
  )
}

export default function LieferantenVerwaltung() {
  const [lieferanten, setLieferanten] = useState<Lieferant[]>([])
  const [laden, startLaden] = useTransition()
  const [neuOffen, setNeuOffen] = useState(false)
  const [bearbeitenId, setBearbeitenId] = useState<string | null>(null)
  const [, startAktion] = useTransition()

  useEffect(() => {
    startLaden(async () => {
      setLieferanten(await lieferantenLadenAktion())
    })
  }, [])

  function werteZuInput(werte: FormWerte) {
    return {
      name: werte.name,
      kontaktEmail: werte.kontaktEmail || undefined,
      kontaktTelefon: werte.kontaktTelefon || undefined,
      ansprechpartner: werte.ansprechpartner || undefined,
      kundennummer: werte.kundennummer || undefined,
      notiz: werte.notiz || undefined,
      zyklusTyp: werte.zyklusTyp,
      wochentage: werte.zyklusTyp === 'woechentlich' ? werte.wochentage : [],
      tagImMonat: werte.zyklusTyp === 'monatlich' ? Number(werte.tagImMonat) || 1 : null,
      vorlaufTage: Number(werte.vorlaufTage) || 0,
    }
  }

  async function neuAnlegen(werte: FormWerte): Promise<string | undefined> {
    const ergebnis = await lieferantErstellenAktion(werteZuInput(werte))
    if (ergebnis.fehler) return ergebnis.fehler
    if (ergebnis.lieferant) {
      setLieferanten((prev) => [...prev, ergebnis.lieferant!].sort((a, b) => a.name.localeCompare(b.name)))
      setNeuOffen(false)
    }
    return undefined
  }

  async function bearbeitenSpeichern(id: string, werte: FormWerte): Promise<string | undefined> {
    const ergebnis = await lieferantAktualisierenAktion(id, werteZuInput(werte))
    if (ergebnis.fehler) return ergebnis.fehler
    setLieferanten((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              ...werteZuInput(werte),
              kontaktEmail: werte.kontaktEmail || null,
              kontaktTelefon: werte.kontaktTelefon || null,
              ansprechpartner: werte.ansprechpartner || null,
              kundennummer: werte.kundennummer || null,
              notiz: werte.notiz || null,
            }
          : l
      )
    )
    setBearbeitenId(null)
    return undefined
  }

  function aktivUmschalten(l: Lieferant) {
    setLieferanten((prev) => prev.map((x) => (x.id === l.id ? { ...x, aktiv: !x.aktiv } : x)))
    startAktion(async () => {
      await lieferantAktualisierenAktion(l.id, { aktiv: !l.aktiv })
    })
  }

  function loeschen(id: string) {
    setLieferanten((prev) => prev.filter((l) => l.id !== id))
    startAktion(async () => {
      await lieferantLoeschenAktion(id)
    })
  }

  if (laden) return <p className="text-sm text-muted">Lade…</p>

  return (
    <div className="space-y-3">
      {lieferanten.map((l) =>
        bearbeitenId === l.id ? (
          <LieferantForm
            key={l.id}
            anfangsWerte={formWerteAusLieferant(l)}
            onSpeichern={(werte) => bearbeitenSpeichern(l.id, werte)}
            onAbbrechen={() => setBearbeitenId(null)}
          />
        ) : (
          <div key={l.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{l.name}</p>
                <p className="text-xs text-muted">{zyklusBeschreibung(l)} · Vorlauf {l.vorlaufTage} Tag(e)</p>
              </div>
              <button type="button" onClick={() => loeschen(l.id)} aria-label="Lieferant löschen" className="flex-none text-muted">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => setBearbeitenId(l.id)} className="rounded-lg bg-background px-2.5 py-1 text-xs font-medium text-muted">
                Bearbeiten
              </button>
              <button type="button" onClick={() => aktivUmschalten(l)} className="rounded-lg bg-background px-2.5 py-1 text-xs font-medium text-muted">
                {l.aktiv ? 'Deaktivieren' : 'Aktivieren'}
              </button>
            </div>
          </div>
        )
      )}

      {neuOffen ? (
        <LieferantForm anfangsWerte={leereFormWerte()} onSpeichern={neuAnlegen} onAbbrechen={() => setNeuOffen(false)} />
      ) : (
        <button type="button" onClick={() => setNeuOffen(true)} className="w-full rounded-xl border border-dashed border-border py-2.5 text-sm font-medium text-muted">
          + Lieferant anlegen
        </button>
      )}
    </div>
  )
}
