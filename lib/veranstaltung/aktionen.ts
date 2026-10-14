// Verknüpft Veranstaltungen mit dem Tischplan-Modul, ohne dessen eigenen
// Code anzufassen (gleicher Aufbau wie lib/bewertung/aktionen.ts für
// Reservierungen/Bestellungen): eine bestätigte Veranstaltung legt eine
// ganz normale Blockierung an (ganzer Betrieb, für den gesamten Zeitraum),
// damit reguläre Tischplan-Reservierungen sich nicht mit ihr überschneiden
// können – die bestehende Kapazitätsprüfung in lib/tischplan/regeln.ts
// greift dann automatisch, ohne eigene Logik dafür zu brauchen.

import { blockierungErstellen, blockierungLoeschen, ladeTische } from '@/lib/tischplan/daten'
import {
  ladeVeranstaltung,
  veranstaltungBlockierungIdSetzen,
  veranstaltungLoeschen,
  veranstaltungStatusAendern,
} from './daten'

export async function veranstaltungBestaetigen(organisationId: string, veranstaltungId: string): Promise<{ fehler?: string }> {
  const veranstaltung = await ladeVeranstaltung(veranstaltungId, organisationId)
  if (!veranstaltung) return { fehler: 'Veranstaltung nicht gefunden' }
  if (veranstaltung.status === 'bestaetigt') return {}

  const tische = await ladeTische(organisationId)
  if (tische.length === 0) return { fehler: 'Noch keine Tische hinterlegt – im Tischplan-Modul mindestens einen Tisch anlegen.' }

  const blockierung = await blockierungErstellen(organisationId, {
    datum: veranstaltung.datum,
    startZeit: veranstaltung.beginn,
    endZeit: veranstaltung.ende,
    anzahlTische: tische.length,
    notiz: 'Veranstaltung: ' + veranstaltung.titel,
  })
  if (blockierung.fehler || !blockierung.blockierung) {
    return { fehler: blockierung.fehler ?? 'Blockierung konnte nicht angelegt werden.' }
  }

  await veranstaltungBlockierungIdSetzen(veranstaltungId, organisationId, blockierung.blockierung.id)
  return veranstaltungStatusAendern(veranstaltungId, organisationId, 'bestaetigt')
}

export async function veranstaltungAbsagen(organisationId: string, veranstaltungId: string): Promise<{ fehler?: string }> {
  const veranstaltung = await ladeVeranstaltung(veranstaltungId, organisationId)
  if (!veranstaltung) return { fehler: 'Veranstaltung nicht gefunden' }

  if (veranstaltung.blockierungId) {
    await blockierungLoeschen(veranstaltung.blockierungId, organisationId)
    await veranstaltungBlockierungIdSetzen(veranstaltungId, organisationId, null)
  }
  return veranstaltungStatusAendern(veranstaltungId, organisationId, 'abgesagt')
}

export async function veranstaltungLoeschenMitBlockierung(organisationId: string, veranstaltungId: string): Promise<{ fehler?: string }> {
  const veranstaltung = await ladeVeranstaltung(veranstaltungId, organisationId)
  if (!veranstaltung) return { fehler: 'Veranstaltung nicht gefunden' }

  if (veranstaltung.blockierungId) await blockierungLoeschen(veranstaltung.blockierungId, organisationId)
  return veranstaltungLoeschen(veranstaltungId, organisationId)
}
