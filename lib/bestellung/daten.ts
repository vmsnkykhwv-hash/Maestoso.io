import { getServiceClient } from '@/lib/supabase/server'
import type { Bestellung, BestellEinstellungen, BestellKanal, BestellPosition, BestellStatus } from './types'

const STANDARD_EINSTELLUNGEN: BestellEinstellungen = {
  abholungAktiv: true,
  lieferungAktiv: true,
  abholungVon: null,
  abholungBis: null,
  lieferungVon: null,
  lieferungBis: null,
  slotMinuten: 15,
  vorlaufMinutenAbholung: 20,
  vorlaufMinutenLieferung: 45,
  maxOffenAbholung: null,
  maxOffenLieferung: null,
  abholungPausiertBis: null,
  lieferungPausiertBis: null,
  abholungPauseGrund: null,
  lieferungPauseGrund: null,
  benachrichtigungEmail: null,
}

function zeitKuerzen(zeit: string | null): string | null {
  // Postgres `time` kommt als "HH:MM:SS" zurück, im UI reicht "HH:MM".
  return zeit ? zeit.slice(0, 5) : null
}

export async function ladeBestellEinstellungen(organisationId: string): Promise<BestellEinstellungen> {
  const supabase = getServiceClient()
  const { data } = await supabase.from('bestell_einstellungen').select('*').eq('organisation_id', organisationId).maybeSingle()

  if (!data) return STANDARD_EINSTELLUNGEN

  return {
    abholungAktiv: data.abholung_aktiv as boolean,
    lieferungAktiv: data.lieferung_aktiv as boolean,
    abholungVon: zeitKuerzen(data.abholung_von as string | null),
    abholungBis: zeitKuerzen(data.abholung_bis as string | null),
    lieferungVon: zeitKuerzen(data.lieferung_von as string | null),
    lieferungBis: zeitKuerzen(data.lieferung_bis as string | null),
    slotMinuten: data.slot_minuten as number,
    vorlaufMinutenAbholung: data.vorlauf_minuten_abholung as number,
    vorlaufMinutenLieferung: data.vorlauf_minuten_lieferung as number,
    maxOffenAbholung: (data.max_offen_abholung as number | null) ?? null,
    maxOffenLieferung: (data.max_offen_lieferung as number | null) ?? null,
    abholungPausiertBis: (data.abholung_pausiert_bis as string | null) ?? null,
    lieferungPausiertBis: (data.lieferung_pausiert_bis as string | null) ?? null,
    abholungPauseGrund: (data.abholung_pause_grund as string | null) ?? null,
    lieferungPauseGrund: (data.lieferung_pause_grund as string | null) ?? null,
    benachrichtigungEmail: (data.benachrichtigung_email as string | null) ?? null,
  }
}

export async function bestellEinstellungenSpeichern(
  organisationId: string,
  einstellungen: Omit<BestellEinstellungen, 'abholungPausiertBis' | 'lieferungPausiertBis' | 'abholungPauseGrund' | 'lieferungPauseGrund'>
): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { error } = await supabase.from('bestell_einstellungen').upsert({
    organisation_id: organisationId,
    abholung_aktiv: einstellungen.abholungAktiv,
    lieferung_aktiv: einstellungen.lieferungAktiv,
    abholung_von: einstellungen.abholungVon,
    abholung_bis: einstellungen.abholungBis,
    lieferung_von: einstellungen.lieferungVon,
    lieferung_bis: einstellungen.lieferungBis,
    slot_minuten: einstellungen.slotMinuten,
    vorlauf_minuten_abholung: einstellungen.vorlaufMinutenAbholung,
    vorlauf_minuten_lieferung: einstellungen.vorlaufMinutenLieferung,
    max_offen_abholung: einstellungen.maxOffenAbholung,
    max_offen_lieferung: einstellungen.maxOffenLieferung,
    benachrichtigung_email: einstellungen.benachrichtigungEmail,
  })
  if (error) return { fehler: error.message }
  return {}
}

