'use client'

import { useState, useTransition } from 'react'
import { passwortAendernAktion, ueberallAbmeldenAktion, wiederherstellungscodesNeuAktion } from '@/app/konto/actions'
import { PASSWORT_MINDESTLAENGE } from '@/lib/konten/regeln'

const FELD = 'w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm'
const KNOPF = 'rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground disabled:opacity-40'

export default function EigenesKonto({ email }: { email: string }) {
  const [alt, setAlt] = useState('')
  const [neu, setNeu] = useState('')
  const [code, setCode] = useState('')
  const [codes, setCodes] = useState<string[] | null>(null)
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null)
  const [pending, startTransition] = useTransition()

  function ausfuehren(aktion: () => Promise<{ fehler?: string }>, erfolg: string, danach?: () => void) {
    setMeldung(null)
    startTransition(async () => {
      const ergebnis = await aktion()
      if (ergebnis.fehler) return setMeldung({ text: ergebnis.fehler, fehler: true })
      setMeldung({ text: erfolg, fehler: false })
      danach?.()
    })
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold">Dein Konto</h2>
        <p className="text-xs text-muted">{email}</p>
      </div>
      {meldung && <p className={`text-xs ${meldung.fehler ? 'text-danger' : 'text-success'}`}>{meldung.text}</p>}

      <div className="space-y-2">
        <p className="text-xs font-medium">Passwort ändern</p>
        <input type="password" value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Aktuelles Passwort" className={FELD} autoComplete="current-password" />
        <input
          type="password"
          value={neu}
          onChange={(e) => setNeu(e.target.value)}
          placeholder={`Neues Passwort (mind. ${PASSWORT_MINDESTLAENGE} Zeichen)`}
          className={FELD}
          autoComplete="new-password"
        />
        <button
          type="button"
          disabled={pending || !alt || !neu}
          onClick={() => ausfuehren(() => passwortAendernAktion(alt, neu), 'Passwort geändert. Alle anderen Geräte sind abgemeldet.', () => { setAlt(''); setNeu('') })}
          className={KNOPF}
        >
          Passwort ändern
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium">Neue Wiederherstellungscodes</p>
        <p className="text-xs text-muted">Die bisherigen Codes werden dabei ungültig.</p>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Aktueller Code aus der App" inputMode="numeric" className={FELD} />
        <button
          type="button"
          disabled={pending || !code}
          onClick={() => {
            setMeldung(null)
            startTransition(async () => {
              const ergebnis = await wiederherstellungscodesNeuAktion(code)
              if (ergebnis.fehler) return setMeldung({ text: ergebnis.fehler, fehler: true })
              setCodes(ergebnis.codes ?? [])
              setCode('')
            })
          }}
          className={KNOPF}
        >
          Codes erzeugen
        </button>
        {codes && (
          <ul className="grid grid-cols-2 gap-1 rounded-lg border border-border p-2 font-mono text-xs">
            {codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium">Auf allen anderen Geräten abmelden</p>
        <button type="button" disabled={pending} onClick={() => ausfuehren(ueberallAbmeldenAktion, 'Alle anderen Geräte sind abgemeldet.')} className={KNOPF}>
          Abmelden
        </button>
      </div>
    </div>
  )
}
