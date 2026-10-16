import { ladeKonto } from '@/lib/konten/daten'
import { getBetriebsSitzung, getSitzung } from '@/lib/session'
import { getServiceClient } from '@/lib/supabase/server'

import type { ProtokollEintrag, ProtokollModul } from '@/lib/protokollTypen'

export { PROTOKOLL_MODUL_LABEL, type ProtokollEintrag, type ProtokollModul } from '@/lib/protokollTypen'

type Akteur = { organisationId: string; art: ProtokollEintrag['akteurArt']; id: string | null; name: string }

// Wer gerade im Betrieb handelt – für das Protokoll und für die Historie der
// Arbeitszeiten (lib/zeiterfassung), damit beide dieselbe Person nennen.
export async function aktuellerAkteur(): Promise<Akteur | null> {
  const sitzung = await getBetriebsSitzung()
  if (!sitzung) return null
  if (sitzung.art === 'inhaber') {
    const konto = await ladeKonto('benutzer', sitzung.kontoId)
    return { organisationId: sitzung.organisationId, art: 'inhaber', id: sitzung.kontoId, name: konto?.name || konto?.email || 'Verwaltungskonto' }
  }
  if (sitzung.art === 'tresen') {
    return {
      organisationId: sitzung.organisationId,
      art: 'tresen',
      id: sitzung.mitarbeiter?.id ?? null,
      name: `${sitzung.mitarbeiter?.name ?? 'Unbekannt'} (${sitzung.geraetName})`,
    }
  }
  return { organisationId: sitzung.organisationId, art: 'handy', id: sitzung.mitarbeiter.id, name: `${sitzung.mitarbeiter.name} (Handy)` }
}

// Schreibt einen Eintrag für die aktuell angemeldete Person. Ein Fehler beim
// Protokollieren darf die eigentliche Aktion nie scheitern lassen (die ist
// zu diesem Zeitpunkt schon gespeichert) – er wird nur geloggt.
export async function protokollieren(modul: ProtokollModul, aktion: string, details?: string | null, objektId?: string | null) {
  try {
    const akteur = await aktuellerAkteur()
    if (!akteur) return

    const { error } = await getServiceClient()
      .from('aenderungsprotokoll')
      .insert({
        organisation_id: akteur.organisationId,
        akteur_art: akteur.art,
        akteur_id: akteur.id,
        akteur_name: akteur.name,
        modul,
        aktion,
        details: details ?? null,
        objekt_id: objektId ?? null,
      })
    if (error) console.error('Änderungsprotokoll:', error.message)
  } catch (e) {
    console.error('Änderungsprotokoll:', e)
  }
}

// Eingriffe des Plattform-Admins in einen Betrieb. Der Admin hat keine
// Betriebssitzung, deshalb kommt der Betrieb als Parameter – geschrieben
// wird nur, wenn wirklich ein Admin angemeldet ist.
export async function supportProtokollieren(
  organisationId: string,
  modul: ProtokollModul,
  aktion: string,
  details?: string | null,
  objektId?: string | null
) {
  try {
    const sitzung = await getSitzung()
    if (sitzung?.typ !== 'plattform-admin') return
    const konto = await ladeKonto('admin', sitzung.kontoId)
    const { error } = await getServiceClient()
      .from('aenderungsprotokoll')
      .insert({
        organisation_id: organisationId,
        akteur_art: 'support',
        akteur_id: sitzung.kontoId,
        akteur_name: `Maestoso-Support (${konto?.email ?? 'Admin'})`,
        modul,
        aktion,
        details: details ?? null,
        objekt_id: objektId ?? null,
      })
    if (error) console.error('Änderungsprotokoll:', error.message)
  } catch (e) {
    console.error('Änderungsprotokoll:', e)
  }
}

// Für Aktionen, die das Ergebnis der Datenfunktion direkt zurückgeben:
// protokolliert nur, wenn es keinen Fehler gab.
export async function mitProtokoll<T extends { fehler?: string }>(
  ergebnis: Promise<T> | T,
  modul: ProtokollModul,
  aktion: string,
  details?: string | null,
  objektId?: string | null
): Promise<T> {
  const fertig = await ergebnis
  if (!fertig.fehler) await protokollieren(modul, aktion, details, objektId)
  return fertig
}

export async function ladeProtokoll(
  organisationId: string,
  filter: { modul?: ProtokollModul; vor?: string } = {},
  anzahl = 100
): Promise<ProtokollEintrag[]> {
  let query = getServiceClient()
    .from('aenderungsprotokoll')
    .select('id, zeitpunkt, akteur_art, akteur_name, modul, aktion, details')
    .eq('organisation_id', organisationId)
    .order('zeitpunkt', { ascending: false })
    .limit(anzahl)
  if (filter.modul) query = query.eq('modul', filter.modul)
  if (filter.vor) query = query.lt('zeitpunkt', filter.vor)
  const { data } = await query
  return (data ?? []).map((z) => ({
    id: z.id as string,
    zeitpunkt: z.zeitpunkt as string,
    akteurArt: z.akteur_art as ProtokollEintrag['akteurArt'],
    akteurName: z.akteur_name as string,
    modul: z.modul as ProtokollModul,
    aktion: z.aktion as string,
    details: (z.details as string | null) ?? null,
  }))
}
