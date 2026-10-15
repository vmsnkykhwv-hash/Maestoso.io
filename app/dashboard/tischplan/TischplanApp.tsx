'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Copy } from 'lucide-react'
import DemoBanner from '@/app/dashboard/DemoBanner'
import ReservierungsListe from './ReservierungsListe'
import TischeVerwaltung from './TischeVerwaltung'
import Blockierungen from './Blockierungen'
import Ausnahmen from './Ausnahmen'
import Einstellungen from './Einstellungen'
import Auswertung from './Auswertung'
import type { Einstellungen as EinstellungenTyp, Tisch } from '@/lib/tischplan/types'
import { cn } from '@/lib/utils'

type Ansicht = 'reservierungen' | 'tische' | 'blockierungen' | 'ausnahmen' | 'auswertung' | 'einstellungen'

function BuchungsLink({ link }: { link: string }) {
  const [kopiert, setKopiert] = useState(false)

  return (
    <button
      type="button"
      onClick={() => {
        if (!link) return
        navigator.clipboard.writeText(link).then(() => {
          setKopiert(true)
          setTimeout(() => setKopiert(false), 2000)
        })
      }}
      className="mb-4 flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 text-left text-xs text-muted"
    >
      <span className="truncate">Buchungslink für eure Website: {link}</span>
      {kopiert ? <Check className="h-3.5 w-3.5 flex-none text-success" /> : <Copy className="h-3.5 w-3.5 flex-none" />}
    </button>
  )
}

export default function TischplanApp({
  darfVerwalten,
  freigeschaltet,
  oeffentlicherLink,
  anfangsEinstellungen,
  anfangsTische,
}: {
  // Verwaltungskonto (Inhaber*in) – sonst Tresen: keine Einstellungen/Auswertungen.
  darfVerwalten: boolean
  freigeschaltet: boolean
  // Fertiger Link unter der Domain des Betriebs (lib/url.ts →
  // oeffentlicheUrl), nicht aus window.location gebaut: das Dashboard
  // läuft nicht unbedingt unter derselben Adresse wie die Gästeseiten.
  oeffentlicherLink: string
  anfangsEinstellungen: EinstellungenTyp
  anfangsTische: Tisch[]
}) {
  const [ansicht, setAnsicht] = useState<Ansicht>('reservierungen')
  const [tische, setTische] = useState(anfangsTische)
  const [einstellungen, setEinstellungen] = useState(anfangsEinstellungen)

  return (
    <>
      {!freigeschaltet && <DemoBanner />}

      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <Link href="/dashboard" className="mb-4 flex items-center gap-1 text-sm text-muted">
          <ArrowLeft className="h-4 w-4" /> Zurück zu den Tools
        </Link>

        <BuchungsLink link={oeffentlicherLink} />

        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              { key: 'reservierungen', label: 'Reservierungen' },
              { key: 'tische', label: 'Tische', verwaltung: true },
              { key: 'blockierungen', label: 'Blockierungen' },
              { key: 'ausnahmen', label: 'Ausnahmen', verwaltung: true },
              { key: 'auswertung', label: 'Auswertung', verwaltung: true },
              { key: 'einstellungen', label: 'Einstellungen', verwaltung: true },
            ] as const
          )
            .filter((tab) => darfVerwalten || !('verwaltung' in tab))
            .map((tab) => (
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

        {ansicht === 'reservierungen' && <ReservierungsListe tische={tische} />}
        {ansicht === 'tische' && <TischeVerwaltung tische={tische} onAendern={setTische} />}
        {ansicht === 'blockierungen' && <Blockierungen />}
        {ansicht === 'ausnahmen' && <Ausnahmen />}
        {ansicht === 'auswertung' && <Auswertung />}
        {ansicht === 'einstellungen' && <Einstellungen einstellungen={einstellungen} onGespeichert={setEinstellungen} />}
      </main>
    </>
  )
}
