'use server'

import { ladeProtokoll, type ProtokollEintrag, type ProtokollModul } from '@/lib/protokoll'
import { verwaltungFuer } from '@/lib/zugriff'

export async function protokollLadenAktion(filter: { modul?: ProtokollModul; vor?: string }): Promise<ProtokollEintrag[]> {
  const sitzung = await verwaltungFuer(null)
  return ladeProtokoll(sitzung.organisationId, filter)
}
