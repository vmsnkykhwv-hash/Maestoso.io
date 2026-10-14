// Geschäftsregeln für Online-Bestellung (Abholung/Lieferung). Einzige Quelle
// für Kanal-Verfügbarkeit, Zeitfenster und die Buchungsprüfung – wird sowohl
// bei der Slot-Anzeige als auch bei der tatsächlichen Bestellung verwendet,
// genau wie beim Tischplan (siehe dort für die Begründung).
//
// Zentrale Regel (vom Nutzer so gefordert): Bestellungen dürfen die
// tatsächlichen Öffnungszeiten nie überschreiten. Das konfigurierte
// Kanal-Fenster (abholungVon/-Bis bzw. lieferungVon/-Bis) kann die
// Öffnungszeiten nur enger fassen (z. B. Lieferung endet 30 Minuten vor
// Ladenschluss), nie erweitern – deshalb hier immer die Schnittmenge mit
// `oeffnungsfenster()` aus dem Tischplan-Modul (inkl. dessen tagesgenauer
// Ausnahmen), keine eigene, unabhängige Zeitrechnung.
//
// Schutzmechanismus gegen Selbstüberschätzung (wie bei Lieferando & Co.):
// ein Kanal kann befristet pausiert sein (`kanalAktiv`) und hat optional
// eine Obergrenze gleichzeitig offener Bestellungen (`maxOffen...`) – ist
// die erreicht, bietet die Seite online keine weiteren Zeiten mehr an, ganz
// ohne dass das Personal das manuell bemerken und eingreifen muss.

import { teileAusString } from '@/lib/datum'
import { oeffnungsfenster, uhrzeitZuMinuten } from '@/lib/tischplan/regeln'
import type { Einstellungen as TischplanEinstellungen, ReservierungAusnahme } from '@/lib/tischplan/types'
import type { BestellEinstellungen, BestellKanal, BestellSlotVerfuegbarkeit, Bestellung } from './types'

