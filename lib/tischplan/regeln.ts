// Buchungsregeln für Tischplan & Reservierungen. Einzige Quelle für die
// Verfügbarkeitsprüfung – wird sowohl beim Aufbau der Slot-Auswahl (Gast
// sieht freie Zeiten) als auch bei der tatsächlichen Buchung verwendet,
// beides serverseitig. Im Ursprungsprojekt (liva-bad-nauheim) war dieselbe
// Logik einmal im Browser (zum Ausgrauen) und einmal im API-Handler
// dupliziert; hier bewusst nur einmal vorhanden, damit beide nie
// auseinanderlaufen können.
//
// Das Kapazitätsmodell ist wie im Original eine reine Zählung virtueller
// Tisch-Slots (ein Tisch = ein belegter Slot im Überschneidungsfenster,
// unabhängig von der tatsächlichen Sitzplatzkapazität) plus ein globales
// Gäste-Limit – keine Zuordnung zu einem bestimmten physischen Tisch nach
// Kapazität. Die echten `tische` (siehe types.ts) dienen hier nur als
// Gesamtzahl verfügbarer Slots; welcher konkrete Tisch belegt wird, weist
// das Personal optional manuell zu (reine Organisation, keine
// Verfügbarkeitslogik).

import { teileAusString } from '@/lib/datum'
import type { Blockierung, Einstellungen, ReservierungAusnahme, Reservierung, SlotVerfuegbarkeit } from './types'

function ostersonntag(jahr: number): { monat: number; tag: number } {
  // Gauß'sche Osterformel.
  const a = jahr % 19
  const b = Math.floor(jahr / 100)
  const c = jahr % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const monat = Math.floor((h + l - 7 * m + 114) / 31)
  const tag = ((h + l - 7 * m + 114) % 31) + 1
  return { monat, tag }
}

function datumString(jahr: number, monat: number, tag: number): string {
  return `${jahr}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`
}

function plusTage(jahr: number, monat: number, tag: number, versatz: number): { jahr: number; monat: number; tag: number } {
  const d = new Date(Date.UTC(jahr, monat - 1, tag))
  d.setUTCDate(d.getUTCDate() + versatz)
  return { jahr: d.getUTCFullYear(), monat: d.getUTCMonth() + 1, tag: d.getUTCDate() }
}

// Gesetzliche Feiertage in Hessen für ein Kalenderjahr, als Set von
// "YYYY-MM-DD"-Strings.
export function feiertageHessen(jahr: number): Set<string> {
  const ostern = ostersonntag(jahr)
  const karfreitag = plusTage(jahr, ostern.monat, ostern.tag, -2)
  const ostermontag = plusTage(jahr, ostern.monat, ostern.tag, 1)
  const himmelfahrt = plusTage(jahr, ostern.monat, ostern.tag, 39)
  const pfingstmontag = plusTage(jahr, ostern.monat, ostern.tag, 50)
  const fronleichnam = plusTage(jahr, ostern.monat, ostern.tag, 60)

  return new Set([
    datumString(jahr, 1, 1),
    datumString(karfreitag.jahr, karfreitag.monat, karfreitag.tag),
    datumString(ostermontag.jahr, ostermontag.monat, ostermontag.tag),
    datumString(jahr, 5, 1),
    datumString(himmelfahrt.jahr, himmelfahrt.monat, himmelfahrt.tag),
    datumString(pfingstmontag.jahr, pfingstmontag.monat, pfingstmontag.tag),
    datumString(fronleichnam.jahr, fronleichnam.monat, fronleichnam.tag),
    datumString(jahr, 10, 3),
    datumString(jahr, 12, 25),
    datumString(jahr, 12, 26),
  ])
}

export function istSonntagOderFeiertag(datum: string): boolean {
  const { jahr, monat, tag } = teileAusString(datum)
  const d = new Date(Date.UTC(jahr, monat - 1, tag))
  if (d.getUTCDay() === 0) return true
  return feiertageHessen(jahr).has(datum)
}