// Befristete Schnellpause (Schutzmechanismus "wie bei Lieferando") – pausiert
// den Kanal bis zu einem Zeitpunkt, ohne die übrigen Einstellungen
// anzufassen. Läuft die Frist ab, greift beim nächsten Laden automatisch
// wieder die reguläre Konfiguration (siehe `kanalAktiv` in regeln.ts),
// kein Cron-Job nötig.
export async function kanalPausieren(
  organisationId: string,
  kanal: BestellKanal,
  minuten: number,
  grund?: string
): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const pausiertBis = new Date(Date.now() + minuten * 60 * 1000).toISOString()
  const patch =
    kanal === 'abholung'
      ? { abholung_pausiert_bis: pausiertBis, abholung_pause_grund: grund?.trim() || null }
      : { lieferung_pausiert_bis: pausiertBis, lieferung_pause_grund: grund?.trim() || null }

  const { error } = await supabase.from('bestell_einstellungen').upsert({ organisation_id: organisationId, ...patch })
  if (error) return { fehler: error.message }
  return {}
}

export async function kanalPauseAufheben(organisationId: string, kanal: BestellKanal): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const patch =
    kanal === 'abholung'
      ? { abholung_pausiert_bis: null, abholung_pause_grund: null }
      : { lieferung_pausiert_bis: null, lieferung_pause_grund: null }

  const { error } = await supabase.from('bestell_einstellungen').upsert({ organisation_id: organisationId, ...patch })
  if (error) return { fehler: error.message }
  return {}
}

function bestellungAusZeile(b: Record<string, unknown>, positionen: BestellPosition[]): Bestellung {
  return {
    id: b.id as string,
    kanal: b.kanal as Bestellung['kanal'],
    name: b.name as string,
    telefon: b.telefon as string,
    email: (b.email as string | null) ?? null,
    adresse: (b.adresse as string | null) ?? null,
    datum: b.datum as string,
    uhrzeit: zeitKuerzen(b.uhrzeit as string)!,
    status: b.status as BestellStatus,
    notiz: (b.notiz as string | null) ?? null,
    gesamtPreis: Number(b.gesamt_preis),
    erstelltAt: b.erstellt_at as string,
    gesehen: b.gesehen as boolean,
    positionen,
  }
}

function positionAusZeile(p: Record<string, unknown>): BestellPosition {
  return {
    id: p.id as string,
    name: p.name as string,
    preis: Number(p.preis),
    menge: p.menge as number,
    notiz: (p.notiz as string | null) ?? null,
  }
}

const BESTELLUNG_SPALTEN = 'id, kanal, name, telefon, email, adresse, datum, uhrzeit, status, notiz, gesamt_preis, erstellt_at, gesehen'

export async function ladeBestellungenFuerTag(organisationId: string, datum: string): Promise<Bestellung[]> {
  const supabase = getServiceClient()
  const { data: bestellungen } = await supabase
    .from('bestellungen')
    .select(BESTELLUNG_SPALTEN)
    .eq('organisation_id', organisationId)
    .eq('datum', datum)
    .order('uhrzeit')

  return anreichernMitPositionen(supabase, bestellungen ?? [])
}

export async function ladeBestellung(id: string): Promise<Bestellung | null> {
  const supabase = getServiceClient()
  const { data } = await supabase.from('bestellungen').select(BESTELLUNG_SPALTEN).eq('id', id).maybeSingle()
  if (!data) return null
  const [bestellung] = await anreichernMitPositionen(supabase, [data])
  return bestellung ?? null
}

// Markiert alle noch ungesehenen Bestellungen als gesehen – aufgerufen,
// sobald die Leitung die Tagesliste lädt oder den Status einer Bestellung
// ändert ("geöffnet/bearbeitet"). Der "Neu"-Marker im UI beruht auf dem
// Stand, der dem Client VOR diesem Aufruf zurückgegeben wurde.
export async function bestellungenGesehenMarkieren(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const supabase = getServiceClient()
  await supabase.from('bestellungen').update({ gesehen: true }).in('id', ids)
}

export async function neueBestellungenAnzahl(organisationId: string): Promise<number> {
  const supabase = getServiceClient()
  const { count } = await supabase
    .from('bestellungen')
    .select('id', { count: 'exact', head: true })
    .eq('organisation_id', organisationId)
    .eq('gesehen', false)
  return count ?? 0
}

