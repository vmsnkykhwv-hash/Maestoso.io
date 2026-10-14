'use client'

import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import {
  eintragAktualisierenAktion,
  eintragErstellenAktion,
  eintragLoeschenAktion,
  kategorieAktualisierenAktion,
  kategorieErstellenAktion,
  kategorieLoeschenAktion,
} from './actions'
import type { MenuEintrag, MenuKategorie } from '@/lib/website/types'

function formatPreis(preis: number): string {
  return preis.toFixed(2).replace('.', ',') + ' €'
}

function NeuerEintragForm({
  kategorieId,
  onAngelegt,
  onAbbrechen,
}: {
  kategorieId: string
  onAngelegt: (e: MenuEintrag) => void
  onAbbrechen: () => void
}) {
  const [name, setName] = useState('')
  const [beschreibung, setBeschreibung] = useState('')
  const [preis, setPreis] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function anlegen() {
    if (!name.trim()) return
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await eintragErstellenAktion({
        kategorieId,
        name,
        beschreibung: beschreibung.trim() || undefined,
        preis: Number(preis.replace(',', '.')) || 0,
      })
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler)
        return
      }
      if (ergebnis.eintrag) onAngelegt(ergebnis.eintrag)
    })
  }

  return (
    <div className="rounded-xl border border-border bg-background p-3">
      {fehler && <p className="mb-2 text-xs font-medium text-danger">{fehler}</p>}
      <div className="grid grid-cols-2 gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="col-span-2 rounded-lg border border-border bg-card px-2 py-1.5 text-sm"
        />
        <input
          value={beschreibung}
          onChange={(e) => setBeschreibung(e.target.value)}
          placeholder="Beschreibung (optional)"
          className="col-span-2 rounded-lg border border-border bg-card px-2 py-1.5 text-sm"
        />
        <input
          value={preis}
          onChange={(e) => setPreis(e.target.value)}
          placeholder="Preis, z. B. 8,50"
          inputMode="decimal"
          className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm"
        />
      </div>
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

function EintragZeile({ eintrag, onAendern, onLoeschen }: { eintrag: MenuEintrag; onAendern: (e: MenuEintrag) => void; onLoeschen: (id: string) => void }) {
  const [bearbeiten, setBearbeiten] = useState(false)
  const [name, setName] = useState(eintrag.name)
  const [beschreibung, setBeschreibung] = useState(eintrag.beschreibung ?? '')
  const [preis, setPreis] = useState(String(eintrag.preis).replace('.', ','))
  const [, startTransition] = useTransition()

  function speichern() {
    const neu = { ...eintrag, name: name.trim(), beschreibung: beschreibung.trim() || null, preis: Number(preis.replace(',', '.')) || 0 }
    onAendern(neu)
    setBearbeiten(false)
    startTransition(async () => {
      await eintragAktualisierenAktion(eintrag.id, { name: neu.name, beschreibung: neu.beschreibung, preis: neu.preis })
    })
  }

  function aktivUmschalten() {
    const neu = { ...eintrag, aktiv: !eintrag.aktiv }
    onAendern(neu)
    startTransition(async () => {
      await eintragAktualisierenAktion(eintrag.id, { aktiv: neu.aktiv })
    })
  }

  if (bearbeiten) {
    return (
      <div className="rounded-xl border border-border bg-background p-3">
        <div className="grid grid-cols-2 gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className="col-span-2 rounded-lg border border-border bg-card px-2 py-1.5 text-sm" />
          <input value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)} placeholder="Beschreibung" className="col-span-2 rounded-lg border border-border bg-card px-2 py-1.5 text-sm" />
          <input value={preis} onChange={(e) => setPreis(e.target.value)} inputMode="decimal" className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm" />
        </div>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => setBearbeiten(false)} className="flex-1 rounded-lg bg-card py-1.5 text-xs font-medium text-muted">
            Abbrechen
          </button>
          <button type="button" onClick={speichern} className="flex-1 rounded-lg bg-accent py-1.5 text-xs font-semibold text-accent-foreground">
            Speichern
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start justify-between gap-2 rounded-xl border border-border bg-background p-3">
      <button type="button" onClick={() => setBearbeiten(true)} className="flex-1 text-left">
        <p className={eintrag.aktiv ? 'text-sm font-medium' : 'text-sm font-medium text-muted line-through'}>
          {eintrag.name} <span className="font-normal text-muted">· {formatPreis(eintrag.preis)}</span>
        </p>
        {eintrag.beschreibung && <p className="text-xs text-muted">{eintrag.beschreibung}</p>}
      </button>
      <div className="flex flex-none items-center gap-2">
        <button type="button" onClick={aktivUmschalten} className="text-xs font-medium text-muted">
          {eintrag.aktiv ? 'Ausblenden' : 'Einblenden'}
        </button>
        <button type="button" onClick={() => onLoeschen(eintrag.id)} aria-label="Eintrag löschen" className="text-muted">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export default function SpeisekarteVerwaltung({
  kategorien,
  eintraege,
  onKategorienAendern,
  onEintraegenAendern,
}: {
  kategorien: MenuKategorie[]
  eintraege: MenuEintrag[]
  onKategorienAendern: (kategorien: MenuKategorie[]) => void
  onEintraegenAendern: (eintraege: MenuEintrag[]) => void
}) {
  const [neueKategorieName, setNeueKategorieName] = useState('')
  const [neuerEintragKategorieId, setNeuerEintragKategorieId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function kategorieAnlegen() {
    if (!neueKategorieName.trim()) return
    startTransition(async () => {
      const ergebnis = await kategorieErstellenAktion(neueKategorieName)
      if (ergebnis.kategorie) {
        onKategorienAendern([...kategorien, ergebnis.kategorie])
        setNeueKategorieName('')
      }
    })
  }

  function kategorieLoeschen(id: string) {
    onKategorienAendern(kategorien.filter((k) => k.id !== id))
    onEintraegenAendern(eintraege.filter((e) => e.kategorieId !== id))
    startTransition(async () => {
      await kategorieLoeschenAktion(id)
    })
  }

  return (
    <div className="space-y-4">
      {kategorien.map((kategorie) => {
        const eintraegeDerKategorie = eintraege.filter((e) => e.kategorieId === kategorie.id)
        return (
          <div key={kategorie.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <input
                defaultValue={kategorie.name}
                onBlur={(e) => {
                  const name = e.target.value.trim()
                  if (!name || name === kategorie.name) return
                  onKategorienAendern(kategorien.map((k) => (k.id === kategorie.id ? { ...k, name } : k)))
                  startTransition(async () => {
                    await kategorieAktualisierenAktion(kategorie.id, name)
                  })
                }}
                className="rounded-lg border border-transparent bg-transparent px-1 text-sm font-semibold focus:border-border focus:bg-background"
              />
              <button type="button" onClick={() => kategorieLoeschen(kategorie.id)} aria-label="Kategorie löschen" className="text-muted">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              {eintraegeDerKategorie.map((eintrag) => (
                <EintragZeile
                  key={eintrag.id}
                  eintrag={eintrag}
                  onAendern={(neu) => onEintraegenAendern(eintraege.map((e) => (e.id === neu.id ? neu : e)))}
                  onLoeschen={(id) => {
                    onEintraegenAendern(eintraege.filter((e) => e.id !== id))
                    startTransition(async () => {
                      await eintragLoeschenAktion(id)
                    })
                  }}
                />
              ))}
              {eintraegeDerKategorie.length === 0 && <p className="text-xs text-muted">Noch keine Gerichte in dieser Kategorie.</p>}
            </div>

            {neuerEintragKategorieId === kategorie.id ? (
              <div className="mt-2">
                <NeuerEintragForm
                  kategorieId={kategorie.id}
                  onAngelegt={(e) => {
                    onEintraegenAendern([...eintraege, e])
                    setNeuerEintragKategorieId(null)
                  }}
                  onAbbrechen={() => setNeuerEintragKategorieId(null)}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setNeuerEintragKategorieId(kategorie.id)}
                className="mt-2 w-full rounded-xl border border-dashed border-border py-2 text-xs font-medium text-muted"
              >
                + Gericht hinzufügen
              </button>
            )}
          </div>
        )
      })}

      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Neue Kategorie anlegen</h3>
        <div className="flex gap-2">
          <input
            value={neueKategorieName}
            onChange={(e) => setNeueKategorieName(e.target.value)}
            placeholder="z. B. Frühstück, Hauptgerichte, Getränke"
            className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
          <button type="button" onClick={kategorieAnlegen} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground">
            Anlegen
          </button>
        </div>
      </div>
    </div>
  )
}
