'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, LogOut } from 'lucide-react'
import DemoBanner from '@/app/dashboard/DemoBanner'
import { mitarbeiterAbmelden, mitarbeiterAnmelden } from '@/lib/mitarbeiter/aktionen'
import { mitarbeiterNamenLadenAktion, pruefungenSicherstellenAktion } from './actions'
import MeinePruefungen from './MeinePruefungen'
import LieferantenVerwaltung from './LieferantenVerwaltung'
import ArtikelVerwaltung from './ArtikelVerwaltung'
import PruefungenUebersicht from './PruefungenUebersicht'
import BestellungUebersicht from './BestellungUebersicht'
import type { Mitarbeiter } from '@/lib/mitarbeiter/types'
import { cn } from '@/lib/utils'

type Ansicht = 'meine-pruefungen' | 'lieferanten' | 'artikel' | 'pruefungen' | 'bestellung'

export default function LagerApp({
  freigeschaltet,
  anfangsMitarbeiter,
}: {
  freigeschaltet: boolean
  anfangsMitarbeiter: Mitarbeiter | null
}) {
  const [mitarbeiter, setMitarbeiter] = useState<Mitarbeiter | null>(anfangsMitarbeiter)
  const [pin, setPin] = useState('')
  const [loginFehler, setLoginFehler] = useState<string | null>(null)
  const [loginPending, startLogin] = useTransition()

  const [ansicht, setAnsicht] = useState<Ansicht>('meine-pruefungen')
  const [mitarbeiterNamen, setMitarbeiterNamen] = useState<{ id: string; name: string }[]>([])

  const istLeitung = mitarbeiter?.rolle === 'leitung'

  useEffect(() => {
    if (!mitarbeiter) return
    pruefungenSicherstellenAktion()
    mitarbeiterNamenLadenAktion().then(setMitarbeiterNamen)
  }, [mitarbeiter])

  function anmelden() {
    setLoginFehler(null)
    startLogin(async () => {
      const ergebnis = await mitarbeiterAnmelden(pin)
      if (ergebnis.fehler) {
        setLoginFehler(ergebnis.fehler)
        return
      }
      if (ergebnis.mitarbeiter) {
        setMitarbeiter(ergebnis.mitarbeiter)
        setPin('')
      }
    })
  }

  function abmelden() {
    setMitarbeiter(null)
    setMitarbeiterNamen([])
    setAnsicht('meine-pruefungen')
    void mitarbeiterAbmelden()
  }

  return (
    <>
      {!freigeschaltet && <DemoBanner />}

      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <Link href="/dashboard" className="mb-4 flex items-center gap-1 text-sm text-muted">
          <ArrowLeft className="h-4 w-4" /> Zurück zu den Tools
        </Link>

        {!mitarbeiter ? (
          <div className="mx-auto max-w-xs space-y-4 pt-10 text-center">
            <h2 className="text-base font-semibold">Mit PIN anmelden</h2>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-center text-sm"
              autoFocus
            />
            {loginFehler && <p className="text-sm font-medium text-danger">{loginFehler}</p>}
            <button
              type="button"
              onClick={anmelden}
              disabled={loginPending || pin.length === 0}
              className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground disabled:opacity-40"
            >
              {loginPending ? 'Prüfe…' : 'Anmelden'}
            </button>
            <p className="text-xs text-muted">Derselbe PIN wie in der Zeiterfassung.</p>
          </div>
        ) : (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setAnsicht('meine-pruefungen')}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-medium',
                    ansicht === 'meine-pruefungen' ? 'bg-accent text-accent-foreground' : 'bg-card text-muted'
                  )}
                >
                  Meine Prüfungen
                </button>
                {istLeitung && (
                  <>
                    <button
                      type="button"
                      onClick={() => setAnsicht('lieferanten')}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-xs font-medium',
                        ansicht === 'lieferanten' ? 'bg-accent text-accent-foreground' : 'bg-card text-muted'
                      )}
                    >
                      Lieferanten
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnsicht('artikel')}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-xs font-medium',
                        ansicht === 'artikel' ? 'bg-accent text-accent-foreground' : 'bg-card text-muted'
                      )}
                    >
                      Artikel
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnsicht('pruefungen')}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-xs font-medium',
                        ansicht === 'pruefungen' ? 'bg-accent text-accent-foreground' : 'bg-card text-muted'
                      )}
                    >
                      Prüfungen
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnsicht('bestellung')}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-xs font-medium',
                        ansicht === 'bestellung' ? 'bg-accent text-accent-foreground' : 'bg-card text-muted'
                      )}
                    >
                      Bestellung
                    </button>
                  </>
                )}
              </div>

              <button type="button" onClick={abmelden} aria-label="Mitarbeiter abmelden" className="flex-none text-muted">
                <LogOut className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-4 text-sm text-muted">
              Angemeldet als <span className="font-medium text-foreground">{mitarbeiter.name}</span>
              {istLeitung && ' (Leitung)'}
            </p>

            {ansicht === 'meine-pruefungen' && <MeinePruefungen mitarbeiterId={mitarbeiter.id} />}
            {ansicht === 'lieferanten' && istLeitung && <LieferantenVerwaltung />}
            {ansicht === 'artikel' && istLeitung && <ArtikelVerwaltung />}
            {ansicht === 'pruefungen' && istLeitung && <PruefungenUebersicht mitarbeiterNamen={mitarbeiterNamen} />}
            {ansicht === 'bestellung' && istLeitung && <BestellungUebersicht />}
          </div>
        )}
      </main>
    </>
  )
}
