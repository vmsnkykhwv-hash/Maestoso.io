// Unabhängig vom Rückkehr-Browser des Käufers (siehe
// lib/gutschein/zahlung.ts): PayPal ruft diese Route selbst auf, sobald
// eine Order freigegeben wurde – auch wenn der Kunde seinen Tab vorher
// geschlossen hat. Wird beim Speichern aktiver PayPal-Einstellungen
// automatisch bei PayPal registriert (siehe app/dashboard/gutschein/actions.ts).
import { NextRequest } from 'next/server'
import { ladePaypalEinstellungen } from '@/lib/paypal/daten'
import { paypalWebhookSignaturPruefen } from '@/lib/paypal/client'
import { gutscheinNachPaypalOrderLaden } from '@/lib/gutschein/daten'
import { gutscheinPaypalZahlungErfassen } from '@/lib/gutschein/zahlung'

export async function POST(request: NextRequest, { params }: { params: Promise<{ organisationId: string }> }) {
  const { organisationId } = await params
  const paypal = await ladePaypalEinstellungen(organisationId)

  if (!paypal.clientId || !paypal.clientSecret || !paypal.webhookId) {
    return new Response('PayPal nicht konfiguriert', { status: 404 })
  }

  const body = await request.json().catch(() => null)
  if (!body) return new Response('Ungültiger Body', { status: 400 })

  const gueltig = await paypalWebhookSignaturPruefen({
    clientId: paypal.clientId,
    clientSecret: paypal.clientSecret,
    modus: paypal.modus,
    webhookId: paypal.webhookId,
    authAlgo: request.headers.get('paypal-auth-algo') ?? '',
    certUrl: request.headers.get('paypal-cert-url') ?? '',
    transmissionId: request.headers.get('paypal-transmission-id') ?? '',
    transmissionSig: request.headers.get('paypal-transmission-sig') ?? '',
    transmissionTime: request.headers.get('paypal-transmission-time') ?? '',
    webhookEvent: body,
  })
  if (!gueltig) return new Response('Signatur ungültig', { status: 400 })

  // Nur der Freigabe-Event interessiert uns – das Erfassen (Capture) der
  // Zahlung übernimmt weiterhin unser eigener Code, nicht PayPal selbst.
  if (body.event_type === 'CHECKOUT.ORDER.APPROVED') {
    const orderId = body.resource?.id as string | undefined
    if (orderId) {
      const gutschein = await gutscheinNachPaypalOrderLaden(organisationId, orderId)
      if (gutschein) await gutscheinPaypalZahlungErfassen(organisationId, gutschein)
    }
  }

  return new Response('OK', { status: 200 })
}

export const dynamic = 'force-dynamic'
