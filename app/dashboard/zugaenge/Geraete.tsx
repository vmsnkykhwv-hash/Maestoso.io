'use client'

import { useState, useTransition } from 'react'
import { MonitorSmartphone, Smartphone } from 'lucide-react'
import type { Geraet } from '@/lib/geraete/daten'
import { geraetEntziehenAktion, tresenFreigebenAktion } from './actions'

function datum(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–'
}

export default function Geraete({
  anfangsGeraete,
  mitarbeiterNamen,
  diesesGeraetId,
}: {
  anfangsGeraete: Geraet[]
  mitarbeiterNamen: Record<string, string>
  diesesGeraetId: string | null
}) {
  const [geraete, setGeraete] = useState(anfangsGeraete)
  const [name, setName] = useState('Tresen')
  const [fehler, setFehler] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [diesesGeraet, setDiesesGeraet] = useState(diesesGeraetId)

  function ausfuehren(aktion: () => Promise<{ fehler?: string; geraete?: Geraet[] }>, danach?: (g: Geraet[]) => void) {
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await aktion()
      if (ergebnis.fehler) return setFehler(ergebnis.fehler)
      if (ergebnis.geraete) {
        setGeraete(ergebnis.geraete)
        danach?.(ergebnis.geraete)
      }
    })
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold">Geräte</h2>
        <p className="text-xs text-muted">
          Tresen-Geräte bleiben dauerhaft angemeldet; wer daran arbeitet, meldet sich mit seiner PIN an. Nur dort laufen
          Reservierungen, Bestellungen, Gutscheine und das Erfassen der Arbeitszeit. Handys koppelst du unten bei den
          Mitarbeitenden.
        </p>
      </div>
      {fehler && <p className="text-xs text-danger">{fehler}</p>}

      <ul className="space-y-2 text-sm">
        {geraete.length === 0 && <li className="text-xs text-muted">Noch kein Gerät freigegeben.</li>}
        {geraete.map((g) => (
          <li key={g.id} className="flex flex-wrap items-center gap-2">
            {g.art === 'tresen' ? <MonitorSmartphone className="h-4 w-4 text-accent" /> : <Smartphone className="h-4 w-4 text-muted" />}
            <span className="font-medium">{g.name}</span>
            <span className="text-xs text-muted">
              {g.art === 'tresen' ? 'Tresen' : `Handy von ${mitarbeiterNamen[g.mitarbeiterId ?? ''] ?? '?'}`} · seit {datum(g.erstelltAt)} ·
              zuletzt aktiv {datum(g.zuletztGesehenAt)}
            </span>
            {g.id === diesesGeraet && <span className="text-xs text-success">(dieses Gerät)</span>}
            <button type="button" disabled={pending} onClick={() => ausfuehren(() => geraetEntziehenAktion(g.id))} className="text-xs text-danger underline">
              Entziehen
            </button>
          </li>
        ))}
      </ul>

      {!diesesGeraet && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name, z. B. Tablet Tresen"
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              ausfuehren(
                () => tresenFreigebenAktion(name),
                (liste) => setDiesesGeraet(liste[liste.length - 1]?.id ?? null)
              )
            }
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground disabled:opacity-40"
          >
            Dieses Gerät als Tresen freigeben
          </button>
          <p className="w-full text-xs text-muted">
            Danach kannst du dich hier abmelden – das Gerät bleibt freigegeben und zeigt die PIN-Anmeldung.
          </p>
        </div>
      )}
    </div>
  )
}
