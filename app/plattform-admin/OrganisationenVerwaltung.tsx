'use client'

import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { modulFreischaltenUmschalten, organisationAnlegen, organisationLoeschen } from './actions'
import DomainVerwaltung from './DomainVerwaltung'
import KontenVerwaltung, { EinladungsLink } from './KontenVerwaltung'
import type { BenutzerUebersicht } from '@/lib/konten/einladung'
import { MODULE, type ModulSchluessel } from '@/lib/module'
import type { OrganisationMitFreischaltungen } from '@/lib/organisationen'
import { cn } from '@/lib/utils'

export default function OrganisationenVerwaltung({
  anfangsOrganisationen,
  benutzerNachOrganisation,
}: {
  anfangsOrganisationen: OrganisationMitFreischaltungen[]
  benutzerNachOrganisation: Record<string, BenutzerUebersicht[]>
}) {
  const [organisationen, setOrganisationen] = useState(anfangsOrganisationen)
  const [pending, startTransition] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)
  const [loeschenBestaetigenId, setLoeschenBestaetigenId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [inhaberEmail, setInhaberEmail] = useState('')
  const [inhaberName, setInhaberName] = useState('')
  const [einladung, setEinladung] = useState<{ link: string; versendet: boolean } | null>(null)
  const [neueBenutzer, setNeueBenutzer] = useState<Record<string, BenutzerUebersicht[]>>({})

  function erstellen() {
    if (!name.trim() || !inhaberEmail.trim()) return
    setFehler(null)
    setEinladung(null)
    startTransition(async () => {
      const ergebnis = await organisationAnlegen(name, inhaberEmail, inhaberName)
      if (ergebnis.fehler || !ergebnis.organisation) {
        setFehler(ergebnis.fehler ?? 'Organisation konnte nicht angelegt werden')
        return
      }
      const neu = ergebnis.organisation
      setOrganisationen((prev) => [neu, ...prev])
      setNeueBenutzer((prev) => ({ ...prev, [neu.id]: ergebnis.benutzer ?? [] }))
      setEinladung(ergebnis.einladung ?? null)
      setName('')
      setInhaberEmail('')
      setInhaberName('')
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
            value={inhaberName}
            onChange={(e) => setInhaberName(e.target.value)}
            placeholder="Name Inhaber*in"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={inhaberEmail}
            onChange={(e) => setInhaberEmail(e.target.value)}
            placeholder="E-Mail Inhaber*in"
            type="email"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={erstellen}
          disabled={pending}
          className="mt-3 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-40"
        >
          Anlegen und einladen
        </button>
        {einladung && (
          <div className="mt-3">
            <EinladungsLink {...einladung} />
          </div>
        )}
      </div>

      <div className="space-y-3">
        {organisationen.length === 0 && <p className="text-sm text-muted">Noch keine Organisationen angelegt.</p>}
        {organisationen.map((o) => (
          <div key={o.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{o.name}</h3>
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
              <KontenVerwaltung organisationId={o.id} anfangsBenutzer={benutzerNachOrganisation[o.id] ?? neueBenutzer[o.id] ?? []} />
            </div>

            <div className="mt-3">
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
