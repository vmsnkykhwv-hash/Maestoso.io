'use server'

import { revalidatePath } from 'next/cache'
import { pinHashErstellen } from '@/lib/pinHash'
import { getSitzung } from '@/lib/session'
import { getServiceClient } from '@/lib/supabase/server'
import { MODULE, type ModulSchluessel } from '@/lib/module'
import { subdomainVorschlagen } from '@/lib/organisationen'

// Server Actions sind eigenständig aufrufbare Endpunkte (über die
// Action-ID, nicht über den Seitenpfad) – die Weiterleitung in proxy.ts
// schützt nur die Seite selbst, nicht diese Actions direkt. Jede Action
// hier muss deshalb die Sitzung selbst prüfen, genau wie überall sonst im
// Dashboard auch.
async function plattformAdminOderFehler() {
  const sitzung = await getSitzung()
  if (!sitzung || sitzung.typ !== 'plattform-admin') throw new Error('Keine Berechtigung')
  return sitzung
}

export async function organisationAnlegen(name: string, loginCode: string, pin: string) {
  await plattformAdminOderFehler()

  const supabase = getServiceClient()
  const pinHash = await pinHashErstellen(pin)
  const code = loginCode.trim().toLowerCase()
  const subdomain = await subdomainVorschlagen(name)

  const { data, error } = await supabase
    .from('organisationen')
    .insert({ name: name.trim(), login_code: code, pin_hash: pinHash, subdomain })
    .select('id, name, login_code, erstellt_at, subdomain, custom_domain')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Organisation konnte nicht angelegt werden')

  const { error: freischaltungenError } = await supabase
    .from('freischaltungen')
    .insert(MODULE.map((m) => ({ organisation_id: data.id, modul: m.schluessel, freigeschaltet: false })))

  if (freischaltungenError) throw new Error(freischaltungenError.message)

  revalidatePath('/plattform-admin')

  return {
    id: data.id as string,
    name: data.name as string,
    loginCode: data.login_code as string,
    erstelltAt: data.erstellt_at as string,
    subdomain: data.subdomain as string | null,
    customDomain: data.custom_domain as string | null,
    freischaltungen: Object.fromEntries(MODULE.map((m) => [m.schluessel, false])) as Record<
      ModulSchluessel,
      boolean
    >,
  }
}

// Eigene Domain eines Kunden eintragen/ändern – der eigentliche Transfer
// (DNS-Eintrag beim Kunden, Domain im Hosting-Projekt freischalten) bleibt
// ein manueller Schritt außerhalb der Plattform, siehe README.
export async function customDomainSpeichernAktionAdmin(
  organisationId: string,
  customDomain: string
): Promise<{ fehler?: string }> {
  await plattformAdminOderFehler()

  const supabase = getServiceClient()
  const { error } = await supabase
    .from('organisationen')
    .update({ custom_domain: customDomain.trim().toLowerCase() || null })
    .eq('id', organisationId)

  if (error) {
    const istDuplikat = error.code === '23505'
    return { fehler: istDuplikat ? 'Diese Domain ist schon einer anderen Organisation zugeordnet' : error.message }
  }
  revalidatePath('/plattform-admin')
  return {}
}

export async function modulFreischaltenUmschalten(
  organisationId: string,
  modul: ModulSchluessel,
  freigeschaltet: boolean
) {
  await plattformAdminOderFehler()

  const supabase = getServiceClient()
  const { error } = await supabase
    .from('freischaltungen')
    .update({ freigeschaltet, freigeschaltet_am: freigeschaltet ? new Date().toISOString() : null })
    .eq('organisation_id', organisationId)
    .eq('modul', modul)

  if (error) throw new Error(error.message)
  revalidatePath('/plattform-admin')
}

export async function organisationLoeschen(organisationId: string) {
  await plattformAdminOderFehler()

  const supabase = getServiceClient()
  const { error } = await supabase.from('organisationen').delete().eq('id', organisationId)
  if (error) throw new Error(error.message)
  revalidatePath('/plattform-admin')
}
