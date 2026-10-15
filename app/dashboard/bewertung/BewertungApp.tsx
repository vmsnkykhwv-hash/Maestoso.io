'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import DemoBanner from '@/app/dashboard/DemoBanner'
import Klickrate from './Klickrate'
import GoogleTrend from './GoogleTrend'
import { einstellungenSpeichernAktion } from './actions'
import type { BewertungsEinstellungen, BewertungsListenEintrag } from '@/lib/bewertung/types'
import { cn } from '@/lib/utils'

const QUELLE_LABEL: Record<BewertungsListenEintrag['quelle'], string> = {
  reservierung: 'Reservierung',
  bestellung: 'Online-Bestellung',
}

function formatDatum(datum: string): string {
  const [jahr, monat, tag] = datum.split('-')
  return `${tag}.${monat}.${jahr}`
}

function BewertungsListe({ eintraege, einstellungenAktiv }: { eintraege: BewertungsListenEintrag[]; einstellungenAktiv: boolean }) {
  if (eintraege.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">
        Noch keine erschienenen Reservierungen oder abgeschlossenen Bestellungen – taucht hier automatisch auf, sobald die
        Leitung im Tischplan bzw. bei der Online-Bestellung den jeweiligen Status setzt.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {!einstellungenAktiv && (
        <p className="rounded-xl bg-locked-bg px-3 py-2 text-xs font-medium text-locked">
          Bewertungsanfrage ist aktuell deaktiviert – nichts unten wird verschickt (Tab &quot;Einstellungen&quot;).
        </p>
      )}
      {eintraege.map((e) => (
        <div key={`${e.quelle}-${e.id}`} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{e.name}</p>
              <p className="text-xs text-muted">
                {QUELLE_LABEL[e.quelle]} · {formatDatum(e.datum)} {e.uhrzeit} Uhr
              </p>
            </div>
            <span
              className={cn(
                'flex-none text-xs font-semibold',
                e.email === null ? 'text-muted' : e.geplant ? 'text-success' : 'text-muted'
              )}
            >
              {e.email === null ? 'Keine E-Mail hinterlegt' : e.geplant ? 'Geplant' : 'Keine Anfrage'}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function BewertungApp({
  freigeschaltet,
  anfangsEinstellungen,
  anfangsUebersicht,
}: {
  freigeschaltet: boolean
  anfangsEinstellungen: BewertungsEinstellungen
  anfangsUebersicht: BewertungsListenEintrag[]
}) {
  const [tab, setTab] = useState<'liste' | 'klickrate' | 'google' | 'einstellungen'>('liste')
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
    <>
      {!freigeschaltet && <DemoBanner />}

      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <Link href="/dashboard" className="mb-4 flex items-center gap-1 text-sm text-muted">
          <ArrowLeft className="h-4 w-4" /> Zurück zu den Tools
        </Link>

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab('liste')}
            className={cn('rounded-full px-3 py-1.5 text-xs font-medium', tab === 'liste' ? 'bg-accent text-accent-foreground' : 'bg-card text-muted')}
          >
            Bewertungsliste
          </button>
          <button
            type="button"
            onClick={() => setTab('klickrate')}
            className={cn('rounded-full px-3 py-1.5 text-xs font-medium', tab === 'klickrate' ? 'bg-accent text-accent-foreground' : 'bg-card text-muted')}
          >
            Klickrate
          </button>
          <button
            type="button"
            onClick={() => setTab('google')}
            className={cn('rounded-full px-3 py-1.5 text-xs font-medium', tab === 'google' ? 'bg-accent text-accent-foreground' : 'bg-card text-muted')}
          >
            Google-Trend
          </button>
          <button
            type="button"
            onClick={() => setTab('einstellungen')}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium',
              tab === 'einstellungen' ? 'bg-accent text-accent-foreground' : 'bg-card text-muted'
            )}
          >
            Einstellungen
          </button>
        </div>

        {tab === 'liste' && <BewertungsListe eintraege={anfangsUebersicht} einstellungenAktiv={lokal.aktiv} />}
        {tab === 'klickrate' && <Klickrate />}
        {tab === 'google' && <GoogleTrend />}
        {tab === 'einstellungen' && (
          <>
            <p className="mb-4 text-sm text-muted">
              Sobald die Leitung im Tischplan eine Reservierung als &quot;Erschienen&quot; markiert oder eine
              Online-Bestellung als &quot;Abgeschlossen&quot;, wird – nur solange hier aktiviert – automatisch eine Mail
              mit Bitte um eine Google-Bewertung geplant. Der Versand richtet sich dabei nach der Reservierungs- bzw.
              Liefer-/Abholzeit (plus der Verzögerung unten), nicht danach, wann die Leitung den Status setzt – sonst
              könnte die Mail rausgehen, bevor der Gast überhaupt da war. Bei Storno oder No-Show passiert nichts.
            </p>

            <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={lokal.aktiv}
                  onChange={(e) => setLokal((prev) => ({ ...prev, aktiv: e.target.checked }))}
                />
                Bewertungsanfrage aktiv
              </label>

              <label className="block text-xs text-muted">
                Google-Bewertungslink
                <input
                  value={lokal.googleUrl ?? ''}
                  onChange={(e) => setLokal((prev) => ({ ...prev, googleUrl: e.target.value || null }))}
                  placeholder="https://g.page/r/.../review"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                />
              </label>

              <label className="block text-xs text-muted">
                Verzögerung nach Reservierungs-/Liefer-/Abholzeit (Minuten)
                <input
                  type="number"
                  min={0}
                  value={lokal.verzoegerungMinuten}
                  onChange={(e) => setLokal((prev) => ({ ...prev, verzoegerungMinuten: Number(e.target.value) || 0 }))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                />
              </label>

              {fehler && <p className="text-sm text-danger">{fehler}</p>}
              {gespeichert && <p className="text-sm font-medium text-success">Gespeichert.</p>}

              <button
                type="button"
                onClick={speichern}
                disabled={pending}
                className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground disabled:opacity-40"
              >
                {pending ? 'Speichert…' : 'Speichern'}
              </button>
            </div>
          </>
        )}
      </main>
    </>
  )
}
