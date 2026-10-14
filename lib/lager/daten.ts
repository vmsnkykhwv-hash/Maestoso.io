import { getServiceClient } from '@/lib/supabase/server'
import type { Artikel, Bestandspruefung, BestandspruefungEintrag, BestandspruefungStatus, Lieferant, OffenerBestellEintrag } from './types'

function lieferantAusZeile(l: Record<string, unknown>): Lieferant {
  return {
    id: l.id as string,
    name: l.name as string,
    kontaktEmail: (l.kontakt_email as string | null) ?? null,
    kontaktTelefon: (l.kontakt_telefon as string | null) ?? null,
    ansprechpartner: (l.ansprechpartner as string | null) ?? null,
    kundennummer: (l.kundennummer as string | null) ?? null,
    notiz: (l.notiz as string | null) ?? null,
    zyklusTyp: l.zyklus_typ as Lieferant['zyklusTyp'],
    wochentage: (l.wochentage as number[] | null) ?? [],
    tagImMonat: (l.tag_im_monat as number | null) ?? null,
    vorlaufTage: l.vorlauf_tage as number,
    aktiv: l.aktiv as boolean,
  }
}

const LIEFERANT_SPALTEN =
  'id, name, kontakt_email, kontakt_telefon, ansprechpartner, kundennummer, notiz, zyklus_typ, wochentage, tag_im_monat, vorlauf_tage, aktiv'

export async function ladeLieferanten(organisationId: string): Promise<Lieferant[]> {
  const supabase = getServiceClient()
  const { data } = await supabase.from('lieferanten').select(LIEFERANT_SPALTEN).eq('organisation_id', organisationId).order('name')
  return (data ?? []).map(lieferantAusZeile)
}

export async function ladeAktiveLieferanten(organisationId: string): Promise<Lieferant[]> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('lieferanten')
    .select(LIEFERANT_SPALTEN)
    .eq('organisation_id', organisationId)
    .eq('aktiv', true)
    .order('name')
  return (data ?? []).map(lieferantAusZeile)
}

// Minimale Namensliste – für Ansichten, die den Lieferanten einer Prüfung
// zeigen müssen, aber keine Leitungsrechte für die volle Lieferantenliste
// haben (siehe ladeMitarbeiterNamen in lib/mitarbeiter/daten.ts, gleiches
// Muster).
export async function ladeLieferantenNamen(organisationId: string): Promise<{ id: string; name: string }[]> {
  const supabase = getServiceClient()
  const { data } = await supabase.from('lieferanten').select('id, name').eq('organisation_id', organisationId).order('name')
  return (data ?? []).map((l) => ({ id: l.id as string, name: l.name as string }))
}

export async function ladeLieferant(id: string, organisationId: string): Promise<Lieferant | null> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('lieferanten')
    .select(LIEFERANT_SPALTEN)
    .eq('id', id)
    .eq('organisation_id', organisationId)
    .maybeSingle()
  return data ? lieferantAusZeile(data) : null
}

export async function lieferantErstellen(
  organisationId: string,
  input: {
    name: string
    kontaktEmail?: string
    kontaktTelefon?: string
    ansprechpartner?: string
    kundennummer?: string
    notiz?: string
    zyklusTyp: Lieferant['zyklusTyp']
    wochentage: number[]
    tagImMonat: number | null
    vorlaufTage: number
  }
): Promise<{ fehler?: string; lieferant?: Lieferant }> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('lieferanten')
    .insert({
      organisation_id: organisationId,
      name: input.name.trim(),
      kontakt_email: input.kontaktEmail || null,
      kontakt_telefon: input.kontaktTelefon || null,
      ansprechpartner: input.ansprechpartner || null,
      kundennummer: input.kundennummer || null,
      notiz: input.notiz || null,
      zyklus_typ: input.zyklusTyp,
      wochentage: input.wochentage,
      tag_im_monat: input.tagImMonat,
      vorlauf_tage: input.vorlaufTage,
    })
    .select(LIEFERANT_SPALTEN)
    .single()

  if (error || !data) return { fehler: error?.message ?? 'Anlegen fehlgeschlagen' }
  return { lieferant: lieferantAusZeile(data) }
}

