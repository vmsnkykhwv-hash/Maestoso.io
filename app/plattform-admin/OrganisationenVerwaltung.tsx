'use client'

import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import {
  foundingPartnerSetzenAktion,
  modulFreischaltenUmschalten,
  organisationAnlegen,
  organisationLoeschen,
  paketSetzenAktion,
  testStartenAktion,
  testVerlaengernAktion,
  vertragAktivAktion,
} from './actions'
import DomainVerwaltung from './DomainVerwaltung'
import KontenVerwaltung, { EinladungsLink } from './KontenVerwaltung'
import type { BenutzerUebersicht } from '@/lib/konten/einladung'
import { MODULE, type ModulSchluessel } from '@/lib/module'
import type { OrganisationMitFreischaltungen } from '@/lib/organisationen'
import type { Vertrag } from '@/lib/testphase/daten'
import { istGesperrt } from '@/lib/testphase/regeln'
import { FOUNDING_PARTNER_PLAETZE, PAKETE, paketAusModulen } from '@/lib/preise'
import { cn } from '@/lib/utils'

function datum(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' }) : '–'
}

function VertragAnzeige({ vertrag }: { vertrag: Vertrag }) {
  if (vertrag.status === 'aktiv') return <span className="rounded-full bg-success-bg px-2 py-0.5 text-xs font-medium text-success">Vertrag aktiv</span>
  if (vertrag.status === 'gesperrt' || istGesperrt({ vertrag_status: vertrag.status, test_bis: vertrag.testBis })) {
    return (
      <span className="rounded-full bg-danger-bg px-2 py-0.5 text-xs font-medium text-danger">
        Gesperrt{vertrag.loeschungAm ? ` · Löschung am ${datum(vertrag.loeschungAm)}` : ''}
      </span>
    )
  }
  if (!vertrag.testBis) return <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium">Einrichtung · Test nicht gestartet</span>
  return <span className="rounded-full bg-locked-bg px-2 py-0.5 text-xs font-medium text-locked">Test bis {datum(vertrag.testBis)}</span>
}

