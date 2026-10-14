import type { Bestellung, BestellKanal } from './types'

const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const // Reihenfolge wie JS getUTCDay() (0 = Sonntag)
const WOCHENTAG_REIHENFOLGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const

// Datum kommt als "YYYY-MM-DD" ohne Uhrzeit – als UTC-Mitternacht parsen, dann
// ist der Wochentag unabhängig von der Server-Zeitzone immer korrekt.
function wochentagVon(datum: string): string {
  const tag = new Date(`${datum}T00:00:00Z`).getUTCDay()
  return WOCHENTAGE[tag]
}

export type BestellungZeile = Pick<Bestellung, 'kanal' | 'status' | 'datum' | 'uhrzeit' | 'gesamtPreis'>

export type WochentagAuswertung = { wochentag: string; anzahl: number; umsatz: number }
export type StundeAuswertung = { stunde: string; anzahl: number }
export type KanalAuswertung = { kanal: BestellKanal; anzahl: number; umsatz: number }

export type BestellungAuswertung = {
  gesamtBestellungen: number // ohne Stornos
  gesamtUmsatz: number
  durchschnittBestellwert: number
  stornoQuote: number
  proKanal: KanalAuswertung[]
  proWochentag: WochentagAuswertung[] // Mo -> So
  proStunde: StundeAuswertung[]
  meistgefragterWochentag: string | null
  meistgefragteStunde: string | null
}

export function berechneBestellAnalyse(bestellungen: BestellungZeile[]): BestellungAuswertung {
  const aktive = bestellungen.filter((b) => b.status !== 'storniert')
  const gesamtUmsatz = aktive.reduce((summe, b) => summe + b.gesamtPreis, 0)

  const wochentagMap = new Map<string, { anzahl: number; umsatz: number }>()
  for (const tag of WOCHENTAG_REIHENFOLGE) wochentagMap.set(tag, { anzahl: 0, umsatz: 0 })
  const stundeMap = new Map<string, number>()
  const kanalMap = new Map<BestellKanal, { anzahl: number; umsatz: number }>([
    ['abholung', { anzahl: 0, umsatz: 0 }],
    ['lieferung', { anzahl: 0, umsatz: 0 }],
  ])

  for (const b of aktive) {
    const tag = wochentagVon(b.datum)
    const tagEintrag = wochentagMap.get(tag)!
    tagEintrag.anzahl += 1
    tagEintrag.umsatz += b.gesamtPreis

    const stunde = b.uhrzeit.slice(0, 2)
    stundeMap.set(stunde, (stundeMap.get(stunde) ?? 0) + 1)

    const kanalEintrag = kanalMap.get(b.kanal)!
    kanalEintrag.anzahl += 1
    kanalEintrag.umsatz += b.gesamtPreis
  }

  const proWochentag = WOCHENTAG_REIHENFOLGE.map((tag) => ({ wochentag: tag, ...wochentagMap.get(tag)! }))
  const proStunde = [...stundeMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([stunde, anzahl]) => ({ stunde: `${stunde} Uhr`, anzahl }))
  const proKanal: KanalAuswertung[] = [...kanalMap.entries()].map(([kanal, werte]) => ({ kanal, ...werte }))

  const meistgefragterWochentag = proWochentag.reduce(
    (best, aktuell) => (aktuell.anzahl > (best?.anzahl ?? 0) ? aktuell : best),
    null as WochentagAuswertung | null
  )
  const meistgefragteStunde = proStunde.reduce(
    (best, aktuell) => (aktuell.anzahl > (best?.anzahl ?? 0) ? aktuell : best),
    null as StundeAuswertung | null
  )

  return {
    gesamtBestellungen: aktive.length,
    gesamtUmsatz,
    durchschnittBestellwert: aktive.length > 0 ? gesamtUmsatz / aktive.length : 0,
    stornoQuote: bestellungen.length > 0 ? (bestellungen.length - aktive.length) / bestellungen.length : 0,
    proKanal,
    proWochentag,
    proStunde,
    meistgefragterWochentag: meistgefragterWochentag && meistgefragterWochentag.anzahl > 0 ? meistgefragterWochentag.wochentag : null,
    meistgefragteStunde: meistgefragteStunde && meistgefragteStunde.anzahl > 0 ? meistgefragteStunde.stunde : null,
  }
}
