'use client'

import { useEffect, useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import {
  artikelAktualisierenAktion,
  artikelAlleLadenAktion,
  artikelErstellenAktion,
  artikelLoeschenAktion,
  lieferantenLadenAktion,
} from './actions'
import type { Artikel, Lieferant } from '@/lib/lager/types'

function NeuerArtikelForm({ lieferantId, onAngelegt }: { lieferantId: string; onAngelegt: (a: Artikel) => void }) {
  const [name, setName] = useState('')
  const [einheit, setEinheit] = useState('Stück')
  const [mindestbestand, setMindestbestand] = useState('0')
  const [fehler, setFehler] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function anlegen() {
    if (!name.trim()) return
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await artikelErstellenAktion({
        lieferantId,
        name,
        einheit,
        mindestbestand: Number(mindestbestand.replace(',', '.')) || 0,
      })
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler)
        return
      }
      if (ergebnis.artikel) {
        onAngelegt(ergebnis.artikel)
        setName('')
        setMindestbestand('0')
      }
    })
  }

  return (
    <div className="rounded-xl border border-border bg-background p-3">
      {fehler && <p className="mb-2 text-xs font-medium text-danger">{fehler}</p>}
      <div className="grid grid-cols-3 gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Artikel" className="col-span-3 rounded-lg border border-border bg-card px-2 py-1.5 text-sm" />
        <input value={einheit} onChange={(e) => setEinheit(e.target.value)} placeholder="Einheit" className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm" />
        <input
          value={mindestbestand}
          onChange={(e) => setMindestbestand(e.target.value)}
          placeholder="Mindestbestand"
          inputMode="decimal"
          className="col-span-2 rounded-lg border border-border bg-card px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="button"
        onClick={anlegen}
        disabled={pending}
        className="mt-2 w-full rounded-lg bg-accent py-1.5 text-xs font-semibold text-accent-foreground disabled:opacity-40"
      >
        {pending ? 'Speichert…' : '+ Artikel anlegen'}
      </button>
    </div>
  )
}

function ArtikelBearbeitenForm({
  artikel,
  onGespeichert,
  onAbbrechen,
}: {
  artikel: Artikel
  onGespeichert: (a: Artikel) => void
  onAbbrechen: () => void
}) {
  const [name, setName] = useState(artikel.name)
  const [einheit, setEinheit] = useState(artikel.einheit)
  const [mindestbestand, setMindestbestand] = useState(String(artikel.mindestbestand))
  const [fehler, setFehler] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function speichern() {
    if (!name.trim()) return
    setFehler(null)
    const patch = { name, einheit, mindestbestand: Number(mindestbestand.replace(',', '.')) || 0 }
    startTransition(async () => {
      const ergebnis = await artikelAktualisierenAktion(artikel.id, patch)
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler)
        return
      }
      onGespeichert({ ...artikel, ...patch })
    })
  }

  return (
    <div className="rounded-xl border border-border bg-background p-3">
      {fehler && <p className="mb-2 text-xs font-medium text-danger">{fehler}</p>}
      <div className="grid grid-cols-3 gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Artikel" className="col-span-3 rounded-lg border border-border bg-card px-2 py-1.5 text-sm" />
        <input value={einheit} onChange={(e) => setEinheit(e.target.value)} placeholder="Einheit" className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm" />
        <input
          value={mindestbestand}
          onChange={(e) => setMindestbestand(e.target.value)}
          placeholder="Mindestbestand"
          inputMode="decimal"
          className="col-span-2 rounded-lg border border-border bg-card px-2 py-1.5 text-sm"
        />
      </div>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onAbbrechen} className="flex-1 rounded-lg bg-card py-1.5 text-xs font-medium text-muted">
          Abbrechen
        </button>
        <button
          type="button"
          onClick={speichern}
          disabled={pending}
          className="flex-1 rounded-lg bg-accent py-1.5 text-xs font-semibold text-accent-foreground disabled:opacity-40"
        >
          {pending ? 'Speichert…' : 'Speichern'}
        </button>
      </div>
    </div>
  )
}

export default function ArtikelVerwaltung() {
  const [lieferanten, setLieferanten] = useState<Lieferant[]>([])
  const [artikel, setArtikel] = useState<Artikel[]>([])
  const [laden, startLaden] = useTransition()
  const [, startAktion] = useTransition()
  const [bearbeitenId, setBearbeitenId] = useState<string | null>(null)

  useEffect(() => {
    startLaden(async () => {
      const [l, a] = await Promise.all([lieferantenLadenAktion(), artikelAlleLadenAktion()])
      setLieferanten(l)
      setArtikel(a)
    })
  }, [])

  function aktivUmschalten(a: Artikel) {
    setArtikel((prev) => prev.map((x) => (x.id === a.id ? { ...x, aktiv: !x.aktiv } : x)))
    startAktion(async () => {
      await artikelAktualisierenAktion(a.id, { aktiv: !a.aktiv })
    })
  }

  function loeschen(id: string) {
    setArtikel((prev) => prev.filter((a) => a.id !== id))
    startAktion(async () => {
      await artikelLoeschenAktion(id)
    })
  }

  if (laden) return <p className="text-sm text-muted">Lade…</p>

  if (lieferanten.length === 0) {
    return <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">Zuerst im Tab &quot;Lieferanten&quot; mindestens einen anlegen.</p>
  }

  return (
    <div className="space-y-4">
      {lieferanten.map((lieferant) => {
        const artikelDesLieferanten = artikel.filter((a) => a.lieferantId === lieferant.id)
        return (
          <div key={lieferant.id} className="rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">{lieferant.name}</h3>
            <div className="space-y-2">
              {artikelDesLieferanten.map((a) =>
                bearbeitenId === a.id ? (
                  <ArtikelBearbeitenForm
                    key={a.id}
                    artikel={a}
                    onGespeichert={(neu) => {
                      setArtikel((prev) => prev.map((x) => (x.id === neu.id ? neu : x)))
                      setBearbeitenId(null)
                    }}
                    onAbbrechen={() => setBearbeitenId(null)}
                  />
                ) : (
                  <div key={a.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background p-2.5">
                    <div>
                      <p className={a.aktiv ? 'text-sm font-medium' : 'text-sm font-medium text-muted line-through'}>{a.name}</p>
                      <p className="text-xs text-muted">
                        {a.einheit} · Mindestbestand {a.mindestbestand}
                      </p>
                    </div>
                    <div className="flex flex-none items-center gap-2">
                      <button type="button" onClick={() => setBearbeitenId(a.id)} className="text-xs font-medium text-muted">
                        Bearbeiten
                      </button>
                      <button type="button" onClick={() => aktivUmschalten(a)} className="text-xs font-medium text-muted">
                        {a.aktiv ? 'Ausblenden' : 'Einblenden'}
                      </button>
                      <button type="button" onClick={() => loeschen(a.id)} aria-label="Artikel löschen" className="text-muted">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              )}
              {artikelDesLieferanten.length === 0 && <p className="text-xs text-muted">Noch keine Artikel.</p>}
            </div>
            <div className="mt-2">
              <NeuerArtikelForm lieferantId={lieferant.id} onAngelegt={(a) => setArtikel((prev) => [...prev, a])} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
