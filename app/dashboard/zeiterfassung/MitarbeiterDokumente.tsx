'use client'

import { useEffect, useState, useTransition } from 'react'
import { Download, Trash2, Upload } from 'lucide-react'
import { dokumentHochladenAktion, dokumentLoeschenAktion, dokumenteLadenAktion } from './actions'
import type { MitarbeiterDokument } from '@/lib/zeiterfassung/types'

function formatGroesse(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function MitarbeiterDokumente({ mitarbeiterId }: { mitarbeiterId: string }) {
  const [dokumente, setDokumente] = useState<MitarbeiterDokument[]>([])
  const [laden, startLaden] = useTransition()
  const [hochladenPending, startHochladen] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)

  useEffect(() => {
    startLaden(async () => {
      setDokumente(await dokumenteLadenAktion(mitarbeiterId))
    })
  }, [mitarbeiterId])

  function hochladen(e: React.ChangeEvent<HTMLInputElement>) {
    const datei = e.target.files?.[0]
    e.target.value = ''
    if (!datei) return
    setFehler(null)
    startHochladen(async () => {
      const ergebnis = await dokumentHochladenAktion(mitarbeiterId, datei)
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler)
        return
      }
      if (ergebnis.dokument) setDokumente((prev) => [ergebnis.dokument!, ...prev])
    })
  }

  function loeschen(id: string) {
    setDokumente((prev) => prev.filter((d) => d.id !== id))
    void dokumentLoeschenAktion(id)
  }

  return (
    <div className="mt-2 rounded-xl border border-border bg-background p-3">
      {laden ? (
        <p className="text-xs text-muted">Lade…</p>
      ) : dokumente.length === 0 ? (
        <p className="text-xs text-muted">Noch keine Dokumente hinterlegt.</p>
      ) : (
        <ul className="space-y-1.5">
          {dokumente.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 text-xs">
              <a href={`/dashboard/zeiterfassung/dokumente/${d.id}`} className="flex items-center gap-1.5 text-foreground">
                <Download className="h-3 w-3 flex-none" /> {d.dateiname} ({formatGroesse(d.groesseBytes)})
              </a>
              <button type="button" onClick={() => loeschen(d.id)} aria-label="Dokument löschen" className="flex-none text-muted">
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {fehler && <p className="mt-2 text-xs font-medium text-danger">{fehler}</p>}

      <label className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-card py-1.5 text-xs font-medium text-muted">
        <Upload className="h-3 w-3" />
        {hochladenPending ? 'Lädt hoch…' : 'Dokument hochladen'}
        <input type="file" accept="application/pdf,image/*" className="hidden" onChange={hochladen} disabled={hochladenPending} />
      </label>
    </div>
  )
}
