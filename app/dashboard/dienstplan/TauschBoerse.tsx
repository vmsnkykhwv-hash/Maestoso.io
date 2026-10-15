'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { formatDatumKurz, wochentagKurz } from '@/lib/datum'
import {
  offeneTauschAnfragenLadenAktion,
  tauschAnfrageAblehnenAktion,
  tauschAnfrageAnnehmenAktion,
  tauschAnfrageBestaetigenAktion,
  tauschAnfrageStornierenAktion,
  type TauschAnfrageMitSchicht,
} from './actions'
import type { Mitarbeiter } from '@/lib/mitarbeiter/types'

export default function TauschBoerse({
  mitarbeiter,
  verwaltung,
  mitarbeiterNamen,
}: {
  // null beim Verwaltungskonto (keine eigenen Schichten)
  mitarbeiter: Mitarbeiter | null
  verwaltung: boolean
  mitarbeiterNamen: { id: string; name: string }[]
}) {
  const [anfragen, setAnfragen] = useState<TauschAnfrageMitSchicht[]>([])
  const [laden, startLaden] = useTransition()
  const [aktionPending, startAktion] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)

  const neuLaden = useCallback(() => {
    startLaden(async () => {
      setAnfragen(await offeneTauschAnfragenLadenAktion())
    })
  }, [])

  useEffect(() => {
    neuLaden()
  }, [neuLaden])

  function namen(id: string): string {
    return mitarbeiterNamen.find((m) => m.id === id)?.name ?? 'Unbekannt'
  }

  function annehmen(id: string) {
    setFehler(null)
    startAktion(async () => {
      const ergebnis = await tauschAnfrageAnnehmenAktion(id)
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler)
        return
      }
      neuLaden()
    })
  }

  function bestaetigen(id: string) {
    setFehler(null)
    startAktion(async () => {
      const ergebnis = await tauschAnfrageBestaetigenAktion(id)
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler)
        return
      }
      neuLaden()
    })
  }

  function stornieren(id: string) {
    startAktion(async () => {
      await tauschAnfrageStornierenAktion(id)
      neuLaden()
    })
  }

  function ablehnen(id: string) {
    startAktion(async () => {
      await tauschAnfrageAblehnenAktion(id)
      neuLaden()
    })
  }

  const istLeitung = verwaltung

  return (
    <div>
      <p className="mb-3 text-xs text-muted">
        Wer seine Schicht nicht übernehmen kann, bietet sie hier zum Tausch an (über &quot;Zum Tausch anbieten&quot; im
        Wochenplan). Sagt jemand zu, wird die Schicht nicht sofort umgeschrieben – erst wenn die Leitung die Zusage
        bestätigt, ist der Tausch wirksam.
      </p>

      {fehler && <p className="mb-2 text-sm font-medium text-danger">{fehler}</p>}

      {laden ? (
        <p className="text-sm text-muted">Lade…</p>
      ) : anfragen.length === 0 ? (
        <p className="text-sm text-muted">Aktuell keine offenen Tausch-Anfragen.</p>
      ) : (
        <ul className="space-y-2">
          {anfragen.map((a) => {
            const istEigene = a.anfragenderMitarbeiterId === mitarbeiter?.id
            const wartetAufBestaetigung = a.status === 'angenommen'
            return (
              <li key={a.id} className="rounded-2xl border border-border bg-card p-3">
                <p className="text-sm font-semibold">
                  {wochentagKurz(a.schicht.datum)} {formatDatumKurz(a.schicht.datum)} · {a.schicht.beginn}–{a.schicht.ende} Uhr
                </p>
                <p className="text-xs text-muted">Angeboten von {namen(a.anfragenderMitarbeiterId)}</p>

                {wartetAufBestaetigung && a.zielMitarbeiterId && (
                  <p className="mt-1 text-xs font-medium text-locked">
                    {namen(a.zielMitarbeiterId)} hat zugesagt – wartet auf Bestätigung der Leitung
                  </p>
                )}

                <div className="mt-2 flex flex-wrap gap-2">
                  {!istEigene && !wartetAufBestaetigung && mitarbeiter && (
                    <button
                      type="button"
                      onClick={() => annehmen(a.id)}
                      disabled={aktionPending}
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground disabled:opacity-40"
                    >
                      Annehmen
                    </button>
                  )}
                  {istLeitung && wartetAufBestaetigung && (
                    <button
                      type="button"
                      onClick={() => bestaetigen(a.id)}
                      disabled={aktionPending}
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground disabled:opacity-40"
                    >
                      Tausch bestätigen
                    </button>
                  )}
                  {istEigene && (
                    <button
                      type="button"
                      onClick={() => stornieren(a.id)}
                      disabled={aktionPending}
                      className="rounded-lg bg-background px-3 py-1.5 text-xs font-medium text-muted disabled:opacity-40"
                    >
                      Zurückziehen
                    </button>
                  )}
                  {istLeitung && !istEigene && (
                    <button
                      type="button"
                      onClick={() => ablehnen(a.id)}
                      disabled={aktionPending}
                      className="rounded-lg bg-background px-3 py-1.5 text-xs font-medium text-danger disabled:opacity-40"
                    >
                      Ablehnen
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
