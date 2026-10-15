'use client'

import { useState, useTransition } from 'react'
import { Check, Copy } from 'lucide-react'
import type { BenutzerUebersicht } from '@/lib/konten/einladung'
import { benutzerAktivSetzenAktion, einladungErneuernAktion, inhaberEinladenAktion, zweiFaktorZuruecksetzenAktion } from './actions'

// Einladungslink zum Kopieren – auch wenn keine Mail rausging (z. B. ohne
// Resend), lässt er sich so per Messenger weitergeben.
export function EinladungsLink({ link, versendet }: { link: string; versendet: boolean }) {
  const [kopiert, setKopiert] = useState(false)
  return (
    <div className="space-y-1 rounded-lg bg-success-bg p-2 text-xs text-success">
      <p>{versendet ? 'Einladung per E-Mail verschickt.' : 'Keine Mail verschickt (Resend nicht eingerichtet) – Link bitte selbst weitergeben:'}</p>
      <button
        type="button"
        onClick={() =>
          navigator.clipboard.writeText(link).then(() => {
            setKopiert(true)
            setTimeout(() => setKopiert(false), 2000)
          })
        }
        className="flex w-full items-center gap-2 text-left font-mono"
      >
        <span className="min-w-0 flex-1 truncate">{link}</span>
        {kopiert ? <Check className="h-3.5 w-3.5 flex-none" /> : <Copy className="h-3.5 w-3.5 flex-none" />}
      </button>
    </div>
  )
}

export default function KontenVerwaltung({
  organisationId,
  anfangsBenutzer,
}: {
  organisationId: string
  anfangsBenutzer: BenutzerUebersicht[]
}) {
  const [benutzer, setBenutzer] = useState(anfangsBenutzer)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [einladung, setEinladung] = useState<{ link: string; versendet: boolean } | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [resetBestaetigen, setResetBestaetigen] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function ausfuehren(aktion: () => Promise<{ fehler?: string; benutzer?: BenutzerUebersicht[]; link?: string; versendet?: boolean }>) {
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await aktion()
      if (ergebnis.fehler) return setFehler(ergebnis.fehler)
      if (ergebnis.benutzer) setBenutzer(ergebnis.benutzer)
      if (ergebnis.link) setEinladung({ link: ergebnis.link, versendet: !!ergebnis.versendet })
      setResetBestaetigen(null)
    })
  }

  return (
    <div className="space-y-2 rounded-xl border border-border p-3 text-sm">
      <p className="text-xs font-medium text-muted">Verwaltungskonten (Inhaber*in)</p>
      {fehler && <p className="text-xs text-danger">{fehler}</p>}
      {einladung && <EinladungsLink {...einladung} />}

      {benutzer.length === 0 && <p className="text-xs text-locked">Noch kein Konto – ohne Konto kann sich niemand anmelden.</p>}
      <ul className="space-y-1.5">
        {benutzer.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center gap-2 text-xs">
            <span className={b.aktiv ? 'font-medium' : 'text-muted line-through'}>{b.name || b.email}</span>
            {b.name && <span className="text-muted">{b.email}</span>}
            <span className={`rounded-full px-2 py-0.5 ${b.zweiFaktorAktiv ? 'bg-success-bg text-success' : 'bg-locked-bg text-locked'}`}>
              {!b.eingerichtet ? 'Einladung offen' : b.zweiFaktorAktiv ? '2FA aktiv' : '2FA noch nicht eingerichtet'}
            </span>
            {!b.eingerichtet && (
              <button type="button" disabled={pending} onClick={() => ausfuehren(() => einladungErneuernAktion(organisationId, b.id))} className="underline">
                Neuer Einladungslink
              </button>
            )}
            {b.zweiFaktorAktiv &&
              (resetBestaetigen === b.id ? (
                <button type="button" disabled={pending} onClick={() => ausfuehren(() => zweiFaktorZuruecksetzenAktion(organisationId, b.id))} className="font-semibold text-danger">
                  Wirklich zurücksetzen? (Identität geprüft)
                </button>
              ) : (
                <button type="button" onClick={() => setResetBestaetigen(b.id)} className="underline">
                  2FA zurücksetzen
                </button>
              ))}
            <button type="button" disabled={pending} onClick={() => ausfuehren(() => benutzerAktivSetzenAktion(organisationId, b.id, !b.aktiv))} className="underline">
              {b.aktiv ? 'Sperren' : 'Entsperren'}
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2 pt-1">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-Mail" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs" />
        <button
          type="button"
          disabled={pending || !email.trim()}
          onClick={() =>
            ausfuehren(async () => {
              const ergebnis = await inhaberEinladenAktion(organisationId, email, name)
              if (!ergebnis.fehler) {
                setEmail('')
                setName('')
              }
              return ergebnis
            })
          }
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground disabled:opacity-40"
        >
          Einladen
        </button>
      </div>
    </div>
  )
}
