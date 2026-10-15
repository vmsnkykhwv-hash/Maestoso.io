'use client'

import { useState, useTransition } from 'react'
import { einstellungenSpeichernAktion, kanalPauseAufhebenAktion, kanalPausierenAktion } from './actions'
import type { BestellEinstellungen, BestellKanal } from '@/lib/bestellung/types'

const KANAL_LABEL: Record<BestellKanal, string> = { abholung: 'Abholung', lieferung: 'Lieferung' }
const PAUSE_OPTIONEN = [15, 30, 60, 120]

function formatUhrzeit(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function KanalBlock({
  kanal,
  einstellungen,
  onFeldAendern,
  onPausiert,
  onPauseAufgehoben,
  nurPause,
}: {
  nurPause: boolean
  kanal: BestellKanal
  einstellungen: BestellEinstellungen
  onFeldAendern: (patch: Partial<BestellEinstellungen>) => void
  onPausiert: (kanal: BestellKanal, pausiertBis: string) => void
  onPauseAufgehoben: (kanal: BestellKanal) => void
}) {
  const istAbholung = kanal === 'abholung'
  const aktiv = istAbholung ? einstellungen.abholungAktiv : einstellungen.lieferungAktiv
  const von = istAbholung ? einstellungen.abholungVon : einstellungen.lieferungVon
  const bis = istAbholung ? einstellungen.abholungBis : einstellungen.lieferungBis
  const vorlauf = istAbholung ? einstellungen.vorlaufMinutenAbholung : einstellungen.vorlaufMinutenLieferung
  const maxOffen = istAbholung ? einstellungen.maxOffenAbholung : einstellungen.maxOffenLieferung
  const pausiertBis = istAbholung ? einstellungen.abholungPausiertBis : einstellungen.lieferungPausiertBis
  const pauseGrund = istAbholung ? einstellungen.abholungPauseGrund : einstellungen.lieferungPauseGrund

  const eigenesFenster = von !== null
  const istPausiert = pausiertBis !== null && new Date(pausiertBis) > new Date()

  function aktivAendern(wert: boolean) {
    onFeldAendern(istAbholung ? { abholungAktiv: wert } : { lieferungAktiv: wert })
  }

  function fensterAendern(neuesVon: string | null, neuesBis: string | null) {
    onFeldAendern(istAbholung ? { abholungVon: neuesVon, abholungBis: neuesBis } : { lieferungVon: neuesVon, lieferungBis: neuesBis })
  }

  function vorlaufAendern(wert: number) {
    onFeldAendern(istAbholung ? { vorlaufMinutenAbholung: wert } : { vorlaufMinutenLieferung: wert })
  }

  function maxOffenAendern(wert: number | null) {
    onFeldAendern(istAbholung ? { maxOffenAbholung: wert } : { maxOffenLieferung: wert })
  }

  const [pausePending, startPause] = useTransition()

  function pausieren(minuten: number) {
    startPause(async () => {
      const ergebnis = await kanalPausierenAktion(kanal, minuten)
      if (!ergebnis.fehler) onPausiert(kanal, new Date(Date.now() + minuten * 60 * 1000).toISOString())
    })
  }

  function pauseAufheben() {
    startPause(async () => {
      const ergebnis = await kanalPauseAufhebenAktion(kanal)
      if (!ergebnis.fehler) onPauseAufgehoben(kanal)
    })
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{KANAL_LABEL[kanal]}</h3>
        {!nurPause && (
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={aktiv} onChange={(e) => aktivAendern(e.target.checked)} />
            Grundsätzlich angeboten
          </label>
        )}
      </div>

      {istPausiert ? (
        <div className="mt-3 rounded-xl border border-locked bg-locked-bg p-3">
          <p className="text-xs font-semibold text-locked">
            Pausiert bis {formatUhrzeit(pausiertBis!)} Uhr{pauseGrund ? ` · ${pauseGrund}` : ''}
          </p>
          <button
            type="button"
            onClick={pauseAufheben}
            disabled={pausePending}
            className="mt-2 w-full rounded-lg bg-background py-1.5 text-xs font-medium disabled:opacity-40"
          >
            Pause jetzt aufheben
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <p className="mb-1.5 text-xs text-muted">Schnellpause – z. B. bei zu viel Andrang oder wenn gerade niemand fahren kann:</p>
          <div className="flex flex-wrap gap-2">
            {PAUSE_OPTIONEN.map((minuten) => (
              <button
                key={minuten}
                type="button"
                onClick={() => pausieren(minuten)}
                disabled={pausePending}
                className="rounded-lg bg-background px-2.5 py-1 text-xs font-medium disabled:opacity-40"
              >
                {minuten} Min. pausieren
              </button>
            ))}
          </div>
        </div>
      )}

      {!nurPause && (
        <>
        <div className="mt-3 space-y-2">
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={eigenesFenster}
              onChange={(e) => fensterAendern(e.target.checked ? '11:00' : null, e.target.checked ? '20:00' : null)}
            />
            Eigenes Zeitfenster (sonst gelten die kompletten Öffnungszeiten)
          </label>
          {eigenesFenster && (
            <div className="grid grid-cols-2 gap-2">
              <input
                type="time"
                value={von ?? ''}
                onChange={(e) => fensterAendern(e.target.value, bis)}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
              />
              <input
                type="time"
                value={bis ?? ''}
                onChange={(e) => fensterAendern(von, e.target.value)}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
              />
            </div>
          )}
          <p className="text-xs text-muted">Bestellungen sind in jedem Fall nur innerhalb der tatsächlichen Öffnungszeiten möglich (inkl. Ausnahmen aus dem Tischplan).</p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-xs text-muted">
            Vorlauf (Min.)
            <input
              type="number"
              min={0}
              value={vorlauf}
              onChange={(e) => vorlaufAendern(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-muted">
            Max. gleichzeitig offen
            <input
              type="number"
              min={1}
              placeholder="unbegrenzt"
              value={maxOffen ?? ''}
              onChange={(e) => maxOffenAendern(e.target.value ? Number(e.target.value) : null)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
        </div>
        </>
      )}
    </div>
  )
}

// nurPause: am Tresen darf das Personal bei Andrang pausieren, aber nicht die
// übrigen Einstellungen ändern (die speichert ohnehin nur ein
// Verwaltungskonto, siehe actions.ts).
export default function BestellEinstellungenForm({
  einstellungen,
  onGespeichert,
  nurPause = false,
}: {
  nurPause?: boolean
  einstellungen: BestellEinstellungen
  onGespeichert: (e: BestellEinstellungen) => void
}) {
  const [lokal, setLokal] = useState(einstellungen)
  const [gespeichert, setGespeichert] = useState(false)
  const [pending, startTransition] = useTransition()

  function feldAendern(patch: Partial<BestellEinstellungen>) {
    setGespeichert(false)
    setLokal((prev) => ({ ...prev, ...patch }))
  }

  function pausiertUebernehmen(kanal: BestellKanal, pausiertBis: string) {
    setLokal((prev) =>
      kanal === 'abholung' ? { ...prev, abholungPausiertBis: pausiertBis } : { ...prev, lieferungPausiertBis: pausiertBis }
    )
  }

  function pauseAufgehobenUebernehmen(kanal: BestellKanal) {
    setLokal((prev) =>
      kanal === 'abholung'
        ? { ...prev, abholungPausiertBis: null, abholungPauseGrund: null }
        : { ...prev, lieferungPausiertBis: null, lieferungPauseGrund: null }
    )
  }

  function speichern() {
    startTransition(async () => {
      const ergebnis = await einstellungenSpeichernAktion(lokal)
      if (!ergebnis.fehler) {
        onGespeichert(lokal)
        setGespeichert(true)
      }
    })
  }

  return (
    <div className="space-y-4">
      <KanalBlock kanal="abholung" einstellungen={lokal} onFeldAendern={feldAendern} onPausiert={pausiertUebernehmen} onPauseAufgehoben={pauseAufgehobenUebernehmen} nurPause={nurPause} />
      <KanalBlock kanal="lieferung" einstellungen={lokal} onFeldAendern={feldAendern} onPausiert={pausiertUebernehmen} onPauseAufgehoben={pauseAufgehobenUebernehmen} nurPause={nurPause} />

      {!nurPause && (
        <>
        <label className="block text-xs text-muted">
          Zeitraster für Bestellslots (Min.)
          <input
            type="number"
            min={5}
            value={lokal.slotMinuten}
            onChange={(e) => feldAendern({ slotMinuten: Number(e.target.value) || 5 })}
            className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-sm"
          />
        </label>

        <label className="block text-xs text-muted">
          Benachrichtigungs-E-Mail bei neuer Bestellung (optional)
          <input
            value={lokal.benachrichtigungEmail ?? ''}
            onChange={(e) => feldAendern({ benachrichtigungEmail: e.target.value || null })}
            placeholder="kueche@euer-betrieb.de"
            className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-sm"
          />
        </label>

        {gespeichert && <p className="text-sm font-medium text-success">Gespeichert.</p>}

        <button
          type="button"
          onClick={speichern}
          disabled={pending}
          className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground disabled:opacity-40"
        >
          {pending ? 'Speichert…' : 'Speichern'}
        </button>
        </>
      )}
    </div>
  )
}
