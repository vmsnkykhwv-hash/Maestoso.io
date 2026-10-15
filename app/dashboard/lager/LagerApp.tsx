'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import DemoBanner from '@/app/dashboard/DemoBanner'
import { mitarbeiterNamenLadenAktion, pruefungenSicherstellenAktion } from './actions'
import MeinePruefungen from './MeinePruefungen'
import LieferantenVerwaltung from './LieferantenVerwaltung'
import ArtikelVerwaltung from './ArtikelVerwaltung'
import PruefungenUebersicht from './PruefungenUebersicht'
import BestellungUebersicht from './BestellungUebersicht'
import type { Mitarbeiter } from '@/lib/mitarbeiter/types'
import { cn } from '@/lib/utils'

type Ansicht = 'meine-pruefungen' | 'lieferanten' | 'artikel' | 'pruefungen' | 'bestellung'

// Das Verwaltungskonto pflegt Lieferanten/Artikel, weist zu und bestellt;
// Mitarbeitende erledigen am Tresen (per PIN) die ihnen zugewiesenen
// Prüfungen.
export default function LagerApp({
  freigeschaltet,
  verwaltung,
  mitarbeiter,
}: {
  freigeschaltet: boolean
  verwaltung: boolean
  mitarbeiter: Mitarbeiter | null
}) {
  const [ansicht, setAnsicht] = useState<Ansicht>(verwaltung ? 'pruefungen' : 'meine-pruefungen')
  const [mitarbeiterNamen, setMitarbeiterNamen] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    pruefungenSicherstellenAktion()
    mitarbeiterNamenLadenAktion().then(setMitarbeiterNamen)
  }, [])

  const tabs: { key: Ansicht; label: string }[] = [
    ...(mitarbeiter ? [{ key: 'meine-pruefungen' as const, label: 'Meine Prüfungen' }] : []),
    ...(verwaltung
      ? [
          { key: 'pruefungen' as const, label: 'Prüfungen' },
          { key: 'lieferanten' as const, label: 'Lieferanten' },
          { key: 'artikel' as const, label: 'Artikel' },
          { key: 'bestellung' as const, label: 'Bestellung' },
        ]
      : []),
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

        {ansicht === 'meine-pruefungen' && mitarbeiter && <MeinePruefungen mitarbeiterId={mitarbeiter.id} />}
        {ansicht === 'lieferanten' && verwaltung && <LieferantenVerwaltung />}
        {ansicht === 'artikel' && verwaltung && <ArtikelVerwaltung />}
        {ansicht === 'pruefungen' && verwaltung && <PruefungenUebersicht mitarbeiterNamen={mitarbeiterNamen} />}
        {ansicht === 'bestellung' && verwaltung && <BestellungUebersicht />}
      </main>
    </>
  )
}