export async function lieferantAktualisieren(
  id: string,
  organisationId: string,
  patch: Partial<{
    name: string
    kontaktEmail: string | null
    kontaktTelefon: string | null
    ansprechpartner: string | null
    kundennummer: string | null
    notiz: string | null
    zyklusTyp: Lieferant['zyklusTyp']
    wochentage: number[]
    tagImMonat: number | null
    vorlaufTage: number
    aktiv: boolean
  }>
): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const updateZeile: Record<string, unknown> = {}
  if (patch.name !== undefined) updateZeile.name = patch.name.trim()
  if (patch.kontaktEmail !== undefined) updateZeile.kontakt_email = patch.kontaktEmail || null
  if (patch.kontaktTelefon !== undefined) updateZeile.kontakt_telefon = patch.kontaktTelefon || null
  if (patch.ansprechpartner !== undefined) updateZeile.ansprechpartner = patch.ansprechpartner || null
  if (patch.kundennummer !== undefined) updateZeile.kundennummer = patch.kundennummer || null
  if (patch.notiz !== undefined) updateZeile.notiz = patch.notiz || null
  if (patch.zyklusTyp !== undefined) updateZeile.zyklus_typ = patch.zyklusTyp
  if (patch.wochentage !== undefined) updateZeile.wochentage = patch.wochentage
  if (patch.tagImMonat !== undefined) updateZeile.tag_im_monat = patch.tagImMonat
  if (patch.vorlaufTage !== undefined) updateZeile.vorlauf_tage = patch.vorlaufTage
  if (patch.aktiv !== undefined) updateZeile.aktiv = patch.aktiv

  const { data, error } = await supabase
    .from('lieferanten')
    .update(updateZeile)
    .eq('id', id)
    .eq('organisation_id', organisationId)
    .select('id')
  if (error) return { fehler: error.message }
  if (!data || data.length === 0) return { fehler: 'Lieferant nicht gefunden' }
  return {}
}

export async function lieferantLoeschen(id: string, organisationId: string): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { data, error } = await supabase.from('lieferanten').delete().eq('id', id).eq('organisation_id', organisationId).select('id')
  if (error) return { fehler: error.message }
  if (!data || data.length === 0) return { fehler: 'Lieferant nicht gefunden' }
  return {}
}

function artikelAusZeile(a: Record<string, unknown>): Artikel {
  return {
    id: a.id as string,
    lieferantId: a.lieferant_id as string,
    name: a.name as string,
    einheit: a.einheit as string,
    mindestbestand: Number(a.mindestbestand),
    notiz: (a.notiz as string | null) ?? null,
    aktiv: a.aktiv as boolean,
  }
}

const ARTIKEL_SPALTEN = 'id, lieferant_id, name, einheit, mindestbestand, notiz, aktiv'

export async function ladeArtikel(organisationId: string): Promise<Artikel[]> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('artikel')
    .select(ARTIKEL_SPALTEN)
    .eq('organisation_id', organisationId)
    .order('sortierung')
  return (data ?? []).map(artikelAusZeile)
}

export async function ladeArtikelFuerLieferant(lieferantId: string): Promise<Artikel[]> {
  const supabase = getServiceClient()
  const { data } = await supabase.from('artikel').select(ARTIKEL_SPALTEN).eq('lieferant_id', lieferantId).order('sortierung')
  return (data ?? []).map(artikelAusZeile)
}

