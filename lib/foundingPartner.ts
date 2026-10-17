import { FOUNDING_PARTNER_PLAETZE } from '@/lib/preise'
import { getServiceClient } from '@/lib/supabase/server'

// Freie Plätze für die Website: nur die Zahl, nie welche Betriebe es sind.
// Lieber keinen Platz anzeigen als einen, den es nicht gibt – auch beim
// Build ohne Datenbank-Zugang (GitHub-Prüfung); die Seite wird nach einer
// Minute ohnehin neu erzeugt.
export async function freieFoundingPartnerPlaetze(): Promise<number> {
  try {
    const { count, error } = await getServiceClient()
      .from('organisationen')
      .select('id', { count: 'exact', head: true })
      .eq('founding_partner', true)
    if (error) return 0
    return Math.max(0, FOUNDING_PARTNER_PLAETZE - (count ?? 0))
  } catch {
    return 0
  }
}
