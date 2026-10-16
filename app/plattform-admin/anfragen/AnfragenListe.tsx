'use client'

import { useState, useTransition } from 'react'
import { ANFRAGE_ART_LABEL, ANFRAGE_STATUS_LABEL, TAGESZEIT_LABEL, type Anfrage, type AnfrageStatus } from '@/lib/anfragen/daten'
import { anfrageAktualisierenAktion } from './actions'

const STATUS_FARBE: Record<AnfrageStatus, string> = {
  neu: 'bg-accent-soft text-locked',
  in_bearbeitung: 'bg-card-dim text-foreground',
  erledigt: 'bg-success-bg text-success',
}

function datum(iso: string) {
  return new Date(iso).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function AnfragenListe({ anfangs }: { anfangs: Anfrage[] }) {
  const [anfragen, setAnfragen] = useState(anfangs)
  const [filter, setFilter] = useState<AnfrageStatus | 'alle'>('alle')
  const [pending, startTransition] = useTransition()

  function aendern(id: string, patch: { status?: AnfrageStatus; notiz?: string }) {
    setAnfragen((liste) => liste.map((a) => (a.id === id ? { ...a, ...patch } : a)))
    startTransition(async () => {
      await anfrageAktualisierenAktion(id, patch)
    })
  }

  const sichtbar = anfragen.filter((a) => filter === 'alle' || a.status === filter)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(['alle', 'neu', 'in_bearbeitung', 'erledigt'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${filter === s ? 'bg-accent text-accent-foreground' : 'bg-card text-muted'}`}
          >
            {s === 'alle' ? 'Alle' : ANFRAGE_STATUS_LABEL[s]} ({s === 'alle' ? anfragen.length : anfragen.filter((a) => a.status === s).length})
          </button>
        ))}
      </div>
      {sichtbar.length === 0 && <p className="text-sm text-muted">Keine Anfragen.</p>}
      <ul className="space-y-3">
        {sichtbar.map((a) => (
          <li key={a.id} className="space-y-2 rounded-2xl border border-border bg-card p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">
                  {ANFRAGE_ART_LABEL[a.art]} · {a.name}
                  {a.betrieb ? ` · ${a.betrieb}` : ''}
                </p>
                <p className="text-xs text-muted">{datum(a.erstelltAt)}</p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_FARBE[a.status]}`}>{ANFRAGE_STATUS_LABEL[a.status]}</span>
            </div>
            <p className="break-words">
              <a href={`mailto:${a.email}`} className="underline">{a.email}</a>
              {a.telefon && <> · <a href={`tel:${a.telefon}`} className="underline">{a.telefon}</a></>}
            </p>
            {a.wunschtag && (
              <p>
                Wunschtermin:{' '}
                {new Date(a.wunschtag + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                {a.tageszeit ? `, ${TAGESZEIT_LABEL[a.tageszeit]}` : ''}
              </p>
            )}
            {a.nachricht && <p className="whitespace-pre-wrap rounded-xl bg-background p-3">{a.nachricht}</p>}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <select
                value={a.status}
                disabled={pending}
                onChange={(e) => aendern(a.id, { status: e.target.value as AnfrageStatus })}
                className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
                aria-label="Status"
              >
                {(Object.keys(ANFRAGE_STATUS_LABEL) as AnfrageStatus[]).map((s) => (
                  <option key={s} value={s}>{ANFRAGE_STATUS_LABEL[s]}</option>
                ))}
              </select>
              <input
                defaultValue={a.notiz ?? ''}
                onBlur={(e) => e.target.value !== (a.notiz ?? '') && aendern(a.id, { notiz: e.target.value })}
                placeholder="Notiz (nur für dich)"
                className="min-w-48 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