export async function artikelErstellen(
  organisationId: string,
  input: { lieferantId: string; name: string; einheit: string; mindestbestand: number; notiz?: string }
): Promise<{ fehler?: string; artikel?: Artikel }> {
  const supabase = getServiceClient()
  const { data: bestehende } = await supabase
    .from('artikel')
    .select('sortierung')
    .eq('lieferant_id', input.lieferantId)
    .order('sortierung', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from('artikel')
    .insert({
      organisation_id: organisationId,
      lieferant_id: input.lieferantId,
      name: input.name.trim(),
      einheit: input.einheit.trim() || 'Stück',
      mindestbestand: input.mindestbestand,
      notiz: input.notiz || null,
      sortierung: ((bestehende?.sortierung as number) ?? 0) + 1,
    })
    .select(ARTIKEL_SPALTEN)
    .single()

  if (error || !data) return { fehler: error?.message ?? 'Anlegen fehlgeschlagen' }
  return { artikel: artikelAusZeile(data) }
}

export async function artikelAktualisieren(
  id: string,
  organisationId: string,
  patch: Partial<{ name: string; einheit: string; mindestbestand: number; notiz: string | null; aktiv: boolean }>
): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const updateZeile: Record<string, unknown> = {}
  if (patch.name !== undefined) updateZeile.name = patch.name.trim()
  if (patch.einheit !== undefined) updateZeile.einheit = patch.einheit.trim() || 'Stück'
  if (patch.mindestbestand !== undefined) updateZeile.mindestbestand = patch.mindestbestand
  if (patch.notiz !== undefined) updateZeile.notiz = patch.notiz || null
  if (patch.aktiv !== undefined) updateZeile.aktiv = patch.aktiv

  const { data, error } = await supabase
    .from('artikel')
    .update(updateZeile)
    .eq('id', id)
    .eq('organisation_id', organisationId)
    .select('id')
  if (error) return { fehler: error.message }
  if (!data || data.length === 0) return { fehler: 'Artikel nicht gefunden' }
  return {}
}

export async function artikelLoeschen(id: string, organisationId: string): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { data, error } = await supabase.from('artikel').delete().eq('id', id).eq('organisation_id', organisationId).select('id')
  if (error) return { fehler: error.message }
  if (!data || data.length === 0) return { fehler: 'Artikel nicht gefunden' }
  return {}
}

function pruefungAusZeile(p: Record<string, unknown>): Bestandspruefung {
  return {
    id: p.id as string,
    lieferantId: p.lieferant_id as string,
    bestelldatum: p.bestelldatum as string,
    zugewiesenerMitarbeiterId: (p.zugewiesener_mitarbeiter_id as string | null) ?? null,
    status: p.status as BestandspruefungStatus,
    erledigtAt: (p.erledigt_at as string | null) ?? null,
  }
}

const PRUEFUNG_SPALTEN = 'id, lieferant_id, bestelldatum, zugewiesener_mitarbeiter_id, status, erledigt_at'

export async function ladeAllePruefungen(organisationId: string): Promise<Bestandspruefung[]> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('bestandspruefungen')
    .select(PRUEFUNG_SPALTEN)
    .eq('organisation_id', organisationId)
    .order('bestelldatum', { ascending: false })
  return (data ?? []).map(pruefungAusZeile)
}

export async function ladeOffenePruefungenFuerMitarbeiter(mitarbeiterId: string): Promise<Bestandspruefung[]> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('bestandspruefungen')
    .select(PRUEFUNG_SPALTEN)
    .eq('zugewiesener_mitarbeiter_id', mitarbeiterId)
    .eq('status', 'offen')
    .order('bestelldatum')
  return (data ?? []).map(pruefungAusZeile)
}

export async function ladePruefung(id: string, organisationId: string): Promise<Bestandspruefung | null> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('bestandspruefungen')
    .select(PRUEFUNG_SPALTEN)
    .eq('id', id)
    .eq('organisation_id', organisationId)
    .maybeSingle()
  return data ? pruefungAusZeile(data) : null
}

// Idempotent: existiert für (lieferant, bestelldatum) schon eine Prüfung,
// wird die Kollision (unique-Constraint) stillschweigend als Erfolg
// behandelt statt als Fehler – so kann dieselbe "Prüfung fällig"-Erkennung
// gefahrlos mehrfach laufen (z. B. wenn zwei Mitarbeiter das Modul
// gleichzeitig öffnen).
export async function pruefungErstellen(
  organisationId: string,
  lieferantId: string,
  bestelldatum: string,
  zugewiesenerMitarbeiterId: string | null
): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { error } = await supabase.from('bestandspruefungen').insert({
    organisation_id: organisationId,
    lieferant_id: lieferantId,
    bestelldatum,
    zugewiesener_mitarbeiter_id: zugewiesenerMitarbeiterId,
  })
  if (error && error.code !== '23505') return { fehler: error.message }
  return {}
}

