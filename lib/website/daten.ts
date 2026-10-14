import { getServiceClient } from '@/lib/supabase/server'
import type { BildRolle, MenuEintrag, MenuKategorie, WebsiteBild, WebsiteInhalt } from './types'

const STORAGE_BUCKET = 'website-bilder'

const LEERER_INHALT: WebsiteInhalt = {
  heroTitel: '',
  heroUntertitel: '',
  ueberUns: '',
  tagesmenuText: '',
  tagesmenuAktiv: false,
  kontaktTelefon: '',
  kontaktEmail: '',
  kontaktAdresse: '',
  instagramUrl: null,
}

export async function ladeInhalt(organisationId: string): Promise<WebsiteInhalt> {
  const supabase = getServiceClient()
  const { data } = await supabase.from('website_inhalt').select('*').eq('organisation_id', organisationId).maybeSingle()

  if (!data) return LEERER_INHALT

  return {
    heroTitel: data.hero_titel as string,
    heroUntertitel: data.hero_untertitel as string,
    ueberUns: data.ueber_uns as string,
    tagesmenuText: data.tagesmenu_text as string,
    tagesmenuAktiv: data.tagesmenu_aktiv as boolean,
    kontaktTelefon: data.kontakt_telefon as string,
    kontaktEmail: data.kontakt_email as string,
    kontaktAdresse: data.kontakt_adresse as string,
    instagramUrl: (data.instagram_url as string | null) ?? null,
  }
}

export async function inhaltSpeichern(organisationId: string, inhalt: WebsiteInhalt): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { error } = await supabase.from('website_inhalt').upsert({
    organisation_id: organisationId,
    hero_titel: inhalt.heroTitel,
    hero_untertitel: inhalt.heroUntertitel,
    ueber_uns: inhalt.ueberUns,
    tagesmenu_text: inhalt.tagesmenuText,
    tagesmenu_aktiv: inhalt.tagesmenuAktiv,
    kontakt_telefon: inhalt.kontaktTelefon,
    kontakt_email: inhalt.kontaktEmail,
    kontakt_adresse: inhalt.kontaktAdresse,
    instagram_url: inhalt.instagramUrl,
    aktualisiert_at: new Date().toISOString(),
  })
  if (error) return { fehler: error.message }
  return {}
}

function bildAusZeile(supabase: ReturnType<typeof getServiceClient>, b: Record<string, unknown>): WebsiteBild {
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(b.storage_pfad as string)
  return {
    id: b.id as string,
    rolle: b.rolle as WebsiteBild['rolle'],
    url: data.publicUrl,
    sortierung: b.sortierung as number,
  }
}

export async function ladeBilder(organisationId: string, rolle?: BildRolle): Promise<WebsiteBild[]> {
  const supabase = getServiceClient()
  let query = supabase.from('website_bilder').select('id, rolle, storage_pfad, sortierung').eq('organisation_id', organisationId)
  if (rolle) query = query.eq('rolle', rolle)
  const { data } = await query.order('sortierung')

  return (data ?? []).map((b) => bildAusZeile(supabase, b))
}

export async function bildHochladen(
  organisationId: string,
  rolle: BildRolle,
  datei: File
): Promise<{ fehler?: string; bild?: WebsiteBild }> {
  const supabase = getServiceClient()
  const endung = datei.name.split('.').pop() ?? 'jpg'
  const pfad = `${organisationId}/${rolle}/${crypto.randomUUID()}.${endung}`

  const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(pfad, datei, {
    contentType: datei.type || undefined,
    upsert: false,
  })
  if (uploadError) return { fehler: uploadError.message }

  // Beim Hero-Bild gibt es immer nur eins – alte Hero-Bilder (Datenbank-
  // Zeile + Datei im Storage) vor dem Einfügen des neuen entfernen.
  if (rolle === 'hero') {
    const bestehende = await ladeBilder(organisationId, 'hero')
    for (const altesBild of bestehende) {
      await bildLoeschen(altesBild.id)
    }
  }

  const { data: bestehende } = await supabase
    .from('website_bilder')
    .select('sortierung')
    .eq('organisation_id', organisationId)
    .eq('rolle', rolle)
    .order('sortierung', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from('website_bilder')
    .insert({
      organisation_id: organisationId,
      rolle,
      storage_pfad: pfad,
      sortierung: ((bestehende?.sortierung as number) ?? 0) + 1,
    })
    .select('id, rolle, storage_pfad, sortierung')
    .single()

  if (error || !data) {
    await supabase.storage.from(STORAGE_BUCKET).remove([pfad])
    return { fehler: error?.message ?? 'Hochladen fehlgeschlagen' }
  }

  return { bild: bildAusZeile(supabase, data) }
}

export async function bildLoeschen(id: string): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { data } = await supabase.from('website_bilder').select('storage_pfad').eq('id', id).maybeSingle()
  if (data) await supabase.storage.from(STORAGE_BUCKET).remove([data.storage_pfad as string])

  const { error } = await supabase.from('website_bilder').delete().eq('id', id)
  if (error) return { fehler: error.message }
  return {}
}