// Einmalige Ausnahme (siehe reservierung_ausnahmen) hat immer Vorrang vor
// der regulären Wochentag-Regel – `null` bedeutet "an diesem Tag ganz
// geschlossen" (keine Slots, egal was die Wochentag-Regel sagen würde).
export function oeffnungsfenster(
  einstellungen: Einstellungen,
  datum: string,
  ausnahme?: Pick<ReservierungAusnahme, 'geschlossen' | 'von' | 'bis'> | null
): { start: string; ende: string } | null {
  if (ausnahme) {
    if (ausnahme.geschlossen) return null
    return { start: ausnahme.von!, ende: ausnahme.bis! }
  }
  if (istSonntagOderFeiertag(datum)) {
    return { start: einstellungen.sonntagStart, ende: einstellungen.sonntagEnde }
  }
  return { start: einstellungen.wocheStart, ende: einstellungen.wocheEnde }
}

export function uhrzeitZuMinuten(zeit: string): number {
  const [h, m] = zeit.split(':').map(Number)
  return h * 60 + m
}

function minutenZuUhrzeit(minuten: number): string {
  const h = Math.floor(minuten / 60)
  const m = minuten % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function erzeugeSlots(
  einstellungen: Einstellungen,
  datum: string,
  ausnahme?: Pick<ReservierungAusnahme, 'geschlossen' | 'von' | 'bis'> | null
): string[] {
  const fenster = oeffnungsfenster(einstellungen, datum, ausnahme)
  if (!fenster) return []
  const { start, ende } = fenster
  const startMin = uhrzeitZuMinuten(start)
  const endeMin = uhrzeitZuMinuten(ende)
  const slots: string[] = []
  for (let m = startMin; m < endeMin; m += einstellungen.slotMinuten) {
    slots.push(minutenZuUhrzeit(m))
  }
  return slots
}

function ueberlappt(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA
}

// Wie viele der `gesamtTische` Slots in [uhrzeit, uhrzeit+dauer) durch
// bestehende Reservierungen oder Blockierungen schon belegt sind, und wie
// viele Gäste in diesem Fenster insgesamt schon reserviert haben.
function belegungFuerSlot(
  einstellungen: Einstellungen,
  uhrzeit: string,
  reservierungenDesTages: Pick<Reservierung, 'uhrzeit' | 'anzahlPersonen' | 'status'>[],
  blockierungenDesTages: Pick<Blockierung, 'startZeit' | 'endZeit' | 'anzahlTische'>[]
): { belegteTische: number; belegtePersonen: number } {
  const start = uhrzeitZuMinuten(uhrzeit)
  const ende = start + einstellungen.dauerMinuten

  let belegteTische = 0
  let belegtePersonen = 0

  for (const r of reservierungenDesTages) {
    if (r.status === 'storniert' || r.status === 'nicht_erschienen') continue
    const rStart = uhrzeitZuMinuten(r.uhrzeit)
    const rEnde = rStart + einstellungen.dauerMinuten
    if (ueberlappt(start, ende, rStart, rEnde)) {
      belegteTische += 1
      belegtePersonen += r.anzahlPersonen
    }
  }

  for (const b of blockierungenDesTages) {
    const bStart = uhrzeitZuMinuten(b.startZeit)
    const bEnde = uhrzeitZuMinuten(b.endZeit)
    if (ueberlappt(start, ende, bStart, bEnde)) {
      belegteTische += b.anzahlTische
    }
  }

  return { belegteTische, belegtePersonen }
}

// Minuten zwischen jetzt und dem Zeitpunkt datum+uhrzeit (beide als
// Europe/Berlin-Wanduhrzeit interpretiert).
function minutenBisZumTermin(datum: string, uhrzeit: string): number {
  const { jahr, monat, tag } = teileAusString(datum)
  const [h, m] = uhrzeit.split(':').map(Number)
  const termin = Date.UTC(jahr, monat - 1, tag, h, m)

  const jetzt = new Date()
  const parts = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(jetzt)
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value)
  const jetztBerlin = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'))

  return (termin - jetztBerlin) / (60 * 1000)
}

