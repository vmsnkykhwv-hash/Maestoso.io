'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, CircleAlert } from 'lucide-react'
import type { DomainStatus } from '@/lib/vercel/domains'
import { domainEntfernenAktion, domainStatusAktion, domainVerbindenAktion } from './actions'

// Drei Wege, wie eine Domain zu Maestoso kommt – am Ende landen alle beim
// selben Schritt "Verbinden", deshalb nur als Anleitung, nicht als getrennte
// Abläufe im Code.
const WEGE = [
  {
    titel: 'Kunde hat schon eine Domain und behält seinen Anbieter (einfachster Weg)',
    schritte: [
      'Domain unten eintragen und „Verbinden“ drücken.',
      '„Status prüfen“ zeigt die DNS-Einträge, die beim bisherigen Anbieter gesetzt werden müssen. Die schickst du dem Kunden oder trägst sie mit seinen Zugangsdaten selbst ein.',
      'E-Mail-Postfächer des Kunden bleiben unberührt, weil nur der Eintrag für die Website geändert wird.',
    ],
  },
  {
    titel: 'Domain zu Vercel umziehen',
    schritte: [
      'Beim bisherigen Anbieter den Auth-Code (Transfer-Code) anfordern. Den bekommt nur der Domaininhaber, das ist zugleich der Nachweis, dass sie ihm gehört.',
      'In Vercel unter Domains → „Transfer In“ den Umzug starten.',
      'Vorher die MX-Einträge (E-Mail) beim alten Anbieter notieren und bei Vercel wieder anlegen, sonst kommen keine Mails mehr an.',
      'Danach hier „Verbinden“ – DNS-Einträge sind dann meist automatisch korrekt.',
    ],
  },
  {
    titel: 'Neue Domain registrieren',
    schritte: [
      'In Vercel unter Domains → „Buy“ kaufen. Als Inhaber den Betrieb eintragen, damit die Domain rechtlich ihm gehört.',
      'Danach hier „Verbinden“ – da Vercel die DNS verwaltet, ist nichts weiter einzutragen.',
    ],
  },
]

export default function DomainVerwaltung({
  organisationId,
  anfangsDomain,
}: {
  organisationId: string
  anfangsDomain: string | null
}) {
  const [domain, setDomain] = useState(anfangsDomain)
  const [eingabe, setEingabe] = useState('')
  const [mitWww, setMitWww] = useState(true)
  const [status, setStatus] = useState<DomainStatus | null>(null)
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null)
  const [pending, startTransition] = useTransition()

  function verbinden() {
    setMeldung(null)
    startTransition(async () => {
      const ergebnis = await domainVerbindenAktion(organisationId, eingabe, mitWww)
      if (ergebnis.fehler || !ergebnis.domain) {
        setMeldung({ text: ergebnis.fehler ?? 'Verbinden fehlgeschlagen', fehler: true })
        return
      }
      setDomain(ergebnis.domain)
      setEingabe('')
      setStatus(null)
      setMeldung({ text: ergebnis.hinweis ?? 'Verbunden. Jetzt „Status prüfen“ für die DNS-Einträge.', fehler: !!ergebnis.hinweis })
    })
  }

  function pruefen() {
    setMeldung(null)
    startTransition(async () => {
      const ergebnis = await domainStatusAktion(organisationId)
      if (ergebnis.fehler) setMeldung({ text: ergebnis.fehler, fehler: true })
      setStatus(ergebnis.status ?? null)
    })
  }

  function entfernen() {
    setMeldung(null)
    startTransition(async () => {
      const ergebnis = await domainEntfernenAktion(organisationId)
      if (ergebnis.fehler) {
        setMeldung({ text: ergebnis.fehler, fehler: true })
        return
      }
      setDomain(null)
      setStatus(null)
    })
  }

  const fertig = status?.verifiziert && status.dnsKorrekt

  return (
    <div className="rounded-xl border border-border p-3 text-sm">
      <p className="mb-2 text-xs font-medium text-muted">Eigene Domain</p>

      {meldung && <p className={`mb-2 text-xs ${meldung.fehler ? 'text-danger' : 'text-success'}`}>{meldung.text}</p>}

      {domain ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{domain}</span>
            <button type="button" onClick={pruefen} disabled={pending} className="rounded-lg border border-border px-2.5 py-1 text-xs">
              Status prüfen
            </button>
            <button type="button" onClick={entfernen} disabled={pending} className="text-xs text-danger">
              Entfernen
            </button>
          </div>

          {status && (
            <div className="space-y-2">
              <p className={`flex items-center gap-1.5 text-xs font-medium ${fertig ? 'text-success' : 'text-locked'}`}>
                {fertig ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
                {fertig ? 'Fertig – die Website ist unter der Domain erreichbar.' : 'Noch nicht fertig – diese Einträge fehlen:'}
              </p>
              {status.fehlendeEintraege.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-muted">
                      <tr>
                        <th className="py-1 pr-3 font-medium">Typ</th>
                        <th className="py-1 pr-3 font-medium">Name</th>
                        <th className="py-1 pr-3 font-medium">Wert</th>
                        <th className="py-1 font-medium">Wofür</th>
                      </tr>
                    </thead>
                    <tbody>
                      {status.fehlendeEintraege.map((e) => (
                        <tr key={`${e.typ}-${e.name}`} className="border-t border-border">
                          <td className="py-1 pr-3 font-mono">{e.typ}</td>
                          <td className="py-1 pr-3 font-mono">{e.name}</td>
                          <td className="break-all py-1 pr-3 font-mono">{e.wert}</td>
                          <td className="py-1 text-muted">{e.zweck}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!fertig && (
                <p className="text-xs text-muted">
                  DNS-Änderungen brauchen meist einige Minuten, selten bis zu 48 Stunden. Danach erneut prüfen. Das
                  HTTPS-Zertifikat stellt Vercel automatisch aus.
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1">
            {WEGE.map((w) => (
              <details key={w.titel} className="text-xs">
                <summary className="cursor-pointer font-medium">{w.titel}</summary>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-muted">
                  {w.schritte.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </details>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={eingabe}
              onChange={(e) => setEingabe(e.target.value)}
              placeholder="z. B. musterbetrieb.de"
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
            />
            <label className="flex items-center gap-1.5 text-xs text-muted">
              <input type="checkbox" checked={mitWww} onChange={(e) => setMitWww(e.target.checked)} />
              www. mit einrichten
            </label>
            <button
              type="button"
              onClick={verbinden}
              disabled={pending || !eingabe.trim()}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground disabled:opacity-40"
            >
              Verbinden
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
