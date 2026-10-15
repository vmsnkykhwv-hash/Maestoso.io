'use server'

import { getServiceClient } from '@/lib/supabase/server'
import { pinHashErstellen } from '@/lib/pinHash'
import { ladeMitarbeiter, ladeMitarbeiterListe, MITARBEITER_SPALTEN, mitarbeiterAusZeile, pinInOrganisationVergeben } from '@/lib/mitarbeiter/daten'
import { MITARBEITER_PIN, pinFehler } from '@/lib/pinRegeln'
import { aktionFuer, verwaltungFuer } from '@/lib/zugriff'
import type { Mitarbeiter, MitarbeiterRolle, MitarbeiterTyp } from '@/lib/mitarbeiter/types'
import { ladeZeiteintraege } from '@/lib/zeiterfassung/daten'
import { dokumentHochladen, dokumentLoeschen, ladeDokumenteFuerMitarbeiter } from '@/lib/zeiterfassung/dokumente'
import type { EintragArt, MitarbeiterDokument, Zeiteintrag } from '@/lib/zeiterfassung/types'

// Eigene Zeiten: ansehen auch vom gekoppelten Handy, erfassen/ändern nur am
// Tresen-Gerät (damit niemand von zu Hause aus stempelt). Das
// Verwaltungskonto darf die Zeiten aller Mitarbeitenden des Betriebs sehen
// und korrigieren.
async function zugriffAufZeiten(mitarbeiterId: string, schreiben: boolean): Promise<string> {
  const sitzung = await aktionFuer('zeiterfassung', schreiben ? { ohneHandy: true } : {})
  if (sitzung.art === 'inhaber') {
    // Die ID kommt vom Client – ohne diese Prüfung ließe sich ein Eintrag
    // für eine Person eines fremden Betriebs anlegen.
    if (!(await ladeMitarbeiter(mitarbeiterId, sitzung.organisationId))) throw new Error('Mitarbeiter nicht gefunden')
    return sitzung.organisationId
  }
  if (sitzung.mitarbeiter?.id !== mitarbeiterId) throw new Error('Keine Berechtigung')
  return sitzung.organisationId
}

function istGrenzFehler(message: string | undefined): string | undefined {
  if (message && (message.includes('Wochengrenze') || message.includes('Monatsgrenze'))) {
    return message
  }
  return undefined
}

export async function zeiteintraegeLadenAktion(mitarbeiterId: string, von: string, bis: string): Promise<Zeiteintrag[]> {
  const organisationId = await zugriffAufZeiten(mitarbeiterId, false)
  return ladeZeiteintraege(mitarbeiterId, organisationId, von, bis)
}

export async function mitarbeiterListeLadenAktion(): Promise<Mitarbeiter[]> {
  const sitzung = await verwaltungFuer('zeiterfassung')
  return ladeMitarbeiterListe(sitzung.organisationId)
}

export async function zeiteintragSpeichern(eintrag: {
  id?: string
  mitarbeiterId: string
  arbeitstag: string
  art: EintragArt
  beginn: string | null
  ende: string | null
  pauseMinuten: number
  notiz: string | null
}): Promise<{ fehler?: string; eintrag?: Zeiteintrag }> {
  const organisationId = await zugriffAufZeiten(eintrag.mitarbeiterId, true).catch(() => null)
  if (!organisationId) return { fehler: 'Keine Berechtigung' }
  const sitzung = { organisationId }

  const supabase = getServiceClient()
  const zeile = {
    organisation_id: sitzung.organisationId,
    mitarbeiter_id: eintrag.mitarbeiterId,
    arbeitstag: eintrag.arbeitstag,
    art: eintrag.art,
    beginn: eintrag.beginn,
    ende: eintrag.ende,
    pause_minuten: eintrag.pauseMinuten,
    notiz: eintrag.notiz,
  }

  // Bedingtes Update (nur das eigene mitarbeiter_id/organisation_id) statt
  // eines blinden Updates per id – sonst könnte eine Leitung (oder ein
  // Mitarbeiter, der versehentlich eine fremde id im Request schickt) einen
  // Zeiteintrag einer anderen Organisation oder eines anderen Mitarbeiters
  // überschreiben.
  const anfrage = eintrag.id
    ? supabase
        .from('zeiteintraege')
        .update(zeile)
        .eq('id', eintrag.id)
        .eq('organisation_id', sitzung.organisationId)
        .eq('mitarbeiter_id', eintrag.mitarbeiterId)
        .select('id, arbeitstag, art, beginn, ende, pause_minuten, notiz')
        .maybeSingle()
    : supabase.from('zeiteintraege').insert(zeile).select('id, arbeitstag, art, beginn, ende, pause_minuten, notiz').single()

  const { data, error } = await anfrage

  if (error || !data) {
    return { fehler: istGrenzFehler(error?.message) ?? error?.message ?? 'Speichern fehlgeschlagen' }
  }

  return {
    eintrag: {
      id: data.id as string,
      arbeitstag: data.arbeitstag as string,
      art: data.art as EintragArt,
      beginn: data.beginn as string | null,
      ende: data.ende as string | null,
      pauseMinuten: data.pause_minuten as number,
      notiz: data.notiz as string | null,
    },
  }
}

export async function zeiteintragLoeschen(id: string, mitarbeiterId: string): Promise<{ fehler?: string }> {
  const organisationId = await zugriffAufZeiten(mitarbeiterId, true).catch(() => null)
  if (!organisationId) return { fehler: 'Keine Berechtigung' }
  const sitzung = { organisationId }

  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('zeiteintraege')
    .delete()
    .eq('id', id)
    .eq('organisation_id', sitzung.organisationId)
    .eq('mitarbeiter_id', mitarbeiterId)
    .select('id')
  if (error) return { fehler: error.message }
  if (!data || data.length === 0) return { fehler: 'Zeiteintrag nicht gefunden' }
  return {}
}