// Für die Kapazitätsprüfung reicht ein schlanker Datensatz (kanal/status)
// über mehrere Tage – z. B. um zu prüfen, wie viele Bestellungen aktuell
// offen sind, ohne jedes Mal die vollen Positionen mitzuladen.
export async function ladeBestellungenSchlankFuerTag(
  organisationId: string,
  datum: string
): Promise<Pick<Bestellung, 'kanal' | 'status'>[]> {
  const supabase = getServiceClient()
  const { data } = await supabase.from('bestellungen').select('kanal, status').eq('organisation_id', organisationId).eq('datum', datum)

  return (data ?? []).map((b) => ({ kanal: b.kanal as Bestellung['kanal'], status: b.status as BestellStatus }))
}

// Für die Auswertung (lib/bestellung/auswertung.ts) – ein ganzer Zeitraum,
// nur die Felder, die für die Aggregation gebraucht werden (keine Positionen).
export async function ladeBestellungenSchlankFuerZeitraum(
  organisationId: string,
  von: string,
  bis: string
): Promise<Pick<Bestellung, 'kanal' | 'status' | 'datum' | 'uhrzeit' | 'gesamtPreis'>[]> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('bestellungen')
    .select('kanal, status, datum, uhrzeit, gesamt_preis')
    .eq('organisation_id', organisationId)
    .gte('datum', von)
    .lte('datum', bis)

  return (data ?? []).map((b) => ({
    kanal: b.kanal as Bestellung['kanal'],
    status: b.status as BestellStatus,
    datum: b.datum as string,
    uhrzeit: zeitKuerzen(b.uhrzeit as string)!,
    gesamtPreis: Number(b.gesamt_preis),
  }))
}

async function anreichernMitPositionen(
  supabase: ReturnType<typeof getServiceClient>,
  zeilen: Record<string, unknown>[]
): Promise<Bestellung[]> {
  if (zeilen.length === 0) return []

  const ids = zeilen.map((z) => z.id as string)
  const { data: positionen } = await supabase
    .from('bestellpositionen')
    .select('id, bestellung_id, name, preis, menge, notiz')
    .in('bestellung_id', ids)

  const positionenNachBestellung = new Map<string, BestellPosition[]>()
  for (const p of positionen ?? []) {
    const liste = positionenNachBestellung.get(p.bestellung_id as string) ?? []
    liste.push(positionAusZeile(p))
    positionenNachBestellung.set(p.bestellung_id as string, liste)
  }

  return zeilen.map((z) => bestellungAusZeile(z, positionenNachBestellung.get(z.id as string) ?? []))
}

// Atomare Prüfung der "maximal gleichzeitig offenen Bestellungen"-Grenze
// direkt vor dem Insert
// (Postgres-Funktion, siehe 0019_kapazitaets_rpc.sql) – schließt die Lücke
// zwischen der Prüfung in pruefeBestellung() und dem tatsächlichen Anlegen.
// Legt Bestellung + Positionen in einer einzigen DB-Transaktion an, daher
// kein nachträgliches "bei Fehler wieder löschen" mehr nötig.
export async function bestellungErstellenMitPruefung(
  organisationId: string,
  input: {
    kanal: BestellKanal
    name: string
    telefon: string
    email?: string | null
    adresse?: string | null
    datum: string
    uhrzeit: string
    notiz?: string | null
    maxOffen: number | null
    positionen: { name: string; preis: number; menge: number; notiz?: string | null }[]
  }
): Promise<{ fehler?: string; bestellung?: Bestellung }> {
  const supabase = getServiceClient()
  const gesamtPreis = input.positionen.reduce((summe, p) => summe + p.preis * p.menge, 0)

  const { data, error } = await supabase.rpc('bestellung_mit_pruefung_erstellen', {
    p_organisation_id: organisationId,
    p_kanal: input.kanal,
    p_name: input.name,
    p_telefon: input.telefon,
    p_email: input.email ?? null,
    p_adresse: input.adresse ?? null,
    p_datum: input.datum,
    p_uhrzeit: input.uhrzeit,
    p_notiz: input.notiz ?? null,
    p_gesamt_preis: gesamtPreis,
    p_max_offen: input.maxOffen,
    p_positionen: input.positionen,
  })

  if (error) {
    if (error.message.includes('KAPAZITAET_OFFEN')) return { fehler: 'Gerade sehr viel los – bitte versucht es in Kürze noch einmal.' }
    console.error('bestellungErstellenMitPruefung fehlgeschlagen:', error.message)
    return { fehler: 'Bestellung konnte nicht gespeichert werden. Bitte versucht es erneut.' }
  }
  if (!data) return { fehler: 'Bestellung konnte nicht gespeichert werden. Bitte versucht es erneut.' }

  // Die Positionen kommen nicht aus der RPC-Antwort zurück (nur die
  // Bestellung selbst) – unmittelbar danach laden, dieselbe Transaktion ist
  // zu diesem Zeitpunkt längst committed.
  const bestellung = await ladeBestellung((data as Record<string, unknown>).id as string)
  if (!bestellung) return { fehler: 'Bestellung konnte nicht gespeichert werden. Bitte versucht es erneut.' }
  return { bestellung }
}

