import { getServiceClient } from '@/lib/supabase/server'
import { ladeErschieneneReservierungenFuerBewertung } from '@/lib/tischplan/daten'
import { ladeAbgeschlosseneBestellungenFuerBewertung } from '@/lib/bestellung/daten'
import type { BewertungsEinstellungen, BewertungsListenEintrag } from './types'

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
