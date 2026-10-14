-- Schließt die Lücke aus 0013: Bricht der Käufer nach der PayPal-Freigabe
-- ab, bevor der Browser zur Rückkehr-Seite zurückfindet (Tab geschlossen,
-- Verbindung weg), blieb der Gutschein für immer auf "Offen" hängen – die
-- Rückkehr-Seite war der einzige Ort, der die Zahlung erfasst hat. Ein
-- PayPal-Webhook ist vom Browser des Käufers unabhängig und erfasst die
-- Zahlung zusätzlich, sobald PayPal sie meldet (siehe lib/paypal/webhook.ts).

alter table organisation_zahlungseinstellungen add column if not exists paypal_webhook_id text;