function minutenZuUhrzeit(minuten: number): string {
  const h = Math.floor(minuten / 60)
  const m = minuten % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Schnittmenge aus dem konfigurierten Kanal-Fenster (falls gesetzt) und dem
// tatsächlichen Öffnungsfenster des Tages – `null`, wenn es an diesem Tag
// (oder in diesem Kanal-Fenster) gar keine Überschneidung gibt.
export function bestellFenster(
  tischplanEinstellungen: TischplanEinstellungen,
  datum: string,
  kanal: BestellKanal,
  bestellEinstellungen: Pick<BestellEinstellungen, 'abholungVon' | 'abholungBis' | 'lieferungVon' | 'lieferungBis'>,
  ausnahme?: Pick<ReservierungAusnahme, 'geschlossen' | 'von' | 'bis'> | null
): { start: string; ende: string } | null {
  const oeffnung = oeffnungsfenster(tischplanEinstellungen, datum, ausnahme)
  if (!oeffnung) return null

  const kanalVon = kanal === 'abholung' ? bestellEinstellungen.abholungVon : bestellEinstellungen.lieferungVon
  const kanalBis = kanal === 'abholung' ? bestellEinstellungen.abholungBis : bestellEinstellungen.lieferungBis

  const start = kanalVon && uhrzeitZuMinuten(kanalVon) > uhrzeitZuMinuten(oeffnung.start) ? kanalVon : oeffnung.start
  const ende = kanalBis && uhrzeitZuMinuten(kanalBis) < uhrzeitZuMinuten(oeffnung.ende) ? kanalBis : oeffnung.ende

  if (uhrzeitZuMinuten(start) >= uhrzeitZuMinuten(ende)) return null
  return { start, ende }
}

export function kanalAktiv(
  kanal: BestellKanal,
  einstellungen: Pick<BestellEinstellungen, 'abholungAktiv' | 'lieferungAktiv' | 'abholungPausiertBis' | 'lieferungPausiertBis'>,
  jetzt: Date = new Date()
): { aktiv: boolean; grund?: string } {
  const aktivGeschaltet = kanal === 'abholung' ? einstellungen.abholungAktiv : einstellungen.lieferungAktiv
  if (!aktivGeschaltet) {
    return { aktiv: false, grund: kanal === 'abholung' ? 'Abholung ist aktuell deaktiviert.' : 'Lieferung ist aktuell deaktiviert.' }
  }

  const pausiertBis = kanal === 'abholung' ? einstellungen.abholungPausiertBis : einstellungen.lieferungPausiertBis
  if (pausiertBis && new Date(pausiertBis) > jetzt) {
    return { aktiv: false, grund: kanal === 'abholung' ? 'Abholung ist gerade pausiert.' : 'Lieferung ist gerade pausiert.' }
  }

  return { aktiv: true }
}

export function erzeugeBestellSlots(
  tischplanEinstellungen: TischplanEinstellungen,
  datum: string,
  kanal: BestellKanal,
  bestellEinstellungen: Pick<BestellEinstellungen, 'abholungVon' | 'abholungBis' | 'lieferungVon' | 'lieferungBis' | 'slotMinuten'>,
  ausnahme?: Pick<ReservierungAusnahme, 'geschlossen' | 'von' | 'bis'> | null
): string[] {
  const fenster = bestellFenster(tischplanEinstellungen, datum, kanal, bestellEinstellungen, ausnahme)
  if (!fenster) return []

  const startMin = uhrzeitZuMinuten(fenster.start)
  const endeMin = uhrzeitZuMinuten(fenster.ende)
  const slots: string[] = []
  for (let m = startMin; m < endeMin; m += bestellEinstellungen.slotMinuten) {
    slots.push(minutenZuUhrzeit(m))
  }
  return slots
}

// Minuten zwischen jetzt und datum+uhrzeit (Europe/Berlin) – identisch zur
// Tischplan-Logik, hier dupliziert statt importiert, weil sie dort nicht
// exportiert ist; beide Module nutzen `teileAusString` aus derselben Quelle.
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

function offeneAnzahl(bestellungenDesTages: Pick<Bestellung, 'kanal' | 'status'>[], kanal: BestellKanal): number {
  return bestellungenDesTages.filter((b) => b.kanal === kanal && b.status !== 'abgeschlossen' && b.status !== 'storniert').length
}

export function verfuegbareBestellSlots(params: {
  tischplanEinstellungen: TischplanEinstellungen
  bestellEinstellungen: BestellEinstellungen
  kanal: BestellKanal
  datum: string
  bestellungenDesTages: Pick<Bestellung, 'kanal' | 'status'>[]
  ausnahme?: Pick<ReservierungAusnahme, 'geschlossen' | 'von' | 'bis'> | null
}): BestellSlotVerfuegbarkeit[] {
  const { tischplanEinstellungen, bestellEinstellungen, kanal, datum, bestellungenDesTages, ausnahme } = params

  if (!kanalAktiv(kanal, bestellEinstellungen).aktiv) return []

  const maxOffen = kanal === 'abholung' ? bestellEinstellungen.maxOffenAbholung : bestellEinstellungen.maxOffenLieferung
  if (maxOffen !== null && offeneAnzahl(bestellungenDesTages, kanal) >= maxOffen) return []

  const vorlauf = kanal === 'abholung' ? bestellEinstellungen.vorlaufMinutenAbholung : bestellEinstellungen.vorlaufMinutenLieferung
  const slots = erzeugeBestellSlots(tischplanEinstellungen, datum, kanal, bestellEinstellungen, ausnahme)

  return slots.map((uhrzeit) => ({ uhrzeit, verfuegbar: minutenBisZumTermin(datum, uhrzeit) >= vorlauf }))
}

// Dieselbe Prüfung für genau einen Termin (Bestellung tatsächlich anlegen) –
// gibt bei Nichtverfügbarkeit einen für Gäste verständlichen Grund zurück.
export function pruefeBestellung(params: {
  tischplanEinstellungen: TischplanEinstellungen
  bestellEinstellungen: BestellEinstellungen
  kanal: BestellKanal
  datum: string
  uhrzeit: string
  bestellungenDesTages: Pick<Bestellung, 'kanal' | 'status'>[]
  ausnahme?: Pick<ReservierungAusnahme, 'geschlossen' | 'von' | 'bis'> | null
}): { ok: boolean; grund?: string } {
  const { tischplanEinstellungen, bestellEinstellungen, kanal, datum, uhrzeit, bestellungenDesTages, ausnahme } = params

  const kanalStatus = kanalAktiv(kanal, bestellEinstellungen)
  if (!kanalStatus.aktiv) return { ok: false, grund: kanalStatus.grund }

  const maxOffen = kanal === 'abholung' ? bestellEinstellungen.maxOffenAbholung : bestellEinstellungen.maxOffenLieferung
  if (maxOffen !== null && offeneAnzahl(bestellungenDesTages, kanal) >= maxOffen) {
    return { ok: false, grund: 'Gerade sehr viel los – bitte versucht es in Kürze noch einmal.' }
  }

  const slots = erzeugeBestellSlots(tischplanEinstellungen, datum, kanal, bestellEinstellungen, ausnahme)
  if (!slots.includes(uhrzeit)) {
    return { ok: false, grund: ausnahme?.geschlossen ? 'An diesem Tag ist geschlossen.' : 'Diese Uhrzeit liegt außerhalb der Bestellzeiten.' }
  }

  const vorlauf = kanal === 'abholung' ? bestellEinstellungen.vorlaufMinutenAbholung : bestellEinstellungen.vorlaufMinutenLieferung
  if (minutenBisZumTermin(datum, uhrzeit) < vorlauf) {
    return { ok: false, grund: `Bestellungen brauchen mindestens ${vorlauf} Minuten Vorlauf.` }
  }

  return { ok: true }
}