export async function bestellungStatusAendern(id: string, organisationId: string, status: BestellStatus): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('bestellungen')
    .update({ status })
    .eq('id', id)
    .eq('organisation_id', organisationId)
    .select('id')
  if (error) return { fehler: error.message }
  if (!data || data.length === 0) return { fehler: 'Bestellung nicht gefunden' }
  return {}
}

// Fürs Bewertungsliste-Dashboard (lib/bewertung/daten.ts) – nur die paar
// Felder, die dort angezeigt werden, nicht die volle Bestellung.
export async function ladeAbgeschlosseneBestellungenFuerBewertung(
  organisationId: string,
  limit = 50
): Promise<{ id: string; name: string; email: string | null; datum: string; uhrzeit: string; bewertungResendId: string | null }[]> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('bestellungen')
    .select('id, name, email, datum, uhrzeit, bewertung_resend_id')
    .eq('organisation_id', organisationId)
    .eq('status', 'abgeschlossen')
    .order('datum', { ascending: false })
    .order('uhrzeit', { ascending: false })
    .limit(limit)

  return (data ?? []).map((b) => ({
    id: b.id as string,
    name: b.name as string,
    email: (b.email as string | null) ?? null,
    datum: b.datum as string,
    uhrzeit: zeitKuerzen(b.uhrzeit as string) ?? '',
    bewertungResendId: (b.bewertung_resend_id as string | null) ?? null,
  }))
}

// Die Resend-ID der geplanten Bewertungsmail wird direkt auf der
// Bestellung gespeichert, analog zu reservierungen.bewertung_resend_id
// (siehe 0015_bewertung_bestellung.sql).
export async function bestellungBewertungResendId(bestellungId: string): Promise<string | null> {
  const supabase = getServiceClient()
  const { data } = await supabase.from('bestellungen').select('bewertung_resend_id').eq('id', bestellungId).maybeSingle()
  return (data?.bewertung_resend_id as string | null) ?? null
}

export async function bestellungBewertungResendIdSetzen(bestellungId: string, resendId: string | null): Promise<void> {
  const supabase = getServiceClient()
  await supabase.from('bestellungen').update({ bewertung_resend_id: resendId }).eq('id', bestellungId)
}

// Platzhalter-Wert fürs Beanspruchen (gleiches Prinzip wie
// reservierungBewertungAnfrageBeanspruchen in lib/bewertung/daten.ts):
// unterscheidet "Mail wird gerade geplant" von null (noch nichts geplant)
// und einer echten Resend-ID (bereits fertig geplant). Exportiert, damit das
// Stornieren (lib/bewertung/aktionen.ts) diesen Platzhalter nicht
// versehentlich als echte Resend-ID an die Resend-API schickt.
export const BEWERTUNG_WIRD_GEPLANT = '__wird_geplant__'

// Bedingtes Update (claim, nur solange noch nichts geplant ist) – verhindert,
// dass zwei fast gleichzeitige Statusänderungen auf "abgeschlossen" zweimal
// dieselbe Bewertungsmail auslösen.
export async function bestellungBewertungAnfrageBeanspruchen(bestellungId: string): Promise<boolean> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('bestellungen')
    .update({ bewertung_resend_id: BEWERTUNG_WIRD_GEPLANT })
    .eq('id', bestellungId)
    .is('bewertung_resend_id', null)
    .select('id')
  return !!data && data.length > 0
}
