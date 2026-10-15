'use client'

import { useState, useTransition } from 'react'
import { customDomainSpeichernAktion } from './actions'

export default function DomainEinstellungen({
  subdomain,
  anfangsCustomDomain,
}: {
  subdomain: string | null
  anfangsCustomDomain: string | null
}) {
  const [customDomain, setCustomDomain] = useState(anfangsCustomDomain ?? '')
  const [gespeichert, setGespeichert] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function speichern() {
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await customDomainSpeichernAktion(customDomain)
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler)
        return
      }
      setGespeichert(true)
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold">Plattform-Subdomain</h3>
        <p className="text-sm text-muted">{subdomain ?? 'Noch keine Subdomain zugewiesen – bitte beim Plattform-Admin melden.'}</p>
        <p className="mt-2 text-xs text-muted">Funktioniert sofort, keine weiteren Schritte nötig.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold">Eigene Domain (optional)</h3>
        {fehler && <p className="mb-2 text-sm text-danger">{fehler}</p>}
        <input
          value={customDomain}
          onChange={(e) => {
            setCustomDomain(e.target.value)
            setGespeichert(false)
          }}
          placeholder="z. B. musterbetrieb.de"
          className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={speichern}
          disabled={pending || gespeichert}
          className="mt-3 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground disabled:opacity-40"
        >
          {pending ? 'Speichert…' : gespeichert ? 'Gespeichert' : 'Speichern'}
        </button>
        <p className="mt-3 text-xs text-muted">
          Nach dem Eintragen hier bitte kurz bei uns melden – wir richten eure Domain dann auf unserer Seite ein.
          Danach müsst ihr bei eurem Domain-Anbieter noch einen DNS-Eintrag setzen (welchen genau, sagen wir euch dann).
          Bis beides erledigt ist, erreichen Gäste die Website weiterhin über eure Subdomain.
        </p>
      </div>
    </div>
  )
}
