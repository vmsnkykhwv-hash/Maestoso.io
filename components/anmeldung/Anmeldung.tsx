'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, Copy } from 'lucide-react'
import { abbrechenAktion, einrichtungAktion, passwortAktion, zweiterFaktorAktion } from '@/app/anmeldung/actions'
import type { KontoArt } from '@/lib/konten/daten'

const FELD = 'mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-normal'
const KNOPF = 'w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground disabled:opacity-40'

export type AnmeldeSchritt = 'passwort' | '2fa' | 'einrichten'

// Ein Ablauf für Plattform-Admin (/login) und Inhaber (/team). Welcher
// Schritt gerade dran ist, entscheidet der Server anhand des
// Zwischen-Cookies – nach jedem Schritt lädt router.refresh() die Seite neu.
export default function Anmeldung({
  art,
  organisationId,
  schritt,
  einrichtung,
  ziel,
  passwortVergessenHref,
}: {
  art: KontoArt
  organisationId?: string
  schritt: AnmeldeSchritt
  einrichtung?: { qrSvg: string; geheimnis: string } | null
  ziel: string
  passwortVergessenHref?: string
}) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [passwort, setPasswort] = useState('')
  const [code, setCode] = useState('')
  const [mitWiederherstellung, setMitWiederherstellung] = useState(false)
  const [codes, setCodes] = useState<string[] | null>(null)
  const [kopiert, setKopiert] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function absenden(e: React.FormEvent) {
    e.preventDefault()
    setFehler(null)
    startTransition(async () => {
      if (schritt === 'passwort') {
        const ergebnis = await passwortAktion(art, email, passwort, organisationId)
        if (ergebnis.fehler) return setFehler(ergebnis.fehler)
        setPasswort('')
        router.refresh()
      } else if (schritt === '2fa') {
        const ergebnis = await zweiterFaktorAktion(code)
        if (ergebnis.fehler) return setFehler(ergebnis.fehler)
        window.location.href = ziel
      } else {
        const ergebnis = await einrichtungAktion(code)
        if (ergebnis.fehler) return setFehler(ergebnis.fehler)
        setCodes(ergebnis.codes ?? [])
      }
    })
  }

  function abbrechen() {
    startTransition(async () => {
      await abbrechenAktion()
      router.refresh()
    })
  }

  if (codes) {
    return (
      <div className="space-y-4 text-left">
        <h2 className="text-base font-semibold">Wiederherstellungscodes sichern</h2>
        <p className="text-sm text-muted">
          Falls dein Handy verloren geht, kommst du mit einem dieser Codes noch rein – jeder funktioniert genau einmal.
          Speichere sie jetzt sicher ab (z. B. ausdrucken oder im Passwort-Manager). Sie werden nicht noch einmal
          angezeigt.
        </p>
        <ul className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-card p-3 font-mono text-sm">
          {codes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() =>
            navigator.clipboard.writeText(codes.join('\n')).then(() => {
              setKopiert(true)
              setTimeout(() => setKopiert(false), 2000)
            })
          }
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm"
        >
          {kopiert ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          Codes kopieren
        </button>
        <button type="button" onClick={() => (window.location.href = ziel)} className={KNOPF}>
          Gesichert – weiter
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={absenden} className="space-y-4 text-left">
      {schritt === 'passwort' && (
        <>
          <label className="block text-sm font-medium">
            E-Mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={FELD} autoComplete="username" required />
          </label>
          <label className="block text-sm font-medium">
            Passwort
            <input
              type="password"
              value={passwort}
              onChange={(e) => setPasswort(e.target.value)}
              className={FELD}
              autoComplete="current-password"
              required
            />
          </label>
        </>
      )}

      {schritt === '2fa' && (
        <label className="block text-sm font-medium">
          {mitWiederherstellung ? 'Wiederherstellungscode' : 'Code aus deiner Authenticator-App'}
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode={mitWiederherstellung ? 'text' : 'numeric'}
            autoComplete="one-time-code"
            placeholder={mitWiederherstellung ? 'abcd-efgh' : '123456'}
            className={FELD}
            autoFocus
            required
          />
        </label>
      )}

      {schritt === 'einrichten' && einrichtung && (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Zum Schutz deines Kontos brauchst du bei jeder Anmeldung zusätzlich einen Code vom Handy. Scanne den QR-Code
            mit einer Authenticator-App (z. B. Google Authenticator, Microsoft Authenticator oder Aegis).
          </p>
          <div
            className="mx-auto w-[200px] rounded-xl bg-white p-2"
            // SVG kommt von der qrcode-Bibliothek auf dem Server, nicht aus Nutzereingaben.
            dangerouslySetInnerHTML={{ __html: einrichtung.qrSvg }}
          />
          <p className="text-center text-xs text-muted">
            Oder von Hand eingeben: <span className="font-mono text-foreground">{einrichtung.geheimnis}</span>
          </p>
          <label className="block text-sm font-medium">
            Code aus der App zur Bestätigung
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              className={FELD}
              required
            />
          </label>
        </div>
      )}

      {fehler && <p className="text-sm font-medium text-danger">{fehler}</p>}

      <button type="submit" disabled={pending} className={KNOPF}>
        {pending ? 'Prüfe…' : schritt === 'passwort' ? 'Weiter' : schritt === '2fa' ? 'Anmelden' : 'Einrichtung abschließen'}
      </button>

      <div className="flex justify-between text-xs text-muted">
        {schritt === 'passwort' && passwortVergessenHref && <Link href={passwortVergessenHref}>Passwort vergessen?</Link>}
        {schritt === '2fa' && (
          <button type="button" onClick={() => setMitWiederherstellung((v) => !v)}>
            {mitWiederherstellung ? 'Code aus der App verwenden' : 'Handy nicht zur Hand? Wiederherstellungscode'}
          </button>
        )}
        {schritt !== 'passwort' && (
          <button type="button" onClick={abbrechen}>
            Abbrechen
          </button>
        )}
      </div>
    </form>
  )
}
