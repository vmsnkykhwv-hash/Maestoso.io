import { getServiceClient } from '@/lib/supabase/server'
import { emailNormalisieren, ladeKonto, type Konto } from './daten'
import { einmalTokenErzeugen, einmalTokenHash } from './wiederherstellung'

export type TokenZweck = 'einladung' | 'passwort'

// Einladungen bleiben eine Woche gültig (Inhaber*in liest die Mail nicht
// sofort), Passwort-Links nur eine Stunde – die werden direkt benutzt.
const GUELTIGKEIT_MS: Record<TokenZweck, number> = {
  einladung: 1000 * 60 * 60 * 24 * 7,
  passwort: 1000 * 60 * 60,
}

export type BenutzerUebersicht = {
  id: string
  email: string
  name: string
  eingerichtet: boolean
  zweiFaktorAktiv: boolean
  aktiv: boolean
}

export async function ladeBenutzerDerOrganisation(organisationId: string): Promise<BenutzerUebersicht[]> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('benutzer')
    .select('id, email, name, passwort_hash, totp_aktiv, aktiv')
    .eq('organisation_id', organisationId)
    .order('erstellt_at')
  return (data ?? []).map((b) => ({
    id: b.id as string,
    email: b.email as string,
    name: b.name as string,
    eingerichtet: !!b.passwort_hash,
    zweiFaktorAktiv: b.totp_aktiv === true,
    aktiv: b.aktiv !== false,
  }))
}

export async function benutzerAnlegen(
  organisationId: string,
  email: string,
  name: string
): Promise<{ fehler?: string; benutzerId?: string }> {
  const adresse = emailNormalisieren(email)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adresse)) return { fehler: 'Bitte eine gültige E-Mail-Adresse angeben.' }
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('benutzer')
    .insert({ organisation_id: organisationId, email: adresse, name: name.trim() })
    .select('id')
    .single()
  if (error?.code === '23505') return { fehler: 'Für diese E-Mail-Adresse gibt es in diesem Betrieb schon ein Konto.' }
  if (error || !data) return { fehler: error?.message ?? 'Konto konnte nicht angelegt werden' }
  return { benutzerId: data.id as string }
}

// Ein neuer Link macht ältere, noch offene Links desselben Zwecks ungültig –
// sonst blieben z. B. mehrere "Passwort vergessen"-Mails gleichzeitig nutzbar.
export async function tokenErstellen(benutzerId: string, zweck: TokenZweck): Promise<string> {
  const supabase = getServiceClient()
  await supabase
    .from('konto_tokens')
    .update({ verwendet_at: new Date().toISOString() })
    .eq('benutzer_id', benutzerId)
    .eq('zweck', zweck)
    .is('verwendet_at', null)

  const { token, hash } = einmalTokenErzeugen()
  const { error } = await supabase.from('konto_tokens').insert({
    benutzer_id: benutzerId,
    zweck,
    token_hash: hash,
    ablauf: new Date(Date.now() + GUELTIGKEIT_MS[zweck]).toISOString(),
  })
  if (error) throw new Error(error.message)
  return token
}

// Prüft nur, löst noch nicht ein – für die Anzeige der Seite.
export async function tokenPruefenFuer(
  token: string,
  zweck: TokenZweck,
  organisationId: string
): Promise<{ tokenId: string; konto: Konto } | null> {
  if (!token) return null
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('konto_tokens')
    .select('id, benutzer_id, ablauf, verwendet_at')
    .eq('token_hash', einmalTokenHash(token))
    .eq('zweck', zweck)
    .maybeSingle()
  if (!data || data.verwendet_at || new Date(data.ablauf as string).getTime() < Date.now()) return null

  const konto = await ladeKonto('benutzer', data.benutzer_id as string)
  // Ein Link für Betrieb A darf auf der Domain von Betrieb B nichts tun.
  if (!konto || !konto.aktiv || konto.organisationId !== organisationId) return null
  return { tokenId: data.id as string, konto }
}

// Bedingt einlösen (nur wenn noch unbenutzt), damit derselbe Link bei einem
// Doppelklick nicht zweimal greift.
export async function tokenEinloesen(tokenId: string): Promise<boolean> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('konto_tokens')
    .update({ verwendet_at: new Date().toISOString() })
    .eq('id', tokenId)
    .is('verwendet_at', null)
    .select('id')
  return !!data && data.length > 0
}
