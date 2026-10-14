'use server'

import { getSitzung } from '@/lib/session'
import { bewertungsEinstellungenSpeichern, ladeBewertungsEinstellungen, ladeBewertungsUebersicht } from '@/lib/bewertung/daten'
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