export function verfuegbareSlots(params: {
  einstellungen: Einstellungen
  gesamtTische: number
  anzahlPersonen: number
  datum: string
  reservierungenDesTages: Pick<Reservierung, 'uhrzeit' | 'anzahlPersonen' | 'status'>[]
  blockierungenDesTages: Pick<Blockierung, 'startZeit' | 'endZeit' | 'anzahlTische'>[]
  ausnahme?: Pick<ReservierungAusnahme, 'geschlossen' | 'von' | 'bis'> | null
}): SlotVerfuegbarkeit[] {
  const { einstellungen, gesamtTische, anzahlPersonen, datum, reservierungenDesTages, blockierungenDesTages, ausnahme } = params
  const slots = erzeugeSlots(einstellungen, datum, ausnahme)

  return slots.map((uhrzeit) => {
    if (minutenBisZumTermin(datum, uhrzeit) < einstellungen.vorlaufMinuten) {
      return { uhrzeit, verfuegbar: false }
    }
    const { belegteTische, belegtePersonen } = belegungFuerSlot(
      einstellungen,
      uhrzeit,
      reservierungenDesTages,
      blockierungenDesTages
    )
    const verfuegbar =
      belegteTische < gesamtTische && belegtePersonen + anzahlPersonen <= einstellungen.maxPersonenGleichzeitig
    return { uhrzeit, verfuegbar }
  })
}

// Dieselbe Prüfung für genau einen Termin (Buchung tatsächlich anlegen) –
// gibt bei Nichtverfügbarkeit einen für Gäste verständlichen Grund zurück.
export function pruefeBuchung(params: {
  einstellungen: Einstellungen
  gesamtTische: number
  anzahlPersonen: number
  datum: string
  uhrzeit: string
  reservierungenDesTages: Pick<Reservierung, 'uhrzeit' | 'anzahlPersonen' | 'status'>[]
  blockierungenDesTages: Pick<Blockierung, 'startZeit' | 'endZeit' | 'anzahlTische'>[]
  ausnahme?: Pick<ReservierungAusnahme, 'geschlossen' | 'von' | 'bis'> | null
}): { ok: boolean; grund?: string } {
  const { einstellungen, gesamtTische, anzahlPersonen, datum, uhrzeit, reservierungenDesTages, blockierungenDesTages, ausnahme } = params

  if (anzahlPersonen < einstellungen.minPersonen || anzahlPersonen > einstellungen.maxPersonenOnline) {
    return { ok: false, grund: `Online buchbar sind ${einstellungen.minPersonen} bis ${einstellungen.maxPersonenOnline} Personen.` }
  }

  const slots = erzeugeSlots(einstellungen, datum, ausnahme)
  if (!slots.includes(uhrzeit)) {
    return { ok: false, grund: ausnahme?.geschlossen ? 'An diesem Tag ist geschlossen.' : 'Diese Uhrzeit liegt außerhalb der Öffnungszeiten.' }
  }

  if (minutenBisZumTermin(datum, uhrzeit) < einstellungen.vorlaufMinuten) {
    return { ok: false, grund: `Reservierungen brauchen mindestens ${einstellungen.vorlaufMinuten} Minuten Vorlauf.` }
  }

  const { belegteTische, belegtePersonen } = belegungFuerSlot(
    einstellungen,
    uhrzeit,
    reservierungenDesTages,
    blockierungenDesTages
  )

  if (belegteTische >= gesamtTische) {
    return { ok: false, grund: 'Zu diesem Zeitpunkt ist leider kein Tisch mehr frei.' }
  }

  if (belegtePersonen + anzahlPersonen > einstellungen.maxPersonenGleichzeitig) {
    return { ok: false, grund: 'Zu diesem Zeitpunkt ist das Haus leider schon ausgebucht.' }
  }

  return { ok: true }
}
