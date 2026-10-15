'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Copy } from 'lucide-react'
import DemoBanner from '@/app/dashboard/DemoBanner'
import {
  veranstaltungAbsagenAktion,
  veranstaltungAlsDurchgefuehrtAktion,
  veranstaltungAnlegenAktion,
  veranstaltungBestaetigenAktion,
  veranstaltungLoeschenAktion,
  veranstaltungPreiseSpeichernAktion,
  einstellungenSpeichernAktion,
} from './actions'
import { VERANSTALTUNG_STATUS_LABEL, type Veranstaltung, type VeranstaltungEinstellungen } from '@/lib/veranstaltung/types'
import { cn } from '@/lib/utils'

type Ansicht = 'veranstaltungen' | 'einstellungen'

const STATUS_FARBE: Record<Veranstaltung['status'], string> = {
  angefragt: 'text-locked',
  bestaetigt: 'text-success',
  abgesagt: 'text-danger',
  durchgefuehrt: 'text-muted',
}

function formatDatum(datum: string): string {
  const [jahr, monat, tag] = datum.split('-')
  return `${tag}.${monat}.${jahr}`
}

function formatPreis(betrag: number): string {
  return betrag.toFixed(2).replace('.', ',') + ' €'
}

function AnfrageLink({ link }: { link: string }) {
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
      <span className="truncate">Anfragelink für eure Website: {link}</span>
      {kopiert ? <Check className="h-3.5 w-3.5 flex-none text-success" /> : <Copy className="h-3.5 w-3.5 flex-none" />}
    </button>
  )
}

function NeueVeranstaltungForm({ onAngelegt }: { onAngelegt: (v: Veranstaltung) => void }) {
  const [offen, setOffen] = useState(false)
  const [titel, setTitel] = useState('')
  const [ansprechpartnerName, setAnsprechpartnerName] = useState('')
  const [email, setEmail] = useState('')
  const [telefon, setTelefon] = useState('')
  const [datum, setDatum] = useState('')
  const [beginn, setBeginn] = useState('18:00')
  const [ende, setEnde] = useState('23:00')
  const [geschaetzteGaeste, setGeschaetzteGaeste] = useState('20')
  const [notiz, setNotiz] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (!offen) {
    return (
      <button
        type="button"
        onClick={() => setOffen(true)}
        className="mb-4 w-full rounded-xl border border-dashed border-border py-2.5 text-sm font-medium text-muted"
      >
        + Veranstaltung von Hand anlegen
      </button>
    )
  }

  function anlegen() {
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await veranstaltungAnlegenAktion({
        titel,
        ansprechpartnerName,
        email,
        telefon,
        datum,
        beginn,
        ende,
        geschaetzteGaeste: Number(geschaetzteGaeste) || 0,
        notiz: notiz || undefined,
      })
      if (ergebnis.fehler || !ergebnis.veranstaltung) {
        setFehler(ergebnis.fehler ?? 'Anlegen fehlgeschlagen.')
        return
      }
      onAngelegt(ergebnis.veranstaltung)
      setOffen(false)
      setTitel('')
      setAnsprechpartnerName('')
      setEmail('')
      setTelefon('')
      setDatum('')
      setNotiz('')
    })
  }

  return (
    <div className="mb-4 space-y-3 rounded-2xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">Neue Veranstaltung</h3>
      <input
        value={titel}
        onChange={(e) => setTitel(e.target.value)}
        placeholder="Titel (z. B. Firmenfeier Müller GmbH)"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <input
          value={ansprechpartnerName}
          onChange={(e) => setAnsprechpartnerName(e.target.value)}
          placeholder="Ansprechpartner"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <input
          value={telefon}
          onChange={(e) => setTelefon(e.target.value)}
          placeholder="Telefon"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="E-Mail"
        type="email"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <input value={datum} onChange={(e) => setDatum(e.target.value)} type="date" className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <input value={beginn} onChange={(e) => setBeginn(e.target.value)} type="time" className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <input value={ende} onChange={(e) => setEnde(e.target.value)} type="time" className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
      </div>
      <label className="block text-xs text-muted">
        Geschätzte Gästezahl
        <input
          value={geschaetzteGaeste}
          onChange={(e) => setGeschaetzteGaeste(e.target.value)}
          type="number"
          min={1}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </label>
      <textarea
        value={notiz}
        onChange={(e) => setNotiz(e.target.value)}
        placeholder="Notiz (optional)"
        rows={2}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      {fehler && <p className="text-sm text-danger">{fehler}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={anlegen}
          disabled={pending || !titel.trim() || !ansprechpartnerName.trim() || !datum}
          className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-40"
        >
          {pending ? 'Speichert…' : 'Anlegen'}
        </button>
        <button type="button" onClick={() => setOffen(false)} className="flex-none rounded-xl bg-background px-4 py-2.5 text-sm font-medium text-muted">
          Abbrechen
        </button>
      </div>
    </div>
  )
}

