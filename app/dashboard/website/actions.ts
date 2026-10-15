'use server'

import { verwaltungFuer } from '@/lib/zugriff'
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
import { mitProtokoll } from '@/lib/protokoll'

// Das ganze Modul ist Verwaltung (Inhalte bzw. Einstellungen des Betriebs),
// am Tresen und auf Mitarbeiter-Handys nicht erreichbar.
async function organisationIdOderFehler(): Promise<string> {
  return (await verwaltungFuer('website')).organisationId
}

export async function inhaltSpeichernAktion(inhalt: WebsiteInhalt): Promise<{ fehler?: string }> {
  const organisationId = await organisationIdOderFehler()
  return mitProtokoll(inhaltSpeichern(organisationId, inhalt), 'website', 'Inhalt geändert', null, null)
}

export async function bildHochladenAktion(datei: File, rolle: BildRolle): Promise<{ fehler?: string; bild?: WebsiteBild }> {
  const organisationId = await organisationIdOderFehler()
  if (rolle === 'galerie') {
    const bestehende = await ladeBilder(organisationId, 'galerie')
    if (bestehende.length >= 12) return { fehler: 'Maximal 12 Bilder in der Galerie' }
  }
  return mitProtokoll(bildHochladen(organisationId, rolle, datei), 'website', 'Bild hochgeladen', rolle, null)
}

export async function bildLoeschenAktion(id: string): Promise<{ fehler?: string }> {
  const organisationId = await organisationIdOderFehler()
  return mitProtokoll(bildLoeschen(organisationId, id), 'website', 'Bild gelöscht', null, id)
}

export async function kategorieErstellenAktion(name: string): Promise<{ fehler?: string; kategorie?: MenuKategorie }> {
  const organisationId = await organisationIdOderFehler()
  return mitProtokoll(kategorieErstellen(organisationId, name), 'website', 'Speisekarte: Kategorie angelegt', name, null)
}

export async function kategorieAktualisierenAktion(id: string, name: string): Promise<{ fehler?: string }> {
  const organisationId = await organisationIdOderFehler()
  return mitProtokoll(kategorieAktualisieren(organisationId, id, name), 'website', 'Speisekarte: Kategorie geändert', name, id)
}

export async function kategorieLoeschenAktion(id: string): Promise<{ fehler?: string }> {
  const organisationId = await organisationIdOderFehler()
  return mitProtokoll(kategorieLoeschen(organisationId, id), 'website', 'Speisekarte: Kategorie gelöscht', null, id)
}

export async function eintragErstellenAktion(input: {
  kategorieId: string
  name: string
  beschreibung?: string
  preis: number
}): Promise<{ fehler?: string; eintrag?: MenuEintrag }> {
  const organisationId = await organisationIdOderFehler()
  return mitProtokoll(eintragErstellen(organisationId, input), 'website', 'Speisekarte: Eintrag angelegt', input.name, null)
}

export async function eintragAktualisierenAktion(
  id: string,
  patch: { name?: string; beschreibung?: string | null; preis?: number; aktiv?: boolean }
): Promise<{ fehler?: string }> {
  const organisationId = await organisationIdOderFehler()
  return mitProtokoll(eintragAktualisieren(organisationId, id, patch), 'website', 'Speisekarte: Eintrag geändert', null, id)
}

export async function eintragLoeschenAktion(id: string): Promise<{ fehler?: string }> {
  const organisationId = await organisationIdOderFehler()
  return mitProtokoll(eintragLoeschen(organisationId, id), 'website', 'Speisekarte: Eintrag gelöscht', null, id)
}

export async function menuLadenAktion(): Promise<{ kategorien: MenuKategorie[]; eintraege: MenuEintrag[] }> {
  const organisationId = await organisationIdOderFehler()
  const [kategorien, eintraege] = await Promise.all([ladeMenuKategorien(organisationId), ladeMenuEintraege(organisationId)])
  return { kategorien, eintraege }
}
