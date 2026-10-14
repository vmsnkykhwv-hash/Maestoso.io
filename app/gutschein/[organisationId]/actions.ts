'use server'

import { organisationsName } from '@/lib/tischplan/daten'
import { ladeGutscheinEinstellungen, gutscheinAnlegen, gutscheinPaypalOrderSetzen } from '@/lib/gutschein/daten'
import { gutscheinBestaetigungsMailSenden } from '@/lib/gutschein/email'
import { ladePaypalEinstellungen } from '@/lib/paypal/daten'
import { paypalOrderErstellen } from '@/lib/paypal/client'
import { herkunftUrl } from '@/lib/url'
import { oeffentlicheAnfrageSchluessel, rateLimitFehlgeschlagen, rateLimitPruefen, warteHinweis } from '@/lib/rateLimit'

const EMAIL_MUSTER = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SPERRE_AB_VERSUCHEN = 8

export async function gutscheinSeiteLadenAktion(
  organisationId: string
): Promise<{ name: string; aktiv: boolean; betraege: number[]; paypalVerfuegbar: boolean } | null> {
  const name = await organisationsName(organisationId)
  if (!name) return null

  const [einstellungen, paypal] = await Promise.all([
    ladeGutscheinEinstellungen(organisationId),
    ladePaypalEinstellungen(organisationId),
  ])

  return {
    name,
    aktiv: einstellungen.aktiv,
    betraege: einstellungen.betraege,
    paypalVerfuegbar: paypal.aktiv && !!paypal.clientId && !!paypal.clientSecret,
  }
}

export async function gutscheinKaufenAktion(input: {
  organisationId: string
  betrag: number
  name: string
  email: string
  zahlungsart: 'paypal' | 'vor_ort'
}): Promise<{ fehler?: string; code?: string; freigabeLink?: string }> {
  const name = input.name.trim()
  const email = input.email.trim()

  if (name.length < 1 || name.length > 80) return { fehler: 'Bitte einen Namen angeben.' }
  if (!EMAIL_MUSTER.test(email)) return { fehler: 'Bitte eine gültige E-Mail-Adresse angeben.' }
  if (!(input.betrag > 0)) return { fehler: 'Ungültiger Betrag.' }

  // Spam-Schutz: pro Organisation + IP, nicht global – eine Spam-Welle gegen
  // eine Organisation soll nicht alle anderen mitbremsen.
  const sperrschluessel = await oeffentlicheAnfrageSchluessel('gutschein', input.organisationId)
  const sperre = await rateLimitPruefen(sperrschluessel)
  if (!sperre.erlaubt) return { fehler: warteHinweis(sperre.wartenSekunden!) }

  const organisationName = await organisationsName(input.organisationId)
  if (!organisationName) return { fehler: 'Diese Organisation wurde nicht gefunden.' }

  const einstellungen = await ladeGutscheinEinstellungen(input.organisationId)
  if (!einstellungen.aktiv) return { fehler: 'Gutscheine werden hier aktuell nicht verkauft.' }
  if (!einstellungen.betraege.includes(input.betrag)) return { fehler: 'Dieser Betrag ist nicht verfügbar.' }

  await rateLimitFehlgeschlagen(sperrschluessel, SPERRE_AB_VERSUCHEN)

  if (input.zahlungsart === 'vor_ort') {
    const ergebnis = await gutscheinAnlegen({
      organisationId: input.organisationId,
      betrag: input.betrag,
      kaeuferName: name,
      kaeuferEmail: email,
      zahlungsart: 'vor_ort',
    })
    if (ergebnis.fehler || !ergebnis.gutschein) return { fehler: ergebnis.fehler ?? 'Gutschein konnte nicht angelegt werden.' }

    await gutscheinBestaetigungsMailSenden({
      organisationName,
      empfaenger: email,
      kaeuferName: name,
      betrag: input.betrag,
      code: ergebnis.gutschein.code,
    })

    return { code: ergebnis.gutschein.code }
  }

  const paypal = await ladePaypalEinstellungen(input.organisationId)
  if (!paypal.aktiv || !paypal.clientId || !paypal.clientSecret) {
    return { fehler: 'Online-Zahlung ist hier aktuell nicht verfügbar.' }
  }

  const ergebnis = await gutscheinAnlegen({
    organisationId: input.organisationId,
    betrag: input.betrag,
    kaeuferName: name,
    kaeuferEmail: email,
    zahlungsart: 'paypal',
  })
  if (ergebnis.fehler || !ergebnis.gutschein) return { fehler: ergebnis.fehler ?? 'Gutschein konnte nicht angelegt werden.' }

  const basis = await herkunftUrl(input.organisationId)
  const order = await paypalOrderErstellen({
    clientId: paypal.clientId,
    clientSecret: paypal.clientSecret,
    modus: paypal.modus,
    betrag: input.betrag,
    referenz: ergebnis.gutschein.id,
    beschreibung: `Gutschein ${organisationName}`,
    returnUrl: `${basis}/gutschein/${input.organisationId}/erfolg?gutscheinId=${ergebnis.gutschein.id}`,
    cancelUrl: `${basis}/gutschein/${input.organisationId}`,
  })

  if ('fehler' in order) return { fehler: order.fehler }

  await gutscheinPaypalOrderSetzen(ergebnis.gutschein.id, order.orderId)

  return { freigabeLink: order.freigabeLink }
}
