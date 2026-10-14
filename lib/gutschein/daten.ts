import { getServiceClient } from '@/lib/supabase/server'
import type { Gutschein, GutscheinEinstellungen } from './types'

const STANDARD_EINSTELLUNGEN: GutscheinEinstellungen = {
  aktiv: false,
  betraege: [25, 50, 100],
}

function ausZeile(z: Record<string, unknown>): Gutschein {
  return {
    id: z.id as string,
    organisationId: z.organisation_id as string,
    code: z.code as string,
    betrag: Number(z.betrag),
    kaeuferName: z.kaeufer_name as string,
    kaeuferEmail: z.kaeufer_email as string,
    zahlungsart: z.zahlungsart as Gutschein['zahlungsart'],
    status: z.status as Gutschein['status'],
    paypalOrderId: (z.paypal_order_id as string | null) ?? null,
    erstelltAt: z.erstellt_at as string,
    bezahltAm: (z.bezahlt_am as string | null) ?? null,
    eingeloestAm: (z.eingeloest_am as string | null) ?? null,
  }
}

export async function ladeGutscheinEinstellungen(organisationId: string): Promise<GutscheinEinstellungen> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('gutschein_einstellungen')
    .select('*')
    .eq('organisation_id', organisationId)
    .maybeSingle()

  if (!data) return STANDARD_EINSTELLUNGEN

  return {
    aktiv: data.aktiv as boolean,
    betraege: (data.betraege as number[]).map(Number),
  }
}

export async function gutscheinEinstellungenSpeichern(
  organisationId: string,
  einstellungen: GutscheinEinstellungen
): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { error } = await supabase.from('gutschein_einstellungen').upsert({
    organisation_id: organisationId,
    aktiv: einstellungen.aktiv,
    betraege: einstellungen.betraege,
  })
  if (error) return { fehler: error.message }
  return {}
}

function zufallsCode(): string {
  const zeichen = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // ohne leicht verwechselbare Zeichen (I, O, 0, 1)
  let code = ''
  for (let i = 0; i < 8; i++) code += zeichen[Math.floor(Math.random() * zeichen.length)]
  return code
}

export async function gutscheinAnlegen(input: {
  organisationId: string
  betrag: number
  kaeuferName: string
  kaeuferEmail: string
  zahlungsart: Gutschein['zahlungsart']
}): Promise<{ fehler?: string; gutschein?: Gutschein }> {
  const supabase = getServiceClient()

  // Code-Kollisionen sind bei 8 Zeichen aus 32 praktisch ausgeschlossen,
  // ein erneuter Versuch kostet aber nichts.
  for (let versuch = 0; versuch < 5; versuch++) {
    const { data, error } = await supabase
      .from('gutscheine')
      .insert({
        organisation_id: input.organisationId,
        code: zufallsCode(),
        betrag: input.betrag,
        kaeufer_name: input.kaeuferName,
        kaeufer_email: input.kaeuferEmail,
        zahlungsart: input.zahlungsart,
      })
      .select('*')
      .single()

    if (!error) return { gutschein: ausZeile(data) }
    if (!error.message.includes('duplicate key')) {
      console.error('gutscheinAnlegen fehlgeschlagen:', error.message)
      return { fehler: 'Gutschein konnte nicht angelegt werden. Bitte versucht es erneut.' }
    }
  }

  return { fehler: 'Gutschein-Code konnte nicht vergeben werden, bitte erneut versuchen.' }
}

export async function ladeGutschein(id: string): Promise<Gutschein | null> {
  const supabase = getServiceClient()
  const { data } = await supabase.from('gutscheine').select('*').eq('id', id).maybeSingle()
  return data ? ausZeile(data) : null
}

export async function gutscheinPaypalOrderSetzen(id: string, paypalOrderId: string): Promise<void> {
  const supabase = getServiceClient()
  await supabase.from('gutscheine').update({ paypal_order_id: paypalOrderId }).eq('id', id)
}

// Für den PayPal-Webhook: der Event liefert nur die Order-ID, nicht die
// Gutschein-ID direkt.
export async function gutscheinNachPaypalOrderLaden(organisationId: string, paypalOrderId: string): Promise<Gutschein | null> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('gutscheine')
    .select('*')
    .eq('organisation_id', organisationId)
    .eq('paypal_order_id', paypalOrderId)
    .maybeSingle()
  return data ? ausZeile(data) : null
}

// organisationId ist optional: der PayPal-Erfassungs-Pfad
// (lib/gutschein/zahlung.ts) hat den Gutschein bereits geladen und auf die
// richtige Organisation geprüft; das Dashboard (gutscheinAlsBezahltMarkierenAktion,
// "vor Ort bezahlt") muss es hier selbst erzwingen, sonst könnte eine
// Organisation den Gutschein einer anderen als bezahlt markieren.
export async function gutscheinAlsBezahltMarkieren(id: string, organisationId?: string): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  let query = supabase
    .from('gutscheine')
    .update({ status: 'bezahlt', bezahlt_am: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'offen')
  if (organisationId) query = query.eq('organisation_id', organisationId)

  const { data, error } = await query.select('id')
  if (error) return { fehler: error.message }
  if (!data || data.length === 0) return { fehler: 'Dieser Gutschein ist nicht (mehr) offen' }
  return {}
}

export async function ladeGutscheineFuerOrganisation(organisationId: string): Promise<Gutschein[]> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('gutscheine')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('erstellt_at', { ascending: false })
  return (data ?? []).map(ausZeile)
}

export async function gutscheinNachCodeLaden(organisationId: string, code: string): Promise<Gutschein | null> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('gutscheine')
    .select('*')
    .eq('organisation_id', organisationId)
    .eq('code', code.trim().toUpperCase())
    .maybeSingle()
  return data ? ausZeile(data) : null
}

// Bedingtes Update (nur von Status "bezahlt") statt eines blinden
// Status-Setzens – verhindert, dass derselbe Gutschein zweimal eingelöst
// wird, falls zwei Einlöse-Versuche (Doppelklick, zwei Terminals)
// fast gleichzeitig ankommen.
export async function gutscheinEinloesen(id: string, organisationId: string): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('gutscheine')
    .update({ status: 'eingeloest', eingeloest_am: new Date().toISOString() })
    .eq('id', id)
    .eq('organisation_id', organisationId)
    .eq('status', 'bezahlt')
    .select('id')
  if (error) return { fehler: error.message }
  if (!data || data.length === 0) return { fehler: 'Dieser Gutschein ist nicht (mehr) gültig' }
  return {}
}

export async function gutscheinStornieren(id: string, organisationId: string): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('gutscheine')
    .update({ status: 'storniert' })
    .eq('id', id)
    .eq('organisation_id', organisationId)
    .eq('status', 'offen')
    .select('id')
  if (error) return { fehler: error.message }
  if (!data || data.length === 0) return { fehler: 'Dieser Gutschein kann nicht (mehr) storniert werden' }
  return {}
}
