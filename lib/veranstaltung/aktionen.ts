// Verknüpft Veranstaltungen mit dem Tischplan-Modul, ohne dessen eigenen
// Code anzufassen (gleicher Aufbau wie lib/bewertung/aktionen.ts für
// Reservierungen/Bestellungen): eine bestätigte Veranstaltung legt eine
// ganz normale Blockierung an (ganzer Betrieb, für den gesamten Zeitraum),
// damit reguläre Tischplan-Reservierungen sich nicht mit ihr überschneiden
// können – die bestehende Kapazitätsprüfung in lib/tischplan/regeln.ts
// greift dann automatisch, ohne eigene Logik dafür zu brauchen.

import { blockierungErstellen, blockierungLoeschen, ladeEinstellungen, ladeReservierungenFuerTag, ladeTische, organisationsName } from '@/lib/tischplan/daten'
import {
  ladeVeranstaltung,
  ladeVeranstaltungenFuerOrganisation,
  veranstaltungStatusBeanspruchen,
  veranstaltungBlockierungIdSetzen,
  veranstaltungLoeschen,
  veranstaltungStatusAendern,
} from './daten'
import { veranstaltungStatusMailSenden } from './email'
import type { Veranstaltung } from './types'

function minuten(uhrzeit: string): number {
  const [h, m] = uhrzeit.split(':').map(Number)
  return h * 60 + m
}

// Was am Tag der Veranstaltung schon fest steht: eine andere bestätigte
// Veranstaltung schließt die Zusage aus (beide würden alle Tische wollen),
// bestehende Reservierungen nur nach Rückfrage – vielleicht passen Feier
// und Gäste ja nebeneinander, oder die Gäste werden umgebucht.
async function konflikte(organisationId: string, v: Veranstaltung): Promise<{ hart?: string; reservierungen: number }> {
  const [veranstaltungen, reservierungen, einstellungen] = await Promise.all([
    ladeVeranstaltungenFuerOrganisation(organisationId),
    ladeReservierungenFuerTag(organisationId, v.datum),
    ladeEinstellungen(organisationId),
  ])
  const von = minuten(v.beginn), bis = minuten(v.ende)
  const andere = veranstaltungen.find(
    (x) => x.id !== v.id && x.status === 'bestaetigt' && x.datum === v.datum && minuten(x.beginn) < bis && minuten(x.ende) > von
  )
  if (andere) return { hart: `Am selben Tag ist schon „${andere.titel}“ von ${andere.beginn} bis ${andere.ende} Uhr bestätigt.`, reservierungen: 0 }
  const ueberschneidend = reservierungen.filter((r) => {
    if (r.status !== 'bestaetigt') return false
    const start = minuten(r.uhrzeit)
    return start < bis && start + einstellungen.dauerMinuten > von
  })
  return { reservierungen: ueberschneidend.length }
}

async function statusMail(organisationId: string, v: Veranstaltung, status: 'bestaetigt' | 'abgesagt') {
  const organisationName = await organisationsName(organisationId)
  if (!organisationName) return
  await veranstaltungStatusMailSenden({
    organisationName,
    empfaenger: v.email,
    ansprechpartnerName: v.ansprechpartnerName,
    titel: v.titel,
    datum: v.datum,
    beginn: v.beginn,
    ende: v.ende,
    status,
  })
}

export async function veranstaltungBestaetigen(
  organisationId: string,
  veranstaltungId: string,
  trotzReservierungen = false
): Promise<{ fehler?: string; rueckfrage?: string }> {
  const veranstaltung = await ladeVeranstaltung(veranstaltungId, organisationId)
  if (!veranstaltung) return { fehler: 'Veranstaltung nicht gefunden' }
  if (veranstaltung.status === 'bestaetigt') return {}

  const tische = await ladeTische(organisationId)
  if (tische.length === 0) return { fehler: 'Noch keine Tische hinterlegt – im Tischplan-Modul mindestens einen Tisch anlegen.' }

  const k = await konflikte(organisationId, veranstaltung)
  if (k.hart) return { fehler: k.hart }
  if (k.reservierungen > 0 && !trotzReservierungen) {
    return {
      rueckfrage: `In dieser Zeit ${k.reservierungen === 1 ? 'gibt es schon 1 Reservierung' : `gibt es schon ${k.reservierungen} Reservierungen`}. Die bleiben bestehen, neue Reservierungen sind dann gesperrt. Trotzdem bestätigen?`,
    }
  }

  const bisher = await veranstaltungStatusBeanspruchen(veranstaltungId, organisationId, ['angefragt', 'abgesagt'], 'bestaetigt')
  if (!bisher) return {}

  const blockierung = await blockierungErstellen(organisationId, {
    datum: veranstaltung.datum,
    startZeit: veranstaltung.beginn,
    endZeit: veranstaltung.ende,
    anzahlTische: tische.length,
    notiz: 'Veranstaltung: ' + veranstaltung.titel,
  })
  if (blockierung.fehler || !blockierung.blockierung) {
    await veranstaltungStatusAendern(veranstaltungId, organisationId, bisher)
    return { fehler: blockierung.fehler ?? 'Blockierung konnte nicht angelegt werden.' }
  }

  await veranstaltungBlockierungIdSetzen(veranstaltungId, organisationId, blockierung.blockierung.id)
  await statusMail(organisationId, veranstaltung, 'bestaetigt')
  return {}
}

export async function veranstaltungAbsagen(organisationId: string, veranstaltungId: string): Promise<{ fehler?: string }> {
  const veranstaltung = await ladeVeranstaltung(veranstaltungId, organisationId)
  if (!veranstaltung) return { fehler: 'Veranstaltung nicht gefunden' }

  const bisher = await veranstaltungStatusBeanspruchen(veranstaltungId, organisationId, ['angefragt', 'bestaetigt'], 'abgesagt')
  if (!bisher) return {}

  if (veranstaltung.blockierungId) {
    await blockierungLoeschen(veranstaltung.blockierungId, organisationId)
    await veranstaltungBlockierungIdSetzen(veranstaltungId, organisationId, null)
  }
  await statusMail(organisationId, veranstaltung, 'abgesagt')
  return {}
}

export async function veranstaltungLoeschenMitBlockierung(organisationId: string, veranstaltungId: string): Promise<{ fehler?: string }> {
  const veranstaltung = await ladeVeranstaltung(veranstaltungId, organisationId)
  if (!veranstaltung) return { fehler: 'Veranstaltung nicht gefunden' }

  if (veranstaltung.blockierungId) await blockierungLoeschen(veranstaltung.blockierungId, organisationId)
  return veranstaltungLoeschen(veranstaltungId, organisationId)
}