function PreiseForm({ veranstaltung, onGespeichert }: { veranstaltung: Veranstaltung; onGespeichert: (v: Veranstaltung) => void }) {
  const [preis, setPreis] = useState(veranstaltung.preis !== null ? String(veranstaltung.preis) : '')
  const [anzahlung, setAnzahlung] = useState(veranstaltung.anzahlung !== null ? String(veranstaltung.anzahlung) : '')
  const [pending, startTransition] = useTransition()

  function speichern() {
    const preisZahl = preis.trim() ? Number(preis.replace(',', '.')) : null
    const anzahlungZahl = anzahlung.trim() ? Number(anzahlung.replace(',', '.')) : null
    startTransition(async () => {
      const ergebnis = await veranstaltungPreiseSpeichernAktion(veranstaltung.id, { preis: preisZahl, anzahlung: anzahlungZahl })
      if (!ergebnis.fehler) onGespeichert({ ...veranstaltung, preis: preisZahl, anzahlung: anzahlungZahl })
    })
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <input
        value={preis}
        onChange={(e) => setPreis(e.target.value)}
        placeholder="Pauschale €"
        className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
      />
      <input
        value={anzahlung}
        onChange={(e) => setAnzahlung(e.target.value)}
        placeholder="Anzahlung €"
        className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
      />
      <button type="button" onClick={speichern} disabled={pending} className="rounded-lg bg-background px-3 py-1.5 text-xs font-medium text-muted">
        {pending ? '…' : 'Speichern'}
      </button>
    </div>
  )
}

