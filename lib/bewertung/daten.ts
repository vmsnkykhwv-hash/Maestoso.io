import { getServiceClient } from '@/lib/supabase/server'
import { ladeErschieneneReservierungenFuerBewertung } from '@/lib/tischplan/daten'
import { ladeAbgeschlosseneBestellungenFuerBewertung } from '@/lib/bestellung/daten'
import type { BewertungsEinstellungen, BewertungsListenEintrag } from './types'
import type { BewertungsanfrageZeile, GoogleSnapshot } from './auswertung'

const STANDARD_EINSTELLUNGEN: BewertungsEinstellungen = {
  aktiv: false,
  googleUrl: null,
  verzoegerungMinuten: 180,
}

export async function ladeBewertungsEinstellungen(organisationId: string): Promise<BewertungsEinstellungen> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('bewertungsanfrage_einstellungen')
    .select('*')
    .eq('organisation_id', organisationId)
    .maybeSingle()

  if (!data) return STANDARD_EINSTELLUNGEN

  return {
    aktiv: data.aktiv as boolean,
    googleUrl: (data.google_url as string | null) ?? null,
    verzoegerungMinuten: data.verzoegerung_minuten as number,
  }
}

export async function bewertungsEinstellungenSpeichern(
  organisationId: string,
  einstellungen: BewertungsEinstellungen
): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { error } = await supabase.from('bewertungsanfrage_einstellungen').upsert({
    organisation_id: organisationId,
    aktiv: einstellungen.aktiv,
    google_url: einstellungen.googleUrl,
    verzoegerung_minuten: einstellungen.verzoegerungMinuten,
  })
  if (error) return { fehler: error.message }
  return {}
}

// Die Resend-ID der geplanten Bewertungsmail wird direkt auf der
// Reservierung gespeichert (eigene Spalte, siehe 0009_bewertung.sql) – so
// lässt sich eine bereits geplante Mail stornieren, falls der Status später
// wieder von "erschienen" wegwechselt, ohne eine eigene Zuordnungstabelle
// zu brauchen.
export async function reservierungBewertungResendId(reservierungId: string): Promise<string | null> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('reservierungen')
    .select('bewertung_resend_id')
    .eq('id', reservierungId)
    .maybeSingle()
  return (data?.bewertung_resend_id as string | null) ?? null
}

export async function reservierungBewertungResendIdSetzen(reservierungId: string, resendId: string | null): Promise<void> {
  const supabase = getServiceClient()
  await supabase.from('reservierungen').update({ bewertung_resend_id: resendId }).eq('id', reservierungId)
}

// Platzhalter-Wert fürs Beanspruchen (siehe unten): "Mail wird gerade
// geplant" – unterscheidet sich von null (noch nichts geplant) und einer
// echten Resend-ID (bereits fertig geplant). Exportiert, damit das Stornieren
// (lib/bewertung/aktionen.ts) diesen Platzhalter nicht versehentlich als
// echte Resend-ID an die Resend-API schickt.
export const BEWERTUNG_WIRD_GEPLANT = '__wird_geplant__'

// Bedingtes Update (claim, nur solange noch nichts geplant ist) statt
// Lesen-dann-Schreiben – verhindert, dass zwei fast gleichzeitige
// Statusänderungen (z. B. ein Doppelklick auf "Als erschienen markieren")
// zweimal dieselbe Bewertungsmail auslösen.
export async function reservierungBewertungAnfrageBeanspruchen(reservierungId: string): Promise<boolean> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('reservierungen')
    .update({ bewertung_resend_id: BEWERTUNG_WIRD_GEPLANT })
    .eq('id', reservierungId)
    .is('bewertung_resend_id', null)
    .select('id')
  return !!data && data.length > 0
}

