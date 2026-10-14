'use client'

import { useEffect, useState, useTransition } from 'react'
import { heuteBerlin, formatDatumKurz, wochentagKurz } from '@/lib/datum'
import {
  reservierungenFuerTagLadenAktion,
  reservierungManuellAnlegenAktion,
  reservierungStatusAendernAktion,
  reservierungTischZuweisenAktion,
} from './actions'
import { RESERVIERUNG_STATUS_LABEL, type Reservierung, type ReservierungStatus, type Tisch } from '@/lib/tischplan/types'
import { cn } from '@/lib/utils'

const STATUS_FARBE: Record<ReservierungStatus, string> = {
  bestaetigt: 'text-accent',
  erschienen: 'text-success',
  storniert: 'text-muted',
  nicht_erschienen: 'text-danger',
}

function NeueReservierung({ datum, onAngelegt }: { datum: string; onAngelegt: (r: Reservierung) => void }) {
  const [offen, setOffen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [anzahlPersonen, setAnzahlPersonen] = useState('2')
  const [uhrzeit, setUhrzeit] = useState('19:00')
  const [notiz, setNotiz] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (!offen) {
    return (
      <button
        type="button"
        onClick={() => setOffen(true)}
        className="w-full rounded-xl border border-dashed border-border py-2.5 text-sm font-medium text-muted"
      >
        + Reservierung von Hand anlegen
      </button>
    )
  }

  function anlegen() {
    if (!name.trim() || !email.trim()) return
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await reservierungManuellAnlegenAktion({
        name,
        email,
        anzahlPersonen: Number(anzahlPersonen) || 1,
        datum,
        uhrzeit,
        notiz: notiz.trim() || undefined,
      })
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler)
        return
      }
      if (ergebnis.reservierung) {
        onAngelegt(ergebnis.reservierung)
        setOffen(false)
        setName('')
        setEmail('')
        setNotiz('')
      }
    })
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">Reservierung von Hand anlegen</h3>
      {fehler && <p className="mb-2 text-sm text-danger">{fehler}</p>}
      <div className="grid grid-cols-2 gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="col-span-2 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-Mail"
          className="col-span-2 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
        />
        <input
          type="number"
          min={1}
          value={anzahlPersonen}
          onChange={(e) => setAnzahlPersonen(e.target.value)}
          placeholder="Personen"
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
        />
        <input
          type="time"
          value={uhrzeit}
          onChange={(e) => setUhrzeit(e.target.value)}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
        />
        <input
          value={notiz}
          onChange={(e) => setNotiz(e.target.value)}
          placeholder="Notiz (optional)"
          className="col-span-2 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
        />
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setOffen(false)}
          className="flex-1 rounded-lg bg-background py-2 text-sm font-medium text-muted"
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={anlegen}
          disabled={pending}
          className="flex-1 rounded-lg bg-accent py-2 text-sm font-semibold text-accent-foreground disabled:opacity-40"
        >
          {pending ? 'Speichert…' : 'Anlegen'}
        </button>
      </div>
    </div>
  )
}

export default function ReservierungsListe({ tische }: { tische: Tisch[] }) {
  const [datum, setDatum] = useState(heuteBerlin())
  const [reservierungen, setReservierungen] = useState<Reservierung[]>([])
  const [laden, startLaden] = useTransition()
  const [, startAktion] = useTransition()

  useEffect(() => {
    startLaden(async () => {
      setReservierungen(await reservierungenFuerTagLadenAktion(datum))
    })
  }, [datum])

  function statusAendern(id: string, status: ReservierungStatus) {
    setReservierungen((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
    startAktion(async () => {
      await reservierungStatusAendernAktion(id, status)
    })
  }

  function tischZuweisen(id: string, tischId: string) {
    setReservierungen((prev) => prev.map((r) => (r.id === id ? { ...r, tischId: tischId || null } : r)))
    startAktion(async () => {
      await reservierungTischZuweisenAktion(id, tischId || null)
    })
  }

  const aktive = reservierungen.filter((r) => r.status !== 'storniert')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <input
          type="date"
          value={datum}
          onChange={(e) => setDatum(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm"
        />
        <span className="text-sm text-muted">
          {wochentagKurz(datum)} {formatDatumKurz(datum)}
        </span>
      </div>

      {tische.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">
          Noch keine Tische angelegt – im Tab &quot;Tische&quot; mindestens einen anlegen, sonst kann niemand buchen.
        </p>
      )}

      {laden ? (
        <p className="text-sm text-muted">Lade…</p>
      ) : aktive.length === 0 ? (
        <p className="text-sm text-muted">Keine Reservierungen an diesem Tag.</p>
      ) : (
        <ul className="space-y-2">
          {aktive.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{r.uhrzeit} Uhr · {r.name}</p>
                  <p className="text-xs text-muted">{r.anzahlPersonen} Personen · {r.email}</p>
                </div>
                <span className={cn('text-xs font-semibold', STATUS_FARBE[r.status])}>
                  {RESERVIERUNG_STATUS_LABEL[r.status]}
                </span>
              </div>
              {r.notiz && <p className="mt-1 text-xs text-muted">{r.notiz}</p>}

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  value={r.tischId ?? ''}
                  onChange={(e) => tischZuweisen(r.id, e.target.value)}
                  className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
                >
                  <option value="">Kein Tisch zugewiesen</option>
                  {tische.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.kapazitaet} Plätze)
                    </option>
                  ))}
                </select>

                {(Object.keys(RESERVIERUNG_STATUS_LABEL) as ReservierungStatus[])
                  .filter((s) => s !== r.status)
                  .map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => statusAendern(r.id, s)}
                      className="rounded-lg bg-background px-2 py-1 text-xs font-medium text-muted"
                    >
                      {RESERVIERUNG_STATUS_LABEL[s]}
                    </button>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      <NeueReservierung datum={datum} onAngelegt={(r) => setReservierungen((prev) => [...prev, r])} />
    </div>
  )
}
