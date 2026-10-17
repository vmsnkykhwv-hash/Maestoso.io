import { getServiceClient } from '@/lib/supabase/server'

export type AnfrageArt = 'demo' | 'frage' | 'sonstiges' | 'founding_partner'
export type AnfragePaket = 'basic' | 'plus' | 'full'
export type Tageszeit = 'vormittags' | 'nachmittags' | 'abends'
export type AnfrageStatus = 'neu' | 'in_bearbeitung' | 'erledigt'

export const ANFRAGE_ART_LABEL: Record<AnfrageArt, string> = {
  demo: 'Demo-Termin',
  frage: 'Frage',
  sonstiges: 'Sonstiges',
  founding_partner: 'Founding-Partner-Bewerbung',
}
export const TAGESZEIT_LABEL: Record<Tageszeit, string> = {
  vormittags: 'vormittags',
  nachmittags: 'nachmittags',
  abends: 'abends',
}
export const ANFRAGE_STATUS_LABEL: Record<AnfrageStatus, string> = {
  neu: 'Neu',
  in_bearbeitung: 'In Bearbeitung',
  erledigt: 'Erledigt',
}

export type NeueAnfrage = {
  art: AnfrageArt
  name: string
  betrieb: string | null
  email: string
  telefon: string | null
  wunschtag: string | null
  tageszeit: Tageszeit | null
  nachricht: string | null
  paket: AnfragePaket | null
}

export type Anfrage = NeueAnfrage & {
  id: string
  erstelltAt: string
  status: AnfrageStatus
  notiz: string | null
}

// Nur der Plattform-Admin liest diese Tabelle – die Rechteprüfung macht die
// aufrufende Server Action (app/plattform-admin/anfragen/actions.ts).
export async function anfrageSpeichern(anfrage: NeueAnfrage): Promise<boolean> {
  const { error } = await getServiceClient().from('anfragen').insert(anfrage)
  if (error) console.error('Anfrage speichern:', error.message)
  return !error
}

export async function ladeAnfragen(): Promise<Anfrage[]> {
  const { data } = await getServiceClient()
    .from('anfragen')
    .select('id, erstellt_at, art, name, betrieb, email, telefon, wunschtag, tageszeit, nachricht, paket, status, notiz')
    .order('erstellt_at', { ascending: false })
    .limit(300)
  return (data ?? []).map((z) => ({
    id: z.id as string,
    erstelltAt: z.erstellt_at as string,
    art: z.art as AnfrageArt,
    name: z.name as string,
    betrieb: (z.betrieb as string | null) ?? null,
    email: z.email as string,
    telefon: (z.telefon as string | null) ?? null,
    wunschtag: (z.wunschtag as string | null) ?? null,
    tageszeit: (z.tageszeit as Tageszeit | null) ?? null,
    paket: (z.paket as AnfragePaket | null) ?? null,
    nachricht: (z.nachricht as string | null) ?? null,
    status: z.status as AnfrageStatus,
    notiz: (z.notiz as string | null) ?? null,
  }))
}

export async function anzahlNeueAnfragen(): Promise<number> {
  const { count } = await getServiceClient().from('anfragen').select('id', { count: 'exact', head: true }).eq('status', 'neu')
  return count ?? 0
}

export async function anfrageAktualisieren(id: string, patch: { status?: AnfrageStatus; notiz?: string | null }): Promise<boolean> {
  const { error } = await getServiceClient().from('anfragen').update(patch).eq('id', id)
  return !error
}

export async function adminEmails(): Promise<string[]> {
  const { data } = await getServiceClient().from('plattform_admins').select('email')
  return (data ?? []).map((z) => z.email as string)
}
