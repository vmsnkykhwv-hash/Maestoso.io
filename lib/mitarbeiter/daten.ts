import { getServiceClient } from '@/lib/supabase/server'
import type { Mitarbeiter } from './types'

export async function ladeMitarbeiter(mitarbeiterId: string, organisationId: string): Promise<Mitarbeiter | null> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('mitarbeiter')
    .select('id, name, rolle, mitarbeiter_typ, stunden_grenze, aktiv')
    .eq('id', mitarbeiterId)
    .eq('organisation_id', organisationId)
    .maybeSingle()

  if (!data) return null

  return {
    id: data.id as string,
    name: data.name as string,
    rolle: data.rolle as Mitarbeiter['rolle'],
    mitarbeiterTyp: data.mitarbeiter_typ as Mitarbeiter['mitarbeiterTyp'],
    stundenGrenze: Number(data.stunden_grenze),
    aktiv: data.aktiv as boolean,
  }
}

// Minimale, nicht sensible Mitarbeiterliste (nur Name) – für Ansichten, die
// Kolleginnen/Kollegen beim Namen zeigen müssen (z. B. der Dienstplan),
// aber nicht die vollen Mitarbeiterdaten sehen dürfen (PIN-Hash, Grenzen
// etc. bleiben Leitungssache, siehe ladeMitarbeiterListe).
export async function ladeMitarbeiterNamen(organisationId: string): Promise<{ id: string; name: string }[]> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('mitarbeiter')
    .select('id, name')
    .eq('organisation_id', organisationId)
    .eq('aktiv', true)
    .order('name')

  return (data ?? []).map((m) => ({ id: m.id as string, name: m.name as string }))
}

export async function ladeMitarbeiterListe(organisationId: string): Promise<Mitarbeiter[]> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('mitarbeiter')
    .select('id, name, rolle, mitarbeiter_typ, stunden_grenze, aktiv')
    .eq('organisation_id', organisationId)
    .order('name')

  return (data ?? []).map((m) => ({
    id: m.id as string,
    name: m.name as string,
    rolle: m.rolle as Mitarbeiter['rolle'],
    mitarbeiterTyp: m.mitarbeiter_typ as Mitarbeiter['mitarbeiterTyp'],
    stundenGrenze: Number(m.stunden_grenze),
    aktiv: m.aktiv as boolean,
  }))
}