export async function pruefungMitarbeiterZuweisen(
  id: string,
  organisationId: string,
  mitarbeiterId: string | null
): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('bestandspruefungen')
    .update({ zugewiesener_mitarbeiter_id: mitarbeiterId })
    .eq('id', id)
    .eq('organisation_id', organisationId)
    .select('id')
  if (error) return { fehler: error.message }
  if (!data || data.length === 0) return { fehler: 'Prüfung nicht gefunden' }
  return {}
}

export async function pruefungAlsErledigtMarkieren(id: string, organisationId: string): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('bestandspruefungen')
    .update({ status: 'erledigt', erledigt_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organisation_id', organisationId)
    .select('id')
  if (error) return { fehler: error.message }
  if (!data || data.length === 0) return { fehler: 'Prüfung nicht gefunden' }
  return {}
}

function eintragAusZeile(e: Record<string, unknown>): BestandspruefungEintrag {
  return {
    id: e.id as string,
    artikelId: e.artikel_id as string,
    nachbestellen: e.nachbestellen as boolean,
    aktuellerBestand: (e.aktueller_bestand as string | null) ?? null,
    bestellt: e.bestellt as boolean,
    bestellmenge: (e.bestellmenge as string | null) ?? null,
  }
}

const EINTRAG_SPALTEN = 'id, artikel_id, nachbestellen, aktueller_bestand, bestellt, bestellmenge'

export async function ladePruefungEintraege(pruefungId: string): Promise<BestandspruefungEintrag[]> {
  const supabase = getServiceClient()
  const { data } = await supabase.from('bestandspruefung_eintraege').select(EINTRAG_SPALTEN).eq('bestandspruefung_id', pruefungId)
  return (data ?? []).map(eintragAusZeile)
}

export async function eintragSetzen(
  pruefungId: string,
  artikelId: string,
  nachbestellen: boolean,
  aktuellerBestand: string | null
): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { error } = await supabase
    .from('bestandspruefung_eintraege')
    .upsert(
      { bestandspruefung_id: pruefungId, artikel_id: artikelId, nachbestellen, aktueller_bestand: aktuellerBestand },
      { onConflict: 'bestandspruefung_id,artikel_id' }
    )
  if (error) return { fehler: error.message }
  return {}
}

// Alle "nachbestellen"-Einträge aus abgeschlossenen Prüfungen, die noch
// nicht bestellt sind – Grundlage für den Bestellung-Tab (gruppiert nach
// Lieferant). Keine eigene Tabelle/kein FK-Embedding nötig: wie überall in
// diesem Modul per einfacher Folge-Abfrage + In-Memory-Zuordnung verknüpft.
export async function ladeOffeneBestellEintraege(organisationId: string): Promise<OffenerBestellEintrag[]> {
  const supabase = getServiceClient()

  const { data: pruefungen } = await supabase
    .from('bestandspruefungen')
    .select('id, lieferant_id')
    .eq('organisation_id', organisationId)
    .eq('status', 'erledigt')

  const pruefungIds = (pruefungen ?? []).map((p) => p.id as string)
  if (pruefungIds.length === 0) return []

  const lieferantIdNachPruefung = new Map((pruefungen ?? []).map((p) => [p.id as string, p.lieferant_id as string]))

  const { data: eintraege } = await supabase
    .from('bestandspruefung_eintraege')
    .select(`bestandspruefung_id, ${EINTRAG_SPALTEN}`)
    .in('bestandspruefung_id', pruefungIds)
    .eq('nachbestellen', true)
    .eq('bestellt', false)

  if (!eintraege || eintraege.length === 0) return []

  const artikelIds = Array.from(new Set(eintraege.map((e) => e.artikel_id as string)))
  const { data: artikelListe } = await supabase.from('artikel').select('id, name, einheit').in('id', artikelIds)
  const artikelNachId = new Map((artikelListe ?? []).map((a) => [a.id as string, a]))

  return eintraege.map((e) => {
    const artikel = artikelNachId.get(e.artikel_id as string)
    return {
      ...eintragAusZeile(e),
      pruefungId: e.bestandspruefung_id as string,
      lieferantId: lieferantIdNachPruefung.get(e.bestandspruefung_id as string) ?? '',
      artikelName: (artikel?.name as string | undefined) ?? 'Unbekannt',
      einheit: (artikel?.einheit as string | undefined) ?? '',
    }
  })
}

