import { getServiceClient } from '@/lib/supabase/server'
import type { Zeiteintrag } from './types'

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

  return (data ?? []).map((e) => ({
    id: e.id as string,
    arbeitstag: e.arbeitstag as string,
    art: e.art as Zeiteintrag['art'],
    beginn: e.beginn as string | null,
    ende: e.ende as string | null,
    pauseMinuten: e.pause_minuten as number,
    notiz: e.notiz as string | null,
  }))
}
