'use server'

import { revalidatePath } from 'next/cache'
import { benutzerAnlegen, ladeBenutzerDerOrganisation, type BenutzerUebersicht } from '@/lib/konten/einladung'
import { einladungVerschicken } from '@/lib/konten/einladungVersand'
import { ladeKonto, sitzungenBeenden, totpZuruecksetzen } from '@/lib/konten/daten'
import { getSitzung } from '@/lib/session'
import { getServiceClient } from '@/lib/supabase/server'
import { MODULE, type ModulSchluessel } from '@/lib/module'
import { subdomainVorschlagen, type OrganisationMitFreischaltungen } from '@/lib/organisationen'
import { supportProtokollieren } from '@/lib/protokoll'
import { verwaltungBenachrichtigen } from '@/lib/konten/sicherheitshinweis'
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

// Jeder Eingriff in einen Betrieb steht in dessen Änderungsprotokoll, und
// alles, was Zugänge oder die Login-Adresse betrifft, geht zusätzlich per
// Mail an die Verwaltungskonten – der Admin soll nichts unbemerkt tun können.
const SUPPORT = 'den Maestoso-Support'

// Gibt Fehler als Wert zurück statt zu werfen: geworfene Fehlermeldungen
// aus Server Actions ersetzt Next.js im Produktivbetrieb durch einen
// generischen Text, der Admin sähe dann nicht, was falsch war.
//
// Statt Zugangscode + PIN bekommt jede neue Organisation ein persönliches
// Konto für die Inhaberin bzw. den Inhaber, die/der per Einladungslink ein
// Passwort festlegt und 2FA einrichtet.
export async function organisationAnlegen(
  name: string,
  inhaberEmail: string,
  inhaberName: string
): Promise<{
  fehler?: string
  organisation?: OrganisationMitFreischaltungen
  einladung?: { link: string; versendet: boolean }
  benutzer?: BenutzerUebersicht[]
}> {
  await plattformAdminOderFehler()

  if (!name.trim()) return { fehler: 'Bitte einen Namen angeben.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inhaberEmail.trim())) return { fehler: 'Bitte eine gültige E-Mail-Adresse für den Inhaber angeben.' }

  const supabase = getServiceClient()
  const subdomain = await subdomainVorschlagen(name)

  const { data, error } = await supabase
    .from('organisationen')
    .insert({ name: name.trim(), subdomain })
    .select('id, name, erstellt_at, subdomain, custom_domain')
    .single()

  if (error || !data) return { fehler: error?.message ?? 'Organisation konnte nicht angelegt werden' }

  const { error: freischaltungenError } = await supabase
    .from('freischaltungen')
    .insert(MODULE.map((m) => ({ organisation_id: data.id, modul: m.schluessel, freigeschaltet: false })))
  const inhaber = freischaltungenError ? null : await benutzerAnlegen(data.id as string, inhaberEmail, inhaberName)

  if (freischaltungenError || !inhaber?.benutzerId) {
    // Ohne Freischaltungen bzw. Inhaber-Konto wäre die Organisation nur halb
    // angelegt – lieber ganz zurückrollen und es erneut versuchen lassen.
    await supabase.from('organisationen').delete().eq('id', data.id)
    return { fehler: freischaltungenError?.message ?? inhaber?.fehler }
  }

  const einladung = await einladungVerschicken(data.id as string, inhaber.benutzerId, inhaberEmail)
  await supportProtokollieren(data.id as string, 'zugaenge', 'Betrieb angelegt, Inhaber*in eingeladen', inhaberEmail, inhaber.benutzerId)
  revalidatePath('/plattform-admin')

  const organisation: OrganisationMitFreischaltungen = {
    id: data.id as string,
    name: data.name as string,
    erstelltAt: data.erstellt_at as string,
    subdomain: data.subdomain as string | null,
    customDomain: data.custom_domain as string | null,
    freischaltungen: Object.fromEntries(MODULE.map((m) => [m.schluessel, false])) as Record<
      ModulSchluessel,
      boolean
    >,
  }
  return { organisation, einladung, benutzer: await ladeBenutzerDerOrganisation(organisation.id) }
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
  await supportProtokollieren(organisationId, 'plattform', 'Domain verbunden', domain)
  await verwaltungBenachrichtigen(organisationId, `Eigene Domain auf ${domain} gesetzt`, SUPPORT)
  revalidatePath('/plattform-admin')
  return { domain, hinweis }
}

export async function domainStatusAktion(organisationId: string): Promise<{ fehler?: string; status?: DomainStatus }> {
  await plattformAdminOderFehler()
  if (!vercelKonfiguriert()) return { fehler: 'Vercel ist nicht eingerichtet (siehe README → Setup).' }

  const supabase = getServiceClient()
  const { data } = await supabase.from('organisationen').select('custom_domain, custom_domain_aktiv').eq('id', organisationId).maybeSingle()
  const domain = data?.custom_domain as string | null | undefined
  if (!domain) return { fehler: 'Keine eigene Domain hinterlegt.' }
  const bisherAktiv = data?.custom_domain_aktiv === true

  const ergebnis = await domainStatusLaden(domain)
  if (ergebnis.status) {
    // Merkt sich das Ergebnis für proxy.ts: nur bei funktionierender Domain
    // wird die Subdomain dorthin umgeleitet – und bricht die DNS später weg,
    // schaltet die nächste Prüfung die Umleitung wieder ab.
    const aktiv = ergebnis.status.verifiziert && ergebnis.status.dnsKorrekt
    await supabase.from('organisationen').update({ custom_domain_aktiv: aktiv }).eq('id', organisationId)
    if (aktiv !== bisherAktiv) {
      await supportProtokollieren(organisationId, 'plattform', aktiv ? 'Domain aktiv geschaltet' : 'Domain deaktiviert (nicht erreichbar)', domain)
    }
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
  if (domain) {
    await supportProtokollieren(organisationId, 'plattform', 'Domain entfernt', domain)
    await verwaltungBenachrichtigen(organisationId, `Eigene Domain ${domain} entfernt`, SUPPORT)
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
  const label = MODULE.find((m) => m.schluessel === modul)?.name ?? modul
  await supportProtokollieren(organisationId, 'plattform', freigeschaltet ? 'Modul freigeschaltet' : 'Modul auf Demo gesetzt', label)
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

// Weiteres Inhaber-Konto bzw. neue Einladung, z. B. wenn die erste Mail nie
// ankam. Gibt den Link zum Kopieren zurück.
export async function inhaberEinladenAktion(
  organisationId: string,
  email: string,
  name: string
): Promise<{ fehler?: string; link?: string; versendet?: boolean; benutzer?: BenutzerUebersicht[] }> {
  await plattformAdminOderFehler()
  const angelegt = await benutzerAnlegen(organisationId, email, name)
  if (!angelegt.benutzerId) return { fehler: angelegt.fehler }
  const einladung = await einladungVerschicken(organisationId, angelegt.benutzerId, email)
  await supportProtokollieren(organisationId, 'zugaenge', 'Verwaltungskonto eingeladen', email, angelegt.benutzerId)
  await verwaltungBenachrichtigen(organisationId, `Neues Verwaltungskonto eingeladen: ${name.trim() || email}`, SUPPORT, [angelegt.benutzerId])
  return { ...einladung, benutzer: await ladeBenutzerDerOrganisation(organisationId) }
}

async function benutzerDerOrganisation(organisationId: string, benutzerId: string) {
  const konto = await ladeKonto('benutzer', benutzerId)
  if (!konto || konto.organisationId !== organisationId) return null
  return konto
}

export async function einladungErneuernAktion(
  organisationId: string,
  benutzerId: string
): Promise<{ fehler?: string; link?: string; versendet?: boolean }> {
  await plattformAdminOderFehler()
  const konto = await benutzerDerOrganisation(organisationId, benutzerId)
  if (!konto) return { fehler: 'Konto nicht gefunden.' }
  if (konto.passwortHash) return { fehler: 'Das Konto ist schon eingerichtet – für ein vergessenes Passwort gibt es "Passwort vergessen".' }
  const ergebnis = await einladungVerschicken(organisationId, benutzerId, konto.email)
  await supportProtokollieren(organisationId, 'zugaenge', 'Einladung erneuert', konto.email, benutzerId)
  await verwaltungBenachrichtigen(organisationId, `Einladung für ${konto.email} erneuert`, SUPPORT, [benutzerId])
  return ergebnis
}

// Handy mit Authenticator-App und Wiederherstellungscodes verloren: 2FA
// zurücksetzen. Das beendet alle Sitzungen; bei der nächsten Anmeldung muss
// 2FA neu eingerichtet werden. Vorher die Identität der Person prüfen (z. B.
// Rückruf unter bekannter Nummer) – das ist die einzige Hintertür an 2FA
// vorbei.
export async function zweiFaktorZuruecksetzenAktion(organisationId: string, benutzerId: string): Promise<{ fehler?: string; benutzer?: BenutzerUebersicht[] }> {
  await plattformAdminOderFehler()
  const konto = await benutzerDerOrganisation(organisationId, benutzerId)
  if (!konto) return { fehler: 'Konto nicht gefunden.' }
  await totpZuruecksetzen(konto)
  await supportProtokollieren(organisationId, 'zugaenge', '2FA zurückgesetzt', konto.email, benutzerId)
  // Auch an die betroffene Person: sie muss beim nächsten Login die App neu einrichten.
  await verwaltungBenachrichtigen(organisationId, `2FA von ${konto.email} zurückgesetzt – alle Sitzungen beendet`, SUPPORT)
  return { benutzer: await ladeBenutzerDerOrganisation(organisationId) }
}

export async function benutzerAktivSetzenAktion(
  organisationId: string,
  benutzerId: string,
  aktiv: boolean
): Promise<{ fehler?: string; benutzer?: BenutzerUebersicht[] }> {
  await plattformAdminOderFehler()
  const konto = await benutzerDerOrganisation(organisationId, benutzerId)
  if (!konto) return { fehler: 'Konto nicht gefunden.' }
  const supabase = getServiceClient()
  const { error } = await supabase.from('benutzer').update({ aktiv }).eq('id', benutzerId).eq('organisation_id', organisationId)
  if (error) return { fehler: error.message }
  if (!aktiv) await sitzungenBeenden(konto)
  await supportProtokollieren(organisationId, 'zugaenge', 'Verwaltungskonto gesperrt/entsperrt', `${konto.email}: ${aktiv ? 'entsperrt' : 'gesperrt'}`, benutzerId)
  await verwaltungBenachrichtigen(organisationId, `Verwaltungskonto ${konto.email} ${aktiv ? 'entsperrt' : 'gesperrt'}`, SUPPORT)
  return { benutzer: await ladeBenutzerDerOrganisation(organisationId) }
}
