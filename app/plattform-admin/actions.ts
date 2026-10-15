'use server'

import { revalidatePath } from 'next/cache'
import { randomBytes } from 'node:crypto'
import { pinHashErstellen } from '@/lib/pinHash'
import { ORGANISATION_PIN, pinFehler } from '@/lib/pinRegeln'
import { getSitzung } from '@/lib/session'
import { getServiceClient } from '@/lib/supabase/server'
import { MODULE, type ModulSchluessel } from '@/lib/module'
import { subdomainVorschlagen, type OrganisationMitFreischaltungen } from '@/lib/organisationen'

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

const ZUGANGSCODE_FORMAT = /^[a-z0-9-]{6,40}$/

// Ohne eigene Vorgabe: Namensbestandteil + 6 Zufallszeichen. Der Name
// allein (z. B. "musterbetrieb") wäre leicht zu erraten, und Zugangscode +
// PIN sind die einzige Hürde vor dem Dashboard.
function zugangscodeErzeugen(name: string): string {
  const basis =
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 20) || 'betrieb'
  const zeichen = 'abcdefghjkmnpqrstuvwxyz23456789'
  const zufall = Array.from(randomBytes(6), (b) => zeichen[b % zeichen.length]).join('')
  return `${basis}-${zufall}`
}

// Gibt Fehler als Wert zurück statt zu werfen: geworfene Fehlermeldungen
// aus Server Actions ersetzt Next.js im Produktivbetrieb durch einen
// generischen Text, der Admin sähe dann nicht, was falsch war.
export async function organisationAnlegen(
  name: string,
  loginCode: string,
  pin: string
): Promise<{ fehler?: string; organisation?: OrganisationMitFreischaltungen }> {
  await plattformAdminOderFehler()

  if (!name.trim()) return { fehler: 'Bitte einen Namen angeben.' }
  const code = loginCode.trim().toLowerCase() || zugangscodeErzeugen(name)
  if (!ZUGANGSCODE_FORMAT.test(code)) {
    return { fehler: 'Zugangscode: 6 bis 40 Zeichen, nur Kleinbuchstaben, Ziffern und Bindestriche.' }
  }
  const formatFehler = pinFehler(pin, ORGANISATION_PIN)
  if (formatFehler) return { fehler: formatFehler }

  const supabase = getServiceClient()
  const pinHash = await pinHashErstellen(pin)
  const subdomain = await subdomainVorschlagen(name)

  const { data, error } = await supabase
    .from('organisationen')
    .insert({ name: name.trim(), login_code: code, pin_hash: pinHash, subdomain })
    .select('id, name, login_code, erstellt_at, subdomain, custom_domain')
    .single()

  if (error?.code === '23505') return { fehler: 'Dieser Zugangscode ist schon vergeben.' }
  if (error || !data) return { fehler: error?.message ?? 'Organisation konnte nicht angelegt werden' }

  const { error: freischaltungenError } = await supabase
    .from('freischaltungen')
    .insert(MODULE.map((m) => ({ organisation_id: data.id, modul: m.schluessel, freigeschaltet: false })))

  if (freischaltungenError) {
    // Ohne Freischaltungs-Zeilen wäre die Organisation nur halb angelegt –
    // lieber ganz zurückrollen und den Admin es erneut versuchen lassen.
    await supabase.from('organisationen').delete().eq('id', data.id)
    return { fehler: freischaltungenError.message }
  }

  revalidatePath('/plattform-admin')

  const organisation: OrganisationMitFreischaltungen = {
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
  return { organisation }
}

// Eigene Domain eines Kunden eintragen/ändern – der eigentliche Transfer
// (DNS-Eintrag beim Kunden, Domain im Hosting-Projekt freischalten) bleibt
// ein manueller Schritt außerhalb der Plattform, siehe README.
export async function customDomainSpeichernAktionAdmin(
  organisationId: string,
  customDomain: string
): Promise<{ fehler?: string }> {
  await plattformAdminOderFehler()

  const domain = customDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  if (domain && !/^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) {
    return { fehler: 'Bitte nur den Domainnamen angeben, z. B. musterbetrieb.de' }
  }
  // Die Plattform-Domain selbst (oder eine ihrer Subdomains) als eigene
  // Domain eines Betriebs würde mit dem Subdomain-Routing in proxy.ts
  // kollidieren.
  const plattformDomain = process.env.NEXT_PUBLIC_PLATTFORM_DOMAIN
  if (domain && plattformDomain && (domain === plattformDomain || domain.endsWith(`.${plattformDomain}`))) {
    return { fehler: 'Die Plattform-Domain kann nicht als eigene Domain vergeben werden.' }
  }

  const supabase = getServiceClient()
  const { error } = await supabase
    .from('organisationen')
    .update({ custom_domain: domain || null })
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
