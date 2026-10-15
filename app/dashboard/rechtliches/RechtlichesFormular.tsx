'use client'

import { useState, useTransition } from 'react'
import { angabenVollstaendig, type RechtlicheAngaben } from '@/lib/rechtliches/types'
import { rechtlicheAngabenSpeichernAktion } from './actions'

const FELDER: { key: keyof RechtlicheAngaben; label: string; placeholder: string; pflicht?: boolean }[] = [
  { key: 'firma', label: 'Name bzw. Firma inkl. Rechtsform', placeholder: 'z. B. Café Musterbetrieb GmbH', pflicht: true },
  { key: 'vertretenDurch', label: 'Vertreten durch', placeholder: 'z. B. Geschäftsführerin Maria Muster – bei Einzelunternehmen leer lassen' },
  { key: 'strasse', label: 'Straße und Hausnummer', placeholder: 'z. B. Musterstraße 1', pflicht: true },
  { key: 'plzOrt', label: 'PLZ und Ort', placeholder: 'z. B. 12345 Musterstadt', pflicht: true },
  { key: 'telefon', label: 'Telefon', placeholder: 'z. B. 01234 567890' },
  { key: 'email', label: 'E-Mail', placeholder: 'z. B. hallo@musterbetrieb.de', pflicht: true },
  { key: 'registerEintrag', label: 'Registereintrag', placeholder: 'z. B. Amtsgericht Musterstadt, HRB 12345 – falls eingetragen' },
  { key: 'ustId', label: 'USt-IdNr.', placeholder: 'z. B. DE123456789 – falls vorhanden' },
  { key: 'datenschutzKontakt', label: 'Datenschutzbeauftragte*r', placeholder: 'Name und Kontakt – nur falls benannt' },
]

export default function RechtlichesFormular({
  organisationId,
  anfangsAngaben,
}: {
  organisationId: string
  anfangsAngaben: RechtlicheAngaben
}) {
  const [werte, setWerte] = useState(anfangsAngaben)
  const [gespeichert, setGespeichert] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function feld(key: keyof RechtlicheAngaben, wert: string) {
    setWerte((prev) => ({ ...prev, [key]: wert }))
    setGespeichert(false)
  }

  function speichern() {
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await rechtlicheAngabenSpeichernAktion(werte)
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler)
        return
      }
      setGespeichert(true)
    })
  }

  const vollstaendig = angabenVollstaendig(werte)

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Auf euren Gästeseiten (Website, Reservieren, Bestellen, Gutschein, Veranstaltung) seid ihr der Anbieter.
        Daraus erzeugt Maestoso euer Impressum und eure Datenschutzerklärung, beide sind dort unten verlinkt. Die
        Texte sind eine Vorlage und ersetzen keine Rechtsberatung.
      </p>

      {!vollstaendig && (
        <p className="rounded-xl bg-locked-bg px-4 py-3 text-sm font-medium text-locked">
          Noch unvollständig: Name, Anschrift und E-Mail sind Pflicht. Bis dahin zeigen eure Rechtsseiten nur
          einen Hinweis.
        </p>
      )}

      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        {FELDER.map((f) => (
          <label key={f.key} className="block text-sm font-medium">
            {f.label}
            {f.pflicht && <span className="text-danger"> *</span>}
            <input
              value={werte[f.key]}
              onChange={(e) => feld(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-normal"
            />
          </label>
        ))}
      </div>

      {fehler && <p className="text-sm text-danger">{fehler}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={speichern}
          disabled={pending || gespeichert}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50"
        >
          {pending ? 'Speichert …' : gespeichert ? 'Gespeichert' : 'Speichern'}
        </button>
        <a href={`/website/${organisationId}/impressum`} target="_blank" rel="noreferrer" className="text-sm text-muted underline">
          Impressum ansehen
        </a>
        <a href={`/website/${organisationId}/datenschutz`} target="_blank" rel="noreferrer" className="text-sm text-muted underline">
          Datenschutzerklärung ansehen
        </a>
      </div>
    </div>
  )
}
