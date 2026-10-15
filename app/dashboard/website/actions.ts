'use server'

import { getBetriebsSitzung } from '@/lib/session'
import {
  bildHochladen,
  bildLoeschen,
  eintragAktualisieren,
  eintragErstellen,
  eintragLoeschen,
  inhaltSpeichern,
  kategorieAktualisieren,
  kategorieErstellen,
  kategorieLoeschen,
  ladeBilder,
  ladeMenuEintraege,
  ladeMenuKategorien,
} from '@/lib/website/daten'
import type { BildRolle, MenuEintrag, MenuKategorie, WebsiteBild, WebsiteInhalt } from '@/lib/website/types'

async function organisationIdOderFehler(): Promise<string> {
  const sitzung = await getBetriebsSitzung()
  if (!sitzung) throw new Error('Nicht angemeldet')
  return sitzung.organisationId
}

export async function inhaltSpeichernAktion(inhalt: WebsiteInhalt): Promise<{ fehler?: string }> {
  const organisationId = await organisationIdOderFehler()
  return inhaltSpeichern(organisationId, inhalt)
}

export async function bildHochladenAktion(datei: File, rolle: BildRolle): Promise<{ fehler?: string; bild?: WebsiteBild }> {
  const organisationId = await organisationIdOderFehler()
  if (rolle === 'galerie') {
    const bestehende = await ladeBilder(organisationId, 'galerie')
    if (bestehende.length >= 12) return { fehler: 'Maximal 12 Bilder in der Galerie' }
  }
  return bildHochladen(organisationId, rolle, datei)
}

export async function bildLoeschenAktion(id: string): Promise<{ fehler?: string }> {
  const organisationId = await organisationIdOderFehler()
  return bildLoeschen(organisationId, id)
}

export async function kategorieErstellenAktion(name: string): Promise<{ fehler?: string; kategorie?: MenuKategorie }> {
  const organisationId = await organisationIdOderFehler()
  return kategorieErstellen(organisationId, name)
}

export async function kategorieAktualisierenAktion(id: string, name: string): Promise<{ fehler?: string }> {
  const organisationId = await organisationIdOderFehler()
  return kategorieAktualisieren(organisationId, id, name)
}

export async function kategorieLoeschenAktion(id: string): Promise<{ fehler?: string }> {
  const organisationId = await organisationIdOderFehler()
  return kategorieLoeschen(organisationId, id)
}

export async function eintragErstellenAktion(input: {
  kategorieId: string
  name: string
  beschreibung?: string
  preis: number
}): Promise<{ fehler?: string; eintrag?: MenuEintrag }> {
  const organisationId = await organisationIdOderFehler()
  return eintragErstellen(organisationId, input)
}

export async function eintragAktualisierenAktion(
  id: string,
  patch: { name?: string; beschreibung?: string | null; preis?: number; aktiv?: boolean }
): Promise<{ fehler?: string }> {
  const organisationId = await organisationIdOderFehler()
  return eintragAktualisieren(organisationId, id, patch)
}

export async function eintragLoeschenAktion(id: string): Promise<{ fehler?: string }> {
  const organisationId = await organisationIdOderFehler()
  return eintragLoeschen(organisationId, id)
}

export async function menuLadenAktion(): Promise<{ kategorien: MenuKategorie[]; eintraege: MenuEintrag[] }> {
  const organisationId = await organisationIdOderFehler()
  const [kategorien, eintraege] = await Promise.all([ladeMenuKategorien(organisationId), ladeMenuEintraege(organisationId)])
  return { kategorien, eintraege }
}
