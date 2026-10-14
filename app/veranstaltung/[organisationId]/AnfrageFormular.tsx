'use client'

import { useState, useTransition } from 'react'
import { heuteBerlin } from '@/lib/datum'
import { veranstaltungAnfrageSendenAktion } from './actions'

export default function AnfrageFormular({ organisationId }: { organisationId: string }) {
  const [titel, setTitel] = useState('')
  const [ansprechpartnerName, setAnsprechpartnerName] = useState('')
  const [email, setEmail] = useState('')
  const [telefon, setTelefon] = useState('')
  const [datum, setDatum] = useState('')
  const [beginn, setBeginn] = useState('')
  const [ende, setEnde] = useState('')
  const [geschaetzteGaeste, setGeschaetzteGaeste] = useState('')
  const [notiz, setNotiz] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [erfolg, setErfolg] = useState(false)
  const [sendet, startSenden] = useTransition()

  const bereit =
    titel.trim() && ansprechpartnerName.trim() && email.trim() && telefon.trim() && datum && beginn && ende && Number(geschaetzteGaeste) > 0

  function absenden() {
    if (!bereit) return
    setFehler(null)
    startSenden(async () => {
      const ergebnis = await veranstaltungAnfrageSendenAktion({
        organisationId,
        titel,
        ansprechpartnerName,
        email,
        telefon,
        datum,
        beginn,
        ende,
        geschaetzteGaeste: Number(geschaetzteGaeste),
        notiz,
      })
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler)
        return
      }
      setErfolg(true)
    })
  }

  if (erfolg) {
    return (
      <div className="rounded-2xl border border-success bg-success-bg p-6 text-center">
        <p className="text-sm font-semibold text-success">Anfrage gesendet!</p>
        <p className="mt-1 text-sm text-success">Wir melden uns zeitnah bei euch, um alles Weitere zu klären.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <input
        value={titel}
        onChange={(e) => setTitel(e.target.value)}
        placeholder="Anlass (z. B. Geburtstagsfeier, Firmenfeier)"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      <input
        value={ansprechpartnerName}
        onChange={(e) => setAnsprechpartnerName(e.target.value)}
        placeholder="Name"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="E-Mail"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      <input
        value={telefon}
        onChange={(e) => setTelefon(e.target.value)}
        placeholder="Telefon"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <input
          type="date"
          value={datum}
          min={heuteBerlin()}
          onChange={(e) => setDatum(e.target.value)}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <label className="flex-1 text-xs text-muted">
          Von
          <input type="time" value={beginn} onChange={(e) => setBeginn(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="flex-1 text-xs text-muted">
          Bis
          <input type="time" value={ende} onChange={(e) => setEnde(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
      </div>
      <label className="block text-xs text-muted">
        Geschätzte Gästezahl
        <input
          type="number"
          min={1}
          value={geschaetzteGaeste}
          onChange={(e) => setGeschaetzteGaeste(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </label>
      <textarea
        value={notiz}
        onChange={(e) => setNotiz(e.target.value)}
        placeholder="Weitere Wünsche (optional)"
        rows={3}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />

      {fehler && <p className="text-sm text-danger">{fehler}</p>}

      <button
        type="button"
        onClick={absenden}
        disabled={sendet || !bereit}
        className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground disabled:opacity-40"
      >
        {sendet ? 'Sendet…' : 'Anfrage senden'}
      </button>
    </div>
  )
}
