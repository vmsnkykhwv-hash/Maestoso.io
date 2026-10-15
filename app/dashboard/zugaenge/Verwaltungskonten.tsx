'use client'

import { useState, useTransition } from 'react'
import { EinladungsLink } from '@/app/plattform-admin/KontenVerwaltung'
import type { BenutzerUebersicht } from '@/lib/konten/einladung'
import { kontoAktivSetzenAktion, kontoEinladenAktion, kontoEinladungErneuernAktion } from './actions'

export default function Verwaltungskonten({ eigeneKontoId, anfangsBenutzer }: { eigeneKontoId: string; anfangsBenutzer: BenutzerUebersicht[] }) {
  const [benutzer, setBenutzer] = useState(anfangsBenutzer)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [einladung, setEinladung] = useState<{ link: string; versendet: boolean } | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function ausfuehren(aktion: () => Promise<{ fehler?: string; benutzer?: BenutzerUebersicht[]; link?: string; versendet?: boolean }>) {
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await aktion()
      if (ergebnis.fehler) return setFehler(ergebnis.fehler)
      if (ergebnis.benutzer) setBenutzer(ergebnis.benutzer)
      if (ergebnis.link) setEinladung({ link: ergebnis.link, versendet: !!ergebnis.versendet })
    })
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold">Verwaltungskonten</h2>
        <p className="text-xs text-muted">
          Volle Rechte inklusive Einstellungen, Geräte und Zugänge – mit eigenem Passwort und Authenticator-App. Für
          Mitarbeitende ohne Verwaltungsaufgaben reicht ihre PIN am Tresen bzw. ein gekoppeltes Handy.
        </p>
      </div>
      {fehler && <p className="text-xs text-danger">{fehler}</p>}
      {einladung && <EinladungsLink {...einladung} />}
      <ul className="space-y-1.5 text-sm">
        {benutzer.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center gap-2">
            <span className={b.aktiv ? 'font-medium' : 'text-muted line-through'}>{b.name || b.email}</span>
            {b.name && <span className="text-xs text-muted">{b.email}</span>}
            {b.id === eigeneKontoId && <span className="text-xs text-muted">(du)</span>}
            {!b.eingerichtet && <span className="rounded-full bg-locked-bg px-2 py-0.5 text-xs text-locked">Einladung offen</span>}
            {!b.eingerichtet && (
              <button type="button" disabled={pending} onClick={() => ausfuehren(() => kontoEinladungErneuernAktion(b.id))} className="text-xs underline">
                Neuer Link
              </button>
            )}
            {b.id !== eigeneKontoId && (
              <button type="button" disabled={pending} onClick={() => ausfuehren(() => kontoAktivSetzenAktion(b.id, !b.aktiv))} className="text-xs underline">
                {b.aktiv ? 'Sperren' : 'Entsperren'}
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-Mail" type="email" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm" />
        <button
          type="button"
          disabled={pending || !email.trim()}
          onClick={() =>
            ausfuehren(async () => {
              const ergebnis = await kontoEinladenAktion(email, name)
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
