export type PaypalModus = 'sandbox' | 'live'

export type PaypalZahlungseinstellungen = {
  clientId: string | null
  clientSecret: string | null
  modus: PaypalModus
  aktiv: boolean
  // Interne ID des bei PayPal registrierten Webhooks (siehe
  // lib/paypal/webhook.ts) – landet nie im Dashboard-Formular.
  webhookId: string | null
}
