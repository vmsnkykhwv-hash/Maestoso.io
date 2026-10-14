'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Copy, ExternalLink } from 'lucide-react'
import DemoBanner from '@/app/dashboard/DemoBanner'
import WebsiteInhaltForm from './WebsiteInhaltForm'
import SpeisekarteVerwaltung from './SpeisekarteVerwaltung'
import BilderVerwaltung from './BilderVerwaltung'
import DomainEinstellungen from './DomainEinstellungen'
import type { MenuEintrag, MenuKategorie, WebsiteBild, WebsiteInhalt } from '@/lib/website/types'
import { cn } from '@/lib/utils'

type Ansicht = 'inhalt' | 'speisekarte' | 'bilder' | 'domain'

function websiteLink(organisationId: string, subdomain: string | null): string {
  const plattformDomain = process.env.NEXT_PUBLIC_PLATTFORM_DOMAIN
  if (plattformDomain && subdomain) return `https://${subdomain}.${plattformDomain}`
  if (typeof window !== 'undefined') return `${window.location.origin}/website/${organisationId}`
  return `/website/${organisationId}`
}

function WebsiteLink({ organisationId, subdomain }: { organisationId: string; subdomain: string | null }) {
  const [kopiert, setKopiert] = useState(false)
  const link = websiteLink(organisationId, subdomain)

  return (
    <div className="mb-4 flex items-center gap-2">
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(link).then(() => {
            setKopiert(true)
            setTimeout(() => setKopiert(false), 2000)
          })
        }}
        className="flex flex-1 items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 text-left text-xs text-muted"
      >
        <span className="truncate">Eure Website: {link}</span>
        {kopiert ? <Check className="h-3.5 w-3.5 flex-none text-success" /> : <Copy className="h-3.5 w-3.5 flex-none" />}
      </button>
      <a
        href={`/website/${organisationId}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Vorschau in neuem Tab öffnen"
        className="flex-none rounded-xl border border-border bg-card p-2.5 text-muted"
      >
        <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  )
}

export default function WebsiteApp({
  organisationId,
  freigeschaltet,
  anfangsInhalt,
  anfangsHeroBild,
  anfangsGalerie,
  anfangsKategorien,
  anfangsEintraege,
  subdomain,
  customDomain,
}: {
  organisationId: string
  freigeschaltet: boolean
  anfangsInhalt: WebsiteInhalt
  anfangsHeroBild: WebsiteBild | null
  anfangsGalerie: WebsiteBild[]
  anfangsKategorien: MenuKategorie[]
  anfangsEintraege: MenuEintrag[]
  subdomain: string | null
  customDomain: string | null
}) {
  const [ansicht, setAnsicht] = useState<Ansicht>('inhalt')
  const [inhalt, setInhalt] = useState(anfangsInhalt)
  const [heroBild, setHeroBild] = useState(anfangsHeroBild)
  const [galerie, setGalerie] = useState(anfangsGalerie)
  const [kategorien, setKategorien] = useState(anfangsKategorien)
  const [eintraege, setEintraege] = useState(anfangsEintraege)

  return (
    <>
      {!freigeschaltet && <DemoBanner />}

      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <Link href="/dashboard" className="mb-4 flex items-center gap-1 text-sm text-muted">
          <ArrowLeft className="h-4 w-4" /> Zurück zu den Tools
        </Link>

        <WebsiteLink organisationId={organisationId} subdomain={subdomain} />

        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              { key: 'inhalt', label: 'Inhalt' },
              { key: 'speisekarte', label: 'Speisekarte' },
              { key: 'bilder', label: 'Bilder' },
              { key: 'domain', label: 'Domain' },
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

        {ansicht === 'inhalt' && <WebsiteInhaltForm inhalt={inhalt} onGespeichert={setInhalt} />}
        {ansicht === 'speisekarte' && (
          <SpeisekarteVerwaltung kategorien={kategorien} eintraege={eintraege} onKategorienAendern={setKategorien} onEintraegenAendern={setEintraege} />
        )}
        {ansicht === 'bilder' && (
          <BilderVerwaltung heroBild={heroBild} galerie={galerie} onHeroBildAendern={setHeroBild} onGalerieAendern={setGalerie} />
        )}
        {ansicht === 'domain' && <DomainEinstellungen subdomain={subdomain} anfangsCustomDomain={customDomain} />}
      </main>
    </>
  )
}