function heute(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })
}

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
  const [loeschEingabe, setLoeschEingabe] = useState('')
  const [teststart, setTeststart] = useState<Record<string, string>>({})
  const vergebenePlaetze = organisationen.filter((o) => o.foundingPartner).length

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

  function vertragAendern(organisationId: string, aktion: typeof vertragAktivAktion) {
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await aktion(organisationId)
      if (ergebnis.fehler || !ergebnis.vertrag) {
        setFehler(ergebnis.fehler ?? 'Änderung fehlgeschlagen')
        return
      }
      const vertrag = ergebnis.vertrag
      setOrganisationen((prev) => prev.map((o) => (o.id === organisationId ? { ...o, vertrag } : o)))
    })
  }

  function loeschen(organisationId: string) {
    setFehler(null)
    const eingabe = loeschEingabe
    startTransition(async () => {
      try {
        await organisationLoeschen(organisationId, eingabe)
        setOrganisationen((prev) => prev.filter((o) => o.id !== organisationId))
        setLoeschenBestaetigenId(null)
        setLoeschEingabe('')
      } catch {
        setFehler('Löschen fehlgeschlagen – stimmt der eingegebene Name?')
      }
    })
  }

  function paketSetzen(organisationId: string, paket: (typeof PAKETE)[number]['schluessel']) {
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await paketSetzenAktion(organisationId, paket)
      if (ergebnis.fehler || !ergebnis.freischaltungen) {
        setFehler(ergebnis.fehler ?? 'Paket konnte nicht gesetzt werden')
        return
      }
      const freischaltungen = ergebnis.freischaltungen
      setOrganisationen((prev) => prev.map((o) => (o.id === organisationId ? { ...o, freischaltungen } : o)))
    })
  }

  function foundingPartnerUmschalten(organisationId: string, wert: boolean) {
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await foundingPartnerSetzenAktion(organisationId, wert)
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler)
        return
      }
      setOrganisationen((prev) => prev.map((o) => (o.id === organisationId ? { ...o, foundingPartner: wert } : o)))
    })
  }

  function testStarten(organisationId: string) {
    setFehler(null)
    const start = teststart[organisationId] ?? heute()
    startTransition(async () => {
      const ergebnis = await testStartenAktion(organisationId, start)
      if (ergebnis.fehler || !ergebnis.vertrag) {
        setFehler(ergebnis.fehler ?? 'Test konnte nicht gestartet werden')
        return
      }
      const vertrag = ergebnis.vertrag
      setOrganisationen((prev) => prev.map((o) => (o.id === organisationId ? { ...o, vertrag } : o)))
    })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold">Neue Organisation anlegen</h2>
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

      <p className="text-sm text-muted">
        Founding Partner: {vergebenePlaetze} von {FOUNDING_PARTNER_PLAETZE} Plätzen vergeben
      </p>
      {fehler && <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{fehler}</p>}

      <div className="space-y-3">
        {organisationen.length === 0 && <p className="text-sm text-muted">Noch keine Organisationen angelegt.</p>}
        {organisationen.map((o) => (
          <div key={o.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{o.name}</h3>
                <p className="text-xs text-muted">Subdomain: {o.subdomain ?? '–'}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <VertragAnzeige vertrag={o.vertrag} />
                  {o.vertrag.status !== 'aktiv' && (
                    <>
                      <span className="flex items-center gap-1">
                        <input
                          type="date"
                          aria-label="Teststart"
                          value={teststart[o.id] ?? heute()}
                          onChange={(e) => setTeststart((prev) => ({ ...prev, [o.id]: e.target.value }))}
                          className="rounded-lg border border-border bg-background px-2 py-0.5 text-xs"
                        />
                        <button
                          onClick={() => testStarten(o.id)}
                          disabled={pending}
                          className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium disabled:opacity-40"
                        >
                          {o.vertrag.testBis ? 'Test neu starten' : 'Test starten'}
                        </button>
                      </span>
                      <button
                        onClick={() => vertragAendern(o.id, vertragAktivAktion)}
                        disabled={pending}
                        className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium disabled:opacity-40"
                      >
                        Vertrag aktiv
                      </button>
                      {o.vertrag.testBis && (
                        <button
                          onClick={() => vertragAendern(o.id, testVerlaengernAktion)}
                          disabled={pending}
                          className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium disabled:opacity-40"
                        >
                          Test verlängern (+14 Tage)
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setLoeschenBestaetigenId(loeschenBestaetigenId === o.id ? null : o.id)
                  setLoeschEingabe('')
                }}
                aria-label="Organisation löschen"
                className="flex-none text-muted"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {loeschenBestaetigenId === o.id && (
              <div className="mt-3 rounded-xl border border-danger/40 bg-danger-bg p-3">
                <p className="text-xs text-danger">
                  Löscht <strong>{o.name}</strong> endgültig mit allen Daten, Konten, Bildern und der Domain. Das lässt sich nicht rückgängig machen.
                  Zum Bestätigen den Namen des Betriebs eintippen:
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    value={loeschEingabe}
                    onChange={(e) => setLoeschEingabe(e.target.value)}
                    placeholder={o.name}
                    aria-label="Name des Betriebs zur Bestätigung"
                    className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                  />
                  <button onClick={() => setLoeschenBestaetigenId(null)} className="text-xs text-muted">
                    Abbrechen
                  </button>
                  <button
                    onClick={() => loeschen(o.id)}
                    disabled={pending || loeschEingabe.trim() !== o.name.trim()}
                    className="rounded-lg bg-danger px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                  >
                    Endgültig löschen
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4">
              <KontenVerwaltung organisationId={o.id} anfangsBenutzer={benutzerNachOrganisation[o.id] ?? neueBenutzer[o.id] ?? []} />
            </div>

            <div className="mt-3">
              <DomainVerwaltung organisationId={o.id} anfangsDomain={o.customDomain} />
            </div>

            {(() => {
              const freigeschaltet = MODULE.filter((m) => o.freischaltungen[m.schluessel]).map((m) => m.schluessel)
              const paket = paketAusModulen(freigeschaltet)
              return (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold">
                    Paket: {paket ? paket.name : freigeschaltet.length === 0 ? 'keins (alles Demo)' : `individuell (${freigeschaltet.length} Module)`}
                  </span>
                  {PAKETE.map((p) => (
                    <button
                      key={p.schluessel}
                      onClick={() => paketSetzen(o.id, p.schluessel)}
                      disabled={pending}
                      aria-pressed={paket?.schluessel === p.schluessel}
                      className={cn(
                        'rounded-lg border px-3 py-1 text-xs font-semibold disabled:opacity-40',
                        paket?.schluessel === p.schluessel ? 'border-accent bg-accent text-accent-foreground' : 'border-border'
                      )}
                    >
                      {p.name}
                    </button>
                  ))}
                  <button
                    onClick={() => foundingPartnerUmschalten(o.id, !o.foundingPartner)}
                    disabled={pending}
                    aria-pressed={o.foundingPartner}
                    className={cn(
                      'rounded-lg border px-3 py-1 text-xs font-semibold disabled:opacity-40',
                      o.foundingPartner ? 'border-accent bg-accent/15' : 'border-border text-muted'
                    )}
                  >
                    {o.foundingPartner ? '★ Founding Partner' : 'Als Founding Partner markieren'}
                  </button>
                </div>
              )
            })()}

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
