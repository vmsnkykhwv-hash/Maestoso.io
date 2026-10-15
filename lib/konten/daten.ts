import { getServiceClient } from '@/lib/supabase/server'

// Ein gemeinsamer Datenzugriff für beide Kontoarten – Anmeldung, 2FA und
// Wiederherstellung laufen identisch, nur die Tabelle (und bei Benutzern die
// Organisation) unterscheidet sich.
export type KontoArt = 'admin' | 'benutzer'

export type Konto = {
  art: KontoArt
  id: string
  organisationId: string | null
  email: string
  name: string
  passwortHash: string | null
  totpGeheimnis: string | null
  totpAktiv: boolean
  totpLetzterSchritt: number | null
  wiederherstellungscodes: string[]
  sitzungVersion: number
  aktiv: boolean
}

function tabelle(art: KontoArt): string {
  return art === 'admin' ? 'plattform_admins' : 'benutzer'
}

function kontoAusZeile(art: KontoArt, z: Record<string, unknown>): Konto {
  return {
    art,
    id: z.id as string,
    organisationId: (z.organisation_id as string | undefined) ?? null,
    email: z.email as string,
    name: (z.name as string | undefined) ?? '',
    passwortHash: (z.passwort_hash as string | null) ?? null,
    totpGeheimnis: (z.totp_geheimnis as string | null) ?? null,
    totpAktiv: z.totp_aktiv === true,
    totpLetzterSchritt: z.totp_letzter_schritt == null ? null : Number(z.totp_letzter_schritt),
    wiederherstellungscodes: (z.wiederherstellungscodes as string[] | null) ?? [],
    sitzungVersion: Number(z.sitzung_version ?? 1),
    aktiv: art === 'admin' ? true : z.aktiv !== false,
  }
}

export function emailNormalisieren(email: string): string {
  return email.trim().toLowerCase()
}

export async function ladeKonto(art: KontoArt, id: string): Promise<Konto | null> {
  const supabase = getServiceClient()
  const { data } = await supabase.from(tabelle(art)).select('*').eq('id', id).maybeSingle()
  return data ? kontoAusZeile(art, data) : null
}

// Benutzer immer nur innerhalb der Organisation suchen, deren Domain
// aufgerufen wurde – dieselbe E-Mail darf bei zwei Betrieben ein Konto haben,
// und ein Konto des einen Betriebs darf sich nie beim anderen anmelden.
export async function ladeKontoPerEmail(art: KontoArt, email: string, organisationId?: string): Promise<Konto | null> {
  const supabase = getServiceClient()
  let query = supabase.from(tabelle(art)).select('*').eq('email', emailNormalisieren(email))
  if (art === 'benutzer') {
    if (!organisationId) return null
    query = query.eq('organisation_id', organisationId)
  }
  const { data } = await query.maybeSingle()
  return data ? kontoAusZeile(art, data) : null
}

export async function adminVorhanden(): Promise<boolean> {
  const supabase = getServiceClient()
  const { count } = await supabase.from('plattform_admins').select('id', { count: 'exact', head: true })
  return (count ?? 0) > 0
}

export async function adminAnlegen(email: string, passwortHash: string): Promise<{ fehler?: string; konto?: Konto }> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('plattform_admins')
    .insert({ email: emailNormalisieren(email), passwort_hash: passwortHash })
    .select('*')
    .single()
  if (error || !data) return { fehler: error?.message ?? 'Konto konnte nicht angelegt werden' }
  return { konto: kontoAusZeile('admin', data) }
}

async function aktualisieren(art: KontoArt, id: string, felder: Record<string, unknown>): Promise<void> {
  const supabase = getServiceClient()
  const { error } = await supabase.from(tabelle(art)).update(felder).eq('id', id)
  if (error) throw new Error(error.message)
}

// Neues Passwort beendet alle bestehenden Sitzungen (sitzung_version + 1) –
// wer das alte Passwort kannte, ist danach überall abgemeldet.
export async function passwortSetzen(konto: Konto, passwortHash: string): Promise<void> {
  await aktualisieren(konto.art, konto.id, { passwort_hash: passwortHash, sitzung_version: konto.sitzungVersion + 1 })
}

export async function totpGeheimnisSetzen(konto: Konto, verschluesselt: string): Promise<void> {
  await aktualisieren(konto.art, konto.id, { totp_geheimnis: verschluesselt, totp_aktiv: false })
}

export async function totpAktivieren(konto: Konto, schritt: number, codeHashes: string[]): Promise<void> {
  await aktualisieren(konto.art, konto.id, { totp_aktiv: true, totp_letzter_schritt: schritt, wiederherstellungscodes: codeHashes })
}

export async function totpSchrittMerken(konto: Konto, schritt: number): Promise<void> {
  await aktualisieren(konto.art, konto.id, { totp_letzter_schritt: schritt })
}

export async function wiederherstellungscodesSetzen(konto: Konto, codeHashes: string[]): Promise<void> {
  await aktualisieren(konto.art, konto.id, { wiederherstellungscodes: codeHashes })
}

// Für den Fall "Handy und Codes verloren": nur durch den Plattform-Admin
// (Benutzer) bzw. per Datenbank (Admin). Beendet alle Sitzungen; bei der
// nächsten Anmeldung muss 2FA neu eingerichtet werden.
export async function totpZuruecksetzen(konto: Konto): Promise<void> {
  await aktualisieren(konto.art, konto.id, {
    totp_geheimnis: null,
    totp_aktiv: false,
    totp_letzter_schritt: null,
    wiederherstellungscodes: [],
    sitzung_version: konto.sitzungVersion + 1,
  })
}

export async function sitzungenBeenden(konto: Konto): Promise<void> {
  await aktualisieren(konto.art, konto.id, { sitzung_version: konto.sitzungVersion + 1 })
}

export async function benutzerNameSetzen(benutzerId: string, name: string): Promise<void> {
  await aktualisieren('benutzer', benutzerId, { name: name.trim() })
}
