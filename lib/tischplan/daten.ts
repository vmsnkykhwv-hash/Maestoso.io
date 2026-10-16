import { getServiceClient } from '@/lib/supabase/server'
import type { Blockierung, Einstellungen, ReservierungAusnahme, Reservierung, ReservierungStatus, Tisch } from './types'
import { istGesperrt, VERTRAG_SPALTEN } from '@/lib/testphase/regeln'

const STANDARD_EINSTELLUNGEN: Einstellungen = {
  wocheStart: '09:00',
  wocheEnde: '20:30',
  sonntagStart: '10:00',
  sonntagEnde: '20:00',
  slotMinuten: 15,
  dauerMinuten: 180,
  vorlaufMinuten: 60,
  minPersonen: 1,
  maxPersonenOnline: 7,
  maxPersonenGleichzeitig: 40,
}

function zeitKuerzen(zeit: string): string {
  // Postgres `time` kommt als "HH:MM:SS" zurück, im UI reicht "HH:MM".
  return zeit.slice(0, 5)
}

export async function ladeEinstellungen(organisationId: string): Promise<Einstellungen> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('reservierung_einstellungen')
    .select('*')
    .eq('organisation_id', organisationId)
    .maybeSingle()

  if (!data) return STANDARD_EINSTELLUNGEN

  return {
    wocheStart: zeitKuerzen(data.woche_start as string),
    wocheEnde: zeitKuerzen(data.woche_ende as string),
    sonntagStart: zeitKuerzen(data.sonntag_start as string),
    sonntagEnde: zeitKuerzen(data.sonntag_ende as string),
    slotMinuten: data.slot_minuten as number,
    dauerMinuten: data.dauer_minuten as number,
    vorlaufMinuten: data.vorlauf_minuten as number,
    minPersonen: data.min_personen as number,
    maxPersonenOnline: data.max_personen_online as number,
    maxPersonenGleichzeitig: data.max_personen_gleichzeitig as number,
  }
}

export async function einstellungenSpeichern(organisationId: string, einstellungen: Einstellungen): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { error } = await supabase.from('reservierung_einstellungen').upsert({
    organisation_id: organisationId,
    woche_start: einstellungen.wocheStart,
    woche_ende: einstellungen.wocheEnde,
    sonntag_start: einstellungen.sonntagStart,
    sonntag_ende: einstellungen.sonntagEnde,
    slot_minuten: einstellungen.slotMinuten,
    dauer_minuten: einstellungen.dauerMinuten,
    vorlauf_minuten: einstellungen.vorlaufMinuten,
    min_personen: einstellungen.minPersonen,
    max_personen_online: einstellungen.maxPersonenOnline,
    max_personen_gleichzeitig: einstellungen.maxPersonenGleichzeitig,
  })
  if (error) return { fehler: error.message }
  return {}
}

function tischAusZeile(t: Record<string, unknown>): Tisch {
  return {
    id: t.id as string,
    name: t.name as string,
    kapazitaet: t.kapazitaet as number,
    sortierung: t.sortierung as number,
  }
}

export async function ladeTische(organisationId: string): Promise<Tisch[]> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('tische')
    .select('id, name, kapazitaet, sortierung')
    .eq('organisation_id', organisationId)
    .order('sortierung')
    .order('name')

  return (data ?? []).map(tischAusZeile)
}

export async function tischErstellen(
  organisationId: string,
  input: { name: string; kapazitaet: number }
): Promise<{ fehler?: string; tisch?: Tisch }> {
  const supabase = getServiceClient()
  const { data: bestehende } = await supabase
    .from('tische')
    .select('sortierung')
    .eq('organisation_id', organisationId)
    .order('sortierung', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from('tische')
    .insert({
      organisation_id: organisationId,
      name: input.name.trim(),
      kapazitaet: input.kapazitaet,
      sortierung: ((bestehende?.sortierung as number) ?? 0) + 1,
    })
    .select('id, name, kapazitaet, sortierung')
    .single()

  if (error || !data) {
    const istDuplikat = error?.code === '23505'
    return { fehler: istDuplikat ? 'Dieser Tischname ist schon vergeben' : (error?.message ?? 'Anlegen fehlgeschlagen') }
  }
  return { tisch: tischAusZeile(data) }
}

export async function tischAktualisieren(
  tischId: string,
  organisationId: string,
  patch: { name?: string; kapazitaet?: number }
): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const updateZeile: Record<string, unknown> = {}
  if (patch.name !== undefined) updateZeile.name = patch.name.trim()
  if (patch.kapazitaet !== undefined) updateZeile.kapazitaet = patch.kapazitaet

  const { data, error } = await supabase
    .from('tische')
    .update(updateZeile)
    .eq('id', tischId)
    .eq('organisation_id', organisationId)
    .select('id')
  if (error) return { fehler: error.code === '23505' ? 'Dieser Tischname ist schon vergeben' : error.message }
  if (!data || data.length === 0) return { fehler: 'Tisch nicht gefunden' }
  return {}
}

