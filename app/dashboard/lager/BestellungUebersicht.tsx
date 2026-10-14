'use client'

// Nach Lieferant gruppierte "Nachbestellen"-Artikel aus abgeschlossenen
// Prüfungen. Die Leitung hakt ab, was in diese Bestellung soll, trägt die
// Menge ein und sieht vor dem Versand einen Entwurf – erst ein bewusster
// Klick auf "Jetzt senden" schickt die Mail tatsächlich raus (siehe
// lib/lager/email.ts).

import { useCallback, useEffect, useState, useTransition } from 'react'
import {
  bestellungSendenAktion,
  eintragBestellungSetzenAktion,
  lieferantenLadenAktion,
  offeneBestellEintraegeLadenAktion,
} from './actions'
import type { Lieferant, OffenerBestellEintrag } from '@/lib/lager/types'

function LieferantGruppe({
  lieferant,
  eintraege,
  onEntfernt,
}: {
  lieferant: Lieferant | null
  eintraege: OffenerBestellEintrag[]
  onEntfernt: (ids: string[]) => void
}) {
  const [mengen, setMengen] = useState<Record<string, string>>(
    Object.fromEntries(eintraege.map((e) => [e.id, e.bestellmenge ?? '']))
  )
  const [ausgewaehlt, setAusgewaehlt] = useState<Record<string, boolean>>({})
  const [vorschauOffen, setVorschauOffen] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [sendenPending, startSenden] = useTransition()

  function mengeAendern(e: OffenerBestellEintrag, wert: string) {
    setMengen((prev) => ({ ...prev, [e.id]: wert }))
    void eintragBestellungSetzenAktion(e.pruefungId, e.artikelId, wert)
  }

  const ausgewaehlteEintraege = eintraege.filter((e) => ausgewaehlt[e.id])
  const bereitFuerVorschau = ausgewaehlteEintraege.length > 0 && ausgewaehlteEintraege.every((e) => mengen[e.id]?.trim())

  function senden() {
    setFehler(null)
    const ids = ausgewaehlteEintraege.map((e) => e.id)
    startSenden(async () => {
      const ergebnis = await bestellungSendenAktion(lieferant!.id, ids)
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler)
        return
      }
      setVorschauOffen(false)
      onEntfernt(ids)
    })
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">{lieferant?.name ?? 'Unbekannter Lieferant'}</h3>

      <div className="space-y-2">
        {eintraege.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background p-2.5">
            <label className="flex flex-1 items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={ausgewaehlt[e.id] ?? false}
                onChange={(ev) => setAusgewaehlt((prev) => ({ ...prev, [e.id]: ev.target.checked }))}
              />
              <span>
                <p className="text-sm font-medium">{e.artikelName}</p>
                <p className="text-xs text-muted">Aktueller Bestand: {e.aktuellerBestand || '–'}</p>
              </span>
            </label>
            <input
              value={mengen[e.id] ?? ''}
              onChange={(ev) => mengeAendern(e, ev.target.value)}
              placeholder={`Menge (${e.einheit})`}
              className="w-32 flex-none rounded-lg border border-border bg-card px-2 py-1 text-xs"
            />
          </div>
        ))}
      </div>

      {!lieferant?.kontaktEmail && (
        <p className="mt-3 text-xs text-danger">Für diesen Lieferanten ist keine E-Mail-Adresse hinterlegt (Tab „Lieferanten”).</p>
      )}

      {vorschauOffen && lieferant?.kontaktEmail && (
        <div className="mt-3 rounded-xl border border-border bg-background p-3 text-xs">
          <p className="mb-1 font-semibold">Entwurf an {lieferant.kontaktEmail}:</p>
          <p>{lieferant.ansprechpartner ? `Hallo ${lieferant.ansprechpartner},` : 'Hallo,'}</p>
          <p className="mt-1">wir möchten folgende Artikel bestellen:</p>
          <ul className="my-1 list-disc pl-4">
            {ausgewaehlteEintraege.map((e) => (
              <li key={e.id}>
                {mengen[e.id]} {e.einheit} {e.artikelName}
              </li>
            ))}
          </ul>
          {lieferant.kundennummer && <p>Kundennummer: {lieferant.kundennummer}</p>}
          <p className="mt-1">Vielen Dank!</p>
        </div>
      )}

      {fehler && <p className="mt-2 text-xs font-medium text-danger">{fehler}</p>}

      <div className="mt-3 flex gap-2">
        {vorschauOffen ? (
          <>
            <button
              type="button"
              onClick={() => setVorschauOffen(false)}
              className="flex-1 rounded-lg bg-background py-2 text-xs font-medium text-muted"
            >
              Zurück
            </button>
            <button
              type="button"
              onClick={senden}
              disabled={sendenPending}
              className="flex-1 rounded-lg bg-accent py-2 text-xs font-semibold text-accent-foreground disabled:opacity-40"
            >
              {sendenPending ? 'Sendet…' : 'Jetzt senden'}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setVorschauOffen(true)}
            disabled={!bereitFuerVorschau || !lieferant?.kontaktEmail}
            className="w-full rounded-lg bg-accent py-2 text-xs font-semibold text-accent-foreground disabled:opacity-40"
          >
            Entwurf ansehen ({ausgewaehlteEintraege.length} Artikel)
          </button>
        )}
      </div>
    </div>
  )
}

export default function BestellungUebersicht() {
  const [eintraege, setEintraege] = useState<OffenerBestellEintrag[]>([])
  const [lieferanten, setLieferanten] = useState<Lieferant[]>([])
  const [laden, startLaden] = useTransition()

  const neuLaden = useCallback(() => {
    startLaden(async () => {
      const [e, l] = await Promise.all([offeneBestellEintraegeLadenAktion(), lieferantenLadenAktion()])
      setEintraege(e)
      setLieferanten(l)
    })
  }, [])

  useEffect(() => {
    neuLaden()
  }, [neuLaden])

  function entfernen(ids: string[]) {
    setEintraege((prev) => prev.filter((e) => !ids.includes(e.id)))
  }

  if (laden) return <p className="text-sm text-muted">Lade…</p>

  if (eintraege.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">
        Keine offenen Bestellvorschläge – entstehen automatisch, sobald eine abgeschlossene Prüfung einen Artikel als
        „Nachbestellen” markiert hat.
      </p>
    )
  }

  const lieferantIds = Array.from(new Set(eintraege.map((e) => e.lieferantId)))

  return (
    <div className="space-y-4">
      {lieferantIds.map((lieferantId) => (
        <LieferantGruppe
          key={lieferantId}
          lieferant={lieferanten.find((l) => l.id === lieferantId) ?? null}
          eintraege={eintraege.filter((e) => e.lieferantId === lieferantId)}
          onEntfernt={entfernen}
        />
      ))}
    </div>
  )
}
