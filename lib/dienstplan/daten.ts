import { getServiceClient } from '@/lib/supabase/server'
import type { Schicht, TauschAnfrage, TauschAnfrageStatus, Verfuegbarkeit } from './types'

function zeitKuerzen(zeit: string): string {
  // Postgres `time` kommt als "HH:MM:SS" zurück, im UI reicht "HH:MM".
  return zeit.slice(0, 5)
}

function schichtAusZeile(s: Record<string, unknown>): Schicht {
  return {
    id: s.id as string,
    datum: s.datum as string,
    beginn: zeitKuerzen(s.beginn as string),
    ende: zeitKuerzen(s.ende as string),
    mitarbeiterId: (s.mitarbeiter_id as string | null) ?? null,
    notiz: (s.notiz as string | null) ?? null,
  }
}

const SCHICHT_SPALTEN = 'id, datum, beginn, ende, mitarbeiter_id, notiz'

export async function ladeSchichtenFuerZeitraum(organisationId: string, von: string, bis: string): Promise<Schicht[]> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('schichten')
    .select(SCHICHT_SPALTEN)
    .eq('organisation_id', organisationId)
    .gte('datum', von)
    .lte('datum', bis)
    .order('datum')
    .order('beginn')

  return (data ?? []).map(schichtAusZeile)
}

export async function ladeSchichtenFuerMitarbeiter(mitarbeiterId: string, von: string, bis: string): Promise<Schicht[]> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('schichten')
    .select(SCHICHT_SPALTEN)
    .eq('mitarbeiter_id', mitarbeiterId)
    .gte('datum', von)
    .lte('datum', bis)
    .order('datum')
    .order('beginn')

  return (data ?? []).map(schichtAusZeile)
}

export async function ladeSchicht(schichtId: string, organisationId: string): Promise<Schicht | null> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('schichten')
    .select(SCHICHT_SPALTEN)
    .eq('id', schichtId)
    .eq('organisation_id', organisationId)
    .maybeSingle()
  return data ? schichtAusZeile(data) : null
}

export async function schichtErstellen(
  organisationId: string,
  input: { datum: string; beginn: string; ende: string; mitarbeiterId: string | null; notiz?: string | null }
): Promise<{ fehler?: string; schicht?: Schicht }> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('schichten')
    .insert({
      organisation_id: organisationId,
      datum: input.datum,
      beginn: input.beginn,
      ende: input.ende,
      mitarbeiter_id: input.mitarbeiterId,
      notiz: input.notiz ?? null,
    })
    .select(SCHICHT_SPALTEN)
    .single()

  if (error || !data) return { fehler: error?.message ?? 'Anlegen fehlgeschlagen' }
  return { schicht: schichtAusZeile(data) }
}

export async function schichtAktualisieren(
  schichtId: string,
  organisationId: string,
  patch: { datum?: string; beginn?: string; ende?: string; mitarbeiterId?: string | null; notiz?: string | null }
): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const updateZeile: Record<string, unknown> = {}
  if (patch.datum !== undefined) updateZeile.datum = patch.datum
  if (patch.beginn !== undefined) updateZeile.beginn = patch.beginn
  if (patch.ende !== undefined) updateZeile.ende = patch.ende
  if (patch.mitarbeiterId !== undefined) updateZeile.mitarbeiter_id = patch.mitarbeiterId
  if (patch.notiz !== undefined) updateZeile.notiz = patch.notiz

  const { data, error } = await supabase
    .from('schichten')
    .update(updateZeile)
    .eq('id', schichtId)
    .eq('organisation_id', organisationId)
    .select('id')
  if (error) return { fehler: error.message }
  if (!data || data.length === 0) return { fehler: 'Schicht nicht gefunden' }
  return {}
}

export async function schichtLoeschen(schichtId: string, organisationId: string): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('schichten')
    .delete()
    .eq('id', schichtId)
    .eq('organisation_id', organisationId)
    .select('id')
  if (error) return { fehler: error.message }
  if (!data || data.length === 0) return { fehler: 'Schicht nicht gefunden' }
  return {}
}

function verfuegbarkeitAusZeile(v: Record<string, unknown>): Verfuegbarkeit {
  return {
    id: v.id as string,
    mitarbeiterId: v.mitarbeiter_id as string,
    datum: v.datum as string,
    verfuegbar: v.verfuegbar as boolean,
    von: v.von ? zeitKuerzen(v.von as string) : null,
    bis: v.bis ? zeitKuerzen(v.bis as string) : null,
    notiz: (v.notiz as string | null) ?? null,
  }
}

const VERFUEGBARKEIT_SPALTEN = 'id, mitarbeiter_id, datum, verfuegbar, von, bis, notiz'

export async function ladeVerfuegbarkeitenFuerZeitraum(organisationId: string, von: string, bis: string): Promise<Verfuegbarkeit[]> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('verfuegbarkeiten')
    .select(VERFUEGBARKEIT_SPALTEN)
    .eq('organisation_id', organisationId)
    .gte('datum', von)
    .lte('datum', bis)

  return (data ?? []).map(verfuegbarkeitAusZeile)
}

export async function ladeVerfuegbarkeitenFuerMitarbeiter(mitarbeiterId: string, von: string, bis: string): Promise<Verfuegbarkeit[]> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('verfuegbarkeiten')
    .select(VERFUEGBARKEIT_SPALTEN)
    .eq('mitarbeiter_id', mitarbeiterId)
    .gte('datum', von)
    .lte('datum', bis)

  return (data ?? []).map(verfuegbarkeitAusZeile)
}

