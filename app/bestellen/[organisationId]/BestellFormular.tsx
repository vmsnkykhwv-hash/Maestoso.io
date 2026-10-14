'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { heuteBerlin } from '@/lib/datum'
import { bestellSlotsLadenAktion, bestellungAnlegenAktion, kanaeleLadenAktion, speisekarteLadenAktion } from './actions'
import type { BestellKanal, BestellSlotVerfuegbarkeit } from '@/lib/bestellung/types'
import type { MenuEintrag, MenuKategorie } from '@/lib/website/types'
import { cn } from '@/lib/utils'

const KANAL_LABEL: Record<BestellKanal, string> = { abholung: 'Abholen', lieferung: 'Liefern' }

function formatPreis(preis: number): string {
  return preis.toFixed(2).replace('.', ',') + ' €'
}

export default function BestellFormular({ organisationId }: { organisationId: string }) {
  const [kanaele, setKanaele] = useState<Record<BestellKanal, { moeglich: boolean; grund?: string }> | null>(null)
  const [kategorien, setKategorien] = useState<MenuKategorie[]>([])
  const [eintraege, setEintraege] = useState<MenuEintrag[]>([])
  const [ladenGrundlagen, startLadenGrundlagen] = useTransition()

  const [kanal, setKanal] = useState<BestellKanal | null>(null)
  const [warenkorb, setWarenkorb] = useState<Record<string, number>>({})
  const [datum, setDatum] = useState(heuteBerlin())
  const [slots, setSlots] = useState<BestellSlotVerfuegbarkeit[]>([])
  const [uhrzeit, setUhrzeit] = useState<string | null>(null)
  const [ladenSlots, startLadenSlots] = useTransition()

  const [name, setName] = useState('')
  const [telefon, setTelefon] = useState('')
  const [email, setEmail] = useState('')
  const [adresse, setAdresse] = useState('')
  const [notiz, setNotiz] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [erfolg, setErfolg] = useState(false)
  const [sendet, startSenden] = useTransition()

  useEffect(() => {
    startLadenGrundlagen(async () => {
      const [k, speisekarte] = await Promise.all([kanaeleLadenAktion(organisationId), speisekarteLadenAktion(organisationId)])
      setKanaele(k)
      setKategorien(speisekarte.kategorien)
      setEintraege(speisekarte.eintraege)
    })
  }, [organisationId])

  useEffect(() => {
    if (!kanal) return
    startLadenSlots(async () => {
      setSlots(await bestellSlotsLadenAktion(organisationId, kanal, datum))
    })
  }, [organisationId, kanal, datum])

  const warenkorbPositionen = useMemo(
    () =>
      Object.entries(warenkorb)
        .filter(([, menge]) => menge > 0)
        .map(([eintragId, menge]) => {
          const eintrag = eintraege.find((e) => e.id === eintragId)!
          return { eintrag, menge }
        }),
    [warenkorb, eintraege]
  )
  const gesamtPreis = warenkorbPositionen.reduce((summe, p) => summe + p.eintrag.preis * p.menge, 0)

  function mengeAendern(eintragId: string, delta: number) {
    setWarenkorb((prev) => ({ ...prev, [eintragId]: Math.max(0, (prev[eintragId] ?? 0) + delta) }))
  }

  function kanalWaehlen(wert: BestellKanal) {
    setUhrzeit(null)
    setKanal(wert)
  }

  function datumAendern(wert: string) {
    setUhrzeit(null)
    setDatum(wert)
  }

  function absenden() {
    if (!kanal || !uhrzeit || !name.trim() || !telefon.trim() || warenkorbPositionen.length === 0) return
    if (kanal === 'lieferung' && !adresse.trim()) return
    setFehler(null)
    startSenden(async () => {
      const ergebnis = await bestellungAnlegenAktion({
        organisationId,
        kanal,
        name,
        telefon,
        email: email.trim() || undefined,
        adresse: kanal === 'lieferung' ? adresse : undefined,
        datum,
        uhrzeit,
        notiz: notiz.trim() || undefined,
        positionen: warenkorbPositionen.map((p) => ({ eintragId: p.eintrag.id, menge: p.menge })),
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
        <p className="text-sm font-semibold text-success">Bestellung aufgegeben!</p>
        <p className="mt-1 text-sm text-success">
          {KANAL_LABEL[kanal!]} am {datum} um {uhrzeit} Uhr · {formatPreis(gesamtPreis)}. Wir melden uns, falls es Rückfragen gibt.
        </p>
      </div>
    )
  }

  if (ladenGrundlagen || !kanaele) {
    return <p className="text-sm text-muted">Lade…</p>
  }

  if (!kanaele.abholung.moeglich && !kanaele.lieferung.moeglich) {
    return (
      <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">
        Online-Bestellung ist gerade nicht möglich. {kanaele.abholung.grund ?? kanaele.lieferung.grund}
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {(['abholung', 'lieferung'] as const).map((k) => (
          <button
            key={k}
            type="button"
            disabled={!kanaele[k].moeglich}
            onClick={() => kanalWaehlen(k)}
            className={cn(
              'rounded-xl py-2.5 text-sm font-medium',
              !kanaele[k].moeglich && 'cursor-not-allowed bg-background text-muted opacity-40',
              kanaele[k].moeglich && kanal !== k && 'bg-card text-foreground',
              kanaele[k].moeglich && kanal === k && 'bg-accent text-accent-foreground'
            )}
          >
            {KANAL_LABEL[k]}
          </button>
        ))}
      </div>
      {kanal && !kanaele[kanal === 'abholung' ? 'lieferung' : 'abholung'].moeglich && (
        <p className="text-xs text-muted">{kanaele[kanal === 'abholung' ? 'lieferung' : 'abholung'].grund}</p>
      )}

      {kanal && (
        <>
          <div className="space-y-4">
            {kategorien.map((kategorie) => {
              const eintraegeDerKategorie = eintraege.filter((e) => e.kategorieId === kategorie.id)
              if (eintraegeDerKategorie.length === 0) return null
              return (
                <div key={kategorie.id}>
                  <h3 className="mb-2 text-sm font-semibold text-muted">{kategorie.name}</h3>
                  <ul className="space-y-2">
                    {eintraegeDerKategorie.map((eintrag) => (
                      <li key={eintrag.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{eintrag.name}</p>
                          <p className="text-xs text-muted">{formatPreis(eintrag.preis)}</p>
                        </div>
                        <div className="flex flex-none items-center gap-2">
                          <button
                            type="button"
                            onClick={() => mengeAendern(eintrag.id, -1)}
                            disabled={(warenkorb[eintrag.id] ?? 0) === 0}
                            className="h-7 w-7 rounded-lg bg-background text-sm font-semibold disabled:opacity-30"
                          >
                            −
                          </button>
                          <span className="w-4 text-center text-sm">{warenkorb[eintrag.id] ?? 0}</span>
                          <button type="button" onClick={() => mengeAendern(eintrag.id, 1)} className="h-7 w-7 rounded-lg bg-background text-sm font-semibold">
                            +
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>

          {warenkorbPositionen.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Warenkorb</span>
                <span>{formatPreis(gesamtPreis)}</span>
              </div>
              <ul className="mt-1.5 space-y-0.5 text-xs text-muted">
                {warenkorbPositionen.map((p) => (
                  <li key={p.eintrag.id}>
                    {p.menge}× {p.eintrag.name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {warenkorbPositionen.length > 0 && (
            <>
              <input
                type="date"
                value={datum}
                min={heuteBerlin()}
                onChange={(e) => datumAendern(e.target.value)}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
              />

              {ladenSlots ? (
                <p className="text-sm text-muted">Lade freie Zeiten…</p>
              ) : slots.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">
                  An diesem Tag ist leider keine {KANAL_LABEL[kanal].toLowerCase()} Bestellung möglich.
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {slots.map((s) => (
                    <button
                      key={s.uhrzeit}
                      type="button"
                      disabled={!s.verfuegbar}
                      onClick={() => setUhrzeit(s.uhrzeit)}
                      className={cn(
                        'rounded-lg py-2 text-xs font-medium',
                        !s.verfuegbar && 'cursor-not-allowed bg-background text-muted opacity-40',
                        s.verfuegbar && uhrzeit !== s.uhrzeit && 'bg-card text-foreground',
                        s.verfuegbar && uhrzeit === s.uhrzeit && 'bg-accent text-accent-foreground'
                      )}
                    >
                      {s.uhrzeit}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {uhrzeit && (
            <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <input
                value={telefon}
                onChange={(e) => setTelefon(e.target.value)}
                placeholder="Telefon (für Rückfragen)"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-Mail (optional)"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              {kanal === 'lieferung' && (
                <input
                  value={adresse}
                  onChange={(e) => setAdresse(e.target.value)}
                  placeholder="Lieferadresse"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              )}
              <input
                value={notiz}
                onChange={(e) => setNotiz(e.target.value)}
                placeholder="Notiz (optional), z. B. ohne Zwiebeln"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />

              {fehler && <p className="text-sm text-danger">{fehler}</p>}

              <button
                type="button"
                onClick={absenden}
                disabled={sendet || !name.trim() || !telefon.trim() || (kanal === 'lieferung' && !adresse.trim())}
                className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground disabled:opacity-40"
              >
                {sendet ? 'Bestellt…' : `Für ${formatPreis(gesamtPreis)} bestellen`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
