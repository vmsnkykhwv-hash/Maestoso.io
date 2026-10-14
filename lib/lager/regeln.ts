// Berechnet den nächsten Bestelltermin eines Lieferanten rein aus dem
// Kalender (keine Rücksicht auf Feiertage – ein Lieferant liefert im
// Zweifel trotzdem, das regelt die Leitung notfalls manuell). Einzige
// Stelle, die diese Berechnung macht, damit die Fälligkeitsprüfung beim
// Öffnen des Moduls und eine eventuelle spätere Anzeige nie auseinanderlaufen.

import { datumPlusTage, teileAusString, wochentagIndex } from '@/lib/datum'
import type { Lieferant } from './types'

export function naechsterBestelltermin(
  lieferant: Pick<Lieferant, 'zyklusTyp' | 'wochentage' | 'tagImMonat'>,
  ab: string
): string {
  if (lieferant.zyklusTyp === 'woechentlich') {
    if (lieferant.wochentage.length === 0) return ab
    for (let i = 0; i < 7; i++) {
      const kandidat = datumPlusTage(ab, i)
      if (lieferant.wochentage.includes(wochentagIndex(kandidat))) return kandidat
    }
    return ab
  }

  const tag = lieferant.tagImMonat ?? 1
  const { jahr, monat } = teileAusString(ab)
  const kandidatDieserMonat = `${jahr}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`
  if (kandidatDieserMonat >= ab) return kandidatDieserMonat

  const naechsterMonatNr = monat === 12 ? 1 : monat + 1
  const naechstesJahr = monat === 12 ? jahr + 1 : jahr
  return `${naechstesJahr}-${String(naechsterMonatNr).padStart(2, '0')}-${String(tag).padStart(2, '0')}`
}

function tageDifferenz(von: string, bis: string): number {
  const a = teileAusString(von)
  const b = teileAusString(bis)
  const msA = Date.UTC(a.jahr, a.monat - 1, a.tag)
  const msB = Date.UTC(b.jahr, b.monat - 1, b.tag)
  return Math.round((msB - msA) / (24 * 60 * 60 * 1000))
}

// Ob für einen Lieferanten "ab heute" innerhalb seiner Vorlaufzeit eine
// Prüfung fällig ist, und für welchen Bestelltermin.
export function pruefungFaelligkeit(lieferant: Lieferant, heute: string): { bestelldatum: string; istFaellig: boolean } {
  const bestelldatum = naechsterBestelltermin(lieferant, heute)
  const tageBis = tageDifferenz(heute, bestelldatum)
  return { bestelldatum, istFaellig: tageBis <= lieferant.vorlaufTage }
}
