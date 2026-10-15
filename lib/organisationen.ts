import { getServiceClient } from '@/lib/supabase/server'
import { MODULE, type ModulSchluessel } from '@/lib/module'

function leereFreischaltungen(): Record<ModulSchluessel, boolean> {
  return Object.fromEntries(MODULE.map((m) => [m.schluessel, false])) as Record<ModulSchluessel, boolean>
}

// Freischaltungen einer einzelnen Organisation (für das Dashboard der
// Organisation selbst).
export async function ladeFreischaltungen(organisationId: string): Promise<Record<ModulSchluessel, boolean>> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('freischaltungen')
    .select('modul, freigeschaltet')
    .eq('organisation_id', organisationId)

  const ergebnis = leereFreischaltungen()
  for (const f of data ?? []) {
    ergebnis[f.modul as ModulSchluessel] = f.freigeschaltet as boolean
  }
  return ergebnis
}

export type OrganisationMitFreischaltungen = {
  id: string
  name: string
  loginCode: string
  erstelltAt: string
  subdomain: string | null
  customDomain: string | null
  freischaltungen: Record<ModulSchluessel, boolean>
}

// Alle Organisationen mit ihren Freischaltungen (für den Plattform-Admin).
export async function ladeOrganisationen(): Promise<OrganisationMitFreischaltungen[]> {
  const supabase = getServiceClient()

  const [{ data: organisationen }, { data: freischaltungen }] = await Promise.all([
    supabase
      .from('organisationen')
      .select('id, name, login_code, erstellt_at, subdomain, custom_domain')
      .order('erstellt_at', { ascending: false }),
    supabase.from('freischaltungen').select('organisation_id, modul, freigeschaltet'),
  ])

  const freischaltungenNachOrg = new Map<string, Record<ModulSchluessel, boolean>>()
  for (const org of organisationen ?? []) {
    freischaltungenNachOrg.set(org.id as string, leereFreischaltungen())
  }
  for (const f of freischaltungen ?? []) {
    const bestehend = freischaltungenNachOrg.get(f.organisation_id as string)
    if (bestehend) bestehend[f.modul as ModulSchluessel] = f.freigeschaltet as boolean
  }

  return (organisationen ?? []).map((o) => ({
    id: o.id as string,
    name: o.name as string,
    loginCode: o.login_code as string,
    erstelltAt: o.erstellt_at as string,
    subdomain: (o.subdomain as string | null) ?? null,
    customDomain: (o.custom_domain as string | null) ?? null,
    freischaltungen: freischaltungenNachOrg.get(o.id as string) ?? leereFreischaltungen(),
  }))
}

function slugifizieren(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // Umlaute/Akzente auf Basisbuchstaben reduzieren
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

// Vorschlag für eine neue, plattformweit eindeutige Subdomain aus dem
// Organisationsnamen (z. B. "Café Musterbetrieb" -> "cafe-musterbetrieb",
// bei Kollision "cafe-musterbetrieb-2").
export async function subdomainVorschlagen(name: string): Promise<string> {
  const supabase = getServiceClient()
  const basis = slugifizieren(name) || 'organisation'

  for (let versuch = 1; versuch < 50; versuch++) {
    const kandidat = versuch === 1 ? basis : `${basis}-${versuch}`
    const { data } = await supabase.from('organisationen').select('id').eq('subdomain', kandidat).maybeSingle()
    if (!data) return kandidat
  }

  return `${basis}-${Date.now()}`
}

export type HostOrganisation = {
  id: string
  subdomain: string | null
  customDomain: string | null
  customDomainAktiv: boolean
  // true, wenn die Anfrage über die Plattform-Subdomain kam (nicht über die
  // eigene Domain) – nur dann leitet proxy.ts gegebenenfalls um.
  ueberSubdomain: boolean
}

function hostOrganisationAusZeile(d: Record<string, unknown>, ueberSubdomain: boolean): HostOrganisation {
  return {
    id: d.id as string,
    subdomain: (d.subdomain as string | null) ?? null,
    customDomain: (d.custom_domain as string | null) ?? null,
    customDomainAktiv: d.custom_domain_aktiv === true,
    ueberSubdomain,
  }
}

const HOST_SPALTEN = 'id, subdomain, custom_domain, custom_domain_aktiv'

// Domain-basiertes Routing (siehe proxy.ts): ordnet einen eingehenden Host
// (Plattform-Subdomain oder eigene Domain) einer Organisation zu.
export async function ladeOrganisationFuerHost(host: string, plattformDomain: string): Promise<HostOrganisation | null> {
  const supabase = getServiceClient()
  const hostOhnePort = host.split(':')[0].toLowerCase()

  if (hostOhnePort.endsWith(`.${plattformDomain}`)) {
    const subdomain = hostOhnePort.slice(0, -(plattformDomain.length + 1))
    const { data } = await supabase.from('organisationen').select(HOST_SPALTEN).eq('subdomain', subdomain).maybeSingle()
    return data ? hostOrganisationAusZeile(data, true) : null
  }

  const { data } = await supabase.from('organisationen').select(HOST_SPALTEN).eq('custom_domain', hostOhnePort).maybeSingle()
  return data ? hostOrganisationAusZeile(data, false) : null
}

export async function ladeHostOrganisationPerId(organisationId: string): Promise<HostOrganisation | null> {
  const supabase = getServiceClient()
  const { data } = await supabase.from('organisationen').select(HOST_SPALTEN).eq('id', organisationId).maybeSingle()
  return data ? hostOrganisationAusZeile(data, true) : null
}

// Die Adresse, unter der Gäste einen Betrieb erreichen: die eigene Domain,
// sobald sie funktioniert, sonst die Subdomain. null ohne Plattform-Domain
// (lokale Entwicklung) – dann gelten die internen Pfade mit ID.
export function oeffentlicherHost(org: HostOrganisation, plattformDomain: string | undefined): string | null {
  if (!plattformDomain) return null
  if (org.customDomain && org.customDomainAktiv) return org.customDomain
  if (org.subdomain) return `${org.subdomain}.${plattformDomain}`
  return null
}
