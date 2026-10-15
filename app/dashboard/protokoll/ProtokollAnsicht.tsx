'use client'

import { useState, useTransition } from 'react'
import { MonitorSmartphone, Smartphone, UserRound } from 'lucide-react'
import { PROTOKOLL_MODUL_LABEL, type ProtokollEintrag, type ProtokollModul } from '@/lib/protokollTypen'
import { protokollLadenAktion } from './actions'

const SEITENGROESSE = 100

const AKTEUR_ICON = { inhaber: UserRound, tresen: MonitorSmartphone, handy: Smartphone } as const

function zeitpunkt(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ProtokollAnsicht({ anfangsEintraege }: { anfangsEintraege: ProtokollEintrag[] }) {
  const [eintraege, setEintraege] = useState(anfangsEintraege)
  const [modul, setModul] = useState<ProtokollModul | ''>('')
  const [mehr, setMehr] = useState(anfangsEintraege.length === SEITENGROESSE)
  const [pending, startTransition] = useTransition()

  function filtern(neu: ProtokollModul | '') {
    setModul(neu)
    startTransition(async () => {
      const liste = await protokollLadenAktion({ modul: neu || undefined })
      setEintraege(liste)
      setMehr(liste.length === SEITENGROESSE)
    })
  }

  function aeltereLaden() {
    const letzter = eintraege[eintraege.length - 1]
    if (!letzter) return
    startTransition(async () => {
      const liste = await protokollLadenAktion({ modul: modul || undefined, vor: letzter.zeitpunkt })
      setEintraege((prev) => [...prev, ...liste])
      setMehr(liste.length === SEITENGROESSE)
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Wer hat wann was geändert – Verwaltungskonten, Mitarbeitende am Tresen (per PIN) und gekoppelte Handys. Einträge
        lassen sich nicht bearbeiten oder löschen.
      </p>
      <select
        value={modul}
        onChange={(e) => filtern(e.target.value as ProtokollModul | '')}
        className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm"
      >
        <option value="">Alle Bereiche</option>
        {(Object.keys(PROTOKOLL_MODUL_LABEL) as ProtokollModul[]).map((m) => (
          <option key={m} value={m}>
            {PROTOKOLL_MODUL_LABEL[m]}
          </option>
        ))}
      </select>

      {eintraege.length === 0 ? (
        <p className="text-sm text-muted">{pending ? 'Lade…' : 'Noch keine Einträge.'}</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {eintraege.map((e) => {
            const Icon = AKTEUR_ICON[e.akteurArt]
            return (
              <li key={e.id} className="flex gap-3 p-3 text-sm">
                <Icon className="mt-0.5 h-4 w-4 flex-none text-muted" />
                <div className="min-w-0 flex-1">
                  <p>
                    <span className="font-medium">{e.akteurName}</span> · {e.aktion}
                  </p>
                  {e.details && <p className="text-xs text-muted">{e.details}</p>}
                </div>
                <div className="flex-none text-right text-xs text-muted">
                  <p>{zeitpunkt(e.zeitpunkt)}</p>
                  <p>{PROTOKOLL_MODUL_LABEL[e.modul] ?? e.modul}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {mehr && (
        <button type="button" onClick={aeltereLaden} disabled={pending} className="w-full rounded-xl border border-border py-2 text-sm disabled:opacity-40">
          {pending ? 'Lade…' : 'Ältere laden'}
        </button>
      )}
    </div>
  )
}