export async function tischLoeschen(tischId: string, organisationId: string): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { data, error } = await supabase.from('tische').delete().eq('id', tischId).eq('organisation_id', organisationId).select('id')
  if (error) return { fehler: error.message }
  if (!data || data.length === 0) return { fehler: 'Tisch nicht gefunden' }
  return {}
}

function reservierungAusZeile(r: Record<string, unknown>): Reservierung {
  return {
    id: r.id as string,
    name: r.name as string,
    email: r.email as string,
    anzahlPersonen: r.anzahl_personen as number,
    datum: r.datum as string,
    uhrzeit: zeitKuerzen(r.uhrzeit as string),
    erinnerung: r.erinnerung as boolean,
    status: r.status as ReservierungStatus,
    tischId: (r.tisch_id as string | null) ?? null,
    notiz: (r.notiz as string | null) ?? null,
    erstelltAt: r.erstellt_at as string,
  }
}

const RESERVIERUNG_SPALTEN = 'id, name, email, anzahl_personen, datum, uhrzeit, erinnerung, status, tisch_id, notiz, erstellt_at'

export async function ladeReservierungenFuerTag(organisationId: string, datum: string): Promise<Reservierung[]> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('reservierungen')
    .select(RESERVIERUNG_SPALTEN)
    .eq('organisation_id', organisationId)
    .eq('datum', datum)
    .order('uhrzeit')

  return (data ?? []).map(reservierungAusZeile)
}

// Für die Auswertung (lib/tischplan/auswertung.ts) – ein ganzer Zeitraum statt
// eines einzelnen Tages.
export async function ladeReservierungenFuerZeitraum(organisationId: string, von: string, bis: string): Promise<Reservierung[]> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('reservierungen')
    .select(RESERVIERUNG_SPALTEN)
    .eq('organisation_id', organisationId)
    .gte('datum', von)
    .lte('datum', bis)
    .order('datum')
    .order('uhrzeit')

  return (data ?? []).map(reservierungAusZeile)
}

export async function ladeReservierung(id: string): Promise<Reservierung | null> {
  const supabase = getServiceClient()
  const { data } = await supabase.from('reservierungen').select(RESERVIERUNG_SPALTEN).eq('id', id).maybeSingle()
  return data ? reservierungAusZeile(data) : null
}

// Atomare Kapazitätsprüfung direkt vor dem Insert (Postgres-Funktion, siehe
// 0019_kapazitaets_rpc.sql) – schließt die Lücke zwischen der Prüfung in
// pruefeBuchung() und dem tatsächlichen Anlegen, in der zwei nahezu
// gleichzeitige Buchungen sonst beide durchkommen könnten.
export async function reservierungErstellenMitPruefung(
  organisationId: string,
  input: {
    name: string
    email: string
    anzahlPersonen: number
    datum: string
    uhrzeit: string
    dauerMinuten: number
    gesamtTische: number
    maxPersonenGleichzeitig: number
    erinnerung: boolean
    notiz?: string | null
  }
): Promise<{ fehler?: string; reservierung?: Reservierung }> {
  const supabase = getServiceClient()
  const { data, error } = await supabase.rpc('reservierung_mit_pruefung_erstellen', {
    p_organisation_id: organisationId,
    p_name: input.name.trim(),
    p_email: input.email.trim(),
    p_anzahl_personen: input.anzahlPersonen,
    p_datum: input.datum,
    p_uhrzeit: input.uhrzeit,
    p_dauer_minuten: input.dauerMinuten,
    p_gesamt_tische: input.gesamtTische,
    p_max_personen_gleichzeitig: input.maxPersonenGleichzeitig,
    p_erinnerung: input.erinnerung,
    p_notiz: input.notiz ?? null,
  })

  if (error) {
    if (error.message.includes('KAPAZITAET_TISCHE')) return { fehler: 'Zu diesem Zeitpunkt ist leider kein Tisch mehr frei.' }
    if (error.message.includes('KAPAZITAET_PERSONEN')) return { fehler: 'Zu diesem Zeitpunkt ist das Haus leider schon ausgebucht.' }
    console.error('reservierungErstellenMitPruefung fehlgeschlagen:', error.message)
    return { fehler: 'Reservierung konnte nicht gespeichert werden. Bitte versucht es erneut.' }
  }
  if (!data) return { fehler: 'Reservierung konnte nicht gespeichert werden. Bitte versucht es erneut.' }

  return { reservierung: reservierungAusZeile(data as Record<string, unknown>) }
}