function kategorieAusZeile(k: Record<string, unknown>): MenuKategorie {
  return { id: k.id as string, name: k.name as string, sortierung: k.sortierung as number }
}

export async function ladeMenuKategorien(organisationId: string): Promise<MenuKategorie[]> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('website_menu_kategorien')
    .select('id, name, sortierung')
    .eq('organisation_id', organisationId)
    .order('sortierung')

  return (data ?? []).map(kategorieAusZeile)
}

export async function kategorieErstellen(organisationId: string, name: string): Promise<{ fehler?: string; kategorie?: MenuKategorie }> {
  const supabase = getServiceClient()
  const { data: bestehende } = await supabase
    .from('website_menu_kategorien')
    .select('sortierung')
    .eq('organisation_id', organisationId)
    .order('sortierung', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from('website_menu_kategorien')
    .insert({ organisation_id: organisationId, name: name.trim(), sortierung: ((bestehende?.sortierung as number) ?? 0) + 1 })
    .select('id, name, sortierung')
    .single()

  if (error || !data) return { fehler: error?.message ?? 'Anlegen fehlgeschlagen' }
  return { kategorie: kategorieAusZeile(data) }
}

export async function kategorieAktualisieren(id: string, name: string): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { error } = await supabase.from('website_menu_kategorien').update({ name: name.trim() }).eq('id', id)
  if (error) return { fehler: error.message }
  return {}
}

export async function kategorieLoeschen(id: string): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { error } = await supabase.from('website_menu_kategorien').delete().eq('id', id)
  if (error) return { fehler: error.message }
  return {}
}

function eintragAusZeile(e: Record<string, unknown>): MenuEintrag {
  return {
    id: e.id as string,
    kategorieId: e.kategorie_id as string,
    name: e.name as string,
    beschreibung: (e.beschreibung as string | null) ?? null,
    preis: Number(e.preis),
    aktiv: e.aktiv as boolean,
    sortierung: e.sortierung as number,
  }
}

export async function ladeMenuEintraege(organisationId: string): Promise<MenuEintrag[]> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('website_menu_eintraege')
    .select('id, kategorie_id, name, beschreibung, preis, aktiv, sortierung')
    .eq('organisation_id', organisationId)
    .order('sortierung')

  return (data ?? []).map(eintragAusZeile)
}

export async function eintragErstellen(
  organisationId: string,
  input: { kategorieId: string; name: string; beschreibung?: string | null; preis: number }
): Promise<{ fehler?: string; eintrag?: MenuEintrag }> {
  const supabase = getServiceClient()
  const { data: bestehende } = await supabase
    .from('website_menu_eintraege')
    .select('sortierung')
    .eq('kategorie_id', input.kategorieId)
    .order('sortierung', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from('website_menu_eintraege')
    .insert({
      organisation_id: organisationId,
      kategorie_id: input.kategorieId,
      name: input.name.trim(),
      beschreibung: input.beschreibung ?? null,
      preis: input.preis,
      sortierung: ((bestehende?.sortierung as number) ?? 0) + 1,
    })
    .select('id, kategorie_id, name, beschreibung, preis, aktiv, sortierung')
    .single()

  if (error || !data) return { fehler: error?.message ?? 'Anlegen fehlgeschlagen' }
  return { eintrag: eintragAusZeile(data) }
}

export async function eintragAktualisieren(
  id: string,
  patch: { name?: string; beschreibung?: string | null; preis?: number; aktiv?: boolean }
): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const updateZeile: Record<string, unknown> = {}
  if (patch.name !== undefined) updateZeile.name = patch.name.trim()
  if (patch.beschreibung !== undefined) updateZeile.beschreibung = patch.beschreibung
  if (patch.preis !== undefined) updateZeile.preis = patch.preis
  if (patch.aktiv !== undefined) updateZeile.aktiv = patch.aktiv

  const { error } = await supabase.from('website_menu_eintraege').update(updateZeile).eq('id', id)
  if (error) return { fehler: error.message }
  return {}
}

export async function eintragLoeschen(id: string): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { error } = await supabase.from('website_menu_eintraege').delete().eq('id', id)
  if (error) return { fehler: error.message }
  return {}
}
