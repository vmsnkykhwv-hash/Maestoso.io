'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, LogOut } from 'lucide-react'
import DemoBanner from '@/app/dashboard/DemoBanner'
import { mitarbeiterAbmelden, mitarbeiterAnmelden } from '@/lib/mitarbeiter/aktionen'
import { mitarbeiterNamenLadenAktion } from './actions'
import WochenPlan from './WochenPlan'
import VerfuegbarkeitAnsicht from './VerfuegbarkeitAnsicht'
import TeamVerfuegbarkeit from './TeamVerfuegbarkeit'
import TauschBoerse from './TauschBoerse'
import ExportAnsicht from './ExportAnsicht'
import type { Mitarbeiter } from '@/lib/mitarbeiter/types'
import { cn } from '@/lib/utils'

type Ansicht = 'plan' | 'verfuegbarkeit' | 'team' | 'tausch' | 'export'

export default function DienstplanApp({
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

  const [ansicht, setAnsicht] = useState<Ansicht>('plan')
  const [mitarbeiterNamen, setMitarbeiterNamen] = useState<{ id: string; name: string }[]>([])

  const istLeitung = mitarbeiter?.rolle === 'leitung'

  useEffect(() => {
    if (!mitarbeiter) return
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
    setAnsicht('plan')
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
                  onClick={() => setAnsicht('plan')}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-medium',
                    ansicht === 'plan' ? 'bg-accent text-accent-foreground' : 'bg-card text-muted'
                  )}
                >
                  Wochenplan
                </button>
                <button
                  type="button"
                  onClick={() => setAnsicht('verfuegbarkeit')}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-medium',
                    ansicht === 'verfuegbarkeit' ? 'bg-accent text-accent-foreground' : 'bg-card text-muted'
                  )}
                >
                  Verfügbarkeit
                </button>
                {istLeitung && (
                  <button
                    type="button"
                    onClick={() => setAnsicht('team')}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-xs font-medium',
                      ansicht === 'team' ? 'bg-accent text-accent-foreground' : 'bg-card text-muted'
                    )}
                  >
                    Team-Verfügbarkeit
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAnsicht('tausch')}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-medium',
                    ansicht === 'tausch' ? 'bg-accent text-accent-foreground' : 'bg-card text-muted'
                  )}
                >
                  Tausch-Börse
                </button>
                {istLeitung && (
                  <button
                    type="button"
                    onClick={() => setAnsicht('export')}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-xs font-medium',
                      ansicht === 'export' ? 'bg-accent text-accent-foreground' : 'bg-card text-muted'
                    )}
                  >
                    Export
                  </button>
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

            {ansicht === 'plan' && (
              <WochenPlan mitarbeiter={mitarbeiter} mitarbeiterNamen={mitarbeiterNamen} />
            )}
            {ansicht === 'verfuegbarkeit' && <VerfuegbarkeitAnsicht mitarbeiter={mitarbeiter} />}
            {ansicht === 'team' && istLeitung && <TeamVerfuegbarkeit mitarbeiterNamen={mitarbeiterNamen} />}
            {ansicht === 'tausch' && (
              <TauschBoerse mitarbeiter={mitarbeiter} mitarbeiterNamen={mitarbeiterNamen} />
            )}
            {ansicht === 'export' && istLeitung && <ExportAnsicht />}
          </div>
        )}
      </main>
    </>
  )
}
