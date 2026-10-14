'use client'

import { useState, useTransition } from 'react'
import { inhaltSpeichernAktion } from './actions'
import type { WebsiteInhalt } from '@/lib/website/types'

export default function WebsiteInhaltForm({
  inhalt,
  onGespeichert,
}: {
  inhalt: WebsiteInhalt
  onGespeichert: (inhalt: WebsiteInhalt) => void
}) {
  const [werte, setWerte] = useState(inhalt)
  const [gespeichert, setGespeichert] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function feld<K extends keyof WebsiteInhalt>(key: K, wert: WebsiteInhalt[K]) {
    setWerte((prev) => ({ ...prev, [key]: wert }))
    setGespeichert(false)
  }

  function speichern() {
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await inhaltSpeichernAktion(werte)
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler)
        return
      }
      setGespeichert(true)
      onGespeichert(werte)
    })
  }

  return (
    <div className="space-y-4">
      {fehler && <p className="text-sm text-danger">{fehler}</p>}

      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Hero-Bereich (oben auf der Startseite)</h3>
        <div className="space-y-2">
          <input
            value={werte.heroTitel}
            onChange={(e) => feld('heroTitel', e.target.value)}
            placeholder="Titel, z. B. &quot;Café Musterbetrieb&quot;"
            className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
          <input
            value={werte.heroUntertitel}
            onChange={(e) => feld('heroUntertitel', e.target.value)}
            placeholder="Untertitel, z. B. &quot;Frühstück, Mittagstisch & Kaffee im Herzen der Stadt&quot;"
            className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Über uns</h3>
        <textarea
          value={werte.ueberUns}
          onChange={(e) => feld('ueberUns', e.target.value)}
          rows={4}
          placeholder="Ein paar Sätze über euch …"
          className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Tagesmenü</h3>
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" checked={werte.tagesmenuAktiv} onChange={(e) => feld('tagesmenuAktiv', e.target.checked)} />
            Auf der Website anzeigen
          </label>
        </div>
        <textarea
          value={werte.tagesmenuText}
          onChange={(e) => feld('tagesmenuText', e.target.value)}
          rows={3}
          placeholder="z. B. &quot;Heute: Kürbissuppe, Schnitzel mit Kartoffelsalat, Tiramisu&quot;"
          className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
        />
        <p className="mt-2 text-xs text-muted">Zum Tagesaktualisieren – kein Datum, einfach den Text überschreiben.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Kontakt</h3>
        <div className="space-y-2">
          <input
            value={werte.kontaktTelefon}
            onChange={(e) => feld('kontaktTelefon', e.target.value)}
            placeholder="Telefon"
            className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
          <input
            value={werte.kontaktEmail}
            onChange={(e) => feld('kontaktEmail', e.target.value)}
            placeholder="E-Mail"
            className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
          <input
            value={werte.kontaktAdresse}
            onChange={(e) => feld('kontaktAdresse', e.target.value)}
            placeholder="Adresse"
            className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
          <input
            value={werte.instagramUrl ?? ''}
            onChange={(e) => feld('instagramUrl', e.target.value || null)}
            placeholder="Instagram-Link (optional)"
            className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <p className="text-xs text-muted">
        Die Öffnungszeiten auf der Website kommen automatisch aus den Einstellungen im Tischplan-Modul – dort ändern,
        nicht hier.
      </p>

      <button
        type="button"
        onClick={speichern}
        disabled={pending || gespeichert}
        className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground disabled:opacity-40"
      >
        {pending ? 'Speichert…' : gespeichert ? 'Gespeichert' : 'Speichern'}
      </button>
    </div>
  )
}