export async function reservierungStatusAendern(
  id: string,
  organisationId: string,
  status: ReservierungStatus
): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('reservierungen')
    .update({ status })
    .eq('id', id)
    .eq('organisation_id', organisationId)
    .select('id')
  if (error) return { fehler: error.message }
  if (!data || data.length === 0) return { fehler: 'Reservierung nicht gefunden' }
  return {}
}

// Gibt die ID der geplanten Erinnerungsmail zurück und vergisst sie – nur
// innerhalb der eigenen Organisation.
export async function reservierungErinnerungAbholen(id: string, organisationId: string): Promise<string | null> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('reservierungen')
    .select('resend_id')
    .eq('id', id)
    .eq('organisation_id', organisationId)
    .maybeSingle()
  const resendId = (data?.resend_id as string | null | undefined) ?? null
  if (resendId) await supabase.from('reservierungen').update({ resend_id: null }).eq('id', id).eq('organisation_id', organisationId)
  return resendId
}

// Fürs Bewertungsliste-Dashboard (lib/bewertung/daten.ts) – nur die paar
// Felder, die dort angezeigt werden, nicht die volle Reservierung.
export async function ladeErschieneneReservierungenFuerBewertung(
  organisationId: string,
  limit = 50
): Promise<{ id: string; name: string; email: string; datum: string; uhrzeit: string; bewertungResendId: string | null }[]> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('reservierungen')
    .select('id, name, email, datum, uhrzeit, bewertung_resend_id')
    .eq('organisation_id', organisationId)
    .eq('status', 'erschienen')
    .order('datum', { ascending: false })
    .order('uhrzeit', { ascending: false })
    .limit(limit)

  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    email: r.email as string,
    datum: r.datum as string,
    uhrzeit: zeitKuerzen(r.uhrzeit as string),
    bewertungResendId: (r.bewertung_resend_id as string | null) ?? null,
  }))
}

export async function reservierungTischZuweisen(
  id: string,
  organisationId: string,
  tischId: string | null
): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('reservierungen')
    .update({ tisch_id: tischId })
    .eq('id', id)
    .eq('organisation_id', organisationId)
    .select('id')
  if (error) return { fehler: error.message }
  if (!data || data.length === 0) return { fehler: 'Reservierung nicht gefunden' }
  return {}
}

export async function reservierungResendIdSetzen(id: string, resendId: string): Promise<void> {
  const supabase = getServiceClient()
  await supabase.from('reservierungen').update({ resend_id: resendId }).eq('id', id)
}

function blockierungAusZeile(b: Record<string, unknown>): Blockierung {
  return {
    id: b.id as string,
    datum: b.datum as string,
    startZeit: zeitKuerzen(b.start_zeit as string),
    endZeit: zeitKuerzen(b.end_zeit as string),
    anzahlTische: b.anzahl_tische as number,
    notiz: (b.notiz as string | null) ?? null,
  }
}

export async function ladeBlockierungenFuerTag(organisationId: string, datum: string): Promise<Blockierung[]> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('blockierungen')
    .select('id, datum, start_zeit, end_zeit, anzahl_tische, notiz')
    .eq('organisation_id', organisationId)
    .eq('datum', datum)
    .order('start_zeit')

  return (data ?? []).map(blockierungAusZeile)
}

