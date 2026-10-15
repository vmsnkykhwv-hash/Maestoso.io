'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Copy } from 'lucide-react'
import DemoBanner from '@/app/dashboard/DemoBanner'
import BestellListe from './BestellListe'
import BestellEinstellungenForm from './BestellEinstellungenForm'
import Auswertung from './Auswertung'
import type { BestellEinstellungen } from '@/lib/bestellung/types'
import { cn } from '@/lib/utils'

type Ansicht = 'bestellungen' | 'auswertung' | 'einstellungen'

function BestellLink({ link }: { link: string }) {
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
      <span className="truncate">Bestelllink für eure Website: {link}</span>
      {kopiert ? <Check className="h-3.5 w-3.5 flex-none text-success" /> : <Copy className="h-3.5 w-3.5 flex-none" />}
    </button>
  )
}

export default function BestellungApp({
  freigeschaltet,
  oeffentlicherLink,
  anfangsEinstellungen,
}: {
  freigeschaltet: boolean
  // Fertiger Link unter der Domain des Betriebs (lib/url.ts →
  // oeffentlicheUrl), nicht aus window.location gebaut: das Dashboard
  // läuft nicht unbedingt unter derselben Adresse wie die Gästeseiten.
  oeffentlicherLink: string
  anfangsEinstellungen: BestellEinstellungen
}) {
  const [ansicht, setAnsicht] = useState<Ansicht>('bestellungen')
  const [einstellungen, setEinstellungen] = useState(anfangsEinstellungen)

  return (
    <>
      {!freigeschaltet && <DemoBanner />}

      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <Link href="/dashboard" className="mb-4 flex items-center gap-1 text-sm text-muted">
          <ArrowLeft className="h-4 w-4" /> Zurück zu den Tools
        </Link>

        <BestellLink link={oeffentlicherLink} />

        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              { key: 'bestellungen', label: 'Bestellungen' },
              { key: 'auswertung', label: 'Auswertung' },
              { key: 'einstellungen', label: 'Einstellungen' },
            ] as const
          ).map((tab) => (
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

        {ansicht === 'bestellungen' && <BestellListe />}
        {ansicht === 'auswertung' && <Auswertung />}
        {ansicht === 'einstellungen' && <BestellEinstellungenForm einstellungen={einstellungen} onGespeichert={setEinstellungen} />}
      </main>
    </>
  )
}
