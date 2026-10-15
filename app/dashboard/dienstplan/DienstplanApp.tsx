'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import DemoBanner from '@/app/dashboard/DemoBanner'
import { mitarbeiterNamenLadenAktion } from './actions'
import WochenPlan from './WochenPlan'
import VerfuegbarkeitAnsicht from './VerfuegbarkeitAnsicht'
import TeamVerfuegbarkeit from './TeamVerfuegbarkeit'
import TauschBoerse from './TauschBoerse'
import ExportAnsicht from './ExportAnsicht'
import type { Mitarbeiter } from '@/lib/mitarbeiter/types'
import { cn } from '@/lib/utils'

type Ansicht = 'plan' | 'verfuegbarkeit' | 'team' | 'tausch' | 'export'

// Das Verwaltungskonto plant, bestätigt Tausch und sieht die
// Team-Verfügbarkeit; Mitarbeitende (Tresen per PIN oder eigenes Handy)
// sehen den Plan, tragen ihre Verfügbarkeit ein und nutzen die Tauschbörse.
export default function DienstplanApp({
  freigeschaltet,
  verwaltung,
  mitarbeiter,
}: {
  freigeschaltet: boolean
  verwaltung: boolean
  mitarbeiter: Mitarbeiter | null
}) {
  const [ansicht, setAnsicht] = useState<Ansicht>('plan')
  const [mitarbeiterNamen, setMitarbeiterNamen] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    mitarbeiterNamenLadenAktion().then(setMitarbeiterNamen)
  }, [])

  const tabs: { key: Ansicht; label: string }[] = [
    { key: 'plan', label: 'Wochenplan' },
    ...(mitarbeiter ? [{ key: 'verfuegbarkeit' as const, label: 'Verfügbarkeit' }] : []),
    ...(verwaltung ? [{ key: 'team' as const, label: 'Team-Verfügbarkeit' }] : []),
    { key: 'tausch', label: 'Tausch-Börse' },
    ...(verwaltung ? [{ key: 'export' as const, label: 'Export' }] : []),
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

        {mitarbeiter && <p className="mb-4 text-sm text-muted">{mitarbeiter.name}</p>}

        {ansicht === 'plan' && <WochenPlan mitarbeiter={mitarbeiter} verwaltung={verwaltung} mitarbeiterNamen={mitarbeiterNamen} />}
        {ansicht === 'verfuegbarkeit' && mitarbeiter && <VerfuegbarkeitAnsicht mitarbeiter={mitarbeiter} />}
        {ansicht === 'team' && verwaltung && <TeamVerfuegbarkeit mitarbeiterNamen={mitarbeiterNamen} />}
        {ansicht === 'tausch' && <TauschBoerse mitarbeiter={mitarbeiter} verwaltung={verwaltung} mitarbeiterNamen={mitarbeiterNamen} />}
        {ansicht === 'export' && verwaltung && <ExportAnsicht />}
      </main>
    </>
  )
}