export async function blockierungErstellen(
  organisationId: string,
  input: { datum: string; startZeit: string; endZeit: string; anzahlTische: number; notiz?: string | null }
): Promise<{ fehler?: string; blockierung?: Blockierung }> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('blockierungen')
    .insert({
      organisation_id: organisationId,
      datum: input.datum,
      start_zeit: input.startZeit,
      end_zeit: input.endZeit,
      anzahl_tische: input.anzahlTische,
      notiz: input.notiz ?? null,
    })
    .select('id, datum, start_zeit, end_zeit, anzahl_tische, notiz')
    .single()

  if (error || !data) return { fehler: error?.message ?? 'Anlegen fehlgeschlagen' }
  return { blockierung: blockierungAusZeile(data) }
}

export async function blockierungLoeschen(id: string, organisationId: string): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { data, error } = await supabase.from('blockierungen').delete().eq('id', id).eq('organisation_id', organisationId).select('id')
  if (error) return { fehler: error.message }
  if (!data || data.length === 0) return { fehler: 'Blockierung nicht gefunden' }
  return {}
}

function ausnahmeAusZeile(a: Record<string, unknown>): ReservierungAusnahme {
  return {
    id: a.id as string,
    datum: a.datum as string,
    geschlossen: a.geschlossen as boolean,
    von: a.von ? zeitKuerzen(a.von as string) : null,
    bis: a.bis ? zeitKuerzen(a.bis as string) : null,
    notiz: (a.notiz as string | null) ?? null,
  }
}

const AUSNAHME_SPALTEN = 'id, datum, geschlossen, von, bis, notiz'

export async function ladeAusnahmen(organisationId: string): Promise<ReservierungAusnahme[]> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('reservierung_ausnahmen')
    .select(AUSNAHME_SPALTEN)
    .eq('organisation_id', organisationId)
    .order('datum')

  return (data ?? []).map(ausnahmeAusZeile)
}

export async function ladeAusnahmeFuerDatum(organisationId: string, datum: string): Promise<ReservierungAusnahme | null> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('reservierung_ausnahmen')
    .select(AUSNAHME_SPALTEN)
    .eq('organisation_id', organisationId)
    .eq('datum', datum)
    .maybeSingle()

  return data ? ausnahmeAusZeile(data) : null
}

export async function ausnahmeSpeichern(
  organisationId: string,
  input: { datum: string; geschlossen: boolean; von: string | null; bis: string | null; notiz?: string | null }
): Promise<{ fehler?: string; ausnahme?: ReservierungAusnahme }> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('reservierung_ausnahmen')
    .upsert(
      {
        organisation_id: organisationId,
        datum: input.datum,
        geschlossen: input.geschlossen,
        von: input.geschlossen ? null : input.von,
        bis: input.geschlossen ? null : input.bis,
        notiz: input.notiz ?? null,
      },
      { onConflict: 'organisation_id,datum' }
    )
    .select(AUSNAHME_SPALTEN)
    .single()

  if (error || !data) return { fehler: error?.message ?? 'Speichern fehlgeschlagen' }
  return { ausnahme: ausnahmeAusZeile(data) }
}

export async function ausnahmeLoeschen(id: string, organisationId: string): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('reservierung_ausnahmen')
    .delete()
    .eq('id', id)
    .eq('organisation_id', organisationId)
    .select('id')
  if (error) return { fehler: error.message }
  if (!data || data.length === 0) return { fehler: 'Ausnahme nicht gefunden' }
  return {}
}

// null auch für einen gesperrten Betrieb (Testphase abgelaufen): alle
// Gästeseiten, Gäste-Actions und Team-Seiten behandeln ihn dadurch wie einen
// unbekannten Betrieb, ohne dass jede Stelle die Sperre selbst prüfen muss.
export async function organisationsName(organisationId: string): Promise<string | null> {
  const supabase = getServiceClient()
  const { data } = await supabase.from('organisationen').select(`name, ${VERTRAG_SPALTEN}`).eq('id', organisationId).maybeSingle()
  if (!data || istGesperrt(data)) return null
  return data.name as string
}
