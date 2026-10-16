import { getServiceClient } from '@/lib/supabase/server'
import type { ZeitHistorie, ZeitStand, Zeiteintrag } from './types'

export async function ladeZeiteintraege(mitarbeiterId: string, organisationId: string, von: string, bis: string): Promise<Zeiteintrag[]> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('zeiteintraege')
    .select('id, arbeitstag, art, beginn, ende, pause_minuten, notiz')
    .eq('mitarbeiter_id', mitarbeiterId)
    .eq('organisation_id', organisationId)
    .gte('arbeitstag', von)
    .lte('arbeitstag', bis)
    .order('arbeitstag')

  const ids = (data ?? []).map((e) => e.id as string)
  const { data: aenderungen } = ids.length
    ? await supabase.from('zeiteintrag_historie').select('zeiteintrag_id').eq('organisation_id', organisationId).eq('aktion', 'geaendert').in('zeiteintrag_id', ids)
    : { data: [] }
  const geaendert = new Set((aenderungen ?? []).map((a) => a.zeiteintrag_id as string))

  return (data ?? []).map((e) => ({
    geaendert: geaendert.has(e.id as string),
    id: e.id as string,
    arbeitstag: e.arbeitstag as string,
    art: e.art as Zeiteintrag['art'],
    beginn: e.beginn as string | null,
    ende: e.ende as string | null,
    pauseMinuten: e.pause_minuten as number,
    notiz: e.notiz as string | null,
  }))
}

export async function ladeZeitHistorie(zeiteintragId: string, mitarbeiterId: string, organisationId: string): Promise<ZeitHistorie[]> {
  const { data } = await getServiceClient()
    .from('zeiteintrag_historie')
    .select('aktion, alt, neu, geaendert_von, zeitpunkt')
    .eq('organisation_id', organisationId)
    .eq('mitarbeiter_id', mitarbeiterId)
    .eq('zeiteintrag_id', zeiteintragId)
    .order('zeitpunkt')
  return (data ?? []).map((h) => ({
    aktion: h.aktion as ZeitHistorie['aktion'],
    alt: (h.alt as ZeitStand | null) ?? null,
    neu: (h.neu as ZeitStand | null) ?? null,
    geaendertVon: (h.geaendert_von as string | null) ?? null,
    zeitpunkt: h.zeitpunkt as string,
  }))
}
