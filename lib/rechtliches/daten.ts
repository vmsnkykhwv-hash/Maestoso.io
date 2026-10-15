import { getServiceClient } from '@/lib/supabase/server'
import { LEERE_RECHTLICHE_ANGABEN, type RechtlicheAngaben } from './types'

export async function ladeRechtlicheAngaben(organisationId: string): Promise<RechtlicheAngaben> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('rechtliche_angaben')
    .select('*')
    .eq('organisation_id', organisationId)
    .maybeSingle()

  if (!data) return LEERE_RECHTLICHE_ANGABEN

  return {
    firma: data.firma as string,
    vertretenDurch: data.vertreten_durch as string,
    strasse: data.strasse as string,
    plzOrt: data.plz_ort as string,
    telefon: data.telefon as string,
    email: data.email as string,
    registerEintrag: data.register_eintrag as string,
    ustId: data.ust_id as string,
    datenschutzKontakt: data.datenschutz_kontakt as string,
  }
}

export async function rechtlicheAngabenSpeichern(
  organisationId: string,
  angaben: RechtlicheAngaben
): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { error } = await supabase.from('rechtliche_angaben').upsert({
    organisation_id: organisationId,
    firma: angaben.firma.trim(),
    vertreten_durch: angaben.vertretenDurch.trim(),
    strasse: angaben.strasse.trim(),
    plz_ort: angaben.plzOrt.trim(),
    telefon: angaben.telefon.trim(),
    email: angaben.email.trim(),
    register_eintrag: angaben.registerEintrag.trim(),
    ust_id: angaben.ustId.trim(),
    datenschutz_kontakt: angaben.datenschutzKontakt.trim(),
    aktualisiert_at: new Date().toISOString(),
  })
  if (error) return { fehler: error.message }
  return {}
}