export async function verfuegbarkeitSetzen(
  organisationId: string,
  mitarbeiterId: string,
  input: { datum: string; verfuegbar: boolean; von?: string | null; bis?: string | null; notiz?: string | null }
): Promise<{ fehler?: string; verfuegbarkeit?: Verfuegbarkeit }> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('verfuegbarkeiten')
    .upsert(
      {
        organisation_id: organisationId,
        mitarbeiter_id: mitarbeiterId,
        datum: input.datum,
        verfuegbar: input.verfuegbar,
        von: input.von ?? null,
        bis: input.bis ?? null,
        notiz: input.notiz ?? null,
        aktualisiert_at: new Date().toISOString(),
      },
      { onConflict: 'mitarbeiter_id,datum' }
    )
    .select(VERFUEGBARKEIT_SPALTEN)
    .single()

  if (error || !data) return { fehler: error?.message ?? 'Speichern fehlgeschlagen' }
  return { verfuegbarkeit: verfuegbarkeitAusZeile(data) }
}

function tauschAusZeile(t: Record<string, unknown>): TauschAnfrage {
  return {
    id: t.id as string,
    schichtId: t.schicht_id as string,
    anfragenderMitarbeiterId: t.anfragender_mitarbeiter_id as string,
    zielMitarbeiterId: (t.ziel_mitarbeiter_id as string | null) ?? null,
    status: t.status as TauschAnfrageStatus,
    erstelltAt: t.erstellt_at as string,
  }
}

const TAUSCH_SPALTEN = 'id, schicht_id, anfragender_mitarbeiter_id, ziel_mitarbeiter_id, status, erstellt_at'

// "offen" (noch niemand hat zugesagt) UND "angenommen" (jemand hat
// zugesagt, wartet auf Bestätigung der Leitung) gelten als aktiv – beide
// müssen in der Tauschbörse sichtbar bleiben, sonst verschwindet eine
// zugesagte Anfrage aus dem Blick, bevor die Leitung sie bestätigt hat.
export async function ladeAktiveTauschAnfragen(organisationId: string): Promise<TauschAnfrage[]> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('tausch_anfragen')
    .select(TAUSCH_SPALTEN)
    .eq('organisation_id', organisationId)
    .in('status', ['offen', 'angenommen'])
    .order('erstellt_at')

  return (data ?? []).map(tauschAusZeile)
}

export async function ladeTauschAnfrage(id: string, organisationId: string): Promise<TauschAnfrage | null> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('tausch_anfragen')
    .select(TAUSCH_SPALTEN)
    .eq('id', id)
    .eq('organisation_id', organisationId)
    .maybeSingle()
  return data ? tauschAusZeile(data) : null
}

export async function tauschAnfrageErstellen(
  organisationId: string,
  schichtId: string,
  anfragenderMitarbeiterId: string
): Promise<{ fehler?: string; anfrage?: TauschAnfrage }> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('tausch_anfragen')
    .insert({ organisation_id: organisationId, schicht_id: schichtId, anfragender_mitarbeiter_id: anfragenderMitarbeiterId })
    .select(TAUSCH_SPALTEN)
    .single()

  if (error || !data) {
    const istDuplikat = error?.code === '23505'
    return { fehler: istDuplikat ? 'Für diese Schicht läuft schon eine Tausch-Anfrage' : (error?.message ?? 'Anlegen fehlgeschlagen') }
  }
  return { anfrage: tauschAusZeile(data) }
}

// Zusagen ist ein bedingtes Update (nur solange die Anfrage noch "offen"
// ist) statt eines blinden Status-Setzens – verhindert, dass zwei
// Mitarbeiter dieselbe Schicht gleichzeitig zusagen, falls beide fast
// zeitgleich auf "Annehmen" klicken.
export async function tauschAnfrageZusagen(id: string, organisationId: string, zielMitarbeiterId: string): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('tausch_anfragen')
    .update({ status: 'angenommen', ziel_mitarbeiter_id: zielMitarbeiterId })
    .eq('id', id)
    .eq('organisation_id', organisationId)
    .eq('status', 'offen')
    .select('id')

  if (error) return { fehler: error.message }
  if (!data || data.length === 0) return { fehler: 'Diese Tausch-Anfrage ist nicht mehr offen' }
  return {}
}

// nurVonStatus: bedingtes Update, nur wenn die Anfrage aktuell einen
// dieser Status hat – verhindert z. B., dass "Ablehnen" einen bereits
// bestätigten Tausch (Schicht schon umgeschrieben) nachträglich auf
// "abgelehnt" zurücksetzt und so einen widersprüchlichen Datensatz
// hinterlässt.
export async function tauschAnfrageStatusSetzen(
  id: string,
  organisationId: string,
  status: TauschAnfrageStatus,
  nurVonStatus?: TauschAnfrageStatus[],
  zielMitarbeiterId?: string | null
): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const updateZeile: Record<string, unknown> = { status, entschieden_at: new Date().toISOString() }
  if (zielMitarbeiterId !== undefined) updateZeile.ziel_mitarbeiter_id = zielMitarbeiterId

  let query = supabase.from('tausch_anfragen').update(updateZeile).eq('id', id).eq('organisation_id', organisationId)
  if (nurVonStatus) query = query.in('status', nurVonStatus)

  const { data, error } = await query.select('id')
  if (error) return { fehler: error.message }
  if (nurVonStatus && (!data || data.length === 0)) return { fehler: 'Diese Anfrage hat nicht (mehr) den erwarteten Status' }
  return {}
}