export async function eintragBestellungSetzen(
  pruefungId: string,
  artikelId: string,
  bestellmenge: string | null
): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { error } = await supabase
    .from('bestandspruefung_eintraege')
    .update({ bestellmenge })
    .eq('bestandspruefung_id', pruefungId)
    .eq('artikel_id', artikelId)
  if (error) return { fehler: error.message }
  return {}
}

// Für die Bestell-Mail: Artikelname/-einheit frisch aus der Datenbank statt
// vom Client übernommen, damit die Mail garantiert den zuletzt gespeicherten
// Stand zeigt. organisationId grenzt auf die eigenen Prüfungen ein – sonst
// könnte eine Leitung per direktem Aufruf Einträge einer fremden Organisation
// mitbestellen oder als bestellt markieren.
export async function ladeBestellEintraegeNachIds(
  organisationId: string,
  ids: string[]
): Promise<{ id: string; artikelName: string; einheit: string; bestellmenge: string | null }[]> {
  if (ids.length === 0) return []
  const supabase = getServiceClient()

  const { data: pruefungen } = await supabase.from('bestandspruefungen').select('id').eq('organisation_id', organisationId)
  const pruefungIds = (pruefungen ?? []).map((p) => p.id as string)
  if (pruefungIds.length === 0) return []

  const { data: eintraege } = await supabase
    .from('bestandspruefung_eintraege')
    .select('id, artikel_id, bestellmenge')
    .in('id', ids)
    .in('bestandspruefung_id', pruefungIds)
  if (!eintraege) return []

  const artikelIds = Array.from(new Set(eintraege.map((e) => e.artikel_id as string)))
  const { data: artikelListe } = await supabase.from('artikel').select('id, name, einheit').in('id', artikelIds)
  const artikelNachId = new Map((artikelListe ?? []).map((a) => [a.id as string, a]))

  return eintraege.map((e) => {
    const artikel = artikelNachId.get(e.artikel_id as string)
    return {
      id: e.id as string,
      artikelName: (artikel?.name as string | undefined) ?? 'Unbekannt',
      einheit: (artikel?.einheit as string | undefined) ?? '',
      bestellmenge: (e.bestellmenge as string | null) ?? null,
    }
  })
}

// Bedingtes Update (claim, nur von bestellt=false) statt eines blinden
// Markierens – verhindert, dass ein Doppelklick oder zwei Leitungen
// gleichzeitig dieselbe Bestellung zweimal an den Lieferanten verschicken.
// Gibt zurück, welche IDs dieser Aufruf tatsächlich beansprucht hat.
export async function eintraegeAlsBestelltMarkierenFuerOrganisation(organisationId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return []
  const supabase = getServiceClient()

  const { data: pruefungen } = await supabase.from('bestandspruefungen').select('id').eq('organisation_id', organisationId)
  const pruefungIds = (pruefungen ?? []).map((p) => p.id as string)
  if (pruefungIds.length === 0) return []

  const { data } = await supabase
    .from('bestandspruefung_eintraege')
    .update({ bestellt: true })
    .in('id', ids)
    .in('bestandspruefung_id', pruefungIds)
    .eq('bestellt', false)
    .select('id')

  return (data ?? []).map((e) => e.id as string)
}