export async function mitarbeiterAnlegen(input: {
  name: string
  pin: string
  rolle: MitarbeiterRolle
  mitarbeiterTyp: MitarbeiterTyp
  stundenGrenze: number
}): Promise<{ fehler?: string; mitarbeiter?: Mitarbeiter }> {
  const sitzung = await verwaltungFuer('zeiterfassung').catch(() => null)
  if (!sitzung) return { fehler: 'Keine Berechtigung' }

  const formatFehler = pinFehler(input.pin, MITARBEITER_PIN)
  if (formatFehler) return { fehler: formatFehler }
  if (await pinInOrganisationVergeben(sitzung.organisationId, input.pin)) {
    return { fehler: 'Dieser PIN ist in eurer Organisation schon vergeben' }
  }

  const supabase = getServiceClient()
  const pinHash = await pinHashErstellen(input.pin)

  const { data, error } = await supabase
    .from('mitarbeiter')
    .insert({
      organisation_id: sitzung.organisationId,
      name: input.name.trim(),
      pin_hash: pinHash,
      rolle: input.rolle,
      mitarbeiter_typ: input.mitarbeiterTyp,
      stunden_grenze: input.stundenGrenze,
    })
    .select(MITARBEITER_SPALTEN)
    .single()

  if (error || !data) {
    const istDuplikat = error?.code === '23505'
    return { fehler: istDuplikat ? 'Dieser PIN ist in eurer Organisation schon vergeben' : (error?.message ?? 'Anlegen fehlgeschlagen') }
  }

  return { mitarbeiter: mitarbeiterAusZeile(data) }
}

export async function mitarbeiterAktualisieren(
  mitarbeiterId: string,
  patch: { name?: string; rolle?: MitarbeiterRolle; mitarbeiterTyp?: MitarbeiterTyp; stundenGrenze?: number; aktiv?: boolean }
): Promise<{ fehler?: string }> {
  const sitzung = await verwaltungFuer('zeiterfassung').catch(() => null)
  if (!sitzung) return { fehler: 'Keine Berechtigung' }

  const supabase = getServiceClient()
  const updateZeile: Record<string, unknown> = {}
  if (patch.name !== undefined) updateZeile.name = patch.name.trim()
  if (patch.rolle !== undefined) updateZeile.rolle = patch.rolle
  if (patch.mitarbeiterTyp !== undefined) updateZeile.mitarbeiter_typ = patch.mitarbeiterTyp
  if (patch.stundenGrenze !== undefined) updateZeile.stunden_grenze = patch.stundenGrenze
  if (patch.aktiv !== undefined) updateZeile.aktiv = patch.aktiv

  const { data, error } = await supabase
    .from('mitarbeiter')
    .update(updateZeile)
    .eq('id', mitarbeiterId)
    .eq('organisation_id', sitzung.organisationId)
    .select('id')
  if (error) return { fehler: error.message }
  if (!data || data.length === 0) return { fehler: 'Mitarbeiter nicht gefunden' }
  return {}
}

export async function dokumenteLadenAktion(mitarbeiterId: string): Promise<MitarbeiterDokument[]> {
  const sitzung = await verwaltungFuer('zeiterfassung')
  return ladeDokumenteFuerMitarbeiter(mitarbeiterId, sitzung.organisationId)
}

export async function dokumentHochladenAktion(
  mitarbeiterId: string,
  datei: File
): Promise<{ fehler?: string; dokument?: MitarbeiterDokument }> {
  const sitzung = await verwaltungFuer('zeiterfassung').catch(() => null)
  if (!sitzung) return { fehler: 'Keine Berechtigung' }
  const mitarbeiter = await ladeMitarbeiter(mitarbeiterId, sitzung.organisationId)
  if (!mitarbeiter) return { fehler: 'Mitarbeiter nicht gefunden' }
  return dokumentHochladen(sitzung.organisationId, mitarbeiterId, datei)
}

export async function dokumentLoeschenAktion(id: string): Promise<{ fehler?: string }> {
  const sitzung = await verwaltungFuer('zeiterfassung').catch(() => null)
  if (!sitzung) return { fehler: 'Keine Berechtigung' }
  return dokumentLoeschen(id, sitzung.organisationId)
}

export async function mitarbeiterPinZuruecksetzen(mitarbeiterId: string, neuerPin: string): Promise<{ fehler?: string }> {
  const sitzung = await verwaltungFuer('zeiterfassung').catch(() => null)
  if (!sitzung) return { fehler: 'Keine Berechtigung' }

  const formatFehler = pinFehler(neuerPin, MITARBEITER_PIN)
  if (formatFehler) return { fehler: formatFehler }
  if (await pinInOrganisationVergeben(sitzung.organisationId, neuerPin, mitarbeiterId)) {
    return { fehler: 'Dieser PIN ist in eurer Organisation schon vergeben' }
  }

  const supabase = getServiceClient()
  const pinHash = await pinHashErstellen(neuerPin)
  const { data, error } = await supabase
    .from('mitarbeiter')
    .update({ pin_hash: pinHash })
    .eq('id', mitarbeiterId)
    .eq('organisation_id', sitzung.organisationId)
    .select('id')
  if (error) {
    const istDuplikat = error.code === '23505'
    return { fehler: istDuplikat ? 'Dieser PIN ist in eurer Organisation schon vergeben' : error.message }
  }
  if (!data || data.length === 0) return { fehler: 'Mitarbeiter nicht gefunden' }
  return {}
}
