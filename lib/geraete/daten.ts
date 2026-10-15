import { getServiceClient } from '@/lib/supabase/server'
import { einmalTokenErzeugen, einmalTokenHash } from '@/lib/konten/wiederherstellung'

export type Geraet = {
  id: string
  organisationId: string
  art: 'tresen' | 'handy'
  name: string
  mitarbeiterId: string | null
  erstelltAt: string
  zuletztGesehenAt: string | null
  widerrufen: boolean
}

function geraetAusZeile(g: Record<string, unknown>): Geraet {
  return {
    id: g.id as string,
    organisationId: g.organisation_id as string,
    art: g.art as Geraet['art'],
    name: g.name as string,
    mitarbeiterId: (g.mitarbeiter_id as string | null) ?? null,
    erstelltAt: g.erstellt_at as string,
    zuletztGesehenAt: (g.zuletzt_gesehen_at as string | null) ?? null,
    widerrufen: !!g.widerrufen_at,
  }
}

export async function ladeGeraet(geraetId: string): Promise<Geraet | null> {
  const supabase = getServiceClient()
  const { data } = await supabase.from('geraete').select('*').eq('id', geraetId).maybeSingle()
  return data ? geraetAusZeile(data) : null
}

export async function ladeGeraeteDerOrganisation(organisationId: string): Promise<Geraet[]> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('geraete')
    .select('*')
    .eq('organisation_id', organisationId)
    .is('widerrufen_at', null)
    .order('erstellt_at')
  return (data ?? []).map(geraetAusZeile)
}

export async function geraetAnlegen(input: {
  organisationId: string
  art: Geraet['art']
  name: string
  mitarbeiterId?: string
  erstelltVon?: string
}): Promise<Geraet> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('geraete')
    .insert({
      organisation_id: input.organisationId,
      art: input.art,
      name: input.name.trim() || (input.art === 'tresen' ? 'Tresen-Gerät' : 'Handy'),
      mitarbeiter_id: input.mitarbeiterId ?? null,
      erstellt_von: input.erstelltVon ?? null,
    })
    .select('*')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Gerät konnte nicht angelegt werden')
  return geraetAusZeile(data)
}

export async function geraetWiderrufen(organisationId: string, geraetId: string): Promise<boolean> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('geraete')
    .update({ widerrufen_at: new Date().toISOString() })
    .eq('id', geraetId)
    .eq('organisation_id', organisationId)
    .select('id')
  return !!data && data.length > 0
}

// Höchstens einmal pro Stunde schreiben – sonst wäre jede Anfrage auch ein
// Datenbank-Update, nur damit die Geräteliste "zuletzt aktiv" zeigen kann.
export async function geraetGesehen(geraet: Geraet): Promise<void> {
  if (geraet.zuletztGesehenAt && Date.now() - new Date(geraet.zuletztGesehenAt).getTime() < 60 * 60 * 1000) return
  const supabase = getServiceClient()
  await supabase.from('geraete').update({ zuletzt_gesehen_at: new Date().toISOString() }).eq('id', geraet.id)
}

const KOPPLUNG_GUELTIGKEIT_MS = 1000 * 60 * 15

export async function kopplungscodeErstellen(organisationId: string, mitarbeiterId: string): Promise<string> {
  const supabase = getServiceClient()
  const { token, hash } = einmalTokenErzeugen()
  const { error } = await supabase.from('kopplungscodes').insert({
    organisation_id: organisationId,
    mitarbeiter_id: mitarbeiterId,
    code_hash: hash,
    ablauf: new Date(Date.now() + KOPPLUNG_GUELTIGKEIT_MS).toISOString(),
  })
  if (error) throw new Error(error.message)
  return token
}

export async function kopplungscodePruefen(
  code: string,
  organisationId: string
): Promise<{ id: string; mitarbeiterId: string } | null> {
  if (!code) return null
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('kopplungscodes')
    .select('id, mitarbeiter_id, ablauf, verwendet_at')
    .eq('code_hash', einmalTokenHash(code))
    .eq('organisation_id', organisationId)
    .maybeSingle()
  if (!data || data.verwendet_at || new Date(data.ablauf as string).getTime() < Date.now()) return null
  return { id: data.id as string, mitarbeiterId: data.mitarbeiter_id as string }
}

export async function kopplungscodeEinloesen(id: string): Promise<boolean> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('kopplungscodes')
    .update({ verwendet_at: new Date().toISOString() })
    .eq('id', id)
    .is('verwendet_at', null)
    .select('id')
  return !!data && data.length > 0
}
