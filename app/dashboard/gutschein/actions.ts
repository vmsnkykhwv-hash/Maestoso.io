'use server'

import { getSitzung } from '@/lib/session'
import {
  gutscheinEinloesen,
  gutscheinStornieren,
  ladeGutscheineFuerOrganisation,
  gutscheinEinstellungenSpeichern,
  gutscheinAlsBezahltMarkieren,
  gutscheinNachCodeLaden,
} from '@/lib/gutschein/daten'
import { ladePaypalEinstellungen, paypalEinstellungenSpeichern } from '@/lib/paypal/daten'
import { paypalWebhookRegistrieren } from '@/lib/paypal/client'
import { plattformUrl } from '@/lib/url'
import type { Gutschein, GutscheinEinstellungen } from '@/lib/gutschein/types'
import type { PaypalModus } from '@/lib/paypal/types'

const PAYPAL_WEBHOOK_EVENTS = ['CHECKOUT.ORDER.APPROVED']

async function organisationId(): Promise<string | null> {
  const sitzung = await getSitzung()
  if (!sitzung || sitzung.typ !== 'organisation') return null
  return sitzung.organisationId
}

export async function gutscheineLadenAktion(): Promise<Gutschein[]> {
  const orgId = await organisationId()
  if (!orgId) return []
  return ladeGutscheineFuerOrganisation(orgId)
}

export async function gutscheinEinstellungenSpeichernAktion(einstellungen: GutscheinEinstellungen): Promise<{ fehler?: string }> {
  const orgId = await organisationId()
  if (!orgId) return { fehler: 'Nicht angemeldet.' }
  return gutscheinEinstellungenSpeichern(orgId, einstellungen)
}

// Das Secret wird nie ans Dashboard zurückgegeben – nur ob eines
// hinterlegt ist. Ein leeres Secret-Feld im Formular heißt beim Speichern
// "unverändert lassen" (siehe lib/paypal/daten.ts).
export async function paypalEinstellungenLadenAktion(): Promise<{
  clientId: string
  secretHinterlegt: boolean
  modus: PaypalModus
  aktiv: boolean
}> {
  const orgId = await organisationId()
  if (!orgId) return { clientId: '', secretHinterlegt: false, modus: 'sandbox', aktiv: false }
  const einstellungen = await ladePaypalEinstellungen(orgId)
  return {
    clientId: einstellungen.clientId ?? '',
    secretHinterlegt: !!einstellungen.clientSecret,
    modus: einstellungen.modus,
    aktiv: einstellungen.aktiv,
  }
}

export async function paypalEinstellungenSpeichernAktion(input: {
  clientId: string
  clientSecret: string
  modus: PaypalModus
  aktiv: boolean
}): Promise<{ fehler?: string; warnung?: string }> {
  const orgId = await organisationId()
  if (!orgId) return { fehler: 'Nicht angemeldet.' }

  const bestehend = await ladePaypalEinstellungen(orgId)
  const clientId = input.clientId.trim()
  const neuesSecret = input.clientSecret.trim()
  if (input.aktiv && !clientId) return { fehler: 'Bitte eine Client-ID angeben.' }
  if (input.aktiv && !neuesSecret && !bestehend.clientSecret) {
    return { fehler: 'Bitte ein Secret angeben.' }
  }

  // Webhook läuft automatisch mit, damit die Leitung nie selbst ins
  // PayPal-Entwickler-Dashboard muss – nur neu registrieren, wenn noch
  // keiner hinterlegt ist oder sich die Zugangsdaten gerade geändert
  // haben (neues Secret = vermutlich neue PayPal-App).
  let webhookId: string | undefined
  let warnung: string | undefined
  if (input.aktiv && (!bestehend.webhookId || neuesSecret)) {
    // Plattform-Domain statt Domain des Betriebs: Webhooks sieht kein Gast,
    // und so bleibt die Adresse auch bei einem späteren Domainwechsel gültig.
    const basis = await plattformUrl()
    const ergebnis = await paypalWebhookRegistrieren({
      clientId,
      clientSecret: neuesSecret || bestehend.clientSecret!,
      modus: input.modus,
      url: `${basis}/api/paypal/webhook/${orgId}`,
      eventTypes: PAYPAL_WEBHOOK_EVENTS,
    })
    if ('webhookId' in ergebnis) webhookId = ergebnis.webhookId
    else warnung = 'PayPal-Zugangsdaten gespeichert, aber die automatische Zahlungsbestätigung (Webhook) konnte nicht eingerichtet werden – nur die Rückkehr-Seite erfasst Zahlungen dann vorerst.'
  }

  const speichernErgebnis = await paypalEinstellungenSpeichern(orgId, {
    clientId,
    clientSecret: neuesSecret || undefined,
    modus: input.modus,
    aktiv: input.aktiv,
    webhookId,
  })
  if (speichernErgebnis.fehler) return speichernErgebnis

  return warnung ? { warnung } : {}
}

export async function gutscheinAlsBezahltMarkierenAktion(id: string): Promise<{ fehler?: string }> {
  const orgId = await organisationId()
  if (!orgId) return { fehler: 'Nicht angemeldet.' }
  return gutscheinAlsBezahltMarkieren(id, orgId)
}

export async function gutscheinEinloesenPerCodeAktion(code: string): Promise<{ fehler?: string }> {
  const orgId = await organisationId()
  if (!orgId) return { fehler: 'Nicht angemeldet.' }

  const gutschein = await gutscheinNachCodeLaden(orgId, code)
  if (!gutschein) return { fehler: 'Kein Gutschein mit diesem Code gefunden.' }
  if (gutschein.status === 'eingeloest') return { fehler: 'Dieser Gutschein wurde bereits eingelöst.' }
  if (gutschein.status === 'storniert') return { fehler: 'Dieser Gutschein wurde storniert.' }
  if (gutschein.status === 'offen') return { fehler: 'Dieser Gutschein wurde noch nicht bezahlt.' }

  return gutscheinEinloesen(gutschein.id, orgId)
}

export async function gutscheinStornierenAktion(id: string): Promise<{ fehler?: string }> {
  const orgId = await organisationId()
  if (!orgId) return { fehler: 'Nicht angemeldet.' }
  return gutscheinStornieren(id, orgId)
}
