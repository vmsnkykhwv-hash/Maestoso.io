'use client'

import { useRef, useState, useTransition } from 'react'
import { Trash2, Upload } from 'lucide-react'
import { bildHochladenAktion, bildLoeschenAktion } from './actions'
import type { WebsiteBild } from '@/lib/website/types'

export default function BilderVerwaltung({
  heroBild,
  galerie,
  onHeroBildAendern,
  onGalerieAendern,
}: {
  heroBild: WebsiteBild | null
  galerie: WebsiteBild[]
  onHeroBildAendern: (bild: WebsiteBild | null) => void
  onGalerieAendern: (galerie: WebsiteBild[]) => void
}) {
  const [fehler, setFehler] = useState<string | null>(null)
  const [heroPending, startHero] = useTransition()
  const [galeriePending, startGalerie] = useTransition()
  const heroInput = useRef<HTMLInputElement>(null)
  const galerieInput = useRef<HTMLInputElement>(null)

  function heroHochladen(datei: File | undefined) {
    if (!datei) return
    setFehler(null)
    startHero(async () => {
      const ergebnis = await bildHochladenAktion(datei, 'hero')
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler)
        return
      }
      if (ergebnis.bild) onHeroBildAendern(ergebnis.bild)
    })
  }

  function heroLoeschen() {
    if (!heroBild) return
    onHeroBildAendern(null)
    startHero(async () => {
      await bildLoeschenAktion(heroBild.id)
    })
  }

  function galerieHochladen(datei: File | undefined) {
    if (!datei) return
    setFehler(null)
    startGalerie(async () => {
      const ergebnis = await bildHochladenAktion(datei, 'galerie')
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler)
        return
      }
      if (ergebnis.bild) onGalerieAendern([...galerie, ergebnis.bild])
    })
  }

  function galerieBildLoeschen(id: string) {
    onGalerieAendern(galerie.filter((b) => b.id !== id))
    startGalerie(async () => {
      await bildLoeschenAktion(id)
    })
  }

  return (
    <div className="space-y-4">
      {fehler && <p className="text-sm text-danger">{fehler}</p>}

      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Hero-Bild (oben auf der Startseite)</h3>
        {heroBild && (
          // eslint-disable-next-line @next/next/no-img-element -- extern aus Supabase Storage, kein lokaler Next-Image-Pfad
          <img src={heroBild.url} alt="Hero" className="mb-3 h-40 w-full rounded-xl object-cover" />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => heroInput.current?.click()}
            disabled={heroPending}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent py-2 text-xs font-semibold text-accent-foreground disabled:opacity-40"
          >
            <Upload className="h-3.5 w-3.5" /> {heroPending ? 'Lädt…' : heroBild ? 'Ersetzen' : 'Hochladen'}
          </button>
          {heroBild && (
            <button type="button" onClick={heroLoeschen} className="rounded-lg bg-background px-3 py-2 text-xs font-medium text-danger">
              Entfernen
            </button>
          )}
        </div>
        <input
          ref={heroInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => heroHochladen(e.target.files?.[0])}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Galerie ({galerie.length}/12)</h3>
        {galerie.length > 0 && (
          <div className="mb-3 grid grid-cols-3 gap-2">
            {galerie.map((bild) => (
              <div key={bild.id} className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- extern aus Supabase Storage */}
                <img src={bild.url} alt="Galerie" className="h-20 w-full rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => galerieBildLoeschen(bild.id)}
                  aria-label="Bild löschen"
                  className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-danger"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => galerieInput.current?.click()}
          disabled={galeriePending || galerie.length >= 12}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs font-medium text-muted disabled:opacity-40"
        >
          <Upload className="h-3.5 w-3.5" /> {galeriePending ? 'Lädt…' : 'Bild hinzufügen'}
        </button>
        <input
          ref={galerieInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            galerieHochladen(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
