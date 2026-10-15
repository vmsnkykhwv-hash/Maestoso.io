'use client'

import { useState, useTransition } from 'react'
import type { Mitarbeiter } from '@/lib/mitarbeiter/types'
import { HANDY_MODULE, MITARBEITER_MODULE } from '@/lib/mitarbeiter/types'
import { MODULE, type ModulSchluessel } from '@/lib/module'
import { handyKoppelnAktion, mitarbeiterModuleSetzenAktion } from './actions'

const NAME = Object.fromEntries(MODULE.map((m) => [m.schluessel, m.kurzname])) as Record<ModulSchluessel, string>

function MitarbeiterZeile({ mitarbeiter }: { mitarbeiter: Mitarbeiter }) {
  const [module, setModule] = useState(mitarbeiter.module)
  const [kopplung, setKopplung] = useState<{ link: string; qrSvg: string } | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function umschalten(modul: ModulSchluessel) {
    const neu = module.includes(modul) ? module.filter((m) => m !== modul) : [...module, modul]
    setModule(neu)
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await mitarbeiterModuleSetzenAktion(mitarbeiter.id, neu)
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler)
        setModule(module)
      }
    })
  }

  function koppeln() {
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await handyKoppelnAktion(mitarbeiter.id)
      if (ergebnis.fehler || !ergebnis.link) return setFehler(ergebnis.fehler ?? 'Fehler')
      setKopplung({ link: ergebnis.link, qrSvg: ergebnis.qrSvg! })
    })
  }

  return (
    <li className="space-y-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{mitarbeiter.name}</span>
        <button type="button" disabled={pending} onClick={koppeln} className="text-xs underline">
          Handy koppeln
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {MITARBEITER_MODULE.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => umschalten(m)}
            className={`rounded-full px-2.5 py-1 text-xs ${module.includes(m) ? 'bg-success-bg text-success' : 'bg-card-dim text-muted'}`}
            title={HANDY_MODULE.includes(m) ? 'Am Tresen und auf dem gekoppelten Handy' : 'Nur am Tresen'}
          >
            {NAME[m]}
            {HANDY_MODULE.includes(m) ? ' · auch Handy' : ''}
          </button>
        ))}
      </div>
      {fehler && <p className="text-xs text-danger">{fehler}</p>}
      {kopplung && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border p-3 text-center">
          <p className="text-xs text-muted">
            Mit dem Handy von {mitarbeiter.name} scannen (15 Minuten gültig). Zur Bestätigung braucht es dort die eigene PIN.
          </p>
          <div className="w-[200px] rounded-lg bg-white p-2" dangerouslySetInnerHTML={{ __html: kopplung.qrSvg }} />
          <p className="break-all font-mono text-[10px] text-muted">{kopplung.link}</p>
        </div>
      )}
    </li>
  )
}

export default function Mitarbeitende({ mitarbeiter }: { mitarbeiter: Mitarbeiter[] }) {
  const aktive = mitarbeiter.filter((m) => m.aktiv)
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold">Mitarbeitende: Tools & Handys</h2>
        <p className="text-xs text-muted">
          Grün = freigeschaltet. Am Tresen sieht jede Person nach ihrer PIN nur ihre Tools. Auf dem eigenen Handy gibt es
          nur Dienstplan (inkl. Verfügbarkeit und Tauschbörse) und die eigenen Zeiten zum Ansehen. Mitarbeitende legst du
          in der Zeiterfassung an.
        </p>
      </div>
      {aktive.length === 0 ? (
        <p className="text-xs text-muted">Noch keine Mitarbeitenden angelegt.</p>
      ) : (
        <ul className="space-y-3">
          {aktive.map((m) => (
            <MitarbeiterZeile key={m.id} mitarbeiter={m} />
          ))}
        </ul>
      )}
    </div>
  )
}