function VeranstaltungsListe({ anfangsVeranstaltungen }: { anfangsVeranstaltungen: Veranstaltung[] }) {
  const [veranstaltungen, setVeranstaltungen] = useState(anfangsVeranstaltungen)
  const [fehler, setFehler] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function aktualisieren(id: string, patch: Partial<Veranstaltung>) {
    setVeranstaltungen((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)))
  }

  function bestaetigen(v: Veranstaltung) {
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await veranstaltungBestaetigenAktion(v.id)
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler)
        return
      }
      aktualisieren(v.id, { status: 'bestaetigt' })
    })
  }

  function absagen(v: Veranstaltung) {
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await veranstaltungAbsagenAktion(v.id)
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler)
        return
      }
      aktualisieren(v.id, { status: 'abgesagt' })
    })
  }

  function alsDurchgefuehrt(v: Veranstaltung) {
    startTransition(async () => {
      const ergebnis = await veranstaltungAlsDurchgefuehrtAktion(v.id)
      if (!ergebnis.fehler) aktualisieren(v.id, { status: 'durchgefuehrt' })
    })
  }

  function loeschen(v: Veranstaltung) {
    if (!window.confirm('Diese Veranstaltung wirklich löschen?')) return
    startTransition(async () => {
      const ergebnis = await veranstaltungLoeschenAktion(v.id)
      if (!ergebnis.fehler) setVeranstaltungen((prev) => prev.filter((x) => x.id !== v.id))
    })
  }

  return (
    <div className="space-y-4">
      <NeueVeranstaltungForm onAngelegt={(v) => setVeranstaltungen((prev) => [v, ...prev])} />

      {fehler && <p className="text-sm text-danger">{fehler}</p>}

      {veranstaltungen.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">Noch keine Veranstaltungen.</p>
      )}

      {veranstaltungen.map((v) => (
        <div key={v.id} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{v.titel}</p>
              <p className="text-xs text-muted">
                {formatDatum(v.datum)} · {v.beginn}–{v.ende} Uhr · {v.geschaetzteGaeste} Gäste
              </p>
              <p className="text-xs text-muted">
                {v.ansprechpartnerName} · {v.email} · {v.telefon}
              </p>
              {v.notiz && <p className="mt-1 text-xs text-muted">{v.notiz}</p>}
            </div>
            <span className={cn('flex-none text-xs font-semibold', STATUS_FARBE[v.status])}>{VERANSTALTUNG_STATUS_LABEL[v.status]}</span>
          </div>

          {(v.preis !== null || v.anzahlung !== null) && (
            <p className="mt-2 text-xs text-muted">
              {v.preis !== null && <>Pauschale: {formatPreis(v.preis)} </>}
              {v.anzahlung !== null && <>· Anzahlung: {formatPreis(v.anzahlung)}</>}
            </p>
          )}

          {v.status !== 'abgesagt' && v.status !== 'durchgefuehrt' && (
            <PreiseForm veranstaltung={v} onGespeichert={(neu) => aktualisieren(v.id, neu)} />
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {v.status === 'angefragt' && (
              <button
                type="button"
                onClick={() => bestaetigen(v)}
                disabled={pending}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground disabled:opacity-40"
              >
                Bestätigen
              </button>
            )}
            {v.status === 'bestaetigt' && (
              <button
                type="button"
                onClick={() => alsDurchgefuehrt(v)}
                disabled={pending}
                className="rounded-lg bg-background px-3 py-1.5 text-xs font-medium text-muted"
              >
                Als durchgeführt markieren
              </button>
            )}
            {(v.status === 'angefragt' || v.status === 'bestaetigt') && (
              <button
                type="button"
                onClick={() => absagen(v)}
                disabled={pending}
                className="rounded-lg bg-background px-3 py-1.5 text-xs font-medium text-danger"
              >
                Absagen
              </button>
            )}
            <button type="button" onClick={() => loeschen(v)} disabled={pending} className="rounded-lg bg-background px-3 py-1.5 text-xs font-medium text-muted">
              Löschen
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function EinstellungenCard({ anfangsEinstellungen }: { anfangsEinstellungen: VeranstaltungEinstellungen }) {
  const [lokal, setLokal] = useState(anfangsEinstellungen)
  const [fehler, setFehler] = useState<string | null>(null)
  const [gespeichert, setGespeichert] = useState(false)
  const [pending, startTransition] = useTransition()

  function speichern() {
    setFehler(null)
    setGespeichert(false)
    startTransition(async () => {
      const ergebnis = await einstellungenSpeichernAktion(lokal)
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler)
        return
      }
      setGespeichert(true)
    })
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">Öffentliches Anfrageformular</h3>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={lokal.aktiv} onChange={(e) => setLokal((prev) => ({ ...prev, aktiv: e.target.checked }))} />
        Anfragen über den Anfragelink annehmen
      </label>
      <label className="block text-xs text-muted">
        Infotext auf der Anfrageseite (optional, z. B. Raumgröße, Pauschalen)
        <textarea
          value={lokal.infoText ?? ''}
          onChange={(e) => setLokal((prev) => ({ ...prev, infoText: e.target.value || null }))}
          rows={3}
          className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
        />
      </label>
      <label className="block text-xs text-muted">
        Benachrichtigungs-E-Mail bei neuen Anfragen (optional)
        <input
          value={lokal.benachrichtigungEmail ?? ''}
          onChange={(e) => setLokal((prev) => ({ ...prev, benachrichtigungEmail: e.target.value || null }))}
          type="email"
          className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
        />
      </label>
      {fehler && <p className="text-sm text-danger">{fehler}</p>}
      {gespeichert && <p className="text-sm font-medium text-success">Gespeichert.</p>}
      <button
        type="button"
        onClick={speichern}
        disabled={pending}
        className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-40"
      >
        {pending ? 'Speichert…' : 'Speichern'}
      </button>
    </div>
  )
}

export default function VeranstaltungApp({
  darfVerwalten,
  freigeschaltet,
  oeffentlicherLink,
  anfangsEinstellungen,
  anfangsVeranstaltungen,
}: {
  // Verwaltungskonto (Inhaber*in) – sonst Tresen: keine Einstellungen/Auswertungen.
  darfVerwalten: boolean
  freigeschaltet: boolean
  // Fertiger Link unter der Domain des Betriebs (lib/url.ts →
  // oeffentlicheUrl), nicht aus window.location gebaut: das Dashboard
  // läuft nicht unbedingt unter derselben Adresse wie die Gästeseiten.
  oeffentlicherLink: string
  anfangsEinstellungen: VeranstaltungEinstellungen
  anfangsVeranstaltungen: Veranstaltung[]
}) {
  const [ansicht, setAnsicht] = useState<Ansicht>('veranstaltungen')

  return (
    <>
      {!freigeschaltet && <DemoBanner />}

      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <Link href="/dashboard" className="mb-4 flex items-center gap-1 text-sm text-muted">
          <ArrowLeft className="h-4 w-4" /> Zurück zu den Tools
        </Link>

        <AnfrageLink link={oeffentlicherLink} />

        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              { key: 'veranstaltungen', label: 'Veranstaltungen' },
              { key: 'einstellungen', label: 'Einstellungen', verwaltung: true },
            ] as const
          )
            .filter((tab) => darfVerwalten || !('verwaltung' in tab))
            .map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setAnsicht(tab.key)}
              className={cn('rounded-full px-3 py-1.5 text-xs font-medium', ansicht === tab.key ? 'bg-accent text-accent-foreground' : 'bg-card text-muted')}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {ansicht === 'veranstaltungen' && <VeranstaltungsListe anfangsVeranstaltungen={anfangsVeranstaltungen} />}
        {ansicht === 'einstellungen' && <EinstellungenCard anfangsEinstellungen={anfangsEinstellungen} />}
      </main>
    </>
  )
}
