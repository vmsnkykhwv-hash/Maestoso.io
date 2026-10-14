import { getServiceClient } from '@/lib/supabase/server'
import type { Veranstaltung, VeranstaltungEinstellungen, VeranstaltungStatus } from './types'

const STANDARD_EINSTELLUNGEN: VeranstaltungEinstellungen = {
  aktiv: false,
  infoText: null,
  benachrichtigungEmail: null,
}

export async function ladeVeranstaltungEinstellungen(organisationId: string): Promise<VeranstaltungEinstellungen> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('veranstaltung_einstellungen')
    .select('*')
    .eq('organisation_id', organisationId)
    .maybeSingle()

  if (!data) return STANDARD_EINSTELLUNGEN

  return {
    aktiv: data.aktiv as boolean,
    infoText: (data.info_text as string | null) ?? null,
    benachrichtigungEmail: (data.benachrichtigung_email as string | null) ?? null,
  }
}

export async function veranstaltungEinstellungenSpeichern(
  organisationId: string,
  einstellungen: VeranstaltungEinstellungen
): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { error } = await supabase.from('veranstaltung_einstellungen').upsert({
    organisation_id: organisationId,
    aktiv: einstellungen.aktiv,
    info_text: einstellungen.infoText,
    benachrichtigung_email: einstellungen.benachrichtigungEmail,
  })
  if (error) return { fehler: error.message }
  return {}
}

function zeitKuerzen(zeit: string): string {
  return zeit.slice(0, 5)
}

function veranstaltungAusZeile(z: Record<string, unknown>): Veranstaltung {
  return {
    id: z.id as string,
    titel: z.titel as string,
    ansprechpartnerName: z.ansprechpartner_name as string,
    email: z.email as string,
    telefon: z.telefon as string,
    datum: z.datum as string,
    beginn: zeitKuerzen(z.beginn as string),
    ende: zeitKuerzen(z.ende as string),
    geschaetzteGaeste: z.geschaetzte_gaeste as number,
    status: z.status as VeranstaltungStatus,
    preis: z.preis !== null ? Number(z.preis) : null,
    anzahlung: z.anzahlung !== null ? Number(z.anzahlung) : null,
    notiz: (z.notiz as string | null) ?? null,
    blockierungId: (z.blockierung_id as string | null) ?? null,
    erstelltAt: z.erstellt_at as string,
  }
}

const VERANSTALTUNG_SPALTEN =
  'id, titel, ansprechpartner_name, email, telefon, datum, beginn, ende, geschaetzte_gaeste, status, preis, anzahlung, notiz, blockierung_id, erstellt_at'

export async function ladeVeranstaltungenFuerOrganisation(organisationId: string): Promise<Veranstaltung[]> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('veranstaltungen')
    .select(VERANSTALTUNG_SPALTEN)
    .eq('organisation_id', organisationId)
    .order('datum', { ascending: false })
    .order('beginn', { ascending: false })

  return (data ?? []).map(veranstaltungAusZeile)
}

export async function ladeVeranstaltung(id: string, organisationId: string): Promise<Veranstaltung | null> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('veranstaltungen')
    .select(VERANSTALTUNG_SPALTEN)
    .eq('id', id)
    .eq('organisation_id', organisationId)
    .maybeSingle()
  return data ? veranstaltungAusZeile(data) : null
}

export async function veranstaltungAnlegen(
  organisationId: string,
  input: {
    titel: string
    ansprechpartnerName: string
    email: string
    telefon: string
    datum: string
    beginn: string
    ende: string
    geschaetzteGaeste: number
    notiz?: string | null
  }
): Promise<{ fehler?: string; veranstaltung?: Veranstaltung }> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('veranstaltungen')
    .insert({
      organisation_id: organisationId,
      titel: input.titel.trim(),
      ansprechpartner_name: input.ansprechpartnerName.trim(),
      email: input.email.trim(),
      telefon: input.telefon.trim(),
      datum: input.datum,
      beginn: input.beginn,
      ende: input.ende,
      geschaetzte_gaeste: input.geschaetzteGaeste,
      notiz: input.notiz?.trim() || null,
    })
    .select(VERANSTALTUNG_SPALTEN)
    .single()

  if (error || !data) return { fehler: error?.message ?? 'Anlegen fehlgeschlagen' }
  return { veranstaltung: veranstaltungAusZeile(data) }
}

export async function veranstaltungStatusAendern(
  id: string,
  organisationId: string,
  status: VeranstaltungStatus
): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('veranstaltungen')
    .update({ status })
    .eq('id', id)
    .eq('organisation_id', organisationId)
    .select('id')
  if (error) return { fehler: error.message }
  if (!data || data.length === 0) return { fehler: 'Veranstaltung nicht gefunden' }
  return {}
}

export async function veranstaltungBlockierungIdSetzen(
  id: string,
  organisationId: string,
  blockierungId: string | null
): Promise<void> {
  const supabase = getServiceClient()
  await supabase.from('veranstaltungen').update({ blockierung_id: blockierungId }).eq('id', id).eq('organisation_id', organisationId)
}

export async function veranstaltungPreiseSpeichern(
  id: string,
  organisationId: string,
  input: { preis: number | null; anzahlung: number | null }
): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('veranstaltungen')
    .update({ preis: input.preis, anzahlung: input.anzahlung })
    .eq('id', id)
    .eq('organisation_id', organisationId)
    .select('id')
  if (error) return { fehler: error.message }
  if (!data || data.length === 0) return { fehler: 'Veranstaltung nicht gefunden' }
  return {}
}

export async function veranstaltungLoeschen(id: string, organisationId: string): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { data, error } = await supabase.from('veranstaltungen').delete().eq('id', id).eq('organisation_id', organisationId).select('id')
  if (error) return { fehler: error.message }
  if (!data || data.length === 0) return { fehler: 'Veranstaltung nicht gefunden' }
  return {}
}
