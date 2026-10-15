'use server'

import { revalidatePath } from 'next/cache'
import { randomBytes } from 'node:crypto'
import { pinHashErstellen } from '@/lib/pinHash'
import { ORGANISATION_PIN, pinFehler } from '@/lib/pinRegeln'
import { getSitzung } from '@/lib/session'
import { getServiceClient } from '@/lib/supabase/server'
import { MODULE, type ModulSchluessel } from '@/lib/module'
import { subdomainVorschlagen, type OrganisationMitFreischaltungen } from '@/lib/organisationen'
import { domainEntfernen, domainHinzufuegen, domainStatusLaden, vercelKonfiguriert, type DomainStatus } from '@/lib/vercel/domains'

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

// Eigene Domain eines Kunden: ausschließlich hier, nie durch die
// Organisation selbst (sonst könnte ein Betrieb die Domain eines anderen
// beanspruchen). Eingetragen wird gleichzeitig in der Datenbank (für das
// Routing in proxy.ts) und im Vercel-Projekt (damit Vercel die Domain
// überhaupt ausliefert und ein Zertifikat ausstellt).
function domainNormalisieren(eingabe: string): { domain?: string; fehler?: string } {
  const domain = eingabe
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '')
  if (!/^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) {
    return { fehler: 'Bitte nur den Domainnamen angeben, z. B. musterbetrieb.de' }
  }
  // Die Plattform-Domain selbst (oder eine ihrer Subdomains) als eigene
  // Domain eines Betriebs würde mit dem Subdomain-Routing in proxy.ts
  // kollidieren.
  const plattformDomain = process.env.NEXT_PUBLIC_PLATTFORM_DOMAIN
  if (plattformDomain && (domain === plattformDomain || domain.endsWith(`.${plattformDomain}`))) {
    return { fehler: 'Die Plattform-Domain kann nicht als eigene Domain vergeben werden.' }
  }
  return { domain }
}

export async function domainVerbindenAktion(
  organisationId: string,
  eingabe: string,
  mitWww: boolean
): Promise<{ fehler?: string; hinweis?: string; domain?: string }> {
  await plattformAdminOderFehler()
  const { domain, fehler } = domainNormalisieren(eingabe)
  if (!domain) return { fehler }

  const supabase = getServiceClient()
  const [{ data: belegt }, { data: organisation }] = await Promise.all([
    supabase.from('organisationen').select('id').eq('custom_domain', domain).neq('id', organisationId).maybeSingle(),
    supabase.from('organisationen').select('custom_domain').eq('id', organisationId).maybeSingle(),
  ])
  if (belegt) return { fehler: 'Diese Domain ist schon einer anderen Organisation zugeordnet.' }
  if (!organisation) return { fehler: 'Organisation nicht gefunden.' }

  let hinweis: string | undefined
  if (vercelKonfiguriert()) {
    const bisher = organisation.custom_domain as string | null
    if (bisher && bisher !== domain) {
      const entfernt = await domainEntfernen(bisher)
      if (entfernt.fehler) return { fehler: `Alte Domain ${bisher}: ${entfernt.fehler}` }
    }
    const hinzugefuegt = await domainHinzufuegen(domain, mitWww)
    if (hinzugefuegt.fehler) return { fehler: hinzugefuegt.fehler }
  } else {
    hinweis = 'Gespeichert, aber Vercel ist nicht eingerichtet – Domain dort bitte von Hand hinzufügen.'
  }

  // Weiterleitung von der Subdomain erst wieder einschalten, wenn "Status
  // prüfen" bestätigt, dass die (neue) Domain funktioniert.
  const { error } = await supabase
    .from('organisationen')
    .update({ custom_domain: domain, custom_domain_aktiv: false })
    .eq('id', organisationId)
  if (error) {
    return { fehler: error.code === '23505' ? 'Diese Domain ist schon einer anderen Organisation zugeordnet.' : error.message }
  }
  revalidatePath('/plattform-admin')
  return { domain, hinweis }
}

export async function domainStatusAktion(organisationId: string): Promise<{ fehler?: string; status?: DomainStatus }> {
  await plattformAdminOderFehler()
  if (!vercelKonfiguriert()) return { fehler: 'Vercel ist nicht eingerichtet (siehe README → Setup).' }

  const supabase = getServiceClient()
  const { data } = await supabase.from('organisationen').select('custom_domain').eq('id', organisationId).maybeSingle()
  const domain = data?.custom_domain as string | null | undefined
  if (!domain) return { fehler: 'Keine eigene Domain hinterlegt.' }

  const ergebnis = await domainStatusLaden(domain)
  if (ergebnis.status) {
    // Merkt sich das Ergebnis für proxy.ts: nur bei funktionierender Domain
    // wird die Subdomain dorthin umgeleitet – und bricht die DNS später weg,
    // schaltet die nächste Prüfung die Umleitung wieder ab.
    const aktiv = ergebnis.status.verifiziert && ergebnis.status.dnsKorrekt
    await supabase.from('organisationen').update({ custom_domain_aktiv: aktiv }).eq('id', organisationId)
  }
  return ergebnis
}

export async function domainEntfernenAktion(organisationId: string): Promise<{ fehler?: string }> {
  await plattformAdminOderFehler()

  const supabase = getServiceClient()
  const { data } = await supabase.from('organisationen').select('custom_domain').eq('id', organisationId).maybeSingle()
  const domain = data?.custom_domain as string | null | undefined
  if (domain && vercelKonfiguriert()) {
    const entfernt = await domainEntfernen(domain)
    if (entfernt.fehler) return { fehler: entfernt.fehler }
  }

  const { error } = await supabase
    .from('organisationen')
    .update({ custom_domain: null, custom_domain_aktiv: false })
    .eq('id', organisationId)
  if (error) return { fehler: error.message }
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

  // Sonst bliebe die Domain des Ex-Kunden im Vercel-Projekt und zeigte die
  // Maestoso-Login-Seite statt einer Fehlermeldung.
  const { data } = await supabase.from('organisationen').select('custom_domain').eq('id', organisationId).maybeSingle()
  const domain = data?.custom_domain as string | null | undefined
  if (domain && vercelKonfiguriert()) {
    const entfernt = await domainEntfernen(domain)
    if (entfernt.fehler) throw new Error(`Domain ${domain} konnte nicht aus Vercel entfernt werden: ${entfernt.fehler}`)
  }

  const { error } = await supabase.from('organisationen').delete().eq('id', organisationId)
  if (error) throw new Error(error.message)
  revalidatePath('/plattform-admin')
}
