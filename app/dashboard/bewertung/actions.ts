'use server'

import { getSitzung } from '@/lib/session'
import {
  bewertungsEinstellungenSpeichern,
  ladeBewertungsEinstellungen,
  ladeBewertungsUebersicht,
  ladeBewertungsanfragenFuerZeitraum,
  googleSnapshotSpeichern,
  ladeGoogleSnapshots,
} from '@/lib/bewertung/daten'
import { berechneKlickrate, berechneGoogleTrend, type KlickrateAuswertung, type GoogleTrendAuswertung, type GoogleSnapshot } from '@/lib/bewertung/auswertung'
import type { BewertungsEinstellungen, BewertungsListenEintrag } from '@/lib/bewertung/types'

async function organisationIdOderFehler(): Promise<string> {
  const sitzung = await getSitzung()
  if (!sitzung || sitzung.typ !== 'organisation') throw new Error('Nicht angemeldet')
  return sitzung.organisationId
}

export async function einstellungenLadenAktion(): Promise<BewertungsEinstellungen> {
  const organisationId = await organisationIdOderFehler()
  return ladeBewertungsEinstellungen(organisationId)
}

export async function bewertungsUebersichtLadenAktion(): Promise<BewertungsListenEintrag[]> {
  const organisationId = await organisationIdOderFehler()
  return ladeBewertungsUebersicht(organisationId)
}

export async function einstellungenSpeichernAktion(einstellungen: BewertungsEinstellungen): Promise<{ fehler?: string }> {
  const organisationId = await organisationIdOderFehler()
  if (einstellungen.aktiv && !einstellungen.googleUrl?.trim()) {
    return { fehler: 'Ohne Google-Bewertungslink kann die Anfrage nicht aktiviert werden.' }
  }
  return bewertungsEinstellungenSpeichern(organisationId, einstellungen)
}

export async function klickrateLadenAktion(von: string, bis: string): Promise<KlickrateAuswertung> {
  const organisationId = await organisationIdOderFehler()
  const anfragen = await ladeBewertungsanfragenFuerZeitraum(organisationId, von, bis)
  return berechneKlickrate(anfragen)
}

export async function googleTrendLadenAktion(): Promise<GoogleTrendAuswertung> {
  const organisationId = await organisationIdOderFehler()
  const snapshots = await ladeGoogleSnapshots(organisationId)
  return berechneGoogleTrend(snapshots)
}

export async function googleSnapshotSpeichernAktion(snapshot: GoogleSnapshot): Promise<{ fehler?: string }> {
  const organisationId = await organisationIdOderFehler()
  if (snapshot.anzahlBewertungen < 0) return { fehler: 'Anzahl kann nicht negativ sein.' }
  if (snapshot.durchschnitt < 1 || snapshot.durchschnitt > 5) return { fehler: 'Durchschnitt muss zwischen 1 und 5 liegen.' }
  return googleSnapshotSpeichern(organisationId, snapshot)
}
