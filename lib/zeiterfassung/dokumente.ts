// Ablage von Arbeitsverträgen & Co. pro Mitarbeiter – privater
// Storage-Bucket (anders als website-bilder NICHT öffentlich lesbar,
// siehe 0011_zeiterfassung_dokumente.sql). Der Download läuft deshalb nie
// über getPublicUrl/eine signierte URL, sondern ausschließlich über
// `dokumentDatei()` + eine serverseitige Route, die vorher die
// Leitungs-Session prüft (app/dashboard/zeiterfassung/dokumente/[id]/route.ts).

import { getServiceClient } from '@/lib/supabase/server'
import type { MitarbeiterDokument } from './types'

const STORAGE_BUCKET = 'mitarbeiter-dokumente'

function dokumentAusZeile(d: Record<string, unknown>): MitarbeiterDokument {
  return {
    id: d.id as string,
    mitarbeiterId: d.mitarbeiter_id as string,
    dateiname: d.dateiname as string,
    groesseBytes: Number(d.groesse_bytes),
    hochgeladenAt: d.hochgeladen_at as string,
  }
}

export async function ladeDokumenteFuerMitarbeiter(mitarbeiterId: string, organisationId: string): Promise<MitarbeiterDokument[]> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('mitarbeiter_dokumente')
    .select('id, mitarbeiter_id, dateiname, groesse_bytes, hochgeladen_at')
    .eq('mitarbeiter_id', mitarbeiterId)
    .eq('organisation_id', organisationId)
    .order('hochgeladen_at', { ascending: false })

  return (data ?? []).map(dokumentAusZeile)
}

export async function dokumentHochladen(
  organisationId: string,
  mitarbeiterId: string,
  datei: File
): Promise<{ fehler?: string; dokument?: MitarbeiterDokument }> {
  const supabase = getServiceClient()
  const pfad = `${organisationId}/${mitarbeiterId}/${crypto.randomUUID()}-${datei.name}`

  const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(pfad, datei, {
    contentType: datei.type || undefined,
    upsert: false,
  })
  if (uploadError) return { fehler: uploadError.message }

  const { data, error } = await supabase
    .from('mitarbeiter_dokumente')
    .insert({
      organisation_id: organisationId,
      mitarbeiter_id: mitarbeiterId,
      dateiname: datei.name,
      storage_pfad: pfad,
      groesse_bytes: datei.size,
    })
    .select('id, mitarbeiter_id, dateiname, groesse_bytes, hochgeladen_at')
    .single()

  if (error || !data) {
    await supabase.storage.from(STORAGE_BUCKET).remove([pfad])
    return { fehler: error?.message ?? 'Hochladen fehlgeschlagen' }
  }

  return { dokument: dokumentAusZeile(data) }
}

export async function dokumentLoeschen(id: string, organisationId: string): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('mitarbeiter_dokumente')
    .select('storage_pfad')
    .eq('id', id)
    .eq('organisation_id', organisationId)
    .maybeSingle()
  if (!data) return { fehler: 'Dokument nicht gefunden' }

  await supabase.storage.from(STORAGE_BUCKET).remove([data.storage_pfad as string])

  const { error } = await supabase.from('mitarbeiter_dokumente').delete().eq('id', id).eq('organisation_id', organisationId)
  if (error) return { fehler: error.message }
  return {}
}

// Für den Download: liefert Pfad + Organisation, damit die Route prüfen
// kann, dass die anfragende Leitung zur selben Organisation gehört, bevor
// die Datei ausgeliefert wird.
export async function ladeDokumentFuerDownload(
  id: string
): Promise<{ organisationId: string; storagePfad: string; dateiname: string } | null> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('mitarbeiter_dokumente')
    .select('organisation_id, storage_pfad, dateiname')
    .eq('id', id)
    .maybeSingle()

  if (!data) return null
  return {
    organisationId: data.organisation_id as string,
    storagePfad: data.storage_pfad as string,
    dateiname: data.dateiname as string,
  }
}

export async function dokumentDatei(storagePfad: string): Promise<Blob | null> {
  const supabase = getServiceClient()
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(storagePfad)
  if (error || !data) return null
  return data
}
