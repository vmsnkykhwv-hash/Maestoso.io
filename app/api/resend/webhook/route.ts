// Ein einziger, plattformweiter Webhook (nicht pro Organisation wie bei
// PayPal, siehe app/api/paypal/webhook/[organisationId]/route.ts) – Resend
// läuft über einen gemeinsamen RESEND_API_KEY (lib/bewertung/email.ts), nicht
// pro Organisation. Welche Organisation ein Event betrifft, ergibt sich aus
// der Resend-ID in der bewertungsanfragen-Tabelle.
//
// Einrichtung bei Resend: Webhook-URL auf <domain>/api/resend/webhook
// eintragen, Events "email.opened" und "email.clicked" aktivieren
// (Open-/Click-Tracking muss für die sendende Domain zusätzlich in den
// Resend-Domain-Einstellungen aktiv sein), Signing Secret als
// RESEND_WEBHOOK_SECRET hinterlegen.
import { NextRequest } from 'next/server'
import { Webhook } from 'svix'
import { bewertungsanfrageEventSetzen } from '@/lib/bewertung/daten'

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return new Response('Webhook nicht konfiguriert', { status: 404 })

  const body = await request.text()
  const svixHeaders = {
    'svix-id': request.headers.get('svix-id') ?? '',
    'svix-timestamp': request.headers.get('svix-timestamp') ?? '',
    'svix-signature': request.headers.get('svix-signature') ?? '',
  }

  try {
    // Wirft bei ungültiger Signatur, gibt selbst aber nichts zurück – der
    // Body wird erst danach (also nur für bereits verifizierte Requests)
    // geparst.
    new Webhook(secret).verify(body, svixHeaders)
  } catch {
    return new Response('Signatur ungültig', { status: 400 })
  }

  const event = JSON.parse(body) as { type?: string; data?: { email_id?: string } }

  const resendId = event.data?.email_id
  if (resendId) {
    if (event.type === 'email.opened') await bewertungsanfrageEventSetzen(resendId, 'geoeffnet_am')
    // Ein Klick zählt auch als geöffnet – ohne Open-Tracking (z. B.
    // Bild-Blocker) käme sonst nur der Klick an, die Öffnungsrate wäre
    // niedriger als die Klickrate.
    if (event.type === 'email.clicked') {
      await bewertungsanfrageEventSetzen(resendId, 'geoeffnet_am')
      await bewertungsanfrageEventSetzen(resendId, 'geklickt_am')
    }
  }

  return new Response('OK', { status: 200 })
}

export const dynamic = 'force-dynamic'
