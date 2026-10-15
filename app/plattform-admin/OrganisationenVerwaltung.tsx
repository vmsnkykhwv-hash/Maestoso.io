'use client'

import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { modulFreischaltenUmschalten, organisationAnlegen, organisationLoeschen } from './actions'
import DomainVerwaltung from './DomainVerwaltung'
import { MODULE, type ModulSchluessel } from '@/lib/module'
import type { OrganisationMitFreischaltungen } from '@/lib/organisationen'
import { cn } from '@/lib/utils'

export default function OrganisationenVerwaltung({
  anfangsOrganisationen,
}: {
  anfangsOrganisationen: OrganisationMitFreischaltungen[]
}) {
  const [organisationen, setOrganisationen] = useState(anfangsOrganisationen)
  const [pending, startTransition] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)
  const [loeschenBestaetigenId, setLoeschenBestaetigenId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [loginCode, setLoginCode] = useState('')
  const [pin, setPin] = useState('')

  function erstellen() {
    if (!name.trim() || !pin.trim()) return
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await organisationAnlegen(name, loginCode, pin)
      if (ergebnis.fehler || !ergebnis.organisation) {
        setFehler(ergebnis.fehler ?? 'Organisation konnte nicht angelegt werden')
        return
      }
      const neu = ergebnis.organisation
      setOrganisationen((prev) => [neu, ...prev])
      setName('')
      setLoginCode('')
      setPin('')
    })
  }

  function umschalten(organisationId: string, modul: ModulSchluessel, freigeschaltet: boolean) {
    setOrganisationen((prev) =>
      prev.map((o) =>
        o.id === organisationId ? { ...o, freischaltungen: { ...o.freischaltungen, [modul]: freigeschaltet } } : o
      )
    )
    startTransition(() => modulFreischaltenUmschalten(organisationId, modul, freigeschaltet))
  }

  function loeschen(organisationId: string) {
    setOrganisationen((prev) => prev.filter((o) => o.id !== organisationId))
    setLoeschenBestaetigenId(null)
    startTransition(() => organisationLoeschen(organisationId))
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold">Neue Organisation anlegen</h2>
        {fehler && <p className="mb-2 text-sm text-danger">{fehler}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (z. B. Café Musterbetrieb)"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={loginCode}
            onChange={(e) => setLoginCode(e.target.value)}
            placeholder="Zugangscode (leer = automatisch)"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN (6–12 Ziffern)"
            inputMode="numeric"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={erstellen}
          disabled={pending}
          className="mt-3 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-40"
        >
          Anlegen
        </button>
      </div>

      <div className="space-y-3">
        {organisationen.length === 0 && <p className="text-sm text-muted">Noch keine Organisationen angelegt.</p>}
        {organisationen.map((o) => (
          <div key={o.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{o.name}</h3>
                <p className="text-xs text-muted">Zugangscode: {o.loginCode}</p>
                <p className="text-xs text-muted">Subdomain: {o.subdomain ?? '–'}</p>
              </div>
              {loeschenBestaetigenId === o.id ? (
                <div className="flex flex-none items-center gap-2">
                  <button onClick={() => setLoeschenBestaetigenId(null)} className="text-xs text-muted">
                    Abbrechen
                  </button>
                  <button
                    onClick={() => loeschen(o.id)}
                    className="rounded-lg bg-danger px-2.5 py-1.5 text-xs font-medium text-white"
                  >
                    Löschen
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setLoeschenBestaetigenId(o.id)}
                  aria-label="Organisation löschen"
                  className="flex-none text-muted"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="mt-4">
              <DomainVerwaltung organisationId={o.id} anfangsDomain={o.customDomain} />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {MODULE.map((m) => {
                const frei = o.freischaltungen[m.schluessel]
                return (
                  <button
                    key={m.schluessel}
                    onClick={() => umschalten(o.id, m.schluessel, !frei)}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-xs font-medium',
                      frei ? 'bg-success-bg text-success' : 'bg-locked-bg text-locked'
                    )}
                  >
                    {m.name}: {frei ? 'freigeschaltet' : 'Demo'}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
