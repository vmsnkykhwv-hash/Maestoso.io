import { getServiceClient } from '@/lib/supabase/server'
import type { PaypalZahlungseinstellungen } from './types'

const STANDARD_EINSTELLUNGEN: PaypalZahlungseinstellungen = {
  clientId: null,
  clientSecret: null,
  modus: 'sandbox',
  aktiv: false,
  webhookId: null,
}

// Client-ID + Secret landen nie im Browser: diese Funktion wird
// ausschließlich aus Server Actions/Routen aufgerufen, nie an den Client
// zurückgegeben (siehe PaypalEinstellungenForm.tsx – dort kommt das Secret
// nur maskiert/als "gesetzt"-Hinweis an).
export async function ladePaypalEinstellungen(organisationId: string): Promise<PaypalZahlungseinstellungen> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('organisation_zahlungseinstellungen')
    .select('*')
    .eq('organisation_id', organisationId)
    .maybeSingle()

  if (!data) return STANDARD_EINSTELLUNGEN

  return {
    clientId: (data.paypal_client_id as string | null) ?? null,
    clientSecret: (data.paypal_client_secret as string | null) ?? null,
    modus: data.paypal_modus as PaypalZahlungseinstellungen['modus'],
    aktiv: data.paypal_aktiv as boolean,
    webhookId: (data.paypal_webhook_id as string | null) ?? null,
  }
}

export async function paypalEinstellungenSpeichern(
  organisationId: string,
  einstellungen: {
    clientId: string
    clientSecret?: string
    modus: PaypalZahlungseinstellungen['modus']
    aktiv: boolean
    webhookId?: string
  }
): Promise<{ fehler?: string }> {
  const supabase = getServiceClient()

  // Secret nur überschreiben, wenn eines mitgeschickt wurde – im Formular
  // wird das bestehende Secret nie angezeigt, ein leeres Feld heißt also
  // "unverändert lassen", nicht "löschen". webhookId entsprechend: nur
  // setzen, wenn gerade neu bei PayPal registriert (siehe aktionen.ts).
  const patch: Record<string, unknown> = {
    organisation_id: organisationId,
    paypal_client_id: einstellungen.clientId,
    paypal_modus: einstellungen.modus,
    paypal_aktiv: einstellungen.aktiv,
  }
  if (einstellungen.clientSecret) patch.paypal_client_secret = einstellungen.clientSecret
  if (einstellungen.webhookId) patch.paypal_webhook_id = einstellungen.webhookId

  const { error } = await supabase.from('organisation_zahlungseinstellungen').upsert(patch)
  if (error) return { fehler: error.message }
  return {}
}
