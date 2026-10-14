'use client'

import { useState, useTransition, type Dispatch, type SetStateAction } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import DemoBanner from '@/app/dashboard/DemoBanner'
import Verbindlichkeiten from './Verbindlichkeiten'
import {
  gutscheinAlsBezahltMarkierenAktion,
  gutscheinEinloesenPerCodeAktion,
  gutscheinEinstellungenSpeichernAktion,
  gutscheinStornierenAktion,
  paypalEinstellungenSpeichernAktion,
} from './actions'
import type { Gutschein, GutscheinEinstellungen } from '@/lib/gutschein/types'
import type { PaypalModus } from '@/lib/paypal/types'
import { cn } from '@/lib/utils'

function formatPreis(betrag: number): string {
  return betrag.toFixed(2).replace('.', ',') + ' €'
}

function formatZeit(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const STATUS_LABEL: Record<Gutschein['status'], string> = {
  offen: 'Offen (unbezahlt)',
  bezahlt: 'Bezahlt – gültig',
  eingeloest: 'Eingelöst',
  storniert: 'Storniert',
}
const STATUS_FARBE: Record<Gutschein['status'], string> = {
  offen: 'text-locked',
  bezahlt: 'text-success',
  eingeloest: 'text-muted',
  storniert: 'text-danger',
}

type PaypalAnfangswert = { clientId: string; secretHinterlegt: boolean; modus: PaypalModus; aktiv: boolean }

function GutscheinListe({
  gutscheine,
  setGutscheine,
}: {
  gutscheine: Gutschein[]
  setGutscheine: Dispatch<SetStateAction<Gutschein[]>>
}) {
  const [code, setCode] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function einloesen() {
    if (!code.trim()) return
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await gutscheinEinloesenPerCodeAktion(code)
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler)
        return
      }
      setGutscheine((prev) =>
        prev.map((g) => (g.code === code.trim().toUpperCase() ? { ...g, status: 'eingeloest', eingeloestAm: new Date().toISOString() } : g))
      )
      setCode('')
    })
  }

  function alsBezahltMarkieren(g: Gutschein) {
    setGutscheine((prev) => prev.map((x) => (x.id === g.id ? { ...x, status: 'bezahlt', bezahltAm: new Date().toISOString() } : x)))
    startTransition(async () => {
      await gutscheinAlsBezahltMarkierenAktion(g.id)
    })
  }

  function stornieren(g: Gutschein) {
    setGutscheine((prev) => prev.map((x) => (x.id === g.id ? { ...x, status: 'storniert' } : x)))
    startTransition(async () => {
      await gutscheinStornierenAktion(g.id)
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-2 text-sm font-semibold">Gutschein per Code einlösen</p>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="z. B. AB12CD34"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm tracking-widest"
          />
          <button
            type="button"
            onClick={einloesen}
            disabled={pending || !code.trim()}
            className="flex-none rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-40"
          >
            Einlösen
          </button>
        </div>
        {fehler && <p className="mt-2 text-xs font-medium text-danger">{fehler}</p>}
      </div>

      {gutscheine.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">Noch keine Gutscheine verkauft.</p>
      )}

      {gutscheine.map((g) => (
        <div key={g.id} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-mono text-sm font-bold tracking-widest">{g.code}</p>
              <p className="text-sm text-muted">
                {formatPreis(g.betrag)} · {g.kaeuferName} ({g.kaeuferEmail})
              </p>
              <p className="text-xs text-muted">
                {g.zahlungsart === 'paypal' ? 'PayPal' : 'Vor Ort'} · angelegt {formatZeit(g.erstelltAt)}
              </p>
            </div>
            <span className={cn('flex-none text-xs font-semibold', STATUS_FARBE[g.status])}>{STATUS_LABEL[g.status]}</span>
          </div>

          {(g.status === 'offen' || g.status === 'bezahlt') && (
            <div className="mt-3 flex gap-2">
              {g.status === 'offen' && (
                <>
                  <button
                    type="button"
                    onClick={() => alsBezahltMarkieren(g)}
                    className="flex-1 rounded-lg bg-accent py-1.5 text-xs font-semibold text-accent-foreground"
                  >
                    Als bezahlt markieren
                  </button>
                  <button type="button" onClick={() => stornieren(g)} className="flex-1 rounded-lg bg-background py-1.5 text-xs font-medium text-muted">
                    Stornieren
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function GutscheinEinstellungenCard({ anfangsEinstellungen }: { anfangsEinstellungen: GutscheinEinstellungen }) {
  const [lokal, setLokal] = useState(anfangsEinstellungen)
  const [betraegeText, setBetraegeText] = useState(anfangsEinstellungen.betraege.join(', '))
  const [fehler, setFehler] = useState<string | null>(null)
  const [gespeichert, setGespeichert] = useState(false)
  const [pending, startTransition] = useTransition()

  function speichern() {
    const betraege = betraegeText
      .split(',')
      .map((t) => Number(t.trim().replace(',', '.')))
      .filter((n) => n > 0)

    if (betraege.length === 0) {
      setFehler('Mindestens einen gültigen Betrag angeben.')
      return
    }

    setFehler(null)
    setGespeichert(false)
    const neu = { ...lokal, betraege }
    startTransition(async () => {
      const ergebnis = await gutscheinEinstellungenSpeichernAktion(neu)
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler)
        return
      }
      setLokal(neu)
      setGespeichert(true)
    })
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">Gutschein-Verkauf</h3>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={lokal.aktiv} onChange={(e) => setLokal((prev) => ({ ...prev, aktiv: e.target.checked }))} />
        Gutscheine werden verkauft
      </label>
      <label className="block text-xs text-muted">
        Verfügbare Beträge (durch Komma getrennt, in Euro)
        <input
          value={betraegeText}
          onChange={(e) => setBetraegeText(e.target.value)}
          placeholder="25, 50, 100"
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

function PaypalEinstellungenCard({ anfangswert }: { anfangswert: PaypalAnfangswert }) {
  const [clientId, setClientId] = useState(anfangswert.clientId)
  const [clientSecret, setClientSecret] = useState('')
  const [secretHinterlegt, setSecretHinterlegt] = useState(anfangswert.secretHinterlegt)
  const [modus, setModus] = useState<PaypalModus>(anfangswert.modus)
  const [aktiv, setAktiv] = useState(anfangswert.aktiv)
  const [fehler, setFehler] = useState<string | null>(null)
  const [warnung, setWarnung] = useState<string | null>(null)
  const [gespeichert, setGespeichert] = useState(false)
  const [pending, startTransition] = useTransition()

  function speichern() {
    setFehler(null)
    setWarnung(null)
    setGespeichert(false)
    startTransition(async () => {
      const ergebnis = await paypalEinstellungenSpeichernAktion({ clientId, clientSecret, modus, aktiv })
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler)
        return
      }
      if (clientSecret) setSecretHinterlegt(true)
      setClientSecret('')
      if (ergebnis.warnung) setWarnung(ergebnis.warnung)
      setGespeichert(true)
    })
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">PayPal (Online-Zahlung als Zusatzoption)</h3>
      <p className="text-xs text-muted">
        Zugangsdaten aus eurer eigenen PayPal-Business-App (Entwickler-Dashboard von PayPal). Das Geld geht direkt an euer
        PayPal-Konto – wir fassen es nie an.
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={aktiv} onChange={(e) => setAktiv(e.target.checked)} />
        PayPal-Zahlung aktiv
      </label>

      <label className="block text-xs text-muted">
        Modus
        <select
          value={modus}
          onChange={(e) => setModus(e.target.value as PaypalModus)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
        >
          <option value="sandbox">Sandbox (zum Testen)</option>
          <option value="live">Live (echte Zahlungen)</option>
        </select>
      </label>

      <label className="block text-xs text-muted">
        Client-ID
        <input
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
        />
      </label>

      <label className="block text-xs text-muted">
        Secret {secretHinterlegt && <span className="text-success">(hinterlegt)</span>}
        <input
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
          type="password"
          placeholder={secretHinterlegt ? 'Unverändert lassen oder neues Secret eingeben' : ''}
          className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
        />
      </label>

      {fehler && <p className="text-sm text-danger">{fehler}</p>}
      {gespeichert && !warnung && <p className="text-sm font-medium text-success">Gespeichert.</p>}
      {warnung && <p className="text-sm font-medium text-locked">{warnung}</p>}
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

export default function GutscheinApp({
  freigeschaltet,
  anfangsEinstellungen,
  anfangsGutscheine,
  anfangsPaypal,
}: {
  freigeschaltet: boolean
  anfangsEinstellungen: GutscheinEinstellungen
  anfangsGutscheine: Gutschein[]
  anfangsPaypal: PaypalAnfangswert
}) {
  const [tab, setTab] = useState<'gutscheine' | 'verbindlichkeiten' | 'einstellungen'>('gutscheine')
  const [gutscheine, setGutscheine] = useState(anfangsGutscheine)

  return (
    <>
      {!freigeschaltet && <DemoBanner />}

      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <Link href="/dashboard" className="mb-4 flex items-center gap-1 text-sm text-muted">
          <ArrowLeft className="h-4 w-4" /> Zurück zu den Tools
        </Link>

        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setTab('gutscheine')}
            className={cn('rounded-full px-3 py-1.5 text-xs font-medium', tab === 'gutscheine' ? 'bg-accent text-accent-foreground' : 'bg-card text-muted')}
          >
            Gutscheine
          </button>
          <button
            type="button"
            onClick={() => setTab('verbindlichkeiten')}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium',
              tab === 'verbindlichkeiten' ? 'bg-accent text-accent-foreground' : 'bg-card text-muted'
            )}
          >
            Verbindlichkeiten
          </button>
          <button
            type="button"
            onClick={() => setTab('einstellungen')}
            className={cn('rounded-full px-3 py-1.5 text-xs font-medium', tab === 'einstellungen' ? 'bg-accent text-accent-foreground' : 'bg-card text-muted')}
          >
            Einstellungen
          </button>
        </div>

        {tab === 'gutscheine' && <GutscheinListe gutscheine={gutscheine} setGutscheine={setGutscheine} />}
        {tab === 'verbindlichkeiten' && <Verbindlichkeiten gutscheine={gutscheine} />}
        {tab === 'einstellungen' && (
          <div className="space-y-4">
            <GutscheinEinstellungenCard anfangsEinstellungen={anfangsEinstellungen} />
            <PaypalEinstellungenCard anfangswert={anfangsPaypal} />
          </div>
        )}
      </main>
    </>
  )
}
