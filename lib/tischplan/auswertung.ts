import type { Reservierung } from './types'

const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const // Reihenfolge wie JS getUTCDay() (0 = Sonntag)
const WOCHENTAG_REIHENFOLGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const

export type WochentagAuswertung = { wochentag: string; anzahl: number; gaeste: number }
export type StundeAuswertung = { stunde: string; anzahl: number }

export type TischplanAuswertung = {
  gesamtReservierungen: number // bestaetigt + erschienen + nicht_erschienen, ohne Stornos
  gesamtGaeste: number
  durchschnittPersonen: number
  stornoQuote: number // Anteil an allen Buchungen (inkl. Stornos)
  noShowQuote: number // Anteil an den Buchungen, die stattfinden sollten (ohne Stornos)
  proWochentag: WochentagAuswertung[] // Mo -> So
  proStunde: StundeAuswertung[] // nur Stunden mit mindestens einer Reservierung
  meistgefragterWochentag: string | null
  meistgefragteStunde: string | null
}

// Datum kommt als "YYYY-MM-DD" ohne Uhrzeit – als UTC-Mitternacht parsen, dann
// ist der Wochentag unabhängig von der Server-Zeitzone immer korrekt (siehe
// Hinweis zu Europe/Berlin in der Projekt-Dokumentation: eine echte Uhrzeit
// dürfte hier keinesfalls naiv geparst werden, ein reines Datum schon).
function wochentagVon(datum: string): string {
  const tag = new Date(`${datum}T00:00:00Z`).getUTCDay()
  return WOCHENTAGE[tag]
}

export function berechneAuslastung(reservierungen: Reservierung[]): TischplanAuswertung {
  const aktive = reservierungen.filter((r) => r.status !== 'storniert')
  const gesamtGaeste = aktive.reduce((summe, r) => summe + r.anzahlPersonen, 0)
  const nichtErschienen = aktive.filter((r) => r.status === 'nicht_erschienen').length

  const wochentagMap = new Map<string, { anzahl: number; gaeste: number }>()
  for (const tag of WOCHENTAG_REIHENFOLGE) wochentagMap.set(tag, { anzahl: 0, gaeste: 0 })
  const stundeMap = new Map<string, number>()

  for (const r of aktive) {
    const tag = wochentagVon(r.datum)
    const eintrag = wochentagMap.get(tag)!
    eintrag.anzahl += 1
    eintrag.gaeste += r.anzahlPersonen

    const stunde = r.uhrzeit.slice(0, 2)
    stundeMap.set(stunde, (stundeMap.get(stunde) ?? 0) + 1)
  }

  const proWochentag = WOCHENTAG_REIHENFOLGE.map((tag) => ({ wochentag: tag, ...wochentagMap.get(tag)! }))
  const proStunde = [...stundeMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([stunde, anzahl]) => ({ stunde: `${stunde} Uhr`, anzahl }))

  const meistgefragterWochentag = proWochentag.reduce(
    (best, aktuell) => (aktuell.anzahl > (best?.anzahl ?? 0) ? aktuell : best),
    null as WochentagAuswertung | null
  )
  const meistgefragteStunde = proStunde.reduce(
    (best, aktuell) => (aktuell.anzahl > (best?.anzahl ?? 0) ? aktuell : best),
    null as StundeAuswertung | null
  )

  return {
    gesamtReservierungen: aktive.length,
    gesamtGaeste,
    durchschnittPersonen: aktive.length > 0 ? gesamtGaeste / aktive.length : 0,
    stornoQuote: reservierungen.length > 0 ? (reservierungen.length - aktive.length) / reservierungen.length : 0,
    noShowQuote: aktive.length > 0 ? nichtErschienen / aktive.length : 0,
    proWochentag,
    proStunde,
    meistgefragterWochentag: meistgefragterWochentag && meistgefragterWochentag.anzahl > 0 ? meistgefragterWochentag.wochentag : null,
    meistgefragteStunde: meistgefragteStunde && meistgefragteStunde.anzahl > 0 ? meistgefragteStunde.stunde : null,
  }
}