// Konsolidierte Übersicht fürs Bewertungsanfrage-Dashboard: erschienene
// Reservierungen + abgeschlossene Bestellungen in einer Liste, sortiert
// nach Datum/Uhrzeit – damit man nicht erst ins Tischplan- oder
// Bestellung-Modul wechseln muss, um zu sehen, wofür schon eine
// Bewertungsanfrage läuft.
export async function ladeBewertungsUebersicht(organisationId: string): Promise<BewertungsListenEintrag[]> {
  const [reservierungen, bestellungen] = await Promise.all([
    ladeErschieneneReservierungenFuerBewertung(organisationId),
    ladeAbgeschlosseneBestellungenFuerBewertung(organisationId),
  ])

  const eintraege: BewertungsListenEintrag[] = [
    ...reservierungen.map((r) => ({
      id: r.id,
      quelle: 'reservierung' as const,
      name: r.name,
      email: r.email,
      datum: r.datum,
      uhrzeit: r.uhrzeit,
      geplant: !!r.bewertungResendId,
    })),
    ...bestellungen.map((b) => ({
      id: b.id,
      quelle: 'bestellung' as const,
      name: b.name,
      email: b.email,
      datum: b.datum,
      uhrzeit: b.uhrzeit,
      geplant: !!b.bewertungResendId,
    })),
  ]

  return eintraege.sort((a, b) => (a.datum + a.uhrzeit < b.datum + b.uhrzeit ? 1 : -1))
}

// Dauerhaftes Protokoll für die Klickrate (lib/bewertung/auswertung.ts) –
// unabhängig von reservierungen.bewertung_resend_id / bestellungen.bewertung_resend_id,
// die beim Stornieren wieder auf null gesetzt werden (siehe aktionen.ts) und
// sich deshalb nicht für eine dauerhafte Auswertung eignen.
export async function bewertungsanfrageProtokollieren(
  organisationId: string,
  resendId: string,
  quelle: 'reservierung' | 'bestellung',
  quelleId: string
): Promise<void> {
  const supabase = getServiceClient()
  await supabase.from('bewertungsanfragen').insert({
    organisation_id: organisationId,
    resend_id: resendId,
    quelle,
    quelle_id: quelleId,
  })
}

export async function bewertungsanfrageStorniertMarkieren(resendId: string): Promise<void> {
  const supabase = getServiceClient()
  await supabase.from('bewertungsanfragen').update({ storniert: true }).eq('resend_id', resendId)
}

// Für den Resend-Webhook (app/api/resend/webhook/route.ts) – setzt den
// Zeitpunkt nur beim ersten Mal (nicht überschreiben, falls Resend ein
// Event mehrfach zustellt oder ein Gast mehrfach klickt).
export async function bewertungsanfrageEventSetzen(resendId: string, feld: 'geoeffnet_am' | 'geklickt_am'): Promise<void> {
  const supabase = getServiceClient()
  await supabase
    .from('bewertungsanfragen')
    .update({ [feld]: new Date().toISOString() })
    .eq('resend_id', resendId)
    .is(feld, null)
}

export async function ladeBewertungsanfragenFuerZeitraum(organisationId: string, von: string, bis: string): Promise<BewertungsanfrageZeile[]> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('bewertungsanfragen')
    .select('storniert, geoeffnet_am, geklickt_am')
    .eq('organisation_id', organisationId)
    .gte('erstellt_at', `${von}T00:00:00.000Z`)
    .lte('erstellt_at', `${bis}T23:59:59.999Z`)

  return (data ?? []).map((z) => ({
    storniert: z.storniert as boolean,
    geoeffnetAm: (z.geoeffnet_am as string | null) ?? null,
    geklicktAm: (z.geklickt_am as string | null) ?? null,
  }))
}

export async function googleSnapshotSpeichern(organisationId: string, snapshot: GoogleSnapshot): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { error } = await supabase.from('google_bewertung_snapshots').upsert(
    {
      organisation_id: organisationId,
      datum: snapshot.datum,
      anzahl_bewertungen: snapshot.anzahlBewertungen,
      durchschnitt: snapshot.durchschnitt,
    },
    { onConflict: 'organisation_id,datum' }
  )
  if (error) return { fehler: error.message }
  return {}
}

export async function ladeGoogleSnapshots(organisationId: string, limit = 24): Promise<GoogleSnapshot[]> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('google_bewertung_snapshots')
    .select('datum, anzahl_bewertungen, durchschnitt')
    .eq('organisation_id', organisationId)
    .order('datum', { ascending: false })
    .limit(limit)

  return (data ?? []).map((z) => ({
    datum: z.datum as string,
    anzahlBewertungen: z.anzahl_bewertungen as number,
    durchschnitt: Number(z.durchschnitt),
  }))
}
