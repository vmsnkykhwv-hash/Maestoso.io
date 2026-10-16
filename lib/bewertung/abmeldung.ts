import { getServiceClient } from '@/lib/supabase/server'
import { tokenErstellen, tokenPruefen } from '@/lib/signiertesToken'
import { plattformUrl } from '@/lib/url'

// Der Link muss auch Monate nach der Mail noch funktionieren – eine
// Abmeldung, die nach ein paar Tagen ins Leere läuft, wäre keine.
const GUELTIG_MS = 400 * 24 * 60 * 60 * 1000

type AbmeldeDaten = { o: string; e: string }

function normalisieren(email: string): string {
  return email.trim().toLowerCase()
}

export async function abmeldeLink(organisationId: string, email: string): Promise<string> {
  const token = await tokenErstellen<AbmeldeDaten>({ o: organisationId, e: normalisieren(email) }, GUELTIG_MS)
  return `${await plattformUrl()}/bewertung-abmelden?t=${encodeURIComponent(token)}`
}

export async function abmeldeTokenPruefen(token: string | undefined): Promise<{ organisationId: string; email: string } | null> {
  const daten = await tokenPruefen<AbmeldeDaten>(token)
  return daten?.o && daten.e ? { organisationId: daten.o, email: daten.e } : null
}

export async function istAbgemeldet(organisationId: string, email: string): Promise<boolean> {
  const { data } = await getServiceClient()
    .from('bewertung_abmeldungen')
    .select('email')
    .eq('organisation_id', organisationId)
    .eq('email', normalisieren(email))
    .maybeSingle()
  return !!data
}

export async function abmelden(organisationId: string, email: string): Promise<boolean> {
  const { error } = await getServiceClient()
    .from('bewertung_abmeldungen')
    .upsert({ organisation_id: organisationId, email: normalisieren(email) }, { onConflict: 'organisation_id,email', ignoreDuplicates: true })
  if (error) console.error('Bewertung abmelden:', error.message)
  return !error
}
