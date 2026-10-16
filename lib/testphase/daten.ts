import { getServiceClient } from '@/lib/supabase/server'
import { domainEntfernen, vercelKonfiguriert } from '@/lib/vercel/domains'
import { plusTage, VERLAENGERUNG_TAGE, type VertragStatus } from './regeln'

export type Vertrag = {
  status: VertragStatus
  testBis: string | null
  loeschungAm: string | null
}

export function vertragAusZeile(z: Record<string, unknown>): Vertrag {
  return {
    status: (z.vertrag_status as VertragStatus | undefined) ?? 'test',
    testBis: (z.test_bis as string | null) ?? null,
    loeschungAm: (z.loeschung_am as string | null) ?? null,
  }
}

export async function vertragAktivSetzen(organisationId: string): Promise<{ fehler?: string; vertrag?: Vertrag }> {
  const { data, error } = await getServiceClient()
    .from('organisationen')
    .update({ vertrag_status: 'aktiv', loeschung_am: null })
    .eq('id', organisationId)
    .select('vertrag_status, test_bis, loeschung_am')
    .maybeSingle()
  if (error || !data) return { fehler: error?.message ?? 'Betrieb nicht gefunden' }
  return { vertrag: vertragAusZeile(data) }
}

// Verlängert ab dem späteren von "heute" und bisherigem Testende – ein
// bereits gesperrter Betrieb ist danach sofort wieder offen, die Löschfrist
// entfällt, und beide Erinnerungen dürfen erneut kommen.
export async function testVerlaengern(organisationId: string): Promise<{ fehler?: string; vertrag?: Vertrag }> {
  const supabase = getServiceClient()
  const { data: bisher } = await supabase.from('organisationen').select('test_bis').eq('id', organisationId).maybeSingle()
  if (!bisher) return { fehler: 'Betrieb nicht gefunden' }
  const jetzt = new Date()
  const altesEnde = bisher.test_bis ? new Date(bisher.test_bis as string) : jetzt
  const neuesEnde = plusTage(altesEnde > jetzt ? altesEnde : jetzt, VERLAENGERUNG_TAGE)
  const { data, error } = await supabase
    .from('organisationen')
    .update({
      vertrag_status: 'test',
      test_bis: neuesEnde.toISOString(),
      loeschung_am: null,
      erinnerung_test_gesendet: false,
      erinnerung_loeschung_gesendet: false,
    })
    .eq('id', organisationId)
    .select('vertrag_status, test_bis, loeschung_am')
    .maybeSingle()
  if (error || !data) return { fehler: error?.message ?? 'Betrieb nicht gefunden' }
  return { vertrag: vertragAusZeile(data) }
}

// Endgültig: Dateien im Storage hängen nicht per Fremdschlüssel am
// Betrieb und blieben sonst liegen, die eigene Domain zeigte weiter auf
// Maestoso. Alles andere löscht die Datenbank per "on delete cascade".
export async function organisationEndgueltigLoeschen(organisationId: string): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { data: org } = await supabase.from('organisationen').select('custom_domain').eq('id', organisationId).maybeSingle()
  if (!org) return {}

  const domain = org.custom_domain as string | null
  if (domain && vercelKonfiguriert()) {
    const entfernt = await domainEntfernen(domain)
    if (entfernt.fehler) return { fehler: `Domain ${domain} konnte nicht aus Vercel entfernt werden: ${entfernt.fehler}` }
  }

  const [{ data: bilder }, { data: dokumente }] = await Promise.all([
    supabase.from('website_bilder').select('storage_pfad').eq('organisation_id', organisationId),
    supabase.from('mitarbeiter_dokumente').select('storage_pfad').eq('organisation_id', organisationId),
  ])
  const dateien: [string, string[]][] = [
    ['website-bilder', (bilder ?? []).map((b) => b.storage_pfad as string)],
    ['mitarbeiter-dokumente', (dokumente ?? []).map((d) => d.storage_pfad as string)],
  ]
  for (const [bucket, pfade] of dateien) {
    if (pfade.length === 0) continue
    const { error } = await supabase.storage.from(bucket).remove(pfade)
    if (error) return { fehler: `Dateien in ${bucket}: ${error.message}` }
  }

  const { error } = await supabase.from('organisationen').delete().eq('id', organisationId)
  return error ? { fehler: error.message } : {}
}
