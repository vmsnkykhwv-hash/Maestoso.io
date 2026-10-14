// Dünner Wrapper um die PayPal Orders API v2 (Redirect-Flow, kein
// JavaScript-SDK nötig). Jede Organisation nutzt ihre eigenen
// Zugangsdaten (siehe daten.ts) – das Geld fließt direkt an sie, wir
// speichern oder verarbeiten nie eine Kartennummer o. Ä.
import type { PaypalModus } from './types'

function basisUrl(modus: PaypalModus): string {
  return modus === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
}

async function holeZugriffsToken(clientId: string, clientSecret: string, modus: PaypalModus): Promise<string | null> {
  const antwort = await fetch(`${basisUrl(modus)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!antwort.ok) return null
  const daten = await antwort.json()
  return (daten.access_token as string) ?? null
}

export async function paypalOrderErstellen(params: {
  clientId: string
  clientSecret: string
  modus: PaypalModus
  betrag: number
  referenz: string
  beschreibung: string
  returnUrl: string
  cancelUrl: string
}): Promise<{ orderId: string; freigabeLink: string } | { fehler: string }> {
  const token = await holeZugriffsToken(params.clientId, params.clientSecret, params.modus)
  if (!token) return { fehler: 'PayPal-Zugangsdaten konnten nicht geprüft werden.' }

  const antwort = await fetch(`${basisUrl(params.modus)}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          custom_id: params.referenz,
          description: params.beschreibung,
          amount: { currency_code: 'EUR', value: params.betrag.toFixed(2) },
        },
      ],
      application_context: {
        return_url: params.returnUrl,
        cancel_url: params.cancelUrl,
        user_action: 'PAY_NOW',
        shipping_preference: 'NO_SHIPPING',
      },
    }),
  })

  if (!antwort.ok) return { fehler: 'PayPal-Bestellung konnte nicht angelegt werden.' }
  const daten = await antwort.json()
  const freigabeLink = (daten.links as { rel: string; href: string }[] | undefined)?.find((l) => l.rel === 'approve')?.href
  if (!freigabeLink) return { fehler: 'PayPal hat keinen Freigabe-Link geliefert.' }

  return { orderId: daten.id as string, freigabeLink }
}

export async function paypalOrderErfassen(params: {
  clientId: string
  clientSecret: string
  modus: PaypalModus
  orderId: string
  erwarteterBetrag: number
}): Promise<{ erfolg: true } | { erfolg: false; fehler: string }> {
  const token = await holeZugriffsToken(params.clientId, params.clientSecret, params.modus)
  if (!token) return { erfolg: false, fehler: 'PayPal-Zugangsdaten konnten nicht geprüft werden.' }

  const antwort = await fetch(`${basisUrl(params.modus)}/v2/checkout/orders/${params.orderId}/capture`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })

  const daten = await antwort.json().catch(() => null)

  if (!antwort.ok) {
    // Webhook und Rückkehr-Seite können beide versuchen, dieselbe Order zu
    // erfassen (wer zuerst ankommt) – PayPal lehnt den zweiten Versuch ab,
    // das ist dann kein echter Fehler, sondern bereits erledigt.
    const bereitsErfasst = (daten?.details as { issue?: string }[] | undefined)?.some((d) => d.issue === 'ORDER_ALREADY_CAPTURED')
    if (bereitsErfasst) return { erfolg: true }
    return { erfolg: false, fehler: 'Zahlung konnte nicht erfasst werden.' }
  }
  if (daten.status !== 'COMPLETED') return { erfolg: false, fehler: 'Zahlung wurde nicht abgeschlossen.' }

  // Die Order wurde beim Anlegen zwar schon mit dem richtigen Betrag
  // erstellt (siehe paypalOrderErstellen), aber nie vertrauen wir allein der
  // orderId – erst der tatsächlich erfasste Betrag/Währung aus der
  // Capture-Antwort entscheidet, ob der Gutschein als bezahlt gilt. Sonst
  // könnte eine manipulierte orderId (fremde, echte PayPal-Order mit
  // abweichendem Betrag) einen Gutschein zum falschen Wert freischalten.
  const capture = (daten.purchase_units as { payments?: { captures?: { amount?: { value?: string; currency_code?: string } }[] } }[] | undefined)?.[0]
    ?.payments?.captures?.[0]
  const erfassterBetrag = capture?.amount?.value ? Number(capture.amount.value) : NaN
  const waehrung = capture?.amount?.currency_code
  if (waehrung !== 'EUR' || !Number.isFinite(erfassterBetrag) || Math.abs(erfassterBetrag - params.erwarteterBetrag) > 0.001) {
    return { erfolg: false, fehler: 'Erfasster Betrag stimmt nicht mit der Bestellung überein.' }
  }

  return { erfolg: true }
}

// Registriert unseren Webhook bei PayPal für die Organisation – läuft
// automatisch beim Speichern der PayPal-Einstellungen, die Leitung muss
// dafür nie selbst ins PayPal-Entwickler-Dashboard.
export async function paypalWebhookRegistrieren(params: {
  clientId: string
  clientSecret: string
  modus: PaypalModus
  url: string
  eventTypes: string[]
}): Promise<{ webhookId: string } | { fehler: string }> {
  const token = await holeZugriffsToken(params.clientId, params.clientSecret, params.modus)
  if (!token) return { fehler: 'PayPal-Zugangsdaten konnten nicht geprüft werden.' }

  const antwort = await fetch(`${basisUrl(params.modus)}/v1/notifications/webhooks`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: params.url,
      event_types: params.eventTypes.map((name) => ({ name })),
    }),
  })

  if (!antwort.ok) return { fehler: 'Webhook konnte bei PayPal nicht registriert werden.' }
  const daten = await antwort.json()
  return { webhookId: daten.id as string }
}

// PayPal empfiehlt, die Signatur über diesen Endpunkt prüfen zu lassen,
// statt das Zertifikat selbst zu verifizieren – schlanker und genauso
// sicher, solange der Aufruf immer mit den eigenen Zugangsdaten der
// Organisation läuft.
export async function paypalWebhookSignaturPruefen(params: {
  clientId: string
  clientSecret: string
  modus: PaypalModus
  webhookId: string
  authAlgo: string
  certUrl: string
  transmissionId: string
  transmissionSig: string
  transmissionTime: string
  webhookEvent: unknown
}): Promise<boolean> {
  const token = await holeZugriffsToken(params.clientId, params.clientSecret, params.modus)
  if (!token) return false

  const antwort = await fetch(`${basisUrl(params.modus)}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_algo: params.authAlgo,
      cert_url: params.certUrl,
      transmission_id: params.transmissionId,
      transmission_sig: params.transmissionSig,
      transmission_time: params.transmissionTime,
      webhook_id: params.webhookId,
      webhook_event: params.webhookEvent,
    }),
  })

  if (!antwort.ok) return false
  const daten = await antwort.json()
  return daten.verification_status === 'SUCCESS'
}
