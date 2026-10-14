// Gemeinsame Logik für beide Wege, auf denen eine PayPal-Zahlung als
// abgeschlossen erkannt wird: die Rückkehr-Seite
// (app/gutschein/[organisationId]/erfolg) und der Webhook
// (app/api/paypal/webhook/[organisationId]) – je nachdem, was zuerst
// ankommt. Beide rufen dieselbe Funktion auf, daher ist sie idempotent:
// ein bereits bezahlter/eingelöster Gutschein wird nicht zweimal erfasst.
import { organisationsName } from '@/lib/tischplan/daten'
import { ladePaypalEinstellungen } from '@/lib/paypal/daten'
import { paypalOrderErfassen } from '@/lib/paypal/client'
import { gutscheinAlsBezahltMarkieren, ladeGutschein } from './daten'
import { gutscheinBestaetigungsMailSenden } from './email'
import type { Gutschein } from './types'

export async function gutscheinPaypalZahlungErfassen(
  organisationId: string,
  gutschein: Gutschein
): Promise<{ fehler?: string }> {
  if (gutschein.status === 'bezahlt' || gutschein.status === 'eingeloest') return {}
  if (!gutschein.paypalOrderId) return { fehler: 'Zu diesem Gutschein liegt keine PayPal-Bestellung vor.' }

  const [organisationName, paypal] = await Promise.all([organisationsName(organisationId), ladePaypalEinstellungen(organisationId)])
  if (!organisationName) return { fehler: 'Organisation nicht gefunden.' }
  if (!paypal.clientId || !paypal.clientSecret) return { fehler: 'PayPal-Zugangsdaten fehlen.' }

  const erfassung = await paypalOrderErfassen({
    clientId: paypal.clientId,
    clientSecret: paypal.clientSecret,
    modus: paypal.modus,
    orderId: gutschein.paypalOrderId,
    erwarteterBetrag: gutschein.betrag,
  })
  if (!erfassung.erfolg) return { fehler: erfassung.fehler }

  // Zwischen dem Laden oben und hier könnte der jeweils andere Weg
  // (Webhook bzw. Rückkehr-Seite) bereits markiert haben – das bedingte
  // Update in gutscheinAlsBezahltMarkieren (nur von Status "offen") ist
  // der eigentliche Schutz davor, diese Vorab-Prüfung erspart nur den
  // überflüssigen zweiten Mailversand im Normalfall.
  const aktuell = await ladeGutschein(gutschein.id)
  if (aktuell?.status === 'bezahlt' || aktuell?.status === 'eingeloest') return {}

  const markiert = await gutscheinAlsBezahltMarkieren(gutschein.id, organisationId)
  if (markiert.fehler) return {}

  await gutscheinBestaetigungsMailSenden({
    organisationName,
    empfaenger: gutschein.kaeuferEmail,
    kaeuferName: gutschein.kaeuferName,
    betrag: gutschein.betrag,
    code: gutschein.code,
  })

  return {}
}
